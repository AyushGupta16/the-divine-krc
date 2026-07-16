import { describe, expect, it } from "vitest";

import { getBookingsPageData } from "@/lib/bookings";
import { computeTotalBill, computeTotalCollected } from "@/lib/booking-math";

describe("getBookingsPageData", () => {
  it("returns one row per seeded booking and a joined guest name", async () => {
    const data = await getBookingsPageData("2026-07-15");
    expect(data.rows.length).toBe(data.total);
    expect(data.rows.length).toBeGreaterThan(0);
    for (const { guestName } of data.rows) {
      expect(guestName).not.toBe("—");
    }
  });

  it("status tab counts partition the full row set", async () => {
    const data = await getBookingsPageData("2026-07-15");
    const summed = Object.values(data.countsByStatus).reduce((a, b) => a + b, 0);
    expect(summed).toBe(data.total);
  });

  it("footer totals equal the column sums over every booking", async () => {
    const data = await getBookingsPageData("2026-07-15");
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
    const data = await getBookingsPageData("2026-07-15");
    for (const { booking: b } of data.rows) {
      expect(b.totalBill).toBe(computeTotalBill(b.revenue));
    }
  });

  it("occupied + available always accounts for all 14 rooms", async () => {
    const data = await getBookingsPageData("2026-07-15");
    const occupied = data.summary.find((s) => s.key === "occupied")!.value;
    const available = data.summary.find((s) => s.key === "available")!.value;
    const [occ, total] = occupied.split(" / ").map(Number);
    expect(total).toBe(14);
    expect(occ + Number(available)).toBe(14);
  });

  it("total-collected card equals the sum of collected money in hand", async () => {
    const data = await getBookingsPageData("2026-07-15");
    const expected = data.rows.reduce(
      (sum, { booking: b }) => sum + computeTotalCollected(b.collection),
      0,
    );
    const card = data.summary.find((s) => s.key === "totalCollected")!.value;
    // Strip the ₹ and grouping commas the formatter adds.
    expect(Number(card.replace(/[^0-9]/g, ""))).toBe(expected);
  });
});
