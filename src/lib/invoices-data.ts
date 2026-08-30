// The server boundary + row store for invoices (design_handoff_krc_invoices).
//
// Reads `guests`/`bookings`/`partyHallEnquiries` directly rather than calling
// into `bookings-data.ts`'s `load()`: that file's contract is "every export is
// a `createServerFn` handler" — a plain exported function there would carry
// its body, and the `fixtures` it reaches, straight into the client bundle
// unstripped. `notifications-data.ts` hit this first; owning the query here
// keeps the invariant intact. `invoices` itself is this module's own table,
// so it owns get-or-create for that one outright.
//
// The one exception is `toPartyHall`: it's a plain row mapper that only
// touches its typed argument (no `fixtures`/`db` at module scope — see the
// LANDMINE note on `bookings-data.ts`), so importing it is safe and it's the
// single source of truth for a `party_hall_enquiries` row → `PartyHallEnquiry`.
// A second, hand-rolled copy of that mapping used to live here and silently
// dropped `quoteBreakdown`/`advanceAmount`/etc., which forced every
// party-hall invoice to re-derive GST and advance figures live instead of
// rendering the frozen quote.
//
// An invoice number is the one thing that must survive repeat downloads
// unchanged, so issuing is get-or-create: the first request for a given
// `refId` mints a row in `invoices`, and every later request for the same
// `refId` (or the same invoice number) returns that same row.

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import {
  buildGroupInvoice,
  buildPartyHallInvoice,
  buildRoomInvoice,
  resolveInvoiceParty,
  type Invoice,
} from "@/lib/invoices";
import {
  resolvePartyHallGstPct,
  resolvePartyHallRates,
  resolveRoomGstPct,
  withTier,
} from "@/lib/bookings";
import { toBooking } from "@/lib/booking-mappers";
import { toPartyHall } from "@/lib/bookings-data";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { getSessionMember } from "@/lib/auth";
import { db, missingDbInProduction } from "@/lib/db";
import { can, type Result } from "@/lib/team";
import * as schema from "@/lib/schema";
import type { Booking, Guest, PartyHallEnquiry } from "@/types/booking";

type InvoiceRow = typeof schema.invoices.$inferSelect;

function noDb(): void {
  if (missingDbInProduction()) {
    throw new Error(
      "DATABASE_URL is not set. The admin console is unavailable until it is. " +
        "(The marketing site does not read the database and is unaffected.)",
    );
  }
}

async function loadInvoiceParty(): Promise<{
  guests: Guest[];
  bookings: Booking[];
  partyHall: PartyHallEnquiry[];
  roomGstPct: number;
  partyHallGstPct: number;
}> {
  const conn = db();
  if (!conn) {
    noDb();
    return {
      guests: fixtures.guests,
      bookings: fixtures.bookings,
      partyHall: fixtures.partyHall,
      roomGstPct: resolveRoomGstPct(fixtures.gstRateOverride),
      partyHallGstPct: resolvePartyHallGstPct(fixtures.partyHallGstRateOverride),
    };
  }
  const [guestRows, bookingRows, partyHallRows, addOnRows] = await Promise.all([
    conn.select().from(schema.guests).orderBy(schema.guests.id),
    conn.select().from(schema.bookings).orderBy(schema.bookings.id),
    conn.select().from(schema.partyHallEnquiries).orderBy(schema.partyHallEnquiries.id),
    conn.select().from(schema.addOnSettings).orderBy(schema.addOnSettings.id),
  ]);
  // Same map `bookings-data.ts`'s `load()` builds from the same rows — every
  // Party Hall rate id (including `phAdvancePct`) lives in this one table.
  const partyHallRateOverrides = Object.fromEntries(
    addOnRows.map((r) => [r.id, r.price]),
  ) as Parameters<typeof resolvePartyHallRates>[0];
  const advancePct = resolvePartyHallRates(partyHallRateOverrides).phAdvancePct;
  return {
    guests: guestRows.map((r) =>
      withTier({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        city: r.city,
        stays: r.stays,
        lifetimeValue: r.lifetimeValue,
      }),
    ),
    bookings: bookingRows.map(toBooking),
    partyHall: partyHallRows.map((r) => toPartyHall(r, advancePct)),
    roomGstPct: resolveRoomGstPct(addOnRows.find((r) => r.id === "gstPct")?.price),
    partyHallGstPct: resolvePartyHallGstPct(
      addOnRows.find((r) => r.id === "partyHallGstPct")?.price,
    ),
  };
}

