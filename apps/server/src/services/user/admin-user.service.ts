

// ─── Service ──────────────────────────────────────────────────────────────────

import { logger } from "@repo/logger";
import { db, Prisma } from "@repo/database";
import bcrypt from "bcrypt";
import { z } from 'zod';
import {
    MFADeviceType,
    SignupSource,
    TwoFactorMethod,
    UserRole,
    Gender,
    IDDocumentType,
    VerificationStatus,
    VerificationMethod,
    ProfileVisibility,
    VerificationLevel,
} from '@repo/database';
import userCacheService from "../../cache/user/user.cache.service";
import { assignDefaultPermissions } from "../../utils/permissions-helper";

const PROFESSIONAL_ROLES = [
    "SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF",
    "DELIVERY", "SUPPLIER", "SUPPORT",
] as const

export const AdminCreateUserSchema = z.object({

    // Core identity
    name: z.string().min(1).max(100),
    email: z.string().email().max(100),
    phone: z.string().min(1).max(20),
    password: z.string()
        .min(8).max(72)
        .regex(/[A-Z]/, "Must contain uppercase")
        .regex(/[a-z]/, "Must contain lowercase")
        .regex(/[0-9]/, "Must contain a number"),

    // Role & access
    role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
    signupSource: z.nativeEnum(SignupSource).default(SignupSource.WEB),
    verificationLevel: z.string().default("BASIC"),
    twoFactorMethod: z.nativeEnum(TwoFactorMethod).default(TwoFactorMethod.EMAIL),

    // Account flags
    isActive: z.boolean().default(true),
    isVerified: z.boolean().default(false),
    isTwoFactorEnabled: z.boolean().default(false),
    isSuspended: z.boolean().default(false),

    // Localisation
    language: z.string().default("en"),
    timezone: z.string().default("Africa/Nairobi"),
    currency: z.string().default("KES"),
    dateFormat: z.string().default("DD/MM/YYYY"),

    // Consent
    termsAccepted: z.boolean(),
    privacyAccepted: z.boolean(),
    dataProcessingConsent: z.boolean(),
    marketingOptIn: z.boolean().default(false),

    // Optional refs
    referrerId: z.string().optional().nullable(),

    // Profile
    profile: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        middleName: z.string().optional().nullable(),
        displayName: z.string().optional().nullable(),
        dateOfBirth: z.string().datetime({ offset: true }).optional().nullable(),
        gender: z.string().optional().nullable(),
        bio: z.string().max(500).optional().nullable(),

        // Contact
        secondaryEmail: z.string().email().optional().nullable(),
        secondaryPhone: z.string().max(20).optional().nullable(),

        // Address
        addressLine1: z.string().max(200).optional().nullable(),
        addressLine2: z.string().max(200).optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        county: z.string().max(100).optional().nullable(),
        postalCode: z.string().max(20).optional().nullable(),
        country: z.string().max(2).default("KE"),

        // Identity document
        idDocumentType: z.string().optional().nullable(),
        idDocumentNumber: z.string().max(50).optional().nullable(),
        idDocumentExpiry: z.string().datetime({ offset: true }).optional().nullable(),
    }),

})
    // ID document required for professional roles
    .refine(d => {
        if ((PROFESSIONAL_ROLES as readonly string[]).includes(d.role)) {
            return !!d.profile.idDocumentNumber?.trim()
        }
        return true
    }, {
        message: "ID document is required for professional roles",
        path: ["profile", "idDocumentNumber"],
    })
    // Address required for delivery
    .refine(d => {
        if (d.role === "DELIVERY") {
            return !!d.profile.addressLine1?.trim()
        }
        return true
    }, {
        message: "Address is required for delivery personnel",
        path: ["profile", "addressLine1"],
    })

export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>
export class AdminUserService {

