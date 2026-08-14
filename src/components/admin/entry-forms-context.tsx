import { createContext, useContext } from "react";

/**
 * The three entry-form openers `AdminShell` owns, reachable from whatever
 * route is mounted under its `<Outlet/>`. A page's own toolbar button (e.g.
 * Bookings' "New booking") calls the same opener the header quick-create
 * popover does — there is exactly one mount of each Sheet, in `AdminShell`;
 * nothing below it may mount its own copy. A prop can't cross `<Outlet/>`,
 * and this is transient UI state (is a Sheet open), not data a loader
 * produces or a URL should encode, so a plain context is the right tool —
 * not TanStack Router's route `context`, which is built for the data layer
 * and is awkward to mutate imperatively per click.
 */
export interface EntryForms {
  openBooking: () => void;
  openEvent: () => void;
  openGuest: () => void;
}

const EntryFormsContext = createContext<EntryForms | null>(null);

export function EntryFormsProvider({
  value,
  children,
}: {
  value: EntryForms;
  children: React.ReactNode;
}) {
  return <EntryFormsContext.Provider value={value}>{children}</EntryFormsContext.Provider>;
}

/** Throws if called outside `AdminShell`'s tree — every admin route is under
 *  it, so a missing provider means a mounting mistake, not a valid state. */
export function useEntryForms(): EntryForms {
  const ctx = useContext(EntryFormsContext);
  if (!ctx) throw new Error("useEntryForms must be used within AdminShell's tree.");
  return ctx;
}
