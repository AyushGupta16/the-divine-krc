import { describe, expect, it } from "vitest";

import {
  createBooking,
  getBookingsPageData,
  markBookingPaid,
  type NewBookingInput,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { computeTotalBill, computeTotalCollected } from "@/lib/booking-math";

const NEW_BOOKING: NewBookingInput = {
  guestName: "Kavya Iyer",
  guestPhone: "+91 90000 11111",
  guestEmail: "kavya.iyer@example.com",
  guestCity: "Pune",
  roomType: "deluxe",
  roomNo: null,
  checkIn: "2026-08-01",
  checkOut: "2026-08-03",
  source: "phone",
  mealPlan: "EP",
};

describe("getBookingsPageData", () => {
  it("returns one row per seeded booking and a joined guest name", async () => {
    const data = await getBookingsPageData(fixtures, "2026-07-15");
    expect(data.rows.length).toBe(data.total);
    expect(data.rows.length).toBeGreaterThan(0);
    for (const { guestName } of data.rows) {
      expect(guestName).not.toBe("—");
    }
  });

  it("status tab counts partition the full row set", async () => {
    const data = await getBookingsPageData(fixtures, "2026-07-15");
    const summed = Object.values(data.countsByStatus).reduce((a, b) => a + b, 0);
    expect(summed).toBe(data.total);
  });

  it("footer totals equal the column sums over every booking", async () => {
    const data = await getBookingsPageData(fixtures, "2026-07-15");
    const expected = data.rows.reduce(
      (acc, { booking: b }) => {
        acc.roomRev += b.revenue.room;
        acc.earlyCheckIn += b.revenue.earlyCheckIn;
        acc.lateCheckOut += b.revenue.lateCheckOut;
        acc.other += b.revenue.other;
        acc.totalBill += b.totalBill;
        acc.paidToHotel += b.collection.paidToHotel;
        acc.otaCollection += b.collection.otaCollection;
        acc.pending += b.collection.pending;
        return acc;
      },
      {
        roomRev: 0,
        earlyCheckIn: 0,
        lateCheckOut: 0,
        other: 0,
        totalBill: 0,
        paidToHotel: 0,
        otaCollection: 0,
        pending: 0,
      },
    );
    expect(data.totals).toEqual(expected);
  });

  it("each booking's stored totalBill matches the pure helper", async () => {
    const data = await getBookingsPageData(fixtures, "2026-07-15");
    for (const { booking: b } of data.rows) {
      expect(b.totalBill).toBe(computeTotalBill(b.revenue));
    }
  });

  it("occupied + available always accounts for all 14 rooms", async () => {
    const data = await getBookingsPageData(fixtures, "2026-07-15");
    const occupied = data.summary.find((s) => s.key === "occupied")!.value;
    const available = data.summary.find((s) => s.key === "available")!.value;
    const [occ, total] = occupied.split(" / ").map(Number);
    expect(total).toBe(14);
    expect(occ + Number(available)).toBe(14);
  });

  it("total-collected card equals the sum of collected money in hand", async () => {
    const data = await getBookingsPageData(fixtures, "2026-07-15");
    const expected = data.rows.reduce(
      (sum, { booking: b }) => sum + computeTotalCollected(b.collection),
      0,
    );
    const card = data.summary.find((s) => s.key === "totalCollected")!.value;
    // Strip the ₹ and grouping commas the formatter adds.
    expect(Number(card.replace(/[^0-9]/g, ""))).toBe(expected);
  });
});

describe("createBooking", () => {
  it("creates a new guest and a booking with the right id shape and totals", () => {
    const res = createBooking(fixtures, NEW_BOOKING, "2026-08-01");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.guest.id).toMatch(/^G-\d{3}$/);
    expect(res.guest.tier).toBe("new");
    expect(res.booking.id).toBe("KRC-20260801-001");
    expect(res.booking.urn).toBe(2);
    expect(res.booking.status).toBe("pending_payment");
    expect(res.booking.collection.pending).toBe(res.booking.totalBill);
    expect(res.booking.totalBill).toBe(computeTotalBill(res.booking.revenue));
  });

  it("reuses an existing guest matched by phone instead of duplicating them", () => {
    const existing = fixtures.guests[0];
    const res = createBooking(
      fixtures,
      { ...NEW_BOOKING, guestName: existing.name, guestPhone: existing.phone },
      "2026-08-01",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.guest.id).toBe(existing.id);
  });

  it("numbers a second booking on the same day right after the first", () => {
    const first = createBooking(fixtures, NEW_BOOKING, "2026-07-14");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const state = { guests: fixtures.guests, bookings: [...fixtures.bookings, first.booking] };
    const second = createBooking(
      state,
      { ...NEW_BOOKING, guestPhone: "+91 90000 22222" },
      "2026-07-14",
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.booking.id.startsWith("KRC-20260714-")).toBe(true);
    expect(second.booking.id).not.toBe(first.booking.id);
  });

  it("rejects a missing guest name, a backwards date range, and an unknown room", () => {
    expect(createBooking(fixtures, { ...NEW_BOOKING, guestName: "  " }).ok).toBe(false);
    expect(
      createBooking(fixtures, { ...NEW_BOOKING, checkIn: "2026-08-05", checkOut: "2026-08-01" }).ok,
    ).toBe(false);
    expect(createBooking(fixtures, { ...NEW_BOOKING, roomNo: "999" }).ok).toBe(false);
  });
});

describe("markBookingPaid", () => {
  function pendingState() {
    const created = createBooking(fixtures, NEW_BOOKING, "2026-08-01");
    if (!created.ok) throw new Error("setup failed");
    const state = {
      guests: [...fixtures.guests, created.guest],
      bookings: [created.booking],
      partyHall: fixtures.partyHall,
    };
    return { state, booking: created.booking };
  }

  it("confirms a pending booking and settles the collection to the full total", () => {
    const { state, booking } = pendingState();
    const res = markBookingPaid(state, booking.id, "order_1", "pay_1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.status).toBe("confirmed");
    expect(res.booking.collection.paidToHotel).toBe(booking.totalBill);
    expect(res.booking.collection.pending).toBe(0);
    expect(res.booking.razorpayOrderId).toBe("order_1");
    expect(res.booking.razorpayPaymentId).toBe("pay_1");
  });

  it("is idempotent on a replay of the same payment id", () => {
    const { state, booking } = pendingState();
    const first = markBookingPaid(state, booking.id, "order_1", "pay_1");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const replayState = {
      guests: state.guests,
      bookings: [first.booking],
      partyHall: state.partyHall,
    };
    const second = markBookingPaid(replayState, booking.id, "order_1", "pay_1");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.booking).toEqual(first.booking);
  });

  it("rejects a booking that isn't pending payment", () => {
    const { state, booking } = pendingState();
    const res = markBookingPaid(
      {
        guests: state.guests,
        bookings: [{ ...booking, status: "cancelled" as const }],
        partyHall: state.partyHall,
      },
      booking.id,
      "order_1",
      "pay_1",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown booking id", () => {
    const { state } = pendingState();
    expect(markBookingPaid(state, "KRC-nope", "order_1", "pay_1").ok).toBe(false);
  });
});
