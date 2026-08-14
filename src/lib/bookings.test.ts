import { describe, expect, it } from "vitest";

import {
  assignBookingRoom,
  checkAvailability,
  checkInEligibilityError,
  createBooking,
  createPartyHallEnquiry,
  EARLY_CHECKIN_FEE,
  EXTRA_MATTRESS_FEE,
  getBookingsPageData,
  markBookingPaid,
  MAX_PARTY_HALL_GUESTS,
  resolveRequestedService,
  ROOM_UNITS,
  type NewBookingInput,
  type NewPartyHallEnquiryInput,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { computeTotalBill, computeTotalCollected } from "@/lib/booking-math";
import type { RoomTile } from "@/types/booking";

const NEW_ENQUIRY: NewPartyHallEnquiryInput = {
  eventType: "Wedding",
  occasionName: "Riya & Kabir",
  date: "2026-09-15",
  slot: "evening",
  guests: 80,
  package: "Gold",
  addOns: ["Decor", "Catering"],
  contactName: "Riya Sharma",
  contactPhone: "9811122233",
  contactEmail: "riya@example.com",
};

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

  it("persists a non-default meal plan instead of always defaulting to EP", () => {
    const res = createBooking(fixtures, { ...NEW_BOOKING, mealPlan: "AP" }, "2026-08-01");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.mealPlan).toBe("AP");
  });

  it("stores preferences + note together as one specialRequest object", () => {
    const res = createBooking(
      fixtures,
      {
        ...NEW_BOOKING,
        requestPreferences: ["high_floor", "quiet_room"],
        requestNote: "arriving ~11pm",
      },
      "2026-08-01",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.specialRequest).toEqual({
      preferences: ["high_floor", "quiet_room"],
      note: "arriving ~11pm",
    });
  });

  it("stores undefined, not an empty object, when nothing was selected or written", () => {
    const res = createBooking(fixtures, NEW_BOOKING, "2026-08-01");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.specialRequest).toBeUndefined();
  });

  it("drops unknown/invalid preference keys instead of trusting client input", () => {
    const res = createBooking(
      fixtures,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exercising the untrusted-input path deliberately
      { ...NEW_BOOKING, requestPreferences: ["quiet_room", "sea_view" as any] },
      "2026-08-01",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.specialRequest).toEqual({ preferences: ["quiet_room"] });
  });

  it("rejects a request note over 500 characters instead of truncating it", () => {
    const res = createBooking(
      fixtures,
      { ...NEW_BOOKING, requestNote: "x".repeat(501) },
      "2026-08-01",
    );
    expect(res.ok).toBe(false);
  });

  it("accepts a request note at exactly the 500-character limit", () => {
    const res = createBooking(
      fixtures,
      { ...NEW_BOOKING, requestNote: "x".repeat(500) },
      "2026-08-01",
    );
    expect(res.ok).toBe(true);
  });

  it("Slice B: a requested add-on is recorded pending, never an immediate charge", () => {
    const res = createBooking(
      fixtures,
      {
        ...NEW_BOOKING,
        requestEarlyCheckIn: true,
        requestLateCheckOut: true,
        requestExtraMattressQty: 2,
      },
      "2026-08-01",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.requestedServices).toEqual({
      earlyCheckIn: { requested: true, status: "pending" },
      lateCheckOut: { requested: true, status: "pending" },
      extraMattress: { requested: true, status: "pending", qty: 2 },
    });
    // Requesting is not charging — the revenue columns stay untouched.
    expect(res.booking.revenue.earlyCheckIn).toBe(0);
    expect(res.booking.revenue.lateCheckOut).toBe(0);
    expect(res.booking.revenue.other).toBe(0);
  });

  it("stores undefined, not an empty object, when no add-on was requested", () => {
    const res = createBooking(fixtures, NEW_BOOKING, "2026-08-01");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.requestedServices).toBeUndefined();
  });

  it("rejects a mattress quantity outside 0-3", () => {
    expect(createBooking(fixtures, { ...NEW_BOOKING, requestExtraMattressQty: 4 }).ok).toBe(false);
    expect(createBooking(fixtures, { ...NEW_BOOKING, requestExtraMattressQty: -1 }).ok).toBe(false);
  });
});

