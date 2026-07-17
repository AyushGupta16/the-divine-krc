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
// PR #12b next: `load()` becomes a query. Nothing above it changes, because
// nothing above it knows where the rows came from.

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
  type BookingData,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import type {
  BookingsPageData,
  CalendarPageData,
  DashboardData,
  GuestsPageData,
  PartyHallPageData,
  PaymentsPageData,
  ReportsPageData,
  RoomsPageData,
  SettingsPageData,
} from "@/types/booking";

/**
 * Every row the admin console reads, in one place.
 *
 * Seeded today, queried once the tables exist. It is `async` already so that
 * swap changes this function's body and nothing else.
 */
async function load(): Promise<BookingData> {
  return fixtures;
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
  async (): Promise<SettingsPageData> => getSettingsPageData(await load()),
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
