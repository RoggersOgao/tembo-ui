import { useIsMobile } from "@/hooks/use-mobile";
import type { Branch } from "@/types/branch/branch-types";
import { IconTrendingUp } from "@tabler/icons-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@workspace/ui/components/sheet";
import {
    MapPin,
    Phone,
    Mail,
    Package,
    Truck,
    BarChart3,
    AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { ProductChart } from "./branch-chart";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchDetailDrawerProps {
    item:     Branch;
    children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BranchDetailDrawer({ item, children }: BranchDetailDrawerProps) {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);

    const inv = item.stats?.inventory;
    const deliveries = item.stats?.deliveries;
    const orders = item.stats?.orders;

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>{children}</SheetTrigger>
            <SheetContent
                side={isMobile ? "bottom" : "right"}
                className="p-3 data-[side=bottom]:max-h-[90vh] w-full sm:max-w-xl lg:max-w-md"
            >
                <SheetHeader className="p-0 mb-6">
                    <SheetTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {item.name}
                    </SheetTitle>
                    <SheetDescription>
                        <span className="text-xs">{item.city}{item.county ? `, ${item.county}` : ""}</span>
                    </SheetDescription>
                </SheetHeader>

                <div className="no-scrollbar overflow-y-auto space-y-6">

                    {/* Chart */}
                    {!isMobile && (
                        <div className="pb-4">
                            <ProductChart />
                            <Separator />
                            <div className="grid gap-2 mt-2">
                                <div className="flex gap-2 leading-none font-medium">
                                    Trending up by 5.2% this month
                                    <IconTrendingUp className="size-4" />
                                </div>
                                <div className="text-muted-foreground text-sm">
                                    Showing total deliveries for the last 6 months
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Contact & Location Card */}
                    <Card className="border shadow-sm hover:shadow transition-shadow">
                        <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    Location & Contact
                                </CardTitle>
                                <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                                    {item.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2">
                            <div className="text-sm text-muted-foreground">{item.address}</div>
                            <div className="text-sm">{item.city}{item.county ? `, ${item.county}` : ""}</div>
                            {item.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                    {item.phone}
                                </div>
                            )}
                            {item.email && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                    {item.email}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stats Card */}
                    {(inv || deliveries || orders) && (
                        <Card className="border shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                    Branch Stats
                                </CardTitle>
                                <CardDescription>Live operational summary</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0 grid grid-cols-2 gap-3">

                                {/* Inventory */}
                                {inv && (
                                    <div className="rounded-md bg-muted/40 p-3 space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Package className="h-3.5 w-3.5" />
                                            Inventory
                                        </div>
                                        <div className="text-lg font-semibold tabular-nums">{inv.totalItems}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {inv.totalQuantity} units · {inv.reservedQuantity} reserved
                                        </div>
                                        {inv.lowStockItems > 0 && (
                                            <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {inv.lowStockItems} low stock
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Deliveries */}
                                {deliveries && (
                                    <div className="rounded-md bg-muted/40 p-3 space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Truck className="h-3.5 w-3.5" />
                                            Deliveries
                                        </div>
                                        <div className="text-lg font-semibold tabular-nums">{deliveries.total}</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {Object.entries(deliveries.byStatus).map(([status, count]) => (
                                                <Badge key={status} variant="outline" className="text-[10px] px-1 py-0">
                                                    {status.toLowerCase().replace(/_/g, " ")}: {count}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Orders */}
                                {orders && (
                                    <div className="rounded-md bg-muted/40 p-3 space-y-1 col-span-2">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <BarChart3 className="h-3.5 w-3.5" />
                                            Orders
                                        </div>
                                        <div className="text-lg font-semibold tabular-nums">{orders.total}</div>
                                    </div>
                                )}

                            </CardContent>
                        </Card>
                    )}

                </div>

                <SheetFooter className="mt-6">
                    <SheetClose asChild>
                        <Button variant="outline">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}