import { describe, expect, it } from "vitest";

import { getCalendarPageData, occupancyBand, ROOM_NUMBERS } from "@/lib/bookings";
import type { CalendarDay } from "@/types/booking";

const daysOf = (cells: Awaited<ReturnType<typeof getCalendarPageData>>["cells"]) =>
  cells.filter((c): c is { kind: "day" } & CalendarDay => c.kind === "day");

describe("getCalendarPageData", () => {
  it("July 2026 opens on a Wednesday — three leading blanks", async () => {
    const { cells } = await getCalendarPageData(2026, 7);
    expect(cells.slice(0, 3).every((c) => c.kind === "blank")).toBe(true);
    expect(cells[3]).toMatchObject({ kind: "day", day: 1, date: "2026-07-01" });
  });

  it("lays out whole weeks with every day of the month, in order", async () => {
    const { cells } = await getCalendarPageData(2026, 7);
    expect(cells.length % 7).toBe(0);

    const days = daysOf(cells);
    expect(days.length).toBe(31);
    expect(days.map((d) => d.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("puts each day in the column its real weekday falls on", async () => {
    const { cells } = await getCalendarPageData(2026, 7);
    cells.forEach((cell, i) => {
      if (cell.kind !== "day") return;
      expect(new Date(`${cell.date}T00:00:00Z`).getUTCDay()).toBe(i % 7);
    });
  });

  it("derives the percent from occupied/14 so the pair can't disagree", async () => {
    const { cells, totalRooms } = await getCalendarPageData(2026, 7);
    expect(totalRooms).toBe(ROOM_NUMBERS.length);

    for (const d of daysOf(cells)) {
      expect(d.total).toBe(14);
      expect(d.occupied).toBeLessThanOrEqual(14);
      expect(d.pct).toBe(Math.round((d.occupied / 14) * 100));
    }
  });

  it("mirrors the design's occupancy percents for July", async () => {
    const { cells } = await getCalendarPageData(2026, 7);
    const pctByDay = new Map(daysOf(cells).map((d) => [d.day, d.pct]));
    // Spot-checks across the ramp, from `Admin Calendar.dc.html`.
    expect(pctByDay.get(1)).toBe(36);
    expect(pctByDay.get(4)).toBe(71);
    expect(pctByDay.get(19)).toBe(93);
    expect(pctByDay.get(25)).toBe(100);
    expect(pctByDay.get(31)).toBe(71);
  });

  it("bands each day per the legend thresholds", async () => {
    const { cells } = await getCalendarPageData(2026, 7);
    for (const d of daysOf(cells)) {
      expect(d.band).toBe(occupancyBand(d.pct));
    }
  });

  it("legend names all four bands of the ramp, low to full", async () => {
    const { legend } = await getCalendarPageData(2026, 7);
    expect(legend.map((l) => l.band)).toEqual(["low", "medium", "high", "full"]);
    expect(legend.map((l) => l.label)).toEqual(["Low (<40%)", "Medium", "High (>70%)", "Full"]);
  });

  it("flags party-hall events on their own day and nowhere else", async () => {
    const { cells } = await getCalendarPageData(2026, 7);
    const flagged = daysOf(cells).filter((d) => d.event !== null);
    expect(flagged.map((d) => [d.day, d.event])).toEqual([
      [12, "Birthday · 55 pax"],
      [22, "Reception · 140 pax"],
      [30, "Wedding · 150 pax"],
    ]);
  });

  it("picks up live party-hall enquiries in months without a seed", async () => {
    const { cells } = await getCalendarPageData(2026, 8);
    const flagged = daysOf(cells).filter((d) => d.event !== null);
    expect(flagged.map((d) => d.day)).toEqual([1, 9]);
    expect(flagged[0].event).toContain("Sharma Family");
  });

  it("labels the month and squares off other month lengths", async () => {
    const july = await getCalendarPageData(2026, 7);
    expect(july.monthLabel).toBe("July 2026");

    // February 2026 — 28 days, opens Sunday, so it tiles exactly four weeks.
    const feb = await getCalendarPageData(2026, 2);
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
