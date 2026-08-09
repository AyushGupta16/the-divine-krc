import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  QUICK_CREATE_CATEGORY_LABEL,
  QUICK_CREATE_CATEGORY_ORDER,
  QUICK_CREATE_ITEMS,
  QUICK_CREATE_POPOVER_ID,
  type QuickCreateItem,
  type QuickCreateKey,
} from "@/components/admin/quick-create-items";

/** Radix's own `Root`/`Portal`/`Content` — not the shadcn `dropdown-menu.tsx`
 *  wrapper, whose fixed item/content styling can't express the icon-tile +
 *  description + kbd-badge row this design calls for (spec #19). */

function useIsDesktop(breakpointPx: number): boolean {
  const [isDesktop, setIsDesktop] = React.useState(true);
  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpointPx]);
  return isDesktop;
}

const grouped: {
  category: (typeof QUICK_CREATE_ITEMS)[number]["category"];
  items: QuickCreateItem[];
}[] = QUICK_CREATE_CATEGORY_ORDER.map((category) => ({
  category,
  items: QUICK_CREATE_ITEMS.filter((i) => i.category === category),
})).filter((g) => g.items.length > 0);

function ItemIcon({ item }: { item: QuickCreateItem }) {
  const Icon = item.icon;
  return (
    <span className="flex size-6.5 shrink-0 items-center justify-center rounded-[5px] bg-[#f0e7d3] text-gold">
      <Icon className="size-3.5" strokeWidth={2} />
    </span>
  );
}

function ItemText({ item }: { item: QuickCreateItem }) {
  return (
    <span className="min-w-0 flex-1 leading-tight">
      <span className="block truncate text-[13px] font-semibold text-obsidian">{item.label}</span>
      <span className="mt-px block truncate text-[11px] text-[#4a4a4a]">{item.description}</span>
    </span>
  );
}

/** Desktop popover: Radix `DropdownMenu` gives us `role="menu"`, roving
 *  keyboard focus, outside-click/Esc dismissal, and focus-return-to-trigger
 *  for free — the exact behaviour spec #19 §8 asks for. */
function DesktopPopover({
  open,
  onOpenChange,
  onActivate,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: (key: QuickCreateKey) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger
        ref={triggerRef}
        aria-label="Create"
        aria-haspopup="menu"
        title="Create (N)"
        className={cn(
          "flex size-10 items-center justify-center rounded-[5px] outline-none transition-colors duration-120",
          "focus-visible:ring-3 focus-visible:ring-[#f0e7d3]",
          open
            ? "bg-obsidian text-gold-soft ring-3 ring-[#f0e7d3]"
            : "bg-gold text-obsidian hover:bg-[#b8934c]",
        )}
      >
        <Plus className="size-4.5" strokeWidth={2.4} />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          id={QUICK_CREATE_POPOVER_ID}
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          aria-labelledby="quick-create-popover-title"
          className={cn(
            "z-50 w-75 overflow-hidden rounded-[5px] border border-[#eae4d6] bg-[#fdfcf9]",
            "shadow-[0_14px_34px_rgba(10,10,10,0.14)] outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1",
            "duration-140",
          )}
        >
          <div className="px-3.5 pb-2 pt-3">
            <p
              id="quick-create-popover-title"
              className="font-display text-sm font-semibold text-obsidian"
            >
              Create
            </p>
            <p className="mt-px text-[11px] font-medium text-[#a49d8d]">Pick a record type</p>
          </div>

          {grouped.map((group) => (
            <div
              key={group.category}
              role="group"
              aria-label={QUICK_CREATE_CATEGORY_LABEL[group.category]}
            >
              <div
                role="presentation"
                className="border-t border-[#eae4d6] bg-[#f9f8f3] px-3.5 pb-1.5 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#a49d8d]"
              >
                {QUICK_CREATE_CATEGORY_LABEL[group.category]}
              </div>
              {group.items.map((item) => (
                <DropdownMenuPrimitive.Item
                  key={item.key}
                  aria-keyshortcuts={item.shortcut}
                  onSelect={() => onActivate(item.key)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-t border-[#eae4d6] px-3.5 py-2.75 outline-none",
                    "data-[highlighted]:bg-[#f9f8f3] data-[highlighted]:shadow-[inset_0_0_0_1px_#c5a059]",
                    "[&_kbd]:data-[highlighted]:text-gold",
                  )}
                >
                  <ItemIcon item={item} />
                  <ItemText item={item} />
                  <kbd
                    aria-hidden="true"
                    className="text-[10px] font-semibold uppercase text-[#a49d8d]"
                  >
                    {item.shortcut}
                  </kbd>
                </DropdownMenuPrimitive.Item>
              ))}
            </div>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

/** Mobile (≤639px): a full-width bottom sheet, not a dropdown — a Radix
 *  popover right-anchored to a header button either clips or spans
 *  awkwardly at phone widths (spec #19 §6). */
function MobileSheet({
  open,
  onOpenChange,
  onActivate,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: (key: QuickCreateKey) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger
        ref={triggerRef}
        aria-label="Create"
        title="Create"
        className={cn(
          "flex size-10 items-center justify-center rounded-[5px] outline-none transition-colors duration-120",
          open ? "bg-obsidian text-gold-soft ring-3 ring-[#f0e7d3]" : "bg-gold text-obsidian",
        )}
      >
        <Plus className="size-4.5" strokeWidth={2.4} />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-obsidian/42",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          id={QUICK_CREATE_POPOVER_ID}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[min(70vh,480px)] overflow-y-auto rounded-t-[5px] bg-[#fdfcf9] outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "duration-200",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Create</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Choose a record type to create.
          </DialogPrimitive.Description>
          <div className="flex items-center justify-between px-4 pb-2.5 pt-3">
            <div>
              <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-[#eae4d6]" />
              <p className="font-display text-sm font-semibold text-obsidian">Create</p>
              <p className="mt-px text-[11px] font-medium text-[#a49d8d]">Pick a record type</p>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="flex size-7 shrink-0 items-center justify-center rounded-[5px] bg-[#f9f8f3] text-obsidian"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          {grouped.map((group) => (
            <div key={group.category}>
              <div className="border-t border-[#eae4d6] bg-[#f9f8f3] px-4 pb-1.5 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#a49d8d]">
                {QUICK_CREATE_CATEGORY_LABEL[group.category]}
              </div>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onActivate(item.key)}
                  className="flex min-h-13 w-full items-center gap-3 border-t border-[#eae4d6] px-4 py-3.5 text-left"
                >
                  <ItemIcon item={item} />
                  <ItemText item={item} />
                </button>
              ))}
            </div>
          ))}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * The top-nav "+" — a chooser, not a link to one form. Desktop renders a
 * Radix `DropdownMenu` popover anchored to the trigger; ≤639px swaps to a
 * full-width bottom sheet (spec #19). Controlled (`open`/`onOpenChange`) so
 * the global `N` shortcut (wired by the caller) can open it, and so
 * `onActivate` can close it and hand off to the picked entry Sheet in one
 * beat.
 */
export function QuickCreatePopover({
  open,
  onOpenChange,
  onActivate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: (key: QuickCreateKey) => void;
}) {
  const isDesktop = useIsDesktop(640);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  function activate(key: QuickCreateKey) {
    onOpenChange(false);
    onActivate(key);
  }

  return isDesktop ? (
    <DesktopPopover
      open={open}
      onOpenChange={onOpenChange}
      onActivate={activate}
      triggerRef={triggerRef}
    />
  ) : (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      onActivate={activate}
      triggerRef={triggerRef}
    />
  );
}
