import { describe, expect, it } from "vitest";

import { getRoomsPageData, ROOM_UNITS } from "@/lib/bookings";

describe("getRoomsPageData", () => {
  it("boards cover all 14 rooms with the correct per-floor split", async () => {
    const data = await getRoomsPageData();
    const all = data.floors.flatMap((f) => f.rooms);
    expect(all.length).toBe(14);

    for (const floor of data.floors) {
      expect(floor.rooms.length).toBe(7);
      const balcony = floor.rooms.filter(
        (r) => r.type === "deluxe_balcony",
      ).length;
      const deluxe = floor.rooms.filter((r) => r.type === "deluxe").length;
      expect(deluxe).toBe(5);
      expect(balcony).toBe(2);
    }
  });

  it("floors render second-then-first, each room on its own floor", async () => {
    const data = await getRoomsPageData();
    expect(data.floors.map((f) => f.floor)).toEqual([2, 1]);
    for (const floor of data.floors) {
      expect(floor.rooms.every((r) => r.floor === floor.floor)).toBe(true);
    }
  });

  it("legend counts partition every room", async () => {
    const data = await getRoomsPageData();
    const summed = data.legend.reduce((a, l) => a + l.count, 0);
    expect(summed).toBe(ROOM_UNITS.length);
  });

  it("each type card's availability equals its free tiles", async () => {
    const data = await getRoomsPageData();
    const all = data.floors.flatMap((f) => f.rooms);
    for (const card of data.typeCards) {
      const free = all.filter(
        (r) => r.type === card.type && r.status === "available",
      ).length;
      expect(card.available).toBe(free);
    }
  });

  it("summary line reflects the derived occupied/available counts", async () => {
    const data = await getRoomsPageData();
    const occupied = data.legend.find((l) => l.status === "occupied")!.count;
    const available = data.legend.find((l) => l.status === "available")!.count;
    expect(data.summaryLine).toContain(`${occupied} occupied`);
    expect(data.summaryLine).toContain(`${available} available`);
  });
});
