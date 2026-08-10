"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "next-auth";

import {
    IconChartBar,
    IconDashboard,
    IconHelp,
    IconListDetails,
    IconMessage,
    IconMoneybag,
    IconReport,
    IconSearch,
    IconSettings,
    IconShieldLock,
    IconTicket,
    IconUsers,
    IconUserSearch,
    IconShoppingBag,
    IconCategory,
    IconTruck,
    IconStars,
    IconPackage,
    IconBuildingStore,
    IconChartPie,
    IconReceipt,
    IconTags,
    IconBasket,
} from "@tabler/icons-react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@workspace/ui/components/sidebar";

import { NavDocuments } from "./dash-home/nav-documents";
import { NavMain } from "./dash-home/nav-main";
import { NavSecondary } from "./dash-home/nav-secondary";
import { NavUser } from "./dash-home/nav-user";
import { useAuthLoading, useUser } from "@/hooks/zustand/stores/use-auth-store";
import { DashboardGuard } from "@/providers/session-sync-provider";
import IsLogo from "../layout/Is_logo";
import { useAdminOrderSocket, useCustomerOrderSocket } from "@/hooks/products/orders/useOrderSocket";
import { useNavBadges } from "./dash-home/use-nav-badges";
import { useNavBadgeStore } from "@/hooks/zustand/stores/products/orders/use-nav-badge-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole =
    | "SUPER_ADMIN"
    | "ADMIN"
    | "MANAGER"
    | "SUPPLIER"
    | "STAFF"
    | "CUSTOMER"
    | "SUPPORT"
    | "VIEWER";

export interface NavItem {
    title: string;
    url: string;
    icon?: React.ComponentType<any>;
    isActive?: boolean;
    badge?: string;
    items?: { title: string; url: string }[];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SidebarSkeleton = (props: React.ComponentProps<typeof Sidebar>) => (
    <Sidebar collapsible="offcanvas" {...props}>
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton className="data-[slot=sidebar-menu-button]:!p-1.5">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
            <div className="space-y-1 px-3 py-2">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-2">
                        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                ))}
            </div>
        </SidebarContent>
        <SidebarFooter>
            <div className="flex items-center space-x-3 p-2">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-2 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
            </div>
        </SidebarFooter>
    </Sidebar>
);

// ─── Route → badge map ────────────────────────────────────────────────────────
//
// Maps each nav item URL to the BadgeRoute key it should read from the store.
// Items not listed here will never show a badge.

const URL_TO_BADGE_ROUTE: Record<string, string> = {
    "/orders":          "/orders",
    "/messages":        "/messages",
    "/tickets":         "/tickets",
    "/branch/delivery": "/branch/delivery",
    "/delivery":        "/delivery",
};

// ─── Navigation per Role ──────────────────────────────────────────────────────

