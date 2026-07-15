// Data access layer for the booking system.
//
// This is an in-memory mock returning seed data that mirrors the design files.
// It is intentionally the single choke point every route/loader reads through,
// so swapping to a real database later is a one-file change.

import type { Booking, Guest, PartyHallEnquiry, RoomType } from "@/types/booking";
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
