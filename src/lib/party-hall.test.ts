import { describe, expect, it } from "vitest";

import { getPartyHallPageData, PARTY_HALL_ADVANCE_PCT, partyHallAdvance } from "@/lib/bookings";
import type { PartyHallCalendarCell, PartyHallStatKey, PartyHallStatus } from "@/types/booking";

const statValue = (stats: { key: PartyHallStatKey; value: string }[], key: PartyHallStatKey) =>
  stats.find((s) => s.key === key)!.value;

const bookedDays = (cells: PartyHallCalendarCell[]) =>
  cells.filter((c) => c.kind === "day" && c.booked).map((c) => (c.kind === "day" ? c.day : 0));

describe("partyHallAdvance", () => {
  it("takes 25% of the total to hold a date", () => {
    expect(PARTY_HALL_ADVANCE_PCT).toBe(25);
    expect(partyHallAdvance(88000)).toBe(22000);
    expect(partyHallAdvance(240000)).toBe(60000);
  });

  it("rounds to the nearest rupee", () => {
    expect(partyHallAdvance(1001)).toBe(250);
  });
});

describe("getPartyHallPageData", () => {
  it("derives every advance from the total and the pipeline state", async () => {
    const { events } = await getPartyHallPageData();

    for (const { enquiry } of events) {
      const expected =
        enquiry.status === "completed"
          ? enquiry.amount
          : enquiry.status === "advance_paid" || enquiry.status === "confirmed"
            ? partyHallAdvance(enquiry.amount)
            : 0;
      expect(enquiry.advancePaid).toBe(expected);
    }
  });

  it("stat strip agrees with the list it sits above", async () => {
    const { stats, events, pills } = await getPartyHallPageData();

    const newCount = events.filter((e) => e.enquiry.status === "enquiry").length;
    expect(statValue(stats, "newEnquiries")).toBe(String(newCount));
    expect(pills.find((p) => p.key === "new")!.count).toBe(newCount);
    expect(pills.find((p) => p.key === "all")!.count).toBe(events.length);
  });

  it("counts advance collected across upcoming events only", async () => {
    const { stats, events } = await getPartyHallPageData();

    const held = events
      .filter((e) => e.enquiry.status !== "completed" && e.enquiry.status !== "cancelled")
      .reduce((sum, e) => sum + e.enquiry.advancePaid, 0);

    // A settled event's takings are booked revenue, not an advance being held.
    expect(held).toBeGreaterThan(0);
    expect(statValue(stats, "advanceCollected")).toBe("₹1.4L");
  });

  it("names the soonest event still ahead as the next one", async () => {
    const { stats } = await getPartyHallPageData();
    expect(statValue(stats, "nextEvent")).toBe("30 Jul · Evening");
  });

  it("orders cards up the pipeline, new first and completed last", async () => {
    const { events } = await getPartyHallPageData();
    const rank: PartyHallStatus[] = [
      "enquiry",
      "quote_sent",
      "advance_paid",
      "confirmed",
      "completed",
      "cancelled",
    ];

    const ranks = events.map((e) => rank.indexOf(e.enquiry.status));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(events[0].enquiry.status).toBe("enquiry");
  });

  it("gives a new enquiry the primary quote CTA and everything else a quiet one", async () => {
    const { events } = await getPartyHallPageData();

    for (const e of events) {
      if (e.enquiry.status === "enquiry") {
        expect(e.cta).toBe("Send quote");
        expect(e.ctaPrimary).toBe(true);
      } else {
        expect(e.ctaPrimary).toBe(false);
      }
    }
    expect(events.find((e) => e.enquiry.status === "completed")!.cta).toBe("Invoice");
    expect(events.find((e) => e.enquiry.status === "confirmed")!.cta).toBe("View details");
  });

  it("shows a dash rather than a false zero before an enquiry is quoted", async () => {
    const { events } = await getPartyHallPageData();
    const unquoted = events.filter((e) => e.enquiry.amount === 0);

    expect(unquoted.length).toBeGreaterThan(0);
    for (const e of unquoted) {
      expect(e.amount).toBe("₹—");
      expect(e.amountLabel).toBe("Est. quote");
    }
  });

  it("tags each card with its package tier and add-ons", async () => {
    const { events } = await getPartyHallPageData();
    const reception = events.find((e) => e.enquiry.title.includes("Priya & Arjun"))!;

    expect(reception.tags).toEqual(["Platinum", "Catering", "Decor"]);
    expect(reception.day).toBe("22");
    expect(reception.mon).toBe("Aug");
    expect(reception.meta).toBe("Evening slot · 140 guests · awaiting quote");
  });

  it("spells the advance into the meta line once it is paid", async () => {
    const { events } = await getPartyHallPageData();
    const paid = events.find((e) => e.enquiry.status === "advance_paid")!;
    expect(paid.meta).toContain("advance ₹22k paid");
  });

  it("marks the rail's booked days from the live enquiries for that month", async () => {
    const august = await getPartyHallPageData(2026, 8);
    expect(august.calendar.monthLabel).toBe("August 2026");
    expect(bookedDays(august.calendar.cells)).toEqual([8, 12, 16, 22, 29]);

    // Aug 2026 opens on a Saturday, so six blanks precede the 1st.
    const leading = august.calendar.cells.findIndex((c) => c.kind === "day");
    expect(leading).toBe(6);
    expect(august.calendar.cells.length % 7).toBe(0);
  });

  it("leaves a month with no events unbooked", async () => {
    const { calendar } = await getPartyHallPageData(2026, 12);
    expect(bookedDays(calendar.cells)).toEqual([]);
  });

  it("states the 25% advance in the package reference", async () => {
    const { addOnsLine, packages } = await getPartyHallPageData();
    expect(addOnsLine).toContain("25% advance to confirm");
    expect(packages.map((p) => p.name)).toEqual(["Silver", "Gold", "Platinum"]);
  });
});
