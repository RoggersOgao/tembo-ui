"use server"

import { signIn } from "@/auth"
import {
  DEVICE,
  MFA,
  RESPONSE,
  SECURITY,
  SUPPORT
} from "@/lib/constants"
import { emailClient } from "@/lib/email.api"
import { DeviceMetadata, LoginSchema } from "@/lib/schemas"
import {
  generateTwoFactorToken,
  generateVerificationToken
} from "@/lib/token"

import { db } from "@repo/database"
import crypto from "crypto"
import { z } from "zod"
import { validateBackupCode } from "./generate-verification-token"
import { userClient } from "./user-actions"
import { AuthError } from "next-auth"

// Store to track pending requests
const pendingRequests = new Map<string, number>()

// Anti-duplicate submission check
async function checkDuplicateSubmission(
  email: string,
  fingerprint: string,
  ttl: number = 2000
): Promise<{ isDuplicate: boolean; requestId: string }> {
  const requestId = `${email}:${fingerprint}:${Date.now()}`
  const key = `${email}:${fingerprint}`

  const now = Date.now()
  const lastRequest = pendingRequests.get(key)

  if (lastRequest && (now - lastRequest) < ttl) {
    return { isDuplicate: true, requestId }
  }

  pendingRequests.set(key, now)

  setTimeout(() => {
    pendingRequests.delete(key)
  }, ttl + 1000)

  return { isDuplicate: false, requestId }
}

// Helper function to hash tokens with SHA256
function hashDeviceToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
    .toLowerCase();
}

