// Derivation layer for the booking system: the rules that turn rows into the
// view model each admin screen renders.
//
// !! THIS FILE HOLDS NO DATA, AND MUST NOT. !!
//
// Route loaders import it, so whatever it can reach, the bundler compiles into
// `dist/client` and hands to every anonymous visitor to the landing page. The
// seed rows used to live here, which put ten guests' names and email addresses
// in the entry chunk. Mock names made that survivable; real ones would not.
// The rows now arrive as an argument (`BookingData`) from `bookings.server.ts`,
// whose handler bodies never reach the browser. Same rule as `lib/team.ts`:
// what this file imports is public.
//
// Everything here is a pure function of its arguments, which is what keeps the
// test suite able to run without a database, and what lets the DB swap change
// only where the rows come from — never how they are read.

import type {
  Booking,
  BookingSource,
  BookingsPageData,
  BookingStatus,
  CalendarCell,
  CalendarPageData,
  DashboardData,
  Guest,
  GuestListItem,
  GuestsPageData,
  GuestStat,
  GuestTier,
  Occupancy,
  OccupancyBand,
  OtaSettlement,
  PaymentMethod,
  PaymentsKpi,
  PaymentsPageData,
  PaymentsTxnItem,
  PaymentTransaction,
  PartyHallCalendarCell,
  PartyHallEnquiry,
  PartyHallEventItem,
  PartyHallMiniCalendar,
  PartyHallPackage,
  PartyHallPageData,
  PartyHallPill,
  PartyHallStat,
  PartyHallStatus,
  PaymentsMonthlyRollup,
  MealPlan,
  MealPlanShare,
  ReportsKpi,
  ReportsPageData,
  ReportsRange,
  RevenueBar,
  RevenuePeriod,
  RevenuePeriodKey,
  RoomTypePerf,
  SourceSlice,
  TransactionStatus,
  RoomFloor,
  RoomsLegendItem,
  RoomsPageData,
  RoomStatus,
  RoomTile,
  RoomType,
  RoomTypeCard,
  ChannelSetting,
  ChargeSetting,
  PaymentSettings,
  PricingSettings,
  PropertyProfile,
  RoomTariff,
  SettingsPageData,
  SettingsSection,
  TeamMember,
  ToggleSetting,
} from "@/types/booking";
import {
  computeTotalBill,
  computeTotalCollected,
  formatINR,
  formatINRCompact,
} from "@/lib/booking-math";
import { isActive, team } from "@/lib/team";
import { initialsOf } from "@/lib/utils";

/**
 * Every row an admin screen derives from, fetched once per request and threaded
 * through. One bundle rather than three arguments because most screens read more
 * than one of them, and because the DB swap then changes one signature, not ten.
 */
export interface BookingData {
  bookings: Booking[];
  guests: Guest[];
  partyHall: PartyHallEnquiry[];
}

export interface RoomTypeInfo {
  type: RoomType;
  name: string;
  pricePerNight: number;
  areaSqm: number;
  count: number;
}

/** Inventory — source of truth per README. */
export const ROOM_TYPES: RoomTypeInfo[] = [
  {
    type: "deluxe",
    name: "Deluxe Room",
    pricePerNight: 1500,
    areaSqm: 24,
    count: 10,
  },
  {
    type: "deluxe_balcony",
    name: "Deluxe Room with Balcony",
    pricePerNight: 1700,
    areaSqm: 26,
    count: 4,
  },
];

/** A physical room: number, floor, and type. Source of truth for inventory. */
export interface RoomUnit {
  no: string;
  floor: 1 | 2;
  type: RoomType;
}

/**
 * The 14 physical rooms. Each floor is 5 Deluxe + 2 Balcony (spec 05); the two
 * balcony rooms sit at the end of each corridor (x06, x07).
 */
export const ROOM_UNITS: RoomUnit[] = [
  { no: "101", floor: 1, type: "deluxe" },
  { no: "102", floor: 1, type: "deluxe" },
  { no: "103", floor: 1, type: "deluxe" },
  { no: "104", floor: 1, type: "deluxe" },
  { no: "105", floor: 1, type: "deluxe" },
  { no: "106", floor: 1, type: "deluxe_balcony" },
  { no: "107", floor: 1, type: "deluxe_balcony" },
  { no: "201", floor: 2, type: "deluxe" },
  { no: "202", floor: 2, type: "deluxe" },
  { no: "203", floor: 2, type: "deluxe" },
  { no: "204", floor: 2, type: "deluxe" },
  { no: "205", floor: 2, type: "deluxe" },
  { no: "206", floor: 2, type: "deluxe_balcony" },
  { no: "207", floor: 2, type: "deluxe_balcony" },
];

/** All 14 physical room numbers across the two floors. */
export const ROOM_NUMBERS: string[] = ROOM_UNITS.map((r) => r.no);

/**
 * The GST rate the property bills at. Every booking carries its own `taxPct`,
 * because a stay is taxed at the rate in force the day it was billed and an old
 * booking must not silently re-rate itself when the property changes this. The
 * constant is what the current rate *is* — the Settings panel shows it and new
 * bookings take it — so there is one 12 in the code rather than one per seed row.
 */
export const GST_PCT = 12;

/** Standard charges for a stay that starts early or ends late (design: Settings). */
export const EARLY_CHECKIN_FEE = 400;
export const LATE_CHECKOUT_FEE = 500;

/**
 * Loyalty standing, by stays alone: four stays earns Gold, a second stay earns
 * Silver, and a first-time guest is New.
 *
 * Lifetime value deliberately plays no part. It tracks stays closely enough
 * that the two never disagree on the seeded set, but a spend threshold could
 * not be stated without contradicting the design: its Gold guests start at
 * ₹1.24L, where ours start at ₹32.6k. Stays is the rule both sets agree on.
 */
export function guestTier(stays: number): GuestTier {
  if (stays >= 4) return "gold";
  if (stays >= 2) return "silver";
  return "new";
}

/** Hydrates a seeded guest with the tier its stays earn. */
export function withTier(g: Omit<Guest, "tier">): Guest {
  return { ...g, tier: guestTier(g.stays) };
}

/** Hydrates a seeded booking with the bill its charges add up to. */
export function withTotal(b: Omit<Booking, "totalBill">): Booking {
  return { ...b, totalBill: computeTotalBill(b.revenue) };
}

/**
 * The booking number — the `nnn` an id ends with, and the first column the
 * Bookings table shows. See `bookingId(date, seq)`.
 */
function bookingNumber(id: string): number {
  return Number(id.slice(id.lastIndexOf("-") + 1));
}

/**
 * The order the Bookings screen lists in: by booking number, as the design does
 * (`KRC-…-001` through `-010`, across several dates).
 *
 * Stated here rather than inherited from the row order, because there is no row
 * order to inherit. These rows arrive from Postgres, which without an ORDER BY
 * returns whatever the planner finds cheapest and may answer differently after
 * an UPDATE. This function is what makes the table's order a decision instead of
 * an accident of storage — and it is testable with no database, which an ORDER
 * BY is not.
 *
 * The id breaks ties: `seq` is not promised to be unique across dates.
 */
export function byBookingNumber(a: Booking, b: Booking): number {
  return bookingNumber(a.id) - bookingNumber(b.id) || a.id.localeCompare(b.id);
}

/** Share of the total taken up-front to hold a date (design: "25% advance"). */
export const PARTY_HALL_ADVANCE_PCT = 25;

/** The up-front payment that confirms a booking, to the nearest rupee. */
export function partyHallAdvance(amount: number): number {
  return Math.round((amount * PARTY_HALL_ADVANCE_PCT) / 100);
}

/**
 * Money actually in hand for an event. Derived from the total and where the
 * event sits in the pipeline, so the seed can never claim an advance that
 * disagrees with the 25% rule: nothing before the advance is paid, the advance
 * once a date is held, and the full amount once the event is settled.
 */
function collectedFor(status: PartyHallStatus, amount: number): number {
  if (status === "completed") return amount;
  if (status === "advance_paid" || status === "confirmed") return partyHallAdvance(amount);
  return 0;
}

/** Hydrates a seeded enquiry with the advance its pipeline stage implies. */
export function withAdvance(e: Omit<PartyHallEnquiry, "advancePaid">): PartyHallEnquiry {
  return { ...e, advancePaid: collectedFor(e.status, e.amount) };
}

/**
 * Events still ahead of the hall — anything not called off and not already
 * settled. This is the one rule behind "next event", the rooms card and the
 * calendar's event flags, so the three can never disagree about what counts.
 */
