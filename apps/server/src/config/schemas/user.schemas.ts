// schemas/user.schemas.ts
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

// ── Reusable helpers ──────────────────────────────────────────

const KenyanPhone = z
    .string()
    .max(20)
    .trim()
    .refine(
        (v) => {
            const n = v.replace(/[\s\-\(\)]/g, '');
            return /^(?:\+254|254|0)([17])\d{8}$/.test(n);
        },
        { message: 'Invalid Kenyan phone number. Use: +254712345678, 0712345678, or 0112345678' }
    );

const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);



//admin createuserschema



// ── Network / device metadata ─────────────────────────────────
// These are stored as JSON blobs on the User at registration time.

const NetworkMetadataSchema = z
    .object({
        ipAddress: z.string().optional(),
        ipVersion: z.enum(['IPv4', 'IPv6', 'unknown']).optional(),
        country: z.string().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        timezone: z.string().optional(),
        isp: z.string().optional(),
        proxyType: z.enum(['none', 'vpn', 'proxy', 'tor', 'hosting', 'unknown']).optional(),
        proxy: z.boolean().optional(),
        vpn: z.boolean().optional(),
        tor: z.boolean().optional(),
        threatLevel: z.enum(['low', 'medium', 'high', 'unknown']).optional(),
        asn: z.string().optional(),
        asnName: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
    })
    .optional();

const UserAgentMetadataSchema = z
    .object({
        raw: z.string().optional(),
        browser: z.object({
            name: z.string().optional(),
            version: z.string().optional(),
        }).optional(),
        os: z.object({
            name: z.string().optional(),
            version: z.string().optional(),
        }).optional(),
        device: z.object({
            type: z.string().optional(),
            vendor: z.string().optional(),
            model: z.string().optional(),
            isBot: z.boolean().optional(),
        }).optional(),
        engine: z.object({
            name: z.string().optional(),
            version: z.string().optional(),
        }).optional(),
        cpu: z.object({
            architecture: z.string().optional(),
        }).optional(),
    })
    .optional();

const DeviceFingerprintSchema = z
    .object({
        userAgent: z.string().optional(),
        deviceType: z.string().optional(),
        isBot: z.boolean().optional(),
        timezone: z.string().optional(),
        language: z.string().optional(),
        screenResolution: z.string().optional(),
        colorDepth: z.number().optional(),
        deviceMemory: z.number().optional(),
        hardwareConcurrency: z.number().optional(),
        touchSupport: z.boolean().optional(),
        cookiesEnabled: z.boolean().optional(),
        doNotTrack: z.boolean().optional(),
        platform: z.string().optional(),
        vendor: z.string().optional(),
        vendorFlavors: z.array(z.string()).optional(),
    })
    .optional();

const SecurityMetadataSchema = z
    .object({
        isTLS: z.boolean().optional(),
        tlsVersion: z.string().optional(),
        cipherSuite: z.string().optional(),
        certificateIssuer: z.string().optional(),
        certificateSubject: z.string().optional(),
        certificateValid: z.boolean().optional(),
        hsts: z.boolean().optional(),
        xFrameOptions: z.string().optional(),
        contentTypeOptions: z.string().optional(),
    })
    .optional();

const RegistrationMetadataSchema = z
    .object({
        requestTime: z.number(),
        timezone: z.string().optional(),
        localTime: z.string().optional(),
        utcOffset: z.number().optional(),
        registrationSource: z.nativeEnum(SignupSource).optional(),
        userAgentAvailable: z.boolean().optional(),
        deviceFingerprintGenerated: z.boolean().optional(),
        pageReferrer: z.string().optional(),
        landingPage: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        utmTerm: z.string().optional(),
        utmContent: z.string().optional(),
    })
    .optional();

// ── CreateUser schema ─────────────────────────────────────────
// Matches User model fields + optional nested profile/mfaDevice.

