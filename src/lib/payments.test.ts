import { describe, expect, it } from "vitest";

import { getBookingsPageData, getPaymentsPageData, withTotal } from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { formatINR } from "@/lib/booking-math";
import type { Booking, PaymentsKpi } from "@/types/booking";

const TODAY = "2026-07-14";

function kpi(kpis: PaymentsKpi[], key: PaymentsKpi["key"]): PaymentsKpi {
  return kpis.find((k) => k.key === key)!;
}

/** A live (checked-in) direct booking with money in hand — the base every
 *  synthetic case below tweaks, so each test only states what it changes. */
function liveBooking(overrides: Partial<Booking>): Booking {
  return withTotal({
    id: "KRC-TEST-001",
    guestId: "G-001",
    roomNo: "101",
    roomType: "deluxe",
    checkIn: "2026-07-14",
    checkOut: "2026-07-15",
    urn: 1,
    source: "direct",
    mealPlan: "EP",
    revenue: { room: 5000, earlyCheckIn: 0, lateCheckOut: 0, other: 0, discount: 0, taxPct: 12 },
    collection: {
      paidToHotel: 5000,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "checked_in",
    createdAt: "2026-07-10T09:00:00.000Z",
    ...overrides,
  });
}

describe("getPaymentsPageData", () => {
  it("signs every live movement as money in", async () => {
    const { transactions } = await getPaymentsPageData(fixtures, TODAY);

    expect(transactions.length).toBeGreaterThan(0);
    for (const t of transactions) {
      expect(t.txn.amount).toBeGreaterThan(0);
      expect(t.amount.startsWith("+")).toBe(true);
    }
  });

  it("separates OTA money from direct money", async () => {
    const { transactions, ota } = await getPaymentsPageData(fixtures, TODAY);
    const bookings = fixtures.bookings;
    const otaSourced = new Set(ota.map((o) => o.source));

    for (const t of transactions) {
      const b = bookings.find((x) => x.id === t.txn.bookingId)!;
      expect(t.txn.method === "ota").toBe(otaSourced.has(b.source));
    }
    const panelTotal = ota.reduce((sum, o) => sum + o.amount, 0);
    const channelMoney = bookings.reduce((sum, b) => sum + b.collection.otaCollection, 0);
    expect(panelTotal).toBe(channelMoney);
  });

  it("derives each channel's commission rate from the money beside it", async () => {
    const { ota } = await getPaymentsPageData(fixtures, TODAY);
    const bookings = fixtures.bookings;

    expect(ota.length).toBeGreaterThan(0);
    for (const o of ota) {
      const sold = bookings.filter((b) => b.source === o.source && b.collection.otaCollection > 0);
      const commission = sold.reduce((sum, b) => sum + b.collection.otaCommission, 0);
      expect(o.count).toBe(sold.length);
      expect(o.commissionPct).toBe(Math.round((commission / o.amount) * 100));
    }
  });

  it("computes the month's net as gross less commission and refunds", async () => {
    const { rollup } = await getPaymentsPageData(fixtures, TODAY);

    expect(rollup.net).toBe(rollup.gross - rollup.commission - rollup.refunds);
    expect(rollup.label).toBe("July 2026");
  });

  it("counts as gross only the stays that billed", async () => {
    const { rollup } = await getPaymentsPageData(fixtures, TODAY);
    const bookings = fixtures.bookings;

    const billed = bookings.filter(
      (b) => b.checkIn.startsWith("2026-07") && b.status !== "cancelled" && b.status !== "no_show",
    );
    expect(rollup.gross).toBe(billed.reduce((sum, b) => sum + b.totalBill, 0));
    expect(bookings.some((b) => b.status === "cancelled")).toBe(true);
  });

  it("quotes the same OTA receivable the bookings screen does", async () => {
    const { kpis } = await getPaymentsPageData(fixtures, TODAY);
    const { summary } = await getBookingsPageData(fixtures, TODAY);

    const here = kpi(kpis, "otaReceivables").value;
    const there = summary.find((s) => s.key === "otaReceivables")!.value;
    expect(here).toBe(there);
  });

  it("quotes the same pending collection the bookings screen does", async () => {
    const { kpis } = await getPaymentsPageData(fixtures, TODAY);
    const { totals } = await getBookingsPageData(fixtures, TODAY);

    expect(kpi(kpis, "pendingFromGuests").value).toBe(formatINR(totals.pending));
  });

  it("renders 'N/A' method and '—' time for a booking with no recorded method or settlement time, without crashing", async () => {
    const { transactions } = await getPaymentsPageData(fixtures, TODAY);

    // None of the fixture bookings have paymentMethod/paidAt yet (b-ii/b-iii
    // haven't landed), so every non-OTA row should read "N/A"/"—" respectively.
    const directRows = transactions.filter((t) => t.txn.method !== "ota");
    expect(directRows.length).toBeGreaterThan(0);
    for (const t of directRows) {
      expect(t.txn.method).toBeNull();
      expect(t.methodLabel).toBe("N/A");
      expect(t.txn.at).toBeNull();
      expect(t.time).toBe("—");
    }
  });

  it("emits a row for a non-void booking holding money", async () => {
    const booking = liveBooking({ id: "KRC-TEST-live" });
    const data = { bookings: [booking], guests: fixtures.guests, partyHall: fixtures.partyHall };

    const { transactions } = await getPaymentsPageData(data, TODAY);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].txn.bookingId).toBe("KRC-TEST-live");
    expect(transactions[0].txn.amount).toBe(5000);
    expect(transactions[0].txn.status).toBe("success");
  });

  it("emits no row for a cancelled booking, even one still holding money", async () => {
    const booking = liveBooking({ id: "KRC-TEST-cancelled", status: "cancelled" });
    const data = { bookings: [booking], guests: fixtures.guests, partyHall: fixtures.partyHall };

    const { transactions } = await getPaymentsPageData(data, TODAY);

    expect(transactions).toHaveLength(0);
  });

  it("excludes void bookings from every KPI sum", async () => {
    const live = liveBooking({ id: "KRC-TEST-live" });
    const cancelled = liveBooking({ id: "KRC-TEST-cancelled", status: "cancelled" });
    const noShow = liveBooking({ id: "KRC-TEST-noshow", status: "no_show" });
    const data = {
      bookings: [live, cancelled, noShow],
      guests: fixtures.guests,
      partyHall: fixtures.partyHall,
    };

    const { kpis } = await getPaymentsPageData(data, TODAY);

    expect(kpi(kpis, "totalCollected").value).toBe(formatINR(5000));
  });

  it("sums 'Total collected' as real paidToHotel across non-void bookings", async () => {
    const { kpis } = await getPaymentsPageData(fixtures, TODAY);
    const bookings = fixtures.bookings;

    const expected = bookings
      .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
      .reduce((sum, b) => sum + b.collection.paidToHotel, 0);
    expect(kpi(kpis, "totalCollected").value).toBe(formatINR(expected));
  });

  it("settles through Razorpay only bookings Razorpay actually processed", async () => {
    const settled = liveBooking({ id: "KRC-TEST-razorpay", razorpayPaymentId: "pay_abc123" });
    const unsettled = liveBooking({ id: "KRC-TEST-unsettled" });
    const data = {
      bookings: [settled, unsettled],
      guests: fixtures.guests,
      partyHall: fixtures.partyHall,
    };

    const { kpis } = await getPaymentsPageData(data, TODAY);

    // Only the booking carrying a razorpayPaymentId counts — not a method
    // string, which stays "—" for both until a write path records it.
    expect(kpi(kpis, "razorpaySettled").value).toBe(formatINR(5000));
  });

  it("counts toward 'collected today' only rows with a paidAt recorded today", async () => {
    const { kpis } = await getPaymentsPageData(fixtures, TODAY);

    // No fixture booking has paidAt set yet — that's b-ii/b-iii's job — so the
    // honest answer today is zero, not a figure borrowed from createdAt.
    expect(kpi(kpis, "collectedToday").value).toBe(formatINR(0));
    expect(kpi(kpis, "collectedToday").note).toBe("0 transactions · by recorded payment time");
  });

  it("counts a paidAt dated today toward 'collected today'", async () => {
    const paidToday = liveBooking({ id: "KRC-TEST-today", paidAt: "2026-07-14T09:42:00+05:30" });
    const paidEarlier = liveBooking({
      id: "KRC-TEST-earlier",
      paidAt: "2026-07-10T09:42:00+05:30",
    });
    const data = {
      bookings: [paidToday, paidEarlier],
      guests: fixtures.guests,
      partyHall: fixtures.partyHall,
    };

    const { kpis, transactions } = await getPaymentsPageData(data, TODAY);

    expect(kpi(kpis, "collectedToday").value).toBe(formatINR(5000));
    const today = transactions.find((t) => t.txn.bookingId === "KRC-TEST-today")!;
    expect(today.time).toMatch(/^\d{1,2}:\d{2}\s?(am|pm)$/);
  });

  it("keys 'pending from guests' off the booking's source, not the method string", async () => {
    const guestPending = liveBooking({
      id: "KRC-TEST-guest-pending",
      collection: {
        paidToHotel: 0,
        otaCollection: 0,
        otaCommission: 0,
        complimentary: 0,
        pending: 2000,
      },
    });
    const otaPending = liveBooking({
      id: "KRC-TEST-ota-pending",
      source: "booking_com",
      collection: {
        paidToHotel: 0,
        otaCollection: 3000,
        otaCommission: 450,
        complimentary: 0,
        pending: 0,
      },
    });
    const data = {
      bookings: [guestPending, otaPending],
      guests: fixtures.guests,
      partyHall: fixtures.partyHall,
    };

    const { kpis } = await getPaymentsPageData(data, TODAY);

    // Both rows land in "pending" status with method "—"/"ota" respectively —
    // only the guestPending booking (a non-OTA source) should count here.
    expect(kpi(kpis, "pendingFromGuests").value).toBe(formatINR(2000));
  });

  it("lists the most recent movement first, falling back to createdAt when paidAt is unset", async () => {
    const older = liveBooking({
      id: "KRC-TEST-older",
      paidAt: "2026-07-10T09:00:00+05:30",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    const newer = liveBooking({
      id: "KRC-TEST-newer",
      paidAt: "2026-07-13T09:00:00+05:30",
      createdAt: "2026-07-02T00:00:00.000Z",
    });
    const undated = liveBooking({
      id: "KRC-TEST-undated",
      createdAt: "2026-07-20T00:00:00.000Z",
    });
    const data = {
      bookings: [older, newer, undated],
      guests: fixtures.guests,
      partyHall: fixtures.partyHall,
    };

    const { transactions } = await getPaymentsPageData(data, TODAY);

    expect(transactions.map((t) => t.txn.bookingId)).toEqual([
      "KRC-TEST-undated",
      "KRC-TEST-newer",
      "KRC-TEST-older",
    ]);
    const olderRow = transactions.find((t) => t.txn.bookingId === "KRC-TEST-older")!;
    expect(olderRow.time).toBe("10 Jul");
  });
});
