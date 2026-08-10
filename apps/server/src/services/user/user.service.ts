// services/user/user.service.ts
import { db, MFADeviceType, Prisma, SignupSource, UserRole, VerificationStatus, VerificationMethod, IDDocumentType, TwoFactorMethod, VerificationLevel } from "@repo/database";
import { logger } from '@repo/logger';
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import geoip from 'geoip-lite';
import type {
  CheckSuspiciousActivityInput,
  FlagSuspiciousLoginInput,
  RecordLoginActivityInput,
  SuspiciousActivityResult,
  FlagSuspiciousLoginResult,
  RecordLoginActivityResult,
} from '../../types/suspicious-activity.types';
import type {
  GDPRExportData,
  ExportUserDataw,
  ExportProfileData,
  ExportAccountData,
  ExportOrderData,
  ExportReviewData,
  ExportCommentData,
  ExportAuditLogData,
  ExportSearchHistoryData,
  ExportVerificationTokenData,
  ExportPasswordResetTokenData,
  ExportTwoFactorTokenData,
  ExportEmailChangeTokenData,
  ExportPhoneChangeTokenData,
  UserWithRelations,
  UserActivity
} from '../../types/user.types';
import { CreateUserInput, CreateUserSchema, UserUpdateSchema } from "../../config/schemas/user.schemas";
import { getAdvancedRequestMetadata, RequestMetadata, createMetadataExtractor } from '@repo/request-metadata';
import { Request as ExpressRequest } from 'express';
import { sendSecurityAlert } from "./security/securityAlert.service";
import { assignDefaultPermissions } from "../../utils/permissions-helper";
import userCacheService from "../../cache/user/user.cache.service";


// Create a configured extractor instance
const metadataExtractor = createMetadataExtractor({
  features: {
    ipDetection: true,
    userAgent: true,
    geolocation: true,
    security: true,
  },
  ipDetection: {
    trustedProxies: [
      '127.0.0.1',
      '::1',
    ],
  },
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
  }
});

export interface GetUserOptions {
  includePassword?: boolean;
  includeSensitive?: boolean;
  includeRelations?: boolean;
  includeMFA?: boolean;
  includeSecurity?: boolean;
  includeDevices?: boolean;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface LoginLimitInput {
  userId: string;
  action: 'increment' | 'reset' | 'check';
  type: 'failed' | 'success';
  ipAddress: string;
}

export interface LoginLimitResult {
  currentCount: number;
  isLocked: boolean;
  unlockedAt?: Date;
  remainingAttempts: number;
  failedLoginAttempts?: number
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
  isLocked?: boolean;
  attemptsRemaining?: number;
  unlockedAt?: Date;
}

export interface UserFilterOptions {
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  isSuspended?: boolean;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  searchTerm?: string;
  minTrustScore?: number;
  verificationLevel?: VerificationLevel;
  maxTrustScore?: number;
  hasProfile?: boolean;
  hasTwoFactorEnabled?: boolean;
  riskLevel?: string;
}

export class UserService {
  /**
   * Normalize Kenyan phone number to international format
   */
  static normalizeKenyanPhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");

    if (cleaned.startsWith("+254")) {
      return cleaned;
    } else if (cleaned.startsWith("254")) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith("0")) {
      return `+254${cleaned.substring(1)}`;
    }

