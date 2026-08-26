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
import { and, desc, eq } from "drizzle-orm";

import {
  assignBookingRoom,
  cancelGuestBooking,
  cancelPartyHallEvent,
  canDeleteRoom,
  checkAvailability,
  checkInEligibilityError,
  computePartyHallQuote,
  completePartyHallEvent,
  confirmPartyHallEvent,
  isPartyHallEventPastDue,
  createBooking,
  createGuest,
  createPartyHallEnquiry,
  declinePartyHallEnquiry,
  DIRECT_SOURCES,
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
  resolvePartyHallGstPct,
  resolvePartyHallRates,
  resolveRequestedService,
  resolveRoomGstPct,
  resolveRoomTypes,
  sendPartyHallQuote,
  updateGuest,
  validateAddRoom,
  validateGstPct,
  withAdvance,
  withTier,
  withTotal,
  type AddOnRates,
  type AvailabilityQuery,
  type BookingData,
  type GuestBookingLookup,
  type NewBookingInput,
  type NewGuestInput,
  type NewPartyHallEnquiryInput,
  type RoomTypeInfo,
} from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { getSessionMember, requireServerPermission } from "@/lib/auth";
import { db, missingDbInProduction } from "@/lib/db";
import {
  createRazorpayOrder,
  razorpayKeyId,
  resolvePaymentMetadata,
  verifyRazorpaySignature,
} from "@/lib/razorpay";
import * as schema from "@/lib/schema";
import { can, type Result } from "@/lib/team";
import { toBooking } from "@/lib/booking-mappers";
import type {
  AddOnServiceKey,
  Booking,
  BookingRevenue,
  BookingsPageData,
  BookingStatus,
  CalendarPageData,
  DashboardData,
  Guest,
  GuestsPageData,
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

function toRoomTile(r: RoomRow): RoomTile {
  return {
    no: r.no,
    floor: r.floor as 1 | 2,
    type: r.type as RoomType,
    status: r.status as RoomStatus,
    detail: r.detail,
    sizeSqm: r.sizeSqm,
  };
}

export function toPartyHall(r: PartyHallRow, advancePct: number): PartyHallEnquiry {
  return withAdvance(
    {
      id: r.id,
      title: r.title,
      // 5d contract (0020): the native date column is the sole source of
      // record now — the old TEXT `date` column has been dropped.
      date: r.enquiryDate,
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
/** Last N GST rate changes shown on the Settings panel — "keep it simple",
 *  no pagination. */
const GST_HISTORY_LIMIT = 10;

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
  const [guestRows, bookingRows, partyHallRows, roomRows, roomTypeRows, addOnRows, gstHistoryRows] =
    await Promise.all([
      conn.select().from(schema.guests).orderBy(schema.guests.id),
      conn.select().from(schema.bookings).orderBy(schema.bookings.id),
      conn.select().from(schema.partyHallEnquiries).orderBy(schema.partyHallEnquiries.id),
      conn.select().from(schema.rooms).orderBy(schema.rooms.no),
      conn.select().from(schema.roomTypeSettings).orderBy(schema.roomTypeSettings.type),
      conn.select().from(schema.addOnSettings).orderBy(schema.addOnSettings.id),
      conn
        .select()
        .from(schema.gstRateHistory)
        .orderBy(desc(schema.gstRateHistory.changedAt))
        .limit(GST_HISTORY_LIMIT),
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
  const gstRateOverride = addOnRows.find((r) => r.id === "gstPct")?.price;
  const partyHallGstRateOverride = addOnRows.find((r) => r.id === "partyHallGstPct")?.price;

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
    gstRateOverride,
    partyHallGstRateOverride,
    gstHistory: gstHistoryRows.map((r) => ({
      rateType: r.rateType as "room" | "party_hall",
      fromPct: r.fromPct,
      toPct: r.toPct,
      changedBy: r.changedBy,
      changedAt: r.changedAt.toISOString(),
    })),
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
    checkInDate: booking.checkIn,
    checkOutDate: booking.checkOut,
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
 * Slice 3's audit-log write, called only from the two writers below, after
 * the status update they guard has already landed. Neon's HTTP driver has no
 * multi-statement transaction here (see the note on `insertBooking` above),
 * so this is deliberately non-atomic with the status write it logs: a failed
 * insert here is a gap in the log, never a reason to fail or roll back the
 * booking mutation the user actually asked for. Every error is swallowed and
 * logged, not rethrown — callers never `await` for failure here.
 *
 * Skips the insert entirely when `fromStatus === toStatus`: several callers
 * (`setBookingPaymentStatusFn`'s pre-arrival guard, `recordCashPaymentFn`'s
 * partial-payment case) call the writers below without always moving
 * `status`, and a same-status write is not a transition — logging one would
 * fabricate history that never happened.
 */
async function recordStatusChange(
  bookingId: string,
  fromStatus: BookingStatus | null,
  toStatus: BookingStatus,
  changedBy: string | null,
): Promise<void> {
  if (fromStatus === toStatus) return;
  try {
    const conn = db();
    const changedAt = new Date();
    if (!conn) {
      fixtures.statusHistory.push({
        bookingId,
        fromStatus,
        toStatus,
        changedBy,
        changedAt: changedAt.toISOString(),
      });
      return;
    }
    await conn.insert(schema.bookingStatusHistory).values({
      bookingId,
      fromStatus,
      toStatus,
      changedBy,
      changedAt,
    });
  } catch (err) {
    console.error(`Failed to record status history for booking ${bookingId}:`, err);
  }
}

/**
 * Spec 15's cancel action — the first `UPDATE` against `bookings`. Same
 * fixtures-mutation convenience as `insertBooking` when there is no database.
 */
async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  previousStatus: BookingStatus,
  changedBy: string | null,
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const booking = fixtures.bookings.find((b) => b.id === bookingId);
    if (booking) booking.status = status;
  } else {
    await conn.update(schema.bookings).set({ status }).where(eq(schema.bookings.id, bookingId));
  }
  await recordStatusChange(bookingId, previousStatus, status, changedBy);
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
 * decided — status, the now-settled collection, the two id columns
 * `schema.ts` reserves for a gateway payment, and the payment-instrument
 * metadata (`paymentMethod`/`paidAt`), all in one write. Same
 * fixtures-mutation convenience as the other row-store helpers when there is
 * no database.
 */
async function updateBookingPayment(
  booking: Booking,
  previousStatus: BookingStatus,
  changedBy: string | null,
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const existing = fixtures.bookings.find((b) => b.id === booking.id);
    if (existing) Object.assign(existing, booking);
  } else {
    await conn
      .update(schema.bookings)
      .set({
        status: booking.status,
        collectionPaidToHotel: booking.collection.paidToHotel,
        collectionPending: booking.collection.pending,
        razorpayOrderId: booking.razorpayOrderId ?? null,
        razorpayPaymentId: booking.razorpayPaymentId ?? null,
        paymentMethod: booking.paymentMethod ?? null,
        paidAt: booking.paidAt ? new Date(booking.paidAt) : null,
        recordedBy: booking.recordedBy ?? null,
      })
      .where(eq(schema.bookings.id, booking.id));
  }
  await recordStatusChange(booking.id, previousStatus, booking.status, changedBy);
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
    enquiryDate: enquiry.date,
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

/** Terminal step past `confirmed` — the event happened. */
export const completePartyHallEventFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    runPartyHallTransition(data.id, (current) => completePartyHallEvent(current, data.id)),
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
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireSettingsWriter();
      if (!auth.ok) return auth;
      if (!Number.isFinite(data.price) || data.price < 0) {
        return { ok: false, error: "Rate must be zero or more." };
      }
      await upsertPartyHallRate(data.key, PARTY_HALL_RATE_LABEL_FOR_SAVE[data.key], data.price);
      return { ok: true };
    }),
  );

function noDbInsert(): void {
  if (missingDbInProduction()) {
    throw new Error(
      "DATABASE_URL is not set. The admin console is unavailable until it is. " +
        "(The marketing site does not read the database and is unaffected.)",
    );
  }
}

async function requireBookingWriter(): Promise<
  Result<{ member: NonNullable<Awaited<ReturnType<typeof getSessionMember>>> }>
> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to create a booking." };
  if (!can(member.role, "bookings:write")) {
    return { ok: false, error: `A ${member.role} account cannot create bookings.` };
  }
  return { ok: true, member };
}

async function requireRoomWriter(): Promise<Result> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to manage rooms." };
  if (!can(member.role, "rooms:write")) {
    return { ok: false, error: `A ${member.role} account cannot manage rooms.` };
  }
  return { ok: true };
}

