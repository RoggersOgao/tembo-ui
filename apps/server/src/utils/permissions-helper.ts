import { UserRole, Prisma } from "@repo/database";
import { db } from "@repo/database";

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    // ── Full system access ──────────────────────────────────
    SUPER_ADMIN: [
        "users.manage", "users.view", "users.delete",
        "roles.manage", "permissions.manage",
        "products.manage", "products.view",
        "orders.manage", "orders.view",
        "inventory.manage", "inventory.view",
        "suppliers.manage", "suppliers.view",
        "deliveries.manage", "deliveries.view",
        "payments.manage", "payments.view", "payments.refund",
        "promotions.manage", "promotions.view",
        "reviews.moderate", "comments.moderate",
        "reports.manage", "analytics.view",
        "branches.manage", "branches.view",
        "settings.manage", "audit.view", "audit.export",
        "badges.manage", "dashboard.admin",
    ],

    // ── Admin — no role/permission management ───────────────
    ADMIN: [
        "users.manage", "users.view",
        "products.manage", "products.view",
        "orders.manage", "orders.view",
        "inventory.manage", "inventory.view",
        "suppliers.manage", "suppliers.view",
        "deliveries.manage", "deliveries.view",
        "payments.view", "payments.refund",
        "promotions.manage", "promotions.view",
        "reviews.moderate", "comments.moderate",
        "reports.manage", "analytics.view",
        "branches.view", "audit.view",
        "badges.manage", "dashboard.admin",
    ],

    // ── Manager — operations & inventory ────────────────────
    MANAGER: [
        "users.view",
        "products.manage", "products.view",
        "orders.manage", "orders.view",
        "inventory.manage", "inventory.view",
        "suppliers.view",
        "deliveries.manage", "deliveries.view",
        "promotions.view",
        "reviews.moderate", "comments.moderate",
        "reports.view", "analytics.view",
        "branches.view", "audit.view",
        "dashboard.manager",
    ],

    // ── Staff — butcher / packer ─────────────────────────────
    STAFF: [
        "orders.view", "orders.process",
        "products.view",
        "inventory.view", "inventory.update",
        "dashboard.staff",
    ],

    // ── Delivery driver ──────────────────────────────────────
    DELIVERY: [
        "deliveries.view", "deliveries.update",
        "orders.view",
        "dashboard.driver",
    ],

    // ── Supplier / vendor ────────────────────────────────────
    SUPPLIER: [
        "suppliers.self.view", "suppliers.self.update",
        "purchase_orders.view",
        "products.view",
        "dashboard.supplier",
    ],

    // ── Customer ─────────────────────────────────────────────
    CUSTOMER: [
        "orders.self.view", "orders.self.create", "orders.self.cancel",
        "products.view",
        "reviews.self.create", "reviews.self.edit",
        "comments.self.create",
        "profile.self.view", "profile.self.edit",
    ],

    // ── Support ──────────────────────────────────────────────
    SUPPORT: [
        "users.view",
        "orders.view", "orders.manage",
        "payments.view", "payments.refund",
        "deliveries.view",
        "reviews.moderate", "comments.moderate",
        "reports.view", "reports.manage",
        "dashboard.support",
    ],

    // ── Viewer — read-only (e.g. external auditor) ───────────
    VIEWER: [
        "products.view",
        "orders.view",
        "inventory.view",
        "analytics.view",
        "dashboard.viewer",
    ],
};

export function getDefaultPermissionsForRole(role: UserRole): string[] {
    return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}

export async function assignDefaultPermissions(
    userId: string,
    role: UserRole,
    tx?: Prisma.TransactionClient
): Promise<{ assigned: number; missing: string[] }> {
    const client = tx ?? db;

    const permissionNames = getDefaultPermissionsForRole(role);
    if (permissionNames.length === 0) return { assigned: 0, missing: [] };

    const permissions = await client.permission.findMany({
        where: { name: { in: permissionNames } },
    });

    const foundNames = permissions.map((p) => p.name);
    const missing = permissionNames.filter((name) => !foundNames.includes(name));

    if (permissions.length > 0) {
        await client.user.update({
            where: { id: userId },
            data: { permissions: { connect: permissions.map((p) => ({ id: p.id })) } },
        });
    }

    return { assigned: permissions.length, missing };
}

export async function assignPermissions(
    userId: string,
    permissionNames: string[],
    tx?: Prisma.TransactionClient
): Promise<number> {
    const client = tx ?? db;

    const permissions = await client.permission.findMany({
        where: { name: { in: permissionNames } },
    });

    if (permissions.length === 0) throw new Error("No valid permissions found");

    await client.user.update({
        where: { id: userId },
        data: { permissions: { connect: permissions.map((p) => ({ id: p.id })) } },
    });

    return permissions.length;
}

export async function removePermissions(
    userId: string,
    permissionNames: string[],
    tx?: Prisma.TransactionClient
): Promise<number> {
    const client = tx ?? db;

    const permissions = await client.permission.findMany({
        where: { name: { in: permissionNames } },
    });

    if (permissions.length === 0) return 0;

    await client.user.update({
        where: { id: userId },
        data: { permissions: { disconnect: permissions.map((p) => ({ id: p.id })) } },
    });

    return permissions.length;
}

export async function hasPermission(
    userId: string,
    permissionName: string
): Promise<boolean> {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { permissions: { where: { name: permissionName } } },
    });

    return (user?.permissions.length ?? 0) > 0;
}

export async function hasAnyPermission(
    userId: string,
    permissionNames: string[]
): Promise<boolean> {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { permissions: { where: { name: { in: permissionNames } } } },
    });

    return (user?.permissions.length ?? 0) > 0;
}

export async function hasAllPermissions(
    userId: string,
    permissionNames: string[]
): Promise<boolean> {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { permissions: { where: { name: { in: permissionNames } } } },
    });

    return (user?.permissions.length ?? 0) === permissionNames.length;
}

export async function getUserPermissions(userId: string) {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { permissions: true },
    });

    return user?.permissions ?? [];
}