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
//
// LANDMINE: never export a plain (non-`createServerFn`) function from this
// file if its body reads the `fixtures` value (or `db`/`schema` at module
// scope). `createServerFn` handler bodies are what actually get stripped from
// the client build — a plain export gets none of that treatment, so Rollup
// can no longer prove `fixtures` is unreachable from the client graph, and the
// entire seed dataset ships to the browser alongside it: real-looking guest
// emails/phones, and — because `fixtures`/`schema` pull in the same
// module graph — `PGPASSWORD` and `password_hash` too. This is not
// hypothetical: PR #81 nearly shipped exactly this, exporting
// `updatePartyHallPipeline` for testability. `npm run check:bundle` caught it
// (6 secrets in one client chunk); `tsc` and eslint did not. If a function in
// here needs to be unit-tested, either keep it from touching `fixtures`/`db`/
// `schema` (see `toPartyHall`, which only touches its typed row argument), or
// extract the pure logic that needs the export into a client-safe module
// (see `partyHallTransitionAllowed` in `bookings.ts`). Always re-run
// `npm run check:bundle` on a clean build before exporting anything new here.

import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";

import {
  assignBookingRoom,
  cancelGuestBooking,
  cancelPartyHallEvent,
  checkAvailability,
  checkInEligibilityError,
  computePartyHallQuote,
  confirmPartyHallEvent,
  createBooking,
  createPartyHallEnquiry,
  declinePartyHallEnquiry,
  defaultRoomTiles,
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
  OCCUPYING_STATUSES,
  getSettingsPageData,
  markBookingPaid,
  PARTY_HALL_RATE_DEFAULTS,
  recordPartyHallAdvance,
  reopenPartyHallEnquiry,
  resolveAddOnRates,
  partyHallTransitionAllowed,
  resolvePartyHallRates,
  resolveRequestedService,
  resolveRoomTypes,
  sendPartyHallQuote,
  withAdvance,
  withTier,
  withTotal,
  type AddOnRates,
  type AvailabilityQuery,
  type BookingData,
  type GuestBookingLookup,
  type NewBookingInput,
  type NewPartyHallEnquiryInput,
  type RoomTypeInfo,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { getSessionMember } from "@/lib/auth";
import { db, missingDbInProduction } from "@/lib/db";
import { createRazorpayOrder, razorpayKeyId, verifyRazorpaySignature } from "@/lib/razorpay";
import { loadRoster } from "@/lib/roster";
import * as schema from "@/lib/schema";
import { can, type Result } from "@/lib/team";
import type {
  AddOnServiceKey,
  Booking,
  BookingCollection,
  BookingRevenue,
  BookingsPageData,
  BookingSource,
  BookingStatus,
  CalendarPageData,
  DashboardData,
  Guest,
  GuestRequest,
  GuestsPageData,
  MealPlan,
  PartyHallEnquiry,
  PartyHallPageData,
  PartyHallRateKey,
  PartyHallSlot,
  PartyHallSource,
  PartyHallStatus,
  PaymentsPageData,
  ReportsPageData,
  RequestedServices,
  RoomsPageData,
  RoomStatus,
  RoomTile,
  RoomType,
  SettingsPageData,
} from "@/types/booking";

type GuestRow = typeof schema.guests.$inferSelect;
type BookingRow = typeof schema.bookings.$inferSelect;
type PartyHallRow = typeof schema.partyHallEnquiries.$inferSelect;
type RoomRow = typeof schema.rooms.$inferSelect;

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
    roomAssignedAt: r.roomAssignedAt?.toISOString() ?? undefined,
    razorpayOrderId: r.razorpayOrderId ?? undefined,
    razorpayPaymentId: r.razorpayPaymentId ?? undefined,
    batchId: r.batchId ?? undefined,
    specialRequest: (r.specialRequest ?? undefined) as GuestRequest | undefined,
    requestedServices: (r.requestedServices ?? undefined) as RequestedServices | undefined,
    revenueOtherNote: r.revenueOtherNote ?? undefined,
  });
}

function toRoomTile(r: RoomRow): RoomTile {
  return {
    no: r.no,
    floor: r.floor as 1 | 2,
    type: r.type as RoomType,
    status: r.status as RoomStatus,
    detail: r.detail,
  };
}

