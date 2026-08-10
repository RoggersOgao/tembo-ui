// app/(authenticated)/profile/addresses/page.tsx
"use client";

import { Button } from "@workspace/ui/components/button";
import { Briefcase, Edit2, Home, MapPin, Navigation, Star, Store, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@workspace/ui/components/badge";



import { DELIVERY_MODES, DeliveryMode, type DeliveryAddress } from "@/lib/user/delivery-settings.api";

// ─── Helper: address icon mapping ─────────────────────────────────────────────

function getAddressIcon(label: string | null) {
    const l = (label ?? "").toLowerCase();
    if (l.includes("work") || l.includes("office")) return Briefcase;
    if (l.includes("home")) return Home;
    if (l.includes("store") || l.includes("shop")) return Store;
    return MapPin;
}

// ─── Address Card Component ───────────────────────────────────────────────────

interface AddressCardProps {
    address: DeliveryAddress;
    isSelected?: boolean;
    onSelect?: (address: DeliveryAddress) => void;
    onEdit?: (address: DeliveryAddress) => void;
    onDelete?: (address: DeliveryAddress) => void;
    onSetDefault?: (address: DeliveryAddress) => void;
    onChangeMode?: (address: DeliveryAddress, mode: DeliveryMode) => void;
    showActions?: boolean;
}

function AddressCard({
    address,
    isSelected = false,
    onSelect,
    onEdit,
    onDelete,
    onSetDefault,
    onChangeMode,
    showActions = true,
}: AddressCardProps) {
    const Icon = getAddressIcon(address.label as string);
    const [showModeMenu, setShowModeMenu] = useState(false);

    const handleModeChange = (mode: DeliveryMode) => {
        onChangeMode?.(address, mode);
        setShowModeMenu(false);
    };

    return (
        <div
            className={`relative rounded-lg border p-4 transition-all cursor-pointer hover:shadow-md ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
            onClick={() => onSelect?.(address)}
        >
            <div className="flex items-start gap-3">
                <div
                    className={`size-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                >
                    <Icon className="size-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground">
                            {address.label || "Unnamed address"}
                        </h3>
                        {address.isDefault && (
                            <Badge variant="secondary" className="gap-1">
                                <Star className="size-3" />
                                Default
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                            {address.deliveryMode}
                        </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                        {address.addressLine1}
                        {address.addressLine2 && `, ${address.addressLine2}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {address.city}
                        {address.county && `, ${address.county}`}
                        {address.postalCode && `, ${address.postalCode}`}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                        {address.country}
                    </p>
                </div>

                {showActions && (
                    <div className="flex gap-1 shrink-0">
                        {!address.isDefault && onSetDefault && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSetDefault(address);
                                }}
                                title="Set as default"
                            >
                                <Star className="size-3.5" />
                            </Button>
                        )}

                        {onEdit && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(address);
                                }}
                                title="Edit"
                            >
                                <Edit2 className="size-3.5" />
                            </Button>
                        )}

                        {onDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(address);
                                }}
                                title="Delete"
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        )}

                        {onChangeMode && (
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowModeMenu(!showModeMenu);
                                    }}
                                    title="Change delivery mode"
                                >
                                    <Navigation className="size-3.5" />
                                </Button>
                                {showModeMenu && (
                                    <div className="absolute right-0 top-full mt-1 bg-popover border rounded-md shadow-md z-10">
                                        {DELIVERY_MODES.map((mode) => (
                                            <button
                                                key={mode}
                                                className="block w-full px-3 py-1.5 text-sm text-left hover:bg-muted"
                                                onClick={() => handleModeChange(mode)}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}