describe("createPartyHallEnquiry", () => {
  it("persists every field the guest entered, composing the title as 'type — occasion'", () => {
    const res = createPartyHallEnquiry({ partyHall: [] }, NEW_ENQUIRY, "2026-08-01");
    if (!res.ok) throw new Error(res.error);
    expect(res.enquiry).toMatchObject({
      title: "Wedding — Riya & Kabir",
      date: "2026-09-15",
      slot: "evening",
      guests: 80,
      package: "Gold",
      addOns: ["Decor", "Catering"],
      status: "enquiry",
      amount: 0,
      contactName: "Riya Sharma",
      contactPhone: "9811122233",
      contactEmail: "riya@example.com",
    });
  });

  it("assigns the next id for the day, sequential per submission date", () => {
    const first = createPartyHallEnquiry({ partyHall: [] }, NEW_ENQUIRY, "2026-08-01");
    if (!first.ok) throw new Error(first.error);
    expect(first.enquiry.id).toBe("PH-20260801-001");

    const second = createPartyHallEnquiry(
      { partyHall: [first.enquiry] },
      NEW_ENQUIRY,
      "2026-08-01",
    );
    if (!second.ok) throw new Error(second.error);
    expect(second.enquiry.id).toBe("PH-20260801-002");
  });

  it("rejects an event type outside the known whitelist", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, eventType: "Concert" },
      "2026-08-01",
    );
    expect(res.ok).toBe(false);
  });

  it("uses just the event type when no occasion name is given", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, occasionName: undefined },
      "2026-08-01",
    );
    if (!res.ok) throw new Error(res.error);
    expect(res.enquiry.title).toBe("Wedding");
  });

  it("rejects an occasion name over the length cap", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, occasionName: "x".repeat(81) },
      "2026-08-01",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a date in the past", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, date: "2026-07-01" },
      "2026-08-01",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a guest count outside 1..MAX_PARTY_HALL_GUESTS", () => {
    expect(
      createPartyHallEnquiry({ partyHall: [] }, { ...NEW_ENQUIRY, guests: 0 }, "2026-08-01").ok,
    ).toBe(false);
    expect(
      createPartyHallEnquiry(
        { partyHall: [] },
        { ...NEW_ENQUIRY, guests: MAX_PARTY_HALL_GUESTS + 1 },
        "2026-08-01",
      ).ok,
    ).toBe(false);
    expect(
      createPartyHallEnquiry(
        { partyHall: [] },
        { ...NEW_ENQUIRY, guests: MAX_PARTY_HALL_GUESTS },
        "2026-08-01",
      ).ok,
    ).toBe(true);
  });

  it("rejects a package name that isn't a real tier", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, package: "Diamond" },
      "2026-08-01",
    );
    expect(res.ok).toBe(false);
  });

  it("drops add-ons outside the known tag vocabulary rather than trusting the client", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, addOns: ["Decor", "Fireworks", "Decor"] },
      "2026-08-01",
    );
    if (!res.ok) throw new Error(res.error);
    expect(res.enquiry.addOns).toEqual(["Decor"]);
  });

  it("rejects a missing contact name", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, contactName: "" },
      "2026-08-01",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a malformed contact phone", () => {
    const res = createPartyHallEnquiry(
      { partyHall: [] },
      { ...NEW_ENQUIRY, contactPhone: "abc" },
      "2026-08-01",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a malformed contact email but allows an empty one", () => {
    expect(
      createPartyHallEnquiry(
        { partyHall: [] },
        { ...NEW_ENQUIRY, contactEmail: "not-an-email" },
        "2026-08-01",
      ).ok,
    ).toBe(false);
    expect(
      createPartyHallEnquiry({ partyHall: [] }, { ...NEW_ENQUIRY, contactEmail: "" }, "2026-08-01")
        .ok,
    ).toBe(true);
  });

  it("computes advancePaid as 0 for a fresh enquiry — nothing has been quoted yet", () => {
    const res = createPartyHallEnquiry({ partyHall: [] }, NEW_ENQUIRY, "2026-08-01");
    if (!res.ok) throw new Error(res.error);
    expect(res.enquiry.advancePaid).toBe(0);
  });
});

