import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolvePaymentMetadata, verifyRazorpaySignature } from "@/lib/razorpay";

describe("verifyRazorpaySignature", () => {
  const KEY_SECRET = "test_secret_key";

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  function sign(orderId: string, paymentId: string): string {
    return createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  }

  it("accepts a signature Razorpay's own scheme would produce", () => {
    const signature = sign("order_abc", "pay_xyz");
    expect(verifyRazorpaySignature("order_abc", "pay_xyz", signature)).toBe(true);
  });

  it("rejects a signature for the wrong order/payment pair", () => {
    const signature = sign("order_abc", "pay_xyz");
    expect(verifyRazorpaySignature("order_other", "pay_xyz", signature)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    expect(verifyRazorpaySignature("order_abc", "pay_xyz", "deadbeef")).toBe(false);
  });
});

describe("resolvePaymentMetadata", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret_key";
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    global.fetch = realFetch;
  });

  function mockFetchOk(method: string) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ method }),
    }) as unknown as typeof fetch;
  }

  it("maps netbanking to net_banking", async () => {
    mockFetchOk("netbanking");
    const { method } = await resolvePaymentMetadata("pay_1");
    expect(method).toBe("net_banking");
  });

  it("maps upi and card straight through", async () => {
    mockFetchOk("upi");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("upi");
    mockFetchOk("card");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("card");
  });

  it("maps wallet and paylater straight through", async () => {
    mockFetchOk("wallet");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("wallet");
    mockFetchOk("paylater");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("paylater");
  });

  it("falls back to 'online' for an unmapped instrument (emi, bank_transfer, anything else)", async () => {
    mockFetchOk("emi");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("online");
    mockFetchOk("cardless_emi");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("online");
    mockFetchOk("bank_transfer");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("online");
    mockFetchOk("something_new_razorpay_added");
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("online");
  });

  it("falls back to 'online' + still returns a paidAt when the Fetch throws (network/timeout)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("timeout")) as unknown as typeof fetch;
    const { method, paidAt } = await resolvePaymentMetadata("pay_1");
    expect(method).toBe("online");
    expect(paidAt).toEqual(expect.any(String));
    expect(() => new Date(paidAt).toISOString()).not.toThrow();
  });

  it("falls back to 'online' when the Fetch returns a non-2xx", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "not found",
    }) as unknown as typeof fetch;
    expect((await resolvePaymentMetadata("pay_1")).method).toBe("online");
  });
});
