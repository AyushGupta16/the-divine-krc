// Data access layer for the booking system.
//
// This is an in-memory mock returning seed data that mirrors the design files.
// It is intentionally the single choke point every route/loader reads through,
// so swapping to a real database later is a one-file change.

import type {
  Booking,
  BookingsPageData,
  BookingStatus,
  CalendarCell,
  CalendarPageData,
  DashboardData,
  Guest,
  OccupancyBand,
  PartyHallEnquiry,
  RoomFloor,
  RoomsLegendItem,
  RoomsPageData,
  RoomStatus,
  RoomTile,
  RoomType,
  RoomTypeCard,
} from "@/types/booking";
import {
  computeTotalBill,
  computeTotalCollected,
  formatINR,
} from "@/lib/booking-math";

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

const GUESTS: Guest[] = [
  {
    id: "G-001",
    name: "Aarav Mehta",
    phone: "+91 98110 22334",
    email: "aarav.mehta@example.com",
    city: "New Delhi",
    stays: 6,
    lifetimeValue: 48200,
    tier: "gold",
  },
  {
    id: "G-002",
    name: "Priya Nair",
    phone: "+91 99870 55212",
    email: "priya.nair@example.com",
    city: "Bengaluru",
    stays: 3,
    lifetimeValue: 21400,
    tier: "silver",
  },
  {
    id: "G-003",
    name: "Rohan Verma",
    phone: "+91 90000 78451",
    email: "rohan.verma@example.com",
    city: "Greater Noida",
    stays: 1,
    lifetimeValue: 3400,
    tier: "new",
  },
  {
    id: "G-004",
    name: "Meera Krishnan",
    phone: "+91 98400 11223",
    email: "meera.krishnan@example.com",
    city: "Chennai",
    stays: 4,
    lifetimeValue: 32600,
    tier: "gold",
  },
  {
    id: "G-005",
    name: "Rohit Kapoor",
    phone: "+91 94140 66789",
    email: "rohit.kapoor@example.com",
    city: "Jaipur",
    stays: 2,
    lifetimeValue: 11800,
    tier: "silver",
  },
  {
    id: "G-006",
    name: "Fatima Sheikh",
    phone: "+91 90050 44120",
    email: "fatima.sheikh@example.com",
    city: "Lucknow",
    stays: 2,
    lifetimeValue: 9600,
    tier: "silver",
  },
  {
    id: "G-007",
    name: "Deepak Rao",
    phone: "+91 99490 33087",
    email: "deepak.rao@example.com",
    city: "Hyderabad",
    stays: 1,
    lifetimeValue: 3400,
    tier: "new",
  },
  {
    id: "G-008",
    name: "Karan Malhotra",
    phone: "+91 98150 90011",
    email: "karan.malhotra@example.com",
    city: "Chandigarh",
    stays: 1,
    lifetimeValue: 0,
    tier: "new",
  },
  {
    id: "G-009",
    name: "Vikram Nair",
    phone: "+91 90720 55340",
    email: "vikram.nair@example.com",
    city: "Kochi",
    stays: 1,
    lifetimeValue: 0,
    tier: "new",
  },
  {
    id: "G-010",
    name: "Sunita Verma",
    phone: "+91 98730 21980",
    email: "sunita.verma@example.com",
    city: "New Delhi",
    stays: 3,
    lifetimeValue: 18900,
    tier: "silver",
  },
];

function withTotal(b: Omit<Booking, "totalBill">): Booking {
  return { ...b, totalBill: computeTotalBill(b.revenue) };
}

