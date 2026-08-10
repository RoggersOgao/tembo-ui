// components/dash-home/nav-main.tsx
"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuBadge,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from "@workspace/ui/components/sidebar";
import type { NavItem } from "../app-sidebar";

// ─── Badge pill ───────────────────────────────────────────────────────────────

function NavBadge({ label }: { label: string }) {
    return (
        <span
            className={[
                // Layout
                "ml-auto flex items-center justify-center",
                "min-w-[1.25rem] h-5 px-1 rounded-full",
                // Sizing — shrink text for "99+"
                label.length > 2 ? "text-[9px]" : "text-[10px]",
                "font-bold leading-none tabular-nums",
                // Colors — vivid red on light, slightly muted on dark
                "bg-rose-500 dark:bg-rose-600 text-white",
                // Entrance animation — scale in from 0
                "animate-in zoom-in-75 duration-200",
                // Keep it above everything else in collapsed mode
                "relative z-10",
            ].join(" ")}
            aria-label={`${label} unread`}
        >
            {label}
        </span>
    );
}

// ─── NavMain ──────────────────────────────────────────────────────────────────

export function NavMain({ items }: { items: NavItem[] }) {
    const { state: sidebarState } = useSidebar();
    const isCollapsed = sidebarState === "collapsed";

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) =>
                    item.items?.length ? (
                        // ── Collapsible group ────────────────────────────────
                        <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={item.isActive}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={item.title}>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                        {/* Badge shown on the group when collapsed */}
                                        {item.badge && isCollapsed && (
                                            <NavBadge label={item.badge} />
                                        )}
                                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>

                                {/* Badge shown inline (not collapsed) */}
                                {item.badge && !isCollapsed && (
                                    <SidebarMenuBadge>
                                        <NavBadge label={item.badge} />
                                    </SidebarMenuBadge>
                                )}

                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items.map((sub) => (
                                            <SidebarMenuSubItem key={sub.title}>
                                                <SidebarMenuSubButton asChild>
                                                    <a href={sub.url}>
                                                        <span>{sub.title}</span>
                                                    </a>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        // ── Flat item ────────────────────────────────────────
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title}>
                                <a href={item.url}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                    {item.badge && <NavBadge label={item.badge} />}
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}