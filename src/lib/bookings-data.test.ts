import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const {
  verifyRazorpayPaymentFn,
  recordCashPaymentFn,
  getOpenBalanceDirectBookingsFn,
  updateBookingStatusFn,
  setBookingPaymentStatusFn,
} = await import("@/lib/bookings-data");
const { resolvePaymentMetadata } = await import("@/lib/razorpay");
const { getSessionMember } = await import("@/lib/auth");

const PENDING_BOOKING_ID = "KRC-20260715-003";
const CONFIRMED_WITH_BALANCE_ID = "KRC-20260714-007";

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

  it("zeroes the pending balance on a full payment and flips pending_payment to confirmed", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);
    expect(original.status).toBe("pending_payment");

    const res = await recordCashPaymentFn({
      data: { bookingId: PENDING_BOOKING_ID, amount: original.collection.pending },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.collection.pending).toBe(0);
    expect(res.booking.collection.paidToHotel).toBe(
      original.collection.paidToHotel + original.collection.pending,
    );
    expect(res.booking.status).toBe("confirmed");
  });

  it("leaves status at pending_payment on a partial payment", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);
    expect(original.status).toBe("pending_payment");

    const res = await recordCashPaymentFn({
      data: { bookingId: PENDING_BOOKING_ID, amount: 1000 },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.collection.pending).toBeGreaterThan(0);
    expect(res.booking.status).toBe("pending_payment");
  });

  it("leaves status untouched on an already-confirmed booking, even on full payment", async () => {
    const confirmed = fixtures.bookings.find((b) => b.id === CONFIRMED_WITH_BALANCE_ID)!;
    const confirmedOriginal = { ...confirmed };
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);
    expect(confirmedOriginal.status).toBe("confirmed");

    const res = await recordCashPaymentFn({
      data: { bookingId: CONFIRMED_WITH_BALANCE_ID, amount: confirmedOriginal.collection.pending },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.collection.pending).toBe(0);
    expect(res.booking.status).toBe("confirmed");

    const j = fixtures.bookings.findIndex((b) => b.id === CONFIRMED_WITH_BALANCE_ID);
    fixtures.bookings[j] = confirmedOriginal;
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

describe("getOpenBalanceDirectBookingsFn", () => {
  const WRITER = {
    email: "frontdesk@thedivinekrc.in",
    name: "Front Desk",
    role: "Front desk" as const,
  };

  afterEach(() => {
    vi.mocked(getSessionMember).mockReset();
  });

  it("rejects an unauthorized (unauthenticated) caller with an empty list", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(null);

    const res = await getOpenBalanceDirectBookingsFn();

    expect(res).toEqual([]);
  });

  it("returns only direct-source rows with a pending balance, in the right shape", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await getOpenBalanceDirectBookingsFn();

    expect(res.length).toBeGreaterThan(0);
    for (const row of res) {
      expect(Object.keys(row).sort()).toEqual(["bookingId", "guestName", "pending"]);
      expect(row.pending).toBeGreaterThan(0);
    }
    const ids = res.map((r) => r.bookingId);
    expect(ids).toContain(PENDING_BOOKING_ID);
    expect(ids).toContain(CONFIRMED_WITH_BALANCE_ID);
  });

  it("excludes zero-pending rows", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await getOpenBalanceDirectBookingsFn();

    // KRC-20260715-002 is a settled/OTA row with pending 0 in the fixtures —
    // it must never surface here regardless of source.
    expect(res.map((r) => r.bookingId)).not.toContain("KRC-20260715-002");
  });

  it("excludes an OTA-source row even with a pending balance", async () => {
    const i = fixtures.bookings.findIndex((b) => b.id === CONFIRMED_WITH_BALANCE_ID);
    const original = { ...fixtures.bookings[i] };
    fixtures.bookings[i] = { ...original, source: "booking_com" };
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await getOpenBalanceDirectBookingsFn();

    expect(res.map((r) => r.bookingId)).not.toContain(CONFIRMED_WITH_BALANCE_ID);

    fixtures.bookings[i] = original;
  });
});

