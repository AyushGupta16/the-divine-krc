// Pure booking calculations. No I/O, no framework — safe to unit test in isolation.

import type { BookingCollection, BookingRevenue } from "@/types/booking";

/**
 * Total bill = (room + earlyCheckIn + lateCheckOut + other) - discount + GST,
 * where GST is taxPct% of the discounted taxable subtotal.
 * Result is rounded to the nearest rupee.
 */
export function computeTotalBill(revenue: BookingRevenue): number {
  const { room, earlyCheckIn, lateCheckOut, other, discount, taxPct } = revenue;
  const gross = room + earlyCheckIn + lateCheckOut + other;
  const taxable = Math.max(0, gross - discount);
  const tax = taxable * (taxPct / 100);
  return Math.round(taxable + tax);
}

/**
 * Total collected = paidToHotel + otaCollection + complimentary.
 * OTA commission and pending are not money in hand, so they are excluded.
 */
export function computeTotalCollected(collection: BookingCollection): number {
  return (
    collection.paidToHotel +
    collection.otaCollection +
    collection.complimentary
  );
}

/**
 * Number of nights between two ISO dates (checkOut - checkIn), floored at 0.
 */
export function urn(checkIn: string, checkOut: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const inMs = Date.parse(checkIn);
  const outMs = Date.parse(checkOut);
  if (Number.isNaN(inMs) || Number.isNaN(outMs)) return 0;
  return Math.max(0, Math.round((outMs - inMs) / MS_PER_DAY));
}

/** Format a rupee amount as e.g. "₹1,500" (no paise). */
export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Booking id: KRC-YYYYMMDD-nnn.
 * @param date  a Date or ISO string for the booking day
 * @param seq   1-based sequence number for that day (zero-padded to 3)
 */
export function bookingId(date: Date | string, seq: number): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const n = String(seq).padStart(3, "0");
  return `KRC-${y}${m}${day}-${n}`;
}
