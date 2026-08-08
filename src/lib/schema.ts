// The database schema, and the only place the shape of a row is stated.
//
// Read by `db.ts` and by drizzle-kit, which generates the SQL in `drizzle/`.
// Types in `@/types/booking` stay hand-written; `db.ts` asserts they match what
// is selected here, so a schema change that breaks the derivation fails `tsc`.
//
// Two rules this file keeps:
//
// 1. **Nothing derived is stored.** `totalBill`, `tier` and `advancePaid` all
//    fall out of `withTotal` / `withTier` / `withAdvance` in `lib/bookings.ts`.
//    A column for any of them is a column that can contradict the rule that
//    computes it. Derive, never seed twice — columns included.
//
// 2. **Money is `integer` rupees, never float.** The domain is whole rupees:
//    `computeTotalBill` rounds to the nearest one and `formatINR` shows no
//    paise. Razorpay (#16) speaks paise at the API boundary only — `lib/razorpay.ts`
//    converts at the edge, and the two id columns below are the only trace of a
//    gateway payment stored in `bookings`, both nullable (pay-at-hotel never sets them).

import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const guests = pgTable("guests", {
  // "G-001" — the property's own ids, not surrogates. They appear in the design
  // and on the screens, and bookings already join on them.
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  stays: integer("stays").notNull().default(0),
  lifetimeValue: integer("lifetime_value").notNull().default(0),
  // tier: derived from stays. See rule 1.
});

export const bookings = pgTable("bookings", {
  /** KRC-YYYYMMDD-nnn */
  id: text("id").primaryKey(),
  guestId: text("guest_id")
    .notNull()
    .references(() => guests.id),
  /** null until a physical room is assigned — the Bookings screen counts these. */
  roomNo: text("room_no"),
  roomType: text("room_type").notNull(),
  /** ISO dates. `text`, not `date`: the derivation compares them as strings
   *  (`b.checkIn <= onDate`), and a driver handing back a Date would silently
   *  change what those comparisons mean. */
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out").notNull(),
  urn: integer("urn").notNull(),
  source: text("source").notNull(),
  mealPlan: text("meal_plan").notNull(),

  // Revenue, in rupees.
  revenueRoom: integer("revenue_room").notNull().default(0),
  revenueEarlyCheckIn: integer("revenue_early_check_in").notNull().default(0),
  revenueLateCheckOut: integer("revenue_late_check_out").notNull().default(0),
  revenueOther: integer("revenue_other").notNull().default(0),
  revenueDiscount: integer("revenue_discount").notNull().default(0),
  /** The rate in force the day this was billed — per-row on purpose, so an old
   *  booking cannot silently re-rate itself when the property changes GST. */
  revenueTaxPct: integer("revenue_tax_pct").notNull(),

  // Collection, in rupees.
  collectionPaidToHotel: integer("collection_paid_to_hotel").notNull().default(0),
  collectionOtaCollection: integer("collection_ota_collection").notNull().default(0),
  collectionOtaCommission: integer("collection_ota_commission").notNull().default(0),
  collectionComplimentary: integer("collection_complimentary").notNull().default(0),
  collectionPending: integer("collection_pending").notNull().default(0),
  // totalBill: derived from revenue. See rule 1.

  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),

  /** Set the moment `assignBookingRoom` puts a room on this booking; cleared
   *  back to null on unassign, so a later reassignment reads as a fresh event
   *  rather than the room-assigned notification silently going stale. Null
   *  for every booking that predates this column — there is nothing to
   *  backfill it from. */
  roomAssignedAt: timestamp("room_assigned_at", { withTimezone: true }),

  /** Set once an order is created; null for pay-at-hotel bookings. */
  razorpayOrderId: text("razorpay_order_id"),
  /** Set only after `verifyRazorpaySignature` passes. */
  razorpayPaymentId: text("razorpay_payment_id"),

  /** Shared by every room created in one guest-flow checkout; null for legacy
   *  rows and admin manual entries — see resolveInvoiceParty. */
  batchId: text("batch_id"),

  /** Best-effort guest preferences + freeform note (spec #66/#67), e.g.
   *  `{"preferences":["high_floor","quiet_room"],"note":"arriving ~11pm"}`.
   *  Null — never an empty object — when the guest selected/wrote nothing;
   *  the admin flag reads `IS NOT NULL`, not the JSON's contents, so this
   *  column must never hold `{}` for "no request". */
  specialRequest: jsonb("special_request").$type<{
    preferences: string[];
    note?: string;
  }>(),

  /** Early check-in / late check-out / extra mattress — requested at booking
   *  or added by the admin, resolved (applied/declined) at the admin's
   *  discretion, and an applied charge can later be reversed (Slice B). A
   *  resolved entry's status is overwritten in place, never deleted, so
   *  whether a request was ever honoured — and whether an honoured one was
   *  later undone — stays on the row. Null — never `{}` — when nothing was
   *  ever requested or added. */
  requestedServices: jsonb("requested_services").$type<{
    earlyCheckIn?: { requested: boolean; status: "pending" | "applied" | "declined" | "reversed" };
    lateCheckOut?: { requested: boolean; status: "pending" | "applied" | "declined" | "reversed" };
    extraMattress?: {
      requested: boolean;
      status: "pending" | "applied" | "declined" | "reversed";
      qty: number;
    };
  }>(),
  /** Readable trail of what's inside `revenueOther` (Slice B), e.g. "Extra
   *  mattress ×2" — appended to, never overwritten, so a second "other"
   *  charge can't silently erase the first one's label. Null until the first
   *  charge lands. */
  revenueOtherNote: text("revenue_other_note"),
});

