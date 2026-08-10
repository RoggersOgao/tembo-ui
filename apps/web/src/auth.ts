// auth.ts
import { LoginSchema } from "@/lib/schemas";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@repo/database";
import { Agent, setGlobalDispatcher } from "undici";
import NextAuth, { NextAuthResult, type DefaultSession, type NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import jwt from "jsonwebtoken";
import {
    deleteTwoFactorConfirmation,
    getTwoFactorConfirmationByUserId
} from "./loginActions/generate-verification-token";
import { SECURITY } from "./lib/constants";
import { userClient } from "./loginActions/user-actions";
import { profileApiClient } from "./lib/user/profile.api";
import {
    guarded,
    TimeoutError,
    userServiceCircuit,
    dbCircuit,
} from "@/lib/resilience";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * UserRole mirrors the Prisma schema exactly.
 * Source of truth: schema.prisma enum UserRole
 */
export type UserRole =
    | "SUPER_ADMIN"
    | "ADMIN"
    | "MANAGER"
    | "STAFF"
    | "DELIVERY"
    | "SUPPLIER"
    | "CUSTOMER"
    | "SUPPORT"
    | "VIEWER";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

declare module "next-auth" {
    interface Session {
        user: {
            role: UserRole;
            isTwoFactorEnabled: boolean;
            isOAuth: boolean;
            token: string;
            phoneNumber?: string;
            verificationLevel?: string;
            isVerified?: boolean;
            emailVerified?: Date | null;
            isActive?: boolean;
            isSuspended?: boolean;
            isLocked?: boolean;
            // Supplier-specific
            supplierId?: string;
            provider?: string;
        } & DefaultSession["user"];
    }

    interface User {
        role: UserRole;
        isTwoFactorEnabled: boolean;
        image?: string | null;
        phoneNumber?: string;
        verificationLevel?: string;
        isVerified?: boolean;
        emailVerified?: Date | null;
        isActive?: boolean;
        isSuspended?: boolean;
        isLocked?: boolean;
        supplierId?: string;
        provider?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: UserRole;
        isTwoFactorEnabled?: boolean;
        isOAuth?: boolean;
        userId?: string;
        phoneNumber?: string;
        verificationLevel?: string;
        isVerified?: boolean;
        emailVerified?: Date | null;
        isActive?: boolean;
        isSuspended?: boolean;
        isLocked?: boolean;
        supplierId?: string;
        // Timestamp of last DB sync — used to prevent stale cache
        lastDbSyncAt?: number;
        provider?: string;
        // Set by syncTokenFromDb when an account is found locked/suspended/inactive
        error?: string;
    }
}

// ============================================
// CONSTANTS
// ============================================

/** How often (ms) the JWT callback re-fetches from DB on refetch triggers */
const DB_SYNC_INTERVAL_MS = 60 * 1000; // 1 minute — matches SessionProvider refetchInterval

// ============================================
// RESILIENCE: GLOBAL FETCH TIMEOUT
// ============================================

/**
 * next-auth (stable v5) pins @auth/core to an EXACT version (0.34.3 at time
 * of writing) as a peer dependency. That version doesn't export a public
 * `customFetch` hook (it was added in @auth/core ~0.37+), so we can't bound
 * just Auth.js's internal OAuth token-exchange fetch the way the Auth.js
 * "corporate proxy" guide describes — not without forcing an @auth/core
 * version next-auth wasn't built against, which risks breaking other
 * internals in ways that are hard to predict.
 *
 * Instead, this sets a timeout at the underlying undici dispatcher level.
 * Node's built-in `fetch` (which is what Auth.js, and likely your own code,
 * uses under the hood) is backed by undici — this bounds EVERY outbound
 * fetch in this process, OAuth token exchange included, with one call at
 * module load.
 *
 * Trade-offs vs. the per-provider hook:
 *   + Works regardless of @auth/core's export surface — no version coupling.
 *   + Protects the whole app, not just OAuth — genuinely "enterprise-wide".
 *   - It's global: don't set this too aggressively if some other part of
 *     your app legitimately needs longer-running fetches. Increase the
 *     numbers below or scope a dedicated Agent to that call site instead.
 *   - No built-in retry here (unlike the old customFetch approach) — a
 *     timed-out OAuth attempt just fails fast; the user clicks the sign-in
 *     button again. That's intentional: retrying a token exchange after a
 *     partial timeout risks replaying a single-use auth `code`.
 *   - Only governs requests made via undici/global fetch. If `userClient`
 *     or other internal clients use axios or Node's `http`/`https` modules
 *     directly instead of `fetch`, they won't be covered by this and need
 *     their own timeout config (most HTTP clients expose a `timeout` option).
 *
 * Guarded against being registered more than once under Next.js dev-mode
 * hot-reloading, which can re-evaluate this module repeatedly.
 */
declare global {
    // eslint-disable-next-line no-var
    var __undiciDispatcherConfigured: boolean | undefined;
}

if (!global.__undiciDispatcherConfigured) {
    setGlobalDispatcher(
        new Agent({
            connectTimeout: 5_000, // time to establish the TCP+TLS connection
            headersTimeout: 8_000, // time to receive response headers once sent
            bodyTimeout: 8_000, // time to receive the full response body
        })
    );
    global.__undiciDispatcherConfigured = true;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Fetch role-specific data based on user role.
 * Roles align with schema.prisma enum UserRole.
 *
 * Fail-soft: any timeout/circuit-open/network error here is swallowed and
 * results in missing phoneNumber/supplierId rather than a blocked sign-in.
 * That's the right tradeoff — a missing phone number is recoverable on the
 * next sync; a blocked login is not.
 */
async function fetchRoleSpecificData(
    userId: string,
    role: UserRole
): Promise<{
    phoneNumber?: string;
    supplierId?: string;
}> {
    try {
        const roleData: {
            phoneNumber?: string;
            supplierId?: string;
        } = {};

        switch (role) {
            // Roles that need phone number from User record
            case "ADMIN":
            case "MANAGER":
            case "STAFF":
            case "DELIVERY":
            case "SUPPORT":
            case "CUSTOMER":
            case "VIEWER": {
                const userResponse = await guarded(
                    userServiceCircuit,
                    () => userClient.getUserById(userId),
                    { label: "fetchRoleSpecificData:getUserById", timeoutMs: 4000, retries: 1 }
                );
                const user = userResponse.success ? userResponse.data?.user : null;
                if (user?.phone) roleData.phoneNumber = user.phone;
                break;
            }

            // SUPPLIER — phone + supplierId from the Supplier relation
            case "SUPPLIER": {
                const userResponse = await guarded(
                    userServiceCircuit,
                    () => userClient.getUserById(userId),
                    { label: "fetchRoleSpecificData:getUserById", timeoutMs: 4000, retries: 1 }
                );
                const user = userResponse.success ? userResponse.data?.user : null;
                if (user?.phone) roleData.phoneNumber = user.phone;

                // Fetch supplierId directly from Prisma
                const supplier = await guarded(
                    dbCircuit,
                    () => db.supplier.findUnique({ where: { userId }, select: { id: true } }),
                    { label: "fetchRoleSpecificData:supplierLookup", timeoutMs: 4000, retries: 1 }
                );
                if (supplier?.id) roleData.supplierId = supplier.id;
                break;
            }

            // SUPER_ADMIN — no extra data needed
            case "SUPER_ADMIN":
                break;

            default:
                console.warn(`[!] Unknown role: ${role}`);
        }

        return roleData;
    } catch (error) {
        console.error(`  Error fetching role-specific data for ${role}:`, error);
        return {};
    }
}

/**
 * Auto-create a profile for OAuth users if one doesn't exist yet.
 * Safe to call on every OAuth sign-in — it checks first before creating.
 *
 * Note: the create call below uses retries: 0 deliberately. Retrying a
 * "create profile" POST after a timeout risks creating a duplicate profile
 * if the original request actually succeeded server-side — the existence
 * check at the top of this function is the safeguard for *next* sign-in,
 * not for an in-flight retry.
 */
async function ensureProfileExists(user: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}): Promise<void> {
    if (!user.id) return;
    const userId = user.id;

    try {
        // Check if profile already exists
        const existing = await guarded(
            dbCircuit,
            () => db.profile.findUnique({ where: { userId }, select: { id: true } }),
            { label: "ensureProfileExists:lookup", timeoutMs: 4000, retries: 1 }
        );

        if (existing) {
            console.log("  OAuth profile already exists for:", userId);
            return;
        }

        // Parse name into first/last if possible
        const nameParts = (user.name ?? "").trim().split(/\s+/);
        const firstName = nameParts[0] ?? null;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

        await guarded(
            userServiceCircuit,
            () =>
                profileApiClient.createProfile({
                    userId: user.id!,
                    firstName: firstName ?? undefined,
                    lastName: lastName ?? undefined,
                    displayName: user.name ?? undefined,
                }),
            { label: "ensureProfileExists:create", timeoutMs: 6000, retries: 0 }
        );

        console.log("  Auto-created profile for OAuth user:", user.id);
    } catch (error) {
        // Log but don't throw — a missing profile shouldn't block sign-in
        console.error("  Failed to auto-create profile for OAuth user:", user.id, error);
    }
}

/**
 * Generate JWT token for session consumption by API routes / middleware.
 * Pure/local — no network call, nothing to harden here.
 */
function generateSessionToken(payload: {
    userId: string;
    email: string;
    role: UserRole;
    phoneNumber?: string;
    supplierId?: string;
    verificationLevel?: string;
    isVerified?: boolean;
    iat?: number;
}): string {
    return jwt.sign(payload, JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: "24h",
    });
}

