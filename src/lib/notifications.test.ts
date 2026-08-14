import { describe, expect, it } from "vitest";

import { deriveNotifications, derivePartyHallNotifications, groupByDay } from "@/lib/notifications";
import type { Booking } from "@/types/booking";
import type { PartyHallEvent } from "@/lib/notifications";

function partyHallEvent(
  id: string,
  createdAt: string,
  source: PartyHallEvent["source"] = "direct",
): PartyHallEvent {
  return { id, title: "Reception — Test", guests: 80, createdAt, source };
}

function booking(id: string, createdAt: string, guestId = "G-001"): Booking {
  return {
    id,
    guestId,
    roomNo: null,
    roomType: "deluxe",
    checkIn: "2026-07-20",
    checkOut: "2026-07-21",
    urn: 1,
    source: "phone",
    mealPlan: "EP",
    revenue: { room: 4500, earlyCheckIn: 0, lateCheckOut: 0, other: 0, discount: 0, taxPct: 12 },
    totalBill: 5040,
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 5040,
    },
    status: "pending_payment",
    createdAt,
  };
}

const GUEST_NAME = new Map([["G-001", "Aarav Mehta"]]);

describe("deriveNotifications", () => {
  it("sorts newest first", () => {
    const items = deriveNotifications(
      [booking("KRC-1", "2026-07-15T09:00:00.000Z"), booking("KRC-2", "2026-07-16T09:00:00.000Z")],
      GUEST_NAME,
      null,
    );
    expect(items.map((i) => i.id)).toEqual(["KRC-2", "KRC-1"]);
  });

  it("everything is unread when lastReadAt is null", () => {
    const items = deriveNotifications(
      [booking("KRC-1", "2026-07-15T09:00:00.000Z")],
      GUEST_NAME,
      null,
    );
    expect(items[0].read).toBe(false);
  });

  it("splits read/unread around lastReadAt", () => {
    const items = deriveNotifications(
      [booking("KRC-1", "2026-07-15T09:00:00.000Z"), booking("KRC-2", "2026-07-16T09:00:00.000Z")],
      GUEST_NAME,
      "2026-07-15T12:00:00.000Z",
    );
    const byId = new Map(items.map((i) => [i.id, i.read]));
    expect(byId.get("KRC-1")).toBe(true);
    expect(byId.get("KRC-2")).toBe(false);
  });

  it("falls back to em-dash for an unresolved guest id", () => {
    const items = deriveNotifications(
      [booking("KRC-1", "2026-07-15T09:00:00.000Z", "G-999")],
      GUEST_NAME,
      null,
    );
    expect(items[0].title).toContain("—,");
  });

  it("flags a booking with a request in the title", () => {
    const withRequest = {
      ...booking("KRC-1", "2026-07-15T09:00:00.000Z"),
      specialRequest: { preferences: ["quiet_room" as const] },
    };
    const items = deriveNotifications([withRequest], GUEST_NAME, null);
    expect(items[0].title).toContain("has requests");
  });

  it("does not flag a booking with no request", () => {
    const items = deriveNotifications(
      [booking("KRC-1", "2026-07-15T09:00:00.000Z")],
      GUEST_NAME,
      null,
    );
    expect(items[0].title).not.toContain("has requests");
  });
});

describe("derivePartyHallNotifications", () => {
  it("produces a notification for a web-sourced (direct) enquiry", () => {
    const items = derivePartyHallNotifications(
      [partyHallEvent("PH-1", "2026-07-15T09:00:00.000Z", "direct")],
      null,
    );
    expect(items.map((i) => i.id)).toEqual(["PH-1"]);
  });

  it("produces no notification for an admin-sourced enquiry (walk_in or phone)", () => {
    const items = derivePartyHallNotifications(
      [
        partyHallEvent("PH-1", "2026-07-15T09:00:00.000Z", "walk_in"),
        partyHallEvent("PH-2", "2026-07-15T09:00:00.000Z", "phone"),
      ],
      null,
    );
    expect(items).toEqual([]);
  });

  it("still surfaces rows with no source (predates the column)", () => {
    const items = derivePartyHallNotifications(
      [partyHallEvent("PH-1", "2026-07-15T09:00:00.000Z", undefined)],
      null,
    );
    expect(items.map((i) => i.id)).toEqual(["PH-1"]);
  });
});

describe("groupByDay", () => {
  it("buckets into Today, Yesterday, and Earlier, dropping empty groups", () => {
    const items = deriveNotifications(
      [
        booking("KRC-today", "2026-07-17T10:00:00.000Z"),
        booking("KRC-yesterday", "2026-07-16T10:00:00.000Z"),
        booking("KRC-earlier", "2026-07-10T10:00:00.000Z"),
      ],
      GUEST_NAME,
      null,
    );
    const groups = groupByDay(items, "2026-07-17");
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["KRC-today"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["KRC-yesterday"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["KRC-earlier"]);
  });

  it("omits a group with no items", () => {
    const items = deriveNotifications(
      [booking("KRC-today", "2026-07-17T10:00:00.000Z")],
      GUEST_NAME,
      null,
    );
    const groups = groupByDay(items, "2026-07-17");
    expect(groups.map((g) => g.label)).toEqual(["Today"]);
  });
});
