// Razorpay's REST + signature boundary. Server-only, same convention as
// `password.ts`: plain functions built on Node core (`node:crypto` for the
// HMAC) plus `fetch` for the Orders API, imported only from inside
// `bookings-data.ts` handler bodies so nothing here reaches `dist/client`.
//
// Two calls out of Razorpay, in order: `createOrder` opens a Checkout
// session for an amount this server computed (never a client-supplied one —
// trusting the client's total would let a guest name their own price);
// `verifySignature` is the only thing standing between "the browser says it
// paid" and a booking actually flipping to `confirmed`.

import { createHmac, timingSafeEqual } from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set.");
  }
  return { keyId, keySecret };
}

/** The key id is not secret — Checkout needs it client-side, so callers may return it. */
export function razorpayKeyId(): string {
  return credentials().keyId;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/**
 * Opens an order for `amountRupees`, converting to paise at this one edge —
 * everywhere else in the app, including the caller, stays in whole rupees.
 */
export async function createRazorpayOrder(
  amountRupees: number,
  receipt: string,
): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials();
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: Math.round(amountRupees * 100),
      currency: "INR",
      receipt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order creation failed: ${res.status} ${await res.text()}`);
  }
  const order = (await res.json()) as { id: string; amount: number; currency: string };
  return { id: order.id, amount: order.amount, currency: order.currency };
}

/**
 * Checkout's own scheme: `HMAC-SHA256(order_id + "|" + payment_id, key_secret)`
 * must equal the signature the browser hands back. Constant-time compare —
 * this is the one check a bad actor has every incentive to brute-force.
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
