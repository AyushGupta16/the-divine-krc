import { describe, expect, it } from "vitest";

import {
  cancelPartyHallEvent,
  computePartyHallQuote,
  confirmPartyHallEvent,
  declinePartyHallEnquiry,
  getPartyHallPageData,
  PARTY_HALL_ADVANCE_PCT,
  PARTY_HALL_RATE_DEFAULTS,
  partyHallAdvance,
  recordPartyHallAdvance,
  reopenPartyHallEnquiry,
  resolvePartyHallRates,
  sendPartyHallQuote,
  withAdvance,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import type {
  PartyHallCalendarCell,
  PartyHallEnquiry,
  PartyHallStatKey,
  PartyHallStatus,
} from "@/types/booking";

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
    const { events } = await getPartyHallPageData(fixtures);

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
    const { stats, events, pills } = await getPartyHallPageData(fixtures);

    const newCount = events.filter((e) => e.enquiry.status === "enquiry").length;
    expect(statValue(stats, "newEnquiries")).toBe(String(newCount));
    expect(pills.find((p) => p.key === "new")!.count).toBe(newCount);
    expect(pills.find((p) => p.key === "all")!.count).toBe(events.length);
  });

  it("counts advance collected across upcoming events only", async () => {
    const { stats, events } = await getPartyHallPageData(fixtures);

    const held = events
      .filter((e) => e.enquiry.status !== "completed" && e.enquiry.status !== "cancelled")
      .reduce((sum, e) => sum + e.enquiry.advancePaid, 0);

    // A settled event's takings are booked revenue, not an advance being held.
    expect(held).toBeGreaterThan(0);
    expect(statValue(stats, "advanceCollected")).toBe("₹1.4L");
  });

  it("names the soonest event still ahead as the next one", async () => {
    const { stats } = await getPartyHallPageData(fixtures);
    expect(statValue(stats, "nextEvent")).toBe("30 Jul · Evening");
  });

  it("orders cards up the pipeline, new first and completed last", async () => {
    const { events } = await getPartyHallPageData(fixtures);
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

  it("gives every unresolved pipeline stage its own primary CTA", async () => {
    const { events } = await getPartyHallPageData(fixtures);
    const primaryCta: Partial<Record<PartyHallStatus, string>> = {
      enquiry: "Send quote",
      quote_sent: "Record advance",
      advance_paid: "Confirm",
    };

    for (const e of events) {
      const expected = primaryCta[e.enquiry.status];
      if (expected) {
        expect(e.cta).toBe(expected);
        expect(e.ctaPrimary).toBe(true);
      } else {
        expect(e.ctaPrimary).toBe(false);
      }
    }
    expect(events.find((e) => e.enquiry.status === "completed")!.cta).toBe("Invoice");
    expect(events.find((e) => e.enquiry.status === "confirmed")!.cta).toBe("View details");
  });

  it("only a quoted-but-undecided enquiry can be declined", async () => {
    const { events } = await getPartyHallPageData(fixtures);
    for (const e of events) {
      const expected = e.enquiry.status === "enquiry" || e.enquiry.status === "quote_sent";
      expect(e.canDecline).toBe(expected);
    }
  });

  it("shows a dash rather than a false zero before an enquiry is quoted", async () => {
    const { events } = await getPartyHallPageData(fixtures);
    const unquoted = events.filter((e) => e.enquiry.amount === 0);

    expect(unquoted.length).toBeGreaterThan(0);
    for (const e of unquoted) {
      expect(e.amount).toBe("₹—");
      expect(e.amountLabel).toBe("Est. quote");
    }
  });

  it("tags each card with its package tier and add-ons", async () => {
    const { events } = await getPartyHallPageData(fixtures);
    const reception = events.find((e) => e.enquiry.title.includes("Priya & Arjun"))!;

    expect(reception.tags).toEqual(["Platinum", "Catering", "Decor"]);
    expect(reception.day).toBe("22");
    expect(reception.mon).toBe("Aug");
    expect(reception.meta).toBe("Evening slot · 140 guests · awaiting quote");
  });

  it("spells the advance into the meta line once it is paid", async () => {
    const { events } = await getPartyHallPageData(fixtures);
    const paid = events.find((e) => e.enquiry.status === "advance_paid")!;
    expect(paid.meta).toContain("advance ₹22k paid");
  });

  it("marks the rail's booked days from the live enquiries for that month", async () => {
    const august = await getPartyHallPageData(fixtures, 2026, 8);
    expect(august.calendar.monthLabel).toBe("August 2026");
    expect(bookedDays(august.calendar.cells)).toEqual([8, 12, 16, 22, 29]);

    // Aug 2026 opens on a Saturday, so six blanks precede the 1st.
    const leading = august.calendar.cells.findIndex((c) => c.kind === "day");
    expect(leading).toBe(6);
    expect(august.calendar.cells.length % 7).toBe(0);
  });

  it("leaves a month with no events unbooked", async () => {
    const { calendar } = await getPartyHallPageData(fixtures, 2026, 12);
    expect(bookedDays(calendar.cells)).toEqual([]);
  });

  it("drops cancelled events from confirmed·upcoming and the calendar's booked days", async () => {
    const custom = {
      ...fixtures,
      partyHall: [
        enquiry({ id: "PH-CANCELLED", status: "cancelled", date: "2026-08-15", amount: 100000 }),
        enquiry({ id: "PH-CONFIRMED", status: "confirmed", date: "2026-08-16", amount: 100000 }),
      ],
    };
    const { stats, calendar } = await getPartyHallPageData(custom, 2026, 8);
    expect(statValue(stats, "confirmed")).toBe("1");
    expect(bookedDays(calendar.cells)).toEqual([16]);
  });

  it("degrades the quoted-on label to no date for a pre-migration row with no quotedAt", async () => {
    const custom = {
      ...fixtures,
      partyHall: [enquiry({ id: "PH-NO-DATE", status: "quote_sent", amount: 50000 })],
    };
    const { events } = await getPartyHallPageData(custom, 2026, 8);
    const item = events.find((e) => e.enquiry.id === "PH-NO-DATE")!;
    expect(item.amountLabel).toBe("Quoted");
  });

  it("shows the quote date in the label once quotedAt is on record", async () => {
    const custom = {
      ...fixtures,
      partyHall: [
        enquiry({
          id: "PH-DATED",
          status: "quote_sent",
          amount: 50000,
          quotedAt: "2026-08-04T10:00:00.000Z",
        }),
      ],
    };
    const { events } = await getPartyHallPageData(custom, 2026, 8);
    const item = events.find((e) => e.enquiry.id === "PH-DATED")!;
    expect(item.amountLabel).toBe("Quoted on 4 Aug 2026");
  });

  it("states the 25% advance in the package reference", async () => {
    const { addOnsLine, packages } = await getPartyHallPageData(fixtures);
    expect(addOnsLine).toContain("25% advance to confirm");
    expect(packages.map((p) => p.name)).toEqual(["Silver", "Gold", "Platinum"]);
  });
});

