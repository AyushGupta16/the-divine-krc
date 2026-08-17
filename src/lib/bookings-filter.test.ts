import { describe, expect, it } from "vitest";

import { filterBookingRows } from "@/lib/bookings-filter";
import type { Booking, BookingListItem, BookingStatus } from "@/types/booking";

const TODAY = "2026-08-10";
const OTHER_DAY = "2026-08-01";

function row(id: string, overrides: Partial<Booking> = {}, guestName = "Guest"): BookingListItem {
  const booking: Booking = {
    id,
    guestId: "g1",
    roomNo: null,
    roomType: "deluxe",
    checkIn: OTHER_DAY,
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

describe("filterBookingRows", () => {
  const confirmedUnassigned = row("1", { status: "confirmed", roomNo: null });
  const confirmedAssigned = row("2", { status: "confirmed", roomNo: "204" });
  const checkedInUnassigned = row("3", { status: "checked_in", roomNo: null });
  const checkedOutUnassigned = row("4", { status: "checked_out", roomNo: null });
  const cancelledUnassigned = row("5", { status: "cancelled", roomNo: null });
  const noShowUnassigned = row("6", { status: "no_show", roomNo: null });
  const rows = [
    confirmedUnassigned,
    confirmedAssigned,
    checkedInUnassigned,
    checkedOutUnassigned,
    cancelledUnassigned,
    noShowUnassigned,
  ];

  it("status-only: filters to the active tab, unassigned pill off", () => {
    const out = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: false,
      today: TODAY,
    });
    expect(out.map((r) => r.booking.id)).toEqual(["1", "2"]);
  });

  it("unassigned-only: filters across all in-scope statuses, status tab on 'all'", () => {
    const out = filterBookingRows(rows, { status: "all", unassignedOnly: true, today: TODAY });
    expect(out.map((r) => r.booking.id)).toEqual(["1", "3"]);
  });

  it("status + unassigned compose as AND, not OR", () => {
    const out = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: true,
      today: TODAY,
    });
    expect(out.map((r) => r.booking.id)).toEqual(["1"]);
    expect(out).toContainEqual(confirmedUnassigned);
    expect(out).not.toContainEqual(confirmedAssigned);
  });

  it("a confirmed-assigned row appears under 'Confirmed' alone but drops out once unassigned turns on", () => {
    const statusOnly = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: false,
      today: TODAY,
    });
    expect(statusOnly).toContainEqual(confirmedAssigned);

    const statusAndUnassigned = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: true,
      today: TODAY,
    });
    expect(statusAndUnassigned).not.toContainEqual(confirmedAssigned);
  });

  it("never includes checked_out/cancelled/no_show rows when unassigned is on, even unfiltered by status", () => {
    const out = filterBookingRows(rows, { status: "all", unassignedOnly: true, today: TODAY });
    const ids = out.map((r) => r.booking.id);
    expect(ids).not.toContain(checkedOutUnassigned.booking.id);
    expect(ids).not.toContain(cancelledUnassigned.booking.id);
    expect(ids).not.toContain(noShowUnassigned.booking.id);
  });

  it("status that excludes the unassigned scope (e.g. checked_out) legitimately returns empty", () => {
    const out = filterBookingRows(rows, {
      status: "checked_out",
      unassignedOnly: true,
      today: TODAY,
    });
    expect(out).toEqual([]);
  });

  it("composes with guest search as a further narrowing step", () => {
    const out = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: false,
      guestFilter: "guest",
      today: TODAY,
    });
    expect(out.map((r) => r.booking.id)).toEqual(["1", "2"]);

    const noMatch = filterBookingRows(rows, {
      status: "confirmed",
      unassignedOnly: false,
      guestFilter: "nobody",
      today: TODAY,
    });
    expect(noMatch).toEqual([]);
  });

  // ── Stat-card toggles ─────────────────────────────────────────────────

  describe("stat-card toggles", () => {
    const checkInToday = row("10", { checkIn: TODAY, checkOut: "2026-08-15" });
    const checkInOtherDay = row("11", { checkIn: OTHER_DAY, checkOut: "2026-08-15" });
    const checkOutToday = row("12", { checkIn: "2026-08-05", checkOut: TODAY });
    const checkOutOtherDay = row("13", { checkIn: "2026-08-05", checkOut: "2026-08-20" });
    const cancelled = row("14", { status: "cancelled" });
    const noShow = row("15", { status: "no_show" });
    const confirmed = row("16", { status: "confirmed" });
    const pendingRow = row("17", {
      collection: {
        paidToHotel: 0,
        otaCollection: 0,
        otaCommission: 0,
        complimentary: 0,
        pending: 500,
      },
    });
    const noPendingRow = row("18", {
      collection: {
        paidToHotel: 500,
        otaCollection: 0,
        otaCommission: 0,
        complimentary: 0,
        pending: 0,
      },
    });
    const otaReceivableRow = row("19", {
      source: "booking_com",
      collection: {
        paidToHotel: 0,
        otaCollection: 1000,
        otaCommission: 150,
        complimentary: 0,
        pending: 0,
      },
    });
    const otaZeroRow = row("20", {
      source: "booking_com",
      collection: {
        paidToHotel: 0,
        otaCollection: 0,
        otaCommission: 0,
        complimentary: 0,
        pending: 0,
      },
    });
    const directWithOtaFieldRow = row("21", {
      source: "direct",
      collection: {
        paidToHotel: 0,
        otaCollection: 1000,
        otaCommission: 0,
        complimentary: 0,
        pending: 0,
      },
    });

    it("checkInsToday: rows whose checkIn matches the injected today, not wall-clock", () => {
      const out = filterBookingRows([checkInToday, checkInOtherDay], {
        status: "all",
        unassignedOnly: false,
        checkInsToday: true,
        today: TODAY,
      });
      expect(out.map((r) => r.booking.id)).toEqual(["10"]);
    });

    it("checkOutsToday: rows whose checkOut matches the injected today", () => {
      const out = filterBookingRows([checkOutToday, checkOutOtherDay], {
        status: "all",
        unassignedOnly: false,
        checkOutsToday: true,
        today: TODAY,
      });
      expect(out.map((r) => r.booking.id)).toEqual(["12"]);
    });

    it("cancellations: returns cancelled + no_show regardless of the active status chip", () => {
      const set = [cancelled, noShow, confirmed];
      const out = filterBookingRows(set, {
        status: "all",
        unassignedOnly: false,
        cancellations: true,
        today: TODAY,
      });
      expect(out.map((r) => r.booking.id).sort()).toEqual(["14", "15"]);
    });

    it("cancellations + a non-cancelled single status chip legitimately returns empty", () => {
      const set = [cancelled, noShow, confirmed];
      const out = filterBookingRows(set, {
        status: "confirmed",
        unassignedOnly: false,
        cancellations: true,
        today: TODAY,
      });
      expect(out).toEqual([]);
    });

    it("pendingOnly: rows with collection.pending > 0", () => {
      const out = filterBookingRows([pendingRow, noPendingRow], {
        status: "all",
        unassignedOnly: false,
        pendingOnly: true,
        today: TODAY,
      });
      expect(out.map((r) => r.booking.id)).toEqual(["17"]);
    });

    it("otaReceivables: OTA-sourced rows currently holding a receivable — excludes zero-balance OTA rows and direct-sourced rows even with otaCollection set", () => {
      const out = filterBookingRows([otaReceivableRow, otaZeroRow, directWithOtaFieldRow], {
        status: "all",
        unassignedOnly: false,
        otaReceivables: true,
        today: TODAY,
      });
      expect(out.map((r) => r.booking.id)).toEqual(["19"]);
    });

    it("stacks two toggles together: checkInsToday + a status chip", () => {
      const confirmedToday = row("22", { status: "confirmed", checkIn: TODAY });
      const cancelledToday = row("23", { status: "cancelled", checkIn: TODAY });
      const out = filterBookingRows([confirmedToday, cancelledToday, checkInOtherDay], {
        status: "confirmed",
        unassignedOnly: false,
        checkInsToday: true,
        today: TODAY,
      });
      expect(out.map((r) => r.booking.id)).toEqual(["22"]);
    });

    it("stacks two toggles together: pendingOnly + unassignedOnly", () => {
      const pendingUnassigned = row("24", { roomNo: null, status: "confirmed" });
      pendingUnassigned.booking.collection.pending = 500;
      const pendingAssigned = row("25", { roomNo: "204", status: "confirmed" });
      pendingAssigned.booking.collection.pending = 500;
      const unassignedNoPending = row("26", { roomNo: null, status: "confirmed" });

      const out = filterBookingRows([pendingUnassigned, pendingAssigned, unassignedNoPending], {
        status: "all",
        unassignedOnly: true,
        pendingOnly: true,
        today: TODAY,
      });
      expect(out.map((r) => r.booking.id)).toEqual(["24"]);
    });
  });
});