export function toPartyHall(r: PartyHallRow, advancePct: number): PartyHallEnquiry {
  return withAdvance(
    {
      id: r.id,
      title: r.title,
      date: r.date,
      slot: r.slot as PartyHallSlot,
      guests: r.guests,
      package: r.package,
      addOns: r.addOns,
      status: r.status as PartyHallStatus,
      amount: r.amount,
      quotedAt: r.quotedAt?.toISOString() ?? undefined,
      quoteBreakdown: r.quoteBreakdown ?? undefined,
      advanceAmount: r.advanceAmount ?? undefined,
      advancePct: r.advancePct ?? undefined,
      refundedAt: r.refundedAt?.toISOString() ?? undefined,
      createdAt: r.createdAt?.toISOString() ?? undefined,
      contactName: r.contactName ?? undefined,
      contactPhone: r.contactPhone ?? undefined,
      contactEmail: r.contactEmail ?? undefined,
      source: (r.source as PartyHallSource) ?? undefined,
    },
    advancePct,
  );
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
  const [guestRows, bookingRows, partyHallRows, roomRows, roomTypeRows, addOnRows] =
    await Promise.all([
      conn.select().from(schema.guests).orderBy(schema.guests.id),
      conn.select().from(schema.bookings).orderBy(schema.bookings.id),
      conn.select().from(schema.partyHallEnquiries).orderBy(schema.partyHallEnquiries.id),
      conn.select().from(schema.rooms).orderBy(schema.rooms.no),
      conn.select().from(schema.roomTypeSettings).orderBy(schema.roomTypeSettings.type),
      conn.select().from(schema.addOnSettings).orderBy(schema.addOnSettings.id),
    ]);

  // Every addon_settings row lands in both maps — room add-on ids and Party
  // Hall rate ids never collide, and each resolver only ever reads its own keys.
  const addOnRateOverrides = Object.fromEntries(
    addOnRows.map((r) => [r.id, r.price]),
  ) as BookingData["addOnRateOverrides"];
  const partyHallRateOverrides = Object.fromEntries(
    addOnRows.map((r) => [r.id, r.price]),
  ) as BookingData["partyHallRateOverrides"];
  const advancePct = resolvePartyHallRates(partyHallRateOverrides).phAdvancePct;

  return {
    guests: guestRows.map(toGuest),
    bookings: bookingRows.map(toBooking),
    partyHall: partyHallRows.map((r) => toPartyHall(r, advancePct)),
    rooms: roomRows.map(toRoomTile),
    roomTypeOverrides: Object.fromEntries(
      roomTypeRows.map((r) => [
        r.type,
        { name: r.name ?? undefined, areaSqm: r.areaSqm, pricePerNight: r.pricePerNight },
      ]),
    ) as BookingData["roomTypeOverrides"],
    addOnRateOverrides,
    partyHallRateOverrides,
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
    batchId: booking.batchId,
    specialRequest: booking.specialRequest ?? null,
    requestedServices: booking.requestedServices ?? null,
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
 * Slice 2's room-assignment write. Same fixtures-mutation convenience as the
 * other row-store helpers when there is no database.
 */
async function updateBookingRoom(
  bookingId: string,
  roomNo: string | null,
  roomAssignedAt: string | undefined,
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const booking = fixtures.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.roomNo = roomNo;
      booking.roomAssignedAt = roomAssignedAt;
    }
    return;
  }
  await conn
    .update(schema.bookings)
    .set({ roomNo, roomAssignedAt: roomAssignedAt ? new Date(roomAssignedAt) : null })
    .where(eq(schema.bookings.id, bookingId));
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

/**
 * Party Hall's "Billing contact" fields — enquiries carry no guest row, so
 * this is the only identity a party-hall invoice can bill to. Same
 * fixtures-mutation convenience as the other row-store helpers with no
 * database.
 */
async function updatePartyHallContact(
  id: string,
  contact: { contactName: string; contactPhone: string; contactEmail: string },
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const enquiry = fixtures.partyHall.find((e) => e.id === id);
    if (enquiry) Object.assign(enquiry, contact);
    return;
  }
  await conn
    .update(schema.partyHallEnquiries)
    .set(contact)
    .where(eq(schema.partyHallEnquiries.id, id));
}

export const updatePartyHallContactFn = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; contactName: string; contactPhone: string; contactEmail: string }) => data,
  )
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireSettingsWriter();
    if (!auth.ok) return auth;
    if (!data.contactName.trim()) return { ok: false, error: "Contact name is required." };

    await updatePartyHallContact(data.id, {
      contactName: data.contactName.trim(),
      contactPhone: data.contactPhone.trim(),
      contactEmail: data.contactEmail.trim(),
    });
    return { ok: true };
  });

/**
 * The guest-facing enquiry form's write (Party Hall audit Tier 1) — the
 * pipeline's first real `INSERT`. Same fixtures-mutation convenience as
 * `insertBooking` when there is no database.
 */
async function insertPartyHallEnquiry(enquiry: PartyHallEnquiry): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.partyHall.push(enquiry);
    return;
  }
  await conn.insert(schema.partyHallEnquiries).values({
    id: enquiry.id,
    title: enquiry.title,
    date: enquiry.date,
    slot: enquiry.slot,
    guests: enquiry.guests,
    package: enquiry.package,
    addOns: enquiry.addOns,
    status: enquiry.status,
    amount: enquiry.amount,
    createdAt: enquiry.createdAt ? new Date(enquiry.createdAt) : null,
    contactName: enquiry.contactName ?? null,
    contactPhone: enquiry.contactPhone ?? null,
    contactEmail: enquiry.contactEmail ?? null,
    source: enquiry.source ?? null,
  });
}