async function requireSettingsWriter(): Promise<
  Result<{ member: NonNullable<Awaited<ReturnType<typeof getSessionMember>>> }>
> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to change settings." };
  if (!can(member.role, "settings:write")) {
    return { ok: false, error: `A ${member.role} account cannot change settings.` };
  }
  return { ok: true, member };
}

/**
 * Every Room Settings write handler runs its body through this rather than
 * a bare `async ({ data }) => {...}`. A normal `{ ok: false, error }` return
 * — `validateAddRoom` blocking a duplicate, `canDeleteRoom` blocking a
 * delete — passes through untouched; only an actual *thrown* exception
 * (a schema mismatch on an unmigrated branch, a Neon timeout, anything)
 * gets caught here. That distinction matters: TanStack Start serializes an
 * uncaught throw into a shape its own client-side deserializer can crash on
 * ("Cannot read properties of undefined (reading 'includes')," reported
 * against #96) — a clean `Result`, which every branch in this file already
 * returns for expected failures, never has that problem. Catching means a
 * genuine server error is exactly as visible to the user as a validation
 * error, instead of an unhandled promise rejection with a blank toast.
 */
async function safely<T extends Result>(fn: () => Promise<T>): Promise<Result> {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Something went wrong — please try again." };
  }
}

/**
 * The Guests directory's standalone "New guest" write. Same
 * fixtures-mutation convenience as `insertRoom` when there is no database —
 * unlike `insertBooking`'s guest half, this always inserts a genuinely new
 * row (`createGuest` already ruled out a phone collision), so no
 * `onConflictDoNothing` guard is needed.
 */
