"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase, Check, Clock, Edit2, Home, MapPin, Navigation,
  Plus, Star, Store, Trash2, Truck, Package, ChevronRight,
  Building2, Users, Phone, Globe, Loader2
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Skeleton } from "@workspace/ui/components/skeleton";

import { AddAddressForm, type AddressFormValues } from "@/components/site/home/top-header/address-form";
import {
  useAddDeliveryAddress,
  useAddressHistory,
  useDeliveryAddresses,
  useDeliveryAddressStats,
  useDeliveryModeSettings,
  useGeocodeAddress,
  useRemoveDeliveryAddress,
  useSetDefaultDeliveryAddress,
  useUpdateAddressDeliveryMode,
  useUpdateDeliveryAddress,
  useValidateAddress,
} from "@/hooks/user/useDeliverySettings";
import { useUser } from "@/hooks/zustand/stores/use-auth-store";
import { useDeliverySettingsStore } from "@/hooks/zustand/stores/user/user-delivery-settings-store";
import {
  type CreateDeliveryAddressInput,
  type DeliveryAddress,
  type DeliveryMode,
  type UpdateDeliveryAddressInput,
} from "@/lib/user/delivery-settings.api";
import type { Branch } from "@/types/branch/branch-types";
import { useBranches } from "@/hooks/branch/useBranch";

// ─── Constants ────────────────────────────────────────────────────────────────

const DELIVERY_MODES = ["DELIVERY", "PICKUP"] as const satisfies DeliveryMode[];
type DeliveryModeTab = "DELIVERY" | "PICKUP";

// ─── History entry type ───────────────────────────────────────────────────────
interface AddressHistoryEntry extends DeliveryAddress {
  usageCount?: number;
  lastUsedAt?: string | Date;
}

// ─── Nairobi neighbourhood → emoji flag + colour ──────────────────────────────
const NAIROBI_AREAS: {
  keywords: string[];
  emoji: string;
  label: string;
  color: string;
}[] = [
    { keywords: ["westlands", "west lands"], emoji: "🏙️", label: "Westlands", color: "bg-sky-100 text-sky-700" },
    { keywords: ["karen"], emoji: "🌿", label: "Karen", color: "bg-green-100 text-green-700" },
    { keywords: ["kilimani"], emoji: "🌳", label: "Kilimani", color: "bg-emerald-100 text-emerald-700" },
    { keywords: ["kasarani"], emoji: "🏟️", label: "Kasarani", color: "bg-orange-100 text-orange-700" },
    { keywords: ["sunton", "sun ton"], emoji: "☀️", label: "Sunton", color: "bg-yellow-100 text-yellow-700" },
    { keywords: ["eastleigh"], emoji: "🕌", label: "Eastleigh", color: "bg-purple-100 text-purple-700" },
    { keywords: ["lang'ata", "langata", "lang ata"], emoji: "🦁", label: "Lang'ata", color: "bg-amber-100 text-amber-700" },
    { keywords: ["parklands"], emoji: "🌲", label: "Parklands", color: "bg-lime-100 text-lime-700" },
    { keywords: ["upper hill", "upperhill"], emoji: "🏦", label: "Upper Hill", color: "bg-blue-100 text-blue-700" },
    {
      keywords: ["cbd", "city centre", "city center",
        "nairobi cbd"], emoji: "🏛️", label: "CBD", color: "bg-slate-100 text-slate-700"
    },
    { keywords: ["ruaka"], emoji: "🌄", label: "Ruaka", color: "bg-rose-100 text-rose-700" },
    { keywords: ["gigiri"], emoji: "🌐", label: "Gigiri", color: "bg-cyan-100 text-cyan-700" },
    { keywords: ["lavington"], emoji: "🏡", label: "Lavington", color: "bg-teal-100 text-teal-700" },
    { keywords: ["south b", "south c", "south b/c"], emoji: "🏘️", label: "South B/C", color: "bg-indigo-100 text-indigo-700" },
    { keywords: ["thika road", "thika"], emoji: "🛣️", label: "Thika Road", color: "bg-orange-100 text-orange-700" },
    { keywords: ["embakasi"], emoji: "✈️", label: "Embakasi", color: "bg-violet-100 text-violet-700" },
    { keywords: ["ruiru"], emoji: "🌾", label: "Ruiru", color: "bg-green-100 text-green-700" },
    { keywords: ["kiambu"], emoji: "🌿", label: "Kiambu", color: "bg-lime-100 text-lime-700" },
    { keywords: ["rongai"], emoji: "🚌", label: "Rongai", color: "bg-pink-100 text-pink-700" },
    { keywords: ["kikuyu"], emoji: "⛰️", label: "Kikuyu", color: "bg-stone-100 text-stone-700" },
  ];

