import { useEffect } from "react";

import { QUICK_CREATE_POPOVER_ID } from "@/components/admin/quick-create-items";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Ancestor roles that mean "the user is inside a widget with its own
 *  keyboard vocabulary" — shadcn's `Select` renders a `role="combobox"`
 *  trigger and a `role="listbox"` content with Radix typeahead, not a real
 *  `<select>`, so `EDITABLE_TAGS` alone misses it: typing "b" to jump to an
 *  option in a meal-plan/room-type picker would otherwise also fire "New
 *  booking". `menu`/`menuitem` catches other dropdown menus (e.g. the
 *  sidebar account menu); `dialog`/`alertdialog` is defense-in-depth for the
 *  entry Sheets themselves, on top of the explicit `suppressed` flag the
 *  caller already passes for those three. */
const SUPPRESSING_ROLE_SELECTOR =
  '[role="listbox"], [role="option"], [role="combobox"], [role="menu"], [role="menuitem"], [role="dialog"], [role="alertdialog"]';

function isSuppressedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable) return true;
  if (target.getAttribute("aria-expanded") === "true") return true;

  const popper = target.closest(SUPPRESSING_ROLE_SELECTOR);
  if (!popper) return false;
  // The chooser's own popover/bottom-sheet is `role="menu"`/`role="dialog"`
  // too, but spec #19 §4 explicitly wants letter keys to keep firing while
  // it's open ("do not consume") — everything else in the selector above
  // should suppress, this one popper by id should not.
  return popper.closest(`#${QUICK_CREATE_POPOVER_ID}`) === null;
}

/**
 * The "+" chooser's global single-key shortcuts (spec #19 §4) — `B`/`E`/`G`/`P`
 * open the matching entry Sheet directly (bypassing the popover), `N` opens
 * the popover itself. `KeyboardEvent.code` is used so the binding is
 * layout-independent, and every handler is suppressed while typing in a
 * field, inside an open Select/menu/dialog anywhere in the app, or while a
 * Sheet is already open (the caller's `suppressed` flag) — so e.g. typing
 * "New booking" into the guest-name field, or using typeahead in a Select,
 * never re-triggers "New booking".
 */
export function useQuickCreateShortcuts({
  suppressed,
  onBooking,
  onEvent,
  onGuest,
  onPayment,
  onOpenPopover,
}: {
  suppressed: boolean;
  onBooking: () => void;
  onEvent: () => void;
  onGuest: () => void;
  onPayment: () => void;
  onOpenPopover: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isSuppressedTarget(e.target)) return;
      if (suppressed) return;

      switch (e.code) {
        case "KeyB":
          e.preventDefault();
          onBooking();
          break;
        case "KeyE":
          e.preventDefault();
          onEvent();
          break;
        case "KeyG":
          e.preventDefault();
          onGuest();
          break;
        case "KeyP":
          e.preventDefault();
          onPayment();
          break;
        case "KeyN":
          e.preventDefault();
          onOpenPopover();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [suppressed, onBooking, onEvent, onGuest, onPayment, onOpenPopover]);
}