// Dev-only fallback so `/invoice` works with no `DATABASE_URL`, same
// module-scoped-but-lazy convenience `notifications-data.ts`'s `mem()` and
// `roster.ts` give their own tables — built on first use, never at module
// scope, so a stripped handler body can't drag it into the client bundle.
let memInvoices: InvoiceRow[] | undefined;

function mem(): InvoiceRow[] {
  memInvoices ??= [];
  return memInvoices;
}

async function findInvoiceByRefId(refId: string): Promise<InvoiceRow | undefined> {
  const conn = db();
  if (!conn) return mem().find((i) => i.refId === refId);
  const rows = await conn.select().from(schema.invoices).where(eq(schema.invoices.refId, refId));
  return rows[0];
}

async function findInvoiceByNo(invoiceNo: string): Promise<InvoiceRow | undefined> {
  const conn = db();
  if (!conn) return mem().find((i) => i.invoiceNo === invoiceNo);
  const rows = await conn
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.invoiceNo, invoiceNo));
  return rows[0];
}

/** The whole dataset is a handful of invoices — filtering in JS beats a jsonb containment query. */
async function findGroupInvoiceContaining(bookingId: string): Promise<InvoiceRow | undefined> {
  const conn = db();
  const rows = conn
    ? await conn.select().from(schema.invoices).where(eq(schema.invoices.type, "group"))
    : mem().filter((i) => i.type === "group");
  return rows.find((r) => r.bookingIds.includes(bookingId));
}

async function nextGroupId(today: string): Promise<string> {
  const conn = db();
  const prefix = `KRC-GRP-${today.replaceAll("-", "")}`;
  const existing = conn
    ? (await conn.select().from(schema.invoices).where(eq(schema.invoices.type, "group"))).map(
        (r) => r.refId,
      )
    : mem()
        .filter((i) => i.type === "group")
        .map((i) => i.refId);
  const todaysSeqs = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length + 1)))
    .filter((n) => !Number.isNaN(n));
  const seq = (todaysSeqs.length > 0 ? Math.max(...todaysSeqs) : 0) + 1;
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

async function insertInvoice(row: InvoiceRow): Promise<void> {
  const conn = db();
  if (!conn) {
    noDb();
    mem().push(row);
    return;
  }
  await conn
    .insert(schema.invoices)
    .values(row)
    .onConflictDoNothing({ target: schema.invoices.invoiceNo });
}

/**
 * Get-or-create the invoice row for a room booking. Bookings sharing one
 * guest and one stay (see `resolveInvoiceParty`) are issued together as a
 * group invoice — there is no separate "create a group" step; two rooms
 * booked together already look like a group by construction.
 */
export const issueInvoiceForBookingFn = createServerFn({ method: "POST" })
  .validator((data: { bookingId: string }) => data)
  .handler(async ({ data }): Promise<Result<{ invoiceNo: string }>> => {
    const { bookings } = await loadInvoiceParty();
    const party = resolveInvoiceParty(data.bookingId, bookings);
    if (party.length === 0) return { ok: false, error: "Booking not found." };

    if (party.length === 1) {
      const existing = await findInvoiceByRefId(data.bookingId);
      if (existing) return { ok: true, invoiceNo: existing.invoiceNo };
      const invoiceNo = `INV-${data.bookingId}`;
      await insertInvoice({
        invoiceNo,
        type: "room",
        refId: data.bookingId,
        bookingIds: [data.bookingId],
        issuedAt: new Date(),
      });
      return { ok: true, invoiceNo };
    }

    const partyIds = party.map((b) => b.id);
    // Idempotent: any invoice already covering one of these bookings is the
    // group's invoice, whichever booking triggered it first.
    const existing = await findGroupInvoiceContaining(data.bookingId);
    if (existing) return { ok: true, invoiceNo: existing.invoiceNo };

    const groupId = await nextGroupId(party[0].checkIn);
    const invoiceNo = `INV-${groupId}`;
    await insertInvoice({
      invoiceNo,
      type: "group",
      refId: groupId,
      bookingIds: partyIds,
      issuedAt: new Date(),
    });
    return { ok: true, invoiceNo };
  });

export const issueInvoiceForPartyHallFn = createServerFn({ method: "POST" })
  .validator((data: { enquiryId: string }) => data)
  .handler(async ({ data }): Promise<Result<{ invoiceNo: string }>> => {
    const { partyHall } = await loadInvoiceParty();
    const enquiry = partyHall.find((e) => e.id === data.enquiryId);
    if (!enquiry) return { ok: false, error: "Enquiry not found." };

    const existing = await findInvoiceByRefId(data.enquiryId);
    if (existing) return { ok: true, invoiceNo: existing.invoiceNo };
    const invoiceNo = `INV-${data.enquiryId}`;
    await insertInvoice({
      invoiceNo,
      type: "party_hall",
      refId: data.enquiryId,
      bookingIds: [],
      issuedAt: new Date(),
    });
    return { ok: true, invoiceNo };
  });

