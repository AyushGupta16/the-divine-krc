import { describe, expect, it } from "vitest";
import { buildWhatsAppQuoteLink, composeWhatsAppQuoteMessage, normalizePhone } from "./whatsapp";

describe("normalizePhone", () => {
  it("normalises a bare 10-digit mobile with a space", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
  });

  it("normalises a +91-prefixed number with a dash", () => {
    expect(normalizePhone("+91-9876543210")).toBe("+919876543210");
  });

  it("normalises a trunk-0-prefixed number", () => {
    expect(normalizePhone("09876543210")).toBe("+919876543210");
  });

  it("normalises a landline with an STD code in parens", () => {
    expect(normalizePhone("(0120) 4567890")).toBe("+911204567890");
  });

  it("returns null for an unresolvable number", () => {
    expect(normalizePhone("+1-415-555-0132")).toBeNull();
  });
});

describe("composeWhatsAppQuoteMessage", () => {
  it("renders breakdown lines, total, advance line, and the fixed closing copy", () => {
    const msg = composeWhatsAppQuoteMessage(
      {
        title: "Reception — Priya & Arjun",
        date: "2026-08-22",
        slot: "evening",
        guests: 140,
        contactName: "Priya",
        addOns: ["Catering", "Decor"],
        quoteBreakdown: [
          { label: "Platinum package", amount: 60000 },
          { label: "Catering", amount: 63000 },
          { label: "Decor", amount: 15000 },
        ],
        amount: 138000,
      },
      25,
    );
    expect(msg).toContain("Hi Priya,");
    expect(msg).toContain(
      "Thank you for your enquiry. Here are the details for 22 Aug 2026 (Evening), 140 guests:",
    );
    expect(msg).not.toContain("Here's your quote:");
    expect(msg).toContain("- Platinum package: ₹60,000");
    expect(msg).toContain("Total: ₹1,38,000");
    expect(msg).toContain("Advance to confirm: ₹34,500 (25% of total)");
    expect(msg).toContain("This quote is valid for 7 days.");
    expect(msg).not.toContain("Regards");
  });

  it("falls back to add-on names only when quoteBreakdown is undefined", () => {
    const msg = composeWhatsAppQuoteMessage({
      title: "Corporate AGM — Vector Systems",
      date: "2026-09-26",
      slot: "full_day",
      guests: 100,
      contactName: undefined,
      addOns: ["Projector", "Lunch Buffet"],
      quoteBreakdown: undefined,
      amount: 95000,
    });
    expect(msg).toContain("- Projector");
    expect(msg).toContain("- Lunch Buffet");
    expect(msg).not.toMatch(/- Projector:/);
    expect(msg).toContain("Total: ₹95,000");
  });

  it("renders a bare 'Hi,' greeting with no stray space or comma when contactName is missing", () => {
    const msg = composeWhatsAppQuoteMessage({
      title: "Naming ceremony — Pillai family",
      date: "2026-08-16",
      slot: "morning",
      guests: 40,
      contactName: undefined,
      addOns: ["Decor"],
      quoteBreakdown: undefined,
      amount: 36000,
    });
    expect(msg.split("\n")[0]).toBe("Hi,");
  });

  it("prefers a stored advanceAmount over recomputing from advancePct", () => {
    const msg = composeWhatsAppQuoteMessage(
      {
        title: "Reception — Priya & Arjun",
        date: "2026-08-22",
        slot: "evening",
        guests: 140,
        contactName: "Priya",
        addOns: ["Catering", "Decor"],
        quoteBreakdown: [{ label: "Platinum package", amount: 138000 }],
        amount: 138000,
        advanceAmount: 40000,
      },
      25,
    );
    expect(msg).toContain("Advance to confirm: ₹40,000");
    expect(msg).not.toContain("₹34,500");
    expect(msg).not.toContain("% of total");
  });

  it("omits the advance line entirely when advancePct is not supplied", () => {
    const msg = composeWhatsAppQuoteMessage({
      title: "Birthday — Meera Krishnan",
      date: "2026-08-12",
      slot: "afternoon",
      guests: 55,
      contactName: "Meera",
      addOns: ["Decor"],
      quoteBreakdown: [{ label: "Silver package", amount: 88000 }],
      amount: 88000,
    });
    expect(msg).not.toContain("Advance to confirm");
  });
});

describe("buildWhatsAppQuoteLink", () => {
  it("builds a wa.me link with URL-encoded newlines and rupee sign", () => {
    const link = buildWhatsAppQuoteLink("+919876543210", "Hi,\nTotal: ₹1,000");
    expect(link).toBe("https://wa.me/919876543210?text=Hi%2C%0ATotal%3A%20%E2%82%B91%2C000");
  });
});
