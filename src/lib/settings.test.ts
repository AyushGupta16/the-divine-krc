import { describe, expect, it } from "vitest";

import {
  GST_PCT,
  PARTY_HALL_ADVANCE_PCT,
  ROOM_TYPES,
  getBookings,
  getPaymentsPageData,
  getSettingsPageData,
} from "@/lib/bookings";
import type { ChargeSetting } from "@/types/booking";

function charge(charges: ChargeSetting[], key: ChargeSetting["key"]): string {
  return charges.find((c) => c.key === key)!.value;
}

describe("getSettingsPageData", () => {
  it("gives the section nav a panel to scroll to, and every panel a section", async () => {
    const { sections } = await getSettingsPageData();

    expect(sections.map((s) => s.id)).toEqual([
      "property",
      "pricing",
      "payments",
      "channels",
      "team",
      "notifications",
    ]);
  });

  it("quotes the tariff the rooms are actually sold at", async () => {
    const { pricing } = await getSettingsPageData();

    // The panel edits inventory, so it must list every room type exactly once
    // and at the price that type carries — not a second copy of it.
    expect(pricing.tariffs.map((t) => t.type)).toEqual(ROOM_TYPES.map((rt) => rt.type));
    for (const tariff of pricing.tariffs) {
      const info = ROOM_TYPES.find((rt) => rt.type === tariff.type)!;
      expect(tariff.rate).toBe(info.pricePerNight.toLocaleString("en-IN"));
      expect(tariff.inventoryLabel).toContain(String(info.count));
    }
  });

  it("states the GST rate every booking is billed at", async () => {
    const { pricing } = await getSettingsPageData();
    const bookings = await getBookings();

    expect(charge(pricing.charges, "gst")).toBe(`${GST_PCT}%`);
    // A rate on this screen that no bill applies would be a lie about the price.
    for (const b of bookings) expect(b.revenue.taxPct).toBe(GST_PCT);
  });

  it("states the advance the party hall actually holds dates for", async () => {
    const { pricing } = await getSettingsPageData();

    expect(charge(pricing.charges, "partyHallAdvance")).toBe(`${PARTY_HALL_ADVANCE_PCT}%`);
  });

  it("quotes each channel the commission its own money proves", async () => {
    const { channels } = await getSettingsPageData();
    const { ota } = await getPaymentsPageData();

    // Settings states the contracted rate; Payments works the rate back out of
    // the rupees the channel kept. Wherever both exist they are the same claim,
    // so they must agree — this is what put Goibibo at 15% and not the mock's 16%.
    expect(ota.length).toBeGreaterThan(0);
    for (const settlement of ota) {
      const channel = channels.find((c) => c.key === settlement.source)!;
      expect(channel.commissionPct).toBe(settlement.commissionPct);
    }
  });

  it("never shows a channel as disconnected once it has sent us a booking", async () => {
    const { channels } = await getSettingsPageData();
    const bookings = await getBookings();

    // A booking is proof the channel manager is live, and a cancellation does
    // not undo that proof — Agoda's one booking was cancelled, so it sold no
    // stay, but it plainly reached us and the mock's "Not connected" is wrong.
    const everSent = new Set(bookings.map((b) => b.source));
    const reached = channels.filter((c) => everSent.has(c.key));
    expect(reached.length).toBeGreaterThan(0);
    for (const c of reached) expect(c.connected).toBe(true);
  });

  it("counts each channel's stays off the live set and ranks by them", async () => {
    const { channels } = await getSettingsPageData();
    const bookings = await getBookings();

    for (const c of channels) {
      const sold = bookings.filter(
        (b) => b.source === c.key && b.status !== "cancelled" && b.status !== "no_show",
      );
      expect(c.bookings).toBe(sold.length);
    }
    // Busiest channel first, so the list leads with the one that matters most.
    for (let i = 1; i < channels.length; i++) {
      expect(channels[i].bookings).toBeLessThanOrEqual(channels[i - 1].bookings);
    }
  });

  it("lists the account that can log in, and spells everyone's badge from their name", async () => {
    const { team } = await getSettingsPageData();

    // The console's own login must appear in the list of who can log in.
    const owner = team.find((m) => m.email === "admin@thedivinekrc.in");
    expect(owner).toBeDefined();
    expect(owner!.role).toBe("Owner");

    expect(team.find((m) => m.name === "Rahul Menon")!.initials).toBe("RM");
    for (const m of team) expect(m.initials).toHaveLength(2);
  });

  it("hands the toggles their state, each under a key of its own", async () => {
    const { payments, notifications } = await getSettingsPageData();

    const keys = [...payments.toggles, ...notifications].map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(payments.toggles.find((t) => t.key === "payAtHotel")!.on).toBe(true);
    expect(payments.gateway.connected).toBe(true);
  });
});
