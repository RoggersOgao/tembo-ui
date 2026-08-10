// app/(dashboard)/settings/components/top-nav.tsx
"use client";

import { Button } from "@workspace/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface Section {
    id: string;
    label: string;
    icon: React.ReactNode;
}

interface TopNavProps {
    sections: Section[];
    activeSection: string;
    onSectionChange: (id: string) => void;
}

export function TopNav({ sections, activeSection, onSectionChange }: TopNavProps) {
    const activeLabel = sections.find((s) => s.id === activeSection)?.label || "Settings";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                    {activeLabel}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-[200px]">
                <DropdownMenuLabel>Account Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sections.map((section) => (
                    <DropdownMenuItem
                        key={section.id}
                        onClick={() => onSectionChange(section.id)}
                        className="gap-2"
                    >
                        <span className="text-muted-foreground">{section.icon}</span>
                        {section.label}
                        {activeSection === section.id && (
                            <span className="ml-auto text-xs text-primary">Active</span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}