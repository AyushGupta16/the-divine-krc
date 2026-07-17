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
//    paise. Razorpay (#16) speaks paise and is authoritative when it lands; that
//    is where paise columns belong, decided alongside the money semantics rather
//    than smuggled in here.

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
});

// `team` and `invites` are deliberately NOT here yet.
//
// They arrive in the next PR, together with the writes that use them. Creating
// them now would mean a `team` table sitting unread beside the live roster array
// in `lib/team.ts` — two rosters, which is exactly the bug #18 fixed. And their
// mutations (`createInvite`, `acceptInvite`, …) are synchronous array operations
// that `invites.test.ts` exercises with no database; moving them needs a
// rules/storage split worth its own review, not a footnote to this one.
//
// Migrations are additive-only from here (the migration Action races Netlify's
// deploy), so adding those two tables later costs nothing that adding them now
// would save.
