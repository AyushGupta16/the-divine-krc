import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyRazorpaySignature } from "@/lib/razorpay";

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