    return cleaned;
  }

  /**
   * Generate secure backup codes for 2FA
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Calculate initial trust score based on provided data
   */
  static calculateInitialTrustScore(data: CreateUserInput): number {
    let score = 0.0;

    // Email verification adds trust
    if (data.email && data.email.includes('@')) {
      const domain = data.email.split('@')[1];
      const trustedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];
      if (trustedDomains.includes(domain)) {
        score += 0.2;
      }
    }

    // Phone verification adds trust (crucial for M-Pesa)
    if (data.phone) {
      score += 0.3;
    }

    // Complete profile adds trust
    if (data.profile?.firstName && data.profile?.lastName) {
      score += 0.2;
    }

    if (data.profile?.dateOfBirth) {
      score += 0.1;
    }

    // Professional roles require verification
    const PROFESSIONAL_ROLES = new Set<UserRole>([
      UserRole.MANAGER,
      UserRole.STAFF,
      UserRole.DELIVERY,
      UserRole.SUPPLIER
    ]);

    if (PROFESSIONAL_ROLES.has(data.role)) {
      if (data.profile?.idDocumentNumber) score += 0.5;
    }

    // Customer role gets small boost for having delivery address
    if (data.role === UserRole.CUSTOMER && data.profile?.addressLine1) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private static generateDeviceToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private static async hashDeviceToken(token: string): Promise<string> {
    return await bcrypt.hash(token, 10);
  }

  private static calculateDeviceTrustScore(
    networkMetadata?: any,
    userAgentMetadata?: any,
    isSuspiciousRegistration?: boolean
  ): number {
    let score = 50;

    if (networkMetadata) {
      if (networkMetadata.threatLevel === 'low') score += 20;
      if (networkMetadata.threatLevel === 'high') score -= 30;
      if (networkMetadata.vpn) score -= 15;
      if (networkMetadata.tor) score -= 25;
    }

    if (userAgentMetadata?.device?.isBot) score -= 40;
    if (isSuspiciousRegistration) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Create a new user with all related data
   */
  static async createUser(data: CreateUserInput) {
    logger.info("=== COMPLETE USER REGISTRATION START ===");

    // Validate input
    const validation = CreateUserSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
    }

    const validatedData = validation.data;
    logger.info("Validation successful", {
      email: validatedData.email,
      role: validatedData.role,
      hasDeviceFingerprint: !!validatedData.deviceFingerprint,
      hasNetworkMetadata: !!validatedData.networkMetadata,
      isSuspiciousRegistration: validatedData.isSuspiciousRegistration
    });

    // Check for existing user
    const existingConditions = [];
    if (validatedData.email) {
      existingConditions.push({ email: validatedData.email });
    }
    if (validatedData.phone) {
      const normalizedPhone = this.normalizeKenyanPhone(validatedData.phone);
      existingConditions.push({ phone: normalizedPhone });
    }

    if (existingConditions.length > 0) {
      const existingUser = await db.user.findFirst({
        where: { OR: existingConditions }
      });

      if (existingUser) {
        throw new Error("User with this email or phone already exists");
      }
    }

    // Check for duplicate ID document number
    if (validatedData.profile?.idDocumentNumber) {
      const existingDoc = await db.profile.findFirst({
        where: {
          idDocumentNumber: validatedData.profile.idDocumentNumber
        }
      });

      if (existingDoc) {
        throw new Error("This ID document number is already registered");
      }
    }

    // Hash password if provided
    let hashedPassword = null;
    if (validatedData.password) {
      logger.info("[-] Hashing password...");
      hashedPassword = await bcrypt.hash(validatedData.password, 12);

      const verification = await bcrypt.compare(validatedData.password, hashedPassword);
      if (!verification) {
        throw new Error("Password hashing error");
      }
    }

    // Generate backup codes for 2FA
    const backupCodes = this.generateBackupCodes();

    // Calculate initial trust score based on advanced metadata
    const trustScore = this.calculateRegistrationTrustScore(validatedData);

    // Calculate profile completion
    const profileCompletion = this.calculateProfileCompletion(validatedData);

    // Extract createdByIp from networkMetadata if not directly provided
    const createdByIp = validatedData.networkMetadata?.ipAddress || validatedData.ipAddress;

    // Build trusted IPs array - include current IP if not suspicious
    const trustedIps: string[] = [];
    if (createdByIp &&
      validatedData.networkMetadata?.threatLevel !== 'high' &&
      validatedData.networkMetadata?.proxyType !== 'vpn') {
      trustedIps.push(createdByIp);
    }

    // Calculate risk level based on metadata
    const calculateRiskLevel = () => {
      if (validatedData.riskLevel) return validatedData.riskLevel;

      const threatScore = this.calculateThreatScore(validatedData.networkMetadata);

      if (threatScore >= 70) return 'HIGH';
      if (threatScore >= 40) return 'MEDIUM';
      return 'LOW';
    };

    const riskLevel = calculateRiskLevel();

    // Determine if registration is suspicious
    const isSuspiciousRegistration = validatedData.isSuspiciousRegistration ||
      riskLevel === 'HIGH' ||
      validatedData.userAgentMetadata?.device?.isBot ||
      validatedData.networkMetadata?.proxyType === 'tor';

    // Determine if verification is required
    const requiresVerification = validatedData.requiresVerification ||
      riskLevel === 'HIGH' ||
      validatedData.networkMetadata?.proxyType === 'vpn' ||
      validatedData.networkMetadata?.threatLevel === 'high';

    // Prepare comprehensive user data for Prisma
    const userData: Prisma.UserCreateInput = {
      // Authentication & Identity
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone ? this.normalizeKenyanPhone(validatedData.phone) : undefined,
      image: validatedData.image,

      // Security
      password: hashedPassword || undefined,
      passwordHashAlgorithm: 'bcrypt',
      passwordHistory: hashedPassword ? [hashedPassword] : [],
      passwordLastChanged: hashedPassword ? new Date() : undefined,
      failedLoginAttempts: 0,
      isLocked: false,

      // Multi-Factor Authentication
      isTwoFactorEnabled: validatedData.isTwoFactorEnabled || false,
      twoFactorMethod: validatedData.twoFactorMethod || TwoFactorMethod.EMAIL,
      twoFactorSecret: validatedData.mfaDevice?.secret,
      backupCodes: backupCodes,

      // Role & Permissions
      role: validatedData.role || UserRole.CUSTOMER,
      isActive: validatedData.isActive ?? true,
      isSuspended: validatedData.isSuspended ?? false,

      // Profile & Preferences
      language: validatedData.language || 'en',
      timezone: validatedData.timezone || 'Africa/Nairobi',
      currency: validatedData.currency || 'KES',

      // Social & Reputation
      trustScore: trustScore,

      // Activity Tracking
      lastActiveAt: new Date(),
      loginCount: 0,
      createdByIp: createdByIp,

      // Trust & Security
      trustedIps: validatedData.trustedIps || trustedIps,
      // If true, set to current date; if false, set to null
      emailVerified: validatedData.emailVerified ? new Date() : null,
      phoneVerified: validatedData.phoneVerified || false,

      // Advanced Metadata Fields
      deviceFingerprint: validatedData.deviceFingerprint as Prisma.InputJsonValue,
      deviceId: validatedData.deviceId,
      networkMetadata: validatedData.networkMetadata as Prisma.InputJsonValue,
      userAgentMetadata: validatedData.userAgentMetadata as Prisma.InputJsonValue,
      securityMetadata: validatedData.securityMetadata as Prisma.InputJsonValue,
      registrationMetadata: validatedData.registrationMetadata as Prisma.InputJsonValue,

      // Risk Assessment
      riskLevel: riskLevel,
      isSuspiciousRegistration: isSuspiciousRegistration,

      // Legal & Compliance
      termsAcceptedAt: validatedData.termsAccepted ? new Date() : null,
      termsVersion: validatedData.termsVersion || '1.0',
      privacyAcceptedAt: validatedData.privacyAccepted ? new Date() : null,
      privacyVersion: validatedData.privacyVersion || '1.0',
      marketingOptIn: validatedData.marketingOptIn ?? false,

      // Metadata
      signupSource: validatedData.signupSource ||
        (validatedData.registrationMetadata?.registrationSource as SignupSource) ||
        SignupSource.WEB,
      referrerId: validatedData.referrerId,

    };

    // Create user with transaction
    logger.info("[-] Creating user with advanced metadata...", {
      email: validatedData.email,
      riskLevel,
      isSuspiciousRegistration,
      requiresVerification
    });

    try {
      const newUser = await db.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: userData,
          include: {
            profile: true,
          }
        });

        logger.info(" User created with advanced metadata", {
          userId: user.id,
          uuid: user.uuid,
          trustScore: user.trustScore,
          riskLevel: user.riskLevel,
          isSuspiciousRegistration: user.isSuspiciousRegistration,
        });

        // Create profile if provided
        if (validatedData.profile) {
          const profileData: Prisma.ProfileCreateInput = {
            user: { connect: { id: user.id } },

            // Personal Information
            firstName: validatedData.profile.firstName,
            lastName: validatedData.profile.lastName,
            displayName: validatedData.profile.displayName,
            dateOfBirth: validatedData.profile.dateOfBirth ? new Date(validatedData.profile.dateOfBirth) : null,
            gender: validatedData.profile.gender,

            // Contact Information
            secondaryEmail: validatedData.profile.secondaryEmail,
            secondaryPhone: validatedData.profile.secondaryPhone,

            // Address (primary delivery address)
            addressLine1: validatedData.profile.addressLine1,
            addressLine2: validatedData.profile.addressLine2,
            city: validatedData.profile.city,
            county: validatedData.profile.county,
            postalCode: validatedData.profile.postalCode,
            country: validatedData.profile.country || 'KE',

            // Identity Verification
            idVerificationStatus: validatedData.profile.idVerificationStatus || VerificationStatus.NOT_VERIFIED,
            idVerifiedAt: validatedData.profile.idVerifiedAt ? new Date(validatedData.profile.idVerifiedAt) : null,
            idVerificationMethod: validatedData.profile.idVerificationMethod,
            idDocumentType: validatedData.profile.idDocumentType,
            idDocumentNumber: validatedData.profile.idDocumentNumber,
            idDocumentExpiry: validatedData.profile.idDocumentExpiry ? new Date(validatedData.profile.idDocumentExpiry) : null,

            // Social
            bio: validatedData.profile.bio,
            profileVisibility: validatedData.profile.profileVisibility || 'PUBLIC',

            // Stats (initial)
            totalOrders: 0,
            totalSpent: 0,

            // Preferences
            notificationPreferences: validatedData.profile.notificationPreferences as Prisma.InputJsonValue,
          };

          await tx.profile.create({
            data: profileData,
          });

          logger.info(" Profile created", { profileCompletion });
        }

        // Handle permissions - Auto-assign role-based permissions if none provided
        if (validatedData.permissions && validatedData.permissions.length > 0) {
          // User provided specific permissions
          const existingPermissions = await tx.permission.findMany({
            where: {
              OR: [
                { id: { in: validatedData.permissions } },
                { name: { in: validatedData.permissions } }
              ]
            }
          });

          if (existingPermissions.length > 0) {
            await tx.user.update({
              where: { id: user.id },
              data: {
                permissions: {
                  connect: existingPermissions.map(p => ({ id: p.id }))
                }
              }
            });
            logger.info(" Custom permissions assigned", { count: existingPermissions.length });
          }
        } else {
          const result = await assignDefaultPermissions(user.id, validatedData.role, tx);

          if (result.assigned > 0) {
            logger.info(" Default role permissions assigned", {
              role: validatedData.role,
              count: result.assigned
            });
          }

          if (result.missing.length > 0) {
            logger.warn("[!] Some default permissions not found in database", {
              role: validatedData.role,
              missing: result.missing
            });
          }
        }

        // Assign welcome badges based on role
        if (validatedData.assignWelcomeBadges !== false) {
          const badgesToAssign: string[] = ['new-member']; // Default welcome badge

          // Role-specific badges
          if (validatedData.role === UserRole.SUPPLIER) {
            badgesToAssign.push('verified-supplier');
          } else if (validatedData.role === UserRole.CUSTOMER) {
            badgesToAssign.push('customer');
          } else if (validatedData.role === UserRole.DELIVERY) {
            badgesToAssign.push('delivery-partner');
          } else if (validatedData.role === UserRole.STAFF) {
            badgesToAssign.push('staff-member');
          } else if (validatedData.role === UserRole.MANAGER) {
            badgesToAssign.push('manager');
          }

          logger.info("🏷️ Attempting to assign badges:", { badgesToAssign });

          const badges = await tx.badge.findMany({
            where: {
              name: { in: badgesToAssign }
            }
          });

          logger.info("🏷️ Found badges:", {
            requested: badgesToAssign.length,
            found: badges.length,
            foundNames: badges.map(b => b.name)
          });

          if (badges.length > 0) {
            await tx.user.update({
              where: { id: user.id },
              data: {
                badges: {
                  connect: badges.map(b => ({ id: b.id }))
                }
              }
            });
            logger.info(" Welcome badges assigned", { count: badges.length });
          } else {
            logger.warn("[!] No badges found in database. Please seed badges first.");
          }
        }

        // Create audit log entry for registration with advanced metadata
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'USER_REGISTERED',
            entityType: 'USER',
            entityId: user.id,
            ipAddress: createdByIp,
            userAgent: validatedData.userAgentMetadata?.raw,
            changes: {
              role: user.role,
              email: user.email,
              phone: user.phone,
              signupSource: user.signupSource,
              termsVersion: user.termsVersion,
              privacyVersion: user.privacyVersion,
              mfaEnabled: user.isTwoFactorEnabled,
              trustedIps: user.trustedIps,
              createdByIp: user.createdByIp,
              trustScore: user.trustScore,
              riskLevel: user.riskLevel,
              isSuspiciousRegistration: user.isSuspiciousRegistration,
              deviceId: user.deviceId,
            } as Prisma.InputJsonValue,
            metadata: {
              profileCreated: !!validatedData.profile,
              referrerId: validatedData.referrerId,
              deviceFingerprint: validatedData.deviceFingerprint ? 'stored' : 'none',
              networkMetadata: validatedData.networkMetadata,
              securityMetadata: validatedData.securityMetadata,
              registrationMetadata: validatedData.registrationMetadata,
              userAgentMetadata: validatedData.userAgentMetadata,
              threatLevel: validatedData.networkMetadata?.threatLevel,
              proxyType: validatedData.networkMetadata?.proxyType,
              vpnDetected: validatedData.networkMetadata?.vpn,
              isBot: validatedData.userAgentMetadata?.device?.isBot,
              calculatedRiskLevel: riskLevel,
              registrationRiskScore: this.calculateThreatScore(validatedData.networkMetadata),
            } as Prisma.InputJsonValue
          },
        });

        logger.info(" Registration audit log created with advanced metadata");

        return user;
      });

      // Invalidate user list caches (since new user was added)
      await userCacheService.invalidateUserLists();

      // Cache the new user
      const safeUser = await this.getSafeUserById(newUser.id, {
        includeDeviceId: true,
        includeProfile: true,
      });

      // Cache email and phone mappings
      if (newUser.email) {
        await userCacheService.setUserByEmail(newUser.email, newUser.id);
      }
      if (newUser.phone) {
        await userCacheService.setUserByPhone(newUser.phone, newUser.id);
      }

      logger.info("User registration completed successfully:", {
        id: newUser.id,
        uuid: newUser.uuid,
        role: newUser.role,
        trustScore: newUser.trustScore,
        riskLevel: newUser.riskLevel,
        isSuspiciousRegistration: newUser.isSuspiciousRegistration,
        deviceId: newUser.deviceId
      });
      logger.info("=== COMPLETE USER REGISTRATION END ===");

      return safeUser;

    } catch (error: any) {
      logger.error("Registration transaction failed:", error);

      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        throw new Error(`A user with this ${field} already exists`);
      }

      if (error.code === 'P2003') {
        throw new Error(`Foreign key constraint failed: ${error.meta?.field_name}`);
      }

      throw error;
    }
  }

  // Helper methods
  private static calculateThreatScore(networkMetadata?: any): number {
    if (!networkMetadata) return 0;

    let score = 0;
    if (networkMetadata.vpn) score += 30;
    if (networkMetadata.proxyType === 'tor') score += 50;
    if (networkMetadata.proxyType === 'proxy') score += 20;
    if (networkMetadata.proxyType === 'vpn') score += 30;
    if (networkMetadata.threatLevel === 'high') score += 60;
    if (networkMetadata.threatLevel === 'medium') score += 30;

    return Math.min(score, 100);
  }

  private static extractDeviceName(deviceFingerprint: any): string {
    const parts = [];
    if (deviceFingerprint.os?.name) parts.push(deviceFingerprint.os.name);
    if (deviceFingerprint.deviceType) parts.push(deviceFingerprint.deviceType);
    if (deviceFingerprint.browser?.name) parts.push(deviceFingerprint.browser.name);

    return parts.length > 0 ? parts.join(' - ') : 'Registration Device';
  }

  // Helper method for profile completion calculation
  private static calculateProfileCompletion(data: CreateUserInput): number {
    let completion = 0;

    // Basic fields (30 points total)
    if (data.name) completion += 10;
    if (data.email) completion += 10;
    if (data.phone) completion += 10;

    // Profile fields (70 points total)
    if (data.profile) {
      if (data.profile.firstName && data.profile.lastName) completion += 15;
      if (data.profile.dateOfBirth) completion += 10;
      if (data.profile.bio) completion += 10;
      if (data.profile.addressLine1) completion += 15;
      if (data.profile.city) completion += 10;
      if (data.image) completion += 5;

      // Role-specific completeness
      if (data.role === UserRole.SUPPLIER || data.role === UserRole.MANAGER) {
        if (data.profile.idDocumentNumber) completion += 25;
      }

      if (data.role === UserRole.DELIVERY) {
        if (data.profile.idDocumentNumber) completion += 20;
      }
    }

    return Math.min(100, completion);
  }

  // Helper method for trust score calculation
  private static calculateRegistrationTrustScore(data: CreateUserInput): number {
    let score = 50; // Base score

    // Positive factors
    if (data.email && data.email.includes('@')) score += 10;
    if (data.phone && this.normalizeKenyanPhone(data.phone)) score += 10;
    if (data.name && data.name.trim().length > 2) score += 5;

    // Metadata-based scoring
    if (data.networkMetadata) {
      // Good network indicators
      if (data.networkMetadata.country === 'KE') score += 5;
      if (data.networkMetadata.proxyType === 'none') score += 10;
      if (data.networkMetadata.threatLevel === 'low') score += 15;

      // Negative network indicators
      if (data.networkMetadata.threatLevel === 'high') score -= 30;
      if (data.networkMetadata.proxyType === 'vpn') score -= 20;
      if (data.networkMetadata.proxyType === 'tor') score -= 40;
    }

    // Device/browser trust
    if (data.userAgentMetadata) {
      if (!data.userAgentMetadata.device?.isBot) score += 10;
      if (data.userAgentMetadata.browser?.name?.toLowerCase().includes('chrome')) score += 5;
      // if (data.userAgentMetadata.capabilities?.supportsWebGL) score += 5;
    }

    // Profile completeness
    if (data.profile) {
      if (data.profile.firstName && data.profile.lastName) score += 10;
      if (data.profile.dateOfBirth) score += 5;
      if (data.profile.idDocumentNumber) score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get user by ID with safe data (excluding sensitive fields)
   */
  static async getSafeUserById(userId: string, options?: {
    includeDeviceId?: boolean;
    includeProfile?: boolean;
  }) {
    // Try to get from cache
    const cachedUser = await userCacheService.getUser(userId);
    if (cachedUser) {
      logger.debug('User cache hit', { userId });
      return cachedUser;
    }

    logger.debug('User cache miss, fetching from DB', { userId });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uuid: true,
        name: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        phoneVerifiedAt: true,
        image: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        isSuspended: true,
        suspendedUntil: true,
        suspensionReason: true,
        isTwoFactorEnabled: true,
        twoFactorMethod: true,
        twoFactorConfirmedAt: true,
        language: true,
        timezone: true,
        dateFormat: true,
        currency: true,
        reputation: true,
        reputationScore: true,
        trustScore: true,
        isVerified: true,
        verificationLevel: true,
        lastLoginAt: true,
        lastActiveAt: true,
        loginCount: true,
        riskLevel: true,
        requiresVerification: true,
        createdAt: true,
        updatedAt: true,
        createdByIp: true,

        // Conditionally include deviceId if requested
        ...(options?.includeDeviceId && { deviceId: true }),

        // Include relations if requested
        ...(options?.includeProfile && {
          profile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              county: true,
              postalCode: true,
              country: true,
              idVerificationStatus: true,
              idDocumentType: true,
              idDocumentNumber: true,
            }
          }
        }),
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Cache the user
    await userCacheService.setUser(userId, user);

    // Cache email mapping if email exists
    if (user.email) {
      await userCacheService.setUserByEmail(user.email, userId);
    }

    // Cache phone mapping if phone exists
    if (user.phone) {
      await userCacheService.setUserByPhone(user.phone, userId);
    }

    return user;
  }

  /**
   * Get users with advanced filtering and pagination
   */
  static async getUsers(
    filters: UserFilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 10 },
    includeRelations: boolean = false
  ): Promise<PaginatedResponse<any>> {
    // Try to get from cache (only for non-relation queries)
    if (!includeRelations) {
      const cachedResult = await userCacheService.getUserList(filters, pagination);
      if (cachedResult) {
        logger.debug('User list cache hit', { filters, pagination });
        return cachedResult;
      }
    }

    logger.debug('User list cache miss, fetching from DB', { filters, pagination });

    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const pageSize = Math.min(limit, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.isVerified !== undefined) {
      where.emailVerified = filters.isVerified
        ? { not: null }
        : null
    }

    if (filters.isSuspended !== undefined) {
      where.isSuspended = filters.isSuspended;
    }

    if (filters.minTrustScore !== undefined) {
      where.trustScore = { gte: filters.minTrustScore };
    }

    if (filters.maxTrustScore !== undefined) {
      where.trustScore = { ...where.trustScore, lte: filters.maxTrustScore };
    }

    if (filters.riskLevel) {
      where.riskLevel = filters.riskLevel;
    }

    if (filters.hasTwoFactorEnabled !== undefined) {
      where.isTwoFactorEnabled = filters.hasTwoFactorEnabled;
    }

    if (filters.createdAtFrom || filters.createdAtTo) {
      where.createdAt = {};
      if (filters.createdAtFrom) {
        where.createdAt.gte = filters.createdAtFrom;
      }
      if (filters.createdAtTo) {
        where.createdAt.lte = filters.createdAtTo;
      }
    }

    if (filters.hasProfile !== undefined) {
      if (filters.hasProfile) {
        where.profile = { isNot: null };
      } else {
        where.profile = null;
      }
    }

    if (filters.searchTerm) {
      where.OR = [
        { name: { contains: filters.searchTerm, mode: 'insensitive' } },
        { email: { contains: filters.searchTerm, mode: 'insensitive' } },
        { phone: { contains: filters.searchTerm, mode: 'insensitive' } },
        {
          profile: {
            OR: [
              { firstName: { contains: filters.searchTerm, mode: 'insensitive' } },
              { lastName: { contains: filters.searchTerm, mode: 'insensitive' } },
              { displayName: { contains: filters.searchTerm, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    // Base select
    const baseSelect = {
      id: true,
      uuid: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
      phoneVerifiedAt: true,
      image: true,
      role: true,
      isActive: true,
      isSuspended: true,
      suspendedUntil: true,
      suspensionReason: true,
      isTwoFactorEnabled: true,
      twoFactorMethod: true,
      language: true,
      timezone: true,
      currency: true,
      trustScore: true,
      lastLoginAt: true,
      lastActiveAt: true,
      loginCount: true,
      riskLevel: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      marketingOptIn: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      signupSource: true,
      referrerId: true,
    };

    // Add relations if requested
    const select = includeRelations ? {
      ...baseSelect,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          dateOfBirth: true,
          gender: true,
          addressLine1: true,
          city: true,
          county: true,
          country: true,
          idVerificationStatus: true,
          idDocumentType: true,
          idDocumentNumber: true,
          bio: true,
          profileVisibility: true,
          totalOrders: true,
          totalSpent: true,
        }
      },
      permissions: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
        }
      },
      accounts: {
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          type: true,
        }
      },
      mfaDevices: {
        select: {
          id: true,
          name: true,
          type: true,
          isPrimary: true,
          isVerified: true,
          lastUsedAt: true,
        }
      },
      trustedDevices: {
        select: {
          id: true,
          deviceName: true,
          deviceType: true,
          lastSeen: true,
        }
      },
      badges: {
        select: {
          id: true,
          name: true,
          icon: true,
          category: true,
        }
      },
      _count: {
        select: {
          orders: true,
          favourites: true,
          reviews: true,
          comments: true,
          notifications: true,
        }
      }
    } : baseSelect;

    try {
      const [users, totalUsers] = await Promise.all([
        db.user.findMany({
          where,
          select,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
        }),
        db.user.count({ where }),
      ]);

      const totalPages = Math.ceil(totalUsers / pageSize);
      const result = {
        data: users,
        pagination: {
          total: totalUsers,
          page,
          limit: pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      // Cache the result (only for non-relation queries)
      if (!includeRelations) {
        await userCacheService.setUserList(filters, pagination, result);
      }

      return result;
    } catch (error) {
      logger.error("Error fetching users:", { error });
      throw new Error("Failed to fetch users");
    }
  }

  /**
   * Get user by ID with all relations
   */
  // user.service.ts

  static async getUserById(
    id: string,
    includePassword: boolean = false,
    includeSensitive: boolean = false,
    role?: string   // ← new optional param
  ): Promise<UserWithRelations> {

    if (!includePassword && !includeSensitive) {
      const cachedUser = await userCacheService.getUser(id)
      if (cachedUser) return cachedUser as UserWithRelations
    }

    const select: any = {
      // ... all your existing base fields unchanged ...
      id: true,
      uuid: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
      phoneVerifiedAt: true,
      image: true,
      role: true,
      isActive: true,
      isSuspended: true,
      suspendedUntil: true,
      suspensionReason: true,
      isTwoFactorEnabled: true,
      twoFactorMethod: true,
      language: true,
      timezone: true,
      currency: true,
      trustScore: true,
      lastLoginAt: true,
      lastActiveAt: true,
      loginCount: true,
      currentLoginIp: true,
      termsAcceptedAt: true,
      termsVersion: true,
      privacyAcceptedAt: true,
      privacyVersion: true,
      marketingOptIn: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      signupSource: true,
      referrerId: true,

      // ── Always included relations ──────────────────────────────────────
      profile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          dateOfBirth: true,
          gender: true,
          secondaryEmail: true,
          secondaryPhone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          county: true,
          postalCode: true,
          country: true,
          idVerificationStatus: true,
          idVerifiedAt: true,
          idVerificationMethod: true,
          idDocumentType: true,
          idDocumentNumber: true,
          idDocumentExpiry: true,
          bio: true,
          profileVisibility: true,
          totalOrders: true,
          totalSpent: true,
          notificationPreferences: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          deliveryAddresses: {
            select: {
              id: true,
              label: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              county: true,
              postalCode: true,
              country: true,
              isDefault: true,
              instructions: true,
            }
          }
        }
      },
      permissions: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          createdAt: true,
          updatedAt: true,
        }
      },
      accounts: {
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          type: true,
          expires_at: true,
          scope: true,
        }
      },
      mfaDevices: {
        select: {
          id: true,
          name: true,
          type: true,
          lastUsedAt: true,
          isPrimary: true,
          isVerified: true,
          createdAt: true,
        }
      },
      trustedDevices: {
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          deviceType: true,
          os: true,
          browser: true,
          lastSeen: true,
          ipAddress: true,
          verified: true,
          createdAt: true,
          expiresAt: true,
        }
      },
      securityQuestions: {
        select: {
          id: true,
          question: true,
          order: true,
          createdAt: true,
        }
      },
      badges: {
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          category: true,
          createdAt: true,
        }
      },
      notifications: {
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          isRead: true,
          createdAt: true,
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: {
          orders: true,
          favourites: true,
          reviews: true,
          comments: true,
          notifications: true,
          verificationTokens: true,
          passwordResetTokens: true,
          twoFactorTokens: true,
          emailChangeTokens: true,
          phoneChangeTokens: true,
          accounts: true,
          sessions: true,
          trustedDevices: true,
          securityQuestions: true,
          mfaDevices: true,
          badges: true,
        }
      },
    }

    // ── Role-specific relations ────────────────────────────────────────────────

    const effectiveRole = role ?? (
      // If no role hint passed, fetch the user's role first from a lightweight query
      // to decide which relations to load. We do a tiny pre-query.
      (await db.user.findUnique({ where: { id }, select: { role: true } }))?.role
    )

    // ── CUSTOMER ──────────────────────────────────────────────────────────────
    if (['CUSTOMER', 'VIEWER'].includes(effectiveRole ?? '')) {
      select.orders = {
        select: {
          id: true,
          number: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              totalPrice: true,
            },
            take: 3,
          }
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }
      select.cart = {
        select: {
          id: true,
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              product: {
                select: { id: true, featuredImage: true }
              }
            }
          }
        }
      }
      select.favourites = {
        select: {
          id: true,
          createdAt: true,
          product: {
            select: { id: true, featuredImage: true, basePrice: true }
          }
        }
      }
      select.reviews = {
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          status: true,
          createdAt: true,
          product: { select: { id: true } }
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }
      select.comments = {
        select: {
          id: true,
          body: true,
          status: true,
          createdAt: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }
    }

    // ── SUPPLIER ──────────────────────────────────────────────────────────────
    if (['SUPPLIER'].includes(effectiveRole ?? '')) {
      select.supplier = {
        select: {
          id: true,
          companyName: true,
          contactPerson: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          county: true,
          country: true,
          taxPin: true,
          status: true,
          isVerified: true,
          verifiedAt: true,
          rating: true,
          leadTimeDays: true,
          paymentTerms: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          products: {
            select: {
              id: true,
              supplierSku: true,
              unitCost: true,
              minOrderQty: true,
              isPreferred: true,
              product: {
                select: {
                  id: true,
                  sku: true,
                  category: { select: { name: true } },
                  basePrice: true,
                  status: true,
                }
              }
            },
            take: 20,
          },
          purchaseOrders: {
            select: {
              id: true,
              reference: true,
              status: true,
              totalAmount: true,
              currency: true,
              expectedAt: true,
              createdAt: true,
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
          }
        }
      }
    }

    // ── DELIVERY ──────────────────────────────────────────────────────────────
    if (['DELIVERY'].includes(effectiveRole ?? '')) {
      select.driverDeliveries = {
        select: {
          id: true,
          status: true,
          trackingCode: true,
          assignedAt: true,
          pickedUpAt: true,
          deliveredAt: true,
          failedAt: true,
          failReason: true,
          estimatedDistance: true,
          estimatedDuration: true,
          customerRating: true,
          customerFeedback: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              number: true,
              totalAmount: true,
              currency: true,
              deliveryAddress: {
                select: {
                  addressLine1: true,
                  city: true,
                  county: true,
                  instructions: true,
                }
              }
            }
          },
          branch: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
            }
          }
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }
    }

    // ── STAFF / MANAGER / ADMIN / SUPER_ADMIN ─────────────────────────────────
    if (['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(effectiveRole ?? '')) {
      select.auditLogs = {
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          changes: true,
          ipAddress: true,
          createdAt: true,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }
      // Staff/managers also see their assigned orders
      select.orders = {
        select: {
          id: true,
          number: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              totalPrice: true,
            },
            take: 3,
          }
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }
    }

    // ── Sensitive fields ──────────────────────────────────────────────────────
    if (includePassword) {
      select.password = true
      select.passwordHashAlgorithm = true
      select.passwordLastChanged = true
    }

    if (includeSensitive) {
      select.twoFactorSecret = true
      select.backupCodes = true
      select.failedLoginAttempts = true
      select.lastFailedLoginAt = true
      select.lockedAt = true
      select.lockReason = true
      select.createdByIp = true
      select.trustedIps = true
    }

    const user = await db.user.findUnique({ where: { id }, select })

    if (!user) throw new Error("User not found")

    if (!includePassword && !includeSensitive) {
      await userCacheService.setUser(id, user)
    }

    return user as unknown as UserWithRelations
  }
  /**
   * Get user by email
   */
  static async getUserByEmail(email: string, options: GetUserOptions = {}) {
    const {
      includePassword = false,
      includeSensitive = false,
      includeRelations = false,
      includeMFA = false,
      includeSecurity = false,
      includeDevices = false
    } = options;

    // Try to get from cache (only for non-sensitive queries)
    if (!includePassword && !includeSensitive && !includeRelations && !includeMFA && !includeSecurity && !includeDevices) {
      const cachedUserId = await userCacheService.getUserByEmail(email);
      if (cachedUserId) {
        const cachedUser = await userCacheService.getUser(cachedUserId);
        if (cachedUser) {
          logger.debug('User by email cache hit', { email });
          return cachedUser;
        }
      }
    }

    logger.debug('User by email cache miss, fetching from DB', { email });

    const select: Prisma.UserSelect = {
      id: true,
      uuid: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
      phoneVerifiedAt: true,
      image: true,
      role: true,
      isActive: true,
      isSuspended: true,
      suspendedUntil: true,
      suspensionReason: true,
      isTwoFactorEnabled: true,
      twoFactorMethod: true,
      language: true,
      timezone: true,
      currency: true,
      trustScore: true,
      lastLoginAt: true,
      lastLoginIp: true,
      lastActiveAt: true,
      loginCount: true,

      createdAt: true,
      updatedAt: true,
      failedLoginAttempts: true,
      lastFailedLoginAt: true,
      lockedAt: true,
      lockReason: true,
      passwordLastChanged: true
    };

    if (includePassword) {
      select.password = true;
      select.passwordHashAlgorithm = true;
      select.backupCodes = true;
    }

    if (includeSensitive) {
      select.twoFactorSecret = true;
      select.createdByIp = true;
      select.trustedIps = true;
    }

    if (includeRelations) {
      select.profile = {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          addressLine1: true,
          city: true,
          county: true,
          country: true,
        }
      };
      select.roleModel = true;
    }

    if (includeMFA) {
      select.mfaDevices = {
        select: {
          id: true,
          type: true,
          name: true,
          isVerified: true,
          lastUsedAt: true,
          createdAt: true
        }
      };
      select.twoFactorConfirmation = true;
    }

    if (includeSecurity) {
      select.trustedDevices = {
        take: 5,
        orderBy: { lastSeen: 'desc' },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          deviceType: true,
          os: true,
          browser: true,
          verified: true,
          lastSeen: true,
          createdAt: true
        }
      };
      select.auditLogs = {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          createdAt: true
        }
      };
      select.sessions = {
        where: {
          isActive: true,
          expires: { gt: new Date() }
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          sessionToken: true,
          expires: true,
          ipAddress: true,
          userAgent: true,
          lastUsedAt: true,
          createdAt: true
        }
      };
    }

    if (includeDevices) {
      select.trustedDevices = {
        take: 10,
        orderBy: { lastSeen: 'desc' },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          deviceType: true,
          os: true,
          browser: true,
          verified: true,
          lastSeen: true,
          createdAt: true
        }
      };
    }

    const user = await db.user.findUnique({
      where: { email },
      select
    });

    if (!user) {
      throw new Error("User not found");
    }

    let safeUser = { ...user } as any;

    if (!includePassword) {
      delete safeUser.password;
      delete safeUser.passwordHashAlgorithm;
    }

    if (!includeSensitive) {
      delete safeUser.twoFactorSecret;
      delete safeUser.createdByIp;
      delete safeUser.trustedIps;
    }

    // Cache the user (only for non-sensitive queries)
    if (!includePassword && !includeSensitive && !includeRelations && !includeMFA && !includeSecurity && !includeDevices) {
      await userCacheService.setUser(user.id, safeUser);
      await userCacheService.setUserByEmail(email, user.id);
      if (user.phone) {
        await userCacheService.setUserByPhone(user.phone, user.id);
      }
    }

    return safeUser;
  }

  /**
   * Update user with all related data
   */
  static async updateUser(id: string, data: Partial<z.infer<typeof UserUpdateSchema>>) {
    // Check if user exists
    const user = await db.user.findUnique({
      where: { id },
      include: {
        profile: true,
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Prepare update data
    const userUpdateData: any = {};
    const profileUpdateData: any = {};

    // Separate fields by entity
    Object.keys(data).forEach(key => {
      const value = data[key as keyof typeof data];
      if (value === undefined) return;

      // User table fields
      const userFields = [
        'name', 'phone', 'image', 'password',
        'isTwoFactorEnabled', 'twoFactorMethod', 'twoFactorSecret', 'backupCodes',
        'role', 'isActive', 'isSuspended', 'suspendedUntil', 'suspensionReason',
        'preferences', 'language', 'timezone', 'currency',
        'trustScore', 'lastActiveAt',
        'termsAcceptedAt', 'termsVersion',
        'privacyAcceptedAt', 'privacyVersion', 'marketingOptIn',
        'trustedIps'
      ];

      // Profile table fields
      const profileFields = [
        'firstName', 'lastName', 'displayName', 'dateOfBirth', 'gender',
        'secondaryEmail', 'secondaryPhone',
        'addressLine1', 'addressLine2', 'city', 'county', 'postalCode', 'country',
        'idVerificationStatus', 'idVerifiedAt', 'idVerificationMethod',
        'idDocumentType', 'idDocumentNumber', 'idDocumentExpiry',
        'bio', 'profileVisibility',
        'notificationPreferences'
      ];

      if (userFields.includes(key)) {
        // Handle special cases
        if (key === 'password' && data.password) {
          userUpdateData.password = data.password;
          userUpdateData.passwordLastChanged = new Date();
        } else if (key.includes('At') && value) {
          userUpdateData[key] = new Date(value as string);
        } else if (key !== 'password') {
          userUpdateData[key] = value;
        }
      } else if (profileFields.includes(key)) {
        if ((key.includes('Date') || key.includes('At') || key.includes('Expiry')) && value) {
          profileUpdateData[key] = new Date(value as string);
        } else {
          profileUpdateData[key] = value;
        }
      }
    });

    // Update user and related data in transaction
    try {
      const updatedUser = await db.$transaction(async (tx) => {
        // Update user
        await tx.user.update({
          where: { id },
          data: userUpdateData,
        });

        // Update profile if there are profile updates
        if (Object.keys(profileUpdateData).length > 0) {
          if (user.profile) {
            await tx.profile.update({
              where: { userId: id },
              data: profileUpdateData
            });
          } else {
            await tx.profile.create({
              data: {
                ...profileUpdateData,
                userId: id,
              }
            });
          }
        }

        return await this.getUserById(id);
      });

      // Invalidate all user caches
      await userCacheService.invalidateUser(id, user.email || undefined, user.phone || undefined, user.uuid);

      // If email changed, invalidate old email mapping
      if (data.email && data.email !== user.email) {
        await userCacheService.invalidateUser(id, user.email || undefined);
      }

      // If phone changed, invalidate old phone mapping
      if (data.phone && data.phone !== user.phone) {
        await userCacheService.invalidateUser(id, undefined, user.phone || undefined);
      }

      return updatedUser;
    } catch (error: any) {
      logger.error("Update transaction failed:", error);

      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        throw new Error(`A user with this ${field} already exists`);
      }

      if (error.code === 'P2003') {
        throw new Error(`Foreign key constraint failed: ${error.meta?.field_name}`);
      }

      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(id: string, permanent: boolean = false) {
    const user = await db.user.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (permanent) {
      // Permanent delete (use with caution)
      await db.user.delete({ where: { id } });
    } else {
      // Soft delete with transaction
      await db.$transaction(async (tx) => {
        // Soft delete user
        await tx.user.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            isActive: false,
            email: user.email ? `${user.email}.deleted.${Date.now()}` : null,
            phone: user.phone ? `${user.phone}.deleted.${Date.now()}` : null,
            isSuspended: true,
            suspensionReason: 'Account deleted',
          }
        });

        // Soft delete profile if exists
        if (user.profile) {
          await tx.profile.update({
            where: { userId: id },
            data: {
              deletedAt: new Date(),
            }
          });
        }

        // Deactivate sessions
        await tx.session.updateMany({
          where: { userId: id },
          data: { isActive: false }
        });

        // Deactivate MFA devices
        await tx.mFADevice.updateMany({
          where: { userId: id },
          data: { isVerified: false }
        });

        // Remove trusted devices
        await tx.trustedDevice.deleteMany({
          where: { userId: id }
        });
      });
    }

    // Invalidate all user caches
    await userCacheService.invalidateUser(id, user.email || undefined, user.phone || undefined, user.uuid);

    // Invalidate user list caches
    await userCacheService.invalidateUserLists();

    return {
      id,
      permanent,
      deletedAt: new Date(),
      message: permanent ? "User permanently deleted" : "User soft deleted successfully"
    };
  }

  /**
   * Update user password with security checks
   */
  static async updateUserPassword(userId: string, newPassword: string, currentPassword?: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        passwordLastChanged: true,
        failedLoginAttempts: true,
        lockedAt: true
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if account is locked
    if (user.lockedAt) {
      throw new Error("Account is locked. Please contact support.");
    }

    // Verify current password if provided
    if (currentPassword && user.password) {
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        // Increment failed login attempts
        await db.user.update({
          where: { id: userId },
          data: {
            failedLoginAttempts: { increment: 1 },
            lastFailedLoginAt: new Date()
          }
        });

        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts + 1 >= 5) {
          await db.user.update({
            where: { id: userId },
            data: {
              lockedAt: new Date(),
              lockReason: 'Too many failed password attempts'
            }
          });
          throw new Error("Account locked due to too many failed attempts. Please contact support.");
        }

        throw new Error("Current password is incorrect");
      }
    }

    // Check password strength
    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Check for common passwords
    const commonPasswords = ['password', '12345678', 'qwerty123'];
    if (commonPasswords.includes(newPassword.toLowerCase())) {
      throw new Error("Password is too common. Please choose a stronger password.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const passwordLastChanged = new Date();

    await db.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordLastChanged,
        failedLoginAttempts: 0,
        lockedAt: null,
        lockReason: null,
      }
    });

    // Log password change event
    await db.auditLog.create({
      data: {
        userId: userId,
        action: 'PASSWORD_CHANGED',
        entityType: 'USER',
        entityId: userId,
        ipAddress: null,
        userAgent: null,
      }
    });

    // Invalidate security cache
    await userCacheService.invalidateSecurityCache(userId);

    // Invalidate user cache
    await userCacheService.invalidateUser(userId);

    return {
      success: true,
      passwordLastChanged,
      message: "Password updated successfully"
    };
  }

  /**
   * Increment failed login attempts
   */
  static async incrementFailedAttempts(userId: string, ipAddress?: string): Promise<LoginLimitResult> {
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: { increment: 1 },
        lastFailedLoginAt: new Date(),
        lastFailedLoginIp: ipAddress
      }
    });

    const MAX_FAILED_ATTEMPTS = 5;
    let isLocked = false;
    let unlockedAt = user.unlockedAt || undefined;

    // Auto-lock after 5 failed attempts
    if (updatedUser.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      // Set lock for 15 minutes
      const lockDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
      unlockedAt = new Date(Date.now() + lockDuration);

      await db.user.update({
        where: { id: userId },
        data: {
          unlockedAt,
          lockReason: 'Too many failed login attempts'
        }
      });

      isLocked = true;
    }

    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - updatedUser.failedLoginAttempts);
    const result = {
      currentCount: updatedUser.failedLoginAttempts,
      isLocked,
      unlockedAt,
      remainingAttempts
    };

    // Cache the login limit status
    await userCacheService.setLoginLimitStatus(userId, result);

    return result;
  }

  static async manageLoginLimits(data: LoginLimitInput): Promise<LoginLimitResult> {
    try {
      const { userId, action, type, ipAddress } = data;

      const user = await db.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      switch (action) {
        case 'increment':
          if (type === 'failed') {
            return await this.incrementFailedAttempts(userId, ipAddress);
          } else {
            throw new Error('Increment action only supports type: "failed"');
          }
        case 'reset':
          return await this.resetFailedAttempts(userId);
        case 'check':
          return await this.getLoginLimitStatus(userId);
        default:
          throw new Error('Invalid action specified');
      }
    } catch (error) {
      logger.error('Error in manageLoginLimits:', { error });
      throw error;
    }
  }

  /**
   * Get current login limit status
   */
  static async getLoginLimitStatus(userId: string): Promise<LoginLimitResult> {
    // Try to get from cache
    const cachedStatus = await userCacheService.getLoginLimitStatus(userId);
    if (cachedStatus) {
      logger.debug('Login limit status cache hit', { userId });
      return cachedStatus;
    }

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    let isLocked = false;
    let lockUntil = user.unlockedAt || undefined;

    if (user.unlockedAt && user.unlockedAt > now) {
      isLocked = true;
    } else if (user.lockedAt) {
      isLocked = true;
    }

    const MAX_FAILED_ATTEMPTS = 5;
    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - user.failedLoginAttempts);

    const result = {
      currentCount: user.failedLoginAttempts,
      isLocked,
      unlockedAt: user.unlockedAt || undefined,
      remainingAttempts
    };

    // Cache the result
    await userCacheService.setLoginLimitStatus(userId, result);

    return result;
  }

  /**
   * Reset failed login attempts
   */
  static async resetFailedAttempts(userId: string): Promise<LoginLimitResult> {
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    await db.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        unlockedAt: null,
        lockReason: null
      }
    });

    const result = {
      currentCount: 0,
      isLocked: false,
      unlockedAt: undefined,
      remainingAttempts: 5
    };

    // Update cache
    await userCacheService.setLoginLimitStatus(userId, result);
    await userCacheService.invalidateSecurityCache(userId);

    return result;
  }

  /**
   * Lock user account
   */
  static async lockAccount(userId: string, reason: string) {
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        lockedAt: new Date(),
        lockReason: reason,
        unlockedAt: lockUntil,
        isActive: false
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: userId,
        action: 'ACCOUNT_LOCKED',
        entityType: 'USER',
        entityId: userId,
        changes: {
          lockedAt: updatedUser.lockedAt,
          lockReason: updatedUser.lockReason,
          unlockedAt: updatedUser.unlockedAt,
          isActive: updatedUser.isActive
        },
        metadata: {
          lockDuration: '15 minutes',
          reason: reason
        }
      }
    });

    // Invalidate caches
    await userCacheService.invalidateUser(userId, user.email || undefined, user.phone || undefined, user.uuid);
    await userCacheService.invalidateSecurityCache(userId);

    return {
      lockedAt: updatedUser.lockedAt,
      lockReason: updatedUser.lockReason,
      unlockedAt: updatedUser.unlockedAt,
      isLocked: true
    };
  }

  /**
   * Unlock user account immediately
   */
  static async unlockAccount(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        lockedAt: null,
        lockReason: null,
        unlockedAt: null,
        failedLoginAttempts: 0,
        isActive: true
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: userId,
        action: 'ACCOUNT_UNLOCKED',
        entityType: 'USER',
        entityId: userId,
        changes: {
          lockedAt: null,
          lockReason: null,
          unlockedAt: null,
          isActive: updatedUser.isActive
        },
        metadata: {
          failedAttemptsReset: true
        }
      }
    });

    // Invalidate caches
    await userCacheService.invalidateUser(userId, user.email || undefined, user.phone || undefined, user.uuid);
    await userCacheService.invalidateSecurityCache(userId);

    return {
      lockedAt: updatedUser.lockedAt,
      isLocked: false,
      isActive: updatedUser.isActive
    };
  }

  /**
   * Check account lock status
   */
  static async checkAccountLock(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        lockedAt: true,
        unlockedAt: true,
        lockReason: true,
        failedLoginAttempts: true
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.lockedAt) {
      return {
        isLocked: false,
        remainingTime: 0,
        lockReason: null,
        failedLoginAttempts: user.failedLoginAttempts
      };
    }

    if (user.unlockedAt && new Date() > user.unlockedAt) {
      await this.unlockAccount(userId);
      return {
        isLocked: false,
        remainingTime: 0,
        lockReason: null,
        failedLoginAttempts: 0
      };
    }

    const remainingTime = user.unlockedAt
      ? Math.max(0, user.unlockedAt.getTime() - Date.now())
      : 0;

    return {
      isLocked: true,
      remainingTime,
      lockReason: user.lockReason,
      failedLoginAttempts: user.failedLoginAttempts,
      unlockedAt: user.unlockedAt
    };
  }

  /**
   * Get comprehensive account security status
   */
  static async getAccountSecurityStatus(userId: string) {
    // Try to get from cache
    const cachedStatus = await userCacheService.getSecurityStatus(userId);
    if (cachedStatus) {
      logger.debug('Security status cache hit', { userId });
      return cachedStatus;
    }

    logger.debug('Security status cache miss, fetching from DB', { userId });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lockedAt: true,
        unlockedAt: true,
        lockReason: true,
        failedLoginAttempts: true,
        lastFailedLoginAt: true,
        lastFailedLoginIp: true,
        isTwoFactorEnabled: true,
        twoFactorMethod: true,
        passwordLastChanged: true,
        lastLoginAt: true,
        currentLoginIp: true,
        trustedIps: true,
        mfaDevices: {
          select: {
            id: true,
            name: true,
            type: true,
            isPrimary: true,
            isVerified: true,
            lastUsedAt: true
          }
        },
        trustedDevices: {
          select: {
            id: true,
            deviceName: true,
            deviceType: true,
            lastSeen: true,
            ipAddress: true
          }
        },
        sessions: {
          where: { isActive: true },
          select: {
            id: true,
            lastUsedAt: true,
            ipAddress: true,
            userAgent: true
          },
          take: 5,
          orderBy: { lastUsedAt: 'desc' }
        }
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Calculate password age
    const passwordAgeDays = user.passwordLastChanged
      ? Math.floor((Date.now() - user.passwordLastChanged.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let isLocked = !!user.lockedAt;
    let remainingTime = 0;

    if (user.lockedAt && user.unlockedAt) {
      if (new Date() > user.unlockedAt) {
        await this.unlockAccount(userId);
        isLocked = false;
      } else {
        remainingTime = Math.max(0, user.unlockedAt.getTime() - Date.now());
      }
    }

    // Calculate security score
    let securityScore = 100;

    if (isLocked) securityScore -= 30;
    if (user.failedLoginAttempts > 0) securityScore -= (user.failedLoginAttempts * 2);
    if (!user.isTwoFactorEnabled) securityScore -= 20;
    if (passwordAgeDays && passwordAgeDays > 90) securityScore -= 10;
    if (passwordAgeDays && passwordAgeDays > 180) securityScore -= 20;

    if (user.isTwoFactorEnabled) securityScore += 15;
    if (user.mfaDevices.length > 1) securityScore += 10;
    if (user.trustedDevices.length > 0) securityScore += 5;

    securityScore = Math.max(0, Math.min(100, securityScore));

    const securityStatus = {
      accountStatus: {
        isLocked,
        lockedAt: user.lockedAt,
        unlockedAt: user.unlockedAt,
        lockReason: user.lockReason,
        remainingTime,
        isActive: !isLocked
      },
      loginSecurity: {
        failedLoginAttempts: user.failedLoginAttempts,
        lastFailedLoginAt: user.lastFailedLoginAt,
        lastFailedLoginIp: user.lastFailedLoginIp,
        passwordAgeDays,
      },
      multiFactorAuth: {
        isEnabled: user.isTwoFactorEnabled,
        method: user.twoFactorMethod,
        devicesCount: user.mfaDevices.length,
        devices: user.mfaDevices
      },
      deviceSecurity: {
        trustedDevicesCount: user.trustedDevices.length,
        trustedDevices: user.trustedDevices,
        activeSessions: user.sessions.length,
        recentSessions: user.sessions
      },
      securityScore: {
        score: securityScore,
        level: securityScore >= 80 ? 'HIGH' : securityScore >= 60 ? 'MEDIUM' : 'LOW',
        recommendations: this.generateSecurityRecommendations({
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          passwordAgeDays,
          failedLoginAttempts: user.failedLoginAttempts,
          mfaDevicesCount: user.mfaDevices.length,
          isLocked
        })
      }
    };

    // Cache the result
    await userCacheService.setSecurityStatus(userId, securityStatus);

    return securityStatus;
  }

  /**
   * Generate security recommendations
   */
  private static generateSecurityRecommendations(status: {
    isTwoFactorEnabled: boolean;
    passwordAgeDays: number | null;
    failedLoginAttempts: number;
    mfaDevicesCount: number;
    isLocked: boolean;
  }): string[] {
    const recommendations: string[] = [];

    if (!status.isTwoFactorEnabled) {
      recommendations.push("Enable two-factor authentication for enhanced security");
    }

    if (status.passwordAgeDays && status.passwordAgeDays > 90) {
      recommendations.push("Consider changing your password");
    }

    if (status.failedLoginAttempts > 0) {
      recommendations.push("Reset failed login attempts count");
    }

    if (status.mfaDevicesCount === 0 && status.isTwoFactorEnabled) {
      recommendations.push("Register a backup MFA device");
    }

    if (status.isLocked) {
      recommendations.push("Contact support to unlock your account immediately");
    }

    if (recommendations.length === 0) {
      recommendations.push("Your account security is good.");
    }

    return recommendations;
  }

  /**
   * Validate a user's password
   */
  static async validatePassword(
    userId: string,
    password: string
  ): Promise<{
    valid: boolean;
    message: string;
    isLocked?: boolean;
    unlockedAt?: Date;
    attemptsRemaining?: number;
  }> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          password: true,
          isLocked: true,
          unlockedAt: true,
          failedLoginAttempts: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.password) {
        return {
          valid: false,
          message: 'User does not have a password set',
        };
      }

      const now = new Date();
      if (user.isLocked && user.unlockedAt && now < user.unlockedAt) {
        return {
          valid: false,
          isLocked: true,
          message: 'Account is locked. Please try again later.',
          unlockedAt: user.unlockedAt,
          attemptsRemaining: 0,
        };
      }

      if (user.isLocked && user.unlockedAt && now >= user.unlockedAt) {
        await db.user.update({
          where: { id: userId },
          data: {
            isLocked: false,
            unlockedAt: null,
            failedLoginAttempts: 0,
            lockReason: null,
          },
        });
      }

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        const limitResult = await this.incrementFailedAttempts(userId);
        await this.logPasswordValidation(userId, false);

        return {
          valid: false,
          message: 'Invalid password',
          isLocked: limitResult.isLocked,
          unlockedAt: limitResult.unlockedAt,
          attemptsRemaining: limitResult.remainingAttempts,
        };
      }

      await this.resetFailedAttempts(userId);
      await this.logPasswordValidation(userId, true);

      return {
        valid: true,
        message: 'Password is valid',
      };
    } catch (error) {
      logger.error('Error validating password:', { error, userId });
      throw error;
    }
  }

  /**
   * Log password validation attempt
   */
  private static async logPasswordValidation(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { loginLogs: true },
      });

      const currentLogs = (user?.loginLogs as any[]) || [];

      const newLogEntry = {
        timestamp: new Date().toISOString(),
        type: 'password_validation',
        success,
        ...(ipAddress && { ipAddress }),
        ...(userAgent && { userAgent }),
      };

      await db.user.update({
        where: { id: userId },
        data: {
          loginLogs: [...currentLogs, newLogEntry],
        },
      });
    } catch (error) {
      logger.error('Error logging password validation:', { error });
    }
  }

  /**
   * Update password history
   */
  static async updatePasswordHistory(
    userId: string,
    passwordHash: string
  ): Promise<{ updated: boolean }> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          passwordHistory: true,
          password: true
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentHistory = (user.passwordHistory || []) as string[];
      const updatedHistory = user.password
        ? [user.password, ...currentHistory]
        : currentHistory;

      const maxPasswordHistory = 5;
      const trimmedHistory = updatedHistory.slice(0, maxPasswordHistory);

      await db.user.update({
        where: { id: userId },
        data: {
          password: passwordHash,
          passwordHistory: trimmedHistory,
          passwordLastChanged: new Date(),
        },
      });

      logger.info('Password history updated successfully', { userId });

      return { updated: true };
    } catch (error: any) {
      logger.error('Error updating password history:', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Verify user email
   */
  static async verifyUserEmail(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.email) {
      throw new Error("User does not have an email address");
    }

    if (user.emailVerified) {
      return {
        message: "Email already verified",
        emailVerified: true,
      };
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        emailVerified: new Date(),
        trustScore: { increment: 0.1 },
        // Also increase verification level if still at BASIC
        verificationLevel: user.verificationLevel === VerificationLevel.BASIC
          ? VerificationLevel.INTERMEDIATE
          : user.verificationLevel
      }
    });

    // Invalidate caches
    await userCacheService.invalidateUser(userId, user.email || undefined, user.phone || undefined, user.uuid);
    await userCacheService.invalidateVerificationCache(userId);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      trustScore: updatedUser.trustScore
    };
  }

  /**
   * Verify user phone
   */
  static async verifyUserPhone(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.phone) {
      throw new Error("User does not have a phone number");
    }

    if (user.phoneVerified) {
      return {
        message: "Phone already verified",
        phoneVerified: user.phoneVerifiedAt
      };
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        trustScore: { increment: 0.15 }
      }
    });

    // Invalidate caches
    await userCacheService.invalidateUser(userId, user.email || undefined, user.phone || undefined, user.uuid);
    await userCacheService.invalidateVerificationCache(userId);

    return {
      id: updatedUser.id,
      phone: updatedUser.phone,
      phoneVerified: updatedUser.phoneVerified,
      phoneVerifiedAt: updatedUser.phoneVerifiedAt,
      trustScore: updatedUser.trustScore
    };
  }

  /**
   * Search users
   */
  static async searchUsers(
    query: string,
    filters: UserFilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ) {
    return this.getUsers(
      {
        ...filters,
        searchTerm: query
      },
      pagination,
      true
    );
  }

  /**
   * Get user statistics
   */
  static async getUserStatistics() {
    // Try to get from cache
    const cachedStats = await userCacheService.getUserStats();
    if (cachedStats) {
      logger.debug('User stats cache hit');
      return cachedStats;
    }

    logger.debug('User stats cache miss, fetching from DB');

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      todaySignups,
      weekSignups,
      monthSignups,
      roleCounts,
      twoFactorEnabled,
      lockedAccounts,
      usersWithVerifiedEmail,
      usersWithVerifiedPhone
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true, deletedAt: null } }),
      db.user.count({ where: { isSuspended: true } }),
      db.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      db.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      db.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      // Get counts by role
      (async () => {
        const roles = Object.values(UserRole);
        const counts: Record<string, number> = {};
        for (const role of roles) {
          counts[role] = await db.user.count({ where: { role } });
        }
        return counts;
      })(),
      db.user.count({ where: { isTwoFactorEnabled: true } }),
      db.user.count({ where: { NOT: { lockedAt: null } } }),
      db.user.count({
        where: {
          emailVerified: {
            not: null
          }
        }
      }),
      db.user.count({ where: { phoneVerified: true } })
    ]);

    // Get trust score statistics
    const trustScoreStats = await db.user.aggregate({
      where: { isActive: true, deletedAt: null },
      _avg: { trustScore: true },
      _min: { trustScore: true },
      _max: { trustScore: true },
    });

    const stats = {
      overview: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        verifiedEmail: usersWithVerifiedEmail,
        verifiedPhone: usersWithVerifiedPhone,
      },
      byRole: roleCounts,
      signups: {
        today: todaySignups,
        thisWeek: weekSignups,
        thisMonth: monthSignups,
        dailyAvg: Math.round(monthSignups / 30)
      },
      trustScore: {
        average: trustScoreStats._avg.trustScore || 0,
        min: trustScoreStats._min.trustScore || 0,
        max: trustScoreStats._max.trustScore || 0,
      },
      security: {
        twoFactorEnabled,
        lockedAccounts,
      }
    };

    // Cache the stats
    await userCacheService.setUserStats(stats);

    return stats;
  }

  /**
   * Get user activity timeline
   */
  static async getUserActivity(userId: string, limit: number = 50): Promise<UserActivity[]> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get recent activities
    const [
      logins,
      orders,
      favourites,
      reviews,
      comments
    ] = await Promise.all([
      db.session.findMany({
        where: { userId, isActive: true },
        orderBy: { lastUsedAt: 'desc' },
        take: 10,
        select: {
          lastUsedAt: true,
          ipAddress: true,
          userAgent: true,
        }
      }),
      db.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          number: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        }
      }),
      db.favourite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          createdAt: true,
          product: {
            select: {
              id: true
            }
          }
        }
      }),
      db.review.findMany({
        where: { userId, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          rating: true,
          title: true,
          product: {
            select: {
              id: true,
            }
          },
          createdAt: true,
        }
      }),
      db.comment.findMany({
        where: { userId, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          body: true,
          entityType: true,
          product: {
            select: {
              id: true,
            }
          },
          createdAt: true,
        }
      })
    ]);

    // Combine and sort all activities
    const activities = [
      ...logins.map(login => ({
        type: 'LOGIN' as const,
        date: login.lastUsedAt,
        data: { ipAddress: login.ipAddress, userAgent: login.userAgent }
      })),
      ...orders.map(order => ({
        type: 'ORDER' as const,
        date: order.createdAt,
        data: {
          orderId: order.id,
          orderNumber: order.number,
          status: order.status,
          amount: order.totalAmount
        }
      })),
      ...favourites.map(fav => ({
        type: 'FAVOURITE' as const,
        date: fav.createdAt,
        data: {
          productId: fav.product.id,
        }
      })),
      ...reviews.map(review => ({
        type: 'REVIEW' as const,
        date: review.createdAt,
        data: {
          reviewId: review.id,
          rating: review.rating,
          title: review.title,
        }
      })),
      ...comments.map(comment => ({
        type: 'COMMENT' as const,
        date: comment.createdAt,
        data: {
          commentId: comment.id,
          content: comment.body.substring(0, 100),
          entityType: comment.entityType,
          productName: comment.product?.id
        }
      }))
    ];

    activities.sort((a, b) => b.date.getTime() - a.date.getTime());

    return activities.slice(0, limit);
  }

  /**
   * Export user data (GDPR compliance)
   */
  static async exportUserData(userId: string): Promise<GDPRExportData> {
    const user = await this.getUserById(userId, false, true);

    if (!user) {
      throw new Error("User not found");
    }

    const [
      sessions,
      auditLogs,
      searchHistory,
      orders,
      reviews,
      comments,
      verificationTokens,
      passwordResetTokens,
      twoFactorTokens,
      emailChangeTokens,
      phoneChangeTokens,
    ] = await Promise.all([
      db.session.findMany({
        where: { userId },
        select: {
          id: true,
          sessionToken: true,
          expires: true,
          ipAddress: true,
          userAgent: true,
          deviceInfo: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
        }
      }),
      db.auditLog.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          changes: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          createdAt: true,
        }
      }),
      db.searchHistory.findMany({
        where: { userId },
        select: {
          id: true,
          query: true,
          filters: true,
          resultsCount: true,
          createdAt: true,
        }
      }),
      db.order.findMany({
        where: { userId },
        select: {
          id: true,
          number: true,
          status: true,
          subtotal: true,
          discountAmount: true,
          deliveryFee: true,
          taxAmount: true,
          totalAmount: true,
          currency: true,
          notes: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            }
          },
        }
      }),
      db.review.findMany({
        where: { userId },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          images: true,
          status: true,
          helpfulCount: true,
          createdAt: true,
          product: {
            select: {
              id: true
            }
          }
        }
      }),
      db.comment.findMany({
        where: { userId },
        select: {
          id: true,
          entityType: true,
          body: true,
          status: true,
          upvoteCount: true,
          downvoteCount: true,
          createdAt: true,
        }
      }),
      db.verificationToken.findMany({
        where: { userId },
        select: {
          id: true,
          email: true,
          token: true,
          expires: true,
        }
      }),
      db.passwordResetToken.findMany({
        where: { userId },
        select: {
          id: true,
          email: true,
          token: true,
          expires: true,
          createdAt: true,
        }
      }),
      db.twoFactorToken.findMany({
        where: { userId },
        select: {
          id: true,
          email: true,
          token: true,
          expires: true,
        }
      }),
      db.emailChangeToken.findMany({
        where: { userId },
        select: {
          id: true,
          token: true,
          newEmail: true,
          oldEmail: true,
          expiresAt: true,
          isUsed: true,
          usedAt: true,
          ipAddress: true,
          createdAt: true,
        }
      }),
      db.phoneChangeToken.findMany({
        where: { userId },
        select: {
          id: true,
          token: true,
          newPhone: true,
          oldPhone: true,
          expiresAt: true,
          isUsed: true,
          usedAt: true,
          ipAddress: true,
          method: true,
          createdAt: true,
        }
      })
    ]);

    // Create export-specific user object
    const exportUser: ExportUserDataw = {
      id: user.id,
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      phoneVerifiedAt: user.phoneVerifiedAt,
      image: user.image,
      role: user.role,
      isActive: user.isActive,
      isSuspended: user.isSuspended,
      suspendedUntil: user.suspendedUntil,
      suspensionReason: user.suspensionReason,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      language: user.language,
      timezone: user.timezone,
      currency: user.currency,
      trustScore: user.trustScore,
      lastLoginAt: user.lastLoginAt,
      lastActiveAt: user.lastActiveAt,
      loginCount: user.loginCount,
      isVerified: user.isVerified,
      verificationLevel: user.verificationLevel,
      termsAcceptedAt: user.termsAcceptedAt,
      termsVersion: user.termsVersion,
      privacyAcceptedAt: user.privacyAcceptedAt,
      privacyVersion: user.privacyVersion,
      marketingOptIn: user.marketingOptIn,
      dataProcessingConsent: user.dataProcessingConsent,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      signupSource: user.signupSource,
      referrerId: user.referrerId,
      profile: user.profile ? {
        id: user.profile.id,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        displayName: user.profile.displayName,
        addressLine1: user.profile.addressLine1,
        city: user.profile.city,
        county: user.profile.county,
        country: user.profile.country,
        idVerificationStatus: user.profile.idVerificationStatus,
        idDocumentType: user.profile.idDocumentType,
        totalOrders: user.profile.totalOrders,
        totalSpent: user.profile.totalSpent,
      } : null,
      accounts: user.accounts?.map(account => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        type: account.type,
        refresh_token: account.refresh_token ? '[REDACTED]' : undefined,
        access_token: account.access_token ? '[REDACTED]' : undefined,
        id_token: account.id_token ? '[REDACTED]' : undefined,
      })) || [],
    }

    // Map orders to export format
    const exportOrders: ExportOrderData[] = orders.map(order => ({
      id: order.id,
      number: order.number,
      status: order.status,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      deliveryFee: order.deliveryFee,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      currency: order.currency,
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    }));

    // Map reviews to export format
    const exportReviews: ExportReviewData[] = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      images: review.images,
      status: review.status,
      helpfulCount: review.helpfulCount,
      createdAt: review.createdAt,
      product: review.product || { id: '' },
    }));

    // Map comments to export format
    const exportComments: ExportCommentData[] = comments.map(comment => ({
      id: comment.id,
      entityType: comment.entityType,
      body: comment.body,
      status: comment.status,
      upvoteCount: comment.upvoteCount,
      downvoteCount: comment.downvoteCount,
      createdAt: comment.createdAt,
    }));

    // Map audit logs to export format
    const exportAuditLogs: ExportAuditLogData[] = auditLogs.map(log => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    // Map search history to export format
    const exportSearchHistory: ExportSearchHistoryData[] = searchHistory.map(history => ({
      id: history.id,
      query: history.query,
      filters: history.filters,
      resultsCount: history.resultsCount,
      createdAt: history.createdAt,
    }));

    const exportData: GDPRExportData = {
      exportDate: new Date().toISOString(),
      user: exportUser,
      activity: {
        auditLogs: exportAuditLogs,
        searchHistory: exportSearchHistory,
        orders: exportOrders,
        reviews: exportReviews,
        comments: exportComments,
      },
      security: {
        verificationTokens: verificationTokens.map(token => ({
          ...token,
          token: '[REDACTED]',
        })),
        passwordResetTokens: passwordResetTokens.map(token => ({
          ...token,
          token: '[REDACTED]',
        })),
        twoFactorTokens: twoFactorTokens.map(token => ({
          ...token,
          token: '[REDACTED]',
        })),
        emailChangeTokens: emailChangeTokens.map(token => ({
          ...token,
          token: '[REDACTED]',
        })),
        phoneChangeTokens: phoneChangeTokens.map(token => ({
          ...token,
          token: '[REDACTED]',
        })),
      },
    };

    return exportData;
  }

  /**
   * INTERNAL USE ONLY - bypasses validations
   */
  static async internalUpdateUser(id: string, data: any) {
    return db.user.update({
      where: { id },
      data
    });
  }

  /**
   * Get comprehensive request metadata
   */
  static async getRequestMetadata(req: ExpressRequest): Promise<RequestMetadata> {
    try {
      const metadata = await getAdvancedRequestMetadata(req as any);

      logger.info('Request metadata extracted successfully', {
        ipAddress: metadata.network.ipAddress,
        device: metadata.userAgent.device.type,
        browser: metadata.userAgent.browser.name,
      });

      return metadata;
    } catch (error: any) {
      logger.error('Error extracting request metadata:', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check for suspicious activity
   */
  static async checkSuspiciousActivity(
    data: CheckSuspiciousActivityInput
  ): Promise<SuspiciousActivityResult> {
    try {
      const {
        userId,
        ipAddress,
        userAgent,
        location,
        deviceId,
        loginTime,
        metadata,
      } = data;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          loginLogs: true,
          lastLoginAt: true,
          lastLoginIp: true,
          isTwoFactorEnabled: true,
          trustedDevices: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      let suspiciousScore = 0;
      const reasons: string[] = [];
      const recommendations: string[] = [];

      const loginLogs = (user.loginLogs || []) as any[];
      const recentLogins = loginLogs
        .filter(log => log.success === true)
        .slice(-20);

      const trustedDevices = (user.trustedDevices || []) as any[];
      const isTrustedDevice = deviceId && trustedDevices.some(device => device.deviceId === deviceId);

      if (deviceId && !isTrustedDevice) {
        const deviceIds = recentLogins.map((log) => log.deviceId).filter(Boolean);
        if (!deviceIds.includes(deviceId)) {
          if (user.isTwoFactorEnabled) {
            suspiciousScore += 5;
            reasons.push('Login from new device (MFA-protected)');
          } else {
            suspiciousScore += 10;
            reasons.push('Login from new device');
            recommendations.push('Consider enabling two-factor authentication');
          }
          recommendations.push('Device verification required');
        }
      }

      if (location && !isTrustedDevice) {
        const locations = recentLogins.map((log) => log.location).filter(Boolean);
        const similarLocations = locations.filter(loc => {
          const currentCountry = location.split(',')[0]?.trim();
          const storedCountry = loc.split(',')[0]?.trim();
          return currentCountry === storedCountry;
        });

        if (similarLocations.length === 0) {
          suspiciousScore += 8;
          reasons.push('Login from new location');
          recommendations.push('Send location notification to user');
        }
      }

      if (loginTime) {
        const hour = new Date(loginTime).getHours();
        const loginHours = recentLogins.map(log => new Date(log.timestamp).getHours());
        const hasLateNightHistory = loginHours.some(h => h >= 0 && h <= 5);

        if (!hasLateNightHistory && hour >= 0 && hour <= 5) {
          suspiciousScore += 3;
          reasons.push('Login at unusual time for this user');
        }
      }

      const userAgents = recentLogins.map((log) => log.userAgent).filter(Boolean);
      const normalizedUA = userAgent.toLowerCase();

      const getBrowserFamily = (ua: string): string => {
        const uaLower = ua.toLowerCase();
        if (uaLower.includes('chrome')) return 'chrome';
        if (uaLower.includes('firefox')) return 'firefox';
        if (uaLower.includes('safari')) return 'safari';
        if (uaLower.includes('edge')) return 'edge';
        return 'other';
      };

      const currentBrowser = getBrowserFamily(normalizedUA);
      const previousBrowsers = userAgents.map(getBrowserFamily);

      if (!previousBrowsers.includes(currentBrowser)) {
        suspiciousScore += 8;
        reasons.push('Login from new browser type');
        recommendations.push('Browser verification recommended');
      }

      if (metadata?.vpn || metadata?.proxy || metadata?.tor) {
        const vpnUsageHistory = loginLogs.filter(log =>
          log.metadata?.vpn || log.metadata?.proxy || log.metadata?.tor
        ).length;

        if (vpnUsageHistory === 0) {
          suspiciousScore += 15;
          reasons.push('Login from VPN/Proxy/Tor network');
          recommendations.push('Additional verification required for proxy connections');
        } else {
          suspiciousScore += 5;
          reasons.push('Login from VPN (user has history of VPN usage)');
        }
      }

      if (isTrustedDevice) {
        suspiciousScore = Math.max(0, suspiciousScore - 20);
      }

      if (user.isTwoFactorEnabled) {
        suspiciousScore = Math.max(0, suspiciousScore - 15);
      }

      const isSuspicious = suspiciousScore >= 40;
      const confidence = Math.min(suspiciousScore / 100, 1);

      if (isSuspicious) {
        if (suspiciousScore >= 60) {
          recommendations.push(
            'Temporarily restrict account pending verification',
            'Require email/SMS verification',
            'Contact user to confirm identity'
          );
        } else if (suspiciousScore >= 40) {
          recommendations.push(
            'Require additional verification',
            'Enable two-factor authentication if not already enabled',
            'Monitor this account for unusual activity'
          );
        }
      } else if (suspiciousScore >= 20) {
        recommendations.push(
          'This login appears normal but has some new elements',
          'User will receive a notification about this login'
        );
      }

      const result: SuspiciousActivityResult = {
        isSuspicious,
        reason: reasons.length > 0 ? reasons.join('; ') : undefined,
        confidence,
        recommendations: [...new Set(recommendations)],
        score: suspiciousScore,
      };

      logger.info('Suspicious activity check completed', {
        userId,
        isSuspicious,
        score: suspiciousScore,
        confidence,
        isTrustedDevice,
        mfaEnabled: user.isTwoFactorEnabled,
      });

      return result;
    } catch (error: any) {
      logger.error('Error checking suspicious activity:', {
        error: error.message,
        userId: data.userId,
      });

      return {
        isSuspicious: false,
        confidence: 0,
        score: 0,
        recommendations: ['Error in security check - proceeding with caution'],
      };
    }
  }

  /**
   * Flag a suspicious login
   */
  static async flagSuspiciousLogin(
    data: FlagSuspiciousLoginInput
  ): Promise<FlagSuspiciousLoginResult> {
    try {
      const { userId, ipAddress, reason, severity, metadata } = data;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          loginLogs: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date();

      const alertEntry = {
        timestamp: timestamp.toISOString(),
        type: 'suspicious_login_flag',
        alertId,
        ipAddress,
        reason,
        severity,
        metadata: metadata || {},
      };

      const currentLogs = (user.loginLogs || []) as any[];
      await db.user.update({
        where: { id: userId },
        data: {
          loginLogs: [...currentLogs, alertEntry],
        },
      });

      logger.warn('Suspicious login flagged', {
        userId,
        alertId,
        reason,
        severity,
        ipAddress,
        metadata,
      });

      try {
        await sendSecurityAlert({
          userId,
          type: 'SUSPICIOUS_LOGIN',
          message: `Suspicious login detected: ${reason}`,
          severity,
          metadata: {
            ipAddress,
            alertId,
            timestamp: timestamp.toISOString(),
            ...metadata,
          },
        });
      } catch (alertError) {
        logger.error('Failed to send security alert:', { alertError });
      }

      return {
        flagged: true,
        alertId,
        timestamp,
        severity,
      };
    } catch (error: any) {
      logger.error('Error flagging suspicious login:', {
        error: error.message,
        userId: data.userId,
      });
      throw error;
    }
  }

  /**
   * Record login activity
   */
  static async recordLoginActivity(
    data: RecordLoginActivityInput
  ): Promise<RecordLoginActivityResult> {
    try {
      const {
        userId,
        ipAddress,
        userAgent,
        location,
        city,
        country,
        deviceType,
        browser,
        os,
        success,
        failureReason,
        metadata,
      } = data;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          loginLogs: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const currentLogs = (user.loginLogs || []) as any[];

      const logEntry = {
        activityId,
        timestamp: new Date().toISOString(),
        type: 'login_attempt',
        success,
        ipAddress,
        userAgent,
        location,
        city,
        country,
        deviceType,
        browser,
        os,
        ...(failureReason && { failureReason }),
        ...(metadata && { metadata }),
      };

      await db.user.update({
        where: { id: userId },
        data: {
          loginLogs: [...currentLogs, logEntry],
          ...(success && {
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress,
          }),
        },
      });

      logger.info('Login activity recorded', {
        userId,
        activityId,
        success,
        ipAddress,
      });

      return {
        recorded: true,
        activityId,
      };
    } catch (error: any) {
      logger.error('Error recording login activity:', {
        error: error.message,
        userId: data.userId,
      });
      throw error;
    }
  }

  static async detectLocation(
    ipAddress?: string,
    req?: ExpressRequest
  ): Promise<{
    country: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
    timezone: string;
    isp: string;
    proxy?: boolean;
    vpn?: boolean;
    tor?: boolean;
    metadata?: any;
  }> {
    try {
      let finalIpAddress = ipAddress;
      let requestMetadata: any = null;

      if (req) {
        try {
          requestMetadata = await metadataExtractor.extract(req as any);
          if (!finalIpAddress && requestMetadata?.network?.ipAddress) {
            finalIpAddress = requestMetadata.network.ipAddress;
          }
        } catch (metadataError) {
          logger.warn('Metadata extraction failed:', { metadataError });
        }
      }

      const isDevelopment = process.env.NODE_ENV === 'development';
      const isLocalIp = !finalIpAddress ||
        finalIpAddress === 'unknown' ||
        finalIpAddress === '127.0.0.1' ||
        finalIpAddress === '::1' ||
        finalIpAddress?.startsWith('192.168.') ||
        finalIpAddress?.startsWith('10.');

      if (isLocalIp) {
        if (isDevelopment) {
          try {
            const externalIp = await this.getExternalIpForDevelopment();
            if (externalIp && this.isValidIP(externalIp)) {
              finalIpAddress = externalIp;
              logger.info('Using external IP for development:', { externalIp });
            } else {
              return this.getDevelopmentDefaults(requestMetadata);
            }
          } catch (externalIpError) {
            return this.getDevelopmentDefaults(requestMetadata);
          }
        } else {
          logger.warn('Local IP detected in production environment', { ipAddress: finalIpAddress });
          throw new Error('Unable to determine public IP address');
        }
      }

      if (!finalIpAddress || finalIpAddress === 'unknown') {
        throw new Error('Unable to determine IP address');
      }

      let cleanIp = finalIpAddress;
      if (cleanIp.startsWith('::ffff:')) {
        cleanIp = cleanIp.substring(7);
      }

      if (!this.isValidIP(cleanIp)) {
        throw new Error(`Invalid IP address format: ${cleanIp}`);
      }

      const geoData = await this.getGeoDataWithFallbacks(cleanIp);

      const responseData: any = {
        country: geoData.country || 'Unknown',
        region: geoData.region || 'Unknown',
        city: geoData.city || 'Unknown',
        latitude: geoData.latitude || geoData.ll?.[0] || 0,
        longitude: geoData.longitude || geoData.ll?.[1] || 0,
        timezone: geoData.timezone || 'Unknown',
        isp: geoData.isp || 'Unknown',
      };

      if (requestMetadata?.network) {
        responseData.proxy = requestMetadata.network.proxyType !== 'none';
        responseData.vpn = requestMetadata.network.vpnDetection?.isVpn || false;
        responseData.tor = requestMetadata.network.proxyType === 'tor';
        responseData.isp = requestMetadata.network.isp || responseData.isp;
        responseData.metadata = {
          network: requestMetadata.network,
          userAgent: requestMetadata.userAgent,
          threatLevel: requestMetadata.network.threatLevel || 'unknown',
          confidence: requestMetadata.network.vpnDetection?.confidence || 0,
        };
      }

      if (!requestMetadata) {
        try {
          const securityData = await this.getSecurityData(cleanIp);
          responseData.proxy = securityData.proxy || false;
          responseData.vpn = securityData.vpn || false;
          responseData.tor = securityData.tor || false;
        } catch (securityError) {
          logger.warn('Security data fetch failed:', { securityError });
          responseData.proxy = false;
          responseData.vpn = false;
          responseData.tor = false;
        }
      }

      logger.info('Location detection completed', {
        ipAddress: cleanIp,
        source: geoData.source,
        country: responseData.country,
        development: isDevelopment,
      });

      return {
        ...responseData,
        ipAddress: cleanIp
      };
    } catch (error: any) {
      logger.error('Location detection failed:', {
        error: error.message,
        ipAddress,
        stack: error.stack
      });

      if (process.env.NODE_ENV === 'development') {
        logger.info('Returning development defaults due to error');
        return this.getDevelopmentDefaults(null);
      }

      throw error;
    }
  }

  /**
   * Get development default location data
   */
  private static getDevelopmentDefaults(requestMetadata?: any): {
    country: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
    timezone: string;
    isp: string;
    proxy: boolean;
    vpn: boolean;
    tor: boolean;
    metadata?: any;
  } {
    const defaults = {
      country: 'KE',
      region: 'Nairobi',
      city: 'Nairobi',
      latitude: -1.286389,
      longitude: 36.817223,
      timezone: 'Africa/Nairobi',
      isp: 'Development ISP',
      proxy: false,
      vpn: false,
      tor: false,
    };

    if (requestMetadata?.network) {
      return {
        ...defaults,
        metadata: {
          network: requestMetadata.network,
          userAgent: requestMetadata.userAgent,
          threatLevel: requestMetadata.network.threatLevel || 'low',
          confidence: requestMetadata.network.vpnDetection?.confidence || 0,
        },
      };
    }

    return defaults;
  }

  /**
   * Get external IP for development environment
   */
  private static async getExternalIpForDevelopment(): Promise<string | null> {
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.my-ip.io/ip.json',
      'https://ipinfo.io/json',
    ];

    for (const serviceUrl of services) {
      try {
        const response = await fetch(serviceUrl, {
          signal: AbortSignal.timeout(3000)
        });

        if (!response.ok) continue;

        const data = await response.json();
        const ip = data.ip || data.address;

        if (ip && this.isValidIP(ip)) {
          logger.info('External IP retrieved from service:', { service: serviceUrl, ip });
          return ip;
        }
      } catch (error) {
        logger.debug('Failed to get IP from service:', { service: serviceUrl, error });
        continue;
      }
    }

    logger.warn('All external IP services failed');
    return null;
  }

  /**
   * Get geo data with multiple fallback services
   */
  private static async getGeoDataWithFallbacks(ip: string): Promise<any> {
    const services = [
      () => this.getGeoDataFromIpApi(ip),
      () => this.getGeoDataFromIpInfo(ip),
      () => this.getGeoDataFromIpStack(ip),
    ];

    let lastError: any;

    for (const service of services) {
      try {
        const data = await service();
        if (data && data.country) {
          return data;
        }
      } catch (error) {
        lastError = error;
        logger.debug('Geo service failed, trying next:', { error });
        continue;
      }
    }

    throw lastError || new Error('All geo location services failed');
  }

  /**
   * Get geo data from ip-api.com
   */
  private static async getGeoDataFromIpApi(ip: string): Promise<any> {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,timezone,isp,proxy`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`ip-api.com returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('ip-api.com query failed');
    }

    return {
      country: data.country,
      region: data.regionName,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
      isp: data.isp,
      proxy: data.proxy,
      source: 'ip-api.com',
    };
  }

  /**
   * Get geo data from ipinfo.io
   */
  private static async getGeoDataFromIpInfo(ip: string): Promise<any> {
    const response = await fetch(`https://ipinfo.io/${ip}/json`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`ipinfo.io returned ${response.status}`);
    }

    const data = await response.json();
    const [lat, lon] = data.loc?.split(',').map(Number) || [0, 0];

    return {
      country: data.country,
      region: data.region,
      city: data.city,
      latitude: lat,
      longitude: lon,
      timezone: data.timezone,
      isp: data.org,
      source: 'ipinfo.io',
    };
  }

  /**
   * Get geo data from ipstack.com
   */
  private static async getGeoDataFromIpStack(ip: string): Promise<any> {
    const apiKey = process.env.IPSTACK_API_KEY;

    if (!apiKey) {
      throw new Error('IPStack API key not configured');
    }

    const response = await fetch(`http://api.ipstack.com/${ip}?access_key=${apiKey}`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`ipstack.com returned ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`ipstack error: ${data.error.info}`);
    }

    return {
      country: data.country_name,
      region: data.region_name,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.time_zone?.id,
      isp: data.connection?.isp,
      source: 'ipstack.com',
    };
  }

  /**
 * Update user verification level
 */
  static async updateVerificationLevel(userId: string, level: VerificationLevel) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        verificationLevel: level,
        isVerified: level !== VerificationLevel.BASIC,
        trustScore: this.calculateTrustScoreForVerificationLevel(level)
      }
    });

    // Update profile verification status
    if (user.profile) {
      let profileUpdate: any = {};

      if (level === VerificationLevel.VERIFIED) {
        profileUpdate.idVerificationStatus = VerificationStatus.VERIFIED;
        profileUpdate.idVerifiedAt = new Date();
        profileUpdate.idVerificationMethod = VerificationMethod.MANUAL;
      }

      if (level === VerificationLevel.ADVANCED) {
        profileUpdate.incomeVerificationStatus = VerificationStatus.VERIFIED;
        profileUpdate.incomeVerifiedAt = new Date();
        profileUpdate.isProfessionalVerified = true;
        profileUpdate.professionalVerificationLevel = VerificationLevel.ADVANCED;
        profileUpdate.professionalVerifiedAt = new Date();
      }

      if (Object.keys(profileUpdate).length > 0) {
        await db.profile.update({
          where: { userId },
          data: profileUpdate
        });
      }
    }

    // Invalidate caches
    await userCacheService.invalidateUser(userId, user.email || undefined, user.phone || undefined, user.uuid);
    await userCacheService.invalidateVerificationCache(userId);

    return {
      id: updatedUser.id,
      verificationLevel: updatedUser.verificationLevel,
      isVerified: updatedUser.isVerified,
      trustScore: updatedUser.trustScore
    };
  }

  private static calculateTrustScoreForVerificationLevel(level: VerificationLevel): number {
    switch (level) {
      case VerificationLevel.BASIC:
        return 0.3;
      case VerificationLevel.INTERMEDIATE:
        return 0.6;
      case VerificationLevel.ADVANCED:
        return 0.9;
      case VerificationLevel.VERIFIED:
        return 1.0;
      default:
        return 0.0;
    }
  }

  /**
   * Get security/threat intelligence data
   */
  private static async getSecurityData(ip: string): Promise<any> {
    const services = [
      this.getAbuseIPDBData,
    ];

    const results: any = {};

    const promises = services.map(async (service) => {
      try {
        const data = await Promise.race([
          service(ip),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )
        ]);
        return data;
      } catch (error) {
        return null;
      }
    });

    const securityResults = await Promise.allSettled(promises);

    securityResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        Object.assign(results, result.value);
      }
    });

    return results;
  }

  /**
   * AbuseIPDB - Threat intelligence
   */
  private static async getAbuseIPDBData(ip: string): Promise<any> {
    const API_KEY = process.env.ABUSEIPDB_API_KEY;
    if (!API_KEY) return {};

    const response = await fetch('https://api.abuseipdb.com/api/v2/check', {
      method: 'POST',
      headers: {
        'Key': API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ipAddress: ip,
        maxAgeInDays: '90',
        verbose: ''
      })
    });

    const data = await response.json();

    if (data.data) {
      return {
        abuseConfidenceScore: data.data.abuseConfidenceScore,
        totalReports: data.data.totalReports,
        isPublic: data.data.isPublic,
        isWhitelisted: data.data.isWhitelisted,
        usageType: data.data.usageType,
        isp: data.data.isp,
        domain: data.data.domain,
        countryCode: data.data.countryCode,
        lastReportedAt: data.data.lastReportedAt,
      };
    }
    return {};
  }

  /**
   * Validate IP address format
   */
  private static isValidIP(ip: string): boolean {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    const ipv6CompressedPattern = /^(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?$/;

    if (ipv4Pattern.test(ip)) {
      const octets = ip.split('.');
      return octets.every(octet => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255 && octet === num.toString();
      });
    }

    return ipv6Pattern.test(ip) || ipv6CompressedPattern.test(ip);
  }

  /**
   * Verify a device token
   */
  static async verifyDeviceToken(
    deviceId: string,
    deviceToken: string,
    userId: string
  ): Promise<boolean> {
    try {
      const trustedDevice = await db.trustedDevice.findFirst({
        where: {
          deviceId,
          userId,
          revokedAt: null,
          expiresAt: { gte: new Date() }
        }
      });

      if (!trustedDevice) {
        logger.warn("Device not found or expired", {
          deviceId: deviceId.substring(0, 8) + "...",
          userId
        });
        return false;
      }

      const isValid = await bcrypt.compare(deviceToken, trustedDevice.deviceTokenHash);

      if (!isValid) {
        logger.warn("Invalid device token", {
          deviceId: deviceId.substring(0, 8) + "...",
          userId
        });
        return false;
      }

      await db.trustedDevice.update({
        where: { id: trustedDevice.id },
        data: {
          lastSeen: new Date(),
          trustScore: Math.min(trustedDevice.trustScore + 1, 100)
        }
      });

      logger.info("Device verified successfully", {
        deviceId: deviceId.substring(0, 8) + "...",
        deviceName: trustedDevice.deviceName,
        trustScore: trustedDevice.trustScore,
        verified: trustedDevice.verified
      });

      // Invalidate device cache
      await userCacheService.invalidateSecurityCache(userId);

      return true;

    } catch (error) {
      logger.error("Device verification failed:", {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId: deviceId.substring(0, 8) + "...",
        userId
      });
      return false;
    }
  }

  /**
   * Mark device as verified after email verification
   */
  static async markDeviceAsVerified(
    deviceId: string,
    userId: string
  ): Promise<void> {
    try {
      const result = await db.trustedDevice.updateMany({
        where: {
          deviceId,
          userId,
          revokedAt: null
        },
        data: {
          verified: true,
          trustScore: { increment: 20 },
          lastSeen: new Date()
        }
      });

      if (result.count > 0) {
        logger.info(" Device marked as verified", {
          deviceId: deviceId.substring(0, 8) + "...",
          userId,
          devicesUpdated: result.count
        });

        // Invalidate device cache
        await userCacheService.invalidateSecurityCache(userId);
      } else {
        logger.warn("[!] No devices found to verify", {
          deviceId: deviceId.substring(0, 8) + "...",
          userId
        });
      }

    } catch (error) {
      logger.error("[*] Failed to verify device:", {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId: deviceId.substring(0, 8) + "...",
        userId
      });
    }
  }

  /**
   * Get cache statistics for users
   */
  static async getCacheStats() {
    return userCacheService.getStats();
  }

  /**
   * Clear all user-related cache
   */
  static async clearUserCache(): Promise<void> {
    await userCacheService.clearAll();
  }

  /**
   * Clear cache for a specific user
   */
  static async clearUserCacheById(userId: string): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, uuid: true }
    });

    if (user) {
      await userCacheService.invalidateUser(userId, user.email || undefined, user.phone || undefined, user.uuid);
    }
  }

  /**
   * Check if cache service is healthy
   */
  static async healthCheck(): Promise<{
    cacheService: {
      healthy: boolean;
      mode: string;
      memorySize?: number;
      error?: string;
    };
    database: boolean;
    overall: boolean;
  }> {
    try {
      const health = await userCacheService.healthCheck();

      // Check database connectivity
      let databaseHealthy = false;
      try {
        await db.$queryRaw`SELECT 1`;
        databaseHealthy = true;
      } catch (error) {
        logger.error('Database health check failed', { error });
      }

      return {
        cacheService: health,
        database: databaseHealthy,
        overall: health.healthy && databaseHealthy,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        cacheService: {
          healthy: false,
          mode: 'unknown',
          error: errorMessage
        },
        database: false,
        overall: false,
      };
    }
  }
}