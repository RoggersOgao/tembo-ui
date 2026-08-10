import z from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS — aligned with Prisma schema
// ─────────────────────────────────────────────────────────────────────────────

/** Roles available for PUBLIC self-registration only */
export const PUBLIC_REGISTRATION_ROLES = [
  "CUSTOMER",
  "SUPPLIER",
  "DELIVERY",
] as const;

/** Full role list from Prisma UserRole enum (for admin/settings use) */
export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "STAFF",
  "DELIVERY",
  "SUPPLIER",
  "CUSTOMER",
  "SUPPORT",
  "VIEWER",
] as const;

export const Gender = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "PREFER_NOT_TO_SAY",
  "OTHER",
] as const;

export const TwoFactorMethod = ["SMS", "EMAIL", "FIDO2", "TOTP"] as const;

export const SignupSource = [
  "WEB",
  "MOBILE_WEB",
  "IOS",
  "ANDROID",
  "REFERRAL",
  "PARTNER",
  "SOCIAL",
  "MOBILE",
] as const;

export const VerificationLevel = [
  "BASIC",
  "INTERMEDIATE",
  "ADVANCED",
  "VERIFIED",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const kenyanPhoneRegex = /^(?:\+254|254|0)([17])\d{8}$/;

function validateKenyanPhone(
  ctx: z.RefinementCtx,
  phone: string,
  path: string[]
) {
  const normalized = phone.replace(/[\s\-\(\)]/g, "");
  if (!kenyanPhoneRegex.test(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Invalid Kenyan phone number. Use format: +254712345678, 0712345678, or 0112345678",
      path,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — USER REGISTRATION SCHEMA
// Used by UserRegistrationForm (all roles share this step)
//
// RULE: Never use .default() on any field bound to useForm.
// .default() causes Zod to split the type: output = T, input = T | undefined.
// The Resolver generic sees the input type and breaks on fields that are
// required in the output. Fix: always use .optional() in the schema and
// set the actual default value in useForm's defaultValues instead.
// ─────────────────────────────────────────────────────────────────────────────

const BaseUserObject = z.object({
  // Personal
  firstName: z.string().min(1, "First name is required").max(100).trim(),
  lastName: z.string().min(1, "Last name is required").max(100).trim(),

  // Contact
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(255)
    .toLowerCase()
    .trim()
    .refine(
      (email) => {
        const disposable = [
          "tempmail.com",
          "throwaway.com",
          "mailinator.com",
          "guerrillamail.com",
        ];
        const domain = email.split("@")[1];
        return !disposable.some((d) => domain?.includes(d));
      },
      { message: "Disposable email addresses are not allowed" }
    ),

  phoneNumber: z.string().min(1, "Phone number is required").max(20).trim(),

  // Password
  password: z
    .string()
    .min(8, "Minimum 8 characters required")
    .max(100, "Password too long")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[\W_]/, "Must contain at least one special character (e.g. !, @, #, $)"),

  repeatPassword: z.string().min(8, "Minimum 8 characters required"),

  // Legal
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  // ↓ .optional() not .default() — set false in useForm defaultValues
  marketingOptIn: z.boolean().optional(),
  dataProcessingConsent: z.boolean().optional(),

  // Metadata — all .optional(), defaults belong in useForm defaultValues:
  // signupSource: "WEB", language: "en", timezone: "Africa/Nairobi",
  // currency: "KES", dateFormat: "DD/MM/YYYY"
  signupSource: z
    .enum(["WEB", "MOBILE", "REFERRAL", "SOCIAL", "MOBILE_WEB", "IOS", "ANDROID", "PARTNER"])
    .optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  dateFormat: z.string().optional(),
});

export const UserRegistrationSchema = BaseUserObject.superRefine((data, ctx) => {
  if (data.phoneNumber) {
    validateKenyanPhone(ctx, data.phoneNumber, ["phoneNumber"]);
  }

  if (data.password !== data.repeatPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords do not match",
      path: ["repeatPassword"],
    });
  }

  if (!data.termsAccepted) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "You must accept the Terms and Conditions",
      path: ["termsAccepted"],
    });
  }

  if (!data.privacyAccepted) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "You must accept the Privacy Policy",
      path: ["privacyAccepted"],
    });
  }
});

