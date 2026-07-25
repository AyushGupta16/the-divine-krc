import { describe, expect, it } from "vitest";

import { createBooking, type NewBookingInput } from "@/lib/bookings";
import { resolveInvoiceParty } from "@/lib/invoices";
import type { Booking, Guest } from "@/types/booking";

const BASE_INPUT: NewBookingInput = {
  guestName: "Kavya Iyer",
  guestPhone: "+91 90000 22222",
  guestEmail: "kavya.iyer@example.com",
  guestCity: "Pune",
  roomType: "deluxe",
  roomNo: null,
  checkIn: "2026-08-01",
  checkOut: "2026-08-03",
  source: "direct",
  mealPlan: "EP",
};

/** Builds bookings sequentially against a shared, growing state, mirroring how `createGuestBookingFn` is called in a loop. */
function makeBooking(
  guests: Guest[],
  bookings: Booking[],
  overrides: Partial<NewBookingInput> = {},
): Booking {
  const res = createBooking({ guests, bookings }, { ...BASE_INPUT, ...overrides });
  if (!res.ok) throw new Error(res.error);
  if (!guests.some((g) => g.id === res.guest.id)) guests.push(res.guest);
  bookings.push(res.booking);
  return res.booking;
}

describe("resolveInvoiceParty", () => {
  it("groups bookings sharing the same batchId from one checkout", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const batchId = "batch-1";
    const a = makeBooking(guests, bookings, { batchId, roomType: "deluxe" });
    const b = makeBooking(guests, bookings, { batchId, roomType: "deluxe_balcony" });

    const party = resolveInvoiceParty(a.id, bookings);
    expect(party.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("does not merge two separate checkouts for the same guest and dates", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const a = makeBooking(guests, bookings, { batchId: "batch-1" });
    const b = makeBooking(guests, bookings, { batchId: "batch-2" });

    expect(resolveInvoiceParty(a.id, bookings)).toEqual([a]);
    expect(resolveInvoiceParty(b.id, bookings)).toEqual([b]);
  });

  it("falls back to guest+dates matching for legacy batchless bookings", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const a = makeBooking(guests, bookings);
    const b = makeBooking(guests, bookings);

    const party = resolveInvoiceParty(a.id, bookings);
    expect(party.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("never pulls a batched booking into a batchless party", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const a = makeBooking(guests, bookings);
    const b = makeBooking(guests, bookings, { batchId: "batch-1" });

    expect(resolveInvoiceParty(a.id, bookings)).toEqual([a]);
  });

  it("excludes a cancelled booking from its batch party", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const batchId = "batch-1";
    const a = makeBooking(guests, bookings, { batchId });
    const b = makeBooking(guests, bookings, { batchId });
    b.status = "cancelled";

    expect(resolveInvoiceParty(a.id, bookings)).toEqual([a]);
  });
});
