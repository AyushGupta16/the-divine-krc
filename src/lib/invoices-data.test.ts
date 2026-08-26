import { describe, expect, it } from "vitest";

import { createBooking, GST_PCT, type NewBookingInput } from "@/lib/bookings";
import { buildRoomInvoice } from "@/lib/invoices";
import { invoiceRoomGstPct } from "@/lib/invoices-data";
import type { Booking, Guest } from "@/types/booking";

const BASE_INPUT: NewBookingInput = {
  guestName: "Purab Lamba",
  guestPhone: "+91 90000 33333",
  guestEmail: "purab@example.com",
  guestCity: "Greater Noida",
  roomType: "deluxe",
  roomNo: null,
  checkIn: "2026-08-25",
  checkOut: "2026-08-26",
  source: "direct",
  mealPlan: "EP",
};

// The setting has since moved to 5% live; these bookings were created back
// when it was still 12%, so `revenue.taxPct` holds 12 regardless of `LIVE_PCT`.
const LIVE_PCT = 5;

describe("invoiceRoomGstPct", () => {
  it("uses the frozen charged rate for a fully-paid booking, not the live setting", () => {
    const res = createBooking({ guests: [], bookings: [] }, BASE_INPUT, "2026-08-25");
    if (!res.ok) throw new Error(res.error);
    const paid: Booking = {
      ...res.booking,
      collection: { ...res.booking.collection, paidToHotel: res.booking.totalBill, pending: 0 },
    };

    expect(invoiceRoomGstPct(paid, LIVE_PCT)).toBe(GST_PCT);

    const invoice = buildRoomInvoice(
      "INV-TEST-PAID",
      "2026-08-26T00:00:00Z",
      paid,
      { id: paid.guestId, name: "Purab Lamba" } as Guest,
      invoiceRoomGstPct(paid, LIVE_PCT),
    );
    expect(invoice.gstRate).toBe(GST_PCT);
    expect(invoice.grandTotal).toBe(paid.totalBill);
    expect(invoice.amountPaid).toBe(paid.totalBill);
    expect(invoice.balanceDue).toBe(0);
  });

  it("uses the live setting for a still-pending booking", () => {
    const res = createBooking({ guests: [], bookings: [] }, BASE_INPUT, "2026-08-25");
    if (!res.ok) throw new Error(res.error);

    expect(res.booking.collection.pending).toBeGreaterThan(0);
    expect(invoiceRoomGstPct(res.booking, LIVE_PCT)).toBe(LIVE_PCT);
  });
});