    static async createUser(data: unknown) {
        logger.info("=== ADMIN USER CREATION START ===");

        // 1. Validate
        const validation = AdminCreateUserSchema.safeParse(data);
        if (!validation.success) {
            const errors = validation.error.errors.map(e => ({
                code: e.code,
                message: e.message,
                path: e.path,
            }));
            logger.error("[*] Validation failed:", { errors });
            throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
        }

        const input = validation.data;

        logger.info(" Validation passed", { email: input.email, role: input.role });

        // 2. Duplicate checks
        const orConditions: Prisma.UserWhereInput[] = [{ email: input.email }];
        if (input.phone) {
            orConditions.push({ phone: input.phone });
        }

        const existingUser = await db.user.findFirst({ where: { OR: orConditions } });
        if (existingUser) {
            throw new Error("User with this email or phone already exists");
        }

        if (input.profile.idDocumentNumber) {
            const existingDoc = await db.profile.findFirst({
                where: { idDocumentNumber: input.profile.idDocumentNumber },
            });
            if (existingDoc) {
                throw new Error("This ID document number is already registered");
            }
        }

        // 3. Hash password
        logger.info("[-] Hashing password...");
        const hashedPassword = await bcrypt.hash(input.password, 12);

        // 4. Build user data — fixed values for admin-created accounts
        const userData: Prisma.UserCreateInput = {
            // Identity
            name: input.name,
            email: input.email,
            phone: input.phone,

            // Security
            password: hashedPassword,
            passwordHashAlgorithm: "bcrypt",
            passwordHistory: [hashedPassword],
            passwordLastChanged: new Date(),
            failedLoginAttempts: 0,
            isLocked: false,

            // 2FA
            isTwoFactorEnabled: input.isTwoFactorEnabled,
            twoFactorMethod: input.twoFactorMethod,
            backupCodes: [],

            // Role & flags
            role: input.role,
            isActive: input.isActive,
            isSuspended: input.isSuspended,

            // Verification
            isVerified: input.isVerified,
            verificationLevel: input.verificationLevel as VerificationLevel,
            emailVerified: input.isVerified ? new Date() : null,

            // Localisation
            language: input.language,
            timezone: input.timezone,
            currency: input.currency,
            dateFormat: input.dateFormat,

            // Fixed values — admin creation is trusted, no risk scoring needed
            trustScore: 100,
            riskLevel: "LOW",
            isSuspiciousRegistration: false,
            requiresVerification: false,
            loginCount: 0,
            lastActiveAt: new Date(),
            trustedIps: [],

            // Consent
            termsAcceptedAt: input.termsAccepted ? new Date() : null,
            termsVersion: "1.0",
            privacyAcceptedAt: input.privacyAccepted ? new Date() : null,
            privacyVersion: "1.0",
            marketingOptIn: input.marketingOptIn,
            dataProcessingConsent: input.dataProcessingConsent,

            // Metadata
            signupSource: input.signupSource,
            referrerId: input.referrerId ?? undefined,
            createdByIp: "admin-dashboard",
        };

        // 5. Transaction: user + profile + permissions + badges + audit
        const newUser = await db.$transaction(async (tx) => {

            const user = await tx.user.create({
                data: userData,
                include: { profile: true },
            });

            logger.info(" User record created", { userId: user.id, role: user.role });

            // Profile
            const profileData: Prisma.ProfileCreateInput = {
                user: { connect: { id: user.id } },

                firstName: input.profile.firstName,
                lastName: input.profile.lastName,
                middleName: input.profile.middleName ?? null,
                displayName: input.profile.displayName ?? null,
                dateOfBirth: input.profile.dateOfBirth ? new Date(input.profile.dateOfBirth) : null,
                gender: input.profile.gender as Gender,
                bio: input.profile.bio ?? null,

                secondaryEmail: input.profile.secondaryEmail ?? null,
                secondaryPhone: input.profile.secondaryPhone ?? null,

                addressLine1: input.profile.addressLine1 ?? null,
                addressLine2: input.profile.addressLine2 ?? null,
                city: input.profile.city ?? null,
                county: input.profile.county ?? null,
                postalCode: input.profile.postalCode ?? null,
                country: input.profile.country,

                idVerificationStatus: VerificationStatus.NOT_VERIFIED as VerificationStatus,
                idDocumentType: input.profile.idDocumentType as IDDocumentType,
                idDocumentNumber: input.profile.idDocumentNumber ?? null,
                idDocumentExpiry: input.profile.idDocumentExpiry
                    ? new Date(input.profile.idDocumentExpiry)
                    : null,

                profileVisibility: "PUBLIC",
                totalOrders: 0,
                totalSpent: 0,
            };

            await tx.profile.create({ data: profileData });
            logger.info(" Profile created");

            // Default permissions
            const permResult = await assignDefaultPermissions(user.id, input.role, tx);
            logger.info(" Permissions assigned", { count: permResult.assigned });
            if (permResult.missing.length > 0) {
                logger.warn("[!] Some permissions not found", { missing: permResult.missing });
            }

            // Welcome badges
            const badgesToAssign = ["new-member"];
            if (input.role === UserRole.SUPPLIER) badgesToAssign.push("verified-supplier");
            if (input.role === UserRole.CUSTOMER) badgesToAssign.push("customer");
            if (input.role === UserRole.DELIVERY) badgesToAssign.push("delivery-partner");
            if (input.role === UserRole.STAFF) badgesToAssign.push("staff-member");
            if (input.role === UserRole.MANAGER) badgesToAssign.push("manager");

            const badges = await tx.badge.findMany({ where: { name: { in: badgesToAssign } } });
            if (badges.length > 0) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { badges: { connect: badges.map(b => ({ id: b.id })) } },
                });
                logger.info(" Badges assigned", { count: badges.length });
            }

            // Audit log
            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: "ADMIN_USER_CREATED",
                    entityType: "USER",
                    entityId: user.id,
                    ipAddress: "admin-dashboard",
                    changes: {
                        role: user.role,
                        email: user.email,
                        phone: user.phone,
                        signupSource: user.signupSource,
                        mfaEnabled: user.isTwoFactorEnabled,
                        createdBy: "admin-dashboard",
                    } as Prisma.InputJsonValue,
                },
            });

            logger.info(" Audit log created");
            return user;
        });

        // 6. Cache
        await userCacheService.invalidateUserLists();

        if (newUser.email) await userCacheService.setUserByEmail(newUser.email, newUser.id);
        if (newUser.phone) await userCacheService.setUserByPhone(newUser.phone, newUser.id);

        const safeUser = await this.getSafeUser(newUser.id);

        logger.info("=== ADMIN USER CREATION END ===", { userId: newUser.id });
        return safeUser;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static async getSafeUser(id: string) {
        return db.user.findUniqueOrThrow({
            where: { id },
            select: {
                id: true,
                uuid: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                isSuspended: true,
                isVerified: true,
                isTwoFactorEnabled: true,
                verificationLevel: true,
                language: true,
                timezone: true,
                currency: true,
                dateFormat: true,
                trustScore: true,
                riskLevel: true,
                signupSource: true,
                createdAt: true,
                updatedAt: true,
                profile: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        idDocumentNumber: true,
                        country: true,
                    },
                },
            },
        });
    }
}