/**
 * The Events section's public enquiry form — unauthenticated, same trust
 * level as `createGuestBookingFn`. `createPartyHallEnquiry` validates every
 * field independently rather than trusting the client.
 */
export const createPartyHallEnquiryFn = createServerFn({ method: "POST" })
  .validator((data: NewPartyHallEnquiryInput) => data)
  .handler(async ({ data }): Promise<Result<{ enquiry: PartyHallEnquiry }>> => {
    const current = await load();
    const res = createPartyHallEnquiry(current, data);
    if (!res.ok) return res;

    await insertPartyHallEnquiry(res.enquiry);
    return { ok: true, enquiry: res.enquiry };
  });

/**
 * The Party Hall screen's "New event" drawer — a front-desk staffer recording
 * a walk-in or phoned-in enquiry. Same `createPartyHallEnquiry` rule as the
 * public form, but authenticated (`requireBookingWriter`, same gate as
 * `createBookingFn`) and passes `allowPastDate: true` so a same-day or
 * already-happened walk-in can still be recorded. `source` is required here
 * — never defaulted — so every hand-entered row states walk-in or phone
 * explicitly rather than inheriting the guest form's "direct".
 */
export const createPartyHallEnquiryAdminFn = createServerFn({ method: "POST" })
  .validator((data: NewPartyHallEnquiryInput & { source: "walk_in" | "phone" }) => data)
  .handler(async ({ data }): Promise<Result<{ enquiry: PartyHallEnquiry }>> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;

    const current = await load();
    const res = createPartyHallEnquiry(current, data, undefined, {
      source: data.source,
      allowPastDate: true,
    });
    if (!res.ok) return res;

    await insertPartyHallEnquiry(res.enquiry);
    return { ok: true, enquiry: res.enquiry };
  });

/**
 * Slice 2a's pipeline writes: status, amount, and (since 0011) the
 * quote/advance/refund snapshot columns each transition may set.
 *
 * `priorStatus` is required and checked in the `WHERE` (and, for the no-DB
 * fixtures path, before the mutation): the pure rule in `bookings.ts` already
 * validated the enquiry was in that status when `load()` read it, but two
 * concurrent clicks can both pass that in-memory check against the same
 * stale read before either write lands. Matching on `id AND status =
 * priorStatus` makes the second write a no-op — it affects zero rows — rather
 * than silently re-applying a transition whose precondition no longer holds.
 */
async function updatePartyHallPipeline(
  id: string,
  priorStatus: PartyHallStatus,
  patch: {
    status: PartyHallStatus;
    amount?: number;
    quotedAt?: Date;
    quoteBreakdown?: { label: string; amount: number }[];
    advanceAmount?: number;
    advancePct?: number;
    refundedAt?: Date;
  },
): Promise<boolean> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const enquiry = fixtures.partyHall.find((e) => e.id === id);
    if (!enquiry || !partyHallTransitionAllowed(enquiry.status, priorStatus)) return false;
    Object.assign(enquiry, {
      ...patch,
      quotedAt: patch.quotedAt?.toISOString() ?? enquiry.quotedAt,
      refundedAt: patch.refundedAt?.toISOString() ?? enquiry.refundedAt,
    });
    return true;
  }
  const result = await conn
    .update(schema.partyHallEnquiries)
    .set(patch)
    .where(
      and(eq(schema.partyHallEnquiries.id, id), eq(schema.partyHallEnquiries.status, priorStatus)),
    )
    .returning({ id: schema.partyHallEnquiries.id });
  return result.length > 0;
}

/** Every Party Hall pipeline action shares this shape: load, run the pure
 *  rule, persist what it decided, return its `Result`. */
async function runPartyHallTransition(
  id: string,
  rule: (current: BookingData) => Result<{ enquiry: PartyHallEnquiry }>,
): Promise<Result<{ enquiry: PartyHallEnquiry }>> {
  const auth = await requireBookingWriter();
  if (!auth.ok) return auth;
  const current = await load();
  const priorStatus = current.partyHall.find((e) => e.id === id)?.status;
  if (!priorStatus) return { ok: false, error: "Enquiry not found." };
  const res = rule(current);
  if (!res.ok) return res;
  const wrote = await updatePartyHallPipeline(id, priorStatus, {
    status: res.enquiry.status,
    amount: res.enquiry.amount,
    quotedAt: res.enquiry.quotedAt ? new Date(res.enquiry.quotedAt) : undefined,
    quoteBreakdown: res.enquiry.quoteBreakdown,
    advanceAmount: res.enquiry.advanceAmount,
    advancePct: res.enquiry.advancePct,
    refundedAt: res.enquiry.refundedAt ? new Date(res.enquiry.refundedAt) : undefined,
  });
  if (!wrote) {
    return {
      ok: false,
      error: "This enquiry changed since you loaded it — refresh and try again.",
    };
  }
  return res;
}

