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
import { ROOM_TYPES, ROOM_UNITS } from "@/lib/bookings";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

async function main() {
  const conn = db();
  if (!conn) {
    console.error("DATABASE_URL is not set — nothing to seed.");
    process.exit(1);
  }

  const guests = fixtures.guests.map(({ tier: _tier, ...g }) => g);
  const bookings = fixtures.bookings.map(({ totalBill: _t, revenue, collection, ...b }) => ({
    ...b,
    createdAt: new Date(b.createdAt),
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
  }));
  const partyHall = fixtures.partyHall.map(({ advancePaid: _a, ...e }) => e);

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