const BOOKINGS: Booking[] = [
  withTotal({
    id: "KRC-20260714-001",
    guestId: "G-001",
    roomNo: "102",
    roomType: "deluxe",
    checkIn: "2026-07-14",
    checkOut: "2026-07-17",
    urn: 3,
    source: "direct",
    mealPlan: "CP",
    revenue: {
      room: 4500,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 0,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 5040,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "checked_in",
    createdAt: "2026-07-10T09:12:00.000Z",
  }),
  withTotal({
    id: "KRC-20260715-002",
    guestId: "G-002",
    roomNo: "205",
    roomType: "deluxe_balcony",
    checkIn: "2026-07-15",
    checkOut: "2026-07-16",
    urn: 1,
    source: "booking_com",
    mealPlan: "EP",
    revenue: {
      room: 1700,
      earlyCheckIn: 0,
      lateCheckOut: 300,
      other: 0,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 0,
      otaCollection: 2240,
      otaCommission: 336,
      complimentary: 0,
      pending: 0,
    },
    status: "confirmed",
    createdAt: "2026-07-12T14:40:00.000Z",
  }),
  withTotal({
    id: "KRC-20260715-003",
    guestId: "G-003",
    roomNo: null,
    roomType: "deluxe",
    checkIn: "2026-07-20",
    checkOut: "2026-07-22",
    urn: 2,
    source: "phone",
    mealPlan: "MAP",
    revenue: {
      room: 3000,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 0,
      discount: 200,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 3136,
    },
    status: "pending_payment",
    createdAt: "2026-07-15T08:05:00.000Z",
  }),
  withTotal({
    id: "KRC-20260714-004",
    guestId: "G-004",
    roomNo: "112",
    roomType: "deluxe",
    checkIn: "2026-07-13",
    checkOut: "2026-07-16",
    urn: 3,
    source: "booking_com",
    mealPlan: "MAP",
    revenue: {
      room: 4500,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 600,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 0,
      otaCollection: 5712,
      otaCommission: 856,
      complimentary: 0,
      pending: 0,
    },
    status: "checked_in",
    createdAt: "2026-07-09T11:20:00.000Z",
  }),
  withTotal({
    id: "KRC-20260711-005",
    guestId: "G-005",
    roomNo: "108",
    roomType: "deluxe",
    checkIn: "2026-07-11",
    checkOut: "2026-07-13",
    urn: 2,
    source: "walk_in",
    mealPlan: "EP",
    revenue: {
      room: 3000,
      earlyCheckIn: 0,
      lateCheckOut: 500,
      other: 0,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 3920,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "checked_out",
    createdAt: "2026-07-08T16:30:00.000Z",
  }),
  withTotal({
    id: "KRC-20260710-006",
    guestId: "G-006",
    roomNo: "207",
    roomType: "deluxe_balcony",
    checkIn: "2026-07-10",
    checkOut: "2026-07-12",
    urn: 2,
    source: "goibibo",
    mealPlan: "CP",
    revenue: {
      room: 3400,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 300,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 0,
      otaCollection: 4144,
      otaCommission: 622,
      complimentary: 0,
      pending: 0,
    },
    status: "checked_out",
    createdAt: "2026-07-06T10:15:00.000Z",
  }),
  withTotal({
    id: "KRC-20260714-007",
    guestId: "G-007",
    roomNo: "201",
    roomType: "deluxe_balcony",
    checkIn: "2026-07-16",
    checkOut: "2026-07-18",
    urn: 2,
    source: "direct",
    mealPlan: "EP",
    revenue: {
      room: 3400,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 0,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 3808,
    },
    status: "confirmed",
    createdAt: "2026-07-14T13:00:00.000Z",
  }),
  withTotal({
    id: "KRC-20260715-008",
    guestId: "G-008",
    roomNo: null,
    roomType: "deluxe",
    checkIn: "2026-07-15",
    checkOut: "2026-07-17",
    urn: 2,
    source: "agoda",
    mealPlan: "EP",
    revenue: {
      room: 3000,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 0,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "cancelled",
    createdAt: "2026-07-13T19:45:00.000Z",
  }),
  withTotal({
    id: "KRC-20260713-009",
    guestId: "G-009",
    roomNo: null,
    roomType: "deluxe",
    checkIn: "2026-07-13",
    checkOut: "2026-07-14",
    urn: 1,
    source: "direct",
    mealPlan: "EP",
    revenue: {
      room: 1500,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 0,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 0,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "no_show",
    createdAt: "2026-07-12T21:10:00.000Z",
  }),
  withTotal({
    id: "KRC-20260712-010",
    guestId: "G-010",
    roomNo: "104",
    roomType: "deluxe",
    checkIn: "2026-07-12",
    checkOut: "2026-07-15",
    urn: 3,
    source: "phone",
    mealPlan: "CP",
    revenue: {
      room: 4500,
      earlyCheckIn: 400,
      lateCheckOut: 0,
      other: 150,
      discount: 0,
      taxPct: 12,
    },
    collection: {
      paidToHotel: 5656,
      otaCollection: 0,
      otaCommission: 0,
      complimentary: 0,
      pending: 0,
    },
    status: "checked_out",
    createdAt: "2026-07-05T09:40:00.000Z",
  }),
];

const PARTY_HALL_ENQUIRIES: PartyHallEnquiry[] = [
  {
    id: "PH-20260801-001",
    title: "Sharma Family — Engagement",
    date: "2026-08-01",
    slot: "evening",
    guests: 120,
    package: "Silver Banquet",
    addOns: ["DJ", "Floral Stage"],
    status: "confirmed",
    amount: 85000,
    advancePaid: 21250,
  },
  {
    id: "PH-20260809-002",
    title: "Corporate Offsite — Nexus Labs",
    date: "2026-08-09",
    slot: "full_day",
    guests: 80,
    package: "Conference Full-Day",
    addOns: ["Projector", "Lunch Buffet"],
    status: "enquiry",
    amount: 62000,
    advancePaid: 0,
  },
];

// Simulated async so callers/loaders already await — real DB swap keeps signature.
export async function getBookings(): Promise<Booking[]> {
  return BOOKINGS;
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  return BOOKINGS.find((b) => b.id === id);
}

export async function getGuests(): Promise<Guest[]> {
  return GUESTS;
}

export async function getGuest(id: string): Promise<Guest | undefined> {
  return GUESTS.find((g) => g.id === id);
}

export async function getPartyHallEnquiries(): Promise<PartyHallEnquiry[]> {
  return PARTY_HALL_ENQUIRIES;
}

export async function getRoomTypes(): Promise<RoomTypeInfo[]> {
  return ROOM_TYPES;
}

/** Statuses that hold a physical room off the market. */
const OCCUPYING_STATUSES = new Set(["confirmed", "checked_in", "pending_payment"]);

/**
 * Physical rooms free on a given date (default today) — total inventory minus
 * the assigned rooms held by an occupying booking whose stay covers that date.
 */
export async function getAvailableRoomCount(
  onDate: string = new Date().toISOString().slice(0, 10),
): Promise<number> {
  return ROOM_NUMBERS.length - occupiedRoomsOn(onDate).size;
}

/**
 * Everything the admin dashboard renders, in one round-trip. Figures are seeded
 * to mirror `Admin Dashboard.dc.html`; `unassignedRooms` is derived from the
 * live booking set so the "needs allocation" nudge stays truthful. When this
 * swaps to a real DB these become aggregate queries behind the same signature.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const unassignedRooms = BOOKINGS.filter(
    (b) => b.roomNo === null && OCCUPYING_STATUSES.has(b.status),
  ).length;

  return {
    checkInsToday: { total: 12, arrived: 4, pending: 8 },
    checkOutsToday: { total: 8, settled: 5, late: 3 },
    expectedArrivals: { total: 5, nextTime: "2:30 PM", nextLabel: "Sharma +2" },
    unassignedRooms,
    occupancy: {
      occupied: 9,
      total: 14,
      pct: 64,
      deluxe: { occupied: 6, total: 10 },
      deluxeBalcony: { occupied: 3, total: 4 },
      vacant: 5,
      partyHall: "Booked 22 Aug",
    },
    revenue: [
      {
        key: "7d",
        switchLabel: "7 days",
        rangeLabel: "Mon 7 Jul – Sun 13 Jul",
        total: "₹2.14L",
        delta: "▲ 12.4% vs prev",
        bars: [
          { label: "Mon", value: 40 },
          { label: "Tue", value: 62 },
          { label: "Wed", value: 48 },
          { label: "Thu", value: 78 },
          { label: "Fri", value: 96 },
          { label: "Sat", value: 88 },
          { label: "Sun", value: 66 },
        ],
      },
      {
        key: "30d",
        switchLabel: "30 days",
        rangeLabel: "Last 30 days",
        total: "₹9.3L",
        delta: "▲ 8.1% vs prev",
        bars: [
          { label: "W1", value: 58 },
          { label: "W2", value: 72 },
          { label: "W3", value: 64 },
          { label: "W4", value: 92 },
        ],
      },
      {
        key: "12m",
        switchLabel: "12 months",
        rangeLabel: "Aug 2025 – Jul 2026",
        total: "₹1.08Cr",
        delta: "▲ 21.6% vs prev",
        bars: [
          { label: "A", value: 52 },
          { label: "S", value: 60 },
          { label: "O", value: 74 },
          { label: "N", value: 82 },
          { label: "D", value: 96 },
          { label: "J", value: 70 },
          { label: "F", value: 64 },
          { label: "M", value: 72 },
          { label: "A", value: 80 },
          { label: "M", value: 68 },
          { label: "J", value: 58 },
          { label: "J", value: 88 },
        ],
      },
    ],
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
function occupiedRoomsOn(onDate: string): Set<string> {
  const occupied = new Set<string>();
  for (const b of BOOKINGS) {
    if (!b.roomNo || !OCCUPYING_STATUSES.has(b.status)) continue;
    if (b.checkIn <= onDate && onDate < b.checkOut) occupied.add(b.roomNo);
  }
  return occupied;
}

/**
 * Everything the admin Bookings screen renders. Summary figures, tab counts
 * and the period-totals footer are all derived from the live booking set (not
 * seeded), so "totals auto" holds and the numbers stay honest across edits.
 * A real DB swap turns these into aggregate queries behind the same signature.
 */
export async function getBookingsPageData(
  today: string = new Date().toISOString().slice(0, 10),
): Promise<BookingsPageData> {
  const guestName = new Map(GUESTS.map((g) => [g.id, g.name]));
  const rows = BOOKINGS.map((booking) => ({
    booking,
    guestName: guestName.get(booking.guestId) ?? "—",
  }));

  const countsByStatus = BOOKINGS.reduce(
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

  const totals = BOOKINGS.reduce<BookingsPageData["totals"]>(
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

  const occupied = occupiedRoomsOn(today).size;
  const totalUrn = BOOKINGS.reduce((sum, b) => sum + b.urn, 0);
  const totalCollected = BOOKINGS.reduce(
    (sum, b) => sum + computeTotalCollected(b.collection),
    0,
  );

  const summary: BookingsPageData["summary"] = [
    {
      key: "checkInsToday",
      label: "Today's check-ins",
      value: String(BOOKINGS.filter((b) => b.checkIn === today).length),
    },
    {
      key: "checkOutsToday",
      label: "Today's check-outs",
      value: String(BOOKINGS.filter((b) => b.checkOut === today).length),
    },
    {
      key: "occupied",
      label: "Occupied rooms",
      value: `${occupied} / ${ROOM_NUMBERS.length}`,
    },
    {
      key: "available",
      label: "Available rooms",
      value: String(ROOM_NUMBERS.length - occupied),
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

  return { today, total: BOOKINGS.length, summary, countsByStatus, rows, totals };
}

// ── Rooms screen ───────────────────────────────────────────────────────────

const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  occupied: "Occupied",
  available: "Available",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

/** Legend order — matches the design's swatch row. */
const ROOM_STATUS_ORDER: RoomStatus[] = [
  "occupied",
  "available",
  "cleaning",
  "maintenance",
];

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
 * from the tiles so they can never drift out of sync. A real DB swap turns the
 * seed into a per-room status query behind the same signature.
 */
export async function getRoomsPageData(): Promise<RoomsPageData> {
  const tiles = ROOM_UNITS.map(buildRoomTile);

  const countByStatus = tiles.reduce(
    (acc, t) => {
      acc[t.status] += 1;
      return acc;
    },
    { occupied: 0, available: 0, cleaning: 0, maintenance: 0 } as Record<
      RoomStatus,
      number
    >,
  );

  const typeCards: RoomTypeCard[] = ROOM_TYPES.map((rt) => ({
    type: rt.type,
    name: rt.name,
    count: rt.count,
    areaSqm: rt.areaSqm,
    pricePerNight: rt.pricePerNight,
    available: tiles.filter(
      (t) => t.type === rt.type && t.status === "available",
    ).length,
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

  // Next party-hall booking = soonest upcoming event by date.
  const nextEvent = [...PARTY_HALL_ENQUIRIES]
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((e) => e.status !== "cancelled");
  const partyHall = {
    nextLabel: nextEvent
      ? `${new Date(nextEvent.date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })} · ${SLOT_LABEL[nextEvent.slot]}`
      : "No events booked",
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
  1: 5, 2: 6, 3: 7, 4: 10, 5: 9, 6: 7, 7: 6, 8: 8, 9: 9, 10: 11,
  11: 12, 12: 10, 13: 9, 14: 9, 15: 7, 16: 8, 17: 10, 18: 11, 19: 13, 20: 12,
  21: 9, 22: 10, 23: 11, 24: 12, 25: 14, 26: 14, 27: 12, 28: 10, 29: 9, 30: 11,
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
function eventsForMonth(year: number, month: number): Map<string, string> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const events = new Map<string, string>();

  for (const e of PARTY_HALL_ENQUIRIES) {
    if (e.status === "cancelled" || !e.date.startsWith(prefix)) continue;
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
 * A real DB swap turns the occupancy seed into a per-date aggregate query.
 */
export async function getCalendarPageData(
  year = 2026,
  month = 7,
): Promise<CalendarPageData> {
  const total = ROOM_NUMBERS.length;
  const isDisplayMonth = year === 2026 && month === 7;
  const events = eventsForMonth(year, month);

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
      : occupiedRoomsOn(date).size;
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
