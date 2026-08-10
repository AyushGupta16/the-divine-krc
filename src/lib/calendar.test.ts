import { describe, expect, it } from "vitest";

import {
  getCalendarPageData,
  normalizeCalendarSearch,
  occupancyBand,
  ROOM_NUMBERS,
  shiftCalendarMonth,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import type { Booking, CalendarDay, RoomTile } from "@/types/booking";

const daysOf = (cells: Awaited<ReturnType<typeof getCalendarPageData>>["cells"]) =>
  cells.filter((c): c is { kind: "day" } & CalendarDay => c.kind === "day");

describe("getCalendarPageData", () => {
  it("July 2026 opens on a Wednesday — three leading blanks", async () => {
    const { cells } = await getCalendarPageData(fixtures, 2026, 7);
    expect(cells.slice(0, 3).every((c) => c.kind === "blank")).toBe(true);
    expect(cells[3]).toMatchObject({ kind: "day", day: 1, date: "2026-07-01" });
  });

  it("lays out whole weeks with every day of the month, in order", async () => {
    const { cells } = await getCalendarPageData(fixtures, 2026, 7);
    expect(cells.length % 7).toBe(0);

    const days = daysOf(cells);
    expect(days.length).toBe(31);
    expect(days.map((d) => d.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("puts each day in the column its real weekday falls on", async () => {
    const { cells } = await getCalendarPageData(fixtures, 2026, 7);
    cells.forEach((cell, i) => {
      if (cell.kind !== "day") return;
      expect(new Date(`${cell.date}T00:00:00Z`).getUTCDay()).toBe(i % 7);
    });
  });

  it("derives the percent from occupied/total (sellable rooms) so the pair can't disagree", async () => {
    const { cells, totalRooms, maintenanceRooms } = await getCalendarPageData(fixtures, 2026, 7);
    // The fixture seed has one room (105) under maintenance — sellable
    // inventory is the physical count minus that, not the raw room count.
    expect(maintenanceRooms).toBe(1);
    expect(totalRooms).toBe(ROOM_NUMBERS.length - 1);

    for (const d of daysOf(cells)) {
      expect(d.total).toBe(totalRooms);
      expect(d.maintenanceRooms).toBe(maintenanceRooms);
      expect(d.occupied).toBeLessThanOrEqual(totalRooms);
      expect(d.pct).toBe(Math.round((d.occupied / totalRooms) * 100));
    }
  });

  it("reaches every band through real bookings, no seeded/fabricated data", async () => {
    // Replaces the deleted JULY_2026_OCCUPANCY table's fictional 93%/100%
    // figures. These are genuine fixture bookings landing in each band via
    // occupiedRoomsOn — see the "late-July occupancy ramp" fixtures.
    const { cells } = await getCalendarPageData(fixtures, 2026, 7);
    const pctByDay = new Map(daysOf(cells).map((d) => [d.day, d.pct]));
    const bandByDay = new Map(daysOf(cells).map((d) => [d.day, d.band]));

    // Before any booking starts — genuinely empty, not a placeholder.
    expect(pctByDay.get(1)).toBe(0);
    expect(bandByDay.get(1)).toBe("low");

    // 6 of 13 sellable rooms.
    expect(pctByDay.get(23)).toBe(46);
    expect(bandByDay.get(23)).toBe("medium");

    // 10 of 13.
    expect(pctByDay.get(24)).toBe(77);
    expect(bandByDay.get(24)).toBe("high");

    // 13 of 13 — a genuine full house, reachable through the real derivation.
    expect(pctByDay.get(25)).toBe(100);
    expect(bandByDay.get(25)).toBe("full");
    expect(pctByDay.get(26)).toBe(100);
    expect(bandByDay.get(26)).toBe("full");

    // Checked out (exclusive) — back down, not still full.
    expect(pctByDay.get(27)).toBe(0);
    expect(bandByDay.get(27)).toBe("low");
  });

  it("bands each day per the legend thresholds", async () => {
    const { cells } = await getCalendarPageData(fixtures, 2026, 7);
    for (const d of daysOf(cells)) {
      expect(d.band).toBe(occupancyBand(d.pct));
    }
  });

  it("legend names all four bands of the ramp, low to full", async () => {
    const { legend } = await getCalendarPageData(fixtures, 2026, 7);
    expect(legend.map((l) => l.band)).toEqual(["low", "medium", "high", "full"]);
    // Code is inclusive at every boundary (>=40, >=70, >=100) — the label
    // text must say so, not the exclusive-reading "(>70%)" that used to
    // contradict a day at exactly 70% rendering as high.
    expect(legend.map((l) => l.label)).toEqual(["Low (<40%)", "Medium", "High (70%+)", "Full"]);
  });

  it("flags party-hall events on their own day and nowhere else", async () => {
    // Live enquiry set only — no seeded/design placeholder events. July's 2nd
    // (a completed Sangeet) is history, not something to plan around; only
    // the 30th (an upcoming, confirmed wedding) flags.
    const { cells } = await getCalendarPageData(fixtures, 2026, 7);
    const flagged = daysOf(cells).filter((d) => d.event !== null);
    expect(flagged.map((d) => [d.day, d.event])).toEqual([
      [30, "Wedding reception — Rao family · 150 pax"],
    ]);
  });

  it("picks up live party-hall enquiries in months without a seed", async () => {
    const { cells } = await getCalendarPageData(fixtures, 2026, 8);
    const flagged = daysOf(cells).filter((d) => d.event !== null);
    expect(flagged.map((d) => d.day)).toEqual([8, 12, 16, 22, 29]);
    expect(flagged[0].event).toContain("Iyer family");
  });

  it("does not flag events already settled", async () => {
    // The hall's 21 Jun event is completed — history, not a booking to plan around.
    const { cells } = await getCalendarPageData(fixtures, 2026, 6);
    expect(daysOf(cells).filter((d) => d.event !== null)).toEqual([]);
  });

  it("labels the month and squares off other month lengths", async () => {
    const july = await getCalendarPageData(fixtures, 2026, 7);
    expect(july.monthLabel).toBe("July 2026");

    // February 2026 — 28 days, opens Sunday, so it tiles exactly four weeks.
    const feb = await getCalendarPageData(fixtures, 2026, 2);
    expect(feb.monthLabel).toBe("February 2026");
    expect(daysOf(feb.cells).length).toBe(28);
    expect(feb.cells.length).toBe(28);
  });
});

describe("occupancyBand", () => {
  it("maps the ramp at and around each legend threshold", () => {
    expect(occupancyBand(0)).toBe("low");
    expect(occupancyBand(39)).toBe("low");
    expect(occupancyBand(40)).toBe("medium");
    expect(occupancyBand(69)).toBe("medium");
    expect(occupancyBand(70)).toBe("high");
    expect(occupancyBand(99)).toBe("high");
    expect(occupancyBand(100)).toBe("full");
  });
});

describe("shiftCalendarMonth", () => {
  it("rolls the year forward at the December→January boundary", () => {
    expect(shiftCalendarMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("rolls the year backward at the January→December boundary", () => {
    expect(shiftCalendarMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("steps within a year without touching it", () => {
    expect(shiftCalendarMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
    expect(shiftCalendarMonth(2026, 7, -1)).toEqual({ year: 2026, month: 6 });
  });
});

describe("normalizeCalendarSearch", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");

  it("passes through a well-formed year/month", () => {
    expect(normalizeCalendarSearch({ year: 2026, month: 3 }, now)).toEqual({
      year: 2026,
      month: 3,
    });
  });

  it("falls back to today for a non-numeric month", () => {
    expect(normalizeCalendarSearch({ year: 2026, month: "abc" }, now)).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("falls back to today for a month of 0 or 13, not clamped to the nearest bound", () => {
    expect(normalizeCalendarSearch({ year: 2026, month: 0 }, now)).toEqual({
      year: 2026,
      month: 8,
    });
    expect(normalizeCalendarSearch({ year: 2026, month: 13 }, now)).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("falls back to today for an out-of-range year", () => {
    expect(normalizeCalendarSearch({ year: 99999, month: 3 }, now)).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("falls back to today for both pieces when either is invalid — not a valid year paired with today's month", () => {
    // year=2030 is otherwise valid, but month is garbage — the whole pair
    // resets, so this must not come back as { year: 2030, month: 8 }.
    expect(normalizeCalendarSearch({ year: 2030, month: "x" }, now)).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("falls back to today when both are absent", () => {
    expect(normalizeCalendarSearch({}, now)).toEqual({ year: 2026, month: 8 });
  });
});

// A synthetic 100-sellable-room inventory — deliberately not the real 14-room
// property — so occupied-room counts map to whole percents 1:1 and every
// legend boundary (39/40/69/70/99/100) is reachable exactly, through
// getCalendarPageData's real derivation rather than occupancyBand in isolation.
function syntheticRoom(no: string): RoomTile {
  return { no, type: "deluxe", floor: 1, status: "available", detail: "Ready", sizeSqm: null };
}

function syntheticBooking(roomNo: string): Booking {
  return {
    id: `SYN-${roomNo}`,
    guestId: "SYN-GUEST",
    roomNo,
    roomType: "deluxe",
    checkIn: "2027-01-01",
    checkOut: "2027-01-02",
    urn: 1,
    source: "direct",
    mealPlan: "CP",
    revenue: { room: 0, earlyCheckIn: 0, lateCheckOut: 0, other: 0, discount: 0, taxPct: 0 },
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "confirmed",
    createdAt: "2026-12-01T00:00:00.000Z",
    totalBill: 0,
  };
}

describe("getCalendarPageData — band boundaries", () => {
  const rooms: RoomTile[] = Array.from({ length: 100 }, (_, i) => syntheticRoom(`R${i + 1}`));

  async function pctFor(occupiedCount: number) {
    const bookings = Array.from({ length: occupiedCount }, (_, i) => syntheticBooking(`R${i + 1}`));
    const { cells } = await getCalendarPageData(
      { bookings, guests: [], partyHall: [], rooms },
      2027,
      1,
    );
    const day1 = daysOf(cells).find((d) => d.day === 1)!;
    return day1;
  }

  it("39% is low, 40% is medium — the low/medium boundary", async () => {
    expect((await pctFor(39)).pct).toBe(39);
    expect((await pctFor(39)).band).toBe("low");
    expect((await pctFor(40)).pct).toBe(40);
    expect((await pctFor(40)).band).toBe("medium");
  });

  it("69% is medium, 70% is high — the medium/high boundary", async () => {
    expect((await pctFor(69)).pct).toBe(69);
    expect((await pctFor(69)).band).toBe("medium");
    expect((await pctFor(70)).pct).toBe(70);
    expect((await pctFor(70)).band).toBe("high");
  });

  it("99% is high, 100% is full — the high/full boundary", async () => {
    expect((await pctFor(99)).pct).toBe(99);
    expect((await pctFor(99)).band).toBe("high");
    expect((await pctFor(100)).pct).toBe(100);
    expect((await pctFor(100)).band).toBe("full");
  });

  it("the maintenance-adjusted full case: 12 booked of 12 sellable (2 of 14 under maintenance) is full, not 86%", async () => {
    const fourteenRooms: RoomTile[] = [
      ...Array.from({ length: 12 }, (_, i) => syntheticRoom(`M${i + 1}`)),
      {
        no: "M13",
        type: "deluxe",
        floor: 1,
        status: "maintenance",
        detail: "Repair",
        sizeSqm: null,
      },
      {
        no: "M14",
        type: "deluxe",
        floor: 1,
        status: "maintenance",
        detail: "Repair",
        sizeSqm: null,
      },
    ];
    const bookings = Array.from({ length: 12 }, (_, i) => syntheticBooking(`M${i + 1}`));
    const { cells, totalRooms, maintenanceRooms } = await getCalendarPageData(
      { bookings, guests: [], partyHall: [], rooms: fourteenRooms },
      2027,
      1,
    );
    expect(maintenanceRooms).toBe(2);
    expect(totalRooms).toBe(12);
    const day1 = daysOf(cells).find((d) => d.day === 1)!;
    expect(day1.occupied).toBe(12);
    expect(day1.total).toBe(12);
    expect(day1.pct).toBe(100);
    expect(day1.band).toBe("full");
  });
});