export const partyHallEnquiries = pgTable("party_hall_enquiries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  /** ISO date — same string-comparison reason as bookings. */
  date: text("date").notNull(),
  slot: text("slot").notNull(),
  guests: integer("guests").notNull(),
  /** Package tier name, matching a `PartyHallPackage` — e.g. "Platinum". */
  package: text("package").notNull(),
  /** A short list rendered as tags. jsonb keeps it one row, one event. */
  addOns: jsonb("add_ons").$type<string[]>().notNull().default([]),
  status: text("status").notNull(),
  /** Quoted total in rupees; 0 until quoted, which the screen renders "₹—". */
  amount: integer("amount").notNull().default(0),
  // advancePaid: derived from amount + status. See rule 1.

  /** Set once, by `sendPartyHallQuote`. Null for rows quoted before this
   *  column existed — the "Quoted ₹X" label degrades to no date rather than
   *  rendering "on null" for those. */
  quotedAt: timestamp("quoted_at", { withTimezone: true }),
  /** Set once, by `sendPartyHallQuote`, alongside `amount`/`quotedAt` — the
   *  package base plus each add-on, at the rate resolved at that exact
   *  moment. Label and amount stored together, never a rate-key id, so
   *  rendering it later needs no lookup against (possibly since-changed)
   *  Settings. Null for rows quoted before this column existed; never
   *  backfilled and never recomputed on read — a null here means "no
   *  breakdown on record", not "zero-cost". */
  quoteBreakdown: jsonb("quote_breakdown").$type<{ label: string; amount: number }[]>(),
  /** Snapshotted at `recordPartyHallAdvance` time — the source of truth for
   *  display going forward. Never recomputed from a later `phAdvancePct`
   *  edit, which is the whole reason this column exists instead of a live
   *  re-derive. Null for rows that predate it; `withAdvance` falls back to
   *  live amount × pct only in that case. */
  advanceAmount: integer("advance_amount"),
  /** Percentage in force when the advance above was recorded — context only,
   *  never read back into a recompute. */
  advancePct: integer("advance_pct"),
  /** Stamped by `cancelPartyHallEvent` when cancelling out of `advance_paid`
   *  or `confirmed` — i.e. whenever money had already moved. Never cleared;
   *  the advance fields above stay put alongside it as the historical
   *  record, per rule: never wipe a financial record. */
  refundedAt: timestamp("refunded_at", { withTimezone: true }),

  /** Set once, by `createPartyHallEnquiry`, at the moment the guest-facing
   *  form submits. Null for every row that predates this column (seed data,
   *  and any enquiry an admin entered by hand before the form existed) — the
   *  notifications producer skips rows without it, rather than guessing. */
  createdAt: timestamp("created_at", { withTimezone: true }),

  /** Who to bill — enquiries don't carry a guest row, so this is the only
   *  identity captured. Null until the invoice feature needs one and someone
   *  fills it in from the Party Hall screen. */
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),

  /** Channel the enquiry arrived through — `"direct"` for every guest-form
   *  submission (written explicitly by `createPartyHallEnquiry`), `"walk_in"`
   *  / `"phone"` for admin hand-entry. Null means "predates this column",
   *  never backfilled — same convention as `quoteBreakdown`. */
  source: text("source"),
});