export const CreateUserSchema = z
    .object({
        // Identity
        name: z.string().max(255).trim().optional(),
        email: z.string().email().max(255).toLowerCase().trim().optional(),
        phone: KenyanPhone.optional(),
        image: z.string().optional(),

        // Password (for non-OAuth flows)
        password: z.string().min(8).max(100).optional(),

        // Role & status
        role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
        isActive: z.boolean().default(true),
        isSuspended: z.boolean().default(false).optional(),
        riskLevel: RiskLevelSchema.default('LOW'),
        isSuspiciousRegistration: z.boolean().default(false),

        // Verification
        emailVerified: z.boolean().default(false),
        phoneVerified: z.boolean().default(false),

        // MFA
        isTwoFactorEnabled: z.boolean().default(false).optional(),
        twoFactorMethod: z.nativeEnum(TwoFactorMethod).default(TwoFactorMethod.EMAIL).optional(),

        // Preferences
        language: z.string().default('en'),
        timezone: z.string().default('Africa/Nairobi'),
        currency: z.string().default('KES'),

        // Legal
        termsAccepted: z.boolean().default(false),
        termsVersion: z.string().optional(),
        privacyAccepted: z.boolean().default(false),
        privacyVersion: z.string().optional(),
        marketingOptIn: z.boolean().default(false),

        // Network & device (stored as JSON)
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
        networkMetadata: NetworkMetadataSchema,
        userAgentMetadata: UserAgentMetadataSchema,
        deviceFingerprint: DeviceFingerprintSchema,
        securityMetadata: SecurityMetadataSchema,
        registrationMetadata: RegistrationMetadataSchema,

        // Advanced tracking
        deviceId: z.string().optional(),
        trustedIps: z.array(z.string()).optional(),
        requiresVerification: z.boolean().optional(),

        // Metadata
        signupSource: z.nativeEnum(SignupSource).optional(),
        referrerId: z.string().cuid().optional().nullable(),
        createdByIp: z.string().optional(),

        // Session on creation
        createSession: z.boolean().default(false).optional(),
        deviceInfo: z.record(z.unknown()).optional(),

        // Welcome badges
        assignWelcomeBadges: z.boolean().default(true).optional(),

        // Verification
        isVerified: z.boolean().default(false).optional(),
        verificationLevel: z.nativeEnum(VerificationLevel).default(VerificationLevel.BASIC).optional(),

        // Permissions
        permissions: z.array(z.string()).optional(),

        // Optional MFA device to register immediately
        mfaDevice: z
            .object({
                name: z.string().optional(),
                type: z.nativeEnum(MFADeviceType),
                secret: z.string().optional(),
                publicKey: z.string().optional(),
                credentialId: z.string().optional(),
                isVerified: z.boolean().optional(),
            })
            .optional(),

        // Nested profile (creates Profile record)
        profile: z
            .object({
                // Personal Information
                firstName: z.string().max(100).trim().optional(),
                lastName: z.string().max(100).trim().optional(),
                displayName: z.string().max(150).trim().optional(),
                dateOfBirth: z.string().datetime().optional().nullable(),
                gender: z.nativeEnum(Gender).optional(),

                // Contact Information
                secondaryEmail: z.string().email().optional(),
                secondaryPhone: z.string().optional(),

                // Address (primary delivery address)
                addressLine1: z.string().max(255).optional(),
                addressLine2: z.string().max(255).optional(),
                city: z.string().max(100).optional(),
                county: z.string().max(100).optional(),
                postalCode: z.string().max(20).optional(),
                country: z.string().length(2).default('KE').optional(),

                // Identity Verification
                idVerificationStatus: z.nativeEnum(VerificationStatus).optional(),
                idVerifiedAt: z.string().datetime().optional().nullable(),
                idVerificationMethod: z.nativeEnum(VerificationMethod).optional(),
                idDocumentType: z.nativeEnum(IDDocumentType).optional(),
                idDocumentNumber: z.string().optional(),
                idDocumentExpiry: z.string().datetime().optional().nullable(),

                // Social
                bio: z.string().max(1000).optional(),
                profileVisibility: z.nativeEnum(ProfileVisibility).default(ProfileVisibility.PUBLIC).optional(),

                // Preferences
                notificationPreferences: z.record(z.unknown()).optional(),
            })
            .optional(),
    })
    .superRefine((data, ctx) => {
        // Require at least one of email or phone
        if (!data.email && !data.phone) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either email or phone must be provided',
                path: ['email'],
            });
        }

        // Validate TOTP device has secret
        if (data.mfaDevice?.type === MFADeviceType.TOTP && !data.mfaDevice.secret) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Secret is required for TOTP MFA device',
                path: ['mfaDevice', 'secret'],
            });
        }

        // Validate FIDO2 device has publicKey + credentialId
        if (data.mfaDevice?.type === MFADeviceType.FIDO2) {
            if (!data.mfaDevice.publicKey || !data.mfaDevice.credentialId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'publicKey and credentialId are required for FIDO2 MFA device',
                    path: ['mfaDevice'],
                });
            }
        }

        // Validate SMS/EMAIL devices don't have secrets
        const noSecretTypes = new Set<MFADeviceType>([
            MFADeviceType.SMS,
            MFADeviceType.EMAIL,
        ]);

        if (data.mfaDevice?.type && noSecretTypes.has(data.mfaDevice.type)) {
            if (data.mfaDevice.secret) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `${data.mfaDevice.type} devices should not have a secret`,
                    path: ['mfaDevice', 'secret'],
                });
            }
        }

        // Block disposable emails
        if (data.email) {
            const disposableDomains = [
                'tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com',
                'sharklasers.com', 'grr.la', 'yopmail.com', 'mailnator.com',
                '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'tempinbox.com'
            ];
            const domain = data.email.split('@')[1] ?? '';
            if (disposableDomains.some((d) => domain.includes(d))) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Disposable email addresses are not allowed',
                    path: ['email'],
                });
            }
        }

        // Validate ID document number format based on document type
        if (data.profile?.idDocumentNumber && data.profile?.idDocumentType) {
            const docType = data.profile.idDocumentType;
            const docNum = data.profile.idDocumentNumber;

            if (docType === IDDocumentType.NATIONAL_ID) {
                // Kenyan National ID format (8 digits)
                if (!/^\d{8}$/.test(docNum)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Kenyan National ID must be 8 digits',
                        path: ['profile', 'idDocumentNumber'],
                    });
                }
            } else if (docType === IDDocumentType.PASSPORT) {
                // Passport format (e.g., A1234567)
                if (!/^[A-Z]\d{7}$/.test(docNum)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Passport number must start with a letter followed by 7 digits',
                        path: ['profile', 'idDocumentNumber'],
                    });
                }
            }
        }

        // Role-specific validation
        const professionalRoles: readonly string[] = [
            UserRole.MANAGER,
            UserRole.STAFF,
            UserRole.DELIVERY,
            UserRole.SUPPLIER,
            UserRole.ADMIN,
            UserRole.SUPPORT
        ];

        if (professionalRoles.includes(data.role) && !data.profile?.idDocumentNumber) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'ID document is required for professional roles',
                path: ['profile', 'idDocumentNumber'],
            });
        }

        if (data.role === UserRole.DELIVERY && !data.profile?.addressLine1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Address is required for delivery personnel',
                path: ['profile', 'addressLine1'],
            });
        }
    });

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ── UpdateUser schema ─────────────────────────────────────────
// Only fields that exist on User and are safe to update directly.
// Email changes go through a dedicated token flow (not here).

