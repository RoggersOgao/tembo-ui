import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Badge } from "@workspace/ui/components/badge";
import { DragHandle } from "../drag-handle";
import { ActionsCell } from "../cells/action-cells";
import type { UserData } from "@/loginActions/user-actions";

// ─── Columns ──────────────────────────────────────────────────────────────────

export const createUserColumns = (
    handleRowManage: (userId: string) => void,
    onDeleteClick: (user: UserData) => void,
): ColumnDef<UserData>[] => [

        // ── Drag handle ──────────────────────────────────────────────────────────
        {
            id: "drag",
            header: () => null,
            cell: ({ row }) => <DragHandle id={row.original.id} />,
            size: 40, minSize: 40, maxSize: 40,
        },

        // ── Select ───────────────────────────────────────────────────────────────
        {
            id: "select",
            header: ({ table }) => (
                <div className="flex items-center justify-center">
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() ||
                            (table.getIsSomePageRowsSelected() && "indeterminate")
                        }
                        onCheckedChange={v => table.toggleAllPageRowsSelected(!!v)}
                        aria-label="Select all"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center">
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={v => row.toggleSelected(!!v)}
                        aria-label="Select row"
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
            size: 50, minSize: 50, maxSize: 50,
        },

        // ── Name ─────────────────────────────────────────────────────────────────
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }) => (
                <span className="font-medium text-sm truncate block max-w-[200px]">
                    {row.original.name}
                </span>
            ),
            enableHiding: false,
            size: 200, minSize: 160,
        },

        // ── Email ────────────────────────────────────────────────────────────────
        {
            accessorKey: "email",
            header: "Email",
            cell: ({ row }) => (
                <span className="text-sm truncate block max-w-[200px]">
                    {row.original.email ?? "—"}
                </span>
            ),
            size: 200, minSize: 160,
        },

        // ── Role ─────────────────────────────────────────────────────────────────
        {
            accessorKey: "role",
            header: "Role",
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs capitalize">
                    {row.original.role ?? "—"}
                </Badge>
            ),
            size: 100, minSize: 80,
        },

        // ── Status ───────────────────────────────────────────────────────────────
        {
            accessorKey: "isActive",
            header: "Status",
            cell: ({ row }) => (
                <Badge
                    variant={row.original.isActive ? "default" : "secondary"}
                    className="text-xs"
                >
                    {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
            ),
            size: 90, minSize: 80,
        },

        // ── Verified ─────────────────────────────────────────────────────────────
        {
            accessorKey: "isVerified",
            header: "Verified",
            cell: ({ row }) => (
                <Badge
                    variant={row.original.emailVerified ? "default" : "destructive"}
                    className="text-xs"
                >
                    {row.original.emailVerified ? "Verified" : "Unverified"}
                </Badge>
            ),
            size: 100, minSize: 80,
        },

        // ── 2FA ──────────────────────────────────────────────────────────────────
        {
            accessorKey: "isTwoFactorEnabled",
            header: "2FA",
            cell: ({ row }) => (
                <Badge
                    variant={row.original.isTwoFactorEnabled ? "default" : "secondary"}
                    className="text-xs"
                >
                    {row.original.isTwoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
            ),
            size: 90, minSize: 80,
        },

        // ── Account flags ─────────────────────────────────────────────────────────
        {
            id: "flags",
            header: "Flags",
            cell: ({ row }) => {
                const { isLocked, isSuspended } = row.original;
                if (!isLocked && !isSuspended) {
                    return <span className="text-xs text-muted-foreground">—</span>;
                }
                return (
                    <div className="flex flex-col gap-0.5">
                        {isLocked && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 w-fit">
                                Locked
                            </Badge>
                        )}
                        {isSuspended && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 w-fit">
                                Suspended
                            </Badge>
                        )}
                    </div>
                );
            },
            size: 100, minSize: 80,
        },

        // ── Signup source ─────────────────────────────────────────────────────────
        {
            accessorKey: "signupSource",
            header: "Source",
            cell: ({ row }) => (
                <span className="text-sm capitalize truncate block max-w-[100px]">
                    {row.original.signupSource ?? "—"}
                </span>
            ),
            size: 100, minSize: 80,
        },

        // ── Created at ────────────────────────────────────────────────────────────
        {
            accessorKey: "createdAt",
            header: "Joined",
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {row.original.createdAt
                        ? new Date(row.original.createdAt).toLocaleDateString()
                        : "—"}
                </span>
            ),
            size: 110, minSize: 90,
        },

        // ── Actions ──────────────────────────────────────────────────────────────
        {
            id: "actions",
            cell: ({ row }) => (
                <ActionsCell
                    userId={row.original.id}
                    onView={() => handleRowManage(row.original.id)}
                    onEdit={() => handleRowManage(row.original.id)}
                    onDelete={() => onDeleteClick(row.original)}
                />
            ),
            size: 80, minSize: 70, maxSize: 100,
        },
    ];