/**
 * Who exists. Mirrors `TeamAccount` in `lib/team.ts` — and deliberately carries
 * one column that type does not have.
 */
export const team = pgTable("team", {
  /** Lower-cased on the way in; `normalizeEmail` is the only door. */
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  /** Presence is what makes a member Active, so status stays derived. */
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),

  // !! The one column `TeamAccount` must never gain. !!
  //
  // `lib/team.ts` is client-reachable, and `invites.test.ts` asserts every
  // TeamAccount's keys are exactly [acceptedAt, email, name, role] — that test
  // exists because #12 shipped passwords to every browser. The hash lives here
  // and is read only by `auth.ts`, whose every export is a server function.
  // Never select it into a roster row; never widen TeamAccount to hold it.
  //
  // scrypt (Node core): no native module, nothing to bundle on Lambda. Null
  // until someone accepts an invite and sets one — the Owner never has one,
  // because ADMIN_PASSWORD is the Owner's credential and lives in the env.
  passwordHash: text("password_hash"),
});

export const invites = pgTable("invites", {
  /** The accept link's secret. Single-use, and the primary key. */
  token: text("token").primaryKey(),
  /** Not unique by accident — `createInvite` replaces rather than stacks, so one
   *  person is only ever one row and the newest link is the only live one. */
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  /** The optional note the sender types; it rides along in the email. */
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  /** A week. `inviteStatus` derives Pending/Expired from this, never a column. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * One row per admin: the cutoff their "mark all read" last set. Notifications
 * themselves are never stored — see rule 1 — they're derived from `bookings`
 * each time. Read state is the one thing that genuinely can't be derived, so
 * it's the only column here: no row, or a null `lastReadAt`, means "never
 * read", which is correct for a brand-new admin account.
 */
export const notificationReads = pgTable("notification_reads", {
  memberEmail: text("member_email")
    .primaryKey()
    .references(() => team.email),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
});

/**
 * The physical floor board — one row per real room. Replaces the old
 * compile-time `ROOM_UNITS` list as the source of truth for "which rooms
 * exist" so the admin can add/remove rooms and edit status without a deploy.
 */
export const rooms = pgTable("rooms", {
  no: text("no").primaryKey(),
  floor: integer("floor").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("available"),
  /** Occupant + checkout for occupied rooms, else a short state note. */
  detail: text("detail").notNull().default("Ready"),
});

/**
 * Per-room-type settings that are genuinely editable (name, area, rate) — as
 * opposed to `count`, which is never stored here because it is derived from
 * `rooms`. See rule 1 at the top of this file.
 */
export const roomTypeSettings = pgTable("room_type_settings", {
  type: text("type").primaryKey(),
  name: text("name"),
  areaSqm: integer("area_sqm").notNull(),
  pricePerNight: integer("price_per_night").notNull(),
});

/**
 * Owner-configurable rates for the three priced add-on services (Slice B).
 * Same role as `roomTypeSettings`: the Settings screen edits these rows, and
 * a booking snapshots whatever rate is here at the moment a charge is
 * applied — later rate changes never retroactively touch that booking.
 */
export const addOnSettings = pgTable("addon_settings", {
  /** 'earlyCheckIn' | 'lateCheckOut' | 'extraMattress'. */
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  price: integer("price").notNull().default(0),
});

/**
 * Issued invoices/receipts (design_handoff_krc_invoices). One row per invoice
 * number — numbers are sequential and immutable once issued, so this table
 * exists purely to make "the same reservation always gets the same invoice
 * number" true across repeat downloads, not to store anything derivable; the
 * line items, totals and GST are always recomputed from `bookings` /
 * `partyHallEnquiries` at render time (rule 1, above).
 *
 * `refId` is a booking id (room), a synthetic group id (`KRC-GRP-…`), or a
 * party-hall enquiry id. There is no persisted "reservation group" entity —
 * a group invoice is recognized by bookings sharing one guest and one stay
 * (see `resolveInvoiceTarget` in `lib/invoices.ts`), so `bookingIds` is the
 * only record of which rooms a given group invoice covers.
 */
export const invoices = pgTable("invoices", {
  invoiceNo: text("invoice_no").primaryKey(),
  type: text("type").notNull(),
  refId: text("ref_id").notNull(),
  bookingIds: jsonb("booking_ids").$type<string[]>().notNull().default([]),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
});
