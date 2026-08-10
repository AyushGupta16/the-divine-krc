import { describe, expect, it } from "vitest";

import {
  canDeleteRoom,
  currentOccupant,
  getRoomsPageData,
  roomNumberTaken,
  ROOM_UNITS,
  validateAddRoom,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import type { Booking, Guest, PartyHallEnquiry, RoomTile } from "@/types/booking";

function event(patch: Partial<PartyHallEnquiry>): PartyHallEnquiry {
  return {
    id: "PH-SYN-001",
    title: "Synthetic event",
    date: "2027-01-01",
    slot: "evening",
    guests: 100,
    package: "Gold",
    addOns: [],
    status: "confirmed",
    amount: 100000,
    advancePaid: 0,
    ...patch,
  };
}

function tile(no: string, overrides: Partial<RoomTile> = {}): RoomTile {
  return {
    no,
    type: "deluxe",
    floor: 1,
    status: "available",
    detail: "Ready",
    sizeSqm: null,
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "SYN-1",
    guestId: "G-SYN",
    roomNo: "101",
    roomType: "deluxe",
    checkIn: "2027-01-01",
    checkOut: "2027-01-03",
    urn: 1,
    source: "direct",
    mealPlan: "CP",
    revenue: { room: 0, earlyCheckIn: 0, lateCheckOut: 0, other: 0, discount: 0, taxPct: 0 },
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "confirmed",
    createdAt: "2026-12-01T00:00:00.000Z",
    totalBill: 0,
    ...overrides,
  };
}

const GUEST: Guest = {
  id: "G-SYN",
  name: "Synthetic Guest",
  phone: "+91 90000 00000",
  email: "synthetic@example.com",
  city: "Test City",
  stays: 1,
  lifetimeValue: 0,
  tier: "new",
};

describe("getRoomsPageData", () => {
  it("boards cover all 14 rooms with the correct per-floor split", async () => {
    const data = await getRoomsPageData(fixtures);
    const all = data.floors.flatMap((f) => f.rooms);
    expect(all.length).toBe(14);

    for (const floor of data.floors) {
      expect(floor.rooms.length).toBe(7);
      const balcony = floor.rooms.filter((r) => r.type === "deluxe_balcony").length;
      const deluxe = floor.rooms.filter((r) => r.type === "deluxe").length;
      expect(deluxe).toBe(5);
      expect(balcony).toBe(2);
    }
  });

  it("floors render second-then-first, each room on its own floor", async () => {
    const data = await getRoomsPageData(fixtures);
    expect(data.floors.map((f) => f.floor)).toEqual([2, 1]);
    for (const floor of data.floors) {
      expect(floor.rooms.every((r) => r.floor === floor.floor)).toBe(true);
    }
  });

  it("legend counts partition every room", async () => {
    const data = await getRoomsPageData(fixtures);
    const summed = data.legend.reduce((a, l) => a + l.count, 0);
    expect(summed).toBe(ROOM_UNITS.length);
  });

  it("each type card's availability equals its free tiles", async () => {
    const data = await getRoomsPageData(fixtures);
    const all = data.floors.flatMap((f) => f.rooms);
    for (const card of data.typeCards) {
      const free = all.filter((r) => r.type === card.type && r.status === "available").length;
      expect(card.available).toBe(free);
    }
  });

  it("summary line reflects the derived occupied/available counts", async () => {
    const data = await getRoomsPageData(fixtures);
    const occupied = data.legend.find((l) => l.status === "occupied")!.count;
    const available = data.legend.find((l) => l.status === "available")!.count;
    expect(data.summaryLine).toContain(`${occupied} occupied`);
    expect(data.summaryLine).toContain(`${available} available`);
  });
});

describe("getRoomsPageData party hall tile", () => {
  const today = "2027-01-01";

  it("no upcoming events: no next line and no availability line", async () => {
    const data = await getRoomsPageData({ ...fixtures, partyHall: [] }, today);
    expect(data.partyHall.nextLabel).toBe("No events scheduled");
    expect(data.partyHall.availability).toBe("");
  });

  it("whole week free: today is day 1, range spans today through day 7", async () => {
    const data = await getRoomsPageData(
      { ...fixtures, partyHall: [event({ date: "2027-02-01" })] },
      today,
    );
    expect(data.partyHall.availability).toBe("Available 1 Jan – 7 Jan");
  });

  it("earlier run wins when two runs tie for longest", async () => {
    // Day 1 free, day 2 taken, days 3-4 free (len 2), day 5 taken, days 6-7
    // free (len 2, same length as 3-4). Earlier run must win.
    const data = await getRoomsPageData(
      {
        ...fixtures,
        partyHall: [
          event({ id: "PH-A", date: "2027-01-02" }),
          event({ id: "PH-B", date: "2027-01-05" }),
        ],
      },
      today,
    );
    expect(data.partyHall.availability).toBe("Available 3 Jan – 4 Jan");
  });

  it("longest run may be a single day and renders as one date", async () => {
    const data = await getRoomsPageData(
      {
        ...fixtures,
        partyHall: [
          event({ id: "PH-A", date: "2027-01-01" }),
          event({ id: "PH-B", date: "2027-01-02" }),
          event({ id: "PH-C", date: "2027-01-04" }),
          event({ id: "PH-D", date: "2027-01-05" }),
          event({ id: "PH-E", date: "2027-01-06" }),
          event({ id: "PH-F", date: "2027-01-07" }),
        ],
      },
      today,
    );
    expect(data.partyHall.availability).toBe("Available 3 Jan");
  });

  it("fully booked week renders the line, not an empty string", async () => {
    const data = await getRoomsPageData(
      {
        ...fixtures,
        partyHall: [0, 1, 2, 3, 4, 5, 6].map((n) =>
          event({ id: `PH-${n}`, date: `2027-01-0${n + 1}` }),
        ),
      },
      today,
    );
    expect(data.partyHall.nextLabel).not.toBe("No events scheduled");
    expect(data.partyHall.availability).toBe("Fully booked this week");
  });

  it("an un-quoted enquiry does not block a date", async () => {
    const data = await getRoomsPageData(
      { ...fixtures, partyHall: [event({ date: today, status: "enquiry" })] },
      today,
    );
    expect(data.partyHall.availability).toBe("Available 1 Jan – 7 Jan");
  });

  it("a quote sent but unpaid does not block a date", async () => {
    const data = await getRoomsPageData(
      { ...fixtures, partyHall: [event({ date: today, status: "quote_sent" })] },
      today,
    );
    expect(data.partyHall.availability).toBe("Available 1 Jan – 7 Jan");
  });

  it("an advance-paid event blocks its date", async () => {
    const data = await getRoomsPageData(
      { ...fixtures, partyHall: [event({ date: "2027-01-03", status: "advance_paid" })] },
      today,
    );
    expect(data.partyHall.availability).toBe("Available 4 Jan – 7 Jan");
  });
});

describe("currentOccupant", () => {
  const today = "2027-01-02";

  it("returns the guest name for a checked_in stay covering today", () => {
    const b = booking({ status: "checked_in", checkIn: "2027-01-01", checkOut: "2027-01-03" });
    expect(currentOccupant("101", [b], [GUEST], today)).toBe("Synthetic Guest");
  });

  it("returns the guest name for a confirmed-but-never-checked-in stay covering today", () => {
    const b = booking({ status: "confirmed", checkIn: "2027-01-01", checkOut: "2027-01-03" });
    expect(currentOccupant("101", [b], [GUEST], today)).toBe("Synthetic Guest");
  });

  it("excludes checked_out bookings even if the dates cover today", () => {
    const b = booking({ status: "checked_out", checkIn: "2027-01-01", checkOut: "2027-01-03" });
    expect(currentOccupant("101", [b], [GUEST], today)).toBeNull();
  });

  it("check_out is exclusive — checking out today is not an occupant", () => {
    const b = booking({ status: "checked_in", checkIn: "2027-01-01", checkOut: today });
    expect(currentOccupant("101", [b], [GUEST], today)).toBeNull();
  });

  it("check_in on today still counts (inclusive lower bound)", () => {
    const b = booking({ status: "confirmed", checkIn: today, checkOut: "2027-01-05" });
    expect(currentOccupant("101", [b], [GUEST], today)).toBe("Synthetic Guest");
  });

  it("multi-match tie-break: earliest check_in wins, no throw", () => {
    const later = booking({
      id: "SYN-LATER",
      guestId: "G-LATER",
      status: "confirmed",
      checkIn: "2027-01-02",
      checkOut: "2027-01-05",
    });
    const earlier = booking({
      id: "SYN-EARLIER",
      guestId: "G-SYN",
      status: "checked_in",
      checkIn: "2027-01-01",
      checkOut: "2027-01-04",
    });
    const laterGuest: Guest = { ...GUEST, id: "G-LATER", name: "Later Guest" };
    expect(() =>
      currentOccupant("101", [later, earlier], [GUEST, laterGuest], today),
    ).not.toThrow();
    expect(currentOccupant("101", [later, earlier], [GUEST, laterGuest], today)).toBe(
      "Synthetic Guest",
    );
  });

  it("returns null when no booking occupies the room", () => {
    expect(currentOccupant("999", [], [GUEST], today)).toBeNull();
  });
});

describe("roomNumberTaken", () => {
  const rooms = [tile("101"), tile("102")];

  it("is true for an existing room number", () => {
    expect(roomNumberTaken(rooms, "101")).toBe(true);
  });

  it("is false for a free room number", () => {
    expect(roomNumberTaken(rooms, "999")).toBe(false);
  });
});

describe("canDeleteRoom", () => {
  it("blocks deletion when the room has any booking history, even checked_out", () => {
    const b = booking({ status: "checked_out", roomNo: "101" });
    expect(canDeleteRoom([b], "101")).toBe(false);
  });

  it("blocks deletion for an active booking too", () => {
    const b = booking({ status: "confirmed", roomNo: "101" });
    expect(canDeleteRoom([b], "101")).toBe(false);
  });

  it("allows deletion when the room has no bookings at all", () => {
    const b = booking({ status: "checked_out", roomNo: "102" });
    expect(canDeleteRoom([b], "101")).toBe(true);
  });
});

describe("validateAddRoom", () => {
  const rooms = [tile("101")];

  it("blocks a duplicate room number and names the conflict", () => {
    const res = validateAddRoom(rooms, "101", 1, "deluxe");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("101");
  });

  it("blocks an empty room number", () => {
    const res = validateAddRoom(rooms, "  ", 1, "deluxe");
    expect(res.ok).toBe(false);
  });

  it("passes for a valid, free room number", () => {
    const res = validateAddRoom(rooms, "999", 2, "deluxe_balcony");
    expect(res.ok).toBe(true);
  });
});
