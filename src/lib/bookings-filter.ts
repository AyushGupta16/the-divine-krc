import { isUnassignedOccupyingBooking } from "@/lib/bookings";
import type { BookingListItem, BookingStatus } from "@/types/booking";

export type StatusFilterKey = BookingStatus | "all";

export interface BookingRowFilters {
  status: StatusFilterKey;
  /** The unassigned pill — stacks on `status`, doesn't replace it. */
  unassignedOnly: boolean;
  guestFilter?: string;
}

/**
 * The Bookings table's row-filter chain: status tab → unassigned pill (if
 * on) → guest search. Order matters only in that each stage narrows the
 * previous one; composing them this way (rather than three independent
 * predicates over `rows`) is what lets "Confirmed" + unassigned-on read as
 * "confirmed AND unassigned" instead of "confirmed OR unassigned."
 */
export function filterBookingRows(
  rows: BookingListItem[],
  filters: BookingRowFilters,
): BookingListItem[] {
  let out =
    filters.status === "all" ? rows : rows.filter((r) => r.booking.status === filters.status);

  if (filters.unassignedOnly) {
    out = out.filter((r) => isUnassignedOccupyingBooking(r.booking));
  }

  if (filters.guestFilter) {
    const needle = filters.guestFilter.toLowerCase();
    out = out.filter((r) => r.guestName.toLowerCase() === needle);
  }

  return out;
}