/** New enquiry → quoted, at the package/add-ons rate resolved right now. */
export const sendPartyHallQuoteFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    runPartyHallTransition(data.id, (current) =>
      sendPartyHallQuote(
        current,
        data.id,
        resolvePartyHallRates(current.partyHallRateOverrides),
        resolvePartyHallRates(current.partyHallRateOverrides).phAdvancePct,
      ),
    ),
  );

/** Admin-recorded advance (Option A) — a deliberate second click, never
 *  inferred from a gateway. */
export const recordPartyHallAdvanceFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    runPartyHallTransition(data.id, (current) =>
      recordPartyHallAdvance(
        current,
        data.id,
        resolvePartyHallRates(current.partyHallRateOverrides).phAdvancePct,
      ),
    ),
  );

/** The second half of Option A: locks the date in once the advance is in hand. */
export const confirmPartyHallEventFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    runPartyHallTransition(data.id, (current) =>
      confirmPartyHallEvent(
        current,
        data.id,
        resolvePartyHallRates(current.partyHallRateOverrides).phAdvancePct,
      ),
    ),
  );

/** Declines a quote — before any money has moved. Non-destructive: see
 *  `reopenPartyHallEnquiryFn`. */
export const declinePartyHallEnquiryFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    runPartyHallTransition(data.id, (current) => declinePartyHallEnquiry(current, data.id)),
  );

/** Calls off a booking after money has moved — terminal, no reopen. */
export const cancelPartyHallEventFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    runPartyHallTransition(data.id, (current) => cancelPartyHallEvent(current, data.id)),
  );

/** `declined` reopens back to `quote_sent` — not a dead end. */
export const reopenPartyHallEnquiryFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    runPartyHallTransition(data.id, (current) => reopenPartyHallEnquiry(current, data.id)),
  );

/**
 * Party Hall's ten Slice 2a rates — same upsert-on-id shape as
 * `upsertAddOnSettings`, kept a separate function so `AddOnServiceKey` stays
 * exactly the three room add-ons it always meant.
 */
async function upsertPartyHallRate(
  id: PartyHallRateKey,
  label: string,
  price: number,
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.partyHallRateOverrides = { ...fixtures.partyHallRateOverrides, [id]: price };
    return;
  }
  await conn
    .insert(schema.addOnSettings)
    .values({ id, label, price })
    .onConflictDoUpdate({ target: schema.addOnSettings.id, set: { price } });
}

const PARTY_HALL_RATE_LABEL_FOR_SAVE: Record<PartyHallRateKey, string> = {
  phBaseSilver: "Silver package base",
  phBaseGold: "Gold package base",
  phBasePlatinum: "Platinum package base",
  phDecor: "Decor",
  phDJ: "DJ",
  phAV: "AV",
  phProjector: "Projector",
  phLunchBuffet: "Lunch Buffet (per guest)",
  phCatering: "Catering (per guest)",
  phAdvancePct: "Advance to confirm",
};

/** Settings' ten Party Hall rate fields. */
export const updatePartyHallRateSettingsFn = createServerFn({ method: "POST" })
  .validator((data: { key: PartyHallRateKey; price: number }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireSettingsWriter();
    if (!auth.ok) return auth;
    if (!Number.isFinite(data.price) || data.price < 0) {
      return { ok: false, error: "Rate must be zero or more." };
    }
    await upsertPartyHallRate(data.key, PARTY_HALL_RATE_LABEL_FOR_SAVE[data.key], data.price);
    return { ok: true };
  });

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

async function requireRoomWriter(): Promise<Result> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to manage rooms." };
  if (!can(member.role, "rooms:write")) {
    return { ok: false, error: `A ${member.role} account cannot manage rooms.` };
  }
  return { ok: true };
}

async function requireSettingsWriter(): Promise<Result> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to change settings." };
  if (!can(member.role, "settings:write")) {
    return { ok: false, error: `A ${member.role} account cannot change settings.` };
  }
  return { ok: true };
}

/**
 * The Rooms screen's "Add room" and per-tile status popup, and Settings'
 * rate/area fields. Same fixtures-mutation convenience as the other row-store
 * helpers when there is no database — `fixtures.rooms` is mutated in place.
 */
async function insertRoom(room: RoomTile): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    if (fixtures.rooms.some((r) => r.no === room.no)) return;
    fixtures.rooms.push(room);
    return;
  }
  await conn
    .insert(schema.rooms)
    .values({
      no: room.no,
      floor: room.floor,
      type: room.type,
      status: room.status,
      detail: room.detail,
    })
    .onConflictDoNothing({ target: schema.rooms.no });
}

async function deleteRoom(no: string): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.rooms = fixtures.rooms.filter((r) => r.no !== no);
    return;
  }
  await conn.delete(schema.rooms).where(eq(schema.rooms.no, no));
}