function isUpcomingEvent(e: PartyHallEnquiry): boolean {
  return e.status !== "cancelled" && e.status !== "completed";
}

/** Soonest upcoming event, or undefined when the hall has nothing booked. */
function nextPartyHallEvent(partyHall: PartyHallEnquiry[]): PartyHallEnquiry | undefined {
  return [...partyHall].filter(isUpcomingEvent).sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** "30 Jul · Evening" — the shared next-event line. */
function nextEventLabel(e: PartyHallEnquiry | undefined): string {
  if (!e) return "No events booked";
  const date = new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${date} · ${SLOT_LABEL[e.slot]}`;
}

/** Room types are inventory, not booking data — static config, safe to ship. */
export async function getRoomTypes(): Promise<RoomTypeInfo[]> {
  return ROOM_TYPES;
}

export function findBooking(data: BookingData, id: string): Booking | undefined {
  return data.bookings.find((b) => b.id === id);
}

export function findGuest(data: BookingData, id: string): Guest | undefined {
  return data.guests.find((g) => g.id === id);
}

/** Statuses that hold a physical room off the market. */
const OCCUPYING_STATUSES = new Set(["confirmed", "checked_in", "pending_payment"]);

/**
 * Rooms free to sell right now — read off the floor board, so the sidebar badge
 * quotes the same figure as the Rooms screen it links to.
 *
 * "Available" is narrower than the dashboard's "vacant": a room being cleaned or
 * under maintenance is unoccupied but cannot be sold, so it counts toward vacant
 * and not toward this.
 */
export async function getAvailableRoomCount(): Promise<number> {
  return countTiles(roomTilesNow(), "available");
}

/**
 * Tonight's occupancy, derived whole from the floor board: the percentage, the
 * per-type splits and the vacant count all fall out of the tiles, so the card
 * cannot contradict the Rooms screen or itself. Only the party-hall line is
 * still seeded (see below).
 */
function occupancyNow(): Occupancy {
  const tiles = roomTilesNow();
  const occupied = countTiles(tiles, "occupied");
  const total = tiles.length;

  return {
    occupied,
    total,
    pct: Math.round((occupied / total) * 100),
    deluxe: {
      occupied: countTiles(tiles, "occupied", "deluxe"),
      total: tiles.filter((t) => t.type === "deluxe").length,
    },
    deluxeBalcony: {
      occupied: countTiles(tiles, "occupied", "deluxe_balcony"),
      total: tiles.filter((t) => t.type === "deluxe_balcony").length,
    },
    // Vacant means "nobody in it" — cleaning and maintenance rooms included.
    vacant: total - occupied,
    // FIXME: still seeded, and it disagrees with the pipeline — PH-20260822-007
    // ("Reception — Priya & Arjun", 22 Aug) is an *enquiry*, not a booking, so
    // "Booked" overstates it. Deriving this line is its own change.
    partyHall: "Booked 22 Aug",
  };
}

/**
 * Everything the admin dashboard renders, in one round-trip. `unassignedRooms`,
 * `occupancy` and `revenue` are derived from the live booking set so the card
 * figures stay truthful; the rest still mirrors `Admin Dashboard.dc.html`.
 */
export async function getDashboardData(
  data: BookingData,
  today = "2026-07-14",
): Promise<DashboardData> {
  const unassignedRooms = data.bookings.filter(
    (b) => b.roomNo === null && OCCUPYING_STATUSES.has(b.status),
  ).length;

  return {
    checkInsToday: { total: 12, arrived: 4, pending: 8 },
    checkOutsToday: { total: 8, settled: 5, late: 3 },
    expectedArrivals: { total: 5, nextTime: "2:30 PM", nextLabel: "Sharma +2" },
    unassignedRooms,
    occupancy: occupancyNow(),
    revenue: revenuePeriods(data, today),
    activity: [
      {
        id: "act-1",
        kind: "check_in",
        title: "Checked in *Priya Nair* to *Deluxe Balcony 204*",
        meta: "2 min ago · 2 nights · ₹3,400 paid",
      },
      {
        id: "act-2",
        kind: "enquiry",
        title: "New *Party Hall* enquiry — 150 guests, tailored quote",
        meta: "18 min ago · 22 Aug · advance pending",
      },
      {
        id: "act-3",
        kind: "payment",
        title: "*₹1,700* UPI payment received — booking *#BK-2047*",
        meta: "41 min ago · Classic 110",
      },
      {
        id: "act-4",
        kind: "cancellation",
        title: "*#BK-2039* cancelled by guest — refund initiated",
        meta: "1 hr ago · Deluxe Balcony 118",
      },
    ],
    arrivals: [
      {
        id: "arr-1",
        initials: "AS",
        name: "Anil Sharma",
        extra: "+2",
        roomType: "Deluxe Balcony",
        nights: 2,
        time: "2:30 PM",
        assignment: "unassigned",
        assigned: false,
      },
      {
        id: "arr-2",
        initials: "MK",
        name: "Meera Krishnan",
        roomType: "Classic",
        nights: 3,
        time: "3:00 PM",
        assignment: "Room 112",
        assigned: true,
      },
      {
        id: "arr-3",
        initials: "JT",
        name: "John Thomas",
        extra: "+1",
        roomType: "Deluxe Balcony",
        nights: 1,
        time: "4:15 PM",
        assignment: "Room 206",
        assigned: true,
      },
      {
        id: "arr-4",
        initials: "SV",
        name: "Sunita Verma",
        roomType: "Classic",
        nights: 4,
        time: "6:00 PM",
        assignment: "unassigned",
        assigned: false,
      },
    ],
  };
}

/** Physical rooms held off the market on a date by an occupying booking. */
function occupiedRoomsOn(bookings: Booking[], onDate: string): Set<string> {
  const occupied = new Set<string>();
  for (const b of bookings) {
    if (!b.roomNo || !OCCUPYING_STATUSES.has(b.status)) continue;
    if (b.checkIn <= onDate && onDate < b.checkOut) occupied.add(b.roomNo);
  }
  return occupied;
}

/**
 * Everything the admin Bookings screen renders. Summary figures, tab counts
 * and the period-totals footer are all derived from the live booking set (not
 * seeded), so "totals auto" holds and the numbers stay honest across edits.
 */
export async function getBookingsPageData(
  data: BookingData,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<BookingsPageData> {
  const guestName = new Map(data.guests.map((g) => [g.id, g.name]));
  const rows = [...data.bookings].sort(byBookingNumber).map((booking) => ({
    booking,
    guestName: guestName.get(booking.guestId) ?? "—",
  }));

  const countsByStatus = data.bookings.reduce(
    (acc, b) => {
      acc[b.status] += 1;
      return acc;
    },
    {
      confirmed: 0,
      checked_in: 0,
      checked_out: 0,
      pending_payment: 0,
      cancelled: 0,
      no_show: 0,
    } as Record<BookingStatus, number>,
  );

  const totals = data.bookings.reduce<BookingsPageData["totals"]>(
    (acc, b) => {
      acc.roomRev += b.revenue.room;
      acc.earlyCheckIn += b.revenue.earlyCheckIn;
      acc.lateCheckOut += b.revenue.lateCheckOut;
      acc.other += b.revenue.other;
      acc.totalBill += b.totalBill;
      acc.paidToHotel += b.collection.paidToHotel;
      acc.otaCollection += b.collection.otaCollection;
      acc.pending += b.collection.pending;
      return acc;
    },
    {
      roomRev: 0,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 0,
      totalBill: 0,
      paidToHotel: 0,
      otaCollection: 0,
      pending: 0,
    },
  );

  // Room state comes off the floor board, not this booking set — its room
  // numbers are illustrative and fall outside the real inventory.
  const tonight = occupancyNow();
  const totalUrn = data.bookings.reduce((sum, b) => sum + b.urn, 0);
  const totalCollected = data.bookings.reduce(
    (sum, b) => sum + computeTotalCollected(b.collection),
    0,
  );

  const summary: BookingsPageData["summary"] = [
    {
      key: "checkInsToday",
      label: "Today's check-ins",
      value: String(data.bookings.filter((b) => b.checkIn === today).length),
    },
    {
      key: "checkOutsToday",
      label: "Today's check-outs",
      value: String(data.bookings.filter((b) => b.checkOut === today).length),
    },
    {
      key: "occupied",
      label: "Occupied rooms",
      value: `${tonight.occupied} / ${tonight.total}`,
    },
    {
      // Here "available" means unoccupied, matching this screen's design — the
      // Rooms screen counts only sellable rooms, so it reads lower.
      key: "available",
      label: "Available rooms",
      value: String(tonight.vacant),
    },
    { key: "totalUrn", label: "Total URN (period)", value: String(totalUrn) },
    { key: "roomRevenue", label: "Room revenue", value: formatINR(totals.roomRev) },
    {
      key: "totalCollected",
      label: "Total collected",
      value: formatINR(totalCollected),
    },
    {
      key: "pendingCollection",
      label: "Pending collection",
      value: formatINR(totals.pending),
    },
    {
      key: "otaReceivables",
      label: "OTA receivables",
      value: formatINR(totals.otaCollection),
    },
    {
      key: "cancellations",
      label: "Cancellations",
      value: String(countsByStatus.cancelled + countsByStatus.no_show),
    },
  ];

  return { today, total: data.bookings.length, summary, countsByStatus, rows, totals };
}

// ── Rooms screen ───────────────────────────────────────────────────────────

const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  occupied: "Occupied",
  available: "Available",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

/** Legend order — matches the design's swatch row. */
const ROOM_STATUS_ORDER: RoomStatus[] = ["occupied", "available", "cleaning", "maintenance"];

/**
 * Per-room state overriding the default "available". The booking seed uses
 * historical/illustrative room numbers that don't map onto the live 14-room
 * inventory, so — as with the dashboard's activity feed — the floor board is
 * seeded to mirror `Admin Room Management.dc.html`; the legend and type-card
 * availability are then *derived* from these tiles so the counts stay honest.
 */
const ROOM_STATE_SEED: Record<string, { status: RoomStatus; detail: string }> = {
  "101": { status: "occupied", detail: "Rao · out 15 Jul" },
  "102": { status: "occupied", detail: "Verma · out 18 Jul" },
  "104": { status: "occupied", detail: "Joseph · out 16 Jul" },
  "105": { status: "maintenance", detail: "AC repair" },
  "106": { status: "occupied", detail: "Khan · out 15 Jul" },
  "107": { status: "occupied", detail: "Thomas · out 16 Jul" },
  "201": { status: "occupied", detail: "Nair · out 15 Jul" },
  "202": { status: "occupied", detail: "Sharma · out 15 Jul" },
  "204": { status: "occupied", detail: "Das · out 16 Jul" },
  "205": { status: "cleaning", detail: "Turnover" },
  "206": { status: "occupied", detail: "Reddy · out 17 Jul" },
};

/**
 * The state of all 14 physical rooms right now — the single source of truth for
 * "which rooms are occupied tonight".
 *
 * It cannot be derived from `BOOKINGS`: that seed seats guests in illustrative
 * room numbers ("108", "112") outside the real inventory, so counting occupied
 * rooms from it answers 2 of 14 and every screen quoting it disagreed with the
 * floor board. Everything asking about room state today goes through here.
 */
function roomTilesNow(): RoomTile[] {
  return ROOM_UNITS.map(buildRoomTile);
}

/** Rooms of a type in a given state — the one counting rule behind the tiles. */
function countTiles(tiles: RoomTile[], status: RoomStatus, type?: RoomType): number {
  return tiles.filter((t) => t.status === status && (!type || t.type === type)).length;
}

function buildRoomTile(unit: RoomUnit): RoomTile {
  const seed = ROOM_STATE_SEED[unit.no];
  return {
    no: unit.no,
    type: unit.type,
    floor: unit.floor,
    status: seed?.status ?? "available",
    detail: seed?.detail ?? "Ready",
  };
}

/**
 * Everything the admin Rooms screen renders. Tile statuses are seeded to mirror
 * the design; the legend counts and each type card's availability are derived
 * from the tiles so they can never drift out of sync.
 *
 * Only the party-hall line reads `data` — the floor board is the source of truth
 * for room state and is deliberately not derived from the booking set.
 */
export async function getRoomsPageData(data: BookingData): Promise<RoomsPageData> {
  const tiles = ROOM_UNITS.map(buildRoomTile);

  const countByStatus = tiles.reduce(
    (acc, t) => {
      acc[t.status] += 1;
      return acc;
    },
    { occupied: 0, available: 0, cleaning: 0, maintenance: 0 } as Record<RoomStatus, number>,
  );

  const typeCards: RoomTypeCard[] = ROOM_TYPES.map((rt) => ({
    type: rt.type,
    name: rt.name,
    count: rt.count,
    areaSqm: rt.areaSqm,
    pricePerNight: rt.pricePerNight,
    available: tiles.filter((t) => t.type === rt.type && t.status === "available").length,
  }));

  const legend: RoomsLegendItem[] = ROOM_STATUS_ORDER.map((status) => ({
    status,
    label: ROOM_STATUS_LABEL[status],
    count: countByStatus[status],
  }));

  const floors: RoomFloor[] = ([2, 1] as const).map((floor) => ({
    floor,
    label: `${floor === 2 ? "Second" : "First"} floor · 5 Deluxe + 2 Balcony`,
    rooms: tiles.filter((t) => t.floor === floor),
  }));

  const partyHall = {
    nextLabel: nextEventLabel(nextPartyHallEvent(data.partyHall)),
    availability: "Available 14–21 Jul",
  };

  const summaryLine = `${tiles.length} rooms · ${countByStatus.occupied} occupied · ${countByStatus.available} available tonight · 1 party hall`;

  return { summaryLine, typeCards, legend, floors, partyHall };
}

/** Party-hall slot → display label. */
const SLOT_LABEL: Record<PartyHallEnquiry["slot"], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  full_day: "Full day",
};

// ── Calendar screen ────────────────────────────────────────────────────────

const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BAND_LABEL: Record<OccupancyBand, string> = {
  low: "Low (<40%)",
  medium: "Medium",
  high: "High (>70%)",
  full: "Full",
};

/** Legend order — matches the design's swatch row. */
const BAND_ORDER: OccupancyBand[] = ["low", "medium", "high", "full"];

/**
 * Occupied-room count per day of July 2026, mirroring `Admin Calendar.dc.html`.
 *
 * As with the rooms floor board, the booking seed is too small to paint a
 * plausible month, so the display month is seeded; every other month derives
 * from the live booking set via `occupiedRoomsOn`. The design fixes *percents*,
 * but they are all exactly `round(n / 14 * 100)` for a whole n, so we seed n and
 * derive the percent back — that keeps the "% + n/14" pair honest by construction.
 */
const JULY_2026_OCCUPANCY: Record<number, number> = {
  1: 5,
  2: 6,
  3: 7,
  4: 10,
  5: 9,
  6: 7,
  7: 6,
  8: 8,
  9: 9,
  10: 11,
  11: 12,
  12: 10,
  13: 9,
  14: 9,
  15: 7,
  16: 8,
  17: 10,
  18: 11,
  19: 13,
  20: 12,
  21: 9,
  22: 10,
  23: 11,
  24: 12,
  25: 14,
  26: 14,
  27: 12,
  28: 10,
  29: 9,
  30: 11,
  31: 10,
};

/**
 * Party-hall events by ISO date, seeded for the July display month per the
 * design. Merged with the live enquiry set below so other months stay truthful.
 */
const CALENDAR_EVENT_SEED: Record<string, string> = {
  "2026-07-12": "Birthday · 55 pax",
  "2026-07-22": "Reception · 140 pax",
  "2026-07-30": "Wedding · 150 pax",
};

/** Occupancy percent → shading band. Thresholds mirror the legend. */
export function occupancyBand(pct: number): OccupancyBand {
  if (pct >= 100) return "full";
  if (pct >= 70) return "high";
  if (pct >= 40) return "medium";
  return "low";
}

/** Party-hall events for a month: design seed first, then live enquiries. */
function eventsForMonth(
  partyHall: PartyHallEnquiry[],
  year: number,
  month: number,
): Map<string, string> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const events = new Map<string, string>();

  for (const e of partyHall) {
    if (!isUpcomingEvent(e) || !e.date.startsWith(prefix)) continue;
    events.set(e.date, `${e.title} · ${e.guests} pax`);
  }
  // Seed wins — it is what the design shows for the July display month.
  for (const [date, label] of Object.entries(CALENDAR_EVENT_SEED)) {
    if (date.startsWith(prefix)) events.set(date, label);
  }
  return events;
}

/**
 * The month grid the admin Calendar screen renders. Blanks pad the grid to whole
 * weeks so the first falls on its real weekday and the last row squares off.
 */
export async function getCalendarPageData(
  data: BookingData,
  year = 2026,
  month = 7,
): Promise<CalendarPageData> {
  const total = ROOM_NUMBERS.length;
  const isDisplayMonth = year === 2026 && month === 7;
  const events = eventsForMonth(data.partyHall, year, month);

  // UTC throughout: local-time dates shift the weekday offset west of GMT.
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ kind: "blank" });

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const occupied = isDisplayMonth
      ? JULY_2026_OCCUPANCY[day]
      : occupiedRoomsOn(data.bookings, date).size;
    const pct = Math.round((occupied / total) * 100);
    cells.push({
      kind: "day",
      date,
      day,
      occupied,
      total,
      pct,
      band: occupancyBand(pct),
      event: events.get(date) ?? null,
    });
  }

  while (cells.length % 7 !== 0) cells.push({ kind: "blank" });

  return {
    year,
    month,
    monthLabel: firstOfMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    weekdays: CALENDAR_WEEKDAYS,
    cells,
    legend: BAND_ORDER.map((band) => ({ band, label: BAND_LABEL[band] })),
    totalRooms: total,
  };
}

// ── Party hall screen ──────────────────────────────────────────────────────

const PARTY_HALL_STATUS_LABEL: Record<PartyHallStatus, string> = {
  enquiry: "New",
  quote_sent: "Quote sent",
  advance_paid: "Advance paid",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Pipeline order — cards sort by this, so what needs action floats up. */
const PARTY_HALL_STATUS_ORDER: PartyHallStatus[] = [
  "enquiry",
  "quote_sent",
  "advance_paid",
  "confirmed",
  "completed",
  "cancelled",
];

/**
 * Package tiers, per the design's reference card. Capacities ladder up to the
 * hall's 150-guest ceiling; Platinum is quoted per-event rather than listed.
 */
const PARTY_HALL_PACKAGES: PartyHallPackage[] = [
  { name: "Silver", capacity: "up to 60", price: "from ₹35k" },
  { name: "Gold", capacity: "up to 100", price: "from ₹60k" },
  { name: "Platinum", capacity: "up to 150", price: "tailored" },
];

/** Slot line for a card: "Full day" reads oddly as "Full day slot". */
function slotLine(slot: PartyHallEnquiry["slot"]): string {
  return slot === "full_day" ? "Full day" : `${SLOT_LABEL[slot]} slot`;
}

/** The status-dependent tail of a card's meta line. */
function metaNote(e: PartyHallEnquiry): string {
  switch (e.status) {
    case "enquiry":
      return "awaiting quote";
    case "quote_sent":
      return "quote sent";
    case "advance_paid":
      return `advance ${formatINRCompact(e.advancePaid)} paid`;
    case "confirmed":
      return "balance due on day";
    case "completed":
      return "settled";
    case "cancelled":
      return "cancelled";
  }
}

/** What the card's amount means, given where the event sits in the pipeline. */
function amountLabel(status: PartyHallStatus): string {
  switch (status) {
    case "enquiry":
      return "Est. quote";
    case "quote_sent":
      return "Quoted";
    case "completed":
      return "Collected";
    default:
      return "Total";
  }
}

/**
 * The one action that matters for this event. Only a new enquiry gets a primary
 * CTA — it is the sole state where the hall owes someone a response.
 */
function ctaFor(status: PartyHallStatus): { cta: string; ctaPrimary: boolean } {
  switch (status) {
    case "enquiry":
      return { cta: "Send quote", ctaPrimary: true };
    case "quote_sent":
      return { cta: "Send reminder", ctaPrimary: false };
    case "completed":
      return { cta: "Invoice", ctaPrimary: false };
    default:
      return { cta: "View details", ctaPrimary: false };
  }
}

function buildEventItem(e: PartyHallEnquiry): PartyHallEventItem {
  const day = e.date.slice(8, 10);
  const monthName = new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    timeZone: "UTC",
  });

  return {
    enquiry: e,
    day,
    mon: monthName,
    statusLabel: PARTY_HALL_STATUS_LABEL[e.status],
    meta: `${slotLine(e.slot)} · ${e.guests} guests · ${metaNote(e)}`,
    tags: [e.package, ...e.addOns],
    amountLabel: amountLabel(e.status),
    // An un-quoted enquiry has no number yet — say so rather than show "₹0".
    amount: e.amount > 0 ? formatINRCompact(e.amount) : "₹—",
    ...ctaFor(e.status),
  };
}

/** Days of a month the hall is held, from the live enquiry set. */
function bookedDaysIn(partyHall: PartyHallEnquiry[], year: number, month: number): Set<number> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const days = new Set<number>();
  for (const e of partyHall) {
    if (isUpcomingEvent(e) && e.date.startsWith(prefix)) days.add(Number(e.date.slice(8, 10)));
  }
  return days;
}

/**
 * The rail's availability mini-calendar. Same UTC/blank-padding approach as the
 * main calendar grid, but a day is simply booked or not — the hall is one room.
 */
function miniCalendar(
  partyHall: PartyHallEnquiry[],
  year: number,
  month: number,
): PartyHallMiniCalendar {
  const booked = bookedDaysIn(partyHall, year, month);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: PartyHallCalendarCell[] = [];
  for (let i = 0; i < firstOfMonth.getUTCDay(); i++) cells.push({ kind: "blank" });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      kind: "day",
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
      booked: booked.has(day),
    });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "blank" });

  return {
    monthLabel: firstOfMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    weekdays: CALENDAR_WEEKDAYS.map((d) => d.charAt(0)),
    cells,
  };
}

/**
 * Everything the admin Party Hall screen renders. Every figure is derived from
 * the enquiry set: the stat strip, the pill counts, each card's copy and the
 * rail's booked days. Nothing here is seeded, so the strip cannot claim three
 * new enquiries while the list shows two.
 *
 * `year`/`month` select the rail's availability month (default: the design's
 * August 2026 display month).
 */
export async function getPartyHallPageData(
  data: BookingData,
  year = 2026,
  month = 8,
): Promise<PartyHallPageData> {
  const events = [...data.partyHall].sort(
    (a, b) =>
      PARTY_HALL_STATUS_ORDER.indexOf(a.status) - PARTY_HALL_STATUS_ORDER.indexOf(b.status) ||
      a.date.localeCompare(b.date) ||
      // Two events can share a status and a date — the hall has slots. Without
      // this the pair would be ordered by row order, which Postgres does not have.
      a.id.localeCompare(b.id),
  );

  const newEnquiries = events.filter((e) => e.status === "enquiry").length;
  const confirmedUpcoming = events.filter(
    (e) => e.status === "confirmed" && isUpcomingEvent(e),
  ).length;

  // Money held against events still to come — a settled event's takings are
  // revenue already booked, not an advance the hall is sitting on.
  const advanceCollected = events
    .filter(isUpcomingEvent)
    .reduce((sum, e) => sum + e.advancePaid, 0);

  const stats: PartyHallStat[] = [
    { key: "newEnquiries", label: "New enquiries", value: String(newEnquiries) },
    { key: "confirmed", label: "Confirmed · upcoming", value: String(confirmedUpcoming) },
    {
      key: "advanceCollected",
      label: "Advance collected",
      value: formatINRCompact(advanceCollected),
    },
    {
      key: "nextEvent",
      label: "Next event",
      value: nextEventLabel(nextPartyHallEvent(data.partyHall)),
    },
  ];

  const pills: PartyHallPill[] = [
    { key: "all", label: "All", count: events.length },
    { key: "new", label: "New", count: newEnquiries },
    { key: "confirmed", label: "Confirmed", count: confirmedUpcoming },
  ];

  return {
    subtitle: `Up to 150 guests · tailored pricing · ${newEnquiries} enquiries need a quote`,
    stats,
    pills,
    events: events.map(buildEventItem),
    calendar: miniCalendar(data.partyHall, year, month),
    packages: PARTY_HALL_PACKAGES,
    addOnsLine: `Add-ons: catering ₹450/plate · decor · DJ. ${PARTY_HALL_ADVANCE_PCT}% advance to confirm.`,
  };
}

// ── Guests ──────────────────────────────────────────────────────────────────

/** A guest with two or more stays has come back — that is what "repeat" means. */
const REPEAT_STAYS = 2;

/**
 * Statuses of a stay that actually happened. A cancelled or no-show booking is
 * a stay the guest never took, and a future booking is one they have yet to
 * take — neither can be anybody's last stay.
 */
const BEGUN_STAY_STATUSES = new Set<BookingStatus>(["checked_in", "checked_out"]);

/** Avatar disc fill/ink, cycled by row position per the design's `av` list. */
const AVATAR_TOKENS: { bg: string; color: string }[] = [
  { bg: "#f0e7d3", color: "#a8863f" },
  { bg: "#e4eef7", color: "#3a6ea5" },
  { bg: "#eee7f7", color: "#7c5cbf" },
  { bg: "#e6efe6", color: "#5a8a5a" },
  { bg: "#f7e6e0", color: "#b4553f" },
];

/** "2026-07-14" → "14 Jul 2026". */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Everything the admin Guests screen renders. The directory joins each guest to
 * the live booking set, so "in-house" and "last stay" answer to the same rows
 * the Bookings screen lists, and the stat strip is counted off the directory it
 * sits above rather than seeded beside it.
 *
 * Note the booking set is a recent slice, not a full history: a guest whose
 * stays predate it shows a last stay of "—" despite a stay count above zero.
 * The design carries that same case (its Deepak Rao has one stay and no date).
 */
export async function getGuestsPageData(data: BookingData): Promise<GuestsPageData> {
  const inHouse = new Set<string>();
  const lastStayOn = new Map<string, string>();

  for (const b of data.bookings) {
    if (!BEGUN_STAY_STATUSES.has(b.status)) continue;
    if (b.status === "checked_in") inHouse.add(b.guestId);

    // The arrival date is when the guest stayed; for someone still in-house the
    // check-out is a date in the future, which no "last stay" should show.
    const previous = lastStayOn.get(b.guestId);
    if (!previous || b.checkIn > previous) lastStayOn.set(b.guestId, b.checkIn);
  }

  const guests: GuestListItem[] = [...data.guests]
    // Biggest spender first, then by name. `id` last, because two guests can
    // share a name and the avatar each gets is keyed off this position — so a
    // tie resolved by row order would reshuffle the badges from one query to
    // the next.
    .sort(
      (a, b) =>
        b.lifetimeValue - a.lifetimeValue ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .map((guest, i) => {
      const stayed = lastStayOn.get(guest.id);
      const avatar = AVATAR_TOKENS[i % AVATAR_TOKENS.length];
      return {
        guest,
        initials: initialsOf(guest.name),
        avatarBg: avatar.bg,
        avatarColor: avatar.color,
        lastStay: stayed ? longDate(stayed) : "—",
        inHouse: inHouse.has(guest.id),
      };
    });

  const repeatCount = guests.filter((g) => g.guest.stays >= REPEAT_STAYS).length;
  const topLtv = guests.reduce((max, g) => Math.max(max, g.guest.lifetimeValue), 0);

  const stats: GuestStat[] = [
    { key: "total", label: "Total guests", value: String(guests.length) },
    { key: "inHouse", label: "In-house now", value: String(inHouse.size) },
    { key: "repeat", label: "Repeat guests", value: String(repeatCount) },
    { key: "topLtv", label: "Lifetime value · top", value: formatINRCompact(topLtv) },
  ];

  return {
    subtitle: `${guests.length} profiles · ${repeatCount} repeat guests`,
    stats,
    guests,
  };
}

// ── Payments ────────────────────────────────────────────────────────────────

/**
 * How each booking's money moved, and when.
 *
 * This is the *only* thing the payments screen seeds. A booking already records
 * how much was collected (`collection`) — re-stating those amounts here would be
 * seeding the same figures twice, and the two copies would drift the first time
 * a booking was edited. What a booking doesn't record is the instrument and the
 * clock time, so that alone is seeded and every amount is derived from
 * `collection` below. A booking with no money in play needs no entry.
 */
const PAYMENT_SEED: Record<string, { method: PaymentMethod; at: string }> = {
  "KRC-20260714-001": { method: "upi", at: "2026-07-14T09:42:00+05:30" },
  "KRC-20260715-002": { method: "ota", at: "2026-07-14T09:10:00+05:30" },
  "KRC-20260715-003": { method: "upi", at: "2026-07-20T12:00:00+05:30" },
  "KRC-20260714-004": { method: "ota", at: "2026-07-09T11:20:00+05:30" },
  "KRC-20260711-005": { method: "cash", at: "2026-07-13T08:30:00+05:30" },
  "KRC-20260710-006": { method: "ota", at: "2026-07-10T10:15:00+05:30" },
  "KRC-20260714-007": { method: "card", at: "2026-07-16T12:00:00+05:30" },
  "KRC-20260712-010": { method: "net_banking", at: "2026-07-14T08:55:00+05:30" },
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  net_banking: "Net Banking",
  cash: "Cash",
  ota: "OTA",
};

const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  success: "Success",
  pending: "Pending",
  refunded: "Refunded",
};

/** Methods Razorpay processes for us. Cash is taken at the desk; OTA settles bank-to-bank. */
const RAZORPAY_METHODS = new Set<PaymentMethod>(["upi", "card", "net_banking"]);

/** Booking sources that are OTA channels, with their display name and disc letter. */
/**
 * The OTAs we sell through. `commissionPct` is the contracted rate and
 * `connected` is whether the channel manager is live.
 *
 * The rate is stated once, here. Payments does not read it — it derives each
 * channel's rate from the rupees that channel actually kept — so the two are
 * independent, and `settings.test.ts` holds them to the same number for every
 * channel that has sold a stay. That is what caught Goibibo: the design's
 * settings mock says 16%, but Goibibo's own money says 15%, and the money wins.
 */
const OTA_CHANNELS: Record<
  string,
  { name: string; abbr: string; commissionPct: number; connected: boolean }
> = {
  booking_com: { name: "Booking.com", abbr: "B", commissionPct: 15, connected: true },
  makemytrip: { name: "MakeMyTrip", abbr: "M", commissionPct: 18, connected: true },
  goibibo: { name: "Goibibo", abbr: "G", commissionPct: 15, connected: true },
  agoda: { name: "Agoda", abbr: "A", commissionPct: 17, connected: true },
  oyo: { name: "OYO", abbr: "O", commissionPct: 20, connected: false },
};

/** True for a booking sold through an OTA rather than direct/walk-in/phone. */
function isOtaSource(source: BookingSource): boolean {
  return source in OTA_CHANNELS;
}

/** A stay the guest never took. Money held against one is owed back, not earned. */
const VOID_STAY_STATUSES = new Set<BookingStatus>(["cancelled", "no_show"]);

/**
 * The transaction ledger, derived whole from the booking set.
 *
 * One booking yields at most one row, and which row is a question its
 * `collection` already answers:
 *   - a void stay (cancelled/no-show) holding money → that money is a *refund*,
 *     signed negative — it is owed back, not collected;
 *   - money the channel collected (`otaCollection`) → *pending*, because an OTA
 *     holds the guest's payment until it settles to us;
 *   - money in hand (`paidToHotel`) → *success*;
 *   - money still owed (`pending`) → *pending*, dated its due date.
 */
function transactionsFrom(
  bookings: Booking[],
  guestName: Map<string, string>,
): PaymentTransaction[] {
  const txns: PaymentTransaction[] = [];

  for (const b of bookings) {
    const seed = PAYMENT_SEED[b.id];
    if (!seed) continue;

    const collected = b.collection.paidToHotel + b.collection.otaCollection;
    const isVoid = VOID_STAY_STATUSES.has(b.status);
    const [amount, status]: [number, TransactionStatus] = isVoid
      ? [-collected, "refunded"]
      : b.collection.otaCollection > 0
        ? [b.collection.otaCollection, "pending"]
        : b.collection.paidToHotel > 0
          ? [b.collection.paidToHotel, "success"]
          : [b.collection.pending, "pending"];

    if (amount === 0) continue;

    txns.push({
      id: `${b.id}-${status}`,
      bookingId: b.id,
      guestName: guestName.get(b.guestId) ?? "—",
      method: seed.method,
      at: seed.at,
      amount,
      status,
    });
  }

  // Newest first, and `id` breaks the tie: two payments can share a timestamp,
  // and `sort` is stable, so without this the list would fall back on the order
  // the rows happened to arrive in — which, from Postgres, is no order at all.
  return txns.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}

/** "9:42 am" for a movement today, "Yesterday", else "20 Jul". */
function transactionTime(at: string, today: string): string {
  const when = new Date(at);
  const day = at.slice(0, 10);

  if (day === today) {
    return when
      .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
      .toLowerCase();
  }
  const dayBefore = new Date(`${today}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  if (day === dayBefore.toISOString().slice(0, 10)) return "Yesterday";

  return when.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** Signed for display: money out reads "−₹3,000", money in "+₹5,040". */
function signedAmount(amount: number): string {
  return `${amount < 0 ? "−" : "+"}${formatINR(Math.abs(amount))}`;
}

/**
 * What each OTA channel is holding, derived from the bookings it sold. The
 * commission *rate* falls out of the money (`otaCommission / otaCollection`)
 * rather than being seeded beside it, so a channel's percentage can never
 * contradict the rupees it sits next to.
 *
 * `amount` is gross — what the channel took from the guest, before it keeps its
 * cut — which is the same figure the Bookings screen calls OTA receivables, and
 * what the monthly rollup then nets the commission out of.
 */
function otaSettlements(bookings: Booking[]): OtaSettlement[] {
  const byChannel = new Map<BookingSource, { count: number; amount: number; commission: number }>();

  for (const b of bookings) {
    if (!isOtaSource(b.source) || VOID_STAY_STATUSES.has(b.status)) continue;
    if (b.collection.otaCollection === 0) continue;

    const acc = byChannel.get(b.source) ?? { count: 0, amount: 0, commission: 0 };
    acc.count += 1;
    acc.amount += b.collection.otaCollection;
    acc.commission += b.collection.otaCommission;
    byChannel.set(b.source, acc);
  }

  return (
    [...byChannel.entries()]
      .map(([source, acc]) => ({
        source,
        name: OTA_CHANNELS[source].name,
        abbr: OTA_CHANNELS[source].abbr,
        count: acc.count,
        commissionPct: Math.round((acc.commission / acc.amount) * 100),
        amount: acc.amount,
      }))
      // Biggest first; the channel name breaks the tie, since two OTAs owing the
      // same amount must not be ordered by whatever the query returned.
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  );
}

/**
 * The month's takings, netted. Gross counts what stays actually billed — a
 * cancelled booking and a no-show earned nothing, so neither belongs in it —
 * and the OTAs' commission and any refunds come back off.
 */
function monthlyRollup(bookings: Booking[], today: string): PaymentsMonthlyRollup {
  const month = today.slice(0, 7);
  const inMonth = bookings.filter((b) => b.checkIn.startsWith(month));

  const gross = inMonth
    .filter((b) => !VOID_STAY_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.totalBill, 0);
  const commission = inMonth.reduce((sum, b) => sum + b.collection.otaCommission, 0);
  const refunds = inMonth
    .filter((b) => VOID_STAY_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.collection.paidToHotel + b.collection.otaCollection, 0);

  return {
    label: new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    gross,
    commission,
    refunds,
    net: gross - commission - refunds,
  };
}

/**
 * Everything the admin Payments screen renders. The screen is a view over the
 * booking set: every rupee on it is derived from `Booking.collection`, so it
 * cannot disagree with the Bookings screen about what was collected, what an
 * OTA owes, or what a guest still has to pay.
 *
 * `today` anchors the "collected today" KPI and the rollup's month; it defaults
 * to the design's display date so the screen reads as designed.
 */
export async function getPaymentsPageData(
  data: BookingData,
  today = "2026-07-14",
): Promise<PaymentsPageData> {
  const guestName = new Map(data.guests.map((g) => [g.id, g.name]));
  const txns = transactionsFrom(data.bookings, guestName);

  const collectedToday = txns.filter((t) => t.status === "success" && t.at.startsWith(today));
  const razorpaySettled = txns.filter(
    (t) => t.status === "success" && RAZORPAY_METHODS.has(t.method),
  );
  const ota = otaSettlements(data.bookings);
  const pendingFromGuests = txns.filter((t) => t.status === "pending" && t.method !== "ota");

  const sum = (list: PaymentTransaction[]) => list.reduce((total, t) => total + t.amount, 0);
  const otaTotal = ota.reduce((total, o) => total + o.amount, 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const kpis: PaymentsKpi[] = [
    {
      key: "collectedToday",
      label: "Collected · today",
      value: formatINR(sum(collectedToday)),
      note: plural(collectedToday.length, "transaction"),
    },
    {
      key: "razorpaySettled",
      label: "Razorpay · settled",
      value: formatINR(sum(razorpaySettled)),
      note: "to bank T+2",
    },
    {
      key: "otaReceivables",
      label: "OTA receivables",
      value: formatINR(otaTotal),
      note: `${plural(ota.length, "channel")} pending`,
    },
    {
      key: "pendingFromGuests",
      label: "Pending from guests",
      value: formatINR(sum(pendingFromGuests)),
      note: plural(pendingFromGuests.length, "booking"),
    },
  ];

  const transactions: PaymentsTxnItem[] = txns.map((txn) => ({
    txn,
    methodLabel: METHOD_LABEL[txn.method],
    amount: signedAmount(txn.amount),
    time: transactionTime(txn.at, today),
    statusLabel: TRANSACTION_STATUS_LABEL[txn.status],
  }));

  return {
    today,
    subtitle: `${longDate(today)} · Razorpay + OTA settlements`,
    kpis,
    transactions,
    ota,
    rollup: monthlyRollup(data.bookings, today),
  };
}

// ── Reports ─────────────────────────────────────────────────────────────────

/** Rooms available to sell on any given night — the denominator under RevPAR. */
const SELLABLE_ROOMS = ROOM_UNITS.length;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ISO date `n` days before/after `date`, without tripping over local timezones. */
function shiftDate(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * One night of one stay — the atom every report figure is counted from.
 *
 * A booking's bill covers its whole stay, so charging all of it to the check-in
 * date would credit a three-night stay's revenue to a single day and leave the
 * other two looking empty. Spreading it per night is both truer to how the room
 * earned the money and the only basis on which occupancy, ADR and RevPAR agree:
 * all three then divide the same nights by the same days.
 */
interface NightFact {
  /** The night itself, as an ISO date. */
  date: string;
  bookingId: string;
  source: BookingSource;
  roomType: RoomType;
  mealPlan: MealPlan;
  /** This night's share of the total bill, tax and extras included. */
  bill: number;
  /** This night's share of the room charge alone — what ADR is measured on. */
  roomRev: number;
}

/**
 * Every night the hotel actually sold, exploded out of the booking set. A
 * cancelled booking and a no-show sold nothing, so neither contributes nights:
 * the same rule the payments rollup applies to gross.
 */
function nightsFrom(bookings: Booking[]): NightFact[] {
  const nights: NightFact[] = [];

  for (const b of bookings) {
    if (VOID_STAY_STATUSES.has(b.status) || b.urn <= 0) continue;

    for (let i = 0; i < b.urn; i++) {
      nights.push({
        date: shiftDate(b.checkIn, i),
        bookingId: b.id,
        source: b.source,
        roomType: b.roomType,
        mealPlan: b.mealPlan,
        bill: b.totalBill / b.urn,
        roomRev: b.revenue.room / b.urn,
      });
    }
  }

  return nights;
}

/**
 * What the party hall earned, by the date it was held. Only a *completed* event
 * has earned anything — a confirmed booking is a promise, and the money against
 * it is an advance, which the party-hall screen already reports separately.
 */
function partyHallRevenueIn(partyHall: PartyHallEnquiry[], start: string, end: string): number {
  return partyHall
    .filter((e) => e.status === "completed" && e.date >= start && e.date <= end)
    .reduce((sum, e) => sum + e.amount, 0);
}

/** A trailing window: `days` long, ending on (and including) `end`. */
interface Window {
  start: string;
  end: string;
  days: number;
}

function daysBetween(start: string, end: string): number {
  return (
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY) + 1
  );
}

/**
 * The window a range covers, ending today.
 *
 * The year is aligned to calendar months rather than counted back 365 days, so
 * that its twelve monthly bars tile it exactly. A 365-day window would start
 * mid-month and leave that month's first half inside the total but outside
 * every bar — the total and the chart beneath it would quietly disagree.
 */
function windowFor(key: RevenuePeriodKey, today: string): Window {
  if (key === "12m") {
    const anchor = new Date(`${today}T00:00:00Z`);
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 11, 1))
      .toISOString()
      .slice(0, 10);
    return { start, end: today, days: daysBetween(start, today) };
  }

  const days = key === "7d" ? 7 : 30;
  return { start: shiftDate(today, -(days - 1)), end: today, days };
}

/** The window of equal length sitting immediately before `w`. */
function previousWindow(w: Window): Window {
  return { start: shiftDate(w.start, -w.days), end: shiftDate(w.start, -1), days: w.days };
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function inWindow(date: string, w: Window): boolean {
  return inRange(date, w.start, w.end);
}

/** Total earned in a window: what the rooms billed, plus what the hall billed. */
function revenueIn(nights: NightFact[], partyHall: PartyHallEnquiry[], w: Window): number {
  const rooms = nights.filter((n) => inWindow(n.date, w)).reduce((sum, n) => sum + n.bill, 0);
  return rooms + partyHallRevenueIn(partyHall, w.start, w.end);
}

/**
 * Percentage change against the preceding window, e.g. "▲ 12.4%".
 *
 * Returns null when the previous window was empty. Growth from zero has no
 * percentage — it is division by zero — and stating one anyway would be
 * inventing a trend the data cannot support.
 */
function deltaAgainst(current: number, previous: number): { text: string; up: boolean } | null {
  if (previous === 0) return null;

  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return { text: `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`, up };
}

/**
 * The window's bars, split direct vs OTA.
 *
 * Each range buckets at the grain it can actually show: 7 daily bars for a
 * week, five 6-day bars for a month (30 divides evenly, so no bar covers a
 * short period and reads artificially low), and 12 monthly bars for a year.
 */
function barsFor(
  nights: NightFact[],
  partyHall: PartyHallEnquiry[],
  key: RevenuePeriodKey,
  today: string,
): RevenueBar[] {
  const w = windowFor(key, today);
  const buckets: { label: string; start: string; end: string }[] = [];

  if (key === "12m") {
    const anchor = new Date(`${today}T00:00:00Z`);
    for (let i = 11; i >= 0; i--) {
      const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
      buckets.push({
        label: first.toLocaleDateString("en-IN", { month: "narrow", timeZone: "UTC" }),
        start: first.toISOString().slice(0, 10),
        end: last.toISOString().slice(0, 10),
      });
    }
  } else {
    const span = key === "7d" ? 1 : 6;
    const count = key === "7d" ? 7 : 5;
    for (let i = count - 1; i >= 0; i--) {
      const end = shiftDate(today, -i * span);
      const start = shiftDate(end, -(span - 1));
      buckets.push({
        label:
          key === "7d"
            ? new Date(`${start}T00:00:00Z`).toLocaleDateString("en-IN", {
                weekday: "short",
                timeZone: "UTC",
              })
            : `W${count - i}`,
        start,
        end,
      });
    }
  }

  // The current month runs past today, and the year's first month may start
  // before the window opens. Either would let a bar count nights the headline
  // above it doesn't, so every bucket is clipped back to the window itself.
  return buckets.map(({ label, start: bucketStart, end: bucketEnd }) => {
    const start = bucketStart < w.start ? w.start : bucketStart;
    const end = bucketEnd > w.end ? w.end : bucketEnd;
    const rooms = nights.filter((n) => inRange(n.date, start, end));
    const sum = (list: NightFact[]) => list.reduce((total, n) => total + n.bill, 0);

    // The hall is sold by us, never by a channel, so it lands on the direct side.
    const direct =
      sum(rooms.filter((n) => !isOtaSource(n.source))) + partyHallRevenueIn(partyHall, start, end);
    const ota = sum(rooms.filter((n) => isOtaSource(n.source)));
    return {
      label,
      direct: Math.round(direct),
      ota: Math.round(ota),
      total: Math.round(direct + ota),
    };
  });
}

/** How the design groups channels: the three it names, and everything else. */
const SOURCE_GROUPS: { key: string; label: string; match: (s: BookingSource) => boolean }[] = [
  { key: "direct", label: "Direct (site/phone)", match: (s) => !isOtaSource(s) },
  { key: "booking_com", label: "Booking.com", match: (s) => s === "booking_com" },
  { key: "makemytrip", label: "MakeMyTrip", match: (s) => s === "makemytrip" },
  {
    key: "others",
    label: "Others",
    match: (s) => isOtaSource(s) && s !== "booking_com" && s !== "makemytrip",
  },
];

/**
 * Share of the window's bookings by how they were sold.
 *
 * Percentages are apportioned by largest remainder so they total exactly 100 —
 * rounding each share independently would let a donut add up to 99% or 101%.
 */
function sourcesFor(nights: NightFact[], w: Window): SourceSlice[] {
  const sold = new Map<string, BookingSource>();
  for (const n of nights) {
    if (inWindow(n.date, w)) sold.set(n.bookingId, n.source);
  }
  const total = sold.size;
  if (total === 0) return [];

  const counted = SOURCE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    count: [...sold.values()].filter(g.match).length,
  })).filter((g) => g.count > 0);

  const exact = counted.map((g) => (g.count / total) * 100);
  const pcts = exact.map(Math.floor);
  let short = 100 - pcts.reduce((sum, p) => sum + p, 0);
  const byRemainder = exact
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem);
  for (let i = 0; short > 0; i++, short--) pcts[byRemainder[i % byRemainder.length].i] += 1;

  return counted.map((g, i) => ({ ...g, pct: pcts[i] })).sort((a, b) => b.count - a.count);
}