export type UserRegistrationInput = z.infer<typeof UserRegistrationSchema>;




// Company size buckets — purely for lead qualification, never blocks signup
export const COMPANY_SIZE_OPTIONS = [
  { value: "1-10", label: "1–10 people" },
  { value: "11-50", label: "11–50 people" },
  { value: "51-200", label: "51–200 people" },
  { value: "201-1000", label: "201–1000 people" },
  { value: "1000+", label: "1000+ people" },
] as const;

export const WorkspaceSetupSchema = z.object({
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters"),
  workspaceSlug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  isCompany: z.boolean(),
  // Both left as plain (non-optional) strings so empty string = "skipped".
  // Never required, never validated beyond type — pure progressive profiling.
  companySize: z.string(),
  useCase: z.string(),
  dataProcessingConsent: z.boolean().refine((v) => v === true, {
    message: "You must accept data processing terms to continue.",
  }),
});

export type WorkspaceSetupValues = z.infer<typeof WorkspaceSetupSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// FULL REGISTER SCHEMA
// Used by the register() server action — NOT bound to useForm directly,
// so combining step 1 + step 2 data. .optional() is safe here throughout.
// ─────────────────────────────────────────────────────────────────────────────

export const RegisterSchema = BaseUserObject.extend({
  // Version tracking
  termsVersion: z.string().optional(),
  privacyVersion: z.string().optional(),

  // Identity (SUPPLIER + DELIVERY step 2)
  nationalIdNumber: z.string().optional(),

  // Supplier-specific — maps to Prisma Supplier model
  supplier: z
    .object({
      companyName: z.string().min(2),
      contactPerson: z.string().optional(),
      email: z.string().email(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      county: z.string().optional(),
      country: z.string().optional(),
      taxPin: z.string().optional(),
    })
    .optional(),

  // Delivery-specific — stored in Profile / registrationMetadata
  drivingLicenseNumber: z.string().optional(),
  drivingLicenseExpiry: z.string().optional(),
  vehicleRegistration: z.string().optional(),

  // Optional profile fields
  dateOfBirth: z.string().optional().nullable(),
  gender: z
    .enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY", "NON_BINARY"])
    .optional(),
  occupation: z.string().optional(),
  company: z.string().optional(),
  referrerId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.phoneNumber) {
    validateKenyanPhone(ctx, data.phoneNumber, ["phoneNumber"]);
  }

  if (data.password !== data.repeatPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords do not match",
      path: ["repeatPassword"],
    });
  }

  if (!data.termsAccepted) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "You must accept the Terms and Conditions",
      path: ["termsAccepted"],
    });
  }

  if (!data.privacyAccepted) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "You must accept the Privacy Policy",
      path: ["privacyAccepted"],
    });
  }
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORM — RegisterInput → server action payload
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceMetadata {
  deviceName: string;
  browser: string;
  browserVersion?: string;
  os: string;
  osVersion?: string;
  deviceType?: string;
  screenResolution?: string;
  timezone: string;
  language: string;
  fingerprintHash?: string;
}