async function updateRoom(no: string, status: RoomStatus, detail: string): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const room = fixtures.rooms.find((r) => r.no === no);
    if (room) {
      room.status = status;
      room.detail = detail;
    }
    return;
  }
  await conn.update(schema.rooms).set({ status, detail }).where(eq(schema.rooms.no, no));
}

async function updateRoomDetails(no: string, floor: 1 | 2, type: RoomType): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const room = fixtures.rooms.find((r) => r.no === no);
    if (room) {
      room.floor = floor;
      room.type = type;
    }
    return;
  }
  await conn.update(schema.rooms).set({ floor, type }).where(eq(schema.rooms.no, no));
}

async function upsertRoomTypeSettings(
  type: RoomType,
  patch: { name?: string; areaSqm: number; pricePerNight: number },
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.roomTypeOverrides = {
      ...fixtures.roomTypeOverrides,
      [type]: { ...fixtures.roomTypeOverrides[type], ...patch },
    };
    return;
  }
  await conn
    .insert(schema.roomTypeSettings)
    .values({ type, ...patch })
    .onConflictDoUpdate({ target: schema.roomTypeSettings.type, set: patch });
}

/** Settings' Slice B add-on rate fields — same upsert-on-`id` shape as
 *  `upsertRoomTypeSettings`. */
async function upsertAddOnSettings(
  id: AddOnServiceKey,
  label: string,
  price: number,
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.addOnRateOverrides = { ...fixtures.addOnRateOverrides, [id]: price };
    return;
  }
  await conn
    .insert(schema.addOnSettings)
    .values({ id, label, price })
    .onConflictDoUpdate({ target: schema.addOnSettings.id, set: { price } });
}

/**
 * Slice B's admin resolution write: whatever `resolveRequestedService`
 * decided — the booking's new revenue, `requestedServices`, and (for
 * mattress) the appended `revenueOtherNote`. Same fixtures-mutation
 * convenience as the other row-store helpers when there is no database.
 */
async function updateBookingServiceCharge(
  bookingId: string,
  patch: { revenue: BookingRevenue; requestedServices: RequestedServices; note?: string },
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const booking = fixtures.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.revenue = patch.revenue;
      booking.requestedServices = patch.requestedServices;
      booking.revenueOtherNote = patch.note;
      booking.totalBill = withTotal({ ...booking, revenue: patch.revenue }).totalBill;
    }
    return;
  }
  await conn
    .update(schema.bookings)
    .set({
      revenueEarlyCheckIn: patch.revenue.earlyCheckIn,
      revenueLateCheckOut: patch.revenue.lateCheckOut,
      revenueOther: patch.revenue.other,
      revenueOtherNote: patch.note ?? null,
      requestedServices: patch.requestedServices,
    })
    .where(eq(schema.bookings.id, bookingId));
}

/**
 * Settings' room-count field: adds or removes rooms of a type until the
 * floor board has exactly `count` of them, since `count` itself is never
 * stored (see `resolveRoomTypes`). New numbers alternate floor 1/2 and
 * continue that floor's highest existing number; shrinking removes the
 * highest-numbered rooms of the type first.
 */
async function resizeRoomType(type: RoomType, count: number): Promise<Result> {
  const current = await load();
  const allRooms = current.rooms ?? [];
  const ofType = allRooms.filter((r) => r.type === type);
  const diff = count - ofType.length;
  if (diff === 0) return { ok: true };

  if (diff > 0) {
    for (let i = 0; i < diff; i++) {
      const floor: 1 | 2 = (ofType.length + i) % 2 === 0 ? 1 : 2;
      const onFloor = allRooms.filter((r) => r.floor === floor);
      const maxSuffix = Math.max(0, ...onFloor.map((r) => Number(r.no.slice(1)) || 0));
      const no = `${floor}${String(maxSuffix + 1).padStart(2, "0")}`;
      if (allRooms.some((r) => r.no === no)) {
        return { ok: false, error: `Could not generate a free room number on floor ${floor}.` };
      }
      await insertRoom({ no, floor, type, status: "available", detail: "Ready" });
      allRooms.push({ no, floor, type, status: "available", detail: "Ready" });
    }
  } else {
    const toRemove = [...ofType].sort((a, b) => b.no.localeCompare(a.no)).slice(0, -diff);
    for (const room of toRemove) {
      await deleteRoom(room.no);
    }
  }
  return { ok: true };
}

/**
 * Wires the Bookings toolbar's `+ New booking` button and the header FAB
 * (spec 19) to the write path above. Mirrors `sendInviteFn`'s three beats:
 * load state, ask the rule, persist what it decided.
 */
