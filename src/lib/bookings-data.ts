// The server boundary for booking data.
//
// Every admin screen's rows are fetched here and derived in `lib/bookings.ts`.
// The split is not stylistic. `bookings.ts` is imported by route loaders, which
// run in the browser, so anything it can reach is compiled into `dist/client`
// and served to anonymous visitors. Handler bodies inside `createServerFn` are
// stripped from that build, which makes this the only file allowed to hold —
// or, once the tables land, to fetch — the rows themselves.
//
// `lib/invites.ts` has done it this way since PR #12; this file follows it.
//
// Not named `bookings.server.ts`: that suffix marks a module the client may
// never import at all, and Start's import-protection plugin fails the build if
// one does. A `createServerFn` module is the opposite — loaders are *meant* to
// import it, and the bundler swaps each handler for an RPC call. Hence the
// plain name, same as `invites.ts`.
//
// #12b: `load()` is now a query. Nothing above it changed, because nothing above
// it knows where the rows come from — which was the point of the split.

import { createServerFn } from "@tanstack/react-start";

import {
  getAvailableRoomCount,
  getBookingsPageData,
  getCalendarPageData,
  getDashboardData,
  getGuestsPageData,
  getPartyHallPageData,
  getPaymentsPageData,
  getReportsPageData,
  getRoomsPageData,
  getSettingsPageData,
  withAdvance,
  withTier,
  withTotal,
  type BookingData,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { db, missingDbInProduction } from "@/lib/db";
import { loadRoster } from "@/lib/roster";
import * as schema from "@/lib/schema";
import type {
  Booking,
  BookingCollection,
  BookingRevenue,
  BookingsPageData,
  BookingSource,
  BookingStatus,
  CalendarPageData,
  DashboardData,
  Guest,
  GuestsPageData,
  MealPlan,
  PartyHallEnquiry,
  PartyHallPageData,
  PartyHallSlot,
  PartyHallStatus,
  PaymentsPageData,
  ReportsPageData,
  RoomsPageData,
  RoomType,
  SettingsPageData,
} from "@/types/booking";

type GuestRow = typeof schema.guests.$inferSelect;
type BookingRow = typeof schema.bookings.$inferSelect;
type PartyHallRow = typeof schema.partyHallEnquiries.$inferSelect;

// Rows in, domain objects out. The derived fields (`tier`, `totalBill`,
// `advancePaid`) are computed here by the same functions the fixtures use, which
// is why no column stores them.

function toGuest(r: GuestRow): Guest {
  return withTier({
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    city: r.city,
    stays: r.stays,
    lifetimeValue: r.lifetimeValue,
  });
}

function toBooking(r: BookingRow): Booking {
  const revenue: BookingRevenue = {
    room: r.revenueRoom,
    earlyCheckIn: r.revenueEarlyCheckIn,
    lateCheckOut: r.revenueLateCheckOut,
    other: r.revenueOther,
    discount: r.revenueDiscount,
    taxPct: r.revenueTaxPct,
  };
  const collection: BookingCollection = {
    paidToHotel: r.collectionPaidToHotel,
    otaCollection: r.collectionOtaCollection,
    otaCommission: r.collectionOtaCommission,
    complimentary: r.collectionComplimentary,
    pending: r.collectionPending,
  };
  return withTotal({
    id: r.id,
    guestId: r.guestId,
    roomNo: r.roomNo,
    roomType: r.roomType as RoomType,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    urn: r.urn,
    source: r.source as BookingSource,
    mealPlan: r.mealPlan as MealPlan,
    revenue,
    collection,
    status: r.status as BookingStatus,
    createdAt: r.createdAt.toISOString(),
  });
}

function toPartyHall(r: PartyHallRow): PartyHallEnquiry {
  return withAdvance({
    id: r.id,
    title: r.title,
    date: r.date,
    slot: r.slot as PartyHallSlot,
    guests: r.guests,
    package: r.package,
    addOns: r.addOns,
    status: r.status as PartyHallStatus,
    amount: r.amount,
  });
}

/**
 * Every row the admin console reads, in one round-trip.
 *
 * Three queries rather than joins: the whole dataset is a few hundred rows at
 * fourteen physical rooms, and the derivation in `bookings.ts` is already
 * written — and tested — against plain arrays. Pushing aggregation into SQL
 * would trade 117 passing tests for microseconds. Revisit never.
 *
 * With no `DATABASE_URL` it serves the fixtures. That is not a fallback for
 * production — `missingDbInProduction()` fails the admin console closed there —
 * it is what makes local dev and the test suite work with no database, which the
 * blank local env and `vitest.config` both assume.
 */
async function load(): Promise<BookingData> {
  const conn = db();
  if (!conn) {
    if (missingDbInProduction()) {
      throw new Error(
        "DATABASE_URL is not set. The admin console is unavailable until it is. " +
          "(The marketing site does not read the database and is unaffected.)",
      );
    }
    return fixtures;
  }

  // ORDER BY on every one of them. Postgres guarantees nothing about row order
  // without it — the planner is free to hand back whatever is cheapest, and the
  // answer can change after an UPDATE or a vacuum. The derivation states its own
  // order (see `bookingNumber` and the sorts in `bookings.ts`), so this is not
  // what makes the screens deterministic; it is what stops the *query* from
  // being a coin flip, which matters the moment anyone debugs one or pages it.
  const [guestRows, bookingRows, partyHallRows] = await Promise.all([
    conn.select().from(schema.guests).orderBy(schema.guests.id),
    conn.select().from(schema.bookings).orderBy(schema.bookings.id),
    conn.select().from(schema.partyHallEnquiries).orderBy(schema.partyHallEnquiries.id),
  ]);

  return {
    guests: guestRows.map(toGuest),
    bookings: bookingRows.map(toBooking),
    partyHall: partyHallRows.map(toPartyHall),
  };
}

export const dashboardPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => getDashboardData(await load()),
);

export const bookingsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<BookingsPageData> => getBookingsPageData(await load()),
);

export const roomsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<RoomsPageData> => getRoomsPageData(await load()),
);

export const calendarPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<CalendarPageData> => getCalendarPageData(await load()),
);

export const partyHallPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<PartyHallPageData> => getPartyHallPageData(await load()),
);

export const guestsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuestsPageData> => getGuestsPageData(await load()),
);

export const paymentsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentsPageData> => getPaymentsPageData(await load()),
);

export const reportsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReportsPageData> => getReportsPageData(await load()),
);

export const settingsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsPageData> => {
    // The roster is a separate load, not part of `BookingData`: it is the one
    // screen that reads both, and folding people into "booking rows" would put
    // `lib/team.ts` back in reach of everything that reads a booking.
    const [data, roster] = await Promise.all([load(), loadRoster()]);
    return getSettingsPageData(data, roster);
  },
);

/** Sidebar badges. Counts only — the shell has no use for the rows themselves. */
export const sidebarCounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ bookings: number; guests: number; rooms: number }> => {
    const data = await load();
    return {
      bookings: data.bookings.length,
      guests: data.guests.length,
      // Off the floor board, not the booking set — see `getAvailableRoomCount`.
      rooms: await getAvailableRoomCount(),
    };
  },
);
