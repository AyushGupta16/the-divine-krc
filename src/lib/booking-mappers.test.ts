import { describe, expect, it } from "vitest";

import { toBooking, type BookingRow } from "@/lib/booking-mappers";

/**
 * Every column populated with a distinct sentinel value. If a future column
 * is added to the schema/Booking type but not to `toBooking`, this either
 * fails to typecheck (missing from `ROW`) or asserts `undefined` below where
 * a value was expected — the drift this test exists to catch.
 */
const ROW: BookingRow = {
  id: "KRC-20260801-001",
  guestId: "guest-1",
  roomNo: "101",
  roomType: "deluxe",
  checkIn: "2026-08-01",
  checkOut: "2026-08-03",
  urn: 2,
  source: "direct",
  mealPlan: "EP",
  revenueRoom: 5000,
  revenueEarlyCheckIn: 100,
  revenueLateCheckOut: 200,
  revenueOther: 300,
  revenueDiscount: 50,
  revenueTaxPct: 12,
  collectionPaidToHotel: 4000,
  collectionOtaCollection: 500,
  collectionOtaCommission: 50,
  collectionComplimentary: 0,
  collectionPending: 600,
  status: "confirmed",
  createdAt: new Date("2026-07-30T10:00:00Z"),
  roomAssignedAt: new Date("2026-07-31T09:00:00Z"),
  razorpayOrderId: "order_sentinel",
  razorpayPaymentId: "pay_sentinel",
  paymentMethod: "upi",
  paidAt: new Date("2026-08-01T08:00:00Z"),
  recordedBy: "admin@thedivinekrc.in",
  batchId: "batch_sentinel",
  specialRequest: { preferences: ["high_floor"], note: "arriving late" },
  requestedServices: { earlyCheckIn: { requested: true, status: "applied" } },
  revenueOtherNote: "Extra mattress ×1",
} as BookingRow;

describe("toBooking — mapper completeness", () => {
  it("maps every populated row column onto the Booking, dropping nothing", () => {
    const booking = toBooking(ROW);

    expect(booking.id).toBe(ROW.id);
    expect(booking.guestId).toBe(ROW.guestId);
    expect(booking.roomNo).toBe(ROW.roomNo);
    expect(booking.roomType).toBe(ROW.roomType);
    expect(booking.checkIn).toBe(ROW.checkIn);
    expect(booking.checkOut).toBe(ROW.checkOut);
    expect(booking.urn).toBe(ROW.urn);
    expect(booking.source).toBe(ROW.source);
    expect(booking.mealPlan).toBe(ROW.mealPlan);
    expect(booking.revenue).toEqual({
      room: ROW.revenueRoom,
      earlyCheckIn: ROW.revenueEarlyCheckIn,
      lateCheckOut: ROW.revenueLateCheckOut,
      other: ROW.revenueOther,
      discount: ROW.revenueDiscount,
      taxPct: ROW.revenueTaxPct,
    });
    expect(booking.collection).toEqual({
      paidToHotel: ROW.collectionPaidToHotel,
      otaCollection: ROW.collectionOtaCollection,
      otaCommission: ROW.collectionOtaCommission,
      complimentary: ROW.collectionComplimentary,
      pending: ROW.collectionPending,
    });
    expect(booking.status).toBe(ROW.status);
    expect(booking.createdAt).toBe(ROW.createdAt.toISOString());

    // The fields the audit found dropped by one or both mappers.
    expect(booking.roomAssignedAt).toBe(ROW.roomAssignedAt?.toISOString());
    expect(booking.razorpayOrderId).toBe(ROW.razorpayOrderId);
    expect(booking.razorpayPaymentId).toBe(ROW.razorpayPaymentId);
    expect(booking.paymentMethod).toBe(ROW.paymentMethod);
    expect(booking.paidAt).toBe(ROW.paidAt?.toISOString());
    expect(booking.recordedBy).toBe(ROW.recordedBy);
    expect(booking.batchId).toBe(ROW.batchId);
    expect(booking.specialRequest).toEqual(ROW.specialRequest);
    expect(booking.requestedServices).toEqual(ROW.requestedServices);
    expect(booking.revenueOtherNote).toBe(ROW.revenueOtherNote);

    // None of the optional fields should have silently fallen back to
    // undefined when the row had a real value.
    for (const [key, value] of Object.entries(booking)) {
      if (key === "totalBill") continue; // derived, not a row column
      expect(value, `booking.${key} was undefined despite a populated row`).not.toBeUndefined();
    }
  });

  it("maps a legacy/null row to undefined optional fields, not null", () => {
    const legacyRow: BookingRow = {
      ...ROW,
      roomAssignedAt: null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      paymentMethod: null,
      paidAt: null,
      recordedBy: null,
      batchId: null,
      specialRequest: null,
      requestedServices: null,
      revenueOtherNote: null,
    } as BookingRow;

    const booking = toBooking(legacyRow);

    expect(booking.roomAssignedAt).toBeUndefined();
    expect(booking.razorpayOrderId).toBeUndefined();
    expect(booking.razorpayPaymentId).toBeUndefined();
    expect(booking.paymentMethod).toBeUndefined();
    expect(booking.paidAt).toBeUndefined();
    expect(booking.recordedBy).toBeUndefined();
    expect(booking.batchId).toBeUndefined();
    expect(booking.specialRequest).toBeUndefined();
    expect(booking.requestedServices).toBeUndefined();
    expect(booking.revenueOtherNote).toBeUndefined();
  });
});