/**
 * Fetch the latest user state directly from DB and return a fully-populated
 * token update. Called on every refetch interval trigger to guarantee
 * the session reflects live DB data — NOT localStorage / cached JWT.
 *
 * Fail-soft: on a transient error we return the token UNCHANGED, and
 * deliberately do NOT bump lastDbSyncAt — so the next periodic tick retries
 * soon instead of waiting a full DB_SYNC_INTERVAL_MS. A flaky network
 * should delay re-validation, not sign anyone out.
 */
async function syncTokenFromDb(token: JWT): Promise<JWT> {
    if (!token.sub) return token;

    try {
        // ── 1. Fetch live user from DB ──────────────────────────────────────
        const userResponse = await guarded(
            userServiceCircuit,
            () => userClient.getUserById(token.sub!),
            { label: "syncTokenFromDb:getUserById", timeoutMs: 5000, retries: 1 }
        );

        if (!userResponse.success || !userResponse.data?.user) {
            console.warn(`syncTokenFromDb: user ${token.sub} not found — keeping existing token`);
            // Return token unchanged rather than invalidating — transient failures
            // shouldn't sign the user out. A truly deleted/locked account will be
            // caught on the next explicit update() trigger or sign-in attempt.
            return { ...token, lastDbSyncAt: Date.now() };
        }

        const user = userResponse.data.user;

        // ── 2. If account is locked / suspended / inactive → force sign-out ─
        if (user.isLocked || user.isSuspended || !user.isActive) {
            console.warn(`[!] syncTokenFromDb: user ${token.sub} is locked/suspended/inactive`);
            return { ...token, error: "AccountInvalid" };
        }

        // ── 3. Check OAuth status ───────────────────────────────────────────
        const existingAccount = await guarded(
            dbCircuit,
            () => db.account.findFirst({ where: { userId: user.id }, select: { id: true } }),
            { label: "syncTokenFromDb:accountLookup", timeoutMs: 4000, retries: 1 }
        );

        // ── 4. Fetch role-specific extras ───────────────────────────────────
        const roleData = await fetchRoleSpecificData(user.id, user.role as UserRole);

        // ── 5. Rebuild token from fresh DB values ───────────────────────────
        return {
            ...token,
            role: user.role as UserRole,
            email: user.email,
            name: user.name,
            picture: user.image,
            isTwoFactorEnabled: user.isTwoFactorEnabled,
            isVerified: user.isVerified,
            verificationLevel: user.verificationLevel,
            emailVerified: user.emailVerified ?? null,
            isOAuth: !!existingAccount,
            isActive: user.isActive,
            isSuspended: user.isSuspended,
            isLocked: user.isLocked ?? false,
            phoneNumber: roleData.phoneNumber,
            supplierId: roleData.supplierId,
            lastDbSyncAt: Date.now(),
        };
    } catch (error) {
        console.error("  syncTokenFromDb error:", error);
        // Return token unchanged on transient errors — don't invalidate session
        return token;
    }
}

