import { afterEach, describe, expect, it, vi } from "vitest";

import { createBooking, GST_PCT, type NewBookingInput } from "@/lib/bookings";
import { buildRoomInvoice } from "@/lib/invoices";
import * as schema from "@/lib/schema";
import type { Booking, Guest } from "@/types/booking";

// Same stand-in `bookings-data.test.ts` uses: `createServerFn`'s real chain
// needs a request-context runtime that doesn't exist under vitest.
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    createServerFn: () => {
      let validate: ((data: unknown) => unknown) | undefined;
      const chain = {
        validator(fn: (data: unknown) => unknown) {
          validate = fn;
          return chain;
        },
        handler(fn: (ctx: { data: unknown }) => unknown) {
          return (input?: { data: unknown }) => {
            const data = validate ? validate(input?.data) : input?.data;
            return fn({ data });
          };
        },
      };
      return chain;
    },
  };
});

// Wrapped, not replaced — `invoiceRoomGstPct`'s tests below never call
// `db()`, so they keep the real no-DATABASE_URL (null) behavior. Only the
// party-hall describe block below queues a fake connection, so a test can
// exercise `loadInvoiceParty`'s actual DB-row-mapping branch — the fixtures
// fallback branch never dropped `quoteBreakdown`/`advanceAmount`, so a test
// running against fixtures alone can't tell the fixed mapper from the broken
// one.
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, db: vi.fn(actual.db) };
});

const { invoiceRoomGstPct, issueInvoiceForPartyHallFn, getInvoiceFn } =
  await import("@/lib/invoices-data");
const { db } = await import("@/lib/db");

const BASE_INPUT: NewBookingInput = {
  guestName: "Purab Lamba",
  guestPhone: "+91 90000 33333",
  guestEmail: "purab@example.com",
  guestCity: "Greater Noida",
  roomType: "deluxe",
  roomNo: null,
  checkIn: "2026-08-25",
  checkOut: "2026-08-26",
  source: "direct",
  mealPlan: "EP",
};

// The setting has since moved to 5% live; these bookings were created back
// when it was still 12%, so `revenue.taxPct` holds 12 regardless of `LIVE_PCT`.
const LIVE_PCT = 5;

describe("invoiceRoomGstPct", () => {
  it("uses the frozen charged rate for a fully-paid booking, not the live setting", () => {
    const res = createBooking({ guests: [], bookings: [] }, BASE_INPUT, "2026-08-25");
    if (!res.ok) throw new Error(res.error);
    const paid: Booking = {
      ...res.booking,
      collection: { ...res.booking.collection, paidToHotel: res.booking.totalBill, pending: 0 },
    };

    expect(invoiceRoomGstPct(paid, LIVE_PCT)).toBe(GST_PCT);

    const invoice = buildRoomInvoice(
      "INV-TEST-PAID",
      "2026-08-26T00:00:00Z",
      paid,
      { id: paid.guestId, name: "Purab Lamba" } as Guest,
      invoiceRoomGstPct(paid, LIVE_PCT),
    );
    expect(invoice.gstRate).toBe(GST_PCT);
    expect(invoice.grandTotal).toBe(paid.totalBill);
    expect(invoice.amountPaid).toBe(paid.totalBill);
    expect(invoice.balanceDue).toBe(0);
  });

  it("uses the live setting for a still-pending booking", () => {
    const res = createBooking({ guests: [], bookings: [] }, BASE_INPUT, "2026-08-25");
    if (!res.ok) throw new Error(res.error);

    expect(res.booking.collection.pending).toBeGreaterThan(0);
    expect(invoiceRoomGstPct(res.booking, LIVE_PCT)).toBe(LIVE_PCT);
  });
});

describe("getInvoiceFn — party-hall invoice renders the frozen quote, not the live rate", () => {
  const ENQUIRY_ID = "PH-TEST-FROZEN-QUOTE";

  /** A quoted, advance-settled DB row with a frozen GST line and a frozen
   *  advance that deliberately does NOT match what `phAdvancePct` (30, the
   *  default) would derive live from `amount` (30% of 50000 = 15000) — so the
   *  assertions below can only pass if the frozen figures are actually the
   *  ones rendered, not a live recompute that happens to land nearby. */
  const partyHallRow = {
    id: ENQUIRY_ID,
    title: "Frozen-quote regression fixture",
    enquiryDate: "2026-09-01",
    slot: "evening",
    guests: 80,
    package: "Gold",
    addOns: [],
    status: "advance_paid",
    amount: 50000,
    quotedAt: new Date("2026-08-20T00:00:00Z"),
    quoteBreakdown: [
      { label: "Gold package", amount: 50000 },
      { label: "GST (18%)", amount: 9000 },
    ],
    advanceAmount: 20000,
    advancePct: 40,
    refundedAt: null,
    createdAt: new Date("2026-08-15T00:00:00Z"),
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    source: null,
  };

  /** A fake connection with just enough of the drizzle chain for
   *  `loadInvoiceParty`, `findInvoiceByRefId`/`findInvoiceByNo`, and
   *  `insertInvoice` — real table selection (so the four parallel queries in
   *  `loadInvoiceParty` each get the right rows), one in-memory `invoices`
   *  row since the test only ever issues one. `gstOverride` is a mutable
   *  holder rather than a fixed value so the same connection (and its one
   *  `invoices` row) can be reused across a live setting change mid-test. */
  function makeFakeConn(gstOverride: { price: number }) {
    const invoiceRows: (typeof schema.invoices.$inferSelect)[] = [];
    return {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.partyHallEnquiries) {
            return { orderBy: () => Promise.resolve([partyHallRow]) };
          }
          if (table === schema.addOnSettings) {
            return {
              orderBy: () =>
                Promise.resolve([
                  { id: "partyHallGstPct", label: "Party hall GST", price: gstOverride.price },
                ]),
            };
          }
          if (table === schema.invoices) {
            return { where: () => Promise.resolve(invoiceRows) };
          }
          return { orderBy: () => Promise.resolve([]) };
        },
      }),
      insert: () => ({
        values: (row: typeof schema.invoices.$inferSelect) => ({
          onConflictDoNothing: () => {
            invoiceRows.push(row);
            return Promise.resolve();
          },
        }),
      }),
    };
  }

  afterEach(() => {
    vi.mocked(db).mockReset();
  });

  it("fails before the fix: without it, GST and advance both track the live setting instead of the frozen quote", async () => {
    // Deliberately different from the frozen line's 18% — a live-fallback
    // read would show 5, not 18, so this alone would already fail pre-fix.
    const gstOverride = { price: 5 };
    vi.mocked(db).mockReturnValue(makeFakeConn(gstOverride) as unknown as ReturnType<typeof db>);

    const issued = await issueInvoiceForPartyHallFn({ data: { enquiryId: ENQUIRY_ID } });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    const before = await getInvoiceFn({ data: issued.invoiceNo });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    // Frozen quote: 18% GST, 20000 advance — this is the assertion that must
    // fail on the pre-fix mapper (which drops quoteBreakdown/advanceAmount
    // entirely, forcing a live recompute at whatever partyHallGstRateOverride
    // happens to be, and a live-derived advance of 15000, not 20000).
    expect(before.invoice.gstRate).toBe(18);
    expect(before.invoice.amountPaid).toBe(20000);

    // Change the live setting after issuing — the invoice must not move.
    gstOverride.price = 12;
    const after = await getInvoiceFn({ data: issued.invoiceNo });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.invoice.gstRate).toBe(18);
    expect(after.invoice.amountPaid).toBe(20000);
  });
});
