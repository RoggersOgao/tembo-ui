// middleware.ts
import {
    apiAuthPrefix,
    authRoutes,
    publicRoutes,
    roleRouteMap,
    DEFAULT_LOGIN_REDIRECT,
    UNAUTHORIZED_REDIRECT,
    type UserRole,
} from "./routes";
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// All known routes across every role (used to distinguish 404 vs unauthorised)
const allKnownRoutes: string[] = Object.values(roleRouteMap).flat();

// ── Pattern matcher ───────────────────────────────────────────────────────────
function matchesRoute(path: string, patterns: string[]): boolean {
    const cleanPath = path.split("?")[0] ?? "";

    for (const pattern of patterns) {
        // 1. Super-admin wildcard — matches everything
        if (pattern === "/:*") return true;

        // 2. Exact match
        if (pattern === cleanPath) return true;

        // 3. Prefix wildcard: "/orders/:*" matches "/orders/anything/nested"
        if (pattern.endsWith("/:*")) {
            const base = pattern.slice(0, -3);
            if (cleanPath === base || cleanPath.startsWith(base + "/")) return true;
        }

        // 4. Legacy ":*" wildcard (no leading slash before star)
        if (pattern.includes(":*") && !pattern.endsWith("/:*")) {
            const base = pattern.split(":*")[0];
            if (base && cleanPath.startsWith(base)) return true;
        }

        // 5. Named param segments: "/orders/:id" matches "/orders/123"
        if (pattern.includes("/:")) {
            const patternParts = pattern.split("/");
            const pathParts    = cleanPath.split("/");

            if (patternParts.length !== pathParts.length) continue;

            const allMatch = patternParts.every((part, i) => {
                const segment = pathParts[i];
                if (part.startsWith(":")) return segment !== undefined && segment !== "";
                return part === segment;
            });

            if (allMatch) return true;
        }
    }

    return false;
}

// ── Middleware ────────────────────────────────────────────────────────────────
export default async function middleware(req: NextRequest) {
    const { nextUrl } = req;
    const { pathname } = nextUrl;

    // ── Always pass through Next.js internals & NextAuth API ──────────────────
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith(apiAuthPrefix)
    ) {
        return NextResponse.next();
    }

    // Read the JWT written by auth.ts
    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    });

    const isLoggedIn = !!token;
    const role       = token?.role as UserRole | undefined;

    // ── Stale / broken token ──────────────────────────────────────────────────
    // If the token carries a UserNotFound error, the session is broken.
    // Pass through auth routes so the login page can render, then clear
    // the session cookies so the stale token doesn't persist.
    if (token?.error === "UserNotFound") {
        if (authRoutes.includes(pathname)) {
            // Already on an auth page — let it render and clear cookies
            const response = NextResponse.next();
            response.cookies.delete("next-auth.session-token");
            response.cookies.delete("__Secure-next-auth.session-token");
            return response;
        }

        // Anywhere else — redirect to login without a callbackUrl
        // (callbackUrl would re-trigger the broken session check)
        const response = NextResponse.redirect(
            new URL(`/auth/login?error=UserNotFound`, nextUrl)
        );
        response.cookies.delete("next-auth.session-token");
        response.cookies.delete("__Secure-next-auth.session-token");
        return response;
    }

    // ── 1. Public routes — always accessible ──────────────────────────────────
    if (matchesRoute(pathname, publicRoutes)) {
        return NextResponse.next();
    }

    // ── 2. Auth routes (login, error) ─────────────────────────────────────────
    // Logged-in users get bounced straight to dashboard
    if (authRoutes.includes(pathname)) {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
        }
        return NextResponse.next();
    }

    // ── 3. Protected routes — must be logged in ───────────────────────────────
    if (!isLoggedIn) {
        const callbackUrl = encodeURIComponent(pathname + nextUrl.search);
        return NextResponse.redirect(
            new URL(`/auth/login?callbackUrl=${callbackUrl}`, nextUrl)
        );
    }

    // ── 4. SUPER_ADMIN bypasses all route restrictions ────────────────────────
    if (role === "SUPER_ADMIN") return NextResponse.next();

    // ── 5. Unknown / missing role → unauthorised ──────────────────────────────
    if (!role || !(role in roleRouteMap)) {
        return NextResponse.redirect(new URL(UNAUTHORIZED_REDIRECT, nextUrl));
    }

    // ── 6. Role-based access check ────────────────────────────────────────────
    const allowedRoutes = roleRouteMap[role];
    const isAllowed     = matchesRoute(pathname, allowedRoutes);

    if (!isAllowed) {
        // Route doesn't exist for any role → show 404
        if (!matchesRoute(pathname, allKnownRoutes)) {
            return NextResponse.rewrite(new URL("/not-found", nextUrl));
        }
        // Route exists but not for this role → back to their dashboard
        return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};