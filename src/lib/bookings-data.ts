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
import { eq } from "drizzle-orm";

import {
  cancelGuestBooking,
  createBooking,
  findGuestBooking,
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
  markBookingPaid,
  withAdvance,
  withTier,
  withTotal,
  type BookingData,
  type GuestBookingLookup,
  type NewBookingInput,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { getSessionMember } from "@/lib/auth";
import { db, missingDbInProduction } from "@/lib/db";
import { createRazorpayOrder, razorpayKeyId, verifyRazorpaySignature } from "@/lib/razorpay";
import { loadRoster } from "@/lib/roster";
import * as schema from "@/lib/schema";
import { can, type Result } from "@/lib/team";
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
    razorpayOrderId: r.razorpayOrderId ?? undefined,
    razorpayPaymentId: r.razorpayPaymentId ?? undefined,
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

/**
 * Write a guest + booking together — spec 19's first real `INSERT`.
 *
 * Two statements, not a transaction: HTTP-mode Neon has no multi-statement
 * transaction here, and the failure mode of "guest written, booking failed"
 * is self-healing — `createBooking`'s phone lookup on the *next* attempt finds
 * the guest it already wrote and reuses it rather than duplicating.
 *
 * With no `DATABASE_URL` this mutates the shared `fixtures` object in place,
 * same dev-only convenience `roster.ts`'s `mem()` store gives invites: it
 * lives only as long as the dev server does, which is enough to see a new row
 * appear on the Bookings page without a database.
 */
async function insertBooking(guest: Guest, booking: Booking): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    if (!fixtures.guests.some((g) => g.id === guest.id)) fixtures.guests.push(guest);
    fixtures.bookings.push(booking);
    return;
  }
  await conn
    .insert(schema.guests)
    .values({
      id: guest.id,
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      city: guest.city,
      stays: guest.stays,
      lifetimeValue: guest.lifetimeValue,
    })
    .onConflictDoNothing({ target: schema.guests.id });
  await conn.insert(schema.bookings).values({
    id: booking.id,
    guestId: booking.guestId,
    roomNo: booking.roomNo,
    roomType: booking.roomType,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    urn: booking.urn,
    source: booking.source,
    mealPlan: booking.mealPlan,
    revenueRoom: booking.revenue.room,
    revenueEarlyCheckIn: booking.revenue.earlyCheckIn,
    revenueLateCheckOut: booking.revenue.lateCheckOut,
    revenueOther: booking.revenue.other,
    revenueDiscount: booking.revenue.discount,
    revenueTaxPct: booking.revenue.taxPct,
    collectionPaidToHotel: booking.collection.paidToHotel,
    collectionOtaCollection: booking.collection.otaCollection,
    collectionOtaCommission: booking.collection.otaCommission,
    collectionComplimentary: booking.collection.complimentary,
    collectionPending: booking.collection.pending,
    status: booking.status,
    createdAt: new Date(booking.createdAt),
  });
}

/**
 * Spec 15's cancel action — the first `UPDATE` against `bookings`. Same
 * fixtures-mutation convenience as `insertBooking` when there is no database.
 */
async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const booking = fixtures.bookings.find((b) => b.id === bookingId);
    if (booking) booking.status = status;
    return;
  }
  await conn.update(schema.bookings).set({ status }).where(eq(schema.bookings.id, bookingId));
}

/**
 * The Razorpay verify route's write (#16): persists what `markBookingPaid`
 * decided — status, the now-settled collection, and the two id columns
 * `schema.ts` reserves for a gateway payment. Same fixtures-mutation
 * convenience as the other row-store helpers when there is no database.
 */
async function updateBookingPayment(booking: Booking): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const existing = fixtures.bookings.find((b) => b.id === booking.id);
    if (existing) Object.assign(existing, booking);
    return;
  }
  await conn
    .update(schema.bookings)
    .set({
      status: booking.status,
      collectionPaidToHotel: booking.collection.paidToHotel,
      collectionPending: booking.collection.pending,
      razorpayOrderId: booking.razorpayOrderId ?? null,
      razorpayPaymentId: booking.razorpayPaymentId ?? null,
    })
    .where(eq(schema.bookings.id, booking.id));
}

function noDbInsert(): void {
  if (missingDbInProduction()) {
    throw new Error(
      "DATABASE_URL is not set. The admin console is unavailable until it is. " +
        "(The marketing site does not read the database and is unaffected.)",
    );
  }
}

async function requireBookingWriter(): Promise<Result> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to create a booking." };
  if (!can(member.role, "bookings:write")) {
    return { ok: false, error: `A ${member.role} account cannot create bookings.` };
  }
  return { ok: true };
}

