import { Request, Response } from "express";
import {
    UserService,
    UserFilterOptions,
    PaginationOptions,
} from "../../../../services/user/user.service";

import { UserRole, VerificationLevel } from "@repo/database";
import { logger } from '@repo/logger';
import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createConflictResponse,
    createValidationErrorResponse,
    createPaginatedResponse,
    ErrorCode,
    PaginationInfo,
    ApiError
} from '@repo/api-utils';
import { validateRequest, validateRequestQuery, validateRequestParams, ValidationError, validateRequestBody } from "../../../../middlewares/request-validation";
import { z } from "zod";
import { CreateUserSchema, UserUpdateSchema } from "../../../../config/schemas/user.schemas";
import { getAdvancedRequestMetadata } from '@repo/request-metadata';
import { extractDeviceFingerprint, generateDeviceIdFromMetadata } from "../../../../lib/deviceFingerprint";
import { AuthRequest } from "../../../../middlewares/auth.middleware";


// Helper function to transform ValidationError[] to ApiError[]
const transformValidationErrors = (errors: ValidationError[]): ApiError[] => {
    return errors.map(error => ({
        code: error.code || ErrorCode.VALIDATION_ERROR,
        message: error.message,
        field: error.field
    }));
};

// Validation schemas for controller
const GetUsersQuerySchema = z.object({
    id: z.string().cuid().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.string().transform(val => val === 'true').optional(),
    isVerified: z.string().transform(val => val === 'true').optional(),
    isSuspended: z.string().transform(val => val === 'true').optional(),
    agencyId: z.string().cuid().optional(),
    verificationLevel: z.nativeEnum(VerificationLevel).optional(),
    minTrustScore: z.string().transform(val => parseFloat(val)).optional(),
    maxTrustScore: z.string().transform(val => parseFloat(val)).optional(),
    hasProfile: z.string().transform(val => val === 'true').optional(),
    search: z.string().optional(),
    page: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: "Page must be greater than 0" }).default("1"),
    limit: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0 && val <= 100, { message: "Limit must be between 1 and 100" }).default("10"),
    sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'email', 'reputationScore', 'trustScore', 'lastActiveAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    includeRelations: z.string().transform(val => val === 'true').optional().default("false"),
    includePassword: z.string().transform(val => val === 'true').optional().default("false"),
    includeSensitive: z.string().transform(val => val === 'true').optional().default("false"),
    includeMFA: z.string().transform(val => val === 'true').optional().default("false"),
    includeSecurity: z.string().transform(val => val === 'true').optional().default("false"),
    includeDevices: z.string().transform(val => val === 'true').optional().default("false"),

});

const UpdateUserSchema = UserUpdateSchema;
const PasswordUpdateSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required").optional(),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(100, "Password too long"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

const VerificationLevelSchema = z.object({
    level: z.nativeEnum(VerificationLevel),
});

const UserFilterSchema = z.object({
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    isSuspended: z.boolean().optional(),
    agencyId: z.string().cuid().optional(),
    verificationLevel: z.nativeEnum(VerificationLevel).optional(),
    minTrustScore: z.number().min(0).max(1).optional(),
    maxTrustScore: z.number().min(0).max(1).optional(),
    hasProfile: z.boolean().optional(),
    createdAtFrom: z.string().datetime().optional(),
    createdAtTo: z.string().datetime().optional(),
    searchTerm: z.string().optional(),
});

const DeleteUserSchema = z.object({
    permanent: z.string().transform(val => val === 'true').optional().default("false"),
});


export class UserController {
    // Create user with complete schema


