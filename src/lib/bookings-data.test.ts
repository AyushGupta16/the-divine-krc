import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtures } from "@/lib/__fixtures__/bookings";

// createServerFn's real chain routes through an AsyncLocalStorage-backed
// Start request context that only exists inside the server runtime, not
// under vitest. Replace it with a minimal stand-in that just runs the
// validator then the handler directly — same shape the real one exposes to
// callers, none of the request-context plumbing.
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
          return (input: { data: unknown }) => {
            const data = validate ? validate(input.data) : input.data;
            return fn({ data });
          };
        },
      };
      return chain;
    },
  };
});

vi.mock("@/lib/razorpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/razorpay")>();
  return {
    ...actual,
    verifyRazorpaySignature: vi.fn(() => true),
    resolvePaymentMetadata: vi.fn(),
  };
});

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSessionMember: vi.fn(),
  };
});

const { verifyRazorpayPaymentFn, recordCashPaymentFn } = await import("@/lib/bookings-data");
const { resolvePaymentMetadata } = await import("@/lib/razorpay");
const { getSessionMember } = await import("@/lib/auth");

const PENDING_BOOKING_ID = "KRC-20260715-003";

describe("verifyRazorpayPaymentFn", () => {
  const original = { ...fixtures.bookings.find((b) => b.id === PENDING_BOOKING_ID)! };

  afterEach(() => {
    const i = fixtures.bookings.findIndex((b) => b.id === PENDING_BOOKING_ID);
    fixtures.bookings[i] = { ...original };
    vi.mocked(resolvePaymentMetadata).mockReset();
  });

  it("settles the booking even when the metadata Fetch fails, in one write", async () => {
    // Simulates resolvePaymentMetadata's own fallback (it never throws) — the
    // Fetch failed, so it already downgraded to "online"/now before this fn
    // ever sees it.
    vi.mocked(resolvePaymentMetadata).mockResolvedValue({
      method: "online",
      paidAt: "2026-08-14T10:00:00.000Z",
    });

    const res = await verifyRazorpayPaymentFn({
      data: {
        bookingIds: [PENDING_BOOKING_ID],
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "sig_1",
      },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const settled = res.bookings[0];
    // The payment settlement — status + collection — went through regardless
    // of the Fetch failure. This is the load-bearing guarantee.
    expect(settled.status).toBe("confirmed");
    expect(settled.collection.pending).toBe(0);
    expect(settled.collection.paidToHotel).toBe(settled.totalBill);
    // The fallback metadata landed in the same write.
    expect(settled.paymentMethod).toBe("online");
    expect(settled.paidAt).toBe("2026-08-14T10:00:00.000Z");
  });

  it("settles the booking with the resolved instrument when the Fetch succeeds", async () => {
    vi.mocked(resolvePaymentMetadata).mockResolvedValue({
      method: "upi",
      paidAt: "2026-08-14T10:00:00.000Z",
    });

    const res = await verifyRazorpayPaymentFn({
      data: {
        bookingIds: [PENDING_BOOKING_ID],
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "sig_1",
      },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.bookings[0].paymentMethod).toBe("upi");
  });
});

describe("recordCashPaymentFn", () => {
  const original = { ...fixtures.bookings.find((b) => b.id === PENDING_BOOKING_ID)! };
  const WRITER = {
    email: "frontdesk@thedivinekrc.in",
    name: "Front Desk",
    role: "Front desk" as const,
  };

  afterEach(() => {
    const i = fixtures.bookings.findIndex((b) => b.id === PENDING_BOOKING_ID);
    fixtures.bookings[i] = { ...original };
    vi.mocked(getSessionMember).mockReset();
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(null);

    const res = await recordCashPaymentFn({ data: { bookingId: PENDING_BOOKING_ID, amount: 100 } });

    expect(res.ok).toBe(false);
  });

  it("leaves a residual balance on a partial payment", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await recordCashPaymentFn({
      data: { bookingId: PENDING_BOOKING_ID, amount: 1000 },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.collection.pending).toBe(original.collection.pending - 1000);
    expect(res.booking.collection.paidToHotel).toBe(original.collection.paidToHotel + 1000);
  });

  it("zeroes the pending balance on a full payment", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await recordCashPaymentFn({
      data: { bookingId: PENDING_BOOKING_ID, amount: original.collection.pending },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.collection.pending).toBe(0);
    expect(res.booking.collection.paidToHotel).toBe(
      original.collection.paidToHotel + original.collection.pending,
    );
  });

  it("rejects an amount greater than the outstanding balance", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await recordCashPaymentFn({
      data: { bookingId: PENDING_BOOKING_ID, amount: original.collection.pending + 1 },
    });

    expect(res.ok).toBe(false);
  });

  it("rejects a zero amount", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await recordCashPaymentFn({ data: { bookingId: PENDING_BOOKING_ID, amount: 0 } });

    expect(res.ok).toBe(false);
  });

  it("rejects a negative amount", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await recordCashPaymentFn({ data: { bookingId: PENDING_BOOKING_ID, amount: -50 } });

    expect(res.ok).toBe(false);
  });

  it("sets paymentMethod to cash when it was unset", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);
    expect(original.paymentMethod).toBeUndefined();

    const res = await recordCashPaymentFn({
      data: { bookingId: PENDING_BOOKING_ID, amount: 500 },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.paymentMethod).toBe("cash");
    expect(res.booking.recordedBy).toBe(WRITER.email);
  });

  it("leaves paymentMethod untouched when a prior advance already set it", async () => {
    const i = fixtures.bookings.findIndex((b) => b.id === PENDING_BOOKING_ID);
    fixtures.bookings[i] = { ...original, paymentMethod: "online" };
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await recordCashPaymentFn({
      data: { bookingId: PENDING_BOOKING_ID, amount: 500 },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.paymentMethod).toBe("online");
  });
});