describe("status history", () => {
  const WRITER = {
    email: "frontdesk@thedivinekrc.in",
    name: "Front Desk",
    role: "Front desk" as const,
  };

  function bookingsLength() {
    return fixtures.statusHistory.length;
  }

  beforeEach(() => {
    fixtures.statusHistory.length = 0;
  });

  afterEach(() => {
    vi.mocked(getSessionMember).mockReset();
    fixtures.statusHistory.length = 0;
    const i = fixtures.bookings.findIndex((b) => b.id === CONFIRMED_WITH_BALANCE_ID);
    if (fixtures.bookings[i].status !== "confirmed") {
      fixtures.bookings[i] = { ...fixtures.bookings[i], status: "confirmed" };
    }
  });

  it("updateBookingStatusFn: a real transition emits exactly one history row with the right from/to/changedBy", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await updateBookingStatusFn({
      data: { id: CONFIRMED_WITH_BALANCE_ID, status: "cancelled" },
    });

    expect(res.ok).toBe(true);
    expect(bookingsLength()).toBe(1);
    expect(fixtures.statusHistory[0]).toMatchObject({
      bookingId: CONFIRMED_WITH_BALANCE_ID,
      fromStatus: "confirmed",
      toStatus: "cancelled",
      changedBy: WRITER.email,
    });
  });

  it("updateBookingStatusFn: a no-op status write (unchanged status) emits zero history rows", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);
    const before = fixtures.bookings.find((b) => b.id === CONFIRMED_WITH_BALANCE_ID)!.status;
    expect(before).toBe("confirmed");

    const res = await updateBookingStatusFn({
      data: { id: CONFIRMED_WITH_BALANCE_ID, status: "confirmed" },
    });

    expect(res.ok).toBe(true);
    expect(bookingsLength()).toBe(0);
  });

  it("setBookingPaymentStatusFn: marking an already-confirmed booking paid is a no-op and logs nothing", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);
    const before = fixtures.bookings.find((b) => b.id === CONFIRMED_WITH_BALANCE_ID)!.status;
    expect(before).toBe("confirmed");

    const res = await setBookingPaymentStatusFn({
      data: { id: CONFIRMED_WITH_BALANCE_ID, status: "confirmed" },
    });

    expect(res.ok).toBe(true);
    expect(bookingsLength()).toBe(0);
  });

  it("setBookingPaymentStatusFn: a real pending_payment -> confirmed flip logs one row attributed to the actor", async () => {
    const i = fixtures.bookings.findIndex((b) => b.id === PENDING_BOOKING_ID);
    const original = { ...fixtures.bookings[i] };
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);

    const res = await setBookingPaymentStatusFn({
      data: { id: PENDING_BOOKING_ID, status: "confirmed" },
    });

    expect(res.ok).toBe(true);
    expect(bookingsLength()).toBe(1);
    expect(fixtures.statusHistory[0]).toMatchObject({
      bookingId: PENDING_BOOKING_ID,
      fromStatus: "pending_payment",
      toStatus: "confirmed",
      changedBy: WRITER.email,
    });

    fixtures.bookings[i] = original;
  });

  it("a failed history insert does not fail or roll back the status update", async () => {
    vi.mocked(getSessionMember).mockResolvedValue(WRITER);
    const pushSpy = vi.spyOn(fixtures.statusHistory, "push").mockImplementation(() => {
      throw new Error("simulated audit-log failure");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await updateBookingStatusFn({
      data: { id: CONFIRMED_WITH_BALANCE_ID, status: "cancelled" },
    });

    expect(res.ok).toBe(true);
    expect(fixtures.bookings.find((b) => b.id === CONFIRMED_WITH_BALANCE_ID)!.status).toBe(
      "cancelled",
    );
    expect(errorSpy).toHaveBeenCalled();

    pushSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("requireBookingWriter's member flows through to both status-writing paths' changedBy", async () => {
    const OTHER = {
      email: "owner@thedivinekrc.in",
      name: "Owner",
      role: "Owner" as const,
    };
    vi.mocked(getSessionMember).mockResolvedValue(OTHER);

    await updateBookingStatusFn({ data: { id: CONFIRMED_WITH_BALANCE_ID, status: "cancelled" } });

    expect(fixtures.statusHistory[0].changedBy).toBe(OTHER.email);
  });
});
