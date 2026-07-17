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

  // Guests before bookings — the FK points that way.
  await conn.insert(schema.guests).values(guests).onConflictDoNothing();
  await conn.insert(schema.bookings).values(bookings).onConflictDoNothing();
  await conn.insert(schema.partyHallEnquiries).values(partyHall).onConflictDoNothing();

  console.log(
    `seeded: ${guests.length} guests, ${bookings.length} bookings, ` +
      `${partyHall.length} enquiries`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
