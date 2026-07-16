import { describe, expect, it } from "vitest";

import { getBookings, getBookingsPageData, getPaymentsPageData } from "@/lib/bookings";
import { formatINR } from "@/lib/booking-math";
import type { PaymentsKpi } from "@/types/booking";

const TODAY = "2026-07-14";

function kpi(kpis: PaymentsKpi[], key: PaymentsKpi["key"]): PaymentsKpi {
  return kpis.find((k) => k.key === key)!;
}

describe("getPaymentsPageData", () => {
  it("signs money out negative and money in positive", async () => {
    const { transactions } = await getPaymentsPageData(TODAY);

    for (const t of transactions) {
      expect(t.txn.amount).not.toBe(0);
      if (t.txn.status === "refunded") {
        expect(t.txn.amount).toBeLessThan(0);
        expect(t.amount.startsWith("−")).toBe(true);
      } else {
        expect(t.txn.amount).toBeGreaterThan(0);
        expect(t.amount.startsWith("+")).toBe(true);
      }
    }
  });

  it("separates OTA money from direct money", async () => {
    const { transactions, ota } = await getPaymentsPageData(TODAY);
    const bookings = await getBookings();
    const otaSourced = new Set(ota.map((o) => o.source));

    // Every OTA-method row belongs to a channel booking, and vice versa.
    for (const t of transactions) {
      const b = bookings.find((x) => x.id === t.txn.bookingId)!;
      expect(t.txn.method === "ota").toBe(otaSourced.has(b.source));
    }
    // Direct money never lands in the OTA panel: the panel's total is exactly
    // what the channels collected.
    const panelTotal = ota.reduce((sum, o) => sum + o.amount, 0);
    const channelMoney = bookings.reduce((sum, b) => sum + b.collection.otaCollection, 0);
    expect(panelTotal).toBe(channelMoney);
  });

  it("derives each channel's commission rate from the money beside it", async () => {
    const { ota } = await getPaymentsPageData(TODAY);
    const bookings = await getBookings();

    expect(ota.length).toBeGreaterThan(0);
    for (const o of ota) {
      const sold = bookings.filter((b) => b.source === o.source && b.collection.otaCollection > 0);
      const commission = sold.reduce((sum, b) => sum + b.collection.otaCommission, 0);
      expect(o.count).toBe(sold.length);
      expect(o.commissionPct).toBe(Math.round((commission / o.amount) * 100));
    }
  });

  it("computes the month's net as gross less commission and refunds", async () => {
    const { rollup } = await getPaymentsPageData(TODAY);

    expect(rollup.net).toBe(rollup.gross - rollup.commission - rollup.refunds);
    expect(rollup.label).toBe("July 2026");
  });

  it("counts as gross only the stays that billed", async () => {
    const { rollup } = await getPaymentsPageData(TODAY);
    const bookings = await getBookings();

    // A cancelled booking and a no-show earned nothing, so neither is in gross.
    const billed = bookings.filter(
      (b) => b.checkIn.startsWith("2026-07") && b.status !== "cancelled" && b.status !== "no_show",
    );
    expect(rollup.gross).toBe(billed.reduce((sum, b) => sum + b.totalBill, 0));
    expect(bookings.some((b) => b.status === "cancelled")).toBe(true);
  });

  it("quotes the same OTA receivable the bookings screen does", async () => {
    const { kpis } = await getPaymentsPageData(TODAY);
    const { summary } = await getBookingsPageData(TODAY);

    const here = kpi(kpis, "otaReceivables").value;
    const there = summary.find((s) => s.key === "otaReceivables")!.value;
    expect(here).toBe(there);
  });

  it("quotes the same pending collection the bookings screen does", async () => {
    const { kpis } = await getPaymentsPageData(TODAY);
    const { totals } = await getBookingsPageData(TODAY);

    expect(kpi(kpis, "pendingFromGuests").value).toBe(formatINR(totals.pending));
  });

  it("counts toward 'collected today' only successful movements dated today", async () => {
    const { kpis, transactions } = await getPaymentsPageData(TODAY);

    const today = transactions.filter(
      (t) => t.txn.status === "success" && t.txn.at.startsWith(TODAY),
    );
    expect(today.length).toBeGreaterThan(0);
    expect(kpi(kpis, "collectedToday").value).toBe(
      formatINR(today.reduce((sum, t) => sum + t.txn.amount, 0)),
    );
    expect(kpi(kpis, "collectedToday").note).toBe(`${today.length} transactions`);
  });

  it("settles through Razorpay only what Razorpay processed", async () => {
    const { kpis, transactions } = await getPaymentsPageData(TODAY);

    const online = transactions.filter(
      (t) => t.txn.status === "success" && ["upi", "card", "net_banking"].includes(t.txn.method),
    );
    expect(kpi(kpis, "razorpaySettled").value).toBe(
      formatINR(online.reduce((sum, t) => sum + t.txn.amount, 0)),
    );
    // Cash is taken at the desk — it never routes through the gateway.
    expect(transactions.some((t) => t.txn.method === "cash")).toBe(true);
  });

  it("lists the most recent movement first, and dates it against today", async () => {
    const { transactions } = await getPaymentsPageData(TODAY);

    const times = transactions.map((t) => Date.parse(t.txn.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));

    const todayRow = transactions.find((t) => t.txn.at.startsWith(TODAY))!;
    expect(todayRow.time).toMatch(/^\d{1,2}:\d{2}\s?(am|pm)$/);
    const yesterday = transactions.find((t) => t.txn.at.startsWith("2026-07-13"))!;
    expect(yesterday.time).toBe("Yesterday");
  });
});