function getBranchAreaInfo(branch: Branch) {
  const haystack = `${branch.name} ${branch.address ?? ""}`.toLowerCase();
  const match = NAIROBI_AREAS.find((area) =>
    area.keywords.some((kw) => haystack.includes(kw))
  );
  return match ?? { keywords: [], emoji: "📍", label: "Nairobi", color: "bg-gray-100 text-gray-700" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAddressIcon(label: string | null) {
  const l = (label ?? "").toLowerCase();
  if (l.includes("work") || l.includes("office")) return Briefcase;
  if (l.includes("home")) return Home;
  if (l.includes("store") || l.includes("shop")) return Store;
  return MapPin;
}

function addressToFormValues(address: DeliveryAddress): Partial<AddressFormValues> {
  const [apartment = "", subcounty = ""] = (address.addressLine2 ?? "").split(/,\s*(.*)/).filter(Boolean);
  return {
    label: address.label ?? "",
    addressLine1: address.addressLine1 ?? "",
    subcounty,
    apartment,
    city: address.city ?? "",
    county: address.county ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? "KE",
    instructions: address.instructions ?? "",
    isDefault: address.isDefault ?? false,
    deliveryMode: address.deliveryMode ?? "DELIVERY",
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
  };
}

// ─── Mode Switch ──────────────────────────────────────────────────────────────

interface ModeSwitchProps {
  value: DeliveryModeTab;
  onChange: (v: DeliveryModeTab) => void;
}

function ModeSwitch({ value, onChange }: ModeSwitchProps) {
  return (
    <div className="relative flex items-center gap-1 p-1 bg-muted/60 rounded-2xl w-full max-w-sm border border-border/40">
      <div
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-background shadow-sm border border-border/30 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
        style={{ transform: value === "PICKUP" ? "translateX(calc(100% + 8px))" : "translateX(0)" }}
      />
      {(["DELIVERY", "PICKUP"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`relative z-10 flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors duration-200 ${value === mode ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
            }`}
        >
          {mode === "DELIVERY" ? (
            <Truck className="size-4 shrink-0" />
          ) : (
            <Package className="size-4 shrink-0" />
          )}
          {mode === "DELIVERY" ? "Deliver to me" : "Pick up"}
        </button>
      ))}
    </div>
  );
}

// ─── Branch Card ──────────────────────────────────────────────────────────────

interface BranchCardProps {
  branch: Branch;
  selected?: boolean;
  saving?: boolean;
  disabled?: boolean;
  onSelect: (branch: Branch) => void;
}

function BranchCard({ branch, selected, saving, disabled, onSelect }: BranchCardProps) {
  const area = getBranchAreaInfo(branch);

  const handleClick = () => {
    if (saving || disabled) return;
    onSelect(branch);
  };

  return (
    <button
      onClick={handleClick}
      disabled={saving || disabled}
      className={`
        group relative w-full text-left rounded-xl border-1 transition-all duration-200 overflow-hidden
        ${disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
        ${selected ? "border-primary bg-primary/5" : "border-muted bg-transparent"}
        ${!disabled && !selected ? "hover:border-muted-foreground/30" : ""}
      `}
    >
      <div className="p-4 flex items-start gap-4">
        <div className={`size-12 rounded-lg flex items-center justify-center text-2xl shrink-0 transition-transform duration-200 ${!disabled ? "group-hover:scale-105" : ""} ${area.color}`}>
          {area.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="font-bold text-foreground leading-tight tracking-tight">{branch.name}</h3>
              <p className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 opacity-80 ${area.color.split(" ")[1]}`}>
                {area.label}
              </p>
            </div>

            {saving ? (
              <Loader2 className="size-5 text-primary animate-spin shrink-0" />
            ) : selected || disabled ? (
              <div className="size-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Check className="size-3 text-primary-foreground" />
              </div>
            ) : null}
          </div>

          {branch.address && (
            <p className="text-sm text-muted-foreground/80 leading-relaxed line-clamp-1 mt-1 font-medium">
              {branch.address}
            </p>
          )}

          {branch.phone && (
            <div className="flex items-center gap-1.5 mt-2 opacity-70">
              <Phone className="size-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-semibold">{branch.phone}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Address Card ─────────────────────────────────────────────────────────────

interface AddressCardProps {
  address: DeliveryAddress;
  onSelect?: (address: DeliveryAddress) => void;
  onEdit?: (address: DeliveryAddress) => void;
  onDelete?: (address: DeliveryAddress) => void;
  onSetDefault?: (address: DeliveryAddress) => void;
}

function AddressCard({ address, onSelect, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  const Icon = getAddressIcon(address.label ?? null);

  return (
    <div
      className="group relative rounded-2xl w-full border-2 border-border/50 bg-card transition-all duration-200 hover:shadow-lg hover:border-primary/30 cursor-pointer overflow-hidden"
      onClick={() => onSelect?.(address)}
    >
      {address.isDefault && <div className="h-0.5 w-full bg-primary" />}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
            <Icon className="size-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-foreground">{address.label || "Unnamed address"}</h3>
              {address.isDefault && (
                <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary hover:bg-primary/20 text-xs">
                  <Star className="size-3 fill-primary" /> Default
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {address.addressLine1}
              {address.addressLine2 && `, ${address.addressLine2}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {address.city}
              {address.county && `, ${address.county}`}
            </p>
            <Badge variant="outline" className="mt-2 text-xs">
              {address.deliveryMode === "DELIVERY" ? "🚚 Delivery" : "📦 Pickup"}
            </Badge>
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
            {!address.isDefault && onSetDefault && (
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                onClick={(e) => { e.stopPropagation(); onSetDefault(address); }}>
                <Star className="size-4" />
              </Button>
            )}
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                onClick={(e) => { e.stopPropagation(); onEdit(address); }}>
                <Edit2 className="size-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(address); }}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Address Dialog ───────────────────────────────────────────────────────────

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  addressId?: string;
  initialValues?: Partial<AddressFormValues>;
  onSuccess: (address: DeliveryAddress) => void;
}

function AddressDialog({ open, onOpenChange, title, addressId, initialValues, onSuccess }: AddressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 flex flex-col h-[90vh] max-w-2xl">
        <div className="px-6 py-5 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-6">
            {open && (
              <AddAddressForm
                mode="delivery"
                addressId={addressId}
                initialValues={initialValues}
                onBack={() => onOpenChange(false)}
                onSuccess={onSuccess}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delivery Section ─────────────────────────────────────────────────────────

interface DeliverySectionProps {
  addresses: DeliveryAddress[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (a: DeliveryAddress) => void;
  onDelete: (a: DeliveryAddress) => void;
  onSetDefault: (a: DeliveryAddress) => void;
  onSelect: (a: DeliveryAddress) => void;
  history: AddressHistoryEntry[];
  onSelectHistory: (a: DeliveryAddress) => void;
}

function DeliverySection({
  addresses, isLoading, onAdd, onEdit, onDelete, onSetDefault, onSelect, history, onSelectHistory
}: DeliverySectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saved addresses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Saved Addresses</h2>
          <Button onClick={onAdd} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8">
            <Plus className="size-3.5" /> Add new
          </Button>
        </div>

        {addresses.length === 0 ? (
          <Card className="border-2 border-dashed border-muted">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <Truck className="size-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No delivery addresses yet</h3>
              <p className="text-muted-foreground text-sm text-center mb-4 max-w-xs">
                Add your home, work or any address to get deliveries right to your door
              </p>
              <Button onClick={onAdd} variant="outline" className="gap-2 rounded-full">
                <Plus className="size-4" /> Add Address
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onSetDefault={address.isDefault ? undefined : onSetDefault}
              />
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" /> Recently Used
          </h2>
          <div className="rounded-2xl border overflow-hidden divide-y">
            {history.slice(0, 4).map((entry) => {
              const Icon = getAddressIcon(entry.label ?? null);
              return (
                <button
                  key={entry.id}
                  className="flex items-center gap-3 w-full p-4 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => onSelectHistory(entry)}
                >
                  <div className="size-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.label || entry.addressLine1}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.city}{entry.county ? `, ${entry.county}` : ""}
                      {entry.usageCount != null && (
                        <> · Used {entry.usageCount}×</>
                      )}
                      {entry.lastUsedAt != null && (
                        <> · {new Date(entry.lastUsedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  {entry.isDefault && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs shrink-0">
                      Default
                    </Badge>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pickup Section (revamped) ────────────────────────────────────────────────

interface PickupSectionProps {
  pickupAddresses: DeliveryAddress[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (a: DeliveryAddress) => void;
  onDelete: (a: DeliveryAddress) => void;
  onSetDefault: (a: DeliveryAddress) => void;
  onSelect: (a: DeliveryAddress) => void;
  savingBranchId: string | null;
  onSelectBranch: (branch: Branch) => void;
}

function PickupSection({
  pickupAddresses,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onSetDefault,
  onSelect,
  savingBranchId,
  onSelectBranch,
}: PickupSectionProps) {
  const [search, setSearch] = useState("");

  // Set of saved branch names (used as labels)
  const savedBranchLabels = new Set(pickupAddresses.map(addr => addr.label).filter(Boolean));

  const { data: branchesData, isLoading: branchesLoading } = useBranches({
    filters: { isActive: true },
    limit: 100,
    staleTime: 1000 * 60 * 5,
  });

  const branches = branchesData?.branches ?? [];

  const filtered = branches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.address ?? "").toLowerCase().includes(q)
    );
  });

  // Group by area
  type AreaInfo = { emoji: string; label: string; color: string } | null;
  const grouped = new Map<string, { area: AreaInfo; branches: Branch[] }>();
  filtered.forEach((branch) => {
    const { keywords: _k, ...areaWithoutKeywords } = getBranchAreaInfo(branch);
    const key = areaWithoutKeywords.label;
    if (!grouped.has(key)) {
      grouped.set(key, {
        area: areaWithoutKeywords.label === "Nairobi" ? null : areaWithoutKeywords,
        branches: [],
      });
    }
    grouped.get(key)!.branches.push(branch);
  });

  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Determine currently selected branch (based on default pickup address)
  const defaultPickup = pickupAddresses.find(a => a.isDefault) ?? pickupAddresses[0];
  const selectedBranchName = defaultPickup?.label ?? null;

  // Handler for branch selection – prevents duplicate saves
  const handleBranchClick = useCallback((branch: Branch) => {
    if (savedBranchLabels.has(branch.name)) {
      toast.info(`${branch.name} is already saved as a pickup location`);
      return;
    }
    onSelectBranch(branch);
  }, [savedBranchLabels, onSelectBranch]);

  return (
    <div className="space-y-6">
      {/* Saved Pickup Addresses List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Saved Pickup Locations</h2>
          <Button onClick={onAdd} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8">
            <Plus className="size-3.5" /> Add manually
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : pickupAddresses.length === 0 ? (
          <Card className="border-2 border-dashed border-muted">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="size-14 rounded-full bg-muted flex items-center justify-center mb-2">
                <Package className="size-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm text-center">
                No saved pickup locations yet.<br />Select a branch below or add one manually.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pickupAddresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onSetDefault={address.isDefault ? undefined : onSetDefault}
              />
            ))}
          </div>
        )}
      </div>

      {/* Branch Selector */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Choose a Pickup Branch</h2>
          <p className="text-sm text-muted-foreground">
            {branches.length} location{branches.length !== 1 ? "s" : ""} available across Nairobi
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search area, e.g. Kasarani, Karen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
          />
        </div>

        {branchesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3">[-]</span>
            <p className="font-medium">No locations found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map(([areaLabel, { area, branches: areaBranches }]) => (
              <div key={areaLabel} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{area?.emoji ?? "📍"}</span>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {areaLabel}
                  </h3>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground">
                    {areaBranches.length} {areaBranches.length === 1 ? "branch" : "branches"}
                  </span>
                </div>

                <div className="grid gap-2.5 md:grid-cols-2">
                  {areaBranches.map((branch) => {
                    const isSaved = savedBranchLabels.has(branch.name);
                    return (
                      <BranchCard
                        key={branch.id}
                        branch={branch}
                        selected={selectedBranchName === branch.name}
                        saving={savingBranchId === branch.id}
                        disabled={isSaved}
                        onSelect={handleBranchClick}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddressesPage() {
  const router = useRouter();
  const user = useUser();
  const { addToHistory, setCurrentAddress } = useDeliverySettingsStore();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (hydrated && !user) router.push("/auth/login");
  }, [hydrated, user, router]);

  const [mode, setMode] = useState<DeliveryModeTab>("DELIVERY");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: deliveryAddresses = [], isLoading: loadingDelivery, refetch: refetchDelivery } =
    useDeliveryAddresses("DELIVERY");
  const { data: pickupAddresses = [], isLoading: loadingPickup, refetch: refetchPickup } =
    useDeliveryAddresses("PICKUP");
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useDeliveryAddressStats();
  const { data: rawHistory = [], refetch: refetchHistory } = useAddressHistory();
  const history = rawHistory as AddressHistoryEntry[];

  useDeliveryModeSettings();

  const isLoading = loadingDelivery || loadingPickup || loadingStats;

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const addAddress = useAddDeliveryAddress();
  const removeAddress = useRemoveDeliveryAddress();
  const setDefault = useSetDefaultDeliveryAddress();

  const refetchAll = useCallback(
    () => Promise.all([refetchDelivery(), refetchPickup(), refetchStats(), refetchHistory()]),
    [refetchDelivery, refetchPickup, refetchStats, refetchHistory],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAddSuccess = useCallback(async (newAddress: DeliveryAddress) => {
    addToHistory(newAddress);
    await refetchAll();
    setShowAddDialog(false);
    toast.success("Address added successfully");
  }, [addToHistory, refetchAll]);

  const handleEditSuccess = useCallback(async (_updated: DeliveryAddress) => {
    await refetchAll();
    setEditingAddress(null);
    toast.success("Address updated");
  }, [refetchAll]);

  const handleDeleteAddress = useCallback(async (address: DeliveryAddress) => {
    if (!confirm(`Delete "${address.label || address.addressLine1}"?`)) return;
    await removeAddress.mutateAsync(address.id);
    await refetchAll();
    toast.success("Address deleted");
  }, [removeAddress, refetchAll]);

  const handleSetDefault = useCallback(async (address: DeliveryAddress) => {
    await setDefault.mutateAsync(address.id);
    await refetchAll();
    toast.success("Default address updated");
  }, [setDefault, refetchAll]);

  const handleSelectAddress = useCallback((address: DeliveryAddress) => {
    setCurrentAddress(address);
    toast.success(`${address.label || "Address"} selected`);
  }, [setCurrentAddress]);

  const handleSelectBranch = useCallback(async (branch: Branch) => {
    setSavingBranchId(branch.id);
    try {
      const [addressLine1 = branch.name, addressLine2 = ""] =
        (branch.address ?? branch.name).split(/,(.*)/).map((s) => s.trim());

      await addAddress.mutateAsync({
        label: branch.name,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        city: "Nairobi",
        county: "Nairobi",
        country: "KE",
        deliveryMode: "PICKUP",
        isDefault: true,
        instructions: `Pickup at ${branch.name}`,
        ...(branch.latitude ? { latitude: branch.latitude } : {}),
        ...(branch.longitude ? { longitude: branch.longitude } : {}),
      } as CreateDeliveryAddressInput);

      await refetchAll();
      toast.success(`Pickup location saved — ${branch.name}`);
    } catch {
      toast.error("Failed to save pickup location");
    } finally {
      setSavingBranchId(null);
    }
  }, [addAddress, refetchAll]);

  if (!hydrated || isLoading) {
    return (
      <div className="w-full py-8 px-4 md:px-6 space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto py-8 px-4 md:px-6 space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery & Pickup</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your addresses for delivery and pickup
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2 rounded-full shadow-sm"
          size="sm"
        >
          <Plus className="size-4" /> Add Address
        </Button>
      </div>

      {/* Mode Switch */}
      <ModeSwitch value={mode} onChange={setMode} />

      {/* Stats summary */}
      {stats && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border/30">
          <MapPin className="size-4 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{stats.total}</span> saved address{stats.total !== 1 ? "es" : ""}
            {stats.byMode?.DELIVERY > 0 && (
              <> · <span className="font-semibold text-foreground">{stats.byMode.DELIVERY}</span> delivery</>
            )}
            {stats.byMode?.PICKUP > 0 && (
              <> · <span className="font-semibold text-foreground">{stats.byMode.PICKUP}</span> pickup</>
            )}
          </span>
        </div>
      )}

      {/* Content based on selected mode */}
      {mode === "DELIVERY" ? (
        <DeliverySection
          addresses={deliveryAddresses}
          isLoading={loadingDelivery}
          onAdd={() => setShowAddDialog(true)}
          onEdit={setEditingAddress}
          onDelete={handleDeleteAddress}
          onSetDefault={handleSetDefault}
          onSelect={handleSelectAddress}
          history={history}
          onSelectHistory={handleSelectAddress}
        />
      ) : (
        <PickupSection
          pickupAddresses={pickupAddresses}
          isLoading={loadingPickup}
          onAdd={() => setShowAddDialog(true)}
          onEdit={setEditingAddress}
          onDelete={handleDeleteAddress}
          onSetDefault={handleSetDefault}
          onSelect={handleSelectAddress}
          savingBranchId={savingBranchId}
          onSelectBranch={handleSelectBranch}
        />
      )}

      {/* Add/Edit Dialog */}
      <AddressDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title={mode === "DELIVERY" ? "Add Delivery Address" : "Add Pickup Location"}
        onSuccess={handleAddSuccess}
      />

      <AddressDialog
        open={!!editingAddress}
        onOpenChange={(open) => { if (!open) setEditingAddress(null); }}
        title="Edit Address"
        addressId={editingAddress?.id}
        initialValues={editingAddress ? addressToFormValues(editingAddress) : undefined}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}