const roleNavigation: Record<UserRole, NavItem[]> = {
    SUPER_ADMIN: [
        { title: "Dashboard",      url: "/dashboard",     icon: IconDashboard },
        { title: "Messages",       url: "/messages",      icon: IconMessage },
        {
            title: "Products", url: "/products", icon: IconShoppingBag,
            items: [
                { title: "All Products", url: "/products" },
                { title: "Categories",   url: "/products/categories" },
            ],
        },
        {
            title: "Delivery", url: "/delivery", icon: IconTruck,
            items: [
                { title: "Deliveries",    url: "/branch/delivery" },
                { title: "Branch",        url: "/branch" },
                { title: "Branch Driver", url: "/branch/branch-driver" },
            ],
        },
        { title: "Orders",         url: "/orders",        icon: IconReceipt },
        { title: "Users",          url: "/users",         icon: IconUsers },
        { title: "Suppliers",      url: "/suppliers",     icon: IconBasket },
        { title: "order-tracking", url: "/order-tracking",icon: IconPackage },
        { title: "Analytics",      url: "/analytics",     icon: IconChartPie },
        { title: "Payments",       url: "/payments",      icon: IconMoneybag },
        { title: "Reports",        url: "/reports",       icon: IconReport },
        { title: "Tickets",        url: "/tickets",       icon: IconTicket },
        { title: "Security",       url: "/security",      icon: IconShieldLock },
    ],

    ADMIN: [
        { title: "Dashboard",  url: "/dashboard",  icon: IconDashboard },
        { title: "Messages",   url: "/messages",   icon: IconMessage },
        {
            title: "Products", url: "/products", icon: IconShoppingBag,
            items: [
                { title: "All Products", url: "/products" },
                { title: "Categories",   url: "/products/categories" },
                { title: "Tags",         url: "/products/tags" },
                { title: "Inventory",    url: "/products/inventory" },
            ],
        },
        {
            title: "Delivery", url: "/delivery", icon: IconTruck,
            items: [
                { title: "Deliveries", url: "/branch/delivery" },
                { title: "Branch",     url: "/branch" },
            ],
        },
        { title: "Orders",    url: "/orders",    icon: IconReceipt },
        { title: "Users",     url: "/users",     icon: IconUsers },
        { title: "Suppliers", url: "/suppliers", icon: IconTruck },
        { title: "Analytics", url: "/analytics", icon: IconChartPie },
        { title: "Payments",  url: "/payments",  icon: IconMoneybag },
        { title: "Reports",   url: "/reports",   icon: IconReport },
        { title: "Tickets",   url: "/tickets",   icon: IconTicket },
    ],

    MANAGER: [
        { title: "Dashboard",      url: "/dashboard",      icon: IconDashboard },
        { title: "Messages",       url: "/messages",       icon: IconMessage },
        {
            title: "Products", url: "/products", icon: IconShoppingBag,
            items: [
                { title: "All Products", url: "/products" },
                { title: "Categories",   url: "/products/categories" },
            ],
        },
        { title: "Orders",         url: "/orders",         icon: IconReceipt },
        { title: "Suppliers",      url: "/suppliers",      icon: IconTruck },
        { title: "order-tracking", url: "/order-tracking", icon: IconPackage },
        { title: "Analytics",      url: "/analytics",      icon: IconChartPie },
        { title: "Payments",       url: "/payments",       icon: IconMoneybag },
        { title: "Reports",        url: "/reports",        icon: IconReport },
    ],

    SUPPLIER: [
        { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
        { title: "Messages",  url: "/messages",  icon: IconMessage },
        {
            title: "My Products", url: "/products", icon: IconShoppingBag,
            items: [
                { title: "All Products", url: "/products" },
                { title: "Inventory",    url: "/products/inventory" },
            ],
        },
        { title: "Orders",   url: "/orders",   icon: IconReceipt },
        { title: "Payments", url: "/payments", icon: IconMoneybag },
        { title: "Reports",  url: "/reports",  icon: IconReport },
    ],

    STAFF: [
        { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
        { title: "Messages",  url: "/messages",  icon: IconMessage },
        {
            title: "Products", url: "/products", icon: IconShoppingBag,
            items: [
                { title: "All Products", url: "/products" },
                { title: "Inventory",    url: "/products/inventory" },
            ],
        },
        { title: "Orders",    url: "/orders",    icon: IconReceipt },
        { title: "Customers", url: "/customers", icon: IconUserSearch },
        { title: "Tickets",   url: "/tickets",   icon: IconTicket },
    ],

    CUSTOMER: [
        { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
        { title: "Messages",  url: "/messages",  icon: IconMessage },
        { title: "Shop",      url: "/shop",      icon: IconBuildingStore },
        {
            title: "My Orders", url: "/orders", icon: IconReceipt,
            items: [{ title: "All Orders", url: "/orders" }],
        },
        { title: "Reviews",        url: "/reviews",        icon: IconStars },
        { title: "order-tracking", url: "/order-tracking", icon: IconPackage },
        { title: "Payments",       url: "/payments",       icon: IconMoneybag },
    ],

    SUPPORT: [
        { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
        { title: "Messages",  url: "/messages",  icon: IconMessage },
        { title: "Tickets",   url: "/tickets",   icon: IconTicket },
        { title: "Customers", url: "/customers", icon: IconUserSearch },
        { title: "Orders",    url: "/orders",    icon: IconReceipt },
        { title: "Reports",   url: "/reports",   icon: IconReport },
    ],

    VIEWER: [
        { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
        {
            title: "Products", url: "/products", icon: IconShoppingBag,
            items: [{ title: "Browse", url: "/products" }],
        },
        { title: "Reports", url: "/reports", icon: IconReport },
    ],
};

// ─── Documents per Role ───────────────────────────────────────────────────────

const roleDocuments: Partial<Record<UserRole, { name: string; url: string; icon: any }[]>> = {
    SUPER_ADMIN: [
        { name: "Reports",    url: "/reports",   icon: IconReport },
        { name: "Audit Logs", url: "/security",  icon: IconShieldLock },
    ],
    ADMIN:    [{ name: "Reports", url: "/reports", icon: IconReport }],
    MANAGER:  [{ name: "Reports", url: "/reports", icon: IconReport }],
    SUPPLIER: [{ name: "Reports", url: "/reports", icon: IconReport }],
    STAFF:    [{ name: "Reports", url: "/reports", icon: IconReport }],
};

const navSecondary = [
    { title: "Settings", url: "/settings", icon: IconSettings },
    { title: "Get Help", url: "#",         icon: IconHelp },
    { title: "Search",   url: "#",         icon: IconSearch },
];

// ─── Admin role set ───────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set<UserRole>([
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'SUPPORT',
]);

// ─── Socket + badge wiring ────────────────────────────────────────────────────

function useSocketForRole(
    userId: string | undefined,
    role: UserRole,
    branchId?: string
) {
    const isAdmin = ADMIN_ROLES.has(role);

    // Customer hook — only active when role is CUSTOMER / SUPPLIER / VIEWER
    useCustomerOrderSocket(
        !isAdmin ? (userId ?? null) : null
    );

    // Admin hook — only active for staff roles
    useAdminOrderSocket(
        isAdmin ? (userId ?? null) : null,
        branchId ?? null
    );

    // Wire badge counts from the socket notifications
    useNavBadges();
}

// ─── Badge-enriched nav items ─────────────────────────────────────────────────

function useBadgedNavItems(items: NavItem[]): NavItem[] {
    // Subscribe to the full counts object so we re-render when any count changes
    const counts = useNavBadgeStore((s) => s.counts);
    const getLabel = useNavBadgeStore((s) => s.getLabel);

    return React.useMemo(() => {
        return items.map((item) => {
            const badgeRoute = URL_TO_BADGE_ROUTE[item.url];
            if (!badgeRoute) return item;

            const label = getLabel(badgeRoute as any);
            return label ? { ...item, badge: label } : item;
        });
    // Re-run whenever counts change (counts object reference changes on every
    // increment/clear since we spread in the store)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, counts, getLabel]);
}

// ─── Role Sidebar Sections ────────────────────────────────────────────────────

function RoleSidebarSections({ role }: { role: UserRole }) {
    const rawItems = roleNavigation[role] ?? roleNavigation.VIEWER;
    const navItems  = useBadgedNavItems(rawItems);
    const documents = roleDocuments[role];

    return (
        <>
            <DashboardGuard requiredRole={role} inline fallback={<div />}>
                <NavMain items={navItems} />
            </DashboardGuard>
            {documents && <NavDocuments items={documents} />}
        </>
    );
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
    const user      = useUser();
    const isLoading = useAuthLoading();
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => { setIsMounted(true); }, []);

    // Initialise socket + badge wiring once user is known
    useSocketForRole(user?.id, (user?.role as UserRole) ?? 'VIEWER');

    if (!isMounted || isLoading) {
        return <SidebarSkeleton {...props} />;
    }

    const role = (user?.role as UserRole) ?? "VIEWER";

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <Link href="/" className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                                    <span className="text-white dark:text-black font-bold text-sm">Or</span>
                                </div>
                                <span className="text-xl font-bold text-black dark:text-white">
                                    <IsLogo className="w-30 h-11 fill-black dark:fill-white" />
                                </span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <RoleSidebarSections role={role} />
                <NavSecondary items={navSecondary} className="mt-auto" />
            </SidebarContent>

            <SidebarFooter>
                <NavUser user={user as User} isLoading={isLoading} />
            </SidebarFooter>
        </Sidebar>
    );
}