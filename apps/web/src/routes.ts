// routes.ts

export type UserRole =
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'MANAGER'
    | 'STAFF'
    | 'CUSTOMER'
    | 'SUPPORT'
    | 'VIEWER';

// ── Public routes (no auth required) ─────────────────────────────────────────
export const publicRoutes = [
    "/",
    "/pricing",
    "/docs",
    "/docs/:*",
    "/status",
    "/contact",
    "/contact/sales",
    "/features",
    "/about",
    "/blog",
    "/blog/:*",
    "/api/uploadthing",
    "/api/consent",
    "/api/consent/:*",
];

// ── Auth routes (redirect logged-in users away) ───────────────────────────────
export const authRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/error",
    "/auth/reset",
    "/auth/new-password",
    "/auth/verify-email",
    "/auth/new-verification",
];

// ── Role-specific routes ──────────────────────────────────────────────────────

// Primary product user — manages their own storage, tokens, billing, security
export const customerRoutes = [
    "/dashboard",
    "/buckets",
    "/buckets/:*",
    "/files",
    "/files/:*",
    "/uploads",
    "/uploads/:*",
    "/access-tokens",
    "/access-tokens/:*",
    "/usage",
    "/billing",
    "/billing/:*",
    "/security",
    "/security/:*",
    "/notifications",
    "/profile",
    "/profile/:*",
    "/error",
];

// Internal support/ops — handles tickets, views buckets, no billing access
export const staffRoutes = [
    "/dashboard",
    "/buckets",
    "/buckets/:*",
    "/users",
    "/users/:*",
    "/tickets",
    "/tickets/:*",
    "/audit-log",
    "/audit-log/:*",
    "/reports",
    "/reports/:*",
    "/error",
];

// Alias of staff — dedicated support role, same surface for now
export const supportRoutes = staffRoutes;

// Read-only reporting access — no mutation routes
export const viewerRoutes = [
    "/dashboard",
    "/buckets",
    "/buckets/:*",
    "/usage",
    "/reports",
    "/reports/:*",
    "/error",
];

// Oversees infra, billing, and users across accounts
export const managerRoutes = [
    "/dashboard",
    "/dashboard/:*",
    "/buckets",
    "/buckets/:*",
    "/users",
    "/users/:*",
    "/billing",
    "/billing/:*",
    "/usage",
    "/audit-log",
    "/audit-log/:*",
    "/reports",
    "/reports/:*",
    "/security",
    "/security/:*",
    "/settings",
    "/settings/:*",
    "/error",
];

// Full platform management
export const adminRoutes = [
    "/dashboard",
    "/dashboard/:*",
    "/buckets",
    "/buckets/:*",
    "/users",
    "/users/:*",
    "/access-tokens",
    "/access-tokens/:*",
    "/billing",
    "/billing/:*",
    "/usage",
    "/audit-log",
    "/audit-log/:*",
    "/analytics",
    "/analytics/:*",
    "/reports",
    "/reports/:*",
    "/tickets",
    "/tickets/:*",
    "/security",
    "/security/:*",
    "/settings",
    "/settings/:*",
    "/account/:*",
    "/error",
];

// Super admin: unrestricted — handled in middleware via wildcard
export const superAdminRoutes = ["/:*"];

// ── Role → allowed routes map (used in middleware) ────────────────────────────
export const roleRouteMap: Record<UserRole, string[]> = {
    CUSTOMER: customerRoutes,
    STAFF: staffRoutes,
    SUPPORT: supportRoutes,
    VIEWER: viewerRoutes,
    MANAGER: managerRoutes,
    ADMIN: adminRoutes,
    SUPER_ADMIN: superAdminRoutes,
};

// ── API & auth config ─────────────────────────────────────────────────────────
export const apiAuthPrefix = "/api/auth";

// ── Default redirects ─────────────────────────────────────────────────────────
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";
export const UNAUTHORIZED_REDIRECT = "/error";