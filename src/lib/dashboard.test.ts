import { describe, expect, it } from "vitest";

import {
  getAvailableRoomCount,
  getBookingsPageData,
  getDashboardData,
  getRoomsPageData,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";

describe("dashboard occupancy", () => {
  it("derives every figure on the card from the tiles", async () => {
    const { occupancy: o } = await getDashboardData(fixtures);

    expect(o.total).toBe(14);
    expect(o.pct).toBe(Math.round((o.occupied / o.total) * 100));
    expect(o.vacant).toBe(o.total - o.occupied);
    // The two room types partition the inventory, so their splits must add up.
    expect(o.deluxe.total + o.deluxeBalcony.total).toBe(o.total);
    expect(o.deluxe.occupied + o.deluxeBalcony.occupied).toBe(o.occupied);
  });

  it("still renders the design's figures", async () => {
    const { occupancy: o } = await getDashboardData(fixtures);

    expect(o.occupied).toBe(9);
    expect(o.pct).toBe(64);
    expect(o.vacant).toBe(5);
    expect(o.deluxe).toEqual({ occupied: 6, total: 10 });
    expect(o.deluxeBalcony).toEqual({ occupied: 3, total: 4 });
  });
});

describe("room state agrees across screens", () => {
  it("counts the same occupied rooms on the dashboard, the board and bookings", async () => {
    const { occupancy } = await getDashboardData(fixtures);
    const rooms = await getRoomsPageData(fixtures);
    const { summary } = await getBookingsPageData(fixtures, "2026-07-15");

    const board = rooms.legend.find((l) => l.status === "occupied")!.count;
    const booked = summary.find((s) => s.key === "occupied")!.value;

    expect(occupancy.occupied).toBe(board);
    expect(booked).toBe(`${board} / 14`);
  });

  it("badges the sidebar with the sellable count the Rooms screen shows", async () => {
    const badge = await getAvailableRoomCount();
    const rooms = await getRoomsPageData(fixtures);

    const available = rooms.legend.find((l) => l.status === "available")!.count;
    expect(badge).toBe(available);
    expect(rooms.summaryLine).toContain(`${badge} available tonight`);
  });

  it("distinguishes vacant from sellable by the rooms held off the market", async () => {
    const { occupancy } = await getDashboardData(fixtures);
    const rooms = await getRoomsPageData(fixtures);
    const count = (status: string) => rooms.legend.find((l) => l.status === status)!.count;

    // A room being cleaned or repaired is vacant but cannot be sold, so the
    // dashboard's vacant figure is the sellable count plus those held back.
    expect(occupancy.vacant).toBe(count("available") + count("cleaning") + count("maintenance"));
    expect(occupancy.vacant).toBeGreaterThan(count("available"));
  });

  it("accounts for all 14 rooms across the four states", async () => {
    const rooms = await getRoomsPageData(fixtures);
    const total = rooms.legend.reduce((sum, l) => sum + l.count, 0);
    expect(total).toBe(14);
  });
});
