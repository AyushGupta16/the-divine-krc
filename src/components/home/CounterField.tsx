// A "dropdown counter": looks like the stay bar's other dropdown fields (same
// trigger typography) but opens a +/- stepper instead of a scrollable list.
// Shared between the marketing AvailabilityBar and the guest booking flow so
// both count guests/rooms the same way.

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CounterField({
  value,
  onChange,
  min,
  max,
  label,
  unitLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  label: string;
  unitLabel: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left font-display text-lg text-obsidian transition-colors hover:text-gold md:text-xl"
        >
          {unitLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-4" align="start">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-obsidian">{label}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChange(Math.max(min, value - 1))}
              disabled={value <= min}
              aria-label={`Fewer ${label}`}
              className="flex size-7 items-center justify-center rounded-full border border-gold/30 text-obsidian transition-colors hover:border-gold disabled:opacity-30"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-4 text-center text-[14px] text-obsidian">{value}</span>
            <button
              type="button"
              onClick={() => onChange(Math.min(max, value + 1))}
              disabled={value >= max}
              aria-label={`More ${label}`}
              className="flex size-7 items-center justify-center rounded-full border border-gold/30 text-obsidian transition-colors hover:border-gold disabled:opacity-30"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
