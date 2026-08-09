import { CalendarPlus, Home, UserRound, type LucideIcon } from "lucide-react";

/** Declared, not yet shipped — a category with zero items renders no strip
 *  (`QuickCreatePopover` groups in this order and skips empty ones). */
export type QuickCreateCategory = "frontDesk" | "records" | "finance" | "ops";

export const QUICK_CREATE_CATEGORY_ORDER: QuickCreateCategory[] = [
  "frontDesk",
  "records",
  "finance",
  "ops",
];

export const QUICK_CREATE_CATEGORY_LABEL: Record<QuickCreateCategory, string> = {
  frontDesk: "Front desk",
  records: "Records",
  finance: "Finance",
  ops: "Ops",
};

export type QuickCreateKey = "booking" | "event" | "guest";

export interface QuickCreateItem {
  key: QuickCreateKey;
  label: string;
  description: string;
  category: QuickCreateCategory;
  icon: LucideIcon;
  /** `KeyboardEvent.code` suffix — `"KeyB"` etc. Layout-independent, single key, no modifier. */
  shortcut: "B" | "E" | "G";
}

/**
 * The "+" chooser's ship set (spec #19 §3.4/§7) — one array so a new item
 * ships without touching `QuickCreatePopover` itself. Only the catalogue
 * (label/description/icon/shortcut/category) lives here; the actual `open`
 * behaviour is a React state setter owned by whatever mounts the popover
 * (`AdminShell`), passed in as `onActivate`, since these Sheets are
 * mount-agnostic controlled components, not module-level singletons.
 */
export const QUICK_CREATE_ITEMS: QuickCreateItem[] = [
  {
    key: "booking",
    label: "New booking",
    description: "Guest stay in a room",
    category: "frontDesk",
    icon: Home,
    shortcut: "B",
  },
  {
    key: "event",
    label: "New event",
    description: "Party hall enquiry",
    category: "frontDesk",
    icon: CalendarPlus,
    shortcut: "E",
  },
  {
    key: "guest",
    label: "New guest",
    description: "Profile without a booking",
    category: "frontDesk",
    icon: UserRound,
    shortcut: "G",
  },
];