// ============================================
// NEXTAUTH CONFIGURATION
// ============================================

const authConfig: NextAuthConfig = {
    adapter: PrismaAdapter(db) as Adapter,
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
    providers: [
        Google({
            allowDangerousEmailAccountLinking: true,
        }),
        GitHub({
            allowDangerousEmailAccountLinking: true,
        }),
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                try {
                    console.log("=== AUTHORIZE CALLBACK START ===");
                    const startTime = Date.now();

                    const validatedFields = LoginSchema.safeParse(credentials);

                    if (!validatedFields.success) {
                        console.error("  Validation failed:", validatedFields.error);
                        return null;
                    }

                    const { email, password } = validatedFields.data;
                    console.log("  Credentials validated for:", email);

                    // Metadata is nice-to-have for audit logs, not auth-critical —
                    // don't let a slow/failed metadata call block the whole login.
                    let ipAddress: string | undefined;
                    let userAgent: string | undefined;
                    try {
                        const metadataResponse = await guarded(
                            userServiceCircuit,
                            () => userClient.getRequestMetadata(),
                            { label: "authorize:getRequestMetadata", timeoutMs: 3000, retries: 1 }
                        );
                        ipAddress = metadataResponse.data?.ipAddress;
                        userAgent = metadataResponse.data?.metadata?.userAgent as string | undefined;
                    } catch (error) {
                        console.warn("[!] Could not fetch request metadata, continuing without it:", error);
                    }

                    const userResponse = await guarded(
                        userServiceCircuit,
                        () =>
                            userClient.getUserByEmail(email, {
                                includePassword: true,
                                includeSecurity: true,
                                includeMFA: true,
                            }),
                        { label: "authorize:getUserByEmail", timeoutMs: 5000, retries: 1 }
                    );

                    if (!userResponse.success || !userResponse.data?.user) {
                        console.error("  User not found");
                        return null;
                    }

                    const user = userResponse.data.user;

                    if (!user.password) {
                        console.error("  User has no password (OAuth account)");
                        return null;
                    }

                    if (!user.emailVerified) {
                        console.error("  Email not verified");
                        return null;
                    }

                    if (user.isLocked) {
                        console.error("🔒 Account is locked");
                        await guarded(
                            userServiceCircuit,
                            () =>
                                userClient.createAuditLog({
                                    action: "LOGIN_ATTEMPT_LOCKED_ACCOUNT",
                                    userId: user.id,
                                    entityType: "USER",
                                    metadata: { reason: user.lockReason },
                                    ipAddress,
                                    userAgent,
                                }),
                            { label: "authorize:auditLog:locked", timeoutMs: 3000, retries: 0 }
                        ).catch((error) => console.error("[!] Audit log failed (non-blocking):", error));
                        return null;
                    }

                    if (user.isSuspended) {
                        console.error("🚫 Account is suspended");
                        await guarded(
                            userServiceCircuit,
                            () =>
                                userClient.createAuditLog({
                                    action: "LOGIN_ATTEMPT_SUSPENDED_ACCOUNT",
                                    userId: user.id,
                                    entityType: "USER",
                                    metadata: { reason: user.suspensionReason },
                                    ipAddress,
                                    userAgent,
                                }),
                            { label: "authorize:auditLog:suspended", timeoutMs: 3000, retries: 0 }
                        ).catch((error) => console.error("[!] Audit log failed (non-blocking):", error));
                        return null;
                    }

                    if (!user.isActive) {
                        console.error("  Account is not active");
                        return null;
                    }

                    console.log("[-] Validating password...");
                    // retries: 0 — never replay a password check against a
                    // mutating/rate-limited downstream just because it was slow.
                    const passwordValidation = await guarded(
                        userServiceCircuit,
                        () => userClient.validatePassword(user.id, password),
                        { label: "authorize:validatePassword", timeoutMs: 5000, retries: 0 }
                    );

                    if (!passwordValidation.data?.valid) {
                        console.error("  Password validation failed");

                        // retries: 0 — this increments a counter; retrying risks
                        // double-counting a failed attempt.
                        let loginLimits: Awaited<ReturnType<typeof userClient.manageLoginLimits>> | undefined;
                        try {
                            loginLimits = await guarded(
                                userServiceCircuit,
                                () =>
                                    userClient.manageLoginLimits({
                                        userId: user.id,
                                        action: "increment",
                                        type: "failed",
                                        ipAddress,
                                    }),
                                { label: "authorize:manageLoginLimits", timeoutMs: 4000, retries: 0 }
                            );
                        } catch (error) {
                            // Fail-soft: if we can't update the counter, treat this
                            // attempt as "not locked" rather than blocking login over
                            // an infra hiccup. The account-lock check below already
                            // requires loginLimits to have succeeded with isLocked=true.
                            console.error("[!] Could not update login limits (non-blocking):", error);
                        }

                        if (loginLimits?.data?.isLocked) {
                            console.error("🔒 Account locked due to too many failed attempts");
                            const attempts = loginLimits.data.currentCount;

                            await guarded(
                                userServiceCircuit,
                                () =>
                                    userClient.sendSecurityAlert({
                                        userId: user.id,
                                        type: "ACCOUNT_LOCKED",
                                        message: "Account locked due to multiple failed login attempts",
                                        severity: "HIGH",
                                        metadata: { ipAddress, attempts },
                                    }),
                                { label: "authorize:sendSecurityAlert", timeoutMs: 4000, retries: 0 }
                            ).catch((error) => console.error("[!] Security alert failed (non-blocking):", error));

                            await guarded(
                                userServiceCircuit,
                                () =>
                                    userClient.lockUserAccount(
                                        user.id,
                                        "Too many failed login attempts",
                                        SECURITY.ACCOUNT_LOCK_MINUTES
                                    ),
                                { label: "authorize:lockUserAccount", timeoutMs: 4000, retries: 0 }
                            ).catch((error) =>
                                console.error("🔥 Failed to lock account after repeated failures:", error)
                            );

                            await guarded(
                                userServiceCircuit,
                                () =>
                                    userClient.createAuditLog({
                                        action: "LOGIN_ACCOUNT_LOCKED",
                                        userId: user.id,
                                        entityType: "USER",
                                        metadata: {
                                            reason: "Too many failed login attempts",
                                            attempts,
                                            lockDurationMinutes: SECURITY.ACCOUNT_LOCK_MINUTES,
                                        },
                                        ipAddress,
                                        userAgent,
                                    }),
                                { label: "authorize:auditLog:accountLocked", timeoutMs: 3000, retries: 0 }
                            ).catch((error) => console.error("[!] Audit log failed (non-blocking):", error));

                            return null;
                        }

                        console.error(
                            `  Invalid password - Attempt ${loginLimits?.data?.currentCount || 1} of ${SECURITY.MAX_FAILED_ATTEMPTS}`
                        );

                        await guarded(
                            userServiceCircuit,
                            () =>
                                userClient.createAuditLog({
                                    action: "LOGIN_INVALID_PASSWORD",
                                    userId: user.id,
                                    entityType: "USER",
                                    metadata: {
                                        attemptsRemaining: loginLimits?.data?.remainingAttempts,
                                        currentCount: loginLimits?.data?.currentCount,
                                    },
                                    ipAddress,
                                    userAgent,
                                }),
                            { label: "authorize:auditLog:invalidPassword", timeoutMs: 3000, retries: 0 }
                        ).catch((error) => console.error("[!] Audit log failed (non-blocking):", error));

                        return null;
                    }

                    console.log("  Password verified successfully");

                    if (user.isTwoFactorEnabled) {
                        console.log("[-] 2FA is enabled, checking confirmation...");

                        const res = await guarded(
                            dbCircuit,
                            () => getTwoFactorConfirmationByUserId(user.id),
                            { label: "authorize:get2FAConfirmation", timeoutMs: 4000, retries: 1 }
                        );
                        const twoFactorConfirmation = res?.data?.confirmation;

                        if (!twoFactorConfirmation) {
                            console.error("  2FA confirmation required but not found");
                            return null;
                        }

                        console.log("  2FA confirmation verified");
                    }

                    const authorizedUser = {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        role: user.role as UserRole,
                        isTwoFactorEnabled: user.isTwoFactorEnabled,
                        emailVerified: user.emailVerified,
                        isVerified: user.isVerified,
                        verificationLevel: user.verificationLevel,
                        isActive: user.isActive,
                        isSuspended: user.isSuspended,
                        isLocked: user.isLocked ?? false,
                    };

                    console.log("  Authorization successful");
                    console.log(`⏱️ Duration: ${Date.now() - startTime}ms`);
                    console.log("=== AUTHORIZE CALLBACK END ===");

                    return authorizedUser;
                } catch (error) {
                    if (error instanceof TimeoutError) {
                        // Distinct log signature from a real "invalid credentials" —
                        // wire this into your alerting so infra blips don't get
                        // mistaken for a spike in failed login attempts.
                        console.error("⏱️ Authorization timed out — likely infra/network, not bad credentials:", error.message);
                    } else {
                        console.error("  Authorization error:", error);
                    }
                    console.error("Stack:", error instanceof Error ? error.stack : "N/A");
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider !== "credentials") {
                    console.log("🔓 OAuth sign-in detected:", account?.provider);
                    return true;
                }

                if (!user?.id) {
                    console.error("  User ID is missing");
                    return false;
                }

                const existingUserResponse = await guarded(
                    userServiceCircuit,
                    () => userClient.getUserById(user.id!),
                    { label: "signIn:getUserById", timeoutMs: 5000, retries: 1 }
                );

                if (!existingUserResponse.success || !existingUserResponse.data?.user) {
                    console.error("  User not found in database");
                    return false;
                }

                const existingUser = existingUserResponse.data.user;

                if (!existingUser.emailVerified) {
                    console.error("  Email not verified");
                    return false;
                }

                if (existingUser.isLocked) {
                    console.error("🔒 Account is locked");
                    return false;
                }

                if (existingUser.isSuspended) {
                    console.error("🚫 Account is suspended");
                    return false;
                }

                if (!existingUser.isActive) {
                    console.error("  Account is not active");
                    return false;
                }

                if (existingUser.isTwoFactorEnabled) {
                    const res = await guarded(
                        dbCircuit,
                        () => getTwoFactorConfirmationByUserId(existingUser.id),
                        { label: "signIn:get2FAConfirmation", timeoutMs: 4000, retries: 1 }
                    );
                    const twoFactorConfirmation = res?.data?.confirmation;

                    if (!twoFactorConfirmation) {
                        console.error("  2FA confirmation required but not found");
                        return false;
                    }

                    await guarded(
                        dbCircuit,
                        () => deleteTwoFactorConfirmation(twoFactorConfirmation.id),
                        { label: "signIn:delete2FAConfirmation", timeoutMs: 4000, retries: 0 }
                    ).catch((error) => console.error("[!] Failed to delete 2FA confirmation (non-blocking):", error));
                    console.log("  2FA confirmation processed and deleted");
                }

                console.log("  Sign-in validation successful");
                return true;
            } catch (error) {
                // This gate guards locked/suspended/2FA checks, so we fail CLOSED
                // on any error — "couldn't verify" must never be treated as
                // "verified OK". What we gain here is visibility: this log is
                // distinct from a real "account is locked" denial, so dashboards
                // can tell a network blip apart from real failed-login volume.
                if (error instanceof TimeoutError) {
                    console.error("⏱️ signIn: dependency timed out, denying as a precaution:", error.message);
                } else {
                    console.error("  SignIn callback error:", error);
                }
                return false;
            }
        },

        async session({ token, session }) {
            try {
                if (!session.user) return session;

                // ── Surface any DB-sync errors as session errors ────────────
                if ((token as any).error) {
                    (session as any).error = (token as any).error;
                    return session;
                }

                if (token.sub) session.user.id = token.sub;

                session.user.role = (token.role || "CUSTOMER") as UserRole;
                session.user.isTwoFactorEnabled = token.isTwoFactorEnabled ?? false;
                session.user.name = token.name as string;
                session.user.email = token.email as string;
                session.user.image = token.picture as string;
                session.user.isOAuth = token.isOAuth ?? false;
                session.user.isVerified = token.isVerified ?? false;
                session.user.verificationLevel = token.verificationLevel;
                session.user.emailVerified = token.emailVerified ?? null;
                session.user.isActive = token.isActive ?? true;
                session.user.isSuspended = token.isSuspended ?? false;
                session.user.isLocked = token.isLocked ?? false;

                const jwtPayload: Record<string, unknown> = {
                    userId: token.sub,
                    email: token.email,
                    role: token.role,
                    isVerified: token.isVerified,
                    verificationLevel: token.verificationLevel,
                    iat: token.iat,
                };

                if (token.phoneNumber) {
                    session.user.phoneNumber = token.phoneNumber;
                    jwtPayload.phoneNumber = token.phoneNumber;
                }

                if (token.supplierId) {
                    session.user.supplierId = token.supplierId;
                    jwtPayload.supplierId = token.supplierId;
                }

                // Pure/local (jwt.sign) — no network call, nothing to harden here.
                session.user.token = generateSessionToken(jwtPayload as Parameters<typeof generateSessionToken>[0]);

                return session;
            } catch (error) {
                console.error("Session callback error:", error);
                return session;
            }
        },

        async jwt({ token, user, account, trigger }) {
            try {
                // ── A. Initial sign-in — user object is present ─────────────
                if (user) {
                    token.userId = user.id;
                    token.role = user.role;
                    token.email = user.email;
                    token.name = user.name;
                    token.picture = user.image;
                    token.isTwoFactorEnabled = user.isTwoFactorEnabled;
                    token.isVerified = user.isVerified;
                    token.verificationLevel = user.verificationLevel;
                    token.emailVerified = user.emailVerified ?? null;
                    token.isActive = user.isActive ?? true;
                    token.isSuspended = user.isSuspended ?? false;
                    token.isLocked = user.isLocked ?? false;

                    if (account) {
                        token.provider = account.provider;
                    }

                    if (user.id) {
                        // Capture the narrowed id — TypeScript doesn't carry the
                        // `if (user.id)` narrowing into the nested arrow function
                        // below, so `user.id` would still type-check as
                        // `string | undefined` inside the closure without this.
                        const userId = user.id;

                        // Enrichment (OAuth flag + role extras) is best-effort and
                        // isolated in its own try/catch: a failure here must NOT
                        // abandon the whole token build (that was the original bug —
                        // an uncaught throw here used to fall through to the outer
                        // catch and return a token missing role/etc.). isOAuth will
                        // self-correct on the next periodic sync (block C below).
                        try {
                            const existingAccount = await guarded(
                                dbCircuit,
                                () => db.account.findFirst({ where: { userId }, select: { id: true } }),
                                { label: "jwt:accountLookup", timeoutMs: 4000, retries: 1 }
                            );
                            token.isOAuth = !!existingAccount;
                        } catch (error) {
                            console.error("[!] jwt: account lookup failed, defaulting isOAuth=false:", error);
                            token.isOAuth = false;
                        }

                        const roleData = await fetchRoleSpecificData(userId, user.role);
                        token.phoneNumber = roleData.phoneNumber;
                        token.supplierId = roleData.supplierId;
                    }

                    token.lastDbSyncAt = Date.now();
                    return token;
                }

                // ── B. Explicit update() call from the client ───────────────
                //    Always hits DB regardless of sync interval — this is
                //    intentional for immediate role/status changes.
                if (trigger === "update" && token.sub) {
                    console.log("  JWT update trigger — syncing from DB for:", token.sub);
                    return syncTokenFromDb(token);
                }

                // ── C. Periodic refetch (SessionProvider refetchInterval) ───
                //    The `trigger` is undefined on periodic refreshes.
                //    We compare lastDbSyncAt to avoid redundant DB calls
                //    within the same interval window, but always re-validate
                //    from DB — never from cached/local values.
                if (!trigger && token.sub) {
                    const now = Date.now();
                    const lastSync = token.lastDbSyncAt ?? 0;
                    const needsSync = now - lastSync >= DB_SYNC_INTERVAL_MS;

                    if (needsSync) {
                        console.log("Periodic DB sync for:", token.sub);
                        return syncTokenFromDb(token);
                    }
                }

                return token;
            } catch (error) {
                console.error("JWT callback error:", error);
                return token;
            }
        },
    },
    events: {
        async linkAccount({ user }) {
            try {
                if (!user?.id) {
                    console.error("User ID missing in linkAccount event");
                    return;
                }

                // Capture the narrowed id — see the comment on the same pattern
                // in the jwt callback above for why this is necessary.
                const userId = user.id;

                console.log("LinkAccount event:", { userId, email: user.email });
                await guarded(
                    userServiceCircuit,
                    () => userClient.verifyUserEmail(userId),
                    { label: "linkAccount:verifyUserEmail", timeoutMs: 4000, retries: 1 }
                );
                console.log("Email verification updated for OAuth user");
            } catch (error) {
                // Events run after sign-in already succeeded — never let this block login.
                console.error("LinkAccount event error:", error);
            }
        },

        async signIn({ user, account }) {
            if (account?.provider !== "credentials" && user?.id) {
                try {
                    // `account?.provider !== "credentials" && user?.id` above already
                    // narrowed this, but capture it for the same reason as the other
                    const userId = user.id;

                    const userResponse = await guarded(
                        userServiceCircuit,
                        () => userClient.getUserById(userId),
                        { label: "events.signIn:getUserById", timeoutMs: 4000, retries: 1 }
                    );

                    if (
                        userResponse.success &&
                        userResponse.data?.user &&
                        !userResponse.data.user.emailVerified
                    ) {
                        await guarded(
                            userServiceCircuit,
                            () => userClient.verifyUserEmail(userId),
                            { label: "events.signIn:verifyUserEmail", timeoutMs: 4000, retries: 1 }
                        );
                        console.log("Email verified on OAuth sign-in");
                    }

                    // ── Auto-create profile if missing ─────────────────────────
                    await ensureProfileExists(user);
                } catch (error) {
                    console.error("SignIn event error:", error);
                }
            }
        },
    },
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
};

const nextAuth = NextAuth(authConfig);

// ============================================
// EXPORTS
// ============================================

export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;