export const createBookingFn = createServerFn({ method: "POST" })
  .validator((data: NewBookingInput) => data)
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
  .validator((data: NewBookingInput) => data)
  .handler(async ({ data }): Promise<Result<{ booking: Booking }>> => {
    const current = await load();
    const res = createBooking(current, data);
    if (!res.ok) return res;

    await insertBooking(res.guest, res.booking);
    return { ok: true, booking: res.booking };
  });

/**
 * The landing page's "Check Availability" bar: a public, read-only query
 * against the live booking set, so a query that can't be sold doesn't waste
 * the guest's time in the `/book` flow before falling back to WhatsApp.
 */
export const checkAvailabilityFn = createServerFn({ method: "POST" })
  .validator((data: AvailabilityQuery) => data)
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    const current = await load();
    return { available: checkAvailability(current, data) };
  });

/**
 * The subset of `RoomTypeInfo` safe to expose publicly. `count` here is the
 * floor board's total tiles of that type (`resolveRoomTypes`'s
 * `tiles.filter(...).length`) — total inventory, not who's occupied — so it
 * carries no live-occupancy signal; withholding it bought no privacy, only a
 * guest-facing "X left" hardcoded at build time and never updated when a
 * room type's tile count changes in the admin Rooms screen.
 */
export type PublicRoomType = Pick<
  RoomTypeInfo,
  "type" | "name" | "pricePerNight" | "areaSqm" | "count"
>;

/**
 * The current room rates/areas/counts for the marketing site's room cards
 * (homepage, landmark pages) and the guest booking flow's per-type quantity
 * cap — public and read-only, same as `checkAvailabilityFn`. Reuses
 * `resolveRoomTypes` so a rate edited in the admin Settings screen, or a room
 * added/removed in the admin Rooms screen, is reflected everywhere a room
 * price or count is shown, instead of a page hand-copying a number that can
 * go stale.
 */
export const getRoomTypesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicRoomType[]> => {
    // Marketing pages must render even if the DB is unreachable (issue #56 —
    // PR #55 shipped a 500 on every marketing route from exactly this call
    // throwing). Fall back to the standard rate card rather than the page.
    let rooms: RoomTile[];
    let overrides: BookingData["roomTypeOverrides"];
    try {
      const current = await load();
      rooms = current.rooms ?? defaultRoomTiles();
      overrides = current.roomTypeOverrides;
    } catch (err) {
      console.error("getRoomTypesFn: DB load failed, serving default room tiles", err);
      rooms = defaultRoomTiles();
    }
    const roomTypes = resolveRoomTypes(rooms, overrides);
    return roomTypes.map(({ type, name, pricePerNight, areaSqm, count }) => ({
      type,
      name,
      pricePerNight,
      areaSqm,
      count,
    }));
  },
);

/**
 * The current Slice B add-on rates for the guest booking flow — public and
 * read-only, same reasoning as `getRoomTypesFn`: a guest must see the exact
 * rate the front desk would charge, not a stale build-time number, and the
 * marketing/booking pages must still render if the DB is briefly unreachable.
 */
export const getAddOnRatesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AddOnRates> => {
    try {
      const current = await load();
      return resolveAddOnRates(current.addOnRateOverrides);
    } catch (err) {
      console.error("getAddOnRatesFn: DB load failed, serving default rates", err);
      return resolveAddOnRates();
    }
  },
);

/**
 * The public `/booking-lookup` search (spec 15): a booking ID plus the phone
 * or email it was booked under, no login. Shares `findGuestBooking`'s
 * ownership check with the cancel path below.
 */
export const lookupGuestBookingFn = createServerFn({ method: "POST" })
  .validator((data: { bookingId: string; contact: string }) => data)
  .handler(async ({ data }): Promise<Result<GuestBookingLookup>> => {
    const current = await load();
    return findGuestBooking(current, data.bookingId, data.contact);
  });