async function insertGuest(guest: Guest): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.guests.push(guest);
    return;
  }
  await conn.insert(schema.guests).values({
    id: guest.id,
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    city: guest.city,
    stays: guest.stays,
    lifetimeValue: guest.lifetimeValue,
  });
}

/**
 * The Guests directory's edit write. Only `name`/`phone`/`email`/`city` are
 * ever set — `stays`/`lifetimeValue` are untouched, same derived-fields
 * discipline `updateGuest` enforces at the rule layer.
 */
async function updateGuestRow(
  id: string,
  patch: { name: string; phone: string; email: string; city: string },
): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const guest = fixtures.guests.find((g) => g.id === id);
    if (guest) Object.assign(guest, patch);
    return;
  }
  await conn.update(schema.guests).set(patch).where(eq(schema.guests.id, id));
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
      sizeSqm: room.sizeSqm,
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

/** Room Settings redesign (slice B): the tariff panel's per-room size field. */
async function updateRoomSize(no: string, sizeSqm: number | null): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    const room = fixtures.rooms.find((r) => r.no === no);
    if (room) room.sizeSqm = sizeSqm;
    return;
  }
  await conn.update(schema.rooms).set({ sizeSqm }).where(eq(schema.rooms.no, no));
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

/** GST's own `addon_settings` row (Room Settings redesign, slice C) — kept
 *  separate from `upsertAddOnSettings` for the same reason party-hall rates
 *  got their own `upsertPartyHallRate`: `AddOnServiceKey` stays exactly the
 *  three room add-ons it always meant. */
async function upsertGstSetting(pct: number): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.gstRateOverride = pct;
    return;
  }
  await conn
    .insert(schema.addOnSettings)
    .values({ id: "gstPct", label: "GST rate", price: pct })
    .onConflictDoUpdate({ target: schema.addOnSettings.id, set: { price: pct } });
}

/** Party-hall's own `addon_settings` row (`partyHallGstPct`) — independent
 *  of the room `gstPct` row above, same upsert shape. */
async function upsertPartyHallGstSetting(pct: number): Promise<void> {
  const conn = db();
  if (!conn) {
    noDbInsert();
    fixtures.partyHallGstRateOverride = pct;
    return;
  }
  await conn
    .insert(schema.addOnSettings)
    .values({ id: "partyHallGstPct", label: "Party hall GST rate", price: pct })
    .onConflictDoUpdate({ target: schema.addOnSettings.id, set: { price: pct } });
}

/**
 * The true prior rate for a history row's `fromPct` — read fresh rather than
 * trusted from the client, and resolved through the same
 * `resolveRoomGstPct`/`resolvePartyHallGstPct` fallback the rest of the app
 * uses, so a missing row (no change ever made) still yields the correct
 * default rather than `undefined`. The no-DB branch mirrors this off
 * `fixtures` directly — `fixtures.gstRateOverride`/`partyHallGstRateOverride`
 * are the exact same fields `upsertGstSetting`/`upsertPartyHallGstSetting`
 * mutate above, not a guessed shape.
 */
