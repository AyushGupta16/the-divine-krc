import {
  isCancelledOrNoShow,
  isCheckInOn,
  isCheckOutOn,
  isOtaSource,
  isUnassignedOccupyingBooking,
} from "@/lib/bookings";
import type { BookingListItem, BookingStatus } from "@/types/booking";

export type StatusFilterKey = BookingStatus | "all";

export interface BookingRowFilters {
  status: StatusFilterKey;
  /** The unassigned pill (and the "Unassigned rooms" stat card, which shares
   *  this same state) — stacks on `status`, doesn't replace it. */
  unassignedOnly: boolean;
  /** "Today's check-ins" stat card — `checkIn === today`. */
  checkInsToday?: boolean;
  /** "Today's check-outs" stat card — `checkOut === today`. */
  checkOutsToday?: boolean;
  /** "Cancellations" stat card — `status` is `cancelled` or `no_show`. A
   *  separate two-status filter, independent of `status`/the single-select
   *  chips: turning this on with e.g. `status: "confirmed"` legitimately
   *  yields nothing, since no row can be both. */
  cancellations?: boolean;
  /** "Pending from guests" stat card — `collection.pending > 0`. */
  pendingOnly?: boolean;
  /** "OTA receivables" stat card — sold through an OTA and currently holding
   *  a receivable. */
  otaReceivables?: boolean;
  guestFilter?: string;
  /** ISO date the check-in/check-out toggles are measured against —
   *  injected by the caller (the page's `data.today`), never read from
   *  `new Date()` here, so this stays a pure, wall-clock-independent
   *  function. */
  today: string;
}

/**
 * The Bookings table's row-filter chain: status tab → unassigned pill →
 * check-ins-today → check-outs-today → cancellations → pending → OTA
 * receivables (each only if on) → guest search. Every stage narrows the
 * previous one, so e.g. "Confirmed" + unassigned-on reads as "confirmed AND
 * unassigned," not "confirmed OR unassigned," and any combination of
 * stat-card toggles stacks the same way.
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

  if (filters.checkInsToday) {
    out = out.filter((r) => isCheckInOn(r.booking, filters.today));
  }

  if (filters.checkOutsToday) {
    out = out.filter((r) => isCheckOutOn(r.booking, filters.today));
  }

  if (filters.cancellations) {
    out = out.filter((r) => isCancelledOrNoShow(r.booking));
  }

  if (filters.pendingOnly) {
    out = out.filter((r) => r.booking.collection.pending > 0);
  }

  if (filters.otaReceivables) {
    out = out.filter(
      (r) => isOtaSource(r.booking.source) && r.booking.collection.otaCollection > 0,
    );
  }

  if (filters.guestFilter) {
    const needle = filters.guestFilter.toLowerCase();
    out = out.filter((r) => r.guestName.toLowerCase() === needle);
  }

  return out;
}
