// app/dashboard/branches/components/columns/cells/branch-cell.tsx

import type { Branch } from "@/types/branch/branch-types";
import { Building2Icon } from "lucide-react";
import { TableCellViewer } from "./table-cell-viewer";

interface BranchCellProps {
    item: Branch;
}

export function BranchCell({ item }: BranchCellProps) {
    // Generate initials for avatar fallback
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    };

    // Get branch color based on city or name for consistent branding
    const getBranchColor = (branch: Branch) => {
        const colors = [
            'bg-blue-500',
            'bg-green-500',
            'bg-purple-500',
            'bg-orange-500',
            'bg-pink-500',
            'bg-indigo-500',
            'bg-red-500',
            'bg-teal-500',
        ];
        const index = branch.name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <div className="flex items-center gap-3">
            <span><Building2Icon /></span>
            <TableCellViewer item={item} />
        </div>
    );
}