export async function transformRegisterToCreateUser(
  data: RegisterInput,
  options?: {
    includeMFADevice?: boolean;
    mfaDeviceType?: "TOTP" | "SMS" | "EMAIL";
    requestMetadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceId?: string;
      location?: string;
      city?: string;
      timezone?: string;
      deviceType?: string;
      browser?: string;
      os?: string;
      deviceMetadata?: DeviceMetadata;
    };
  }
): Promise<any> {
  let mfaDevice = undefined;
  if (options?.includeMFADevice && options.mfaDeviceType !== "TOTP") {
    mfaDevice = {
      type: options.mfaDeviceType ?? "EMAIL",
      name: `${options.mfaDeviceType ?? "EMAIL"} Device`,
      isVerified: false,
    };
  }

  const deviceMetadata = options?.requestMetadata?.deviceMetadata;

  return {
    // Core — Prisma User
    name: `${data.firstName} ${data.lastName}`.trim(),
    email: data.email,
    phone: data.phoneNumber,
    password: data.password,

    // Preferences — Prisma User
    isActive: true,
    isSuspended: false,
    isTwoFactorEnabled: false,
    twoFactorMethod: "EMAIL",
    language: data.language ?? "en",
    timezone: data.timezone ?? options?.requestMetadata?.timezone ?? "Africa/Nairobi",
    currency: data.currency ?? "KES",
    dateFormat: data.dateFormat ?? "DD/MM/YYYY",

    // Legal — Prisma User
    termsAccepted: data.termsAccepted,
    termsVersion: data.termsVersion ?? "1.0",
    privacyAccepted: data.privacyAccepted,
    privacyVersion: data.privacyVersion ?? "1.0",
    marketingOptIn: data.marketingOptIn ?? false,
    dataProcessingConsent: data.dataProcessingConsent ?? false,

    // Trust & verification
    isVerified: false,
    verificationLevel: "BASIC",
    signupSource: data.signupSource ?? "WEB",
    referrerId: data.referrerId ?? undefined,
    userAgent: options?.requestMetadata?.userAgent,

    // Device metadata
    deviceMetadata: deviceMetadata
      ? {
          deviceName: deviceMetadata.deviceName,
          browser: deviceMetadata.browser,
          browserVersion: deviceMetadata.browserVersion,
          os: deviceMetadata.os,
          osVersion: deviceMetadata.osVersion,
          deviceType: deviceMetadata.deviceType,
          screenResolution: deviceMetadata.screenResolution,
          timezone: deviceMetadata.timezone,
          language: deviceMetadata.language,
          fingerprintHash: deviceMetadata.fingerprintHash,
        }
      : undefined,

    deviceInfo: options?.requestMetadata
      ? {
          deviceId: options.requestMetadata.deviceId,
          deviceType: options.requestMetadata.deviceType,
          browser: options.requestMetadata.browser,
          os: options.requestMetadata.os,
          ipAddress: options.requestMetadata.ipAddress,
          location: options.requestMetadata.location,
          city: options.requestMetadata.city,
        }
      : undefined,

    createSession: true,
    assignWelcomeBadges: true,
    mfaDevice,

    // Profile — Prisma Profile model
    profile: {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth
        ? new Date(data.dateOfBirth).toISOString()
        : undefined,
      gender: data.gender,
      company: data.company,
      country: "KE",

      // National ID — stored in Prisma Profile.idDocumentNumber
      ...(data.nationalIdNumber
        ? {
            idDocumentType: "NATIONAL_ID",
            idDocumentNumber: data.nationalIdNumber,
            idVerificationStatus: "PENDING",
          }
        : {}),
    },

    // registrationMetadata — Prisma User.registrationMetadata (Json field)
    registrationMetadata: {
      ipAddress: options?.requestMetadata?.ipAddress,
      location: options?.requestMetadata?.location,
      city: options?.requestMetadata?.city,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email({ message: "The email provided is invalid!" }),
  password: z.string().min(8, { message: "Minimum 8 characters required!" }),
  code: z.string(),
  backupCode: z.string(),
  mfaDeviceId: z.string(),
  deviceVerificationCode: z.string(),
  rememberDevice: z.boolean(),
});

export const ResetSchema = z.object({
  email: z.string().email({ message: "The email provided is invalid!" }),
});

export const NewPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Minimum 8 characters required")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[\W_]/, "Must contain at least one special character (e.g. !, @, #, $)"),
    confirmPassword: z
      .string()
      .min(8, "Minimum 8 characters required")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[\W_]/, "Must contain at least one special character (e.g. !, @, #, $)"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/** Admin panel — uses full USER_ROLES enum */
export const SettingsSchema = z
  .object({
    name: z.string().optional(),
    isTwoFactorEnabled: z.boolean().optional(),
    role: z.enum(USER_ROLES),
    email: z.string().min(6).optional(),
    image: z.string().optional(),
    password: z.string().min(6).optional(),
    newPassword: z
      .string()
      .min(8, "Minimum 8 characters required")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[\W_]/, "Must contain at least one special character (e.g. !, @, #, $)")
      .optional(),
  })
  .refine((data) => !(data.password && !data.newPassword), {
    message: "New password is required",
    path: ["newPassword"],
  })
  .refine((data) => !(data.newPassword && !data.password), {
    message: "Old password is required",
    path: ["password"],
  });

/** Profile settings form */
export const settingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;