export const UserUpdateSchema = z
    .object({
        // Identity
        name: z.string().max(255).trim().optional(),
        phone: KenyanPhone.optional(),
        email: z.string().email().max(255).toLowerCase().trim().optional(),
        image: z.string().url().optional().nullable(),

        // Password
        password: z.string().min(8).max(100).optional(),
        passwordHashAlgorithm: z.string().optional(),

        // MFA
        isTwoFactorEnabled: z.boolean().optional(),
        twoFactorMethod: z.nativeEnum(TwoFactorMethod).optional(),
        twoFactorSecret: z.string().optional().nullable(),
        backupCodes: z.array(z.string()).optional(),

        // Role & status (admin use)
        role: z.nativeEnum(UserRole).optional(),
        isActive: z.boolean().optional(),
        isSuspended: z.boolean().optional(),
        suspendedUntil: z.string().datetime().optional().nullable(),
        suspensionReason: z.string().optional().nullable(),

        // Preferences
        language: z.string().optional(),
        timezone: z.string().optional(),
        currency: z.string().optional(),

        // Activity
        lastActiveAt: z.string().datetime().optional().nullable(),

        // Legal
        termsAcceptedAt: z.string().datetime().optional().nullable(),
        termsVersion: z.string().optional().nullable(),
        privacyAcceptedAt: z.string().datetime().optional().nullable(),
        marketingOptIn: z.boolean().optional(),

        // Risk (admin use)
        riskLevel: RiskLevelSchema.optional(),
        isSuspiciousRegistration: z.boolean().optional(),

        // Verification
        requiresVerification: z.boolean().default(false),
        isVerified: z.boolean().default(false).optional(),
        verificationLevel: z.nativeEnum(VerificationLevel).default(VerificationLevel.BASIC).optional(),

        // Trust & Security
        trustScore: z.number().min(0).max(100).optional(),
        trustedIps: z.array(z.string()).optional(),

        // Profile updates
        profile: z
            .object({
                firstName: z.string().max(100).trim().optional(),
                lastName: z.string().max(100).trim().optional(),
                displayName: z.string().max(150).trim().optional(),
                dateOfBirth: z.string().datetime().optional().nullable(),
                gender: z.nativeEnum(Gender).optional(),
                secondaryEmail: z.string().email().optional(),
                secondaryPhone: z.string().optional(),
                addressLine1: z.string().max(255).optional(),
                addressLine2: z.string().max(255).optional(),
                city: z.string().max(100).optional(),
                county: z.string().max(100).optional(),
                postalCode: z.string().max(20).optional(),
                country: z.string().length(2).optional(),
                bio: z.string().max(1000).optional(),
                profileVisibility: z.nativeEnum(ProfileVisibility).optional(),
                notificationPreferences: z.record(z.unknown()).optional(),

                // Identity verification updates
                idVerificationStatus: z.nativeEnum(VerificationStatus).optional(),
                idVerifiedAt: z.string().datetime().optional().nullable(),
                idVerificationMethod: z.nativeEnum(VerificationMethod).optional(),
                idDocumentType: z.nativeEnum(IDDocumentType).optional(),
                idDocumentNumber: z.string().optional(),
                idDocumentExpiry: z.string().datetime().optional().nullable(),
            })
            .optional(),
    })
    .partial();