/** The lookup result's "Cancel booking" action. Same ownership check, then one write. */
export const cancelGuestBookingFn = createServerFn({ method: "POST" })
  .validator((data: { bookingId: string; contact: string }) => data)
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
  .validator((data: { bookingIds: string[] }) => data)
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
  .validator(
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

export const calendarPage = createServerFn({ method: "GET" })
  .validator((data?: { year: number; month: number }) => data)
  .handler(async ({ data }): Promise<CalendarPageData> =>
    data
      ? getCalendarPageData(await load(), data.year, data.month)
      : getCalendarPageData(await load()),
  );

export const partyHallPage = createServerFn({ method: "GET" })
  .validator((data?: { year: number; month: number }) => data)
  .handler(async ({ data }): Promise<PartyHallPageData> =>
    data
      ? getPartyHallPageData(await load(), data.year, data.month)
      : getPartyHallPageData(await load()),
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

/** The Rooms screen's per-tile status popup. */
export const updateRoomStatusFn = createServerFn({ method: "POST" })
  .validator((data: { no: string; status: RoomStatus; detail: string }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireRoomWriter();
    if (!auth.ok) return auth;
    // "occupied" is derived from the booking ledger (Slice 2), never a
    // manual opinion — see `liveRoomTiles`. The UI no longer offers it, and
    // this rejects it server-side too, not just by omission in the picker.
    if (data.status === "occupied") {
      return {
        ok: false,
        error: "Room status is derived from bookings and can't be set manually.",
      };
    }
    const current = await load();
    if (!(current.rooms ?? []).some((r) => r.no === data.no)) {
      return { ok: false, error: `Room ${data.no} does not exist.` };
    }
    await updateRoom(data.no, data.status, data.detail.trim() || "Ready");
    return { ok: true };
  });

/** Settings' "Add room" form. */
export const addRoomFn = createServerFn({ method: "POST" })
  .validator((data: { no: string; floor: 1 | 2; type: RoomType }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireRoomWriter();
    if (!auth.ok) return auth;
    const no = data.no.trim();
    if (!no) return { ok: false, error: "Room number is required." };
    const current = await load();
    if ((current.rooms ?? []).some((r) => r.no === no)) {
      return { ok: false, error: `Room ${no} already exists.` };
    }
    await insertRoom({
      no,
      floor: data.floor,
      type: data.type,
      status: "available",
      detail: "Ready",
    });
    return { ok: true };
  });

/** Settings' per-room inline floor/type edit. */
export const updateRoomDetailsFn = createServerFn({ method: "POST" })
  .validator((data: { no: string; floor: 1 | 2; type: RoomType }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireRoomWriter();
    if (!auth.ok) return auth;
    const current = await load();
    if (!(current.rooms ?? []).some((r) => r.no === data.no)) {
      return { ok: false, error: `Room ${data.no} does not exist.` };
    }
    await updateRoomDetails(data.no, data.floor, data.type);
    return { ok: true };
  });

/** Settings' per-room "Remove" action. */
export const removeRoomFn = createServerFn({ method: "POST" })
  .validator((data: { no: string }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireRoomWriter();
    if (!auth.ok) return auth;
    await deleteRoom(data.no);
    return { ok: true };
  });

/** Settings' per-type area/rate fields. */
export const updateRoomTypeSettingsFn = createServerFn({ method: "POST" })
  .validator(
    (data: { type: RoomType; name?: string; areaSqm: number; pricePerNight: number }) => data,
  )
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireSettingsWriter();
    if (!auth.ok) return auth;
    if (data.areaSqm <= 0 || data.pricePerNight <= 0) {
      return { ok: false, error: "Area and rate must be greater than zero." };
    }
    const name = data.name?.trim();
    if (data.name !== undefined && !name) {
      return { ok: false, error: "Name cannot be empty." };
    }
    await upsertRoomTypeSettings(data.type, {
      name,
      areaSqm: data.areaSqm,
      pricePerNight: data.pricePerNight,
    });
    return { ok: true };
  });

const ADD_ON_LABEL: Record<AddOnServiceKey, string> = {
  earlyCheckIn: "Early check-in fee",
  lateCheckOut: "Late check-out fee",
  extraMattress: "Extra mattress fee",
};

/** Settings' Slice B add-on rate fields. */
export const updateAddOnSettingsFn = createServerFn({ method: "POST" })
  .validator((data: { key: AddOnServiceKey; price: number }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireSettingsWriter();
    if (!auth.ok) return auth;
    if (!Number.isFinite(data.price) || data.price < 0) {
      return { ok: false, error: "Rate must be zero or more." };
    }
    await upsertAddOnSettings(data.key, ADD_ON_LABEL[data.key], Math.round(data.price));
    return { ok: true };
  });

/**
 * The admin Bookings screen's Apply/Decline/Reverse action on a guest's
 * requested service, and its ad-hoc "add charge" for a walk-in the guest
 * never flagged. `resolveRequestedService` in `bookings.ts` holds the actual
 * rule (rate snapshot, note append/clear, the applied/reversed guards); this
 * only loads, asks, and persists.
 */
export const resolveRequestedServiceFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      service: AddOnServiceKey;
      action: "applied" | "declined" | "reversed";
      mattressQty?: number;
    }) => data,
  )
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;
    const current = await load();
    const booking = current.bookings.find((b) => b.id === data.id);
    if (!booking) return { ok: false, error: `Booking ${data.id} does not exist.` };

    const res = resolveRequestedService(
      current,
      booking,
      data.service,
      data.action,
      data.mattressQty,
    );
    if (!res.ok) return res;
    await updateBookingServiceCharge(data.id, res);
    return { ok: true };
  });

/** Settings' room-count field — resizes the floor board to match. */
export const setRoomCountFn = createServerFn({ method: "POST" })
  .validator((data: { type: RoomType; count: number }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireRoomWriter();
    if (!auth.ok) return auth;
    if (!Number.isInteger(data.count) || data.count < 0) {
      return { ok: false, error: "Room count must be a whole number, zero or more." };
    }
    return resizeRoomType(data.type, data.count);
  });