describe("resolveRequestedService", () => {
  function bookingWithPendingRequests() {
    const res = createBooking(
      fixtures,
      {
        ...NEW_BOOKING,
        requestEarlyCheckIn: true,
        requestLateCheckOut: true,
        requestExtraMattressQty: 2,
      },
      "2026-08-01",
    );
    if (!res.ok) throw new Error("setup failed");
    return res.booking;
  }

  it("applying a pending request snapshots the current rate and flips status to applied", () => {
    const booking = bookingWithPendingRequests();
    const res = resolveRequestedService({}, booking, "earlyCheckIn", "applied");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.revenue.earlyCheckIn).toBe(EARLY_CHECKIN_FEE);
    expect(res.requestedServices.earlyCheckIn).toEqual({ requested: true, status: "applied" });
  });

  it("applying uses an owner-set override rate instead of the default", () => {
    const booking = bookingWithPendingRequests();
    const res = resolveRequestedService(
      { addOnRateOverrides: { earlyCheckIn: 777 } },
      booking,
      "earlyCheckIn",
      "applied",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.revenue.earlyCheckIn).toBe(777);
  });

  it("declining a pending request leaves revenue at zero and records the outcome", () => {
    const booking = bookingWithPendingRequests();
    const res = resolveRequestedService({}, booking, "lateCheckOut", "declined");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.revenue.lateCheckOut).toBe(0);
    expect(res.requestedServices.lateCheckOut).toEqual({ requested: true, status: "declined" });
  });

  it("mattress applies its requested quantity and appends a readable note", () => {
    const booking = bookingWithPendingRequests();
    const res = resolveRequestedService({}, booking, "extraMattress", "applied");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.revenue.other).toBe(EXTRA_MATTRESS_FEE * 2);
    expect(res.note).toBe("Extra mattress ×2");
    expect(res.requestedServices.extraMattress).toEqual({
      requested: true,
      status: "applied",
      qty: 2,
    });
  });

  it("appends rather than overwrites when revenueOtherNote already holds a charge", () => {
    const booking = { ...bookingWithPendingRequests(), revenueOtherNote: "Manual adjustment" };
    const res = resolveRequestedService({}, booking, "extraMattress", "applied");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.note).toBe("Manual adjustment, Extra mattress ×2");
  });

  it("a walk-in ad-hoc add (no prior request) applies directly at the given quantity", () => {
    const res1 = createBooking(fixtures, NEW_BOOKING, "2026-08-01");
    if (!res1.ok) throw new Error("setup failed");
    const res = resolveRequestedService({}, res1.booking, "extraMattress", "applied", 3);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.revenue.other).toBe(EXTRA_MATTRESS_FEE * 3);
    expect(res.requestedServices.extraMattress).toEqual({
      requested: false,
      status: "applied",
      qty: 3,
    });
  });

  it("refuses to resolve a request that has already been applied or declined", () => {
    const booking = bookingWithPendingRequests();
    const applied = resolveRequestedService({}, booking, "earlyCheckIn", "applied");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const reapplied = resolveRequestedService(
      {},
      { ...booking, requestedServices: applied.requestedServices },
      "earlyCheckIn",
      "declined",
    );
    expect(reapplied.ok).toBe(false);
  });

  it("reversing an applied early check-in zeros the revenue and marks it reversed", () => {
    const booking = bookingWithPendingRequests();
    const applied = resolveRequestedService({}, booking, "earlyCheckIn", "applied");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const withApplied = {
      ...booking,
      revenue: applied.revenue,
      requestedServices: applied.requestedServices,
    };

    const reversed = resolveRequestedService({}, withApplied, "earlyCheckIn", "reversed");
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) return;
    expect(reversed.revenue.earlyCheckIn).toBe(0);
    expect(reversed.requestedServices.earlyCheckIn).toEqual({
      requested: true,
      status: "reversed",
    });
  });

  it("reversing an applied mattress charge zeros revenue.other and clears the note", () => {
    const booking = bookingWithPendingRequests();
    const applied = resolveRequestedService({}, booking, "extraMattress", "applied");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const withApplied = {
      ...booking,
      revenue: applied.revenue,
      revenueOtherNote: applied.note,
      requestedServices: applied.requestedServices,
    };

    const reversed = resolveRequestedService({}, withApplied, "extraMattress", "reversed");
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) return;
    expect(reversed.revenue.other).toBe(0);
    expect(reversed.note).toBeUndefined();
    expect(reversed.requestedServices.extraMattress).toEqual({
      requested: true,
      status: "reversed",
      qty: 2,
    });
  });

  it("reversed is distinct from declined — refuses to reverse a request that was never applied", () => {
    const booking = bookingWithPendingRequests();
    const declined = resolveRequestedService({}, booking, "lateCheckOut", "declined");
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    const withDeclined = { ...booking, requestedServices: declined.requestedServices };

    const reversed = resolveRequestedService({}, withDeclined, "lateCheckOut", "reversed");
    expect(reversed.ok).toBe(false);
  });

  it("refuses to reverse a request that is still pending", () => {
    const booking = bookingWithPendingRequests();
    const reversed = resolveRequestedService({}, booking, "earlyCheckIn", "reversed");
    expect(reversed.ok).toBe(false);
  });

  it("refuses to reverse an already-reversed charge", () => {
    const booking = bookingWithPendingRequests();
    const applied = resolveRequestedService({}, booking, "earlyCheckIn", "applied");
    if (!applied.ok) throw new Error("setup failed");
    const withApplied = {
      ...booking,
      revenue: applied.revenue,
      requestedServices: applied.requestedServices,
    };
    const firstReversal = resolveRequestedService({}, withApplied, "earlyCheckIn", "reversed");
    if (!firstReversal.ok) throw new Error("setup failed");
    const withReversed = {
      ...withApplied,
      revenue: firstReversal.revenue,
      requestedServices: firstReversal.requestedServices,
    };

    const secondReversal = resolveRequestedService({}, withReversed, "earlyCheckIn", "reversed");
    expect(secondReversal.ok).toBe(false);
  });

  it("a reversed charge can be re-applied — it does not dead-end", () => {
    const booking = bookingWithPendingRequests();
    const applied = resolveRequestedService({}, booking, "earlyCheckIn", "applied");
    if (!applied.ok) throw new Error("setup failed");
    const withApplied = {
      ...booking,
      revenue: applied.revenue,
      requestedServices: applied.requestedServices,
    };
    const reversed = resolveRequestedService({}, withApplied, "earlyCheckIn", "reversed");
    if (!reversed.ok) throw new Error("setup failed");
    const withReversed = {
      ...withApplied,
      revenue: reversed.revenue,
      requestedServices: reversed.requestedServices,
    };

    const reapplied = resolveRequestedService({}, withReversed, "earlyCheckIn", "applied");
    expect(reapplied.ok).toBe(true);
    if (!reapplied.ok) return;
    expect(reapplied.revenue.earlyCheckIn).toBe(EARLY_CHECKIN_FEE);
    expect(reapplied.requestedServices.earlyCheckIn).toEqual({
      requested: true,
      status: "applied",
    });
  });

  it("a mattress charge reversed then re-applied recharges its original quantity", () => {
    const booking = bookingWithPendingRequests();
    const applied = resolveRequestedService({}, booking, "extraMattress", "applied");
    if (!applied.ok) throw new Error("setup failed");
    const withApplied = {
      ...booking,
      revenue: applied.revenue,
      revenueOtherNote: applied.note,
      requestedServices: applied.requestedServices,
    };
    const reversed = resolveRequestedService({}, withApplied, "extraMattress", "reversed");
    if (!reversed.ok) throw new Error("setup failed");
    const withReversed = {
      ...withApplied,
      revenue: reversed.revenue,
      revenueOtherNote: reversed.note,
      requestedServices: reversed.requestedServices,
    };

    const reapplied = resolveRequestedService({}, withReversed, "extraMattress", "applied");
    expect(reapplied.ok).toBe(true);
    if (!reapplied.ok) return;
    expect(reapplied.revenue.other).toBe(EXTRA_MATTRESS_FEE * 2);
    expect(reapplied.note).toBe("Extra mattress ×2");
  });

  it("a declined request can still be applied afterward", () => {
    const booking = bookingWithPendingRequests();
    const declined = resolveRequestedService({}, booking, "lateCheckOut", "declined");
    if (!declined.ok) throw new Error("setup failed");
    const withDeclined = { ...booking, requestedServices: declined.requestedServices };

    const applied = resolveRequestedService({}, withDeclined, "lateCheckOut", "applied");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.revenue.lateCheckOut).toBe(500);
  });

  it("still refuses to apply a charge that is currently applied — reverse it first", () => {
    const booking = bookingWithPendingRequests();
    const applied = resolveRequestedService({}, booking, "earlyCheckIn", "applied");
    if (!applied.ok) throw new Error("setup failed");
    const withApplied = {
      ...booking,
      revenue: applied.revenue,
      requestedServices: applied.requestedServices,
    };

    const reapplied = resolveRequestedService({}, withApplied, "earlyCheckIn", "applied");
    expect(reapplied.ok).toBe(false);
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
    const res = markBookingPaid(
      state,
      booking.id,
      "order_1",
      "pay_1",
      "upi",
      "2026-08-01T10:00:00.000Z",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.status).toBe("confirmed");
    expect(res.booking.collection.paidToHotel).toBe(booking.totalBill);
    expect(res.booking.collection.pending).toBe(0);
    expect(res.booking.razorpayOrderId).toBe("order_1");
    expect(res.booking.razorpayPaymentId).toBe("pay_1");
    expect(res.booking.paymentMethod).toBe("upi");
    expect(res.booking.paidAt).toBe("2026-08-01T10:00:00.000Z");
  });

  it("is idempotent on a replay of the same payment id", () => {
    const { state, booking } = pendingState();
    const first = markBookingPaid(
      state,
      booking.id,
      "order_1",
      "pay_1",
      "upi",
      "2026-08-01T10:00:00.000Z",
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const replayState = {
      guests: state.guests,
      bookings: [first.booking],
      partyHall: state.partyHall,
    };
    const second = markBookingPaid(
      replayState,
      booking.id,
      "order_1",
      "pay_1",
      "upi",
      "2026-08-01T10:00:00.000Z",
    );
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
      "upi",
      "2026-08-01T10:00:00.000Z",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown booking id", () => {
    const { state } = pendingState();
    expect(
      markBookingPaid(state, "KRC-nope", "order_1", "pay_1", "upi", "2026-08-01T10:00:00.000Z").ok,
    ).toBe(false);
  });
});

