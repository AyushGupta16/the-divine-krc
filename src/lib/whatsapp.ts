// Pure WhatsApp quote helpers. No I/O, no framework — safe to unit test in isolation.

import { formatINR } from "@/lib/booking-math";
import type { PartyHallEnquiry } from "@/types/booking";

/** Party-hall slot → display label, matching `bookings.ts`'s `SLOT_LABEL`. */
const SLOT_LABEL: Record<PartyHallEnquiry["slot"], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  full_day: "Full day",
};

/**
 * India-only phone normaliser: any resolvable input becomes `+91XXXXXXXXXX`;
 * anything else is `null` rather than a guess. Five rules, applied in order:
 *  1. Strip everything but digits.
 *  2. A leading country code (`91` + 10 digits, 12 total) is dropped.
 *  3. A leading trunk `0` (`0` + 10 digits, 11 total) is dropped.
 *  4. Exactly 10 digits left over is accepted as-is (mobile or STD+landline).
 *  5. Anything else — too short, too long, wrong prefix — is unresolvable.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let national: string;
  if (digits.length === 12 && digits.startsWith("91")) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  } else {
    return null;
  }
  return `+91${national}`;
}

export type WhatsAppQuoteVariant = "first" | "resend";

/** "5 Sept 2026 (Full day), 90 guests:" — the parameterised event details
 *  clause, shared verbatim by both variants' opening sentence. */
function eventDetailsClause(e: Pick<PartyHallEnquiry, "date" | "slot" | "guests">): string {
  const dateLabel = new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${dateLabel} (${SLOT_LABEL[e.slot]}), ${e.guests} guests:`;
}

/**
 * The figures block — breakdown line items, total, and the advance line —
 * that a "first" and a "resend" message must never disagree on. Both
 * variants render this exact array; nothing else computes these numbers.
 * If the two ever drifted apart here, that's the precise failure three PRs
 * of `quoteBreakdown` snapshot work exist to prevent.
 *
 * Reads the frozen `quoteBreakdown` line items, never recomputes a rate.
 * Package/add-on pricing comes from those stored lines (not
 * `PARTY_HALL_PACKAGES` or the tier name) so the copy stays correct whether
 * the owner's pricing model is fixed tiers or a single customized per-plate
 * plan — see #78. Rows quoted before `quoteBreakdown` existed (`undefined`)
 * fall back to listing add-on names only, no per-item prices — a gap that
 * drains away as new quotes come in under `sendPartyHallQuote`.
 *
 * Quote-time only: `advancePct` is meant to be the rate in force right after
 * `sendPartyHallQuote`, when nothing is stored yet and `advancePct × total`
 * is the only figure available. If the enquiry has since moved past that —
 * `recordPartyHallAdvance` has already snapshotted `advanceAmount` — that
 * stored figure is the source of truth (same rule `withAdvance` follows) and
 * wins over recomputing from a live `advancePct`, or the WhatsApp message
 * and the admin card could quote two different numbers for the same event.
 * Omit `advancePct` (with no stored `advanceAmount`) to drop the line
 * entirely rather than print one that can't state a real figure.
 */
function quoteFigureLines(
  e: Pick<PartyHallEnquiry, "addOns" | "quoteBreakdown" | "amount" | "advanceAmount">,
  advancePct?: number,
): string[] {
  const lines: string[] = [];

  if (e.quoteBreakdown) {
    for (const line of e.quoteBreakdown) lines.push(`- ${line.label}: ${formatINR(line.amount)}`);
  } else {
    for (const addOn of e.addOns) lines.push(`- ${addOn}`);
  }

  lines.push("", `Total: ${formatINR(e.amount)}`);

  if (e.advanceAmount != null) {
    lines.push("", `Advance to confirm: ${formatINR(e.advanceAmount)}`);
  } else if (advancePct != null) {
    const advanceAmount = Math.round((e.amount * advancePct) / 100);
    lines.push("", `Advance to confirm: ${formatINR(advanceAmount)} (${advancePct}% of total)`);
  }

  return lines;
}

/**
 * The message a "Send quote" (variant `"first"`) or "Resend" (variant
 * `"resend"`) click composes. Only the opening sentence and the closing
 * nudge differ between the two — everything in between (the details
 * clause, breakdown items, total, advance line) comes from the same shared
 * helpers above, so the two variants can never quote different numbers for
 * the same enquiry.
 */
export function composeWhatsAppQuoteMessage(
  e: Pick<
    PartyHallEnquiry,
    | "title"
    | "date"
    | "slot"
    | "guests"
    | "contactName"
    | "addOns"
    | "quoteBreakdown"
    | "amount"
    | "advanceAmount"
  >,
  advancePct?: number,
  variant: WhatsAppQuoteVariant = "first",
): string {
  const greeting = e.contactName ? `Hi ${e.contactName},` : "Hi,";
  const details = eventDetailsClause(e);
  const opening =
    variant === "first"
      ? `Thank you for your enquiry. Here are the details for ${details}`
      : `Following up on your enquiry — here are the details again for ${details}`;
  const closing =
    variant === "first"
      ? "This quote is valid for 7 days."
      : "This quote is valid for 7 days from when it was sent.";

  return [greeting, opening, ...quoteFigureLines(e, advancePct), "", closing].join("\n");
}

/** wa.me deep link for a normalised `+91XXXXXXXXXX` number and message body. */
export function buildWhatsAppQuoteLink(normalizedPhone: string, message: string): string {
  const digits = normalizedPhone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
