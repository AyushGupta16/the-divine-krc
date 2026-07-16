import { describe, expect, it } from "vitest";

import { getBookings, getDashboardData, getReportsPageData } from "@/lib/bookings";
import { formatINRCompact } from "@/lib/booking-math";
import type { ReportsKpi, ReportsRange, RevenuePeriodKey } from "@/types/booking";

const TODAY = "2026-07-14";
const SELLABLE_ROOMS = 14;

function range(ranges: ReportsRange[], key: RevenuePeriodKey): ReportsRange {
  return ranges.find((r) => r.key === key)!;
}

function kpi(r: ReportsRange, key: ReportsKpi["key"]): ReportsKpi {
  return r.kpis.find((k) => k.key === key)!;
}

/** Strip the formatting back off a KPI so it can be compared as a number. */
function pct(value: string): number {
  return Number(value.replace("%", ""));
}

function rupees(value: string): number {
  return Number(value.replace(/[₹,]/g, ""));
}

describe("getReportsPageData", () => {
  it("offers every range the toggle does, each with a full set of widgets", async () => {
    const { ranges } = await getReportsPageData(TODAY);

    expect(ranges.map((r) => r.key)).toEqual(["7d", "30d", "12m"]);
    for (const r of ranges) {
      expect(r.kpis.map((k) => k.key)).toEqual(["revenue", "occupancy", "adr", "revpar"]);
      expect(r.bars.length).toBeGreaterThan(0);
      expect(r.roomTypes.length).toBeGreaterThan(0);
      expect(r.mealPlans.map((m) => m.plan)).toEqual(["EP", "CP", "MAP", "AP"]);
    }
  });

  it("drives every widget off the range, not just the headline", async () => {
    const { ranges } = await getReportsPageData(TODAY);
    const week = range(ranges, "7d");
    const month = range(ranges, "30d");

    // A wider window is a bigger denominator and a longer chart, so the same
    // nights must read differently under each range.
    expect(week.bars.length).toBe(7);
    expect(month.bars.length).toBe(5);
    expect(range(ranges, "12m").bars.length).toBe(12);
    expect(kpi(week, "revenue").value).not.toBe(kpi(month, "revenue").value);
    expect(pct(kpi(week, "occupancy").value)).toBeGreaterThan(pct(kpi(month, "occupancy").value));
  });

  it("holds RevPAR to ADR times occupancy in every range", async () => {
    const { ranges } = await getReportsPageData(TODAY);

    for (const r of ranges) {
      const adr = rupees(kpi(r, "adr").value);
      const occ = pct(kpi(r, "occupancy").value) / 100;
      const revpar = rupees(kpi(r, "revpar").value);
      // The three ratios read the same nights over the same days, so the
      // identity is exact but for the rounding each display value carries.
      expect(Math.abs(revpar - adr * occ)).toBeLessThanOrEqual(SELLABLE_ROOMS);
    }
  });

  it("charges every stay's bill across its own nights, and voids none of it twice", async () => {
    const { ranges } = await getReportsPageData(TODAY);
    const bookings = await getBookings();
    const week = range(ranges, "7d");

    // Each bar splits into exactly its two series.
    for (const bar of week.bars) expect(bar.total).toBe(bar.direct + bar.ota);

    // A cancelled stay and a no-show sold nothing, so no night of either can
    // appear in the room revenue the bars add up to.
    const voided = bookings.filter((b) => b.status === "cancelled" || b.status === "no_show");
    expect(voided.length).toBeGreaterThan(0);
    const voidedBill = voided.reduce((sum, b) => sum + b.totalBill, 0);
    const yearTotal = range(ranges, "12m").bars.reduce((sum, b) => sum + b.total, 0);
    expect(yearTotal).toBeGreaterThan(0);
    expect(yearTotal).toBeLessThan(yearTotal + voidedBill);
  });

  it("adds the source donut up to exactly 100%", async () => {
    const { ranges } = await getReportsPageData(TODAY);

    for (const r of ranges) {
      expect(r.sources.reduce((sum, s) => sum + s.pct, 0)).toBe(100);
      // A source with no bookings in the window is not a slice.
      for (const s of r.sources) expect(s.count).toBeGreaterThan(0);
    }
  });

  it("counts the meal mix over the nights it sold", async () => {
    const { ranges } = await getReportsPageData(TODAY);

    for (const r of ranges) {
      const total = r.mealPlans.reduce((sum, m) => sum + m.pct, 0);
      expect(total).toBeGreaterThanOrEqual(99);
      expect(total).toBeLessThanOrEqual(101);
    }
    // Nobody in the seed took full board — the row still reports that.
    expect(range(ranges, "12m").mealPlans.find((m) => m.plan === "AP")!.pct).toBe(0);
  });

  it("sizes the performance bars against the best performer", async () => {
    const { ranges } = await getReportsPageData(TODAY);
    const month = range(ranges, "30d");

    expect(month.roomTypes[0].barPct).toBe(100);
    for (let i = 1; i < month.roomTypes.length; i++) {
      expect(month.roomTypes[i].revenue).toBeLessThanOrEqual(month.roomTypes[i - 1].revenue);
    }
    // The hall is sold by the slot, so it reports revenue but no occupancy.
    expect(month.roomTypes.find((r) => r.key === "party_hall")!.occPct).toBeNull();
  });

  it("states no trend when the window before it earned nothing", async () => {
    const { ranges } = await getReportsPageData(TODAY);
    const year = range(ranges, "12m");

    // Nothing precedes the seed, so a year-on-year change cannot be computed —
    // and is reported as absent rather than as zero.
    for (const k of year.kpis) {
      expect(k.delta).toBeNull();
      expect(k.deltaUp).toBeNull();
    }
    // The week before this one held a party-hall event, so that trend is real.
    expect(kpi(range(ranges, "7d"), "revenue").delta).toMatch(/^[▲▼] \d+\.\d%$/);
  });
});

describe("revenue agrees across screens", () => {
  it("quotes the dashboard and the reports screen the same revenue per window", async () => {
    const { ranges } = await getReportsPageData(TODAY);
    const { revenue } = await getDashboardData(TODAY);

    expect(revenue.map((p) => p.key)).toEqual(ranges.map((r) => r.key));
    for (const period of revenue) {
      expect(period.total).toBe(kpi(range(ranges, period.key), "revenue").value);
    }
  });

  it("draws both charts from the same bars", async () => {
    const { ranges } = await getReportsPageData(TODAY);
    const { revenue } = await getDashboardData(TODAY);

    for (const period of revenue) {
      const bars = range(ranges, period.key).bars;
      expect(period.bars.map((b) => b.label)).toEqual(bars.map((b) => b.label));
      // The dashboard plots one bar where reports stacks two; the height is the
      // sum of the split, so the two charts describe the same money.
      expect(period.bars.map((b) => b.value)).toEqual(bars.map((b) => b.total));
    }
  });

  it("totals a window to the sum of the bars beneath it", async () => {
    const { ranges } = await getReportsPageData(TODAY);

    for (const r of ranges) {
      // The buckets tile the window exactly, so the chart accounts for every
      // rupee the headline claims.
      const summed = r.bars.reduce((sum, b) => sum + b.total, 0);
      expect(kpi(r, "revenue").value).toBe(formatINRCompact(summed));
    }
  });
});
