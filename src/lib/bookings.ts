// Data access layer for the booking system.
//
// This is an in-memory mock returning seed data that mirrors the design files.
// It is intentionally the single choke point every route/loader reads through,
// so swapping to a real database later is a one-file change.

import type {
  Booking,
  DashboardData,
  Guest,
  PartyHallEnquiry,
  RoomType,
} from "@/types/booking";
import { computeTotalBill } from "@/lib/booking-math";

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

/** All 14 physical room numbers across the two floors. */
export const ROOM_NUMBERS: string[] = [
  "101",
  "102",
  "103",
  "104",
  "105",
  "106",
  "107",
  "201",
  "202",
  "203",
  "204",
  "205",
  "206",
  "207",
];

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
  const occupied = new Set<string>();
  for (const b of BOOKINGS) {
    if (!b.roomNo || !OCCUPYING_STATUSES.has(b.status)) continue;
    if (b.checkIn <= onDate && onDate < b.checkOut) occupied.add(b.roomNo);
  }
  return ROOM_NUMBERS.length - occupied.size;
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