export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;

// ── Export metadata types ─────────────────────────────────────

export type NetworkMetadata = z.infer<typeof NetworkMetadataSchema>;
export type UserAgentMetadata = z.infer<typeof UserAgentMetadataSchema>;
export type DeviceFingerprint = z.infer<typeof DeviceFingerprintSchema>;
export type SecurityMetadata = z.infer<typeof SecurityMetadataSchema>;
export type RegistrationMetadata = z.infer<typeof RegistrationMetadataSchema>;

// ── Additional validation schemas for specific use cases ─────

export const EmailVerificationSchema = z.object({
    token: z.string().min(1),
    email: z.string().email(),
});

export const PhoneVerificationSchema = z.object({
    token: z.string().min(1),
    phone: KenyanPhone,
});

export const PasswordResetSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export const InitiatePasswordResetSchema = z.object({
    email: z.string().email().optional(),
    phone: KenyanPhone.optional(),
}).refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
});

export const MFASetupSchema = z.object({
    type: z.nativeEnum(MFADeviceType),
    name: z.string().optional(),
    secret: z.string().optional(),
    code: z.string().optional(),
});

export const MFAVerifySchema = z.object({
    deviceId: z.string(),
    code: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
});

export const UpdateProfileSchema = z.object({
    firstName: z.string().max(100).trim().optional(),
    lastName: z.string().max(100).trim().optional(),
    displayName: z.string().max(150).trim().optional(),
    dateOfBirth: z.string().datetime().optional().nullable(),
    gender: z.nativeEnum(Gender).optional(),
    addressLine1: z.string().max(255).optional(),
    addressLine2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    county: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    bio: z.string().max(1000).optional(),
    profileVisibility: z.nativeEnum(ProfileVisibility).optional(),
});

export type EmailVerificationInput = z.infer<typeof EmailVerificationSchema>;
export type PhoneVerificationInput = z.infer<typeof PhoneVerificationSchema>;
export type PasswordResetInput = z.infer<typeof PasswordResetSchema>;
export type InitiatePasswordResetInput = z.infer<typeof InitiatePasswordResetSchema>;
export type MFASetupInput = z.infer<typeof MFASetupSchema>;
export type MFAVerifyInput = z.infer<typeof MFAVerifySchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;