function enquiry(patch: Partial<PartyHallEnquiry>): PartyHallEnquiry {
  return {
    id: "PH-TEST-001",
    title: "Test event",
    date: "2027-01-01",
    slot: "evening",
    guests: 100,
    package: "Gold",
    addOns: ["Catering", "Decor"],
    status: "enquiry",
    amount: 0,
    advancePaid: 0,
    ...patch,
  };
}

describe("computePartyHallQuote", () => {
  it("adds the package base to flat and per-guest add-ons at the resolved rates", () => {
    const rates = resolvePartyHallRates({
      phBaseGold: 60000,
      phDecor: 5000,
      phCatering: 450,
    });
    // 60000 base + 5000 flat decor + 100 guests × ₹450 catering.
    expect(computePartyHallQuote(enquiry({}), rates)).toBe(60000 + 5000 + 100 * 450);
  });

  it("falls back to the placeholder defaults when nothing is overridden", () => {
    const rates = resolvePartyHallRates();
    expect(rates).toEqual(PARTY_HALL_RATE_DEFAULTS);
  });
});

describe("the Party Hall pipeline actions", () => {
  it("quotes a new enquiry and moves it to quote_sent", () => {
    const state = { partyHall: [enquiry({})] };
    const rates = resolvePartyHallRates({ phBaseGold: 60000, phDecor: 5000, phCatering: 450 });
    const res = sendPartyHallQuote(state, "PH-TEST-001", rates);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.enquiry.status).toBe("quote_sent");
    expect(res.enquiry.amount).toBe(60000 + 5000 + 100 * 450);
    expect(res.enquiry.advancePaid).toBe(0);
  });

  it("refuses to quote anything but a new enquiry", () => {
    const state = { partyHall: [enquiry({ status: "quote_sent" })] };
    const res = sendPartyHallQuote(state, "PH-TEST-001", resolvePartyHallRates());
    expect(res.ok).toBe(false);
  });

  it("records the advance only from quote_sent, and confirms only from advance_paid", () => {
    const quoted = enquiry({ status: "quote_sent", amount: 100000 });

    const tooEarly = confirmPartyHallEvent({ partyHall: [quoted] }, "PH-TEST-001");
    expect(tooEarly.ok).toBe(false);

    const advanced = recordPartyHallAdvance({ partyHall: [quoted] }, "PH-TEST-001", 25);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.enquiry.status).toBe("advance_paid");
    expect(advanced.enquiry.advancePaid).toBe(25000);

    const confirmed = confirmPartyHallEvent({ partyHall: [advanced.enquiry] }, "PH-TEST-001", 25);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.enquiry.status).toBe("confirmed");
    expect(confirmed.enquiry.advancePaid).toBe(25000);
  });

  it("declines a quote and reopens it back to quote_sent, non-destructively", () => {
    const quoted = enquiry({ status: "quote_sent", amount: 100000 });

    const declined = declinePartyHallEnquiry({ partyHall: [quoted] }, "PH-TEST-001");
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.enquiry.status).toBe("declined");
    expect(declined.enquiry.amount).toBe(100000);
    expect(declined.enquiry.addOns).toEqual(quoted.addOns);

    const reopened = reopenPartyHallEnquiry({ partyHall: [declined.enquiry] }, "PH-TEST-001");
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.enquiry.status).toBe("quote_sent");
    expect(reopened.enquiry.amount).toBe(100000);
  });

  it("refuses to decline an enquiry once its advance is in hand", () => {
    const res = declinePartyHallEnquiry(
      { partyHall: [enquiry({ status: "advance_paid", amount: 100000 })] },
      "PH-TEST-001",
    );
    expect(res.ok).toBe(false);
  });

  it("refuses to reopen anything but a declined enquiry", () => {
    const res = reopenPartyHallEnquiry({ partyHall: [enquiry({})] }, "PH-TEST-001");
    expect(res.ok).toBe(false);
  });

  it("reopens a declined-before-any-quote enquiry back to enquiry, not quote_sent", () => {
    const bare = enquiry({ status: "enquiry", amount: 0 });
    const declined = declinePartyHallEnquiry({ partyHall: [bare] }, "PH-TEST-001");
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.enquiry.status).toBe("declined");

    const reopened = reopenPartyHallEnquiry({ partyHall: [declined.enquiry] }, "PH-TEST-001");
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.enquiry.status).toBe("enquiry");
    expect(reopened.enquiry.amount).toBe(0);
  });

  it("cancels a booking out of advance_paid or confirmed, stamping refundedAt", () => {
    const advancePaid = enquiry({
      status: "advance_paid",
      amount: 100000,
      advanceAmount: 25000,
      advancePct: 25,
    });
    const cancelledFromAdvance = cancelPartyHallEvent({ partyHall: [advancePaid] }, "PH-TEST-001");
    expect(cancelledFromAdvance.ok).toBe(true);
    if (!cancelledFromAdvance.ok) return;
    expect(cancelledFromAdvance.enquiry.status).toBe("cancelled");
    expect(cancelledFromAdvance.enquiry.refundedAt).toBeTruthy();
    // Never wipe the financial record.
    expect(cancelledFromAdvance.enquiry.advanceAmount).toBe(25000);

    const confirmed = enquiry({
      status: "confirmed",
      amount: 100000,
      advanceAmount: 25000,
      advancePct: 25,
    });
    const cancelledFromConfirmed = cancelPartyHallEvent({ partyHall: [confirmed] }, "PH-TEST-001");
    expect(cancelledFromConfirmed.ok).toBe(true);
    if (!cancelledFromConfirmed.ok) return;
    expect(cancelledFromConfirmed.enquiry.status).toBe("cancelled");
    expect(cancelledFromConfirmed.enquiry.refundedAt).toBeTruthy();
  });

  it("refuses to cancel a booking with no advance on record", () => {
    for (const status of ["enquiry", "quote_sent", "declined", "completed"] as const) {
      const res = cancelPartyHallEvent({ partyHall: [enquiry({ status })] }, "PH-TEST-001");
      expect(res.ok).toBe(false);
    }
  });

  it("has no reopen path out of cancelled", () => {
    const cancelled = enquiry({ status: "cancelled", amount: 100000 });
    const res = reopenPartyHallEnquiry({ partyHall: [cancelled] }, "PH-TEST-001");
    expect(res.ok).toBe(false);
  });
});

describe("withAdvance", () => {
  it("reads the snapshotted advance when one is on record", () => {
    const e = withAdvance(
      {
        ...enquiry({
          status: "advance_paid",
          amount: 100000,
          advanceAmount: 25000,
          advancePct: 25,
        }),
        advanceAmount: 25000,
      },
      // A live pct far from the snapshot proves the snapshot wins, not this.
      50,
    );
    expect(e.advancePaid).toBe(25000);
  });

  it("falls back to amount × live pct for a pre-snapshot row with no advanceAmount", () => {
    const e = withAdvance(enquiry({ status: "advance_paid", amount: 100000 }), 25);
    expect(e.advancePaid).toBe(25000);
  });
});