async function currentGstPct(rateType: "room" | "party_hall"): Promise<number> {
  const conn = db();
  if (!conn) {
    return rateType === "room"
      ? resolveRoomGstPct(fixtures.gstRateOverride)
      : resolvePartyHallGstPct(fixtures.partyHallGstRateOverride);
  }
  const id = rateType === "room" ? "gstPct" : "partyHallGstPct";
  const row = await conn.select().from(schema.addOnSettings).where(eq(schema.addOnSettings.id, id));
  const price = row[0]?.price;
  return rateType === "room" ? resolveRoomGstPct(price) : resolvePartyHallGstPct(price);
}

/**
 * Best-effort audit row for a GST rate change — called after the upsert
 * already succeeded, never before. Same shape as `recordStatusChange` above:
 * the rate change itself is the durable write, this is deliberately
 * non-atomic with it (Neon's HTTP driver has no multi-statement transaction
 * here), and every error is swallowed and logged rather than rethrown — a
 * failed insert here is a gap in the log, never a reason to fail the setting
 * write the owner actually asked for. Skips the insert entirely when
 * `fromPct === toPct`: not a change, so logging one would fabricate history
 * that never happened.
 */
async function insertGstRateHistory(
  rateType: "room" | "party_hall",
  fromPct: number,
  toPct: number,
  changedBy: string | null,
): Promise<void> {
  if (fromPct === toPct) return;
  try {
    const conn = db();
    const changedAt = new Date();
    if (!conn) {
      fixtures.gstRateHistory.push({
        rateType,
        fromPct,
        toPct,
        changedBy,
        changedAt: changedAt.toISOString(),
      });
      return;
    }
    await conn
      .insert(schema.gstRateHistory)
      .values({ rateType, fromPct, toPct, changedBy, changedAt });
  } catch (err) {
    console.error(`Failed to record GST rate history (${rateType}):`, err);
  }
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
 * The "+" chooser's "New guest" write — a standalone guest record, no
 * booking attached. Same three beats as `createBookingFn`; `createGuest`
 * holds the phone-collision rule.
 */
export const createGuestFn = createServerFn({ method: "POST" })
  .validator((data: NewGuestInput) => data)
  .handler(async ({ data }): Promise<Result<{ guest: Guest }>> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;

    const current = await load();
    const res = createGuest(current, data);
    if (!res.ok) return res;

    await insertGuest(res.guest);
    return { ok: true, guest: res.guest };
  });

/**
 * The Guests directory's edit write — corrects an existing guest's details.
 * `updateGuest` re-runs the same phone-collision rule as `createGuestFn`,
 * excluding the guest's own row.
 */
export const updateGuestFn = createServerFn({ method: "POST" })
  .validator((data: { id: string } & NewGuestInput) => data)
  .handler(async ({ data }): Promise<Result<{ guest: Guest }>> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;

    const current = await load();
    const res = updateGuest(current, data.id, data);
    if (!res.ok) return res;

    await updateGuestRow(data.id, {
      name: res.guest.name,
      phone: res.guest.phone,
      email: res.guest.email,
      city: res.guest.city,
    });
    return { ok: true, guest: res.guest };
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
 * The current live GST rates (room and party-hall, independently) for the
 * guest booking flow — public and read-only, same reasoning as
 * `getRoomTypesFn`/`getAddOnRatesFn`: GST is always the live setting, never
 * a build-time constant, so `/book`'s price and tax-label must fetch it
 * rather than importing `GST_PCT` directly.
 */
export const getGstRatesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ roomGstPct: number; partyHallGstPct: number }> => {
    try {
      const current = await load();
      return {
        roomGstPct: resolveRoomGstPct(current.gstRateOverride),
        partyHallGstPct: resolvePartyHallGstPct(current.partyHallGstRateOverride),
      };
    } catch (err) {
      console.error("getGstRatesFn: DB load failed, serving default rates", err);
      return { roomGstPct: resolveRoomGstPct(), partyHallGstPct: resolvePartyHallGstPct() };
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
    const previousStatus = current.bookings.find((b) => b.id === data.bookingId)?.status;
    const res = cancelGuestBooking(current, data.bookingId, data.contact);
    if (!res.ok) return res;

    // Public, no-login path (guest self-cancel via /booking-lookup) — there is
    // no session to attribute this to, unlike every admin-side status write.
    // `changedBy: null` here is the genuine "no session" case the history
    // schema reserves the column for, not a fallback for a broken auth check.
    await updateBookingStatus(res.booking.id, "cancelled", previousStatus ?? "cancelled", null);
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
 *
 * `resolvePaymentMetadata` runs before the settlement write, not after —
 * it cannot throw (falls back to `"online"` + now), so `markBookingPaid` +
 * `updateBookingPayment` stays the single write that always happens once
 * the signature is verified. A payment that verified never fails because a
 * secondary Razorpay lookup blipped.
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

    const { method, paidAt } = await resolvePaymentMetadata(data.razorpayPaymentId);

    const settled: Booking[] = [];
    for (const id of data.bookingIds) {
      const current = await load();
      const previousStatus = current.bookings.find((b) => b.id === id)?.status;
      const res = markBookingPaid(
        current,
        id,
        data.razorpayOrderId,
        data.razorpayPaymentId,
        method,
        paidAt,
      );
      if (!res.ok) return res;
      // Razorpay's checkout callback, not an admin session — the guest who
      // just paid is never a signed-in team member, so there is genuinely no
      // session member to attribute this to. `changedBy: null` records that
      // honestly rather than inventing a system email.
      await updateBookingPayment(res.booking, previousStatus ?? res.booking.status, null);
      settled.push(res.booking);
    }
    return { ok: true, bookings: settled };
  });