// Parse device token from client
function parseDeviceToken(deviceToken?: string | null): {
  deviceId: string;
  challengeId: string;
  method: string;
  expiresAt: string;
} | null {
  if (!deviceToken) {
    console.log('[*] No device token provided');
    return null;
  }

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(deviceToken);
    if (
      typeof parsed.deviceId === 'string' &&
      typeof parsed.challengeId === 'string' &&
      typeof parsed.method === 'string' &&
      typeof parsed.expiresAt === 'string'
    ) {
      console.log(' Valid JSON device token parsed:', {
        deviceId: parsed.deviceId,
        challengeId: parsed.challengeId,
        method: parsed.method,
        expiresAt: parsed.expiresAt
      });
      return {
        deviceId: parsed.deviceId,
        challengeId: parsed.challengeId,
        method: parsed.method,
        expiresAt: parsed.expiresAt,
      };
    } else {
      console.log('[!] JSON device token missing required fields:', parsed);
    }
  } catch (jsonError) {
    console.log('[!] Device token is not JSON, trying legacy format');

    // Legacy format: "deviceId:token"
    if (deviceToken.includes(':')) {
      const [deviceId, ...tokenParts] = deviceToken.split(':');
      const token = tokenParts.join(':');
      if (deviceId && token) {
        console.log(' Legacy device token parsed:', { deviceId });
        return {
          deviceId,
          challengeId: token, // Map legacy token to challengeId
          method: 'legacy', // Default method for legacy tokens
          expiresAt: new Date(Date.now() + DEVICE.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
    }
  }

  console.log('[*] Failed to parse device token:', deviceToken);
  return null;
}

export const loginV2 = async (
  values: z.infer<typeof LoginSchema>,
  callbackUrl?: string | null,
  requestMetadata?: {
    ipAddress?: string
    userAgent?: string
    city?: string
    country?: string
    timezone?: string
    os?: string
    deviceMetadata?: Omit<DeviceMetadata, 'deviceId'>
    deviceToken?: string | null
    requestFingerprint?: string
  }
) => {
  const startTime = Date.now()
  const {
    ipAddress,
    userAgent,
    city,
    country,
    timezone,
    os,
    deviceMetadata,
    deviceToken,
    requestFingerprint = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  } = requestMetadata || {}

  const { email, password, code, backupCode, deviceVerificationCode, mfaDeviceId, rememberDevice } = values

  console.log('[-] Login attempt:', {
    email,
    hasCode: !!code,
    hasBackupCode: !!backupCode,
    hasDeviceCode: !!deviceVerificationCode,
    hasDeviceToken: !!deviceToken,
    mfaDeviceId,
    hasDeviceMetadata: !!deviceMetadata,
    ipAddress,
  });

  console.log("deviceMetadata", deviceMetadata)
  console.log("requestMetadata", requestMetadata)
  console.log("useragent", userAgent)
  console.log("deviceToken received", deviceToken)

  /* 1. DUPLICATE SUBMISSION CHECK  */
  const duplicateCheck = await checkDuplicateSubmission(email, requestFingerprint)

  if (duplicateCheck.isDuplicate) {
    return {
      error: "Request already in progress. Please wait.",
      errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
      metadata: {
        loginTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        requestId: duplicateCheck.requestId,
      }
    }
  }

  try {
    /* 2. RATE LIMITING  */
    const rateLimit = await userClient.checkRateLimit(
      `login:${email}:${ipAddress}`,
      SECURITY.RATE_LIMIT_WINDOW_MS,
      SECURITY.RATE_LIMIT_MAX_ATTEMPTS
    )

    if (rateLimit.exceeded) {
      await userClient.createAuditLog({
        action: "LOGIN_RATE_LIMITED",
        entityType: "USER",
        entityId: email,
        metadata: {
          attempts: rateLimit.attempts,
          remainingTime: rateLimit.remainingTime
        },
        ipAddress,
        userAgent
      })

      return {
        error: "Too many login attempts. Please try again later.",
        errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
        retryAfter: Math.ceil(rateLimit.remainingTime / 1000),
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime,
          attempts: rateLimit.attempts,
        }
      }
    }

    /* 3. USER LOOKUP  */
    const userResponse = await userClient.getUserByEmail(email, {
      includeSecurity: true,
      includeDevices: true,
      includeMFA: true
    })

    if (!userResponse.success || !userResponse.data?.user) {
      await userClient.createAuditLog({
        action: "LOGIN_USER_NOT_FOUND",
        entityType: "USER",
        entityId: email,
        ipAddress,
        userAgent
      })

      return {
        error: "Invalid email or password. Please check your credentials and try again.",
        errorType: RESPONSE.ERROR_TYPES.INVALID_CREDENTIALS,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      }
    }

    const passwordValid = await userClient.validatePassword(userResponse.data.user.id, password);

    if (!passwordValid.success) {
      await userClient.incrementFailedAttempts(userResponse.data.user.id, { ipAddress })

      const loginLimits = await userClient.manageLoginLimits({
        userId: userResponse.data.user.id,
        action: 'increment',
        type: 'failed',
        ipAddress
      })

      await userClient.createAuditLog({
        action: "LOGIN_INVALID_PASSWORD",
        userId: userResponse.data.user.id,
        entityType: "USER",
        metadata: {
          attemptsRemaining: loginLimits.data?.remainingAttempts
        },
        ipAddress,
        userAgent
      })

      if (loginLimits.data?.isLocked) {
        await userClient.sendSecurityAlert({
          userId: userResponse.data.user.id,
          type: "ACCOUNT_LOCKED",
          message: "Account locked due to multiple failed login attempts",
          severity: "HIGH",
          metadata: { ipAddress, attempts: loginLimits.data.currentCount }
        })

        await userClient.lockUserAccount(userResponse.data.user.id, "Too many failed login attempts", SECURITY.ACCOUNT_LOCK_MINUTES)

        return {
          error: "Account locked",
          errorType: RESPONSE.ERROR_TYPES.ACCOUNT_LOCKED,
          message: "Too many failed login attempts. Your account has been locked.",
          instruction: "Please reset your password or contact support.",
          lockDuration: SECURITY.ACCOUNT_LOCK_MINUTES * 60 * 1000,
          metadata: {
            loginTime: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        }
      }

      return {
        error: "Invalid email or password. Please check your credentials and try again.",
        errorType: RESPONSE.ERROR_TYPES.INVALID_CREDENTIALS,
        attemptsRemaining: loginLimits.data?.remainingAttempts,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      }
    }


    const user = userResponse.data.user

    /* 4. ACCOUNT STATUS CHECKS */
    if (!user.isActive) {
      await userClient.createAuditLog({
        action: "LOGIN_ACCOUNT_DEACTIVATED",
        userId: user.id,
        entityType: "USER",
        ipAddress,
        userAgent
      })

      return {
        error: "Your account has been deactivated. Please contact support for assistance.",
        errorType: RESPONSE.ERROR_TYPES.ACCOUNT_DEACTIVATED,
        supportContact: SUPPORT.EMAIL,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      }
    }

    if (user.isSuspended) {
      await userClient.createAuditLog({
        action: "LOGIN_ACCOUNT_SUSPENDED",
        userId: user.id,
        entityType: "USER",
        metadata: { reason: user.suspensionReason },
        ipAddress,
        userAgent
      })

      return {
        error: "Your account has been suspended.",
        errorType: RESPONSE.ERROR_TYPES.ACCOUNT_SUSPENDED,
        message: user.suspensionReason || "Please contact support for more information.",
        supportContact: SUPPORT.EMAIL,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      }
    }

    const lockCheck = await userClient.checkAccountLock(user.id)

    console.log("isLocked", lockCheck)
    if (lockCheck.data?.isLocked) {
      const remainingTime = lockCheck.data?.remainingTime || 0

      await userClient.createAuditLog({
        action: "LOGIN_ACCOUNT_LOCKED",
        userId: user.id,
        entityType: "USER",
        metadata: { remainingTime },
        ipAddress,
        userAgent
      })

      return {
        error: "Account temporarily locked",
        errorType: RESPONSE.ERROR_TYPES.ACCOUNT_LOCKED,
        message: "Your account has been locked due to multiple failed login attempts.",
        instruction: remainingTime > 0
          ? `Please try again in ${Math.ceil(remainingTime / 60000)} minutes or reset your password.`
          : "Please reset your password to unlock your account.",
        retryAfter: remainingTime,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      }
    }

    /* 5. EMAIL VERIFICATION CHECK */
    if (!user.emailVerified) {
      const verificationToken = await generateVerificationToken(email, user.id, { ipAddress, userAgent })

      if (verificationToken?.token) {
        await emailClient.sendVerification(
          user.email!,
          verificationToken.token,
          user.name || 'User',
        )
      }

      await userClient.createAuditLog({
        action: "VERIFICATION_EMAIL_SENT",
        userId: user.id,
        entityType: "USER",
        metadata: {
          triggeredBy: "login_attempt",
          tokenExpiresAt: verificationToken?.expiresAt
        },
        ipAddress,
        userAgent
      })

      return {
        error: "Email verification required",
        errorType: RESPONSE.ERROR_TYPES.EMAIL_NOT_VERIFIED,
        message: "Please verify your email address before signing in.",
        instruction: "Check your inbox for the verification email.",
        canResend: true,
        redirect: `/auth/verify-email?email=${encodeURIComponent(email)}`,
        expiresAt: verificationToken?.expiresAt,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      }
    }

    /* 6. PASSWORD EXPIRY CHECK - Commented out for now */

    /**
     *  DEVICE VERIFICATION CHECK & HANDLING - IMPROVED
     */
    let deviceVerified = false;
    let requiresDeviceVerification = false;
    let backendDeviceId: string | undefined;
    let deviceChallengeData: {
      challengeId: string;
      deviceId: string;
      method: "email" | "sms";
      expiresAt: Date;
    } | undefined;
    let newDeviceData: {
      deviceId: string;
      challengeId: string;
      method: "email" | "sms";
      expiresAt: Date;
      deviceName?: string;
    } | undefined;

    //  Parse and validate device token from client
    const parsedDeviceToken = parseDeviceToken(deviceToken);

    console.log('[-] Device token parsing result:', {
      hasToken: !!deviceToken,
      parsed: !!parsedDeviceToken,
      details: parsedDeviceToken
    });

    if (parsedDeviceToken) {
      try {
        // Check if token has expired
        if (new Date(parsedDeviceToken.expiresAt) < new Date()) {
          console.log('[-] Device token expired');
          requiresDeviceVerification = !!deviceMetadata;

          await userClient.createAuditLog({
            action: "DEVICE_TOKEN_EXPIRED",
            userId: user.id,
            entityType: "USER",
            metadata: {
              deviceId: parsedDeviceToken.deviceId,
              challengeId: parsedDeviceToken.challengeId,
              expiredAt: parsedDeviceToken.expiresAt
            },
            ipAddress,
            userAgent
          });
        } else {
          // Verify device token with database
          console.log('[-] Verifying device token with database:', {
            userId: user.id,
            deviceId: parsedDeviceToken.deviceId,
            challengeId: parsedDeviceToken.challengeId
          });

          const deviceResponse = await userClient.verifyDeviceToken(
            user.id,
            parsedDeviceToken.deviceId,
            parsedDeviceToken.challengeId
          );

          console.log("deviceResponse", deviceResponse)

          if (deviceResponse.success && deviceResponse.data?.device) {
            deviceVerified = true;
            backendDeviceId = deviceResponse.data.device.id;

            console.log(' Device verified from token:', {
              deviceId: backendDeviceId,
              deviceName: deviceResponse.data.device.deviceName,
              trustScore: deviceResponse.data.device.trustScore
            });

            // Update device last seen and trust score
            await userClient.updateDevice(backendDeviceId, {
              lastSeen: true,
              incrementTrustScore: 5
            });

            await userClient.createAuditLog({
              action: "DEVICE_TOKEN_VALIDATED",
              userId: user.id,
              entityType: "USER",
              metadata: {
                deviceId: backendDeviceId,
                deviceName: deviceResponse.data.device.deviceName,
                method: parsedDeviceToken.method,
                trustScore: (deviceResponse.data.device?.trustScore ?? 0) + 5
              },
              ipAddress,
              userAgent
            });
          } else {
            console.log('[*] Device token invalid or device not found');
            requiresDeviceVerification = !!deviceMetadata;
          }
        }
      } catch (error) {
        console.error('[*] Error validating device token:', error);
        requiresDeviceVerification = !!deviceMetadata;
      }
    } else {
      console.log('[-] No valid device token found, requiring device verification');
      requiresDeviceVerification = !!deviceMetadata;
    }

    /**
     * If device is not verified and we have metadata, handle device verification
     */
    if (!deviceVerified && deviceMetadata) {
      requiresDeviceVerification = true;

      // STEP 1: Initiate device verification (no code provided yet)
      if (!deviceVerificationCode) {
        console.log('[-] Initiating device verification');

        // Reuse existing device ID if available, otherwise create new device
        if (parsedDeviceToken?.deviceId && !deviceVerified) {
          backendDeviceId = parsedDeviceToken.deviceId;
          console.log('[-] Reusing device ID:', backendDeviceId);

          // Generate new challenge for the existing device
          const newChallenge = await userClient.registerUserDevice(
            user.id,
            {
              ...deviceMetadata,
              deviceId: backendDeviceId // Pass existing deviceId to reuse it
            } as DeviceMetadata,
            ipAddress
          );

          if (!newChallenge.success || !newChallenge.data?.challenge?.challengeId) {
            console.error('[*] Failed to create new challenge for existing device');
            return {
              error: "Failed to initiate device verification",
              errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
              metadata: {
                loginTime: new Date().toISOString(),
                duration: Date.now() - startTime
              }
            };
          }

          // Set deviceChallengeData for reused device
          deviceChallengeData = {
            challengeId: newChallenge.data.challenge.challengeId,
            deviceId: backendDeviceId,
            method: newChallenge.data.challenge.method as "email" | "sms",
            expiresAt: newChallenge.data.challenge.expiresAt
          };

          console.log(' New challenge created for existing device:', deviceChallengeData);

        } else {
          console.log('[-] Creating new device');

          const newDeviceRegister = await userClient.registerUserDevice(
            user.id,
            { ...deviceMetadata, deviceId: undefined } as DeviceMetadata,
            ipAddress
          );

          if (!newDeviceRegister.success || !newDeviceRegister.data?.deviceId || !newDeviceRegister.data?.challenge?.challengeId) {
            console.error('[*] Failed to register device');
            return {
              error: "Failed to initiate device verification",
              errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
              metadata: {
                loginTime: new Date().toISOString(),
                duration: Date.now() - startTime
              }
            };
          }

          backendDeviceId = newDeviceRegister.data.deviceId;
          console.log("newDeviceRegister", newDeviceRegister)

          // Set deviceChallengeData for new device
          deviceChallengeData = {
            challengeId: newDeviceRegister.data.challenge.challengeId,
            deviceId: backendDeviceId,
            method: newDeviceRegister.data.challenge.method as "email" | "sms",
            expiresAt: newDeviceRegister.data.challenge.expiresAt
          };

          console.log(' New device registered with challenge:', deviceChallengeData);
        }

        // Validate deviceChallengeData before proceeding
        if (!deviceChallengeData || !deviceChallengeData.challengeId || !deviceChallengeData.deviceId) {
          console.error('[*] deviceChallengeData is incomplete:', deviceChallengeData);
          return {
            error: "Failed to create device verification challenge",
            errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
            metadata: {
              loginTime: new Date().toISOString(),
              duration: Date.now() - startTime
            }
          };
        }

        // Create trusted device record
        await userClient.createTrustedDevice(
          user.id,
          backendDeviceId,
          deviceChallengeData.challengeId,
          deviceMetadata?.browser as string,
          {
            deviceType: deviceMetadata?.deviceType,
            os: deviceMetadata?.os,
            ipAddress
          }
        );

        await userClient.createAuditLog({
          action: "DEVICE_VERIFICATION_INITIATED",
          userId: user.id,
          entityType: "USER",
          metadata: {
            deviceId: backendDeviceId,
            challengeId: deviceChallengeData.challengeId,
            method: deviceChallengeData.method,
            expiresAt: deviceChallengeData.expiresAt,
            isReuse: !!parsedDeviceToken?.deviceId
          },
          ipAddress,
          userAgent
        });

        console.log('[-] Returning device verification required response:', {
          deviceId: deviceChallengeData.deviceId,
          challengeId: deviceChallengeData.challengeId,
          method: deviceChallengeData.method,
          expiresAt: deviceChallengeData.expiresAt
        });

        return {
          deviceVerificationRequired: true,
          deviceChallenge: {
            challengeId: deviceChallengeData.challengeId,
            deviceId: deviceChallengeData.deviceId,
            method: deviceChallengeData.method,
            expiresAt: deviceChallengeData.expiresAt
          },
          message: "Please verify this device. Check your email for the verification code.",
          metadata: {
            loginTime: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        };
      }

      // STEP 2: Verify device code (code was provided)
      console.log('[-] Verifying device code');

      const challengeId = mfaDeviceId || deviceChallengeData?.challengeId;

      if (!challengeId) {
        return {
          error: "Missing device verification challenge. Please try logging in again.",
          errorType: RESPONSE.ERROR_TYPES.INVALID_DEVICE_CODE,
          metadata: {
            loginTime: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        };
      }

      const deviceVerificationResult = await userClient.verifyUserDevice(
        user.id,
        challengeId,
        deviceVerificationCode
      );

      // Handle verification failure
      if (!deviceVerificationResult.success || !deviceVerificationResult.data) {
        await userClient.incrementFailedAttempts(user.id, { ipAddress });

        const loginLimits = await userClient.manageLoginLimits({
          userId: user.id,
          action: 'increment',
          type: 'failed',
          ipAddress
        });

        await userClient.createAuditLog({
          action: "DEVICE_VERIFICATION_FAILED",
          userId: user.id,
          entityType: "USER",
          metadata: {
            attemptsRemaining: loginLimits.data?.remainingAttempts,
            error: deviceVerificationResult.message,
            challengeId
          },
          ipAddress,
          userAgent
        });

        return {
          error: deviceVerificationResult.message || "Invalid device verification code",
          errorType: RESPONSE.ERROR_TYPES.INVALID_DEVICE_CODE,
          deviceVerificationRequired: true,
          deviceChallenge: deviceChallengeData ? {
            challengeId: deviceChallengeData.challengeId,
            deviceId: deviceChallengeData.deviceId,
            method: deviceChallengeData.method,
            expiresAt: deviceChallengeData.expiresAt
          } : undefined,
          attemptsRemaining: loginLimits.data?.remainingAttempts || DEVICE.MAX_VERIFICATION_ATTEMPTS - 1,
          message: "Invalid device verification code. Please try again.",
          metadata: {
            loginTime: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        };
      }

      // Verification successful
      deviceVerified = true;
      backendDeviceId = deviceVerificationResult.data.result.deviceId;

      // Prepare newDeviceData with all required fields
      const defaultExpiry = new Date(Date.now() + DEVICE.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      // Get challengeId from multiple possible sources with fallbacks
      const finalChallengeId =
        deviceChallengeData?.challengeId ||
        mfaDeviceId ||
        challengeId || // From the verification step
        crypto.randomUUID(); // Last resort fallback

      newDeviceData = {
        deviceId: backendDeviceId,
        challengeId: finalChallengeId,
        method: (deviceChallengeData?.method ?? "email") as "email" | "sms",
        expiresAt: deviceChallengeData?.expiresAt || defaultExpiry,
        deviceName: deviceVerificationResult.data.result.deviceName ||
          deviceMetadata?.deviceName ||
          `${deviceMetadata?.browser} on ${deviceMetadata?.os}` ||
          "Unknown Device"
      };

      console.log(' Device verified successfully - newDeviceData prepared:', {
        deviceId: newDeviceData.deviceId,
        hasDeviceId: !!newDeviceData.deviceId,
        challengeId: newDeviceData.challengeId,
        hasChallengeId: !!newDeviceData.challengeId,
        method: newDeviceData.method,
        hasMethod: !!newDeviceData.method,
        expiresAt: newDeviceData.expiresAt,
        hasExpiresAt: !!newDeviceData.expiresAt,
        expiresAtType: typeof newDeviceData.expiresAt,
        isValidDate: newDeviceData.expiresAt instanceof Date && !isNaN(newDeviceData.expiresAt.getTime()),
        deviceName: newDeviceData.deviceName
      });

      // Validate all required fields are present
      if (!newDeviceData.deviceId || !newDeviceData.challengeId || !newDeviceData.method || !newDeviceData.expiresAt) {
        console.error('[*] CRITICAL: newDeviceData is missing required fields:', {
          deviceId: newDeviceData.deviceId,
          challengeId: newDeviceData.challengeId,
          method: newDeviceData.method,
          expiresAt: newDeviceData.expiresAt,
          missingFields: [
            !newDeviceData.deviceId && 'deviceId',
            !newDeviceData.challengeId && 'challengeId',
            !newDeviceData.method && 'method',
            !newDeviceData.expiresAt && 'expiresAt'
          ].filter(Boolean)
        });

        await userClient.createAuditLog({
          action: "DEVICE_DATA_INCOMPLETE",
          userId: user.id,
          entityType: "USER",
          metadata: {
            deviceId: newDeviceData.deviceId,
            challengeId: newDeviceData.challengeId,
            method: newDeviceData.method,
            expiresAt: newDeviceData.expiresAt,
            missingFields: [
              !newDeviceData.deviceId && 'deviceId',
              !newDeviceData.challengeId && 'challengeId',
              !newDeviceData.method && 'method',
              !newDeviceData.expiresAt && 'expiresAt'
            ].filter(Boolean)
          },
          ipAddress,
          userAgent
        });
      }

      await userClient.createAuditLog({
        action: "DEVICE_VERIFICATION_SUCCESS",
        userId: user.id,
        entityType: "USER",
        metadata: {
          deviceId: backendDeviceId,
          deviceName: newDeviceData.deviceName,
          trustScore: DEVICE.DEFAULT_TRUST_SCORE + 10,
          expiresAt: newDeviceData.expiresAt
        },
        ipAddress,
        userAgent
      });
    }

    /* 9. MFA CHECK & HANDLING  */
    let mfaVerified = false;
    const requiresMFA = user.isTwoFactorEnabled;

    console.log('[-] MFA check:', {
      requiresMFA,
      hasCode: !!code,
      hasBackupCode: !!backupCode
    });

    if (requiresMFA) {
      // If no MFA code or backup code provided yet
      if (!code && !backupCode) {
        console.log('[-] No MFA code yet - sending code');

        // Generate and send MFA code
        const twoFactorToken = await generateTwoFactorToken(email, { ipAddress, userAgent });

        if (!twoFactorToken?.token) {
          return {
            error: "Unable to generate authentication code",
            errorType: RESPONSE.ERROR_TYPES.MFA_GENERATION_FAILED,
            metadata: {
              loginTime: new Date().toISOString(),
              duration: Date.now() - startTime
            }
          };
        }

        await emailClient.sendTwoFactor(
          user.email!,
          twoFactorToken.token,
          user.name || 'User'
        );

        await userClient.createAuditLog({
          action: "MFA_CODE_SENT",
          userId: user.id,
          entityType: "USER",
          metadata: {
            expiresAt: twoFactorToken.expiresAt,
            attemptsRemaining: twoFactorToken.attemptsRemaining
          },
          ipAddress,
          userAgent
        });

        // Check if we also need device verification
        if (requiresDeviceVerification && !deviceVerified) {
          console.log('[!] Both MFA and device verification required');
          return {
            twoFactor: true,
            mfaRequired: true,
            deviceVerificationRequired: true,
            deviceChallenge: deviceChallengeData,
            mfaMethods: ["EMAIL"],
            backupCodesAvailable: (user.backupCodes?.length || 0) > 0,
            errorType: RESPONSE.ERROR_TYPES.MFA_REQUIRED,
            attemptsRemaining: twoFactorToken.attemptsRemaining,
            expiresAt: twoFactorToken.expiresAt,
            message: "Both MFA and device verification required. Please enter both codes.",
            metadata: {
              loginTime: new Date().toISOString(),
              duration: Date.now() - startTime
            }
          };
        }

        // Return and wait for MFA code only
        return {
          twoFactor: true,
          mfaRequired: true,
          mfaMethods: ["EMAIL"],
          backupCodesAvailable: (user.backupCodes?.length || 0) > 0,
          errorType: RESPONSE.ERROR_TYPES.MFA_REQUIRED,
          attemptsRemaining: twoFactorToken.attemptsRemaining,
          expiresAt: twoFactorToken.expiresAt,
          message: "Please enter the verification code sent to your email.",
          metadata: {
            loginTime: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        };
      }

      // Validate MFA code if provided
      if (code) {
        console.log('[-] Validating MFA code');
        const mfaVerification = await userClient.verifyMFACode("twoFactor", user.id, code, 'email');

        if (!mfaVerification.data?.verified) {
          await userClient.incrementFailedAttempts(user.id, { ipAddress });

          const loginLimits = await userClient.manageLoginLimits({
            userId: user.id,
            action: 'increment',
            type: 'failed',
            ipAddress: ipAddress
          });

          await userClient.createAuditLog({
            action: "MFA_VERIFICATION_FAILED",
            userId: user.id,
            entityType: "USER",
            metadata: {
              attemptsRemaining: loginLimits.data?.remainingAttempts
            },
            ipAddress,
            userAgent
          });

          if (loginLimits.data?.isLocked) {
            await userClient.sendSecurityAlert({
              userId: user.id,
              type: "ACCOUNT_LOCKED",
              message: "Account locked due to multiple failed MFA attempts",
              severity: "HIGH",
              metadata: { ipAddress, attempts: loginLimits.data.currentCount }
            });

            await userClient.lockUserAccount(user.id, "Too many failed MFA attempts", SECURITY.ACCOUNT_LOCK_MINUTES);

            return {
              error: "Account locked",
              errorType: RESPONSE.ERROR_TYPES.ACCOUNT_LOCKED,
              message: "Too many failed authentication attempts. Your account has been locked.",
              instruction: "Please reset your password or contact support.",
              lockDuration: SECURITY.ACCOUNT_LOCK_MINUTES * 60 * 1000,
              metadata: {
                loginTime: new Date().toISOString(),
                duration: Date.now() - startTime
              }
            };
          }

          // Check if we also need device verification
          if (requiresDeviceVerification && !deviceVerified && deviceChallengeData) {
            return {
              error: mfaVerification.message || "Invalid authentication code",
              errorType: RESPONSE.ERROR_TYPES.INVALID_MFA_CODE,
              mfaRequired: true,
              deviceVerificationRequired: true,
              deviceChallenge: deviceChallengeData,
              mfaMethods: ["EMAIL"],
              backupCodesAvailable: (user.backupCodes?.length || 0) > 0,
              attemptsRemaining: loginLimits.data?.remainingAttempts || MFA.MAX_ATTEMPTS - 1,
              message: "Invalid authentication code. Device verification still required.",
              metadata: {
                loginTime: new Date().toISOString(),
                duration: Date.now() - startTime
              }
            };
          }

          return {
            error: mfaVerification.message || "Invalid authentication code",
            errorType: RESPONSE.ERROR_TYPES.INVALID_MFA_CODE,
            mfaRequired: true,
            mfaMethods: ["EMAIL"],
            backupCodesAvailable: (user.backupCodes?.length || 0) > 0,
            attemptsRemaining: loginLimits.data?.remainingAttempts || MFA.MAX_ATTEMPTS - 1,
            message: "Invalid authentication code. Please try again.",
            metadata: {
              loginTime: new Date().toISOString(),
              duration: Date.now() - startTime
            }
          };
        }

        mfaVerified = true;
        console.log(' MFA verified with code');
      }

      // Validate backup code if provided
      if (backupCode) {
        console.log('[-] Validating backup code');
        const backupCodeValid = await validateBackupCode(user.id, backupCode);

        if (!backupCodeValid) {
          await userClient.incrementFailedAttempts(user.id, { ipAddress });

          const loginLimits = await userClient.manageLoginLimits({
            userId: user.id,
            action: 'increment',
            type: 'failed',
            ipAddress
          });

          await userClient.createAuditLog({
            action: "BACKUP_CODE_VERIFICATION_FAILED",
            userId: user.id,
            entityType: "USER",
            metadata: {
              attemptsRemaining: loginLimits.data?.remainingAttempts
            },
            ipAddress,
            userAgent
          });

          if (loginLimits.data?.isLocked) {
            await userClient.sendSecurityAlert({
              userId: user.id,
              type: "ACCOUNT_LOCKED",
              message: "Account locked due to failed backup code attempts",
              severity: "HIGH",
              metadata: { ipAddress, attempts: loginLimits.data.currentCount }
            });

            await userClient.lockUserAccount(user.id, "Failed backup code attempts", SECURITY.ACCOUNT_LOCK_MINUTES);

            return {
              error: "Account locked",
              errorType: RESPONSE.ERROR_TYPES.ACCOUNT_LOCKED,
              message: "Too many failed authentication attempts. Your account has been locked.",
              instruction: "Please reset your password or contact support.",
              lockDuration: SECURITY.ACCOUNT_LOCK_MINUTES * 60 * 1000,
              metadata: {
                loginTime: new Date().toISOString(),
                duration: Date.now() - startTime
              }
            };
          }

          // Check if we also need device verification
          if (requiresDeviceVerification && !deviceVerified && deviceChallengeData) {
            return {
              error: "Invalid backup code",
              errorType: RESPONSE.ERROR_TYPES.INVALID_BACKUP_CODE,
              mfaRequired: true,
              deviceVerificationRequired: true,
              deviceChallenge: deviceChallengeData,
              mfaMethods: ["EMAIL"],
              backupCodesAvailable: (user.backupCodes?.length || 0) > 0,
              attemptsRemaining: loginLimits.data?.remainingAttempts || MFA.MAX_ATTEMPTS - 1,
              message: "Invalid backup code. Device verification still required.",
              metadata: {
                loginTime: new Date().toISOString(),
                duration: Date.now() - startTime
              }
            };
          }

          return {
            error: "Invalid backup code",
            errorType: RESPONSE.ERROR_TYPES.INVALID_BACKUP_CODE,
            mfaRequired: true,
            mfaMethods: ["EMAIL"],
            backupCodesAvailable: (user.backupCodes?.length || 0) > 0,
            attemptsRemaining: loginLimits.data?.remainingAttempts || MFA.MAX_ATTEMPTS - 1,
            message: "Invalid backup code. Please try again.",
            metadata: {
              loginTime: new Date().toISOString(),
              duration: Date.now() - startTime
            }
          };
        }

        mfaVerified = true;
        console.log(' MFA verified with backup code');

        await userClient.createAuditLog({
          action: "BACKUP_CODE_USED",
          userId: user.id,
          entityType: "USER",
          metadata: {
            remainingCodes: (user.backupCodes?.length || 0) - 1
          },
          ipAddress,
          userAgent
        });
      }
    } else {
      // MFA not enabled
      mfaVerified = true;
    }

    /* 10. ALL VERIFICATIONS PASSED - PROCEED WITH LOGIN  */
    console.log(' All verifications passed, proceeding with login');

    if (!deviceVerified || (requiresMFA && !mfaVerified)) {
      return {
        error: "Authentication incomplete. Please complete all required verifications.",
        errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      };
    }

    // Sign in with credentials
    // Instead of letting it throw:
    try {
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case "CredentialsSignin":
            // check why...
            return { error: "Invalid Credentials" };
          default:
            return { error: "Something went wrong" };
        }
      }
      throw error;
    }

    await userClient.resetFailedAttempts(user.id);
    await userClient.manageLoginLimits({
      userId: user.id,
      action: 'reset',
      type: 'success',
      ipAddress
    });

    /* 11. LOCATION DETECTION */
    let locationData = country || city || '';
    if (ipAddress && !locationData) {
      const locationResponse = await userClient.detectLocation(ipAddress);
      if (locationResponse.data) {
        locationData = locationResponse.data.country || locationResponse.data.city || '';
      }
    }

    /* 12. SUSPICIOUS ACTIVITY CHECK */
    const suspiciousActivity = await userClient.checkSuspiciousActivity({
      userId: user.id,
      ipAddress,
      userAgent,
      location: locationData,
      loginTime: new Date(),
      deviceId: backendDeviceId
    });

    /* 13. CREATE SESSION */
    const sessionResponse = await userClient.createSession({
      userId: user.id,
      ipAddress,
      userAgent,
      deviceInfo: {
        deviceId: backendDeviceId,
        deviceType: deviceMetadata?.deviceType || (userAgent?.includes("Mobile") ? "mobile" : "desktop"),
        location: locationData
      },
      mfaVerified: mfaVerified,
      isVerified: deviceVerified
    });

    if (!sessionResponse.data) {
      return {
        error: "Failed to create session",
        errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      };
    }

    const session = sessionResponse.data;

    /* 14. TRUST DEVICE IF REQUESTED */
    if (rememberDevice && backendDeviceId && ipAddress && userAgent && deviceVerified) {
      await userClient.createAuditLog({
        action: "DEVICE_REMEMBERED",
        userId: user.id,
        entityType: "USER",
        metadata: {
          deviceId: backendDeviceId,
          deviceName: newDeviceData?.deviceName,
          trustScore: DEVICE.DEFAULT_TRUST_SCORE + 10
        },
        ipAddress,
        userAgent
      });
    }

    /* 15. RECORD LOGIN ACTIVITY */
    await userClient.recordLoginActivity({
      userId: user.id,
      ipAddress,
      userAgent,
      deviceId: backendDeviceId,
      location: locationData,
      mfaUsed: mfaVerified && requiresMFA,
      success: true,
      sessionId: session.id
    });

    /* 16. HANDLE SUSPICIOUS ACTIVITY */
    if (suspiciousActivity.data?.isSuspicious) {
      const confidence = suspiciousActivity.data.confidence / 100;
      let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

      if (confidence >= 0.8) {
        severity = "CRITICAL";
      } else if (confidence >= 0.6) {
        severity = "HIGH";
      } else if (confidence >= 0.4) {
        severity = "MEDIUM";
      } else {
        severity = "LOW";
      }

      await userClient.flagSuspiciousLogin({
        userId: user.id,
        ipAddress: ipAddress as string,
        reason: suspiciousActivity.data.reason || "Suspicious activity detected",
        severity,
        metadata: {
          userAgent,
          location: locationData,
          deviceId: backendDeviceId,
          confidence: suspiciousActivity.data.confidence,
          recommendations: suspiciousActivity.data.recommendations,
        }
      });

      if (confidence > 0.8) {
        await userClient.lockUserAccount(user.id, "Suspicious activity detected", SECURITY.ACCOUNT_LOCK_MINUTES);

        return {
          error: "Suspicious activity detected",
          errorType: RESPONSE.ERROR_TYPES.SUSPICIOUS_ACTIVITY,
          message: "For security reasons, this login attempt has been blocked.",
          instruction: "Please contact support or try again from a recognized device.",
          supportRequired: true,
          isLocked: true,
          lockDuration: SECURITY.ACCOUNT_LOCK_MINUTES,
          metadata: {
            loginTime: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        };
      }
    }

    /* 17. AUDIT LOG */
    await userClient.createAuditLog({
      action: "LOGIN_SUCCESS",
      userId: user.id,
      entityType: "USER",
      metadata: {
        mfaUsed: mfaVerified && requiresMFA,
        deviceVerified: deviceVerified,
        deviceTrusted: !!backendDeviceId,
        suspiciousActivity: suspiciousActivity.data?.isSuspicious || false,
        loginDuration: Date.now() - startTime,
        location: locationData,
        deviceRemembered: rememberDevice && deviceVerified,
        sessionId: session.id,
        deviceId: backendDeviceId,
        deviceName: newDeviceData?.deviceName
      },
      ipAddress,
      userAgent
    });

    /* 18. SUCCESS RESPONSE */
    return {
      success: true,
      message: "Login successful",
      redirect: callbackUrl || getDefaultRedirect(user.role),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image as string,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        phoneVerifiedAt: user.phoneVerifiedAt,
        session: {
          id: session.id,
          expires: session.expires
        },
      },
      device: newDeviceData,
      security: {
        mfaUsed: !!code || !!backupCode,
        deviceVerified: deviceVerified,
        suspiciousActivity: suspiciousActivity.data?.isSuspicious || false,
        locationChanged: !!locationData,
        newDevice: !!newDeviceData
      },
      metadata: {
        loginTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        ipAddress,
        location: locationData,
        deviceId: backendDeviceId
      },
      errorType: RESPONSE.ERROR_TYPES.SUCCESS
    };

  } catch (error) {
    console.error("Unexpected login error:", error);

    await userClient.createAuditLog({
      action: "LOGIN_UNEXPECTED_ERROR",
      entityType: "USER",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      },
      ipAddress,
      userAgent
    });

    return {
      error: "An unexpected error occurred during login. Please try again.",
      errorType: RESPONSE.ERROR_TYPES.AUTHENTICATION_FAILED,
      supportContact: SUPPORT.EMAIL,
      metadata: {
        loginTime: new Date().toISOString(),
        duration: Date.now() - startTime
      }
    };
  } finally {
    const key = `${email}:${requestFingerprint}`;
    pendingRequests.delete(key);
    // also clean up the duplicate check key format
    pendingRequests.delete(`${email}:${requestFingerprint}`);
  }
}

function getDefaultRedirect(role: string): string {
  const redirects: Record<string, string> = {
    SUPER_ADMIN: "/admin/dashboard",
    ADMIN: "/admin/overview",
    MANAGER: "/manager/dashboard",
    STAFF: "/staff/dashboard",
    DELIVERY: "/delivery/dashboard",
    SUPPLIER: "/supplier/dashboard",
    CUSTOMER: "/",
    SUPPORT: "/support/dashboard",
    VIEWER: "/explore",
  };
  return redirects[role] || "/dashboard";
}
// Helper function to update device last used timestamp
export async function updateDeviceLastUsed(deviceRecordId: string): Promise<void> {
  try {
    await db.trustedDevice.update({
      where: { id: deviceRecordId },
      data: { lastSeen: new Date() }
    });
    console.log('[-] Updated device last used timestamp:', deviceRecordId);
  } catch (error) {
    console.error("Error updating device last used:", error);
  }
}

export const resendVerificationEmailV2 = async (
  email: string,
  metadata?: { ipAddress?: string; userAgent?: string }
) => {
  const rateLimit = await userClient.checkRateLimit(`verification:${email}:${metadata?.ipAddress}`, 5 * 60 * 1000, 3)

  if (rateLimit.exceeded) {
    return {
      error: "Too many verification email requests. Please try again later.",
      errorType: 'AUTHENTICATION_FAILED',
      code: 'RATE_LIMITED',
      retryAfter: Math.ceil(rateLimit.remainingTime / 1000),
      metadata: {
        loginTime: new Date().toISOString(),
        duration: 0
      }
    }
  }

  try {
    const userResponse = await userClient.getUserByEmail(email, { includePassword: false })

    if (!userResponse.success || !userResponse.data?.user) {
      return {
        error: "Account not found. Please check the email address and try again.",
        errorType: 'USER_NOT_FOUND',
        code: 'NOT_FOUND',
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    const user = userResponse.data.user

    if (user.emailVerified) {
      return {
        error: "Email address has already been verified.",
        errorType: 'ALREADY_VERIFIED',
        code: 'INVALID_STATE',
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    const verificationToken = await generateVerificationToken(email, user.id, metadata)

    if (!verificationToken?.token) {
      return {
        error: "Unable to generate verification token. Please try again.",
        errorType: 'TOKEN_GENERATION_FAILED',
        code: 'INTERNAL_ERROR',
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    const emailResult = await emailClient.sendVerification(
      user.email!,
      verificationToken.token,
      user.name || 'User'
    )

    if (!emailResult?.success) {
      return {
        error: "Unable to send verification email. Please try again later.",
        errorType: 'EMAIL_SEND_FAILED',
        code: 'EXTERNAL_SERVICE_ERROR',
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    await userClient.createAuditLog({
      action: "VERIFICATION_EMAIL_RESENT",
      userId: user.id,
      entityType: "USER",
      metadata: {
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        expiresAt: verificationToken.expiresAt
      }
    })

    return {
      success: "Verification email has been sent successfully.",
      expiresAt: verificationToken.expiresAt,
      errorType: 'SUCCESS',
      metadata: {
        loginTime: new Date().toISOString(),
        duration: 0
      }
    }
  } catch (error) {
    console.error("Resend verification error:", error)
    return {
      error: "Unable to process verification request. Please try again later.",
      errorType: 'AUTHENTICATION_FAILED',
      code: 'INTERNAL_ERROR',
      metadata: {
        loginTime: new Date().toISOString(),
        duration: 0
      }
    }
  }
}

export const resendTwoFactorCodeV2 = async (
  email: string,
  method?: "EMAIL" | "SMS",
  metadata?: { ipAddress?: string; userAgent?: string }
) => {
  try {
    const userResponse = await userClient.getUserByEmail(email, { includeMFA: true })

    if (!userResponse.success || !userResponse.data?.user || !userResponse.data.user.isTwoFactorEnabled) {
      return {
        error: "Two-factor authentication is not enabled for this account.",
        errorType: 'MFA_NOT_ENABLED',
        code: 'INVALID_STATE',
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    const user = userResponse.data.user
    const mfaMethods = user.mfaDevices?.map(d => d.type) || []
    const selectedMethod = method || (mfaMethods.includes("EMAIL") ? "EMAIL" : mfaMethods[0])

    if (!selectedMethod) return
    if (!mfaMethods.includes(selectedMethod)) {
      return {
        error: "Requested MFA method is not available for this account.",
        errorType: 'MFA_METHOD_UNAVAILABLE',
        code: 'BAD_REQUEST',
        availableMethods: mfaMethods,
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    let tokenResult = null

    if (selectedMethod === "EMAIL") {
      tokenResult = await generateTwoFactorToken(email, metadata)

      if (tokenResult?.token) {
        await emailClient.sendTwoFactor(
          user.email!,
          tokenResult.token,
          user.name || 'User'
        )
      }
    } else if (selectedMethod === "SMS" && user.phone) {
      tokenResult = {
        token: Math.random().toString().slice(2, 8),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsRemaining: 3
      }
    }

    if (!tokenResult?.token) {
      return {
        error: "Unable to generate authentication code. Please try again.",
        errorType: 'MFA_GENERATION_FAILED',
        code: 'INTERNAL_ERROR',
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    await userClient.createAuditLog({
      action: "MFA_CODE_RESENT",
      userId: user.id,
      entityType: "USER",
      metadata: {
        method: selectedMethod,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        expiresAt: tokenResult.expiresAt,
        attemptsRemaining: tokenResult.attemptsRemaining
      }
    })

    return {
      success: `Authentication code has been sent via ${selectedMethod?.toLowerCase()}.`,
      method: selectedMethod,
      expiresAt: tokenResult.expiresAt,
      attemptsRemaining: tokenResult.attemptsRemaining,
      errorType: 'SUCCESS',
      metadata: {
        loginTime: new Date().toISOString(),
        duration: 0
      }
    }
  } catch (error) {
    console.error("Resend two-factor error:", error)
    return {
      error: "Unable to process two-factor authentication request. Please try again.",
      errorType: 'AUTHENTICATION_FAILED',
      code: 'INTERNAL_ERROR',
      metadata: {
        loginTime: new Date().toISOString(),
        duration: 0
      }
    }
  }
}

export const checkLoginStatusV2 = async (
  email: string,
  metadata?: { ipAddress?: string; deviceId?: string; userAgent?: string }
) => {
  try {
    const userResponse = await userClient.getUserByEmail(email, {
      includeSecurity: true,
      includeDevices: true
    })

    if (!userResponse.success || !userResponse.data?.user) {
      return {
        exists: false,
        errorType: 'USER_NOT_FOUND',
        code: 'NOT_FOUND',
        metadata: {
          loginTime: new Date().toISOString(),
          duration: 0
        }
      }
    }

    const user = userResponse.data.user

    let trustedDevice = false
    if (metadata?.deviceId) {
      const deviceTrustResponse = await userClient.getTrustedDeviceInfo(user.id, metadata.deviceId)
      trustedDevice = deviceTrustResponse.success && !!deviceTrustResponse.data?.device
    }

    return {
      exists: true,
      emailVerified: user.emailVerified,
      mfaEnabled: user.isTwoFactorEnabled,
      mfaMethods: user.mfaDevices?.map(d => d.type) || [],
      accountLocked: !user.isActive,
      accountSuspended: user.isSuspended || false,
      requiresPasswordReset: user.passwordExpiresAt
        ? new Date() > user.passwordExpiresAt
        : false,
      trustedDevice,
      lastLoginIp: user.lastLoginIp,
      failedAttempts: user.failedLoginAttempts || 0,
      errorType: 'SUCCESS',
      metadata: {
        loginTime: new Date().toISOString(),
        duration: 0
      }
    }
  } catch (error) {
    console.error("Check login status error:", error)
    return {
      exists: false,
      errorType: 'AUTHENTICATION_FAILED',
      code: 'DATABASE_ERROR',
      metadata: {
        loginTime: new Date().toISOString(),
        duration: 0
      }
    }
  }
}