import { describe, expect, it } from "vitest";
import {
  bookingId,
  computeTotalBill,
  computeTotalCollected,
  formatINR,
  urn,
} from "./booking-math";

describe("computeTotalBill", () => {
  it("sums charges, subtracts discount, adds GST", () => {
    // (3000 + 0 + 0 + 200) - 200 = 3000 taxable; +12% = 3360
    expect(
      computeTotalBill({
        room: 3000,
        earlyCheckIn: 0,
        lateCheckOut: 0,
        other: 200,
        discount: 200,
        taxPct: 12,
      }),
    ).toBe(3360);
  });

  it("handles zero tax", () => {
    expect(
      computeTotalBill({
        room: 1500,
        earlyCheckIn: 0,
        lateCheckOut: 0,
        other: 0,
        discount: 0,
        taxPct: 0,
      }),
    ).toBe(1500);
  });

  it("never taxes below zero when discount exceeds charges", () => {
    expect(
      computeTotalBill({
        room: 100,
        earlyCheckIn: 0,
        lateCheckOut: 0,
        other: 0,
        discount: 500,
        taxPct: 18,
      }),
    ).toBe(0);
  });
});

describe("computeTotalCollected", () => {
  it("adds hotel, OTA collection and complimentary, ignoring commission and pending", () => {
    expect(
      computeTotalCollected({
        paidToHotel: 1000,
        otaCollection: 2000,
        otaCommission: 300,
        complimentary: 150,
        pending: 500,
      }),
    ).toBe(3150);
  });
});

describe("urn", () => {
  it("counts nights between ISO dates", () => {
    expect(urn("2026-07-15", "2026-07-18")).toBe(3);
  });

  it("returns 0 for same day and negative ranges", () => {
    expect(urn("2026-07-15", "2026-07-15")).toBe(0);
    expect(urn("2026-07-18", "2026-07-15")).toBe(0);
  });

  it("returns 0 for invalid input", () => {
    expect(urn("not-a-date", "2026-07-15")).toBe(0);
  });
});

describe("formatINR", () => {
  it("formats with Indian grouping and no paise", () => {
    expect(formatINR(1500)).toBe("₹1,500");
    expect(formatINR(150000)).toBe("₹1,50,000");
  });
});

describe("bookingId", () => {
  it("builds KRC-YYYYMMDD-nnn with zero padding", () => {
    expect(bookingId("2026-07-05", 7)).toBe("KRC-20260705-007");
  });

  it("accepts a Date", () => {
    expect(bookingId(new Date(2026, 11, 25), 123)).toBe("KRC-20261225-123");
  });
});