/**
 * Front desk cash collection — the "Record payment" button on the Payments
 * screen, and (unify slice) direct-row "Mark paid" on Bookings. Option A
 * scope: settles against the outstanding balance only, no backfill of
 * bookings already settled. Pending is re-read from the loaded booking (the
 * same `collection.pending` `getPaymentsPageData` derives its own pending
 * transactions from) rather than trusted from the client, so a stale amount
 * on screen can't produce an over-payment. `paymentMethod` is only ever set
 * here when it's still unset — a booking that already took an online advance
 * keeps that method, since this write only ever adds the cash top-up, not
 * the instrument that settled the rest.
 *
 * Status flip is partial-aware, unlike `setBookingPaymentStatusFn`'s
 * all-or-nothing settlement: a `pending_payment` row only flips to
 * `confirmed` once this payment clears its balance to zero. A partial
 * payment leaves `pending_payment` in place (there's still money owed), and
 * a booking that's already `confirmed` (or any other status) is never
 * touched — this never moves a row backwards.
 */
export const recordCashPaymentFn = createServerFn({ method: "POST" })
  .validator((data: { bookingId: string; amount: number }) => data)
  .handler(async ({ data }): Promise<Result<{ booking: Booking }>> => {
    const auth = await requireBookingWriter();
    if (!auth.ok) return auth;
    const member = await getSessionMember();
    if (!member) return { ok: false, error: "Sign in to record a payment." };

    const current = await load();
    const booking = current.bookings.find((b) => b.id === data.bookingId);
    if (!booking) return { ok: false, error: `Booking ${data.bookingId} does not exist.` };

    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      return { ok: false, error: "Enter an amount greater than zero." };
    }
    const pending = booking.collection.pending;
    if (data.amount > pending) {
      return {
        ok: false,
        error: `Cannot collect more than the outstanding balance (₹${pending}).`,
      };
    }

    const newPending = pending - data.amount;
    const updated: Booking = {
      ...booking,
      status:
        booking.status === "pending_payment" && newPending === 0 ? "confirmed" : booking.status,
      collection: {
        ...booking.collection,
        paidToHotel: booking.collection.paidToHotel + data.amount,
        pending: newPending,
      },
      paymentMethod: booking.paymentMethod ?? "cash",
      paidAt: new Date().toISOString(),
      recordedBy: member.email,
    };
    await updateBookingPayment(updated, booking.status, member.email);
    return { ok: true, booking: updated };
  });

export const dashboardPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const data = await getDashboardData(await load());
    const member = await getSessionMember();
    if (!member || !can(member.role, "reports:read")) {
      return {
        ...data,
        revenue: [],
      };
    }
    return data;
  },
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
  async (): Promise<PaymentsPageData> => {
    await requireServerPermission("payments:read");
    return getPaymentsPageData(await load());
  },
);