/**
 * Wires the Bookings toolbar's `+ New booking` button and the header FAB
 * (spec 19) to the write path above. Mirrors `sendInviteFn`'s three beats:
 * load state, ask the rule, persist what it decided.
 */
export const createBookingFn = createServerFn({ method: "POST" })
  .inputValidator((data: NewBookingInput) => data)
  .handler(async ({ data }): Promise<Result<{ booking: Booking }>> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;

    const current = await load();
    const res = createBooking(current, data);
    if (!res.ok) return res;

    await insertBooking(res.guest, res.booking);
    return { ok: true, booking: res.booking };
  });

/**
 * The public `/book` flow's write path (spec 14). Same rule and row-store as
 * `createBookingFn` above — the two entry points share `createBooking` and
 * `insertBooking` by construction so a guest's booking and an admin's manual
 * entry can never validate or persist differently. No `requireBookingWriter`
 * check: this *is* the unauthenticated path, not a bypass of the admin one.
 */
export const createGuestBookingFn = createServerFn({ method: "POST" })
  .inputValidator((data: NewBookingInput) => data)
  .handler(async ({ data }): Promise<Result<{ booking: Booking }>> => {
    const current = await load();
    const res = createBooking(current, data);
    if (!res.ok) return res;

    await insertBooking(res.guest, res.booking);
    return { ok: true, booking: res.booking };
  });

/**
 * The public `/booking-lookup` search (spec 15): a booking ID plus the phone
 * or email it was booked under, no login. Shares `findGuestBooking`'s
 * ownership check with the cancel path below.
 */
export const lookupGuestBookingFn = createServerFn({ method: "POST" })
  .inputValidator((data: { bookingId: string; contact: string }) => data)
  .handler(async ({ data }): Promise<Result<GuestBookingLookup>> => {
    const current = await load();
    return findGuestBooking(current, data.bookingId, data.contact);
  });

/** The lookup result's "Cancel booking" action. Same ownership check, then one write. */
export const cancelGuestBookingFn = createServerFn({ method: "POST" })
  .inputValidator((data: { bookingId: string; contact: string }) => data)
  .handler(async ({ data }): Promise<Result<{ booking: Booking }>> => {
    const current = await load();
    const res = cancelGuestBooking(current, data.bookingId, data.contact);
    if (!res.ok) return res;

    await updateBookingStatus(res.booking.id, "cancelled");
    return res;
  });

/**
 * The Payment step's "Pay online" path (#16): opens one Razorpay order
 * covering every booking the guest's cart just created. The amount is summed
 * here from the bookings' own `totalBill`, never taken from the client — a
 * guest's browser proposing its own total would be a guest naming their own
 * price. `bookingIds` not yet `pending_payment` (e.g. a stale double-submit)
 * are dropped from the sum rather than failing the whole order.
 */
export const createRazorpayOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { bookingIds: string[] }) => data)
  .handler(
    async ({
      data,
    }): Promise<Result<{ orderId: string; amount: number; currency: string; keyId: string }>> => {
      const current = await load();
      const rows = data.bookingIds
        .map((id) => current.bookings.find((b) => b.id === id))
        .filter((b): b is Booking => !!b && b.status === "pending_payment");
      if (rows.length === 0) {
        return { ok: false, error: "No payable booking found for this order." };
      }

      const amount = rows.reduce((sum, b) => sum + b.totalBill, 0);
      const order = await createRazorpayOrder(amount, rows[0].id);
      return {
        ok: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId(),
      };
    },
  );

/**
 * The Checkout `handler` callback's call (#16): verifies the signature once,
 * then settles every booking the order covered. Not a transaction — same
 * documented tradeoff as `insertBooking` — a failure partway through leaves
 * whatever already settled as `confirmed`, and a retry with the same
 * signature is a no-op on those rows via `markBookingPaid`'s idempotence.
 */
export const verifyRazorpayPaymentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      bookingIds: string[];
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<Result<{ bookings: Booking[] }>> => {
    if (
      !verifyRazorpaySignature(data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature)
    ) {
      return { ok: false, error: "Payment could not be verified. Please contact the front desk." };
    }

    const settled: Booking[] = [];
    for (const id of data.bookingIds) {
      const current = await load();
      const res = markBookingPaid(current, id, data.razorpayOrderId, data.razorpayPaymentId);
      if (!res.ok) return res;
      await updateBookingPayment(res.booking);
      settled.push(res.booking);
    }
    return { ok: true, bookings: settled };
  });

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