/**
 * A settled booking's invoice must reconcile against what was actually
 * collected, not against whatever the setting reads today — `revenue.taxPct`
 * is stamped once at `createBooking` and every payment path (Razorpay order
 * amount, cash settlement) charges against that same frozen `totalBill`, so
 * it's already the true charged rate, not just the rate at creation. A
 * booking still owing money hasn't been charged anything yet, so it's fine
 * (and correct) for its invoice to preview the live rate.
 */
export function invoiceRoomGstPct(booking: Booking, liveRoomGstPct: number): number {
  return booking.collection.pending === 0 ? booking.revenue.taxPct : liveRoomGstPct;
}

/** The public `/invoice/:invoiceNo` route's read — no login, matches the README's endpoint. */
export const getInvoiceFn = createServerFn({ method: "GET" })
  .validator((invoiceNo: string) => invoiceNo)
  .handler(async ({ data: invoiceNo }): Promise<Result<{ invoice: Invoice }>> => {
    const row = await findInvoiceByNo(invoiceNo);
    if (!row) return { ok: false, error: "No invoice found for this number." };

    const { guests, bookings, partyHall, roomGstPct, partyHallGstPct } = await loadInvoiceParty();
    const issuedAt = row.issuedAt.toISOString();

    if (row.type === "party_hall") {
      const enquiry = partyHall.find((e) => e.id === row.refId);
      if (!enquiry)
        return { ok: false, error: "The party-hall enquiry behind this invoice was not found." };
      // buildPartyHallInvoice reads the frozen quoteBreakdown (including its
      // GST line) when one exists, so a quoted event's invoice no longer
      // drifts from a later rate change. `partyHallGstPct` here is only the
      // fallback for an enquiry with nothing frozen to read yet (unquoted,
      // or quoted before quoteBreakdown carried a GST line).
      return {
        ok: true,
        invoice: buildPartyHallInvoice(row.invoiceNo, issuedAt, enquiry, partyHallGstPct),
      };
    }

    if (row.type === "group") {
      const members = row.bookingIds
        .map((id) => bookings.find((b) => b.id === id))
        .filter((b): b is Booking => !!b);
      if (members.length === 0)
        return { ok: false, error: "The bookings behind this invoice were not found." };
      const guest = guests.find((g) => g.id === members[0].guestId);
      if (!guest) return { ok: false, error: "The guest behind this invoice was not found." };
      // The group is "paid" only if every member is settled — one still-owing
      // room keeps the whole invoice on the live preview rate, same reasoning
      // as the single-booking case below.
      const groupGstPct = members.every((b) => b.collection.pending === 0)
        ? members[0].revenue.taxPct
        : roomGstPct;
      return {
        ok: true,
        invoice: buildGroupInvoice(row.invoiceNo, issuedAt, row.refId, members, guest, groupGstPct),
      };
    }

    const booking = bookings.find((b) => b.id === row.refId);
    if (!booking) return { ok: false, error: "The booking behind this invoice was not found." };
    const guest = guests.find((g) => g.id === booking.guestId);
    if (!guest) return { ok: false, error: "The guest behind this invoice was not found." };
    return {
      ok: true,
      invoice: buildRoomInvoice(
        row.invoiceNo,
        issuedAt,
        booking,
        guest,
        invoiceRoomGstPct(booking, roomGstPct),
      ),
    };
  });

async function requireInvoiceReader(): Promise<Result> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to view this." };
  if (!can(member.role, "bookings:write") && !can(member.role, "settings:write")) {
    return { ok: false, error: `A ${member.role} account cannot view invoices.` };
  }
  return { ok: true };
}

/** Admin re-download from a Bookings/Payments/Party Hall row action. */
export const adminIssueInvoiceFn = createServerFn({ method: "POST" })
  .validator((data: { kind: "booking" | "party_hall"; id: string }) => data)
  .handler(async ({ data }): Promise<Result<{ invoiceNo: string }>> => {
    const auth = await requireInvoiceReader();
    if (!auth.ok) return auth;
    return data.kind === "party_hall"
      ? issueInvoiceForPartyHallFn({ data: { enquiryId: data.id } })
      : issueInvoiceForBookingFn({ data: { bookingId: data.id } });
  });