    static createUser = async (req: Request, res: Response): Promise<void> => {
        try {
            logger.info("=== USER REGISTRATION START ===");

            // Extract IP and location using your existing detectLocation method
            let ipAddress: string | undefined;
            let locationData: any = null;
            let metadata: any = null;
            let deviceId: string | undefined;
            let deviceFingerprint: any;

            try {
                // Use your existing detectLocation method to get accurate IP
                const tempMetadata = await getAdvancedRequestMetadata(req, {
                    features: {
                        ipDetection: true,
                        userAgent: true,
                        geolocation: true,
                    }
                });

                // Get the IP from metadata
                ipAddress = tempMetadata.network.ipAddress;

                // If we have an IP, get detailed location using detectLocation
                if (ipAddress && ipAddress !== 'unknown') {
                    try {
                        // Use your existing UserService.detectLocation method
                        locationData = await UserService.detectLocation(ipAddress, req);

                        // Extract metadata from detectLocation result
                        metadata = {
                            network: {
                                ipAddress: ipAddress, // Use the IP from detectLocation
                                ipVersion: tempMetadata.network.ipVersion,
                                country: locationData.country,
                                city: locationData.city,
                                region: locationData.region,
                                latitude: locationData.latitude,
                                longitude: locationData.longitude,
                                timezone: locationData.timezone,
                                isp: locationData.isp,
                                proxyType: tempMetadata.network.proxyType,
                                vpnDetection: {
                                    isVpn: locationData.vpn || false,
                                    confidence: locationData.metadata?.confidence || 0,
                                    service: locationData.metadata?.vpnService || undefined
                                },
                                threatLevel: locationData.threatLevel || tempMetadata.network.threatLevel,
                            },
                            userAgent: tempMetadata.userAgent,
                            timing: tempMetadata.timing,
                            headers: tempMetadata.headers,
                            security: {
                                ...tempMetadata.security,
                                proxy: locationData.proxy || false,
                                vpn: locationData.vpn || false,
                                tor: locationData.tor || false,
                            }
                        };
                    } catch (locationError) {
                        logger.warn("Location detection failed, using basic metadata:", { locationError });
                        metadata = tempMetadata;
                    }
                } else {
                    // Try fallback IP detection
                    const fallbackIp = req.ip || req.socket?.remoteAddress;
                    if (fallbackIp && fallbackIp !== '127.0.0.1' && fallbackIp !== '::1') {
                        ipAddress = fallbackIp;
                        logger.info("Using fallback IP from request:", { fallbackIp });

                        // Try detectLocation with fallback IP
                        try {
                            locationData = await UserService.detectLocation(ipAddress, req);
                            metadata = {
                                network: {
                                    ipAddress: ipAddress,
                                    ipVersion: tempMetadata.network.ipVersion,
                                    country: locationData.country,
                                    city: locationData.city,
                                    region: locationData.region,
                                    latitude: locationData.latitude,
                                    longitude: locationData.longitude,
                                    timezone: locationData.timezone,
                                    isp: locationData.isp,
                                    proxyType: tempMetadata.network.proxyType,
                                    vpnDetection: {
                                        isVpn: locationData.vpn || false,
                                        confidence: locationData.metadata?.confidence || 0,
                                        service: locationData.metadata?.vpnService || undefined
                                    },
                                    threatLevel: locationData.threatLevel || tempMetadata.network.threatLevel,
                                },
                                userAgent: tempMetadata.userAgent,
                                timing: tempMetadata.timing,
                                headers: tempMetadata.headers,
                                security: {
                                    ...tempMetadata.security,
                                    proxy: locationData.proxy || false,
                                    vpn: locationData.vpn || false,
                                    tor: locationData.tor || false,
                                }
                            };
                        } catch (e) {
                            metadata = tempMetadata;
                        }
                    } else {
                        metadata = tempMetadata;
                    }
                }
            } catch (metadataError) {
                logger.error("Failed to extract metadata:", { metadataError });
                // Try one last time to get IP directly
                const directIp = req.ip || req.socket?.remoteAddress;
                if (directIp && directIp !== '127.0.0.1' && directIp !== '::1') {
                    ipAddress = directIp;
                }

                // Create minimal metadata structure
                metadata = {
                    network: {
                        ipAddress: ipAddress || undefined,
                        ipVersion: 'unknown',
                        country: 'Unknown',
                        city: 'Unknown',
                        threatLevel: 'unknown'
                    },
                    userAgent: {
                        raw: req.headers['user-agent'],
                        browser: { name: 'Unknown', version: 'Unknown', engine: 'Unknown' },
                        os: { name: 'Unknown', version: 'Unknown', platform: 'Unknown' },
                        device: { type: 'unknown', isBot: false },
                        capabilities: { screenResolution: undefined }
                    },
                    timing: {
                        requestTime: Date.now(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                    headers: {
                        acceptLanguage: req.headers['accept-language']
                    }
                };
            }

            // Warn if critical metadata is missing
            if (!ipAddress || ipAddress === 'unknown') {
                logger.warn("[!] WARNING: IP address could not be extracted. User will be created without IP tracking.");
            } else {
                logger.info(" Using IP address:", { ipAddress });
            }

            if (!metadata.userAgent.raw) {
                logger.warn("[!] WARNING: User agent could not be extracted. Device fingerprinting will be limited.");
            }

            // Prepare data for Prisma User creation - NOW USE ipAddress EVERYWHERE
            const userData: any = {
                // Authentication & Identity
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
                image: req.body.image,
                avatarUrl: req.body.avatarUrl,

                // Security
                password: req.body.password,
                passwordHashAlgorithm: 'bcrypt',

                // Role & Permissions
                role: req.body.role || 'TENANT',
                isActive: true,

                // Profile & Preferences
                language: req.body.language || 'en',
                timezone: metadata.timing.timezone || 'UTC',
                dateFormat: req.body.dateFormat || 'MM/DD/YYYY',
                currency: req.body.currency || 'USD',

                // Social & Reputation
                reputation: 0,
                reputationScore: 0.0,
                trustScore: 0.0,

                // Activity Tracking - USE ipAddress HERE
                lastLoginAt: null,
                lastLoginIp: null,
                lastActiveAt: new Date(),
                loginCount: 0,
                currentLoginIp: ipAddress || null, // CHANGED FROM directIp

                // Trust & Security - USE ipAddress HERE
                trustedIps: ipAddress ? [ipAddress] : [], // CHANGED FROM directIp
                isVerified: false,
                verificationLevel: 'BASIC',

                // Advanced Metadata Fields
                deviceFingerprint: deviceFingerprint,
                deviceId: deviceId,

                // USE ipAddress AND locationData HERE
                networkMetadata: ipAddress ? {
                    ipAddress: ipAddress, // CHANGED FROM directIp
                    ipVersion: metadata.network.ipVersion,
                    country: locationData?.country || metadata.network.country,
                    region: locationData?.region || 'Unknown',
                    city: locationData?.city || metadata.network.city,
                    latitude: locationData?.latitude,
                    longitude: locationData?.longitude,
                    timezone: locationData?.timezone || metadata.timing.timezone,
                    isp: locationData?.isp || metadata.network.isp,
                    proxyType: metadata.network.proxyType,
                    proxy: locationData?.proxy || false,
                    vpn: locationData?.vpn || metadata.network.vpnDetection?.isVpn || false,
                    vpnService: locationData?.metadata?.vpnService || metadata.network.vpnDetection?.service,
                    tor: locationData?.tor || false,
                    threatLevel: locationData?.threatLevel || metadata.network.threatLevel,
                    asn: locationData?.asn,
                    asnName: locationData?.asnName,
                    confidence: locationData?.metadata?.confidence,
                    source: locationData?.metadata?.source || 'geoip-service'
                } : null,

                userAgentMetadata: metadata.userAgent.raw ? {
                    raw: metadata.userAgent.raw,
                    browser: metadata.userAgent.browser,
                    os: metadata.userAgent.os,
                    device: metadata.userAgent.device,
                    capabilities: metadata.userAgent.capabilities,
                } : null,

                securityMetadata: {
                    isSecure: metadata.request?.isSecure || req.protocol === 'https',
                    tlsVersion: metadata.security?.tlsVersion,
                    proxy: locationData?.proxy || false,
                    vpn: locationData?.vpn || false,
                    tor: locationData?.tor || false,
                    headersAnalysis: {
                        dnt: metadata.headers?.dnt || false,
                        upgradeInsecureRequests: metadata.headers?.upgradeInsecureRequests || false,
                        referrerPolicy: metadata.security?.referrerPolicy,
                    },
                    cipherSuite: metadata.security?.cipherSuite,
                    threatAssessment: {
                        level: metadata.network.threatLevel,
                        score: this.calculateThreatScore(metadata)
                    }
                },

                registrationMetadata: {
                    requestTime: metadata.timing.requestTime,
                    timezone: metadata.timing.timezone,
                    localTime: metadata.timing.localTime || new Date().toLocaleString(),
                    utcOffset: metadata.timing.utcOffset || new Date().getTimezoneOffset(),
                    registrationSource: metadata.analytics?.referralSource || 'WEB',
                    locationDetectionMethod: locationData ? 'detectLocation-service' : 'basic-metadata',
                    ipSource: metadata.network.source || 'WEB',
                    userAgentAvailable: !!metadata.userAgent.raw,
                    deviceFingerprintGenerated: !!deviceId
                },

                // Risk Assessment
                riskLevel: this.calculateRiskLevel(metadata, locationData),
                isSuspiciousRegistration: this.isSuspiciousRegistration(metadata, locationData),
                requiresVerification: this.requiresVerification(metadata, locationData),

                // Legal & Compliance
                termsAcceptedAt: req.body.termsAccepted ? new Date() : null,
                termsVersion: req.body.termsVersion || '1.0',
                privacyAcceptedAt: req.body.privacyAccepted ? new Date() : null,
                privacyVersion: req.body.privacyVersion || '1.0',
                marketingOptIn: req.body.marketingOptIn || false,
                dataProcessingConsent: req.body.dataProcessingConsent || false,

                // Metadata - USE ipAddress HERE
                createdByIp: ipAddress || null, // This is the main field
                signupSource: metadata.analytics?.referralSource || 'WEB',

                // Profile relation
                profile: req.body.profile ? {
                    firstName: req.body.profile.firstName,
                    lastName: req.body.profile.lastName,
                    displayName: req.body.profile.displayName,
                    dateOfBirth: req.body.profile.dateOfBirth,
                    gender: req.body.profile.gender,
                    bio: req.body.profile.bio,
                    secondaryEmail: req.body.profile.secondaryEmail,
                    secondaryPhone: req.body.profile.secondaryPhone,
                    addressLine1: req.body.profile.addressLine1,
                    addressLine2: req.body.profile.addressLine2,
                    city: req.body.profile.city,
                    county: req.body.profile.county,
                    postalCode: req.body.profile.postalCode,
                    country: req.body.profile.country ?? 'KE',
                    idVerificationStatus: req.body.profile.idVerificationStatus,
                    idVerificationMethod: req.body.profile.idVerificationMethod,
                    idDocumentType: req.body.profile.idDocumentType,
                    idDocumentNumber: req.body.profile.idDocumentNumber,
                    idDocumentExpiry: req.body.profile.idDocumentExpiry,
                    profileVisibility: req.body.profile.profileVisibility,
                    notificationPreferences: req.body.profile.notificationPreferences,
                } : undefined,

                // Preferences
                preferences: req.body.preferences || {
                    notifications: {
                        email: true,
                        sms: false,
                        push: true,
                        marketing: false
                    },
                    privacy: {
                        showOnlineStatus: true,
                        showLastSeen: true,
                        profileVisibility: 'PUBLIC'
                    },
                    communication: {
                        preferredMethod: 'EMAIL',
                        language: 'en'
                    }
                }
            };

            // Remove undefined values
            Object.keys(userData).forEach(key => {
                if (userData[key] === undefined) {
                    delete userData[key];
                }
            });

            logger.info("📊 Registration data prepared for Prisma:", {
                email: userData.email || 'unknown',
                hasIp: !!userData.createdByIp,
                deviceId: userData.deviceId ? userData.deviceId.substring(0, 8) + "..." : 'NONE',
                riskLevel: userData.riskLevel,
                isSuspicious: userData.isSuspiciousRegistration,
                requiresVerification: userData.requiresVerification,
                location: userData.networkMetadata ?
                    `${userData.networkMetadata.city}, ${userData.networkMetadata.country}` :
                    'No location'
            });

            // Validate with your schema

            const validation = CreateUserSchema.safeParse(userData);

            if (!validation.success) {
                logger.error("[*] Validation failed:", {
                    errors: validation.error.errors.map(e => ({
                        path: e.path,
                        message: e.message,
                        code: e.code
                    }))
                });

                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));

                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            logger.info(" User data validated:", {
                email: validation.data?.email || 'unknown',
                role: validation.data?.role || 'TENANT',
                hasDeviceFingerprint: !!(validation.data?.deviceFingerprint),
                hasNetworkMetadata: !!(validation.data?.networkMetadata),
                riskLevel: validation.data?.riskLevel || 'LOW'
            });

            // Create user with validated data
            const user = await UserService.createUser(validation.data);

            const hasDeviceToken = !!(user as any)._deviceToken;
            const deviceToken = hasDeviceToken ? (user as any)._deviceToken : null;

            // Log registration completion
            logger.info("🎉 User registration completed:", {
                userId: user.id,
                email: user.email,
                createdByIp: user.createdByIp || 'NONE',
                trustScore: user.trustScore || 0,
                verificationLevel: user.verificationLevel || 'BASIC',
                riskLevel: user.riskLevel || 'LOW',
                requiresVerification: user.requiresVerification,
                hasDeviceToken
            });

            // Prepare success response
            const responseData: any = {
                user: {
                    id: user.id,
                    uuid: user.uuid,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isActive: user.isActive,
                    language: user.language,
                    timezone: user.timezone,
                    trustScore: user.trustScore,
                    verificationLevel: user.verificationLevel,
                    isVerified: user.isVerified,
                    isTwoFactorEnabled: user.isTwoFactorEnabled,
                    riskLevel: user.riskLevel,
                    requiresVerification: user.requiresVerification,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                },
                // Additional metadata for client
                metadata: {
                    registration: {
                        ipAddress: user.createdByIp,
                        requiresVerification: user.requiresVerification,
                        nextSteps: user.requiresVerification ? [
                            'Complete email verification',
                            'Verify phone number',
                            'Complete profile setup'
                        ] : ['Complete email verification']
                    }
                }
            };

            // Handle device security USING STORED VALUES
            if (hasDeviceToken && deviceToken && deviceId) {
                responseData.deviceSecurity = {
                    deviceToken: deviceToken,
                    deviceId: deviceId, // Use the stored deviceId
                    expiresIn: 90,
                    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                };

                // Set as httpOnly cookie
                res.cookie('device_token', deviceToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 90 * 24 * 60 * 60 * 1000,
                    path: '/'
                });

                logger.info("[-] Device token set as cookie", {
                    deviceId: deviceId.substring(0, 8) + "..."
                });
            }

            const response = createSuccessResponse(
                responseData,
                user.requiresVerification ?
                    "User created successfully. Additional verification required." :
                    "User created successfully"
            );


            res.status(201).json(response);

        } catch (error: any) {
            logger.error("[*] Error creating user:", {
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                code: error.code
            });

            // Handle specific error types
            if (error.message.includes('not found')) {
                const resourceName = error.message.split('not found')[0].trim() || 'Resource';
                const response = createNotFoundResponse(resourceName);
                res.status(404).json(response);
                return;
            }

            if (error.code === 'P2002' || error.message.includes('already exists')) {
                const field = error.meta?.target?.[0] || 'field';
                const response = createConflictResponse(
                    `User with this ${field} already exists. Please use a different ${field}.`
                );
                res.status(409).json(response);
                return;
            }

            if (error.message.includes("hashing error") || error.message.includes("Password")) {
                const response = createErrorResponse(
                    [{ code: ErrorCode.VALIDATION_ERROR, message: error.message }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            if (error.message.includes('validation') || error.message.includes('Validation')) {
                const errors = error.message.includes('JSON') ?
                    JSON.parse(error.message.split(':')[1]) :
                    [{ message: error.message }];

                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            // Generic error response
            const response = createErrorResponse(
                error instanceof Error ? error.message : 'Unknown error',
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    };


    // Helper to calculate threat score
    private static calculateThreatScore(metadata: any): number {
        let score = 0;

        if (metadata.network.vpnDetection?.isVpn) score += 30;
        if (metadata.network.proxyType === 'tor') score += 50;
        if (metadata.network.proxyType === 'proxy') score += 20;
        if (metadata.network.proxyType === 'vpn') score += 30;
        if (metadata.userAgent.device.isBot) score += 40;
        if (!metadata.userAgent.raw) score += 10;
        if (metadata.network.threatLevel === 'high') score += 60;
        if (metadata.network.threatLevel === 'medium') score += 30;

        return Math.min(score, 100);
    }

    // Helper to calculate risk level
    private static calculateRiskLevel(metadata: any, locationData: any): string {
        const threatScore = this.calculateThreatScore(metadata);

        if (threatScore >= 70) return 'HIGH';
        if (threatScore >= 40) return 'MEDIUM';
        return 'LOW';
    }

    // Helper to check if registration is suspicious
    private static isSuspiciousRegistration(metadata: any, locationData: any): boolean {
        const threatScore = this.calculateThreatScore(metadata);
        return threatScore >= 50 ||
            metadata.network.threatLevel === 'high' ||
            metadata.network.proxyType === 'tor' ||
            metadata.userAgent.device.isBot;
    }

    // Helper to check if verification is required
    private static requiresVerification(metadata: any, locationData: any): boolean {
        const threatScore = this.calculateThreatScore(metadata);
        return threatScore >= 30 ||
            metadata.network.proxyType === 'vpn' ||
            metadata.network.proxyType === 'proxy' ||
            metadata.network.threatLevel === 'medium';
    }








    // Get users with advanced filtering
    static getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Parse and validate query parameters
            const queryValidation = GetUsersQuerySchema.safeParse(req.query);

            if (!queryValidation.success) {
                const errors = queryValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const query = queryValidation.data;

            // If specific ID, email, or phone is provided, fetch single user
            if (query.id || query.email || query.phone) {
                try {
                    let user;

                    if (query.id) {
                        user = await UserService.getUserById(
                            query.id,
                            query.includePassword,
                            query.includeSensitive,
                            query.role
                        );
                    } else if (query.email) {
                        user = await UserService.getUserByEmail(query.email, {
                            includePassword: query.includePassword,
                            includeSensitive: query.includeSensitive,
                            includeRelations: query.includeRelations,
                            includeMFA: query.includeMFA,
                            includeSecurity: query.includeSecurity,
                            includeDevices: query.includeDevices
                        });
                    }

                    const response = createSuccessResponse(
                        { users: user },
                        "User found"
                    );
                    res.status(200).json(response);
                    return;
                } catch (error: any) {
                    if (error.message === "User not found") {
                        const response = createNotFoundResponse('user');
                        res.status(404).json(response);
                        return;
                    }
                    throw error;
                }
            }

            // Build filters
            const filters: UserFilterOptions = {};

            if (query.role) filters.role = query.role;
            if (query.isActive !== undefined) filters.isActive = query.isActive;
            if (query.isVerified !== undefined) filters.isVerified = query.isVerified;
            if (query.isSuspended !== undefined) filters.isSuspended = query.isSuspended;

            if (query.verificationLevel) filters.verificationLevel = query.verificationLevel;
            if (query.minTrustScore !== undefined) filters.minTrustScore = query.minTrustScore;
            if (query.maxTrustScore !== undefined) filters.maxTrustScore = query.maxTrustScore;
            if (query.hasProfile !== undefined) filters.hasProfile = query.hasProfile;
            if (query.search) filters.searchTerm = query.search;

            // Parse date filters if provided
            if (req.query.createdAtFrom) {
                filters.createdAtFrom = new Date(req.query.createdAtFrom as string);
            }
            if (req.query.createdAtTo) {
                filters.createdAtTo = new Date(req.query.createdAtTo as string);
            }

            // Build pagination options
            const pagination: PaginationOptions = {
                page: query.page,
                limit: query.limit,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
            };

            // Get paginated users
            const result = await UserService.getUsers(filters, pagination, query.includeRelations);

            const paginationInfo: PaginationInfo = {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total: result.pagination.total,
                totalPages: result.pagination.totalPages,
                hasMore: result.pagination.hasNext
            };

            const response = createPaginatedResponse(
                result.data,
                paginationInfo,
                'Users retrieved successfully'
            );
            res.status(200).json(response);

        } catch (error: any) {
            logger.error("Error in getUsers:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else if (error.message.includes("validation") || error.message.includes("Validation")) {
                const response = createErrorResponse(
                    error.message,
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }
    // Get user by ID with all relations
    static getUserById = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            logger.warn("sentId", { id })
            const includePassword = req.query.includePassword === 'true';
            const includeSensitive = req.query.includeSensitive === 'true';

            const user = await UserService.getUserById(id, includePassword, includeSensitive);

            const response = createSuccessResponse(
                { user },
                "User retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUserById:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Update user with complete schema
    static updateUser = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            // Validate update data
            const bodyValidation = UpdateUserSchema.safeParse(req.body);
            if (!bodyValidation.success) {
                const errors = bodyValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const updateData = bodyValidation.data;
            const updatedUser = await UserService.updateUser(id, updateData);

            const response = createSuccessResponse(
                { user: updatedUser },
                "User updated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in updateUser:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else if (error.message.includes("already exists")) {
                const response = createConflictResponse(error.message);
                res.status(409).json(response);
            } else if (error.message.includes("validation") || error.message.includes("Validation")) {
                const response = createErrorResponse(
                    [{ code: ErrorCode.VALIDATION_ERROR, message: error.message }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Delete user (soft or permanent)
    static deleteUser = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            const deleteValidation = DeleteUserSchema.safeParse(req.query);
            if (!deleteValidation.success) {
                const errors = deleteValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const { permanent } = deleteValidation.data;

            const result = await UserService.deleteUser(id, permanent);

            const response = createSuccessResponse(
                result,
                permanent ? "User permanently deleted" : "User soft deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deleteUser:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Update user password with security checks
    static updateUserPassword = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            // Validate password data
            const bodyValidation = PasswordUpdateSchema.safeParse(req.body);
            if (!bodyValidation.success) {
                const errors = bodyValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const { currentPassword, newPassword } = bodyValidation.data;

            const result = await UserService.updateUserPassword(
                id,
                newPassword,
                currentPassword
            );

            const response = createSuccessResponse(
                result,
                "Password updated successfully "
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error updating user password:", error);

            if (error.message.includes("required") ||
                error.message.includes("incorrect") ||
                error.message.includes("must be") ||
                error.message.includes("too common") ||
                error.message.includes("locked")) {
                const response = createErrorResponse(
                    [{ code: ErrorCode.VALIDATION_ERROR, message: error.message }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Verify user email
    static verifyUserEmail = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const result = await UserService.verifyUserEmail(id);

            const response = createSuccessResponse(
                result,
                "User email verified successfully"
            );

            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in verifyUserEmail:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else if (error.message.includes("does not have an email")) {
                const response = createErrorResponse(
                    [{ code: ErrorCode.VALIDATION_ERROR, message: error.message }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Verify user phone
    static verifyUserPhone = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const result = await UserService.verifyUserPhone(id);

            const response = createSuccessResponse(
                result,
                "User phone verified successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in verifyUserPhone:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else if (error.message.includes("does not have a phone number")) {
                const response = createErrorResponse(
                    [{ code: ErrorCode.VALIDATION_ERROR, message: error.message }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Update user verification level
    static updateVerificationLevel = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            // Validate verification level
            const bodyValidation = VerificationLevelSchema.safeParse(req.body);
            if (!bodyValidation.success) {
                const errors = bodyValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const { level } = bodyValidation.data;
            const result = await UserService.updateVerificationLevel(id, level);

            const response = createSuccessResponse(
                result,
                `User verification level updated to ${level}`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in updateVerificationLevel:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Search users
    static searchUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            const queryValidation = GetUsersQuerySchema.safeParse(req.query);

            if (!queryValidation.success) {
                const errors = queryValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const query = queryValidation.data;

            if (!query.search) {
                const response = createErrorResponse(
                    [{ code: ErrorCode.VALIDATION_ERROR, message: "Search query is required" }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            // Build filters
            const filters: UserFilterOptions = {};

            if (query.role) filters.role = query.role;
            if (query.isActive !== undefined) filters.isActive = query.isActive;
            if (query.isVerified !== undefined) filters.isVerified = query.isVerified;
            filters.searchTerm = query.search;

            // Build pagination options
            const pagination: PaginationOptions = {
                page: query.page,
                limit: query.limit,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
            };

            // Search users
            const result = await UserService.searchUsers(query.search, filters, pagination);

            const paginationInfo: PaginationInfo = {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total: result.pagination.total,
                totalPages: result.pagination.totalPages,
                hasMore: result.pagination.hasNext
            };

            const response = createPaginatedResponse(
                result.data,
                paginationInfo,
                'Users search results'
            );
            res.status(200).json(response);

        } catch (error: any) {
            logger.error("Error in searchUsers:", error);

            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static validatePassword = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const { password } = req.body;

            // Validate password data
            const passwordValidation = z.object({
                password: z.string().min(1, 'Password is required'),
            }).safeParse({ password });

            if (!passwordValidation.success) {
                const errors = passwordValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const validatedData = passwordValidation.data;

            // Call the service with userId from params
            const result = await UserService.validatePassword(id, validatedData.password);

            // Set response status based on validation result
            if (result.valid) {
                const response = createSuccessResponse(
                    {
                        valid: result.valid,
                        message: result.message
                    },
                    result.message || 'Password validated successfully'
                );
                res.status(200).json(response);
            } else {
                // Determine status code and error code based on error type
                let statusCode = 401; // Default unauthorized
                let errorCode = ErrorCode.UNAUTHORIZED;

                if (result.isLocked) {
                    statusCode = 423; // Locked status
                    errorCode = ErrorCode.RESOURCE_LOCKED;
                } else if (result.message?.includes('does not have a password')) {
                    statusCode = 400; // Bad request
                    errorCode = ErrorCode.VALIDATION_ERROR;
                }

                // Create a clean error response
                const errorResponse = {
                    success: false,
                    message: result.message || 'Password validation failed',
                    data: null,
                    timestamp: new Date().toISOString(),
                    errors: [{
                        code: errorCode,
                        message: result.message || 'Password validation failed',
                        ...(result.attemptsRemaining !== undefined && { attemptsRemaining: result.attemptsRemaining }),
                        ...(result.isLocked && result.unlockedAt && { unlockedAt: result.unlockedAt })
                    }]
                };

                res.status(statusCode).json(errorResponse);
            }
        } catch (error: any) {
            logger.error('Error in validatePassword:', error);
            if (error.message === 'User not found') {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || 'An unexpected error occurred',
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }
    /**
     * Update password history
     */
    static updatePasswordHistory = async (req: Request, res: Response): Promise<void> => {
        // Validate request body first
        const bodyValidation = z.object({
            userId: z.string().cuid('Invalid user ID format'),
            passwordHash: z.string().min(1, 'Password hash is required'),
        }).safeParse(req.body);

        if (!bodyValidation.success) {
            const errors = bodyValidation.error.errors.map(error => ({
                field: error.path.join('.'),
                message: error.message
            }));
            const response = createValidationErrorResponse(errors);
            res.status(400).json(response);
            return;
        }

        try {
            const { userId, passwordHash } = bodyValidation.data;

            // Call the service
            const result = await UserService.updatePasswordHistory(userId, passwordHash);

            const response = createSuccessResponse(
                result,
                'Password history updated successfully'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Error in updatePasswordHistory:', error);

            if (error.message === 'User not found') {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || 'An unexpected error occurred',
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }


    // Get user statistics
    static getUserStatistics = async (req: Request, res: Response): Promise<void> => {
        try {
            const stats = await UserService.getUserStatistics();

            const response = createSuccessResponse(
                stats,
                "User statistics retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUserStatistics:", error);

            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }


    // Toggle user suspension
    static toggleSuspension = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const { suspend, reason, until } = req.body;

            // Validate suspension data
            const suspensionValidation = z.object({
                suspend: z.boolean(),
                reason: z.string().optional(),
                until: z.string().datetime().optional().nullable(),
            }).safeParse({ suspend, reason, until });

            if (!suspensionValidation.success) {
                const errors = suspensionValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const validatedData = suspensionValidation.data;

            const updateData: any = {
                isSuspended: validatedData.suspend,
                suspensionReason: validatedData.reason || null,
                suspendedUntil: validatedData.until ? new Date(validatedData.until) : null
            };

            // If unsuspending, clear suspension fields
            if (!validatedData.suspend) {
                updateData.suspensionReason = null;
                updateData.suspendedUntil = null;
                updateData.unlockedAt = new Date();
            }

            const updatedUser = await UserService.updateUser(id, updateData);

            const response = createSuccessResponse(
                { user: updatedUser },
                validatedData.suspend ? "User suspended successfully" : "User unsuspended successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in toggleSuspension:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Update user role
    static updateUserRole = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const { role } = req.body;

            // Validate role
            if (!Object.values(UserRole).includes(role)) {
                const response = createErrorResponse(
                    [{ code: ErrorCode.VALIDATION_ERROR, message: "Invalid role" }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            const updateData = { role };
            const updatedUser = await UserService.updateUser(id, updateData);

            const response = createSuccessResponse(
                { user: updatedUser },
                `User role updated to ${role}`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in updateUserRole:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Get user activity timeline
    static getUserActivity = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

            const activities = await UserService.getUserActivity(id, limit);

            const response = createSuccessResponse(
                { activities },
                "User activity retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUserActivity:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Export user data (GDPR compliance)
    static exportUserData = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            const exportData = await UserService.exportUserData(id);

            // Set headers for file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="user-data-${id}-${Date.now()}.json"`);

            const response = createSuccessResponse(
                exportData,
                "User data exported successfully"
            );

            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in exportUserData:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Unlock user account
    static unlockUserAccount = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            const updateData = {
                lockedAt: null,
                lockReason: null,
                unlockedAt: new Date(),
                failedLoginAttempts: 0,
            };

            const updatedUser = await UserService.internalUpdateUser(id, updateData);

            const response = createSuccessResponse(
                { user: updatedUser },
                "User account unlocked successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in unlockUserAccount:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Reset user failed login attempts
    static resetFailedLoginAttempts = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;

            const updateData = {
                failedLoginAttempts: 0,
                lastFailedLoginAt: null,
            };

            const updatedUser = await UserService.internalUpdateUser(id, updateData);

            const response = createSuccessResponse(
                { user: updatedUser },
                "Failed login attempts reset successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in resetFailedLoginAttempts:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Bulk update users
    static bulkUpdateUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userIds, updateData } = req.body;

            // Validate input
            const validation = z.object({
                userIds: z.array(z.string().cuid()).min(1).max(100),
                updateData: UpdateUserSchema,
            }).safeParse({ userIds, updateData });

            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const validated = validation.data;

            // Process updates sequentially to handle errors properly
            const results: Array<{ userId: string; success: boolean; error?: string }> = [];

            for (const userId of validated.userIds) {
                try {
                    await UserService.updateUser(userId, validated.updateData);
                    results.push({ userId, success: true });
                } catch (error: any) {
                    results.push({
                        userId,
                        success: false,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failedCount = results.filter(r => !r.success).length;

            const response = createSuccessResponse(
                { results, summary: { total: results.length, success: successCount, failed: failedCount } },
                `Bulk update completed. Success: ${successCount}, Failed: ${failedCount}`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in bulkUpdateUsers:", error);

            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }



    // Increment failed login attempts
    static incrementFailedAttempts = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const { ipAddress } = req.body;

            await UserService.incrementFailedAttempts(id, ipAddress);

            const response = createSuccessResponse(
                {},
                "Failed login attempts incremented"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in incrementFailedAttempts:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    /**
 * Manage login limits endpoint
 */
    static manageLoginLimits = async (req: Request, res: Response): Promise<void> => {
        const bodyValidation = await validateRequestBody(req, {
            userId: 'required|string',
            action: 'required|string|in:increment,reset,check',
            type: 'required|string|in:failed,success',
            ipAddress: 'required|string'
        });
        if (!bodyValidation.isValid) {
            const response = createValidationErrorResponse(bodyValidation.errors);
            res.status(400).json(response);
            return;
        }


        try {
            const data = bodyValidation.data;
            const result = await UserService.manageLoginLimits(data);

            const message = data.action === 'increment'
                ? 'Failed login attempts incremented'
                : data.action === 'reset'
                    ? 'Login attempts reset successfully'
                    : 'Login limit status retrieved';

            const response = createSuccessResponse(result, message);
            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Error in manageLoginLimits controller:', error);

            if (error.message === 'User not found') {
                const response = createErrorResponse(
                    'User not found',
                    ErrorCode.NOT_FOUND
                );
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || 'An unexpected error occurred',
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    };

    // Reset failed login attempts
    static resetFailedAttempts = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            await UserService.resetFailedAttempts(id);

            const response = createSuccessResponse(
                {},
                "Failed login attempts reset successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in resetFailedAttempts:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Lock user account
    static lockAccount = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            // in Future. you can adjust the duration Minutes from the client requestbut for now... its 15 minutes... 

            const { reason, durationMinutes } = req.body;

            // Validate reason
            const validation = z.object({
                reason: z.string().min(1, "Lock reason is required").max(500, "Reason too long")
            }).safeParse({ reason });

            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            await UserService.lockAccount(id, validation.data.reason);

            const response = createSuccessResponse(
                {},
                "Account locked successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in lockAccount:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Unlock user account (immediate)
    static unlockAccount = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            await UserService.unlockAccount(id);

            const response = createSuccessResponse(
                {},
                "Account unlocked successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in unlockAccount:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Check account lock status
    static checkAccountLock = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const lockStatus = await UserService.checkAccountLock(id);

            const response = createSuccessResponse(
                lockStatus,
                "Account lock status retrieved"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in checkAccountLock:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Get account security status
    static getAccountSecurityStatus = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const securityStatus = await UserService.getAccountSecurityStatus(id);

            const response = createSuccessResponse(
                securityStatus,
                "Account security status retrieved"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getAccountSecurityStatus:", error);

            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }



    // controllers/UserController.ts
    static detectLocation = async (req: Request, res: Response): Promise<void> => {
        try {
            // Get IP from request metadata, not from parameters
            let ipAddress: string;

            // METHOD 1: Use your @repo/request-metadata package
            try {
                const metadata = await getAdvancedRequestMetadata(req as any);
                ipAddress = metadata.network.ipAddress || 'unknown';

                // If it's a local IP and we're in development, try external service
                if ((ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'unknown') &&
                    process.env.NODE_ENV === 'development') {
                    const externalIp = await this.getExternalIp();
                    if (externalIp) {
                        ipAddress = externalIp;
                    }
                }
            } catch (metadataError) {
                logger.warn('Failed to get metadata, falling back to request IP:', { metadataError });
                // METHOD 2: Fallback to Express IP
                ipAddress = req.ip || 'unknown';
            }

            // Validate we have a real IP
            if (!ipAddress || ipAddress === 'unknown') {
                const response = createErrorResponse(
                    'Unable to detect IP address',
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            // Validate IP format
            const ipValidation = z.union([
                z.string().ip({ version: 'v4' }),
                z.string().ip({ version: 'v6' })
            ]).safeParse(ipAddress);

            if (!ipValidation.success) {
                // If it's a local IP in development, get external IP
                if (process.env.NODE_ENV === 'development') {
                    try {
                        const externalIp = await this.getExternalIp();
                        if (externalIp) {
                            ipAddress = externalIp;
                        } else {
                            throw new Error('Invalid IP address format');
                        }
                    } catch {
                        const errors = [{
                            field: 'ipAddress',
                            message: 'Invalid IP address format'
                        }];
                        const response = createValidationErrorResponse(errors);
                        res.status(400).json(response);
                        return;
                    }
                } else {
                    const errors = [{
                        field: 'ipAddress',
                        message: 'Invalid IP address format'
                    }];
                    const response = createValidationErrorResponse(errors);
                    res.status(400).json(response);
                    return;
                }
            }

            // Detect location with proper IP
            const locationData = await UserService.detectLocation(ipAddress, req);
            const response = createSuccessResponse(
                locationData,
                'Location detected successfully'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Error in detectLocation:', error);

            // User-friendly error messages
            let errorMessage = error.message;
            let statusCode = 500;
            let errorCode = ErrorCode.INTERNAL_ERROR;

            if (error.message.includes('Unable to detect location for IP')) {
                errorMessage = 'Unable to detect location for the provided IP address';
                statusCode = 404;
                errorCode = ErrorCode.NOT_FOUND;
            } else if (error.message.includes('Invalid IP address format') ||
                error.message.includes('IP address is required')) {
                errorMessage = 'Invalid IP address provided';
                statusCode = 400;
                errorCode = ErrorCode.VALIDATION_ERROR;
            }

            const response = createErrorResponse(errorMessage, errorCode);
            res.status(statusCode).json(response);
        }
    }

    // Helper to get external IP in development
    private static async getExternalIp(): Promise<string | null> {
        if (process.env.NODE_ENV !== 'development') {
            return null;
        }

        try {
            const services = [
                'https://api.ipify.org?format=json',
                'https://api64.ipify.org?format=json',
                'https://api.my-ip.io/ip.json',
            ];

            for (const service of services) {
                try {
                    const response = await fetch(service, {
                        signal: AbortSignal.timeout(2000)
                    });
                    const data = await response.json();
                    if (data.ip && data.ip !== '127.0.0.1') {
                        return data.ip;
                    }
                } catch {
                    continue;
                }
            }
        } catch {
            // Silently fail
        }

        return null;
    }



    // Add this to your UserController
    static detectCurrentLocation = async (req: Request, res: Response): Promise<void> => {
        try {
            // Use middleware to ensure metadata is available
            if (!(req as any).requestMetadata) {
                // Extract metadata on the fly
                const metadata = await getAdvancedRequestMetadata(req as any);
                (req as any).requestMetadata = metadata;
            }

            // Get location data using request
            const locationData = await UserService.detectLocation(undefined, req);

            const response = createSuccessResponse(
                {
                    ...locationData,
                    note: locationData.country === 'Unknown' ?
                        'Location detection may be limited. For better accuracy, ensure proper proxy headers are configured.' :
                        undefined
                },
                'Location detected successfully'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Error in detectCurrentLocation:', error);

            const response = createErrorResponse(
                error.message || 'Unable to detect current location',
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }



    /**
     * Get comprehensive request metadata
     */
    static getRequestMetadata = async (req: Request, res: Response): Promise<void> => {
        try {
            // Get metadata from current request
            const metadata = await UserService.getRequestMetadata(req);

            const response = createSuccessResponse(
                metadata,
                'Request metadata extracted successfully'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Error in getRequestMetadata:', error);

            const response = createErrorResponse(
                error.message || 'An unexpected error occurred',
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }


    /**
     * Check for suspicious activity
     */
    static checkSuspiciousActivity = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId, ipAddress, userAgent, location, deviceId, loginTime, metadata } = req.body;

            // Validate request body
            const bodyValidation = z.object({
                userId: z.string().cuid('Invalid user ID format'),
                ipAddress: z.string().ip('Invalid IP address'),
                userAgent: z.string().min(1, 'User agent is required'),
                location: z.string().optional(),
                deviceId: z.string().optional(),
                loginTime: z.string().datetime().optional(),
                metadata: z.record(z.any()).optional(),
            }).safeParse({ userId, ipAddress, userAgent, location, deviceId, loginTime, metadata });

            if (!bodyValidation.success) {
                const errors = bodyValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const validatedData = bodyValidation.data;

            // Call service
            const result = await UserService.checkSuspiciousActivity({
                ...validatedData,
                loginTime: validatedData.loginTime ? new Date(validatedData.loginTime) : undefined,
            });

            const response = createSuccessResponse(
                result,
                'Suspicious activity check completed'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Error in checkSuspiciousActivity:', error);

            if (error.message === 'User not found') {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || 'An unexpected error occurred',
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    /**
     * Flag suspicious login
     */
    static flagSuspiciousLogin = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId, ipAddress, reason, severity, metadata } = req.body;

            // Validate request body using Zod
            const bodyValidation = z.object({
                userId: z.string().min(1, 'User ID is required'),
                ipAddress: z.string().ip('Invalid IP address'),
                reason: z.string().min(1, 'Reason is required'),
                severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
                    errorMap: () => ({ message: 'Severity must be LOW, MEDIUM, HIGH, or CRITICAL' })
                }),
                metadata: z.object({
                    userAgent: z.string().optional(),
                    location: z.string().optional(),
                    deviceId: z.string().optional(),
                    attemptedAction: z.string().optional(),
                }).catchall(z.any()).optional(),
            }).safeParse({ userId, ipAddress, reason, severity, metadata });

            if (!bodyValidation.success) {
                const errors = bodyValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const validatedData = bodyValidation.data;

            // Call service
            const result = await UserService.flagSuspiciousLogin(validatedData);

            const response = createSuccessResponse(
                result,
                'Suspicious login flagged successfully'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Error in flagSuspiciousLogin controller:', error);

            if (error.message === 'User not found') {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || 'An unexpected error occurred',
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    };

    /**
     * Record login activity
     */
    static recordLoginActivity = async (req: Request, res: Response): Promise<void> => {
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
            } = req.body;

            // Validate request body
            const bodyValidation = z.object({
                userId: z.string().cuid('Invalid user ID format'),
                ipAddress: z.string().ip('Invalid IP address'),
                userAgent: z.string().min(1, 'User agent is required'),
                location: z.string().optional(),
                city: z.string().optional(),
                country: z.string().optional(),
                deviceType: z.string().optional(),
                browser: z.string().optional(),
                os: z.string().optional(),
                success: z.boolean().optional(),
                failureReason: z.string().optional(),
                metadata: z.record(z.any()).optional(),
            }).safeParse({
                userId,
                ipAddress,
                userAgent,
                location,
                city,
                country,
                deviceType,
                browser,
                os,
                failureReason,
                metadata,
            });

            if (!bodyValidation.success) {
                const errors = bodyValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const validatedData = bodyValidation.data;

            // Call service
            const result = await UserService.recordLoginActivity(validatedData);

            const response = createSuccessResponse(
                result,
                'Login activity recorded successfully'
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error('Error in recordLoginActivity:', error);

            if (error.message === 'User not found') {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || 'An unexpected error occurred',
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

}