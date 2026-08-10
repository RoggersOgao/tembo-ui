"use client";

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { cn } from '@workspace/ui/lib/utils';
import { Drumstick, Plus, X } from 'lucide-react';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Matches the form's tag shape: { id?: string; name: string } */
export interface TagItem {
  id?: string;
  name: string;
}

interface TagsSelectorProps {
  /** Array of tag objects — same shape stored in the form */
  amenities: TagItem[];
  onAmenitiesChange: (amenities: TagItem[]) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_TAGS: { group: string; tags: readonly string[] }[] = [
  {
    group: 'Cut',
    tags: ['Whole Bird', 'Half Bird', 'Quarter', 'Breast', 'Thigh', 'Drumstick', 'Wing', 'Fillet'],
  },
  {
    group: 'Prep Style',
    tags: ['Grilled', 'Fried', 'Roasted', 'Smoked', 'Marinated', 'Crumbed', 'Skewered'],
  },
  {
    group: 'Dietary',
    tags: ['Halal', 'Free Range', 'Organic', 'Antibiotic-Free', 'Gluten-Free', 'Low Sodium'],
  },
  {
    group: 'Spice Level',
    tags: ['Plain', 'Mild', 'Medium', 'Hot', 'Extra Hot', 'Peri-Peri'],
  },
  {
    group: 'Packaging',
    tags: ['Family Pack', 'Bulk', 'Single Serve', 'Frozen', 'Fresh', 'Vacuum Sealed'],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const KukuShopTagsSelector = ({
  amenities,
  onAmenitiesChange,
  className,
}: TagsSelectorProps) => {
  const [customInput, setCustomInput] = useState('');

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Compare by name — id may not exist yet for unsaved tags
  const isSelected = (name: string) =>
    amenities.some(t => t.name.toLowerCase() === name.toLowerCase());

  const toggle = (name: string) => {
    if (isSelected(name)) {
      onAmenitiesChange(amenities.filter(t => t.name.toLowerCase() !== name.toLowerCase()));
    } else {
      onAmenitiesChange([...amenities, { name }]);
    }
  };

  const remove = (name: string) => {
    onAmenitiesChange(amenities.filter(t => t.name.toLowerCase() !== name.toLowerCase()));
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed || isSelected(trimmed)) return;
    onAmenitiesChange([...amenities, { name: trimmed }]);
    setCustomInput('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-4', className)}>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Drumstick className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold underline underline-offset-2">Product Tags</p>
      </div>

      {/* Grouped preset toggles */}
      <div className="space-y-3">
        {PRESET_TAGS.map(({ group, tags }) => (
          <div key={group} className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    isSelected(tag)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected badges */}
      {amenities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Selected:</p>
          <div className="flex flex-wrap gap-1.5">
            {amenities.map((tag, i) => (
              <Badge
                // Use id when available, fall back to name+index so the key is
                // always a primitive string — never [object Object]
                key={tag.id ?? `${tag.name}-${i}`}
                variant="default"
                className="gap-1 pl-2.5 pr-1.5 py-0.5 text-xs"
              >
                {tag.name}
                <button
                  type="button"
                  aria-label={`Remove ${tag.name}`}
                  onClick={() => remove(tag.name)}
                  className="rounded-full p-0.5 transition-colors hover:bg-white/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Custom tag input */}
      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a custom tag…"
          className="flex-1 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={addCustom}
          disabled={!customInput.trim() || isSelected(customInput.trim())}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
};