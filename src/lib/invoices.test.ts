import { describe, expect, it } from "vitest";

import {
  createBooking,
  GST_PCT,
  resolveRequestedService,
  type NewBookingInput,
} from "@/lib/bookings";
import { buildPartyHallInvoice, buildRoomInvoice, resolveInvoiceParty } from "@/lib/invoices";
import { fixtures } from "@/lib/__fixtures__/bookings";
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

  it("keeps three bookings with distinct batchIds as three separate single-member parties, even sharing one guest and dates", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const a = makeBooking(guests, bookings, { batchId: "batch-1" });
    makeBooking(guests, bookings, { batchId: "batch-2" });
    makeBooking(guests, bookings, { batchId: "batch-3" });
    // Force all three onto the same guest + dates, mirroring the invoice-grouping
    // bug: without batchId reaching the invoices mapper, these three used to be
    // merged into one group invoice by guest+date instead of staying separate.
    for (const b of bookings) {
      b.guestId = a.guestId;
      b.checkIn = a.checkIn;
      b.checkOut = a.checkOut;
    }

    expect(resolveInvoiceParty(bookings[0].id, bookings)).toEqual([bookings[0]]);
    expect(resolveInvoiceParty(bookings[1].id, bookings)).toEqual([bookings[1]]);
    expect(resolveInvoiceParty(bookings[2].id, bookings)).toEqual([bookings[2]]);
  });

  it("groups all three bookings sharing one batchId from one cart checkout", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const batchId = "batch-shared";
    const a = makeBooking(guests, bookings, { batchId, roomType: "deluxe" });
    const b = makeBooking(guests, bookings, { batchId, roomType: "deluxe_balcony" });
    const c = makeBooking(guests, bookings, { batchId, roomType: "deluxe" });

    const party = resolveInvoiceParty(a.id, bookings);
    expect(party.map((p) => p.id).sort()).toEqual([a.id, b.id, c.id].sort());
  });
});

describe("buildRoomInvoice — Slice B add-on charges", () => {
  it("renders the applied mattress charge as its own line, labelled with the note", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const booking = makeBooking(guests, bookings, { requestExtraMattressQty: 2 });

    const resolved = resolveRequestedService({}, booking, "extraMattress", "applied");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const chargedBooking: Booking = {
      ...booking,
      revenue: resolved.revenue,
      revenueOtherNote: resolved.note,
    };

    const invoice = buildRoomInvoice(
      "INV-1",
      "2026-08-01T00:00:00Z",
      chargedBooking,
      guests[0],
      GST_PCT,
    );
    const otherLine = invoice.sections[0].lines.find((l) => l.name === "Other charges");
    expect(otherLine?.note).toBe("Extra mattress ×2");
  });

  it("declined requests never surface an invoice line", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const booking = makeBooking(guests, bookings, { requestEarlyCheckIn: true });

    const resolved = resolveRequestedService({}, booking, "earlyCheckIn", "declined");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const declinedBooking: Booking = { ...booking, revenue: resolved.revenue };

    const invoice = buildRoomInvoice(
      "INV-2",
      "2026-08-01T00:00:00Z",
      declinedBooking,
      guests[0],
      GST_PCT,
    );
    expect(invoice.sections[0].lines.some((l) => l.name === "Early check-in")).toBe(false);
  });

  it("bills at whatever gstPct the caller resolves from the live setting, not a hardcoded default", () => {
    const guests: Guest[] = [];
    const bookings: Booking[] = [];
    const booking = makeBooking(guests, bookings);

    const invoice = buildRoomInvoice("INV-3", "2026-08-01T00:00:00Z", booking, guests[0], 5);
    expect(invoice.gstRate).toBe(5);
    expect(invoice.gstRate).not.toBe(GST_PCT);
  });
});

describe("buildPartyHallInvoice", () => {
  it("bills at whatever gstPct the caller resolves from the live party-hall setting, for an enquiry with no frozen quote to fall back to", () => {
    const enquiry = fixtures.partyHall[0];
    const invoice = buildPartyHallInvoice("INV-PH-1", "2026-08-01T00:00:00Z", enquiry, 5);
    expect(invoice.gstRate).toBe(5);
    expect(invoice.gstRate).not.toBe(18);
  });

  it("renders every line from a complete frozen quote, ignoring the live rate entirely", () => {
    const enquiry = {
      ...fixtures.partyHall[0],
      quoteBreakdown: [
        { label: "Platinum package", amount: 45000 },
        { label: "DJ", amount: 8000 },
        { label: "GST (18%)", amount: 9540 }, // round(53000 * 0.18)
      ],
    };
    // Live rate has since changed to 5% — must not affect this invoice.
    const invoice = buildPartyHallInvoice("INV-PH-2", "2026-08-01T00:00:00Z", enquiry, 5);
    expect(invoice.gstRate).toBe(18);
    expect(invoice.sections[0].lines).toEqual([
      { name: "Platinum package", note: "Quoted", qty: "1", rate: "₹45,000", amount: "₹45,000" },
      { name: "DJ", note: "Quoted", qty: "1", rate: "₹8,000", amount: "₹8,000" },
    ]);
    expect(invoice.sections[0].subtotal).toBe(53000);
    expect(invoice.grandTotal).toBe(53000 + 9540);
    // Total reconciles with the sum of the rendered lines, not a live recompute.
    const renderedLineTotal = invoice.sections[0].lines.reduce(
      (sum, line) => sum + Number(line.amount.replace(/[₹,]/g, "")),
      0,
    );
    expect(renderedLineTotal + 9540).toBe(invoice.grandTotal);
  });

  it("falls back to live computation for a not-yet-quoted enquiry (no quoteBreakdown)", () => {
    const enquiry = { ...fixtures.partyHall[0], quoteBreakdown: undefined, amount: 40000 };
    const invoice = buildPartyHallInvoice("INV-PH-3", "2026-08-01T00:00:00Z", enquiry, 12);
    expect(invoice.gstRate).toBe(12);
    expect(invoice.grandTotal).toBe(40000 + Math.round(40000 * 0.12));
  });

  it("falls back to live computation for an empty quoteBreakdown array", () => {
    const enquiry = { ...fixtures.partyHall[0], quoteBreakdown: [], amount: 40000 };
    const invoice = buildPartyHallInvoice("INV-PH-4", "2026-08-01T00:00:00Z", enquiry, 12);
    expect(invoice.gstRate).toBe(12);
    expect(invoice.grandTotal).toBe(40000 + Math.round(40000 * 0.12));
  });

  it("falls back to live computation (whole invoice, not per-field) for an old-path quote with price lines but no frozen GST line", () => {
    const enquiry = {
      ...fixtures.partyHall[0],
      amount: 53000,
      quoteBreakdown: [
        { label: "Platinum package", amount: 45000 },
        { label: "DJ", amount: 8000 },
        // No GST line — this is what every enquiry quoted before this change looks like.
      ],
    };
    const invoice = buildPartyHallInvoice("INV-PH-5", "2026-08-01T00:00:00Z", enquiry, 18);
    // Must render a complete, correct invoice — not one missing its GST row.
    expect(invoice.gstRate).toBe(18);
    expect(invoice.totalRows.some((r) => r.label.includes("GST"))).toBe(true);
    expect(invoice.grandTotal).toBe(53000 + Math.round(53000 * 0.18));
  });
});
