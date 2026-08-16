import type { BookingListItem, BookingStatus } from "@/types/booking";

/** Mirrors the operational order `StatusTabs` renders in — not alphabetical. */
export const STATUS_ORDER: BookingStatus[] = [
  "confirmed",
  "checked_in",
  "checked_out",
  "pending_payment",
  "cancelled",
  "no_show",
];

export type SortableColumnKey =
  | "id"
  | "guestName"
  | "roomNo"
  | "roomType"
  | "checkIn"
  | "checkOut"
  | "urn"
  | "source"
  | "mealPlan"
  | "roomRev"
  | "earlyCheckIn"
  | "lateCheckOut"
  | "other"
  | "totalBill"
  | "paidToHotel"
  | "otaCollection"
  | "pending"
  | "status";

export type SortDir = "asc" | "desc";

function sortValue(item: BookingListItem, key: SortableColumnKey): string | number {
  const b = item.booking;
  switch (key) {
    case "id":
      return b.id;
    case "guestName":
      return item.guestName;
    case "roomType":
      return b.roomType;
    case "checkIn":
      return b.checkIn;
    case "checkOut":
      return b.checkOut;
    case "urn":
      return b.urn;
    case "source":
      return b.source;
    case "mealPlan":
      return b.mealPlan;
    case "roomRev":
      return b.revenue.room;
    case "earlyCheckIn":
      return b.revenue.earlyCheckIn;
    case "lateCheckOut":
      return b.revenue.lateCheckOut;
    case "other":
      return b.revenue.other;
    case "totalBill":
      return b.totalBill;
    case "paidToHotel":
      return b.collection.paidToHotel;
    case "otaCollection":
      return b.collection.otaCollection;
    case "pending":
      return b.collection.pending;
    case "status":
      return STATUS_ORDER.indexOf(b.status);
    case "roomNo":
      // Handled separately in compareBookingRows for the null-last rule.
      return "";
  }
}

/**
 * Room is nullable (unassigned) and unassigned rows sort last regardless of
 * direction — a null shouldn't collapse to an empty-string sort position.
 */
export function compareBookingRows(
  a: BookingListItem,
  b: BookingListItem,
  key: SortableColumnKey,
  dir: SortDir,
): number {
  if (key === "roomNo") {
    const av = a.booking.roomNo;
    const bv = b.booking.roomNo;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av.localeCompare(bv);
    return dir === "asc" ? cmp : -cmp;
  }

  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const cmp =
    typeof av === "string" && typeof bv === "string"
      ? av.localeCompare(bv)
      : (av as number) - (bv as number);
  return dir === "asc" ? cmp : -cmp;
}

/** Stable sort — ties (e.g. equal status) keep the server's booking-number order. */
export function sortBookingRows(
  rows: BookingListItem[],
  key: SortableColumnKey | null,
  dir: SortDir,
): BookingListItem[] {
  if (!key) return rows;
  return [...rows].sort((a, b) => compareBookingRows(a, b, key, dir));
}
