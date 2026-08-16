import { describe, expect, it } from "vitest";

import { filterBookingRows } from "@/lib/bookings-filter";
import type { Booking, BookingListItem, BookingStatus } from "@/types/booking";

function row(
  id: string,
  status: BookingStatus,
  roomNo: string | null,
  guestName = "Guest",
): BookingListItem {
  const booking: Booking = {
    id,
    guestId: "g1",
    roomNo,
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
    status,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  return { booking, guestName };
}

describe("filterBookingRows", () => {
  const confirmedUnassigned = row("1", "confirmed", null);
  const confirmedAssigned = row("2", "confirmed", "204");
  const checkedInUnassigned = row("3", "checked_in", null);
  const checkedOutUnassigned = row("4", "checked_out", null);
  const cancelledUnassigned = row("5", "cancelled", null);
  const noShowUnassigned = row("6", "no_show", null);
  const rows = [
    confirmedUnassigned,
    confirmedAssigned,
    checkedInUnassigned,
    checkedOutUnassigned,
    cancelledUnassigned,
    noShowUnassigned,
  ];

  it("status-only: filters to the active tab, unassigned pill off", () => {
    const out = filterBookingRows(rows, { status: "confirmed", unassignedOnly: false });
    expect(out.map((r) => r.booking.id)).toEqual(["1", "2"]);
  });

  it("unassigned-only: filters across all in-scope statuses, status tab on 'all'", () => {
    const out = filterBookingRows(rows, { status: "all", unassignedOnly: true });
    expect(out.map((r) => r.booking.id)).toEqual(["1", "3"]);
  });

  it("status + unassigned compose as AND, not OR", () => {
    const out = filterBookingRows(rows, { status: "confirmed", unassignedOnly: true });
    expect(out.map((r) => r.booking.id)).toEqual(["1"]);
    expect(out).toContainEqual(confirmedUnassigned);
    expect(out).not.toContainEqual(confirmedAssigned);
  });

  it("a confirmed-assigned row appears under 'Confirmed' alone but drops out once unassigned turns on", () => {
    const statusOnly = filterBookingRows(rows, { status: "confirmed", unassignedOnly: false });
    expect(statusOnly).toContainEqual(confirmedAssigned);

    const statusAndUnassigned = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: true,
    });
    expect(statusAndUnassigned).not.toContainEqual(confirmedAssigned);
  });

  it("never includes checked_out/cancelled/no_show rows when unassigned is on, even unfiltered by status", () => {
    const out = filterBookingRows(rows, { status: "all", unassignedOnly: true });
    const ids = out.map((r) => r.booking.id);
    expect(ids).not.toContain(checkedOutUnassigned.booking.id);
    expect(ids).not.toContain(cancelledUnassigned.booking.id);
    expect(ids).not.toContain(noShowUnassigned.booking.id);
  });

  it("status that excludes the unassigned scope (e.g. checked_out) legitimately returns empty", () => {
    const out = filterBookingRows(rows, { status: "checked_out", unassignedOnly: true });
    expect(out).toEqual([]);
  });

  it("composes with guest search as a further narrowing step", () => {
    const out = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: false,
      guestFilter: "guest",
    });
    expect(out.map((r) => r.booking.id)).toEqual(["1", "2"]);

    const noMatch = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: false,
      guestFilter: "nobody",
    });
    expect(noMatch).toEqual([]);
  });
});
