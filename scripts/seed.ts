// Load the fixtures into a database. `npm run db:seed`.
//
// The fixtures are the seed — there is no second copy of the rows to drift.
// `derive, never seed twice` applies here too: what is inserted is only what is
// stored, so `tier`, `totalBill` and `advancePaid` are dropped on the way in and
// recomputed on the way out.
//
// Idempotent: `ON CONFLICT DO NOTHING`, so running it twice is a no-op rather
// than a crash, and running it against a populated database leaves it alone.
//
// Never run against production. It exists for a fresh local database and, later,
// for the preview branch (#14). It has no delete path on purpose.

import { fixtures } from "@/lib/__fixtures__/bookings";
import { openInvite, team as roster } from "@/lib/__fixtures__/team";
import { PARTY_HALL_RATE_DEFAULTS, ROOM_TYPES, ROOM_UNITS } from "@/lib/bookings";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import type { PartyHallRateKey } from "@/types/booking";

const PARTY_HALL_RATE_LABEL: Record<PartyHallRateKey, string> = {
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

async function main() {
  // Opt-in, not a blocklist: guessing the wrong prod host string is worse than
  // requiring an explicit flag. Netlify's production context must never set
  // ALLOW_SEED, so a stray `npm run db:seed` there fails closed instead of
  // reseeding real guest data.
  if (process.env.ALLOW_SEED !== "true") {
    console.error(
      "Refusing to seed: ALLOW_SEED=true is not set. This guards production — " +
        "set ALLOW_SEED=true only when DATABASE_URL points at a dev/throwaway database.",
    );
    process.exit(1);
  }

  const conn = db();
  if (!conn) {
    console.error("DATABASE_URL is not set — nothing to seed.");
    process.exit(1);
  }

  const guests = fixtures.guests.map(({ tier: _tier, ...g }) => g);
  const bookings = fixtures.bookings.map(
    ({ totalBill: _t, revenue, collection, checkIn, checkOut, ...b }) => ({
      ...b,
      // 5d contract (0020): the TEXT check_in/check_out columns are gone; the
      // domain checkIn/checkOut seed straight into the native date columns.
      checkInDate: checkIn,
      checkOutDate: checkOut,
      createdAt: new Date(b.createdAt),
      roomAssignedAt: b.roomAssignedAt ? new Date(b.roomAssignedAt) : null,
      paidAt: b.paidAt ? new Date(b.paidAt) : null,
      revenueRoom: revenue.room,
      revenueEarlyCheckIn: revenue.earlyCheckIn,
      revenueLateCheckOut: revenue.lateCheckOut,
      revenueOther: revenue.other,
      revenueDiscount: revenue.discount,
      revenueTaxPct: revenue.taxPct,
      collectionPaidToHotel: collection.paidToHotel,
      collectionOtaCollection: collection.otaCollection,
      collectionOtaCommission: collection.otaCommission,
      collectionComplimentary: collection.complimentary,
      collectionPending: collection.pending,
    }),
  );
  const partyHall = fixtures.partyHall.map(({ advancePaid: _a, date, ...e }) => ({
    ...e,
    // 5d contract (0020): the TEXT `date` column is gone; the domain `date`
    // seeds straight into the native enquiry_date column.
    enquiryDate: date,
    createdAt: e.createdAt ? new Date(e.createdAt) : null,
    quotedAt: e.quotedAt ? new Date(e.quotedAt) : null,
    refundedAt: e.refundedAt ? new Date(e.refundedAt) : null,
  }));

  // No password hash. The seeded staff accepted long before the console existed,
  // so nothing here has any business inventing a credential for them — a null
  // hash says "Active but nobody can log in as them", which is the truth. The
  // Owner never gets one either: ADMIN_PASSWORD is the Owner's credential and
  // lives in the env, so it is not in this table to steal.
  const members = roster.map((m) => ({
    email: m.email,
    name: m.name,
    role: m.role,
    acceptedAt: m.acceptedAt ? new Date(m.acceptedAt) : null,
  }));

  // A fresh token per run — a token committed to a public repo is a token
  // anyone can redeem, and this seed reaches production until #14.
  const invite = openInvite();

  // The floor board and its per-type overrides — spec 18's `rooms` /
  // `room_type_settings` tables. `name` starts null: it only exists as an
  // override once someone edits it in Settings, same as area/rate.
  const rooms = ROOM_UNITS.map((r) => ({
    no: r.no,
    floor: r.floor,
    type: r.type,
    status: "available" as const,
    detail: "Ready",
  }));
  const roomTypeSettings = ROOM_TYPES.map((rt) => ({
    type: rt.type,
    name: null,
    areaSqm: rt.areaSqm,
    pricePerNight: rt.pricePerNight,
  }));

  // Guests before bookings — the FK points that way.
  await conn.insert(schema.guests).values(guests).onConflictDoNothing();
  await conn.insert(schema.bookings).values(bookings).onConflictDoNothing();
  await conn.insert(schema.partyHallEnquiries).values(partyHall).onConflictDoNothing();
  await conn.insert(schema.rooms).values(rooms).onConflictDoNothing();
  await conn.insert(schema.roomTypeSettings).values(roomTypeSettings).onConflictDoNothing();
  // Slice 2a's ten Party Hall rates — placeholders until the owner confirms
  // real numbers (see PARTY_HALL_PLACEHOLDER_KEYS). Seeded so they're visible
  // and editable in Settings from day one, not just a code-level fallback.
  await conn
    .insert(schema.addOnSettings)
    .values(
      (Object.keys(PARTY_HALL_RATE_DEFAULTS) as PartyHallRateKey[]).map((id) => ({
        id,
        label: PARTY_HALL_RATE_LABEL[id],
        price: PARTY_HALL_RATE_DEFAULTS[id],
      })),
    )
    .onConflictDoNothing();
  await conn.insert(schema.team).values(members).onConflictDoNothing();
  await conn
    .insert(schema.invites)
    .values({
      token: invite.token,
      email: invite.email,
      role: invite.role,
      message: invite.message ?? null,
      createdAt: new Date(invite.createdAt),
      expiresAt: new Date(invite.expiresAt),
    })
    .onConflictDoNothing();

  console.log(
    `seeded: ${guests.length} guests, ${bookings.length} bookings, ` +
      `${partyHall.length} enquiries, ${rooms.length} rooms, ${roomTypeSettings.length} room types, ` +
      `${members.length} members, 1 open invite`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
