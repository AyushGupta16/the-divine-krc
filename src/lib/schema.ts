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

  /** Set once an order is created; null for pay-at-hotel bookings. */
  razorpayOrderId: text("razorpay_order_id"),
  /** Set only after `verifyRazorpaySignature` passes. */
  razorpayPaymentId: text("razorpay_payment_id"),
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

  /** Who to bill — enquiries don't carry a guest row, so this is the only
   *  identity captured. Null until the invoice feature needs one and someone
   *  fills it in from the Party Hall screen. */
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
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
