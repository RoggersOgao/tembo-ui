// components/site/home/top-header/edit-address-form.tsx

"use client";

import { KE_COUNTIES } from "@/components/site/home/top-header/address-form";
import { useUpdateDeliveryAddress, useRemoveDeliveryAddress } from "@/hooks/user/useDeliverySettings";
import type { DeliveryAddress } from "@/lib/user/delivery-settings.api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import {
    ArrowLeft,
    Briefcase,
    Building2,
    Check,
    Hash,
    Home,
    Loader2,
    LucideIcon,
    MapPin,
    MessageSquare,
    Navigation,
    Star,
    Store,
    Trash2,
    AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";

// ─── Label presets ────────────────────────────────────────────────────────────

const LABEL_PRESETS = [
    { value: "Home", icon: Home, color: "text-rose-500", bg: "bg-rose-50   border-rose-200   data-[active=true]:bg-rose-100   data-[active=true]:border-rose-400" },
    { value: "Work", icon: Briefcase, color: "text-sky-500", bg: "bg-sky-50    border-sky-200    data-[active=true]:bg-sky-100    data-[active=true]:border-sky-400" },
    { value: "Other", icon: MapPin, color: "text-violet-500", bg: "bg-violet-50 border-violet-200 data-[active=true]:bg-violet-100 data-[active=true]:border-violet-400" },
] as const;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
    icon: Icon,
    title,
    children,
}: {
    icon: LucideIcon;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Icon className="size-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {title}
                </span>
            </div>
            {children}
        </div>
    );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground/80">
                {label}
                {required && <span className="text-rose-500 ml-0.5">*</span>}
            </Label>
            {children}
        </div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditAddressFormProps {
    address: DeliveryAddress;
    onBack: () => void;
    onSuccess: (address: DeliveryAddress) => void;
    onDelete?: (addressId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditAddressForm({ address, onBack, onSuccess, onDelete }: EditAddressFormProps) {
    const [formData, setFormData] = useState({
        label: address.label ?? "",
        addressLine1: address.addressLine1 ?? "",
        addressLine2: address.addressLine2 ?? "",
        city: address.city ?? "",
        county: address.county ?? "",
        postalCode: address.postalCode ?? "",
        instructions: address.instructions ?? "",
        isDefault: address.isDefault ?? false,
    });

    const [customLabel, setCustomLabel] = useState(
        LABEL_PRESETS.some((p) => p.value === formData.label) ? "" : formData.label
    );
    const [showCustomLabel, setShowCustomLabel] = useState(
        !LABEL_PRESETS.some((p) => p.value === formData.label) && !!formData.label
    );
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const updateAddress = useUpdateDeliveryAddress();
    const removeAddress = useRemoveDeliveryAddress();
    const isPending = updateAddress.isPending;
    const isDeleting = removeAddress.isPending;

    const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
        setFormData((prev) => ({ ...prev, [key]: value }));

    const handlePresetLabel = (value: string) => {
        setShowCustomLabel(false);
        setCustomLabel("");
        set("label", value);
    };

    const handleCustomLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCustomLabel(val);
        set("label", val);
    };
    const handleSubmit = async () => {
        if (!formData.addressLine1.trim()) {
            toast.error("Street address is required");
            return;
        }
        if (!formData.city.trim()) {
            toast.error("City is required");
            return;
        }

        try {
            const response = await updateAddress.mutateAsync({
                addressId: address.id,
                data: formData,
            });

            // Check if response was successful and has data
            if (response.success && response.data) {
                toast.success("Address updated successfully");
                onSuccess(response.data as DeliveryAddress);
            } else {
                toast.error(response.errors?.[0]?.message || "Failed to update address");
            }
        } catch (error) {
            console.error("Update address error:", error);
            toast.error("Failed to update address. Please try again.");
        }
    };

    const handleDelete = async () => {
        try {
            const response = await removeAddress.mutateAsync(address.id);

            if (response.success) {
                toast.success("Address deleted successfully");
                setShowDeleteDialog(false);
                if (onDelete) {
                    onDelete(address.id);
                } else {
                    onBack();
                }
            } else {
                toast.error(response.errors?.[0]?.message || "Failed to delete address");
            }
        } catch (error) {
            console.error("Delete address error:", error);
            toast.error("Failed to delete address. Please try again.");
        }
    };

    const activePreset = LABEL_PRESETS.find((p) => p.value === formData.label);

    return (
        <>
            <div className="flex flex-col h-full bg-background">
                {/* ── Header ── */}
                <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent shrink-0">
                    <button
                        onClick={onBack}
                        className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                        <ArrowLeft className="size-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-foreground leading-tight">Edit Address</h2>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {address.addressLine1}{address.city ? `, ${address.city}` : ""}
                        </p>
                    </div>
                    {/* Live preview badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40">
                        {activePreset ? (
                            <activePreset.icon className={`size-3 ${activePreset.color}`} />
                        ) : (
                            <MapPin className="size-3 text-muted-foreground" />
                        )}
                        <span className="text-xs font-medium text-muted-foreground">
                            {formData.label || "No label"}
                        </span>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-5 py-6 space-y-7">
                        {/* Label */}
                        <Section icon={Star} title="Label">
                            <div className="flex gap-2 flex-wrap">
                                {LABEL_PRESETS.map(({ value, icon: Icon, color, bg }) => (
                                    <button
                                        key={value}
                                        data-active={formData.label === value && !showCustomLabel}
                                        onClick={() => handlePresetLabel(value)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 ${bg}`}
                                    >
                                        <Icon className={`size-3.5 ${color}`} />
                                        {value}
                                        {formData.label === value && !showCustomLabel && (
                                            <Check className="size-3 ml-0.5 text-primary" />
                                        )}
                                    </button>
                                ))}
                                <button
                                    data-active={showCustomLabel}
                                    onClick={() => {
                                        setShowCustomLabel(true);
                                        set("label", customLabel);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 bg-muted/40 border-muted-foreground/20 text-muted-foreground hover:bg-muted data-[active=true]:bg-primary/10 data-[active=true]:border-primary/40 data-[active=true]:text-primary"
                                >
                                    <Hash className="size-3.5" />
                                    Custom
                                </button>
                            </div>

                            {showCustomLabel && (
                                <div className="relative mt-1">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                    <Input
                                        autoFocus
                                        value={customLabel}
                                        onChange={handleCustomLabelChange}
                                        placeholder="e.g. Parents' House, Gym…"
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                            )}
                        </Section>

                        {/* Street */}
                        <Section icon={MapPin} title="Street Address">
                            <Field label="Street / Road" required>
                                <div className="relative">
                                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        value={formData.addressLine1}
                                        onChange={(e) => set("addressLine1", e.target.value)}
                                        placeholder="e.g. Ngong Road, Kilimani"
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                            </Field>

                            <Field label="Apartment / Floor / Suite">
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        value={formData.addressLine2}
                                        onChange={(e) => set("addressLine2", e.target.value)}
                                        placeholder="e.g. Apt 4B, 2nd Floor"
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                            </Field>
                        </Section>

                        {/* Location */}
                        <Section icon={MapPin} title="Location">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="City" required>
                                    <div className="relative">
                                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                        <Input
                                            value={formData.city}
                                            onChange={(e) => set("city", e.target.value)}
                                            placeholder="Nairobi"
                                            className="pl-8 h-9 text-sm"
                                        />
                                    </div>
                                </Field>

                                <Field label="Postal Code">
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                        <Input
                                            value={formData.postalCode}
                                            onChange={(e) => set("postalCode", e.target.value)}
                                            placeholder="00100"
                                            className="pl-8 h-9 text-sm"
                                        />
                                    </div>
                                </Field>
                            </div>

                            <Field label="County">
                                <Select value={formData.county} onValueChange={(v) => set("county", v)}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                                            <SelectValue placeholder="Select county" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {KE_COUNTIES.map((county) => (
                                            <SelectItem key={county} value={county} className="text-sm">
                                                {county}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </Section>

                        {/* Delivery instructions */}
                        <Section icon={MessageSquare} title="Delivery Instructions">
                            <Field label="Instructions for the driver">
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-3 size-3.5 text-muted-foreground pointer-events-none" />
                                    <Textarea
                                        value={formData.instructions}
                                        onChange={(e) => set("instructions", e.target.value)}
                                        placeholder="Gate code, landmark, leave at door…"
                                        className="pl-8 text-sm resize-none min-h-[80px]"
                                        rows={3}
                                    />
                                </div>
                            </Field>
                        </Section>

                        {/* Default toggle */}
                        <div className={`flex items-center justify-between rounded-xl border px-4 py-3.5 transition-colors ${formData.isDefault
                                ? "bg-primary/5 border-primary/30"
                                : "bg-muted/30 border-border/40"
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`size-8 rounded-lg flex items-center justify-center transition-colors ${formData.isDefault ? "bg-primary/15" : "bg-muted"
                                    }`}>
                                    <Star className={`size-4 transition-colors ${formData.isDefault ? "text-primary fill-primary" : "text-muted-foreground"
                                        }`} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Set as default</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Used automatically at checkout
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={formData.isDefault}
                                onCheckedChange={(v) => set("isDefault", v)}
                            />
                        </div>
                    </div>
                </ScrollArea>

                {/* ── Footer ── */}
                <div className="px-5 py-4 border-t bg-background/80 backdrop-blur-sm shrink-0">
                    <div className="flex gap-2.5">
                        {onDelete && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setShowDeleteDialog(true)}
                                disabled={isPending || isDeleting}
                                className="h-10 rounded-xl text-sm gap-2"
                            >
                                {isDeleting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Trash2 className="size-4" />
                                )}
                                Delete
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={onBack}
                            disabled={isPending || isDeleting}
                            className="flex-1 h-10 rounded-xl text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isPending || isDeleting}
                            className="flex-1 h-10 rounded-xl text-sm gap-2 shadow-sm"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Check className="size-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="size-5 text-destructive" />
                            Delete Address?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{address.label || address.addressLine1}"?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}