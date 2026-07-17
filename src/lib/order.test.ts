import { describe, expect, it } from "vitest";

import {
  getBookingsPageData,
  getGuestsPageData,
  getPartyHallPageData,
  getPaymentsPageData,
  getReportsPageData,
  type BookingData,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";

// Every screen must render the same thing however the rows arrived.
//
// This suite exists because the rows stopped being an array literal and became a
// query. Postgres promises nothing about row order without an ORDER BY: the
// planner returns whatever is cheapest, and the answer can change after an
// UPDATE or a vacuum. The fixtures, being an array, quietly supplied an order
// that the derivation was reading without ever saying so — `getBookingsPageData`
// mapped straight over the input, so the table's order was an accident of how
// the seed was typed.
//
// An ORDER BY in `bookings-data.ts` makes the query deterministic, but no test
// here can see it — the suite has no database. So the rule lives in the
// derivation instead, and this is what holds it there: shuffle the input, demand
// the identical view model. It fails if anyone leans on row order again.

/** Deterministic shuffle — a seeded LCG, so a failure reproduces. */
function shuffled<T>(rows: T[], seed: number): T[] {
  const out = [...rows];
  let s = seed;
  const next = () => (s = (s * 1664525 + 1013904223) % 0x100000000) / 0x100000000;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function jumbled(seed: number): BookingData {
  return {
    guests: shuffled(fixtures.guests, seed),
    bookings: shuffled(fixtures.bookings, seed + 1),
    partyHall: shuffled(fixtures.partyHall, seed + 2),
  };
}

// A few seeds, because one shuffle can get lucky and reproduce the input order.
const SEEDS = [1, 7, 42, 1337];

describe("row order is a decision, not an accident of storage", () => {
  it("lists bookings by booking number, however the rows arrive", async () => {
    const expected = await getBookingsPageData(fixtures, "2026-07-15");
    // The design's order: KRC-…-001 through -010, across several dates.
    expect(expected.rows.map((r) => r.booking.id.slice(-3))).toEqual([
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
    ]);

    for (const seed of SEEDS) {
      const actual = await getBookingsPageData(jumbled(seed), "2026-07-15");
      expect(actual.rows).toEqual(expected.rows);
    }
  });

  it("keeps the guest directory — and its avatars — put", async () => {
    const expected = await getGuestsPageData(fixtures);
    for (const seed of SEEDS) {
      const actual = await getGuestsPageData(jumbled(seed));
      // Avatars are keyed off list position, so a reshuffle would repaint them.
      expect(actual.guests).toEqual(expected.guests);
      expect(actual.stats).toEqual(expected.stats);
    }
  });

  it("orders payments and OTA settlements the same way every time", async () => {
    const expected = await getPaymentsPageData(fixtures, "2026-07-14");
    for (const seed of SEEDS) {
      const actual = await getPaymentsPageData(jumbled(seed), "2026-07-14");
      expect(actual.transactions).toEqual(expected.transactions);
      expect(actual.ota).toEqual(expected.ota);
      expect(actual.kpis).toEqual(expected.kpis);
    }
  });

  it("orders the party-hall pipeline the same way every time", async () => {
    const expected = await getPartyHallPageData(fixtures);
    for (const seed of SEEDS) {
      const actual = await getPartyHallPageData(jumbled(seed));
      expect(actual.events).toEqual(expected.events);
      expect(actual.stats).toEqual(expected.stats);
    }
  });

  it("reports the same figures however the rows arrive", async () => {
    // Sums do not care about order — but the widgets ranked by revenue do.
    const expected = await getReportsPageData(fixtures, "2026-07-14");
    for (const seed of SEEDS) {
      const actual = await getReportsPageData(jumbled(seed), "2026-07-14");
      expect(actual.ranges).toEqual(expected.ranges);
    }
  });
});