/**
 * `CashPaymentForm`'s own data source (both the Payments screen and, in a
 * follow-up, the "+" menu) — every direct/walk-in/phone booking still owing
 * a guest-paid balance. OTA rows are excluded: their `pending` is a channel
 * receivable, not cash the front desk can collect. Same gate as
 * `paymentsPage` (session-only, via the `/admin` route's `beforeLoad`) — this
 * is a read the Payments screen already trusts at that level, not a write.
 * Reads `collection.pending` straight off the loaded booking, the one place
 * that number lives; no parallel formula. Same session-only gate as
 * `notificationsFn` — an unauthenticated caller gets an empty list rather
 * than a thrown error, since this is a read, not a write.
 */
export const getOpenBalanceDirectBookingsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ bookingId: string; guestName: string; pending: number }[]> => {
    const member = await getSessionMember();
    if (!member) return [];

    const current = await load();
    const guestName = new Map(current.guests.map((g) => [g.id, g.name]));
    return current.bookings
      .filter((b) => DIRECT_SOURCES.has(b.source) && b.collection.pending > 0)
      .map((b) => ({
        bookingId: b.id,
        guestName: guestName.get(b.guestId) ?? "—",
        pending: b.collection.pending,
      }));
  },
);

export const reportsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReportsPageData> => {
    await requireServerPermission("reports:read");
    return getReportsPageData(await load());
  },
);

export const settingsPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsPageData> => {
    const member = await getSessionMember();
    if (!member || (!can(member.role, "settings:write") && !can(member.role, "team:manage"))) {
      await requireServerPermission("settings:write");
    }
    // The roster is a separate load, not part of `BookingData`: it is the one
    // screen that reads both, and folding people into "booking rows" would put
    // `lib/team.ts` back in reach of everything that reads a booking.
    //
    // Dynamic, not a static top-of-file import: `bookings-data.ts` is
    // client-reachable (route loaders import it directly), so a static
    // `import { loadRoster } from "@/lib/roster"` is a module-level edge the
    // bundler can retain even though this handler itself never runs in the
    // browser — the same class of leak `auth.ts` avoids the same way for
    // `requireAuth`. A dynamic `import()` runs only inside this handler, so
    // nothing follows it into a client chunk.
    const [data, { loadRoster }] = await Promise.all([load(), import("@/lib/roster")]);
    const roster = await loadRoster();
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

/** Settings' "Add room" form. `validateAddRoom` holds the duplicate-number
 *  rule — same pure-rule-then-persist shape as `createGuest`'s phone guard. */
export const addRoomFn = createServerFn({ method: "POST" })
  .validator((data: { no: string; floor: 1 | 2; type: RoomType }) => data)
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireRoomWriter();
      if (!auth.ok) return auth;
      const current = await load();
      const no = data.no.trim();
      const check = validateAddRoom(current.rooms ?? [], no, data.floor, data.type);
      if (!check.ok) return check;
      await insertRoom({
        no,
        floor: data.floor,
        type: data.type,
        status: "available",
        detail: "Ready",
        sizeSqm: null,
      });
      return { ok: true };
    }),
  );

/** Settings' per-room inline floor/type edit. */
export const updateRoomDetailsFn = createServerFn({ method: "POST" })
  .validator((data: { no: string; floor: 1 | 2; type: RoomType }) => data)
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireRoomWriter();
      if (!auth.ok) return auth;
      const current = await load();
      if (!(current.rooms ?? []).some((r) => r.no === data.no)) {
        return { ok: false, error: `Room ${data.no} does not exist.` };
      }
      await updateRoomDetails(data.no, data.floor, data.type);
      return { ok: true };
    }),
  );

/** Settings' per-room "Remove" action. `canDeleteRoom` blocks on ANY booking
 *  history for the room, not just active stays — no cascade, no soft-delete. */
export const removeRoomFn = createServerFn({ method: "POST" })
  .validator((data: { no: string }) => data)
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireRoomWriter();
      if (!auth.ok) return auth;
      const current = await load();
      if (!canDeleteRoom(current.bookings, data.no)) {
        return {
          ok: false,
          error: `Room ${data.no} has booking history and can't be deleted.`,
        };
      }
      await deleteRoom(data.no);
      return { ok: true };
    }),
  );

