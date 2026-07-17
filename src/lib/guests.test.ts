import { describe, expect, it } from "vitest";

import { getBookingsPageData, getGuestsPageData, guestTier } from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { formatINRCompact } from "@/lib/booking-math";
import type { GuestStat } from "@/types/booking";

function statValue(stats: GuestStat[], key: GuestStat["key"]): string {
  return stats.find((s) => s.key === key)!.value;
}

describe("guestTier", () => {
  it("promotes on stays, at the design's boundaries", () => {
    expect(guestTier(0)).toBe("new");
    expect(guestTier(1)).toBe("new");
    expect(guestTier(2)).toBe("silver");
    expect(guestTier(3)).toBe("silver");
    expect(guestTier(4)).toBe("gold");
    expect(guestTier(9)).toBe("gold");
  });

  it("gives every guest a badge that matches their stay count", async () => {
    for (const g of fixtures.guests) {
      expect(g.tier).toBe(guestTier(g.stays));
    }
  });
});

describe("getGuestsPageData", () => {
  it("returns one row per guest, best lifetime value first", async () => {
    const { guests } = await getGuestsPageData(fixtures);
    const all = fixtures.guests;

    expect(guests).toHaveLength(all.length);
    const ltvs = guests.map((g) => g.guest.lifetimeValue);
    expect(ltvs).toEqual([...ltvs].sort((a, b) => b - a));
  });

  it("stat strip agrees with the directory it sits above", async () => {
    const { stats, guests, subtitle } = await getGuestsPageData(fixtures);

    const repeat = guests.filter((g) => g.guest.stays >= 2).length;
    const topLtv = Math.max(...guests.map((g) => g.guest.lifetimeValue));

    expect(statValue(stats, "total")).toBe(String(guests.length));
    expect(statValue(stats, "inHouse")).toBe(String(guests.filter((g) => g.inHouse).length));
    expect(statValue(stats, "repeat")).toBe(String(repeat));
    expect(statValue(stats, "topLtv")).toBe(formatINRCompact(topLtv));
    expect(subtitle).toBe(`${guests.length} profiles · ${repeat} repeat guests`);
  });

  it("marks in-house exactly the guests the bookings screen shows checked in", async () => {
    const { guests } = await getGuestsPageData(fixtures);
    const { rows } = await getBookingsPageData(fixtures, "2026-07-15");

    const checkedIn = new Set(
      rows.filter((r) => r.booking.status === "checked_in").map((r) => r.booking.guestId),
    );

    expect(checkedIn.size).toBeGreaterThan(0);
    for (const g of guests) {
      expect(g.inHouse).toBe(checkedIn.has(g.guest.id));
    }
  });

  it("dates the last stay from a stay that happened, never a booking that didn't", async () => {
    const { guests } = await getGuestsPageData(fixtures);
    const { rows } = await getBookingsPageData(fixtures, "2026-07-15");
    const byId = new Map(guests.map((g) => [g.guest.id, g]));

    // A cancelled booking and a no-show are stays the guest never took, so
    // neither guest can carry a date — even though both have a seeded stay.
    for (const status of ["cancelled", "no_show"] as const) {
      const row = rows.find((r) => r.booking.status === status)!;
      expect(byId.get(row.booking.guestId)!.lastStay).toBe("—");
    }

    // Someone still in-house is dated by their arrival, not a future check-out.
    const stay = rows.find((r) => r.booking.status === "checked_in")!.booking;
    expect(byId.get(stay.guestId)!.lastStay).toBe("14 Jul 2026");
    expect(stay.checkIn).toBe("2026-07-14");
  });

  it("gives every row initials and an avatar colour", async () => {
    const { guests } = await getGuestsPageData(fixtures);
    for (const g of guests) {
      expect(g.initials).toMatch(/^[A-Z]{1,2}$/);
      expect(g.avatarBg).toMatch(/^#[0-9a-f]{6}$/);
      expect(g.avatarColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