describe("checkAvailability", () => {
  it("is available when nothing overlaps the requested nights", () => {
    const available = checkAvailability(
      { bookings: [] },
      { checkIn: "2026-09-01", checkOut: "2026-09-03", rooms: 2 },
    );
    expect(available).toBe(true);
  });

  it("rejects a backwards or empty date range", () => {
    expect(
      checkAvailability({ bookings: [] }, { checkIn: "", checkOut: "2026-09-03", rooms: 1 }),
    ).toBe(false);
    expect(
      checkAvailability(
        { bookings: [] },
        { checkIn: "2026-09-05", checkOut: "2026-09-01", rooms: 1 },
      ),
    ).toBe(false);
  });

  it("goes unavailable once every room is held over the span, even unassigned ones", () => {
    let state = { guests: fixtures.guests, bookings: fixtures.bookings };
    for (let i = 0; i < ROOM_UNITS.length; i++) {
      const res = createBooking(
        state,
        { ...NEW_BOOKING, guestPhone: `+91 90000 9${String(i).padStart(4, "0")}` },
        "2026-09-01",
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      state = { guests: [...state.guests, res.guest], bookings: [...state.bookings, res.booking] };
    }

    expect(
      checkAvailability(state, { checkIn: "2026-08-01", checkOut: "2026-08-03", rooms: 1 }),
    ).toBe(false);
    expect(
      checkAvailability(state, { checkIn: "2026-09-10", checkOut: "2026-09-12", rooms: 1 }),
    ).toBe(true);
  });
});

describe("assignBookingRoom", () => {
  const rooms: RoomTile[] = [
    { no: "101", floor: 1, type: "deluxe", status: "available", detail: "Ready", sizeSqm: null },
    {
      no: "102",
      floor: 1,
      type: "deluxe",
      status: "maintenance",
      detail: "AC repair",
      sizeSqm: null,
    },
    { no: "103", floor: 1, type: "deluxe", status: "available", detail: "Ready", sizeSqm: null },
    {
      no: "201",
      floor: 2,
      type: "deluxe_balcony",
      status: "available",
      detail: "Ready",
      sizeSqm: null,
    },
  ];

  /** A confirmed deluxe booking, unassigned, over the given dates, with a
   *  distinct id — `createBooking` numbers off `state.bookings`, which each
   *  call here starts empty, so ids must be forced apart explicitly. */
  function makeBooking(id: string, checkIn: string, checkOut: string) {
    const res = createBooking(
      { guests: fixtures.guests, bookings: [], rooms },
      { ...NEW_BOOKING, roomNo: null, checkIn, checkOut, guestPhone: `+91 90000 ${id}` },
      "2026-08-01",
    );
    if (!res.ok) throw new Error("setup failed");
    return { ...res.booking, id: `KRC-TEST-${id}` };
  }

  it("rejects an unknown booking id", () => {
    const state = { guests: fixtures.guests, bookings: [], rooms, partyHall: fixtures.partyHall };
    expect(assignBookingRoom(state, "KRC-nope", "101").ok).toBe(false);
  });

  it("rejects a room that doesn't exist", () => {
    const booking = makeBooking("00001", "2026-09-01", "2026-09-03");
    const state = {
      guests: fixtures.guests,
      bookings: [booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, "999");
    expect(res.ok).toBe(false);
  });

  it("rejects a room of the wrong type", () => {
    const booking = makeBooking("00002", "2026-09-01", "2026-09-03");
    const state = {
      guests: fixtures.guests,
      bookings: [booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, "201");
    expect(res.ok).toBe(false);
  });

  it("rejects a room under maintenance — a hard stop, unlike cleaning", () => {
    const booking = makeBooking("00003", "2026-09-01", "2026-09-03");
    const state = {
      guests: fixtures.guests,
      bookings: [booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, "102");
    expect(res.ok).toBe(false);
  });

  it("rejects a room already held by an overlapping occupying-status booking", () => {
    const holder = { ...makeBooking("00004", "2026-09-02", "2026-09-05"), roomNo: "101" };
    const booking = makeBooking("00005", "2026-09-01", "2026-09-03");
    const state = {
      guests: fixtures.guests,
      bookings: [holder, booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, "101");
    expect(res.ok).toBe(false);
  });

  it("allows a room already held by a non-overlapping booking", () => {
    const holder = { ...makeBooking("00006", "2026-09-05", "2026-09-07"), roomNo: "101" };
    const booking = makeBooking("00007", "2026-09-01", "2026-09-03");
    const state = {
      guests: fixtures.guests,
      bookings: [holder, booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, "101");
    expect(res.ok).toBe(true);
  });

  it("allows unassigning a booking that hasn't checked in", () => {
    const booking = { ...makeBooking("00008", "2026-09-01", "2026-09-03"), roomNo: "101" };
    const state = {
      guests: fixtures.guests,
      bookings: [booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, null);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.booking.roomNo).toBeNull();
  });

  it("refuses to unassign a checked-in booking's room", () => {
    const booking = {
      ...makeBooking("00009", "2026-09-01", "2026-09-03"),
      roomNo: "101",
      status: "checked_in" as const,
    };
    const state = {
      guests: fixtures.guests,
      bookings: [booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, null);
    expect(res.ok).toBe(false);
  });

  it("allows reassigning a checked-in booking straight to a different free room", () => {
    const booking = {
      ...makeBooking("00010", "2026-09-01", "2026-09-03"),
      roomNo: "101",
      status: "checked_in" as const,
    };
    const state = {
      guests: fixtures.guests,
      bookings: [booking],
      rooms,
      partyHall: fixtures.partyHall,
    };
    const res = assignBookingRoom(state, booking.id, "103");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.booking.roomNo).toBe("103");
  });
});

describe("checkInEligibilityError", () => {
  const rooms: RoomTile[] = [
    { no: "101", floor: 1, type: "deluxe", status: "available", detail: "Ready", sizeSqm: null },
    {
      no: "102",
      floor: 1,
      type: "deluxe",
      status: "maintenance",
      detail: "AC repair",
      sizeSqm: null,
    },
  ];

  function makeBooking(roomNo: string | null) {
    const res = createBooking(
      { guests: fixtures.guests, bookings: [], rooms },
      { ...NEW_BOOKING, roomNo: null, guestPhone: "+91 90000 55501" },
      "2026-08-01",
    );
    if (!res.ok) throw new Error("setup failed");
    return { ...res.booking, roomNo };
  }

  it("blocks check-in with no room assigned", () => {
    expect(checkInEligibilityError({ rooms }, makeBooking(null))).toBeTruthy();
  });

  it("blocks check-in into a room under maintenance", () => {
    expect(checkInEligibilityError({ rooms }, makeBooking("102"))).toBeTruthy();
  });

  it("allows check-in once a non-maintenance room is assigned", () => {
    expect(checkInEligibilityError({ rooms }, makeBooking("101"))).toBeUndefined();
  });
});