/** Room Settings redesign (slice C): per-room size field, blur-to-save. */
export const updateRoomSizeFn = createServerFn({ method: "POST" })
  .validator((data: { no: string; sizeSqm: number | null }) => data)
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireRoomWriter();
      if (!auth.ok) return auth;
      const current = await load();
      if (!(current.rooms ?? []).some((r) => r.no === data.no)) {
        return { ok: false, error: `Room ${data.no} does not exist.` };
      }
      if (data.sizeSqm !== null && (!Number.isFinite(data.sizeSqm) || data.sizeSqm <= 0)) {
        return { ok: false, error: "Size must be greater than zero." };
      }
      await updateRoomSize(data.no, data.sizeSqm);
      return { ok: true };
    }),
  );

/** Settings' per-type area/rate fields. */
export const updateRoomTypeSettingsFn = createServerFn({ method: "POST" })
  .validator(
    (data: { type: RoomType; name?: string; areaSqm: number; pricePerNight: number }) => data,
  )
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
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
    }),
  );

const ADD_ON_LABEL: Record<AddOnServiceKey, string> = {
  earlyCheckIn: "Early check-in fee",
  lateCheckOut: "Late check-out fee",
  extraMattress: "Extra mattress fee",
};

/** Settings' Slice B add-on rate fields. */
export const updateAddOnSettingsFn = createServerFn({ method: "POST" })
  .validator((data: { key: AddOnServiceKey; price: number }) => data)
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireSettingsWriter();
      if (!auth.ok) return auth;
      if (!Number.isFinite(data.price) || data.price < 0) {
        return { ok: false, error: "Rate must be zero or more." };
      }
      await upsertAddOnSettings(data.key, ADD_ON_LABEL[data.key], Math.round(data.price));
      return { ok: true };
    }),
  );

/** Room Settings redesign (slice C): GST's own editable rate, same
 *  blur-to-save round-trip as the add-on rates above. Unlike a plain add-on
 *  rate, 0 and >100 are both rejected, not just negative — a tax rate has no
 *  legitimate reason to be either, and this is the one field on the panel
 *  where a fat-fingered value has compliance consequences on every invoice
 *  issued after it saves. */
export const updateGstSettingsFn = createServerFn({ method: "POST" })
  .validator((data: { pct: number }) => data)
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireSettingsWriter();
      if (!auth.ok) return auth;
      const check = validateGstPct(data.pct);
      if (!check.ok) return check;
      const fromPct = await currentGstPct("room");
      const toPct = Math.round(data.pct);
      await upsertGstSetting(toPct);
      await insertGstRateHistory("room", fromPct, toPct, auth.member.email);
      return { ok: true };
    }),
  );

/** Party-hall's own editable GST rate — same round-trip and bounds as
 *  `updateGstSettingsFn`, independent `addon_settings` row. */
export const updatePartyHallGstSettingsFn = createServerFn({ method: "POST" })
  .validator((data: { pct: number }) => data)
  .handler(({ data }): Promise<Result> =>
    safely(async () => {
      const auth = await requireSettingsWriter();
      if (!auth.ok) return auth;
      const check = validateGstPct(data.pct);
      if (!check.ok) return check;
      const fromPct = await currentGstPct("party_hall");
      const toPct = Math.round(data.pct);
      await upsertPartyHallGstSetting(toPct);
      await insertGstRateHistory("party_hall", fromPct, toPct, auth.member.email);
      return { ok: true };
    }),
  );

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
    await updateBookingStatus(data.id, data.status, booking.status, auth.member.email);
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
      await updateBookingPayment(
        {
          ...booking,
          status: booking.status === "confirmed" ? "pending_payment" : booking.status,
          collection: { ...booking.collection, pending: amount },
        },
        booking.status,
        auth.member.email,
      );
    } else {
      await updateBookingPayment(
        {
          ...booking,
          status: booking.status === "pending_payment" ? "confirmed" : booking.status,
          collection: {
            ...booking.collection,
            paidToHotel: booking.collection.paidToHotel + booking.collection.pending,
            pending: 0,
          },
        },
        booking.status,
        auth.member.email,
      );
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
      // "Needs attention" for the coarse sidebar signal: a fresh enquiry
      // needing a quote, or a confirmed event whose date passed without
      // being marked completed — both genuinely need an admin to act, just
      // on different pages of the pipeline. The in-page screen keeps these
      // as two distinct pills/stats; this single scalar can only carry one
      // number, so it folds them (see #102's audit).
      partyHall: data.partyHall.filter(
        (e) => e.status === "enquiry" || isPartyHallEventPastDue(e, today),
      ).length,
      rooms: await getAvailableRoomCount(data, today),
      guests: newGuestsToday,
    };
  },
);
