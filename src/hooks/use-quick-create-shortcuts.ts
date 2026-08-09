import { useEffect } from "react";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * The "+" chooser's global single-key shortcuts (spec #19 §4) — `B`/`E`/`G`
 * open the matching entry Sheet directly (bypassing the popover), `N` opens
 * the popover itself. `KeyboardEvent.code` is used so the binding is
 * layout-independent, and every handler is suppressed while typing in a
 * field or while a Sheet/the popover is already open, so e.g. typing "New
 * booking" into the guest-name field never re-triggers "New booking".
 */
export function useQuickCreateShortcuts({
  suppressed,
  onBooking,
  onEvent,
  onGuest,
  onOpenPopover,
}: {
  suppressed: boolean;
  onBooking: () => void;
  onEvent: () => void;
  onGuest: () => void;
  onOpenPopover: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
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
        case "KeyN":
          e.preventDefault();
          onOpenPopover();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [suppressed, onBooking, onEvent, onGuest, onOpenPopover]);
}
