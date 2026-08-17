import { describe, expect, it } from "vitest";

import { sortBookingRows, STATUS_ORDER } from "@/lib/bookings-sort";
import type { Booking, BookingListItem } from "@/types/booking";

function row(overrides: Partial<Booking> & { id: string }, guestName = "Guest"): BookingListItem {
  const booking: Booking = {
    guestId: "g1",
    roomNo: null,
    roomType: "deluxe",
    checkIn: "2026-08-10",
    checkOut: "2026-08-12",
    urn: 2,
    source: "direct",
    mealPlan: "EP",
    revenue: { room: 0, earlyCheckIn: 0, lateCheckOut: 0, other: 0, discount: 0, taxPct: 12 },
    totalBill: 0,
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "confirmed",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
  return { booking, guestName };
}

describe("sortBookingRows", () => {
  it("sorts strings ascending and descending", () => {
    const rows = [row({ id: "b" }), row({ id: "a" }), row({ id: "c" })];
    expect(sortBookingRows(rows, "id", "asc").map((r) => r.booking.id)).toEqual(["a", "b", "c"]);
    expect(sortBookingRows(rows, "id", "desc").map((r) => r.booking.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts numbers ascending and descending", () => {
    const rows = [row({ id: "1", urn: 3 }), row({ id: "2", urn: 1 }), row({ id: "3", urn: 2 })];
    expect(sortBookingRows(rows, "urn", "asc").map((r) => r.booking.id)).toEqual(["2", "3", "1"]);
    expect(sortBookingRows(rows, "urn", "desc").map((r) => r.booking.id)).toEqual(["1", "3", "2"]);
  });

  it("sorts ISO dates ascending and descending as strings", () => {
    const rows = [
      row({ id: "1", checkIn: "2026-08-15" }),
      row({ id: "2", checkIn: "2026-08-01" }),
      row({ id: "3", checkIn: "2026-08-10" }),
    ];
    expect(sortBookingRows(rows, "checkIn", "asc").map((r) => r.booking.id)).toEqual([
      "2",
      "3",
      "1",
    ]);
    expect(sortBookingRows(rows, "checkIn", "desc").map((r) => r.booking.id)).toEqual([
      "1",
      "3",
      "2",
    ]);
  });

  it("puts unassigned (null) rooms last regardless of direction", () => {
    const rows = [
      row({ id: "1", roomNo: "204" }),
      row({ id: "2", roomNo: null }),
      row({ id: "3", roomNo: "101" }),
    ];
    expect(sortBookingRows(rows, "roomNo", "asc").map((r) => r.booking.id)).toEqual([
      "3",
      "1",
      "2",
    ]);
    expect(sortBookingRows(rows, "roomNo", "desc").map((r) => r.booking.id)).toEqual([
      "1",
      "3",
      "2",
    ]);
  });

  it("sorts status by STATUS_ORDER, not alphabetically", () => {
    const rows = [
      row({ id: "1", status: "cancelled" }),
      row({ id: "2", status: "pending_payment" }),
      row({ id: "3", status: "confirmed" }),
    ];
    const asc = sortBookingRows(rows, "status", "asc").map((r) => r.booking.status);
    expect(asc).toEqual(["confirmed", "pending_payment", "cancelled"]);
    expect(STATUS_ORDER.indexOf("confirmed")).toBeLessThan(STATUS_ORDER.indexOf("pending_payment"));
    expect(STATUS_ORDER.indexOf("pending_payment")).toBeLessThan(STATUS_ORDER.indexOf("cancelled"));
  });

  it("returns rows unchanged when no sort key is set", () => {
    const rows = [row({ id: "b" }), row({ id: "a" })];
    expect(sortBookingRows(rows, null, "asc")).toBe(rows);
  });
});
