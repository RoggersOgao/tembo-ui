"use server";

import { emailClient } from "@/lib/email.api";
import { isDatabaseError, isNetworkError, isRateLimitError } from "@/lib/error-utils";
import { DeviceMetadata, RegisterSchema, transformRegisterToCreateUser } from "@/lib/schemas";
import { generateVerificationToken } from "@/lib/token";
import { UserClient } from "@/lib/user-client-api";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RegisterResult =
  | {
      success: string;
      requiresVerification?: boolean;
      requiresDeviceVerification?: boolean;
      userId?: string;
      deviceChallenge?: {
        challengeId: string;
        deviceId: string;
        method: "email" | "sms";
      };
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        isVerified: boolean;
      };
      error?: never;
    }
  | {
      error: string;
      code?: ErrorCode;
      fieldErrors?: Record<string, string>;
      retryAfter?: number;
      success?: never;
    };

export enum ErrorCode {
  VALIDATION_FAILED = "VALIDATION_FAILED",
  EMAIL_EXISTS = "EMAIL_EXISTS",
  USER_CREATION_FAILED = "USER_CREATION_FAILED",
  TOKEN_GENERATION_FAILED = "TOKEN_GENERATION_FAILED",
  EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED",
  NETWORK_ERROR = "NETWORK_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  INVALID_ROLE = "INVALID_ROLE",
  DEVICE_REGISTRATION_FAILED = "DEVICE_REGISTRATION_FAILED",
}