const MEAL_PLAN_NOTE: Record<MealPlan, string> = {
  EP: "room only",
  CP: "breakfast",
  MAP: "half board",
  AP: "full board",
};

/**
 * Share of room-nights sold on each plan. All four always show: a plan nobody
 * took is a fact about the mix, not a row to hide.
 */
function mealPlansFor(nights: NightFact[], w: Window): MealPlanShare[] {
  const inWin = nights.filter((n) => inWindow(n.date, w));
  const plans: MealPlan[] = ["EP", "CP", "MAP", "AP"];

  return plans.map((plan) => ({
    plan,
    note: MEAL_PLAN_NOTE[plan],
    pct:
      inWin.length === 0
        ? 0
        : Math.round((inWin.filter((n) => n.mealPlan === plan).length / inWin.length) * 100),
  }));
}

/** Each room type's takings and occupancy, with the party hall alongside. */
function roomTypesFor(
  nights: NightFact[],
  partyHall: PartyHallEnquiry[],
  w: Window,
): RoomTypePerf[] {
  const inWin = nights.filter((n) => inWindow(n.date, w));

  const rows: RoomTypePerf[] = ROOM_TYPES.map((rt) => {
    const mine = inWin.filter((n) => n.roomType === rt.type);
    return {
      key: rt.type,
      name: rt.name,
      revenue: Math.round(mine.reduce((sum, n) => sum + n.bill, 0)),
      revenueLabel: "",
      occPct: Math.round((mine.length / (rt.count * w.days)) * 100),
      barPct: 0,
    };
  });

  const hall = partyHallRevenueIn(partyHall, w.start, w.end);
  rows.push({
    key: "party_hall",
    name: "Party Hall",
    revenue: hall,
    revenueLabel: "",
    // The hall is sold by the slot, not by the night, so a nightly occupancy
    // rate would be measuring it against a denominator it doesn't have.
    occPct: null,
    barPct: 0,
  });

  const best = Math.max(...rows.map((r) => r.revenue), 0);
  return rows
    .map((r) => ({
      ...r,
      revenueLabel: formatINRCompact(r.revenue),
      barPct: best === 0 ? 0 : Math.round((r.revenue / best) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

const RANGE_LABEL: Record<RevenuePeriodKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "12m": "last 12 months",
};

const RANGE_SWITCH: Record<RevenuePeriodKey, string> = {
  "7d": "7D",
  "30d": "30D",
  "12m": "12M",
};

const RANGE_KEYS: RevenuePeriodKey[] = ["7d", "30d", "12m"];

/**
 * The four headline measures for one window, each derived from the same nights.
 *
 * ADR is the room charge per night *sold*; RevPAR the room charge per night
 * *available*. Because both read the same numerator and occupancy divides the
 * same two denominators, RevPAR = ADR × occupancy holds by construction rather
 * than by three figures happening to agree.
 */
function kpisFor(
  nights: NightFact[],
  partyHall: PartyHallEnquiry[],
  w: Window,
  key: RevenuePeriodKey,
): ReportsKpi[] {
  const inWin = nights.filter((n) => inWindow(n.date, w));
  const roomRev = inWin.reduce((sum, n) => sum + n.roomRev, 0);
  const sold = inWin.length;
  const available = SELLABLE_ROOMS * w.days;

  const revenue = revenueIn(nights, partyHall, w);
  const prev = previousWindow(w);
  const occPct = (sold / available) * 100;
  const prevIn = nights.filter((n) => inWindow(n.date, prev));

  const build = (
    k: ReportsKpi["key"],
    label: string,
    value: string,
    d: { text: string; up: boolean } | null,
  ): ReportsKpi => ({ key: k, label, value, delta: d?.text ?? null, deltaUp: d?.up ?? null });

  return [
    build(
      "revenue",
      `Revenue · ${RANGE_LABEL[key]}`,
      formatINRCompact(revenue),
      deltaAgainst(revenue, revenueIn(nights, partyHall, prev)),
    ),
    build(
      "occupancy",
      "Occupancy rate",
      `${Math.round(occPct)}%`,
      deltaAgainst(sold, prevIn.length),
    ),
    build(
      "adr",
      "ADR (avg daily rate)",
      formatINR(sold === 0 ? 0 : roomRev / sold),
      deltaAgainst(
        sold === 0 ? 0 : roomRev / sold,
        prevIn.length === 0 ? 0 : prevIn.reduce((sum, n) => sum + n.roomRev, 0) / prevIn.length,
      ),
    ),
    build(
      "revpar",
      "RevPAR",
      formatINR(roomRev / available),
      deltaAgainst(
        roomRev / available,
        prevIn.reduce((sum, n) => sum + n.roomRev, 0) / (SELLABLE_ROOMS * prev.days),
      ),
    ),
  ];
}

/**
 * Everything the admin Reports screen renders, for all three ranges at once so
 * the toggle switches without a round-trip — the same shape the dashboard's
 * revenue card uses.
 *
 * Nothing here is seeded. Every figure is counted off the nights the booking
 * set actually sold and the party-hall events it actually held, which is why
 * these numbers are smaller than the design's: the mock draws a full hotel, and
 * our seed holds ten bookings in one week of July.
 */
export async function getReportsPageData(
  data: BookingData,
  today = "2026-07-14",
): Promise<ReportsPageData> {
  const nights = nightsFrom(data.bookings);

  const ranges: ReportsRange[] = RANGE_KEYS.map((key) => {
    const w = windowFor(key, today);
    return {
      key,
      switchLabel: RANGE_SWITCH[key],
      rangeLabel: RANGE_LABEL[key],
      kpis: kpisFor(nights, data.partyHall, w, key),
      bars: barsFor(nights, data.partyHall, key, today),
      sources: sourcesFor(nights, w),
      roomTypes: roomTypesFor(nights, data.partyHall, w),
      mealPlans: mealPlansFor(nights, w),
    };
  });

  return {
    today,
    subtitle: "Performance & revenue analytics",
    ranges,
  };
}

/**
 * The dashboard's revenue card, over the same windows and the same engine the
 * Reports screen reads. These figures used to be seeded strings beside seeded
 * bar heights, which meant the dashboard and Reports could answer "revenue,
 * last 30 days" differently — and did. Deriving both from one place is what
 * stops that.
 */
function revenuePeriods(data: BookingData, today: string): RevenuePeriod[] {
  const nights = nightsFrom(data.bookings);
  const switchLabel: Record<RevenuePeriodKey, string> = {
    "7d": "7 days",
    "30d": "30 days",
    "12m": "12 months",
  };

  return RANGE_KEYS.map((key) => {
    const w = windowFor(key, today);
    const total = revenueIn(nights, data.partyHall, w);
    const delta = deltaAgainst(total, revenueIn(nights, data.partyHall, previousWindow(w)));

    return {
      key,
      switchLabel: switchLabel[key],
      rangeLabel: rangeLabelFor(key, w),
      total: formatINRCompact(total),
      delta: delta && `${delta.text} vs prev`,
      bars: barsFor(nights, data.partyHall, key, today).map((b) => ({
        label: b.label,
        value: b.total,
      })),
    };
  });
}

/** "Wed 8 Jul – Tue 14 Jul" for a week; a plainer line for the longer windows. */
function rangeLabelFor(key: RevenuePeriodKey, w: Window): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

  if (key === "7d") {
    const short: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
    return `${fmt(w.start, short)} – ${fmt(w.end, short)}`;
  }
  if (key === "12m") {
    const my: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
    return `${fmt(w.start, my)} – ${fmt(w.end, my)}`;
  }
  return "Last 30 days";
}

// ── Settings ────────────────────────────────────────────────────────────────

/** The property itself. Nothing derives from this; it is the profile guests see. */
const PROPERTY: PropertyProfile = {
  name: "The Divine KRC",
  phone: "+91 87073 68307",
  whatsapp: "+91 87073 68307",
  checkInTime: "2:00 PM",
  checkOutTime: "11:00 AM",
};

/**
 * Who can log in. The Owner row is the account in `lib/auth.ts` — the console's
 * real (mock) login — so the list cannot show a team that excludes the person
 * using it. The rest are staff. Kept here rather than imported from `auth.ts`,
 * which pulls in server-only session code; the DB swap unifies the two.
 */
/**
 * Who can log in, read off the one roster in `lib/team.ts`. PR #11 seeded this
 * list here and noted the duplication with `auth.ts`; PR #12 removed it, because
 * once an invite can add someone, a roster that Settings keeps privately would
 * be a roster that goes stale the first time anyone joins.
 *
 * Only accepted members appear. Someone invited and still deciding is on the
 * Team & access screen under their invite, not on the list of people with keys.
 */
function activeTeam(): TeamMember[] {
  return team
    .filter(isActive)
    .map((m) => ({ name: m.name, email: m.email, role: m.role, initials: initialsOf(m.name) }));
}

const PAYMENT_TOGGLES: ToggleSetting[] = [
  {
    key: "payAtHotel",
    label: "Pay at hotel",
    desc: "Reserve now, settle at front desk on arrival",
    on: true,
  },
  {
    key: "prepayOtaBlocked",
    label: "Require full prepayment for OTA-blocked dates",
    desc: "Force online payment on peak dates",
    on: false,
  },
];

const NOTIFICATION_TOGGLES: ToggleSetting[] = [
  {
    key: "newBooking",
    label: "New booking alerts",
    desc: "Email + WhatsApp on every new reservation",
    on: true,
  },
  {
    key: "paymentReceived",
    label: "Payment received",
    desc: "Notify when Razorpay confirms a payment",
    on: true,
  },
  {
    key: "partyHallEnquiry",
    label: "Party hall enquiries",
    desc: "Alert for new event enquiries",
    on: true,
  },
];

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "property", label: "Property profile" },
  { id: "pricing", label: "Rooms & pricing" },
  { id: "payments", label: "Payment integrations" },
  { id: "channels", label: "OTA channels" },
  { id: "team", label: "Team & access" },
  { id: "notifications", label: "Notifications" },
];

/** Tariffs read straight off the inventory, so a rate shown here is the rate charged. */
function tariffSettings(): RoomTariff[] {
  return ROOM_TYPES.map((rt) => ({
    type: rt.type,
    name: rt.name,
    inventoryLabel: `${rt.count} rooms · ${rt.areaSqm} m²`,
    rate: rt.pricePerNight.toLocaleString("en-IN"),
  }));
}

/** The four rates on top of the tariff, each quoted from the constant that applies it. */
function chargeSettings(): ChargeSetting[] {
  return [
    { key: "earlyCheckIn", label: "Early check-in fee", value: formatINR(EARLY_CHECKIN_FEE) },
    { key: "lateCheckOut", label: "Late check-out fee", value: formatINR(LATE_CHECKOUT_FEE) },
    { key: "gst", label: "GST rate", value: `${GST_PCT}%` },
    { key: "partyHallAdvance", label: "Party hall advance", value: `${PARTY_HALL_ADVANCE_PCT}%` },
  ];
}

function paymentSettings(): PaymentSettings {
  return {
    gateway: {
      name: "Razorpay",
      connected: true,
      methodsLine: "UPI · Cards · Net Banking · Wallets · key ...a4F9",
    },
    toggles: PAYMENT_TOGGLES,
  };
}

/**
 * The channel list, in the order the money ranks them: the OTAs that have sold
 * the most stays first, then the ones yet to earn. A channel's booking count is
 * counted off the live set, so "not connected" beside a channel that has been
 * selling would be visible rather than plausible.
 */
function channelSettings(bookings: Booking[]): ChannelSetting[] {
  const sold = new Map<BookingSource, number>();
  for (const b of bookings) {
    if (!isOtaSource(b.source) || VOID_STAY_STATUSES.has(b.status)) continue;
    sold.set(b.source, (sold.get(b.source) ?? 0) + 1);
  }

  return Object.entries(OTA_CHANNELS)
    .map(([key, ch]) => ({
      key: key as BookingSource,
      name: ch.name,
      abbr: ch.abbr,
      commissionPct: ch.commissionPct,
      connected: ch.connected,
      bookings: sold.get(key as BookingSource) ?? 0,
    }))
    .sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name));
}

export async function getSettingsPageData(data: BookingData): Promise<SettingsPageData> {
  const bookings = data.bookings;

  return {
    sections: SETTINGS_SECTIONS,
    property: PROPERTY,
    pricing: { tariffs: tariffSettings(), charges: chargeSettings() },
    payments: paymentSettings(),
    channels: channelSettings(bookings),
    team: activeTeam(),
    notifications: NOTIFICATION_TOGGLES,
  };
}