/**
 * The Bookings screen's row actions: check-in, check-out, and the
 * pending/paid payment-status toggle. All three are just `BookingStatus`
 * transitions, so they share the one write `cancelGuestBookingFn` already
 * uses — no new column, no new table.
 *
 * Slice 2: a transition to `checked_in` is re-validated against
 * `checkInEligibilityError` — a booking cannot check in without a room
 * already assigned, nor into a room currently flagged `maintenance`. This
 * runs here (not only at assignment time) because a room can be flagged
 * maintenance after it was assigned but before the guest actually arrives.
 */
export const updateBookingStatusFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: BookingStatus }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;
    const current = await load();
    const booking = current.bookings.find((b) => b.id === data.id);
    if (!booking) {
      return { ok: false, error: `Booking ${data.id} does not exist.` };
    }
    if (data.status === "checked_in") {
      const error = checkInEligibilityError(current, booking);
      if (error) return { ok: false, error };
    }
    await updateBookingStatus(data.id, data.status);
    return { ok: true };
  });

/**
 * Slice 2's room assignment: assign, reassign, or unassign the physical room
 * on a booking, from the Bookings table's Room column or the dashboard's
 * "Assign →" affordance. Guarded the same as every other booking mutation —
 * `assignBookingRoom` in `bookings.ts` holds the actual rule (type match,
 * maintenance hard-stop, overlap conflicts, the checked-in-unassign block).
 */
export const updateBookingRoomFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; roomNo: string | null }) => data)
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;
    const current = await load();
    const res = assignBookingRoom(current, data.id, data.roomNo);
    if (!res.ok) return res;
    await updateBookingRoom(data.id, data.roomNo, res.booking.roomAssignedAt);
    return { ok: true };
  });

/**
 * The Bookings screen's "Mark pending"/"Mark paid" quick actions. Unlike the
 * plain status change above, this one also moves money: pending records the
 * outstanding balance the front desk is naming, and paid clears it into
 * `paidToHotel` — same collection-shape write `verifyRazorpayPaymentFn`
 * already uses, so the two ways a booking's balance can settle share one path.
 *
 * `status` in `BookingStatus` conflates two independent facts: stay stage
 * (confirmed/checked_in/checked_out/…) and pre-arrival payment stage
 * (confirmed vs. pending_payment). Once a guest has checked in or out, that
 * payment distinction stops applying, so this only flips `status` between
 * confirmed/pending_payment while the booking is still pre-arrival — a
 * balance settled or added after check-in/out leaves the stay status alone.
 */
export const setBookingPaymentStatusFn = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; status: "confirmed" | "pending_payment"; pendingAmount?: number }) => data,
  )
  .handler(async ({ data }): Promise<Result> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;
    const current = await load();
    const booking = current.bookings.find((b) => b.id === data.id);
    if (!booking) return { ok: false, error: `Booking ${data.id} does not exist.` };

    if (data.status === "pending_payment") {
      const amount = data.pendingAmount ?? 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: "Enter a pending amount greater than zero." };
      }
      await updateBookingPayment({
        ...booking,
        status: booking.status === "confirmed" ? "pending_payment" : booking.status,
        collection: { ...booking.collection, pending: amount },
      });
    } else {
      await updateBookingPayment({
        ...booking,
        status: booking.status === "pending_payment" ? "confirmed" : booking.status,
        collection: {
          ...booking.collection,
          paidToHotel: booking.collection.paidToHotel + booking.collection.pending,
          pending: 0,
        },
      });
    }
    return { ok: true };
  });

/**
 * Sidebar badges. "Gold badge = N items waiting on you" — so Bookings counts
 * bookings needing attention (no room assigned, or payment still pending) and
 * Guests counts guests whose first stay starts today, both genuine
 * attention-worthy events. Party Hall counts enquiries not yet quoted, same
 * gold treatment. Rooms is informational only (muted badge, see admin-nav.ts)
 * and shows tonight's available count, not a queue.
 */
export const sidebarCounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ bookings: number; partyHall: number; rooms: number; guests: number }> => {
    const data = await load();
    const today = new Date().toISOString().slice(0, 10);

    const firstStayOn = new Map<string, string>();
    for (const b of data.bookings) {
      const earliest = firstStayOn.get(b.guestId);
      if (!earliest || b.checkIn < earliest) firstStayOn.set(b.guestId, b.checkIn);
    }
    const newGuestsToday = data.guests.filter((g) => firstStayOn.get(g.id) === today).length;

    return {
      bookings: data.bookings.filter(
        (b) =>
          (b.roomNo === null && OCCUPYING_STATUSES.has(b.status)) || b.status === "pending_payment",
      ).length,
      partyHall: data.partyHall.filter((e) => e.status === "enquiry").length,
      rooms: await getAvailableRoomCount(data, today),
      guests: newGuestsToday,
    };
  },
);