interface RegisterOptions {
  skipVerificationEmail?: boolean;
  skipDeviceVerification?: boolean;
  source?: "web" | "mobile" | "api";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN REGISTER ACTION
// ─────────────────────────────────────────────────────────────────────────────

export const register = async (
  values: z.infer<typeof RegisterSchema>,
  requestMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    city?: string;
    timezone?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    deviceMetadata?: DeviceMetadata;
  },
  options: RegisterOptions = {}
): Promise<RegisterResult> => {
  const { skipVerificationEmail = false } = options;

  try {
    const { email, role } = values;

    // ── 1. Block duplicate emails ────────────────────────────────────────────
    let existingUser;
    try {
      existingUser = await UserClient.getByEmail(email, { includePassword: false });
    } catch (dbError) {
      console.error("Database error checking existing user:", dbError);
      if (!isDatabaseError(dbError)) throw dbError;
      return { error: "Database error. Please try again later.", code: ErrorCode.DATABASE_ERROR };
    }

    if (existingUser.success) {
      return { error: "A user with this email already exists.", code: ErrorCode.EMAIL_EXISTS };
    }

    // ── 2. Transform registration data ───────────────────────────────────────
    let createUserData;
    try {
      createUserData = await transformRegisterToCreateUser(values, {
        includeMFADevice: true,
        mfaDeviceType: "EMAIL",
        requestMetadata,
      });
    } catch (transformError) {
      console.error("Data transformation error:", transformError);
      return { error: "Failed to process registration data.", code: ErrorCode.VALIDATION_FAILED };
    }

    // ── 3. Create user (with timeout) ────────────────────────────────────────
    let apiResponse: any;
    try {
      apiResponse = await Promise.race([
        UserClient.create(createUserData),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("User creation timeout")), 10000)
        ),
      ]);
    } catch (userCreationError) {
      return handleUserCreationError(userCreationError);
    }

    // ── 4. Validate API response ─────────────────────────────────────────────
    const createdUser = apiResponse?.data?.user;

    if (!apiResponse?.success || !createdUser?.id) {
      const apiMessage =
        apiResponse?.message || apiResponse?.error || "Failed to create account.";
      const msgLower = apiMessage.toLowerCase();

      if (msgLower.includes("phone")) {
        return {
          error: "A user with this phone number already exists.",
          code: ErrorCode.VALIDATION_FAILED,
        };
      }
      if (msgLower.includes("email")) {
        return {
          error: "A user with this email already exists.",
          code: ErrorCode.EMAIL_EXISTS,
        };
      }
      if (msgLower.includes("supplier") || msgLower.includes("company")) {
        return {
          error: "A supplier with this company name already exists.",
          code: ErrorCode.VALIDATION_FAILED,
        };
      }

      return { error: apiMessage, code: ErrorCode.USER_CREATION_FAILED };
    }

    console.log("User created successfully:", {
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
    });

    const newUserId = createdUser.id as string;
    const userName =
      createUserData.name || `${values.firstName} ${values.lastName}`.trim();

    // ── 5. Skip verification if requested ───────────────────────────────────
    if (skipVerificationEmail) {
      return {
        success: "Account created successfully. Verification email was skipped.",
        requiresVerification: false,
        userId: newUserId,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
          isVerified: createdUser.isVerified,
        },
      };
    }

    // ── 6. Generate verification token ──────────────────────────────────────
    const verificationToken = await generateVerificationTokenWithRetry(
      email,
      newUserId,
      requestMetadata?.ipAddress,
      requestMetadata?.userAgent
    );

    if (!verificationToken) {
      return {
        success:
          "Account created! However, we couldn't generate a verification token. Please use 'Resend verification email'.",
        requiresVerification: true,
        userId: newUserId,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
          isVerified: createdUser.isVerified,
        },
      };
    }

    // ── 7. Send verification email ───────────────────────────────────────────
    try {
      const emailResult = await emailClient.sendVerification(
        email,
        verificationToken,
        userName
      );

      if (!emailResult?.success) {
        console.warn("Email send failed:", emailResult?.error);
        return {
          success:
            "Account created! However, we couldn't send the verification email. Please use 'Resend verification email'.",
          requiresVerification: true,
          userId: newUserId,
          user: {
            id: createdUser.id,
            email: createdUser.email,
            name: createdUser.name,
            role: createdUser.role,
            isVerified: createdUser.isVerified,
          },
        };
      }

      // ── 8. Success ───────────────────────────────────────────────────────
      const successMessage = buildSuccessMessage(role, email);

      return {
        success: successMessage,
        requiresVerification: true,
        userId: newUserId,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
          isVerified: createdUser.isVerified,
        },
      };
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return {
        success:
          "Account created! However, we couldn't send the verification email. Please use 'Resend verification email'.",
        requiresVerification: true,
        userId: newUserId,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
          isVerified: createdUser.isVerified,
        },
      };
    }
  } catch (error) {
    const errorId = Math.random().toString(36).substring(7);
    console.error(`Registration error [${errorId}]:`, {
      message: error instanceof Error ? error.message : "Unknown error",
      email: values.email,
      role: values.role,
      error,
    });
    return handleGeneralError(error, errorId);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Role-specific success message shown after registration.
 */
function buildSuccessMessage(role: string, email: string): string {
  switch (role) {
    case "SUPPLIER":
      return `Supplier account created! Your account is pending verification. Confirmation email sent to ${email}.`;
    case "DELIVERY":
      return `Delivery driver account created! Your account is pending verification. Confirmation email sent to ${email}.`;
    case "CUSTOMER":
    default:
      return `Confirmation email sent to ${email}.`;
  }
}

/**
 * Generate verification token with retry logic (up to maxRetries attempts).
 */
async function generateVerificationTokenWithRetry(
  email: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  maxRetries: number = 2
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await generateVerificationToken(email, userId, {
        ipAddress,
        userAgent,
      });

      if (response?.success && response.token) {
        return response.token;
      }

      console.warn(`Token generation failed (attempt ${attempt}):`, response?.error);
    } catch (error) {
      console.error(`Token generation attempt ${attempt} failed:`, error);
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return null;
}

/**
 * Handle errors thrown during UserClient.create().
 */
function handleUserCreationError(error: unknown): RegisterResult {
  console.error("User creation error:", error);

  if (isNetworkError(error)) {
    return {
      error: "Network error. Please check your connection and try again.",
      code: ErrorCode.NETWORK_ERROR,
    };
  }
  if (isRateLimitError(error)) {
    return {
      error: "Too many registration attempts. Please try again later.",
      code: ErrorCode.RATE_LIMITED,
      retryAfter: 300,
    };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout"))
      return { error: "Request timed out. Please try again.", code: ErrorCode.USER_CREATION_FAILED };
    if (msg.includes("email") && msg.includes("already"))
      return { error: "A user with this email already exists.", code: ErrorCode.EMAIL_EXISTS };
    if (msg.includes("phone") && msg.includes("already"))
      return { error: "A user with this phone number already exists.", code: ErrorCode.VALIDATION_FAILED };
    if (msg.includes("supplier") || msg.includes("company"))
      return { error: "A supplier with this company name already exists.", code: ErrorCode.VALIDATION_FAILED };
    if (msg.includes("password"))
      return { error: "Password requirements not met. Please use a stronger password.", code: ErrorCode.VALIDATION_FAILED };
    if (msg.includes("role"))
      return { error: "Invalid user role specified.", code: ErrorCode.INVALID_ROLE };
  }

  return { error: "Failed to create account. Please try again.", code: ErrorCode.USER_CREATION_FAILED };
}

/**
 * Handle unexpected top-level errors.
 */
function handleGeneralError(error: unknown, errorId: string): RegisterResult {
  if (isDatabaseError(error))
    return { error: "Database error. Please try again later.", code: ErrorCode.DATABASE_ERROR };
  if (isNetworkError(error))
    return { error: "Network error. Please check your connection.", code: ErrorCode.NETWORK_ERROR };
  if (isRateLimitError(error))
    return {
      error: "Too many requests. Please try again in a few minutes.",
      code: ErrorCode.RATE_LIMITED,
      retryAfter: 60,
    };

  return {
    error: `Something went wrong. Reference ID: ${errorId}. Please contact support if this persists.`,
    code: ErrorCode.UNKNOWN_ERROR,
  };
}