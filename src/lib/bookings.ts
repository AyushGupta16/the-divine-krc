// Derivation layer for the booking system: the rules that turn rows into the
// view model each admin screen renders.
//
// !! THIS FILE HOLDS NO DATA, AND MUST NOT. !!
//
// Route loaders import it, so whatever it can reach, the bundler compiles into
// `dist/client` and hands to every anonymous visitor to the landing page. The
// seed rows used to live here, which put ten guests' names and email addresses
// in the entry chunk. Mock names made that survivable; real ones would not.
// The rows now arrive as an argument (`BookingData`) from `bookings.server.ts`,
// whose handler bodies never reach the browser. Same rule as `lib/team.ts`:
// what this file imports is public.
//
// Everything here is a pure function of its arguments, which is what keeps the
// test suite able to run without a database, and what lets the DB swap change
// only where the rows come from — never how they are read.

import type {
  AddOnRateSetting,
  AddOnServiceKey,
  ArrivalItem,
  Booking,
  BookingCollection,
  BookingRevenue,
  BookingSource,
  BookingsPageData,
  BookingStatus,
  CalendarCell,
  CalendarDayDetails,
  CalendarPageData,
  DashboardData,
  Guest,
  GuestListItem,
  GuestPreference,
  GuestRequest,
  GuestsPageData,
  GuestStat,
  GuestTier,
  Occupancy,
  OccupancyBand,
  OtaSettlement,
  PaymentMethod,
  PaymentsKpi,
  PaymentsPageData,
  PaymentsTxnItem,
  PaymentTransaction,
  PartyHallCalendarCell,
  PartyHallCtaKind,
  PartyHallEnquiry,
  PartyHallEventItem,
  PartyHallMiniCalendar,
  PartyHallPackage,
  PartyHallPageData,
  PartyHallPill,
  PartyHallRateKey,
  PartyHallRateSetting,
  PartyHallSlot,
  PartyHallSource,
  PartyHallStat,
  PartyHallStatus,
  PaymentsMonthlyRollup,
  MealPlan,
  MealPlanShare,
  ReportsKpi,
  ReportsPageData,
  ReportsRange,
  RevenueBar,
  RevenuePeriod,
  RevenuePeriodKey,
  RoomTypePerf,
  SourceSlice,
  TransactionStatus,
  RoomFloor,
  RoomsLegendItem,
  RoomsPageData,
  RoomStatus,
  RoomTile,
  RoomType,
  RoomTypeCard,
  ChannelSetting,
  GstSetting,
  PaymentSettings,
  PricingSettings,
  PropertyProfile,
  RequestedServices,
  RoomSettingsRow,
  RoomTariff,
  SettingsPageData,
  SettingsSection,
  TeamMember,
  ToggleSetting,
} from "@/types/booking";
import { GUEST_PREFERENCES } from "@/types/booking";
import {
  computeTotalBill,
  computeTotalCollected,
  formatINR,
  formatINRCompact,
} from "@/lib/booking-math";
import { isActive, type Result, type TeamAccount } from "@/lib/team";
import { initialsOf } from "@/lib/utils";
import { normalizePhone } from "@/lib/whatsapp";

/**
 * Every row an admin screen derives from, fetched once per request and threaded
 * through. One bundle rather than three arguments because most screens read more
 * than one of them, and because the DB swap then changes one signature, not ten.
 */
export interface BookingData {
  bookings: Booking[];
  guests: Guest[];
  partyHall: PartyHallEnquiry[];
  /** The physical floor board. Falls back to the default 14-room inventory
   *  (`ROOM_UNITS`) when omitted, which is what every existing test that
   *  builds a partial `BookingData` still gets. */
  rooms?: RoomTile[];
  /** Per-type area/rate overrides. `count` is never one of these — it is
   *  always derived from `rooms`. */
  roomTypeOverrides?: Partial<
    Record<RoomType, { name?: string; areaSqm: number; pricePerNight: number }>
  >;
  /** Owner-set rates for the three Slice B add-ons. Missing keys fall back to
   *  the defaults below — same "override over default" shape as `roomTypeOverrides`. */
  addOnRateOverrides?: Partial<Record<AddOnServiceKey, number>>;
  /** Owner-set Party Hall rates (Slice 2a). Same "override over default" shape,
   *  resolved by `resolvePartyHallRates`. Placeholder until real numbers land —
   *  see `PARTY_HALL_PLACEHOLDER_KEYS`. */
  partyHallRateOverrides?: Partial<Record<PartyHallRateKey, number>>;
  /** Owner-set room GST rate (Room Settings redesign, slice C) — its own
   *  `addon_settings` row (`gstPct`), same "override over default" shape as
   *  the others. Missing falls back to `GST_PCT`. */
  gstRateOverride?: number;
  /** Owner-set party-hall GST rate — its own `addon_settings` row
   *  (`partyHallGstPct`), independent of the room rate above so the two can
   *  diverge. Missing falls back to `PARTY_HALL_GST_PCT`. */
  partyHallGstRateOverride?: number;
}

export interface AddOnRates {
  earlyCheckIn: number;
  lateCheckOut: number;
  extraMattress: number;
}

export interface RoomTypeInfo {
  type: RoomType;
  name: string;
  pricePerNight: number;
  areaSqm: number;
  count: number;
}

/** Inventory — source of truth per README. */
export const ROOM_TYPES: RoomTypeInfo[] = [
  {
    type: "deluxe",
    name: "Deluxe Room",
    pricePerNight: 1500,
    areaSqm: 24,
    count: 10,
  },
  {
    type: "deluxe_balcony",
    name: "Deluxe Room with Balcony",
    pricePerNight: 1700,
    areaSqm: 26,
    count: 4,
  },
];

/** A physical room: number, floor, and type. Source of truth for inventory. */
export interface RoomUnit {
  no: string;
  floor: 1 | 2;
  type: RoomType;
}

/**
 * The 14 physical rooms. Each floor is 5 Deluxe + 2 Balcony (spec 05); the two
 * balcony rooms sit at the end of each corridor (x06, x07).
 */
export const ROOM_UNITS: RoomUnit[] = [
  { no: "101", floor: 1, type: "deluxe" },
  { no: "102", floor: 1, type: "deluxe" },
  { no: "103", floor: 1, type: "deluxe" },
  { no: "104", floor: 1, type: "deluxe" },
  { no: "105", floor: 1, type: "deluxe" },
  { no: "106", floor: 1, type: "deluxe_balcony" },
  { no: "107", floor: 1, type: "deluxe_balcony" },
  { no: "201", floor: 2, type: "deluxe" },
  { no: "202", floor: 2, type: "deluxe" },
  { no: "203", floor: 2, type: "deluxe" },
  { no: "204", floor: 2, type: "deluxe" },
  { no: "205", floor: 2, type: "deluxe" },
  { no: "206", floor: 2, type: "deluxe_balcony" },
  { no: "207", floor: 2, type: "deluxe_balcony" },
];

/** All 14 physical room numbers across the two floors. */
export const ROOM_NUMBERS: string[] = ROOM_UNITS.map((r) => r.no);

/**
 * The room GST rate's fallback-only default (12) — used solely by
 * `resolveRoomGstPct` when no `gstPct` `addon_settings` row exists yet (a
 * fresh install). Once a rate is set, every read goes through the live
 * `addon_settings` row instead: GST is always the live setting, never frozen
 * at booking-creation time or on an invoice.
 */
export const GST_PCT = 12;

/**
 * Party-hall GST rate's fallback-only default (18) — used solely by
 * `resolvePartyHallGstPct` when no `partyHallGstPct` `addon_settings` row
 * exists yet. Independent of `GST_PCT`; the two rates can diverge once both
 * are set. Lives here rather than in `invoices.ts` so `resolvePartyHallGstPct`
 * can sit next to `resolveRoomGstPct` without a bookings.ts <-> invoices.ts
 * import cycle.
 */
export const PARTY_HALL_GST_PCT = 18;

/** Default add-on rates (Slice B) — what a fresh install bills until the
 *  owner sets a real rate in Settings. Applying a charge always snapshots
 *  whatever `resolveAddOnRates` resolves to at that moment, never these
 *  constants directly, so an owner-set rate takes over the instant it's saved. */
export const EARLY_CHECKIN_FEE = 400;
export const LATE_CHECKOUT_FEE = 500;
export const EXTRA_MATTRESS_FEE = 300;

/**
 * Loyalty standing, by stays alone: four stays earns Gold, a second stay earns
 * Silver, and a first-time guest is New.
 *
 * Lifetime value deliberately plays no part. It tracks stays closely enough
 * that the two never disagree on the seeded set, but a spend threshold could
 * not be stated without contradicting the design: its Gold guests start at
 * ₹1.24L, where ours start at ₹32.6k. Stays is the rule both sets agree on.
 */
export function guestTier(stays: number): GuestTier {
  if (stays >= 4) return "gold";
  if (stays >= 2) return "silver";
  return "new";
}

/** Hydrates a seeded guest with the tier its stays earn. */
export function withTier(g: Omit<Guest, "tier">): Guest {
  return { ...g, tier: guestTier(g.stays) };
}

/** Hydrates a seeded booking with the bill its charges add up to. */
export function withTotal(b: Omit<Booking, "totalBill">): Booking {
  return { ...b, totalBill: computeTotalBill(b.revenue) };
}

/**
 * The booking number — the `nnn` an id ends with, and the first column the
 * Bookings table shows. See `bookingId(date, seq)`.
 */
function bookingNumber(id: string): number {
  return Number(id.slice(id.lastIndexOf("-") + 1));
}

/**
 * The order the Bookings screen lists in: by booking number, as the design does
 * (`KRC-…-001` through `-010`, across several dates).
 *
 * Stated here rather than inherited from the row order, because there is no row
 * order to inherit. These rows arrive from Postgres, which without an ORDER BY
 * returns whatever the planner finds cheapest and may answer differently after
 * an UPDATE. This function is what makes the table's order a decision instead of
 * an accident of storage — and it is testable with no database, which an ORDER
 * BY is not.
 *
 * The id breaks ties: `seq` is not promised to be unique across dates.
 */
export function byBookingNumber(a: Booking, b: Booking): number {
  return bookingNumber(a.id) - bookingNumber(b.id) || a.id.localeCompare(b.id);
}

/** Share of the total taken up-front to hold a date (design: "25% advance").
 *  The default `resolvePartyHallRates` falls back to — the owner-editable
 *  `phAdvancePct` row overrides it once set. */
export const PARTY_HALL_ADVANCE_PCT = 25;

/** The up-front payment that confirms a booking, to the nearest rupee. `pct`
 *  defaults to the constant above for callers with no resolved rate to hand
 *  (fixtures, tests). */
export function partyHallAdvance(amount: number, pct: number = PARTY_HALL_ADVANCE_PCT): number {
  return Math.round((amount * pct) / 100);
}

/**
 * Money actually in hand for an event. Derived from the total and where the
 * event sits in the pipeline, so the seed can never claim an advance that
 * disagrees with the advance rule: nothing before the advance is paid, the
 * advance once a date is held, and the full amount once the event is settled.
 */
function collectedFor(status: PartyHallStatus, amount: number, pct?: number): number {
  if (status === "completed") return amount;
  if (status === "advance_paid" || status === "confirmed") return partyHallAdvance(amount, pct);
  return 0;
}

/** Hydrates a seeded enquiry with the advance its pipeline stage implies.
 *  `advancePct` should be the resolved `phAdvancePct` rate wherever one is
 *  available; omitted only for fixtures/tests that have no Settings row to read.
 *
 *  `advanceAmount` on the row, when present, is the source of truth — it was
 *  snapshotted by `recordPartyHallAdvance` at the moment money actually moved,
 *  and must never be recomputed from a `phAdvancePct` the owner edits later.
 *  The live `amount × advancePct` calculation is a fallback for rows recorded
 *  before that column existed, nothing more. */
export function withAdvance(
  e: Omit<PartyHallEnquiry, "advancePaid">,
  advancePct?: number,
): PartyHallEnquiry {
  const snapshotApplies =
    (e.status === "advance_paid" || e.status === "confirmed") && e.advanceAmount != null;
  const advancePaid = snapshotApplies
    ? e.advanceAmount!
    : collectedFor(e.status, e.amount, advancePct);
  return { ...e, advancePaid };
}

/**
 * Events still ahead of the hall — anything not called off and not already
 * settled. This is the one rule behind "next event", the rooms card and the
 * calendar's event flags, so the three can never disagree about what counts.
 *
 * `today` is optional and off by default: passing it additionally requires
 * `e.date >= today` (inclusive — an event happening today is still upcoming,
 * the front desk needs tonight's event in "Next event", not have it vanish
 * at midnight). TEXT dates are fixed-width ISO, so lexicographic `>=` is a
 * safe date comparison (documented in #84).
 *
 * Leave `today` unset for a status-only check: `bookedDaysIn` and
 * `eventsForMonth` render whatever month the admin is looking at, past or
 * future, and a past event that actually happened should still show as
 * booked there — that's history, not a forecast, so those two callers must
 * not start dropping past dates.
 *
 * Everywhere else — "next event", the rooms tile, "confirmed · upcoming" —
 * answers a forward-looking question, so those callers should pass `today`.
 * This function only changes what's *displayed* as upcoming, not the
 * underlying row — `completePartyHallEvent` (#102) is the write, an explicit
 * admin action; nothing here transitions a row on its own, and
 * `isPartyHallEventPastDue` below is a read-only nudge toward that action,
 * not a second write path.
 */
function isUpcomingEvent(e: PartyHallEnquiry, today?: string): boolean {
  return (
    e.status !== "cancelled" &&
    e.status !== "completed" &&
    e.status !== "declined" &&
    (today === undefined || e.date >= today)
  );
}

/**
 * A confirmed event whose date has passed without being marked completed —
 * the gap #102 exists to close. Built on `isUpcomingEvent` rather than a
 * fresh `e.date < today` string compare: `!isUpcomingEvent(e, today)` is
 * already "not upcoming" for whatever reason (wrong status OR past date),
 * so narrowing to `status === "confirmed"` is exactly "past date, still
 * confirmed" without re-deriving the date comparison `isUpcomingEvent`
 * already owns. Read-only — never writes `completed` itself.
 */
export function isPartyHallEventPastDue(e: PartyHallEnquiry, today: string): boolean {
  return e.status === "confirmed" && !isUpcomingEvent(e, today);
}

/** Soonest upcoming event, or undefined when the hall has nothing booked. */
function nextPartyHallEvent(
  partyHall: PartyHallEnquiry[],
  today: string,
): PartyHallEnquiry | undefined {
  return [...partyHall]
    .filter((e) => isUpcomingEvent(e, today))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** "30 Jul" style day/month label, shared by the next-event line and the
 *  rooms-tile availability window. */
function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "30 Jul · Evening" — the shared next-event line. */
function nextEventLabel(e: PartyHallEnquiry | undefined): string {
  if (!e) return "No events scheduled";
  return `${dateLabel(e.date)} · ${SLOT_LABEL[e.slot]}`;
}

/**
 * Statuses that hold a date on the rooms tile: money has moved or the event
 * is committed. Deliberately narrower than `isUpcomingEvent` (which the
 * calendar rail's `bookedDaysIn` uses) — an un-quoted `enquiry` or a
 * `quote_sent` nobody has paid on doesn't hold the hall, and telling the
 * front desk a date is unavailable over a speculative ask would lose real
 * bookings. Do not widen this to match the calendar; the two screens answer
 * different questions.
 */
const TILE_BLOCKING_STATUS = new Set<PartyHallStatus>(["advance_paid", "confirmed"]);

/**
 * Ground-floor party-hall tile's availability line: the longest run of
 * consecutive free days in the next 7 (today included). A day counts as
 * taken only when it has a committed event — see `TILE_BLOCKING_STATUS`.
 */
function partyHallAvailability(partyHall: PartyHallEnquiry[], today: string): string {
  const blocked = new Set(
    partyHall.filter((e) => TILE_BLOCKING_STATUS.has(e.status)).map((e) => e.date),
  );
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(today, i));

  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let i = 0; i <= days.length; i++) {
    const free = i < days.length && !blocked.has(days[i]);
    if (free) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      const len = i - runStart;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }

  if (bestLen === 0) return "Fully booked this week";
  const start = days[bestStart];
  const end = days[bestStart + bestLen - 1];
  return bestLen === 1
    ? `Available ${dateLabel(start)}`
    : `Available ${dateLabel(start)} – ${dateLabel(end)}`;
}

/** Room types are inventory, not booking data — static config, safe to ship. */
export async function getRoomTypes(): Promise<RoomTypeInfo[]> {
  return ROOM_TYPES;
}

export function findBooking(data: BookingData, id: string): Booking | undefined {
  return data.bookings.find((b) => b.id === id);
}

export function findGuest(data: BookingData, id: string): Guest | undefined {
  return data.guests.find((g) => g.id === id);
}

/** What the manual-entry drawer (spec 19) collects. Derived fields are never entered. */
export interface NewBookingInput {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestCity: string;
  roomType: RoomType;
  /** null leaves the room unassigned, same as an OTA reservation today. */
  roomNo: string | null;
  checkIn: string;
  checkOut: string;
  source: BookingSource;
  mealPlan: MealPlan;
  /** Shared by every room created in one guest-flow checkout; see `Booking.batchId`. */
  batchId?: string;
  /** Best-effort preferences + freeform note (#66/#67) — untrusted client input,
   *  validated in `createBooking` (whitelist + length), never trusted as-is. */
  requestPreferences?: GuestPreference[];
  requestNote?: string;
  /** Slice B: a request only, never an auto-charge — see `createBooking`. */
  requestEarlyCheckIn?: boolean;
  requestLateCheckOut?: boolean;
  /** 0 (or omitted) means no mattress requested. */
  requestExtraMattressQty?: number;
}

const GUEST_PREFERENCE_SET = new Set<string>(GUEST_PREFERENCES);
const REQUEST_NOTE_MAX = 500;
/** A guest can request at most this many extra mattresses at booking time;
 *  more than that is a front-desk conversation, not a checkbox. */
const MAX_MATTRESS_QTY = 3;

/**
 * Package tiers, per the design's reference card. Capacities ladder up to the
 * hall's 150-guest ceiling; Platinum is quoted per-event rather than listed.
 */
export const PARTY_HALL_PACKAGES: PartyHallPackage[] = [
  { name: "Silver", capacity: "up to 60", price: "from ₹35k" },
  { name: "Gold", capacity: "up to 100", price: "from ₹60k" },
  { name: "Platinum", capacity: "up to 150", price: "tailored" },
];

/** The add-on tag vocabulary a guest can request on an enquiry — the same set
 *  admin cards already render as tags, so a guest's pick lines up with what
 *  admin expects to see. */
export const PARTY_HALL_ADD_ONS = ["Decor", "DJ", "Catering", "AV", "Projector", "Lunch Buffet"];

/** The hall's stated guest ceiling (marketing copy: "up to 150 guests"). */
export const MAX_PARTY_HALL_GUESTS = 150;

export type PartyHallRates = Record<PartyHallRateKey, number>;

/**
 * Slice 2a defaults — also what a fresh `addon_settings` seed writes. Eight of
 * these (everything but Catering and the advance) are ₹1 stand-ins: nobody
 * has confirmed a real Silver/Gold/Platinum base or a Decor/DJ/AV/Projector/
 * Lunch Buffet rate yet. Catering (₹450/plate) and the 25% advance are real,
 * already-quoted figures — see `PARTY_HALL_PLACEHOLDER_KEYS` for which is which.
 */
export const PARTY_HALL_RATE_DEFAULTS: PartyHallRates = {
  phBaseSilver: 1,
  phBaseGold: 1,
  phBasePlatinum: 1,
  phDecor: 1,
  phDJ: 1,
  phAV: 1,
  phProjector: 1,
  phLunchBuffet: 1,
  phCatering: 450,
  phAdvancePct: PARTY_HALL_ADVANCE_PCT,
};

/** Rows still carrying the ₹1 placeholder — drives the Settings warning banner. */
export const PARTY_HALL_PLACEHOLDER_KEYS: PartyHallRateKey[] = [
  "phBaseSilver",
  "phBaseGold",
  "phBasePlatinum",
  "phDecor",
  "phDJ",
  "phAV",
  "phProjector",
  "phLunchBuffet",
];

/** Owner override over default, same shape as `resolveAddOnRates`. */
export function resolvePartyHallRates(
  overrides?: BookingData["partyHallRateOverrides"],
): PartyHallRates {
  return {
    phBaseSilver: overrides?.phBaseSilver ?? PARTY_HALL_RATE_DEFAULTS.phBaseSilver,
    phBaseGold: overrides?.phBaseGold ?? PARTY_HALL_RATE_DEFAULTS.phBaseGold,
    phBasePlatinum: overrides?.phBasePlatinum ?? PARTY_HALL_RATE_DEFAULTS.phBasePlatinum,
    phDecor: overrides?.phDecor ?? PARTY_HALL_RATE_DEFAULTS.phDecor,
    phDJ: overrides?.phDJ ?? PARTY_HALL_RATE_DEFAULTS.phDJ,
    phAV: overrides?.phAV ?? PARTY_HALL_RATE_DEFAULTS.phAV,
    phProjector: overrides?.phProjector ?? PARTY_HALL_RATE_DEFAULTS.phProjector,
    phLunchBuffet: overrides?.phLunchBuffet ?? PARTY_HALL_RATE_DEFAULTS.phLunchBuffet,
    phCatering: overrides?.phCatering ?? PARTY_HALL_RATE_DEFAULTS.phCatering,
    phAdvancePct: overrides?.phAdvancePct ?? PARTY_HALL_RATE_DEFAULTS.phAdvancePct,
  };
}

const PARTY_HALL_BASE_KEY: Record<string, PartyHallRateKey> = {
  Silver: "phBaseSilver",
  Gold: "phBaseGold",
  Platinum: "phBasePlatinum",
};

/** Flat-fee add-ons: charged once per event, regardless of guest count. */
const PARTY_HALL_FLAT_ADDON_KEY: Partial<Record<string, PartyHallRateKey>> = {
  Decor: "phDecor",
  DJ: "phDJ",
  AV: "phAV",
  Projector: "phProjector",
};

/** Per-guest add-ons: the only two with a documented per-head rate today. */
const PARTY_HALL_PER_GUEST_ADDON_KEY: Partial<Record<string, PartyHallRateKey>> = {
  Catering: "phCatering",
  "Lunch Buffet": "phLunchBuffet",
};

export interface QuotePriceLine {
  label: string;
  amount: number;
}

/**
 * The per-line breakdown a "Send quote" click freezes: the package base,
 * then every requested add-on at its resolved rate — flat once per event, or
 * × guests for the two catering-style add-ons, pre-multiplied into `amount`
 * so nothing reading this later needs `guests` or a rate lookup to make
 * sense of it. An add-on outside the known vocabulary (should never happen,
 * `createPartyHallEnquiry` whitelists it) contributes nothing, same
 * "don't trust what you can't place" posture as the rest of this file.
 *
 * `computePartyHallQuote` sums this — one computation, not two that could
 * silently disagree.
 */
export function computePartyHallQuoteBreakdown(
  e: Pick<PartyHallEnquiry, "package" | "addOns" | "guests">,
  rates: PartyHallRates,
): QuotePriceLine[] {
  const lines: QuotePriceLine[] = [
    { label: `${e.package} package`, amount: rates[PARTY_HALL_BASE_KEY[e.package]] ?? 0 },
  ];
  for (const addOn of e.addOns) {
    const flatKey = PARTY_HALL_FLAT_ADDON_KEY[addOn];
    if (flatKey) {
      lines.push({ label: addOn, amount: rates[flatKey] });
      continue;
    }
    const perGuestKey = PARTY_HALL_PER_GUEST_ADDON_KEY[addOn];
    if (perGuestKey) lines.push({ label: addOn, amount: rates[perGuestKey] * e.guests });
  }
  return lines;
}

/**
 * The quote a "Send quote" click commits to — the sum of
 * `computePartyHallQuoteBreakdown`'s lines.
 */
export function computePartyHallQuote(
  e: Pick<PartyHallEnquiry, "package" | "addOns" | "guests">,
  rates: PartyHallRates,
): number {
  return computePartyHallQuoteBreakdown(e, rates).reduce((sum, line) => sum + line.amount, 0);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms =
    new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** `G-001`, `G-002`, … — the next free number, one past whatever exists. */
function nextGuestId(guests: Guest[]): string {
  const max = guests.reduce((m, g) => {
    const n = Number(g.id.slice(g.id.lastIndexOf("-") + 1));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `G-${String(max + 1).padStart(3, "0")}`;
}

/** `KRC-YYYYMMDD-nnn` — the next free sequence number for that calendar date. */
function nextBookingId(existingIds: string[], today: string): string {
  const prefix = `KRC-${today.replaceAll("-", "")}-`;
  const max = existingIds
    .filter((id) => id.startsWith(prefix))
    .reduce((m, id) => Math.max(m, bookingNumber(id)), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * The first real write to `bookings` (spec 19). A pure rule, same shape as
 * `team.ts`'s `createInvite`: it decides and returns, it never persists — that
 * is `bookings-data.ts`'s job, same split as invites.
 *
 * An existing guest is reused by phone rather than duplicated — the same
 * person booking twice is one `Guest` row with two `Booking` rows, not two
 * guests. Room revenue is computed from the room type and night count (the
 * only figures known at entry); nothing is collected yet, so the whole bill
 * sits in `collection.pending` until a payment PR (#16) settles it.
 */
export function createBooking(
  state: {
    guests: Guest[];
    bookings: Booking[];
    rooms?: RoomTile[];
    roomTypeOverrides?: BookingData["roomTypeOverrides"];
    gstRateOverride?: BookingData["gstRateOverride"];
  },
  input: NewBookingInput,
  today: string = new Date().toISOString().slice(0, 10),
): Result<{ guest: Guest; booking: Booking }> {
  const name = input.guestName.trim();
  const phone = input.guestPhone.trim();
  if (!name) return { ok: false, error: "Guest name is required." };
  if (!phone) return { ok: false, error: "Guest phone is required." };
  if (!input.checkIn || !input.checkOut) {
    return { ok: false, error: "Check-in and check-out dates are required." };
  }
  if (input.checkOut <= input.checkIn) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  const roomNumbers = state.rooms ? state.rooms.map((r) => r.no) : ROOM_NUMBERS;
  if (input.roomNo && !roomNumbers.includes(input.roomNo)) {
    return { ok: false, error: `Room ${input.roomNo} does not exist.` };
  }

  // Untrusted client input (createGuestBookingFn is unauthenticated) — whitelist
  // the preference keys rather than trusting whatever the client sent, and
  // reject an over-limit note outright rather than silently truncating it,
  // which would lose the end of a real request.
  const requestPreferences = (input.requestPreferences ?? []).filter((p) =>
    GUEST_PREFERENCE_SET.has(p),
  );
  const requestNote = (input.requestNote ?? "").trim();
  if (requestNote.length > REQUEST_NOTE_MAX) {
    return { ok: false, error: `Request note must be ${REQUEST_NOTE_MAX} characters or fewer.` };
  }
  const specialRequest: GuestRequest | undefined =
    requestPreferences.length > 0 || requestNote
      ? { preferences: requestPreferences, ...(requestNote ? { note: requestNote } : {}) }
      : undefined;

  // Slice B: a checkbox/qty here only records a request — it never posts a
  // charge. The admin resolves each pending entry (applied/declined) at
  // their discretion, e.g. once they know the guest genuinely showed up
  // early. See `resolveRequestedService`.
  const mattressQty = Math.trunc(input.requestExtraMattressQty ?? 0);
  if (mattressQty < 0 || mattressQty > MAX_MATTRESS_QTY) {
    return {
      ok: false,
      error: `Extra mattress quantity must be between 0 and ${MAX_MATTRESS_QTY}.`,
    };
  }
  const requestedServices: RequestedServices | undefined =
    input.requestEarlyCheckIn || input.requestLateCheckOut || mattressQty > 0
      ? {
          ...(input.requestEarlyCheckIn
            ? { earlyCheckIn: { requested: true, status: "pending" as const } }
            : {}),
          ...(input.requestLateCheckOut
            ? { lateCheckOut: { requested: true, status: "pending" as const } }
            : {}),
          ...(mattressQty > 0
            ? { extraMattress: { requested: true, status: "pending" as const, qty: mattressQty } }
            : {}),
        }
      : undefined;

  const guest: Guest =
    state.guests.find((g) => g.phone === phone) ??
    withTier({
      id: nextGuestId(state.guests),
      name,
      phone,
      email: input.guestEmail.trim(),
      city: input.guestCity.trim(),
      stays: 0,
      lifetimeValue: 0,
    });

  const nights = nightsBetween(input.checkIn, input.checkOut);
  const roomTypes = resolveRoomTypes(state.rooms ?? defaultRoomTiles(), state.roomTypeOverrides);
  const pricePerNight = roomTypes.find((rt) => rt.type === input.roomType)!.pricePerNight;
  // `revenue.taxPct` (persisted as `bookings.revenue_tax_pct`, NOT NULL) is a
  // historical record of the rate in force at creation time only — it is
  // read by no invoice or price display. The authoritative rate is always
  // `resolveRoomGstPct`'s live read; do not resurrect this column as a
  // pricing source.
  const revenue: BookingRevenue = {
    room: pricePerNight * nights,
    earlyCheckIn: 0,
    lateCheckOut: 0,
    other: 0,
    discount: 0,
    taxPct: resolveRoomGstPct(state.gstRateOverride),
  };
  const collection: BookingCollection = {
    paidToHotel: 0,
    otaCollection: 0,
    otaCommission: 0,
    complimentary: 0,
    pending: computeTotalBill(revenue),
  };

  const booking = withTotal({
    id: nextBookingId(
      state.bookings.map((b) => b.id),
      today,
    ),
    guestId: guest.id,
    roomNo: input.roomNo,
    roomType: input.roomType,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    urn: nights,
    source: input.source,
    mealPlan: input.mealPlan,
    revenue,
    collection,
    status: "pending_payment",
    createdAt: new Date().toISOString(),
    batchId: input.batchId,
    specialRequest,
    requestedServices,
  });

  return { ok: true, guest, booking };
}

export interface NewGuestInput {
  name: string;
  phone: string;
  email: string;
  city: string;
}

/**
 * Finds an existing guest whose phone matches `phone`, for the phone-
 * collision check on create/edit below. Compares by `normalizePhone` when
 * both sides resolve — so "9876543210" and "+91 98765 43210" collide, unlike
 * `createBooking`'s raw-string match (see issue #92, filed rather than
 * changed here: switching that match to normalized comparison is a real
 * behaviour change with existing-data implications). Falls back to exact
 * trimmed-string comparison when either side won't normalize, rather than
 * letting an unresolvable number through unchecked. `excludeId` lets an edit
 * exclude the guest's own row.
 */
function findGuestByPhone(guests: Guest[], phone: string, excludeId?: string): Guest | null {
  const target = phone.trim();
  const targetNormalized = normalizePhone(target);
  return (
    guests.find((g) => {
      if (g.id === excludeId) return false;
      const gNormalized = normalizePhone(g.phone);
      return targetNormalized !== null && gNormalized !== null
        ? targetNormalized === gNormalized
        : g.phone.trim() === target;
    }) ?? null
  );
}

function phoneConflictError(guest: Guest, targetNormalized: string | null): string {
  const base = `That number already belongs to ${guest.id}, ${guest.name}.`;
  return targetNormalized
    ? base
    : `${base} (This number could not be normalized, so it was matched by exact text.)`;
}

/**
 * The Guests directory's standalone "New guest" write (no booking attached)
 * — reached from the "+" chooser. Phone collisions are blocked, not merged:
 * merging would mean reassigning existing bookings/invoices to a surviving
 * guest id, a much bigger feature than this form takes on. See
 * `findGuestByPhone` for the comparison rule.
 */
export function createGuest(
  state: { guests: Guest[] },
  input: NewGuestInput,
): Result<{ guest: Guest }> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const city = input.city.trim();
  if (!name) return { ok: false, error: "Guest name is required." };
  if (!phone) return { ok: false, error: "Guest phone is required." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Guest email is invalid." };
  }

  const conflict = findGuestByPhone(state.guests, phone);
  if (conflict) {
    return { ok: false, error: phoneConflictError(conflict, normalizePhone(phone)) };
  }

  const guest = withTier({
    id: nextGuestId(state.guests),
    name,
    phone,
    email,
    city,
    stays: 0,
    lifetimeValue: 0,
  });
  return { ok: true, guest };
}

/**
 * The Guests directory's "fix a guest's details" write. Only the
 * user-entered fields (`name`/`phone`/`email`/`city`) are parameters here —
 * `stays`/`lifetimeValue`/`tier` are derived (`withTier`) and this function
 * has no way to accept them, so there is no path for a caller to smuggle a
 * stat edit through this form. Same phone-collision rule as `createGuest`,
 * excluding the guest's own row.
 */
export function updateGuest(
  state: { guests: Guest[] },
  id: string,
  input: NewGuestInput,
): Result<{ guest: Guest }> {
  const existing = state.guests.find((g) => g.id === id);
  if (!existing) return { ok: false, error: `Guest ${id} does not exist.` };

  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const city = input.city.trim();
  if (!name) return { ok: false, error: "Guest name is required." };
  if (!phone) return { ok: false, error: "Guest phone is required." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Guest email is invalid." };
  }

  const conflict = findGuestByPhone(state.guests, phone, id);
  if (conflict) {
    return { ok: false, error: phoneConflictError(conflict, normalizePhone(phone)) };
  }

  const guest: Guest = { ...existing, name, phone, email, city };
  return { ok: true, guest };
}

/** `PH-YYYYMMDD-nnn` — the next free sequence number for that calendar date,
 *  same shape as `nextBookingId`. Keyed off the submission date, not the
 *  requested event date — an enquiry made today for an event in three months
 *  still gets today's prefix. */
function nextEnquiryId(existingIds: string[], today: string): string {
  const prefix = `PH-${today.replaceAll("-", "")}-`;
  const max = existingIds
    .filter((id) => id.startsWith(prefix))
    .reduce((m, id) => Math.max(m, bookingNumber(id)), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

const PARTY_HALL_ADD_ONS_SET = new Set(PARTY_HALL_ADD_ONS);
const PARTY_HALL_PACKAGE_NAMES = new Set(PARTY_HALL_PACKAGES.map((p) => p.name));
const PARTY_HALL_SLOTS: readonly PartyHallSlot[] = ["morning", "afternoon", "evening", "full_day"];
const PARTY_HALL_SLOT_SET = new Set<string>(PARTY_HALL_SLOTS);

/** The guest form's Event Type choices — the whitelist the server actually
 *  checks against, not just what the `Select` happens to offer. */
export const PARTY_HALL_EVENT_TYPES = ["Wedding", "Reception", "Birthday", "Corporate", "Other"];
const PARTY_HALL_EVENT_TYPE_SET = new Set(PARTY_HALL_EVENT_TYPES);

/** Same cap as `requestNote` — long enough for a real occasion name, short
 *  enough that it can't be used to smuggle in something else. */
const OCCASION_NAME_MAX = 80;

export interface NewPartyHallEnquiryInput {
  eventType: string;
  /** Optional, e.g. "Priya & Arjun's Reception" — composed onto `eventType`
   *  to build the stored `title`, same "Type — Occasion" shape the seed data
   *  already uses (e.g. "Reception — Priya & Arjun"). */
  occasionName?: string;
  date: string;
  slot: PartyHallSlot;
  guests: number;
  package: string;
  addOns: string[];
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

/**
 * The guest-facing enquiry form's only write (Tier 1 of the Party Hall
 * audit): a pure rule, same shape as `createBooking` — it decides and
 * returns, `bookings-data.ts` persists it. Unauthenticated input, so every
 * field is independently validated here rather than trusted from the client,
 * same discipline as `createBooking`'s `requestPreferences`/`requestNote`
 * whitelisting.
 *
 * `status` always starts `"enquiry"` and `amount` always starts `0` — an
 * admin quoting/confirming the event is Tier 2, out of scope here.
 *
 * Security property: `source` and `allowPastDate` are caller-set, never part
 * of `input`. `createPartyHallEnquiryFn` (unauthenticated) passes client data
 * straight through its `.validator` into `input` — if `allowPastDate` or
 * `source` lived on `NewPartyHallEnquiryInput`, an anonymous caller could set
 * either directly: waiving its own past-date check, or claiming
 * `source: "walk_in"`/`"phone"` to suppress `derivePartyHallNotifications`'s
 * new-enquiry alert for a submission nobody in the admin has actually seen.
 * Because both are a separate parameter instead, only server code decides
 * them — the public fn always gets the `source: "direct"` default and never
 * passes `allowPastDate`; only `createPartyHallEnquiryAdminFn` (behind
 * `requireBookingWriter`) sets `allowPastDate: true` and a real source.
 */
export function createPartyHallEnquiry(
  state: { partyHall: PartyHallEnquiry[] },
  input: NewPartyHallEnquiryInput,
  today: string = new Date().toISOString().slice(0, 10),
  { source, allowPastDate = false }: { source: PartyHallSource; allowPastDate?: boolean } = {
    source: "direct",
  },
): Result<{ enquiry: PartyHallEnquiry }> {
  const eventType = input.eventType.trim();
  const occasionName = (input.occasionName ?? "").trim();
  const contactName = input.contactName.trim();
  const contactPhone = input.contactPhone.trim();
  const contactEmail = input.contactEmail.trim();

  if (!PARTY_HALL_EVENT_TYPE_SET.has(eventType)) {
    return { ok: false, error: "Invalid event type." };
  }
  if (occasionName.length > OCCASION_NAME_MAX) {
    return { ok: false, error: `Event title must be ${OCCASION_NAME_MAX} characters or fewer.` };
  }
  if (!input.date) return { ok: false, error: "Event date is required." };
  if (!allowPastDate && input.date < today) {
    return { ok: false, error: "Event date cannot be in the past." };
  }
  if (!PARTY_HALL_SLOT_SET.has(input.slot)) return { ok: false, error: "Invalid time slot." };
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > MAX_PARTY_HALL_GUESTS) {
    return { ok: false, error: `Guest count must be between 1 and ${MAX_PARTY_HALL_GUESTS}.` };
  }
  if (!PARTY_HALL_PACKAGE_NAMES.has(input.package)) {
    return { ok: false, error: "Invalid package tier." };
  }
  const addOns = [...new Set(input.addOns)].filter((a) => PARTY_HALL_ADD_ONS_SET.has(a));
  if (!contactName) return { ok: false, error: "Contact name is required." };
  if (!contactPhone || !/^[0-9+()\-\s]{7,20}$/.test(contactPhone)) {
    return { ok: false, error: "A valid contact phone is required." };
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Contact email is invalid." };
  }

  const enquiry = withAdvance({
    id: nextEnquiryId(
      state.partyHall.map((e) => e.id),
      today,
    ),
    title: occasionName ? `${eventType} — ${occasionName}` : eventType,
    date: input.date,
    slot: input.slot,
    guests: input.guests,
    package: input.package,
    addOns,
    status: "enquiry",
    amount: 0,
    createdAt: new Date().toISOString(),
    contactName,
    contactPhone,
    contactEmail: contactEmail || undefined,
    source,
  });

  return { ok: true, enquiry };
}

/**
 * The pipeline write precondition: a status-changing write may only proceed
 * if the row's actual status still matches what the caller last saw. Two
 * concurrent clicks can both read the same status before either writes —
 * this is what tells the second one its write is now stale.
 *
 * The single source of truth for that comparison — `updatePartyHallPipeline`
 * calls this rather than re-deriving it, on both the no-DB fixtures path and
 * (in spirit) the real `WHERE id = ? AND status = priorStatus`, so wiring the
 * guard wrong means deleting a call site, not silently duplicating a check.
 */
export function partyHallTransitionAllowed(
  actualStatus: PartyHallStatus,
  priorStatus: PartyHallStatus,
): boolean {
  return actualStatus === priorStatus;
}

function findPartyHallEnquiry(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
): Result<{ enquiry: PartyHallEnquiry }> {
  const enquiry = state.partyHall.find((e) => e.id === id);
  if (!enquiry) return { ok: false, error: "Enquiry not found." };
  return { ok: true, enquiry };
}

/**
 * Slice 2a's first real pipeline action: quotes a fresh enquiry at its
 * package + add-ons, snapshotting the rate in force right now — same
 * snapshot-at-charge-time discipline as `resolveRequestedService`, so a later
 * rate change (once real numbers replace the placeholders) never reprices an
 * enquiry that was already quoted against the ₹1 stand-ins.
 */
export function sendPartyHallQuote(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
  rates: PartyHallRates,
  advancePct: number = PARTY_HALL_ADVANCE_PCT,
): Result<{ enquiry: PartyHallEnquiry }> {
  const found = findPartyHallEnquiry(state, id);
  if (!found.ok) return found;
  if (found.enquiry.status !== "enquiry") {
    return { ok: false, error: "Only a new enquiry can be quoted." };
  }
  const quoteBreakdown = computePartyHallQuoteBreakdown(found.enquiry, rates);
  const amount = quoteBreakdown.reduce((sum, line) => sum + line.amount, 0);
  return {
    ok: true,
    enquiry: withAdvance(
      {
        ...found.enquiry,
        status: "quote_sent",
        amount,
        quotedAt: new Date().toISOString(),
        quoteBreakdown,
      },
      advancePct,
    ),
  };
}

/**
 * Admin-recorded advance (Tier 2 design): a deliberate second click from
 * "quote sent", never inferred from a payment gateway — the hall takes
 * advances by hand (cash, UPI, bank transfer), so nothing here can watch for
 * one arriving. Kept a separate action from `confirmPartyHallEvent` (Option
 * A) rather than folding "advance in hand" and "date confirmed" into one
 * click — the hall sometimes holds an advance for a day or two before the
 * booking is locked in.
 */
export function recordPartyHallAdvance(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
  advancePct: number = PARTY_HALL_ADVANCE_PCT,
): Result<{ enquiry: PartyHallEnquiry }> {
  const found = findPartyHallEnquiry(state, id);
  if (!found.ok) return found;
  if (found.enquiry.status !== "quote_sent") {
    return { ok: false, error: "Only a quoted enquiry can have its advance recorded." };
  }
  const advanceAmount = partyHallAdvance(found.enquiry.amount, advancePct);
  return {
    ok: true,
    enquiry: withAdvance(
      { ...found.enquiry, status: "advance_paid", advanceAmount, advancePct },
      advancePct,
    ),
  };
}

/** The second half of Option A: locks the date in once the advance is in hand. */
export function confirmPartyHallEvent(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
  advancePct: number = PARTY_HALL_ADVANCE_PCT,
): Result<{ enquiry: PartyHallEnquiry }> {
  const found = findPartyHallEnquiry(state, id);
  if (!found.ok) return found;
  if (found.enquiry.status !== "advance_paid") {
    return { ok: false, error: "Record the advance before confirming." };
  }
  return {
    ok: true,
    enquiry: withAdvance({ ...found.enquiry, status: "confirmed" }, advancePct),
  };
}

/**
 * Terminal step past `confirmed` — the event happened. Deliberately only
 * reachable from `confirmed`, not `advance_paid`: an event that never got
 * its date locked in was never actually held, so there's nothing to mark
 * complete. No date check here (e.g. requiring the event date to have
 * passed) — that's a UI nudge (the past-due badge), not a write guard; an
 * admin closing out an event early (say, it ran a day ahead of schedule)
 * shouldn't be blocked by a hardcoded date rule.
 */
export function completePartyHallEvent(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
): Result<{ enquiry: PartyHallEnquiry }> {
  const found = findPartyHallEnquiry(state, id);
  if (!found.ok) return found;
  if (found.enquiry.status !== "confirmed") {
    return { ok: false, error: "Only a confirmed event can be marked completed." };
  }
  return { ok: true, enquiry: { ...found.enquiry, status: "completed" } };
}

/**
 * Declines a quote — before any money has moved, which is why this is only
 * reachable from `enquiry`/`quote_sent` and not from `advance_paid` onward
 * (a booking falling through after the advance is a different, out-of-scope
 * situation, not a decline). Non-destructive: the enquiry, its amount and its
 * add-ons all survive untouched, so `reopenPartyHallEnquiry` has something
 * real to reopen rather than a blank quote.
 */
export function declinePartyHallEnquiry(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
): Result<{ enquiry: PartyHallEnquiry }> {
  const found = findPartyHallEnquiry(state, id);
  if (!found.ok) return found;
  if (found.enquiry.status !== "enquiry" && found.enquiry.status !== "quote_sent") {
    return { ok: false, error: "Only an unconfirmed enquiry can be declined." };
  }
  return { ok: true, enquiry: { ...found.enquiry, status: "declined" } };
}

/** `declined` is not a dead end (mirrors Slice B's reversed→applied fix): it
 *  reopens back to whatever it was before the decline. `declinePartyHallEnquiry`
 *  allows declining straight from `enquiry` — before any quote exists — so the
 *  target can't be hardcoded to `quote_sent`; it must be derived from whether
 *  a quote is actually on the record. `amount > 0` is that signal (never `0`
 *  until `sendPartyHallQuote` sets it) and, unlike `quotedAt`, it needs no
 *  backfill: every pre-0011 row already has the right amount to derive from. */
export function reopenPartyHallEnquiry(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
): Result<{ enquiry: PartyHallEnquiry }> {
  const found = findPartyHallEnquiry(state, id);
  if (!found.ok) return found;
  if (found.enquiry.status !== "declined") {
    return { ok: false, error: "Only a declined enquiry can be reopened." };
  }
  const status = found.enquiry.amount > 0 ? "quote_sent" : "enquiry";
  return { ok: true, enquiry: { ...found.enquiry, status } };
}

/**
 * Calls off an event after money has already moved — distinct from
 * `declinePartyHallEnquiry`, which only ever fires before a rupee changes
 * hands. Reachable from `advance_paid` (the advance came in, then the booking
 * fell through before Confirm) and from `confirmed` (fell through after the
 * date was locked in) — both leave an advance on the books, so both stamp
 * `refundedAt` alongside the status change. Terminal: unlike `declined`,
 * there is no reopen path back — resurrecting a cancelled, money-collected
 * booking is a new enquiry's worth of decisions, not a state flip.
 */
export function cancelPartyHallEvent(
  state: { partyHall: PartyHallEnquiry[] },
  id: string,
): Result<{ enquiry: PartyHallEnquiry }> {
  const found = findPartyHallEnquiry(state, id);
  if (!found.ok) return found;
  if (found.enquiry.status !== "advance_paid" && found.enquiry.status !== "confirmed") {
    return { ok: false, error: "Only a booking with an advance on record can be cancelled." };
  }
  return {
    ok: true,
    enquiry: {
      ...found.enquiry,
      status: "cancelled",
      refundedAt: new Date().toISOString(),
    },
  };
}

/**
 * Slice B's admin resolution of a Slice-B service request: apply (post the
 * charge, snapshotting the current Settings rate), decline (no charge, kept
 * on record), or reverse an already-applied charge (undo the charge, kept on
 * record as `reversed` — distinct from `declined`, which means never
 * charged at all). Also covers the walk-in path — an admin can apply a
 * charge the guest never requested, which creates the entry as already
 * `applied` since there was no request to resolve.
 *
 * A pure rule, same shape as `assignBookingRoom`: it decides and returns the
 * booking's new `revenue`/`requestedServices`; `bookings-data.ts` persists it.
 */
export function resolveRequestedService(
  state: { addOnRateOverrides?: BookingData["addOnRateOverrides"] },
  booking: Booking,
  service: AddOnServiceKey,
  action: "applied" | "declined" | "reversed",
  /** Mattress count for a walk-in add with no prior guest request; ignored
   *  otherwise (a pending request's own `qty` is what gets charged). */
  mattressQty = 1,
): Result<{ revenue: BookingRevenue; requestedServices: RequestedServices; note?: string }> {
  const existing = booking.requestedServices?.[service];

  if (action === "reversed") {
    if (!existing || existing.status !== "applied") {
      return {
        ok: false,
        error: `${service} has not been applied, so there is nothing to reverse.`,
      };
    }
    // Applying/declining is blocked only while a charge is currently in
    // force — `pending`, `declined`, and `reversed` are all "open" states an
    // admin can still act on, same as a service with no entry at all. This
    // is what lets a reversed charge be re-applied instead of dead-ending.
  } else if (existing && existing.status === "applied") {
    return { ok: false, error: `${service} is already applied — reverse it first.` };
  }
  if (action === "applied" && service === "extraMattress" && !existing) {
    if (!Number.isInteger(mattressQty) || mattressQty < 1 || mattressQty > MAX_MATTRESS_QTY) {
      return {
        ok: false,
        error: `Extra mattress quantity must be between 1 and ${MAX_MATTRESS_QTY}.`,
      };
    }
  }

  const rates = resolveAddOnRates(state.addOnRateOverrides);
  const revenue = { ...booking.revenue };
  let note = booking.revenueOtherNote;
  const qty = existing && "qty" in existing ? existing.qty : mattressQty;

  if (action === "applied") {
    if (service === "earlyCheckIn") revenue.earlyCheckIn = rates.earlyCheckIn;
    else if (service === "lateCheckOut") revenue.lateCheckOut = rates.lateCheckOut;
    else {
      revenue.other += rates.extraMattress * qty;
      const label = `Extra mattress ×${qty}`;
      note = note ? `${note}, ${label}` : label;
    }
  } else if (action === "reversed") {
    if (service === "earlyCheckIn") revenue.earlyCheckIn = 0;
    else if (service === "lateCheckOut") revenue.lateCheckOut = 0;
    else {
      revenue.other = 0;
      note = undefined;
    }
  }

  const requestedServices: RequestedServices = {
    ...booking.requestedServices,
    [service]:
      service === "extraMattress"
        ? { requested: existing?.requested ?? false, status: action, qty }
        : { requested: existing?.requested ?? false, status: action },
  };

  return { ok: true, revenue, requestedServices, note };
}

export interface AvailabilityQuery {
  checkIn: string;
  checkOut: string;
  rooms: number;
}

/**
 * Whether `rooms` more stays can be sold over the whole `[checkIn, checkOut)`
 * span. Counts every occupying booking that overlaps a given night, not just
 * ones with a `roomNo` assigned — guest self-service bookings never get one
 * (roomNo stays null until check-in, per spec #14), so counting only assigned
 * rooms would undercount and let the bar oversell.
 */
export function checkAvailability(
  data: { bookings: Booking[]; rooms?: RoomTile[] },
  query: AvailabilityQuery,
): boolean {
  if (!query.checkIn || !query.checkOut || query.checkOut <= query.checkIn) return false;
  if (query.rooms < 1) return false;

  const nights = nightsBetween(query.checkIn, query.checkOut);
  for (let i = 0; i < nights; i++) {
    const onDate = new Date(`${query.checkIn}T00:00:00Z`);
    onDate.setUTCDate(onDate.getUTCDate() + i);
    const dateStr = onDate.toISOString().slice(0, 10);

    const occupied = data.bookings.filter(
      (b) => OCCUPYING_STATUSES.has(b.status) && b.checkIn <= dateStr && dateStr < b.checkOut,
    ).length;

    if ((data.rooms ?? ROOM_UNITS).length - occupied < query.rooms) return false;
  }
  return true;
}

export interface GuestBookingLookup {
  booking: Booking;
  guest: Guest;
  roomTypeName: string;
}

/**
 * Spec 15's search: a guest proves ownership with the phone or email they
 * booked under, not a login — same self-service model as the confirmation
 * email/WhatsApp they already got at booking time.
 */
export function findGuestBooking(
  data: BookingData,
  bookingId: string,
  contact: string,
): Result<GuestBookingLookup> {
  const booking = data.bookings.find((b) => b.id === bookingId.trim());
  if (!booking) return { ok: false, error: "No booking found with that ID." };

  const guest = data.guests.find((g) => g.id === booking.guestId);
  const needle = contact.trim().toLowerCase();
  const matches =
    !!guest && (guest.phone === contact.trim() || guest.email.toLowerCase() === needle);
  if (!matches) return { ok: false, error: "That phone or email doesn't match this booking." };

  const roomTypeName = ROOM_TYPES.find((rt) => rt.type === booking.roomType)!.name;
  return { ok: true, booking, guest: guest!, roomTypeName };
}

/** Statuses a guest can still back out of — a stay that has begun or already ended cannot be. */
const CANCELLABLE_STATUSES = new Set<BookingStatus>(["confirmed", "pending_payment"]);

/**
 * Same ownership check as `findGuestBooking`, then flips the one field a
 * guest is allowed to change themselves. Everything else about the booking
 * (room, dates, revenue) is unauthorized-guest-facing read-only.
 */
export function cancelGuestBooking(
  data: BookingData,
  bookingId: string,
  contact: string,
): Result<{ booking: Booking }> {
  const found = findGuestBooking(data, bookingId, contact);
  if (!found.ok) return found;
  if (!CANCELLABLE_STATUSES.has(found.booking.status)) {
    return {
      ok: false,
      error: `This booking is already ${found.booking.status.replace("_", " ")}.`,
    };
  }
  return { ok: true, booking: { ...found.booking, status: "cancelled" } };
}

/**
 * The Razorpay verify route's write (#16): flips a `pending_payment` booking to
 * `confirmed` and settles its collection — `paidToHotel` takes the whole bill,
 * `pending` drops to zero, since a Checkout payment is always the full amount,
 * never a partial one. `paymentMethod`/`paidAt` settle in the same write —
 * the caller resolves them (via `resolvePaymentMetadata`, which cannot throw)
 * before calling in, so this stays a single atomic settlement with no
 * separate metadata write that could fail after the payment has moved.
 *
 * Idempotent by construction: a webhook retry or a duplicate `handler` fire
 * with the same `paymentId` on an already-`confirmed` booking returns the
 * existing row rather than re-settling it, which matters because
 * `bookings-data.ts` calls this once per resolved signature and Razorpay does
 * not guarantee its webhook fires exactly once.
 */
export function markBookingPaid(
  data: BookingData,
  bookingId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  paymentMethod: PaymentMethod | "online",
  paidAt: string,
): Result<{ booking: Booking }> {
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };

  if (booking.status === "confirmed" && booking.razorpayPaymentId === razorpayPaymentId) {
    return { ok: true, booking };
  }
  if (booking.status !== "pending_payment") {
    return { ok: false, error: `Booking is already ${booking.status.replace("_", " ")}.` };
  }

  return {
    ok: true,
    booking: {
      ...booking,
      status: "confirmed",
      collection: { ...booking.collection, paidToHotel: booking.totalBill, pending: 0 },
      razorpayOrderId,
      razorpayPaymentId,
      paymentMethod,
      paidAt,
    },
  };
}

/** Statuses that hold a physical room off the market. */
export const OCCUPYING_STATUSES = new Set(["confirmed", "checked_in", "pending_payment"]);

/**
 * A booking that still needs a room but doesn't have one — the shared
 * predicate behind the dashboard/summary "Unassigned rooms" count, the
 * `unassignedOnly` scoped view, and the Bookings screen's unassigned pill.
 * `checked_out`/`cancelled`/`no_show` bookings never need a room, so they're
 * excluded via `OCCUPYING_STATUSES` rather than checked separately.
 */
export function isUnassignedOccupyingBooking(b: Pick<Booking, "roomNo" | "status">): boolean {
  return b.roomNo === null && OCCUPYING_STATUSES.has(b.status);
}

/** A stay the guest never took. Money held against one is owed back, not earned. */
const VOID_STAY_STATUSES = new Set<BookingStatus>(["cancelled", "no_show"]);

/**
 * The Bookings screen's "Cancellations" figure — `cancelled` and `no_show`
 * together, same set as `VOID_STAY_STATUSES` — as a row-level predicate for
 * the Cancellations stat-card filter. Deliberately not exposing
 * `VOID_STAY_STATUSES` itself; callers outside this module get the
 * predicate, not the Set.
 */
export function isCancelledOrNoShow(b: Pick<Booking, "status">): boolean {
  return VOID_STAY_STATUSES.has(b.status);
}

/** Row-level form of the Bookings summary's "Today's check-ins" count. */
export function isCheckInOn(b: Pick<Booking, "checkIn">, date: string): boolean {
  return b.checkIn === date;
}

/** Row-level form of the Bookings summary's "Today's check-outs" count. */
export function isCheckOutOn(b: Pick<Booking, "checkOut">, date: string): boolean {
  return b.checkOut === date;
}

/** A stay that has begun — the guest has arrived, whether in-house or gone. */
const ARRIVED_STATUSES = new Set<BookingStatus>(["checked_in", "checked_out"]);
/** Booked but not yet arrived; excludes the void statuses (cancelled/no_show). */
const AWAITING_ARRIVAL_STATUSES = new Set<BookingStatus>(["confirmed", "pending_payment"]);

/** Compact room-type label for the arrivals queue, distinct from `ROOM_TYPES`. */
const ROOM_TYPE_SHORT: Record<RoomType, string> = {
  deluxe: "Deluxe",
  deluxe_balcony: "Deluxe Balcony",
};

/**
 * Slice 2's architecture change: the booking ledger, not the floor board, is
 * the source of truth for "which rooms are occupied." A room is physically
 * occupied right now only when a `checked_in` booking is assigned to it and
 * tonight falls inside its stay — booked-but-not-arrived and
 * arrived-but-unassigned both correctly fail to count (the latter can't even
 * arise once `checkInEligibilityError` below is enforced).
 *
 * This is deliberately narrower than `OCCUPYING_STATUSES` (used by
 * `checkAvailability` and the assignment-conflict check below): those ask
 * "is this room spoken for over a date range," which a `confirmed`
 * pre-arrival booking already answers yes to. This asks "is a guest in the
 * room tonight," which only `checked_in` can.
 */
function physicallyOccupiedRoomNumbers(bookings: Booking[], today: string): Set<string> {
  const rooms = new Set<string>();
  for (const b of bookings) {
    if (b.roomNo && b.status === "checked_in" && b.checkIn <= today && today < b.checkOut) {
      rooms.add(b.roomNo);
    }
  }
  return rooms;
}

/** "2026-07-15" → "15 Jul". */
function shortRoomDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * The floor board as it actually stands right now — the read-time overlay
 * that makes the booking ledger and the board into one source of truth
 * instead of two that can silently disagree.
 *
 * `available`/`cleaning`/`maintenance` are opinions staff set manually (via
 * `updateRoomStatusFn`) and pass through untouched. `occupied` is never one
 * of those opinions anymore: it is computed fresh from
 * `physicallyOccupiedRoomNumbers` on every read, so it can't drift, and a
 * stored `occupied` left over from before this change (or from seed data)
 * self-heals to `available` here — a display-time correction only; nothing
 * in this function writes to `rooms`. A real checked-in guest overrides a
 * stale `cleaning` label (physical reality outranks housekeeping opinion);
 * `maintenance` is never overridden here because `checkInEligibilityError`
 * and `assignableRoomError` refuse to let a booking reach a maintenance room
 * in the first place.
 */
function liveRoomTiles(
  tiles: RoomTile[],
  bookings: Booking[],
  guests: Guest[],
  today: string,
): RoomTile[] {
  const occupantByRoom = new Map<string, Booking>();
  for (const b of bookings) {
    if (b.roomNo && b.status === "checked_in" && b.checkIn <= today && today < b.checkOut) {
      occupantByRoom.set(b.roomNo, b);
    }
  }
  const guestName = new Map(guests.map((g) => [g.id, g.name]));

  return tiles.map((t) => {
    const occupant = occupantByRoom.get(t.no);
    if (occupant) {
      const name = guestName.get(occupant.guestId) ?? "Guest";
      return {
        ...t,
        status: "occupied",
        detail: `${name} · out ${shortRoomDate(occupant.checkOut)}`,
      };
    }
    if (t.status === "occupied") return { ...t, status: "available", detail: "Ready" };
    return t;
  });
}

/** Half-open date-range overlap: `[aIn, aOut)` vs. `[bIn, bOut)`. */
function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

/**
 * Whether `roomNo` can be assigned to `booking` — used by both the
 * assignment server fn and, for the room a booking already holds, by
 * `checkInEligibilityError`. `maintenance` is a hard stop (the room is
 * physically unusable — a checked-in guest must never silently override
 * it); `cleaning` is not (assigning into a room that's about to be turned
 * over is normal front-desk practice). Conflicts are checked against
 * `OCCUPYING_STATUSES`, not just `checked_in` — a future `confirmed`
 * booking already holding the room for an overlapping stay must also block,
 * or assignment could double-book a room nobody has checked into yet.
 */
function assignableRoomError(
  data: { bookings: Booking[]; rooms?: RoomTile[] },
  booking: Booking,
  roomNo: string,
): string | undefined {
  const room = (data.rooms ?? defaultRoomTiles()).find((r) => r.no === roomNo);
  if (!room) return `Room ${roomNo} does not exist.`;
  if (room.type !== booking.roomType) {
    return `Room ${roomNo} is a ${ROOM_TYPE_SHORT[room.type]} room, not ${ROOM_TYPE_SHORT[booking.roomType]}.`;
  }
  if (room.status === "maintenance") {
    return `Room ${roomNo} is under maintenance and can't be assigned.`;
  }
  const conflict = data.bookings.find(
    (b) =>
      b.id !== booking.id &&
      b.roomNo === roomNo &&
      OCCUPYING_STATUSES.has(b.status) &&
      rangesOverlap(booking.checkIn, booking.checkOut, b.checkIn, b.checkOut),
  );
  if (conflict) {
    return `Room ${roomNo} is already held by booking ${conflict.id} for overlapping dates.`;
  }
  return undefined;
}

/**
 * Slice 2: assign, reassign, or unassign (`roomNo: null`) the physical room
 * for a booking. A pure rule, same shape as `cancelGuestBooking` — it
 * decides and returns, `bookings-data.ts` persists.
 *
 * A `checked_in` booking cannot be unassigned outright (a guest can't be
 * checked in to no room — the same invariant `checkInEligibilityError`
 * enforces going the other direction) but CAN be reassigned straight to a
 * different valid room in one step: occupancy is derived from `roomNo` +
 * status, so moving it frees the old room and occupies the new one with
 * nothing else to reconcile.
 */
export function assignBookingRoom(
  data: BookingData,
  bookingId: string,
  roomNo: string | null,
): Result<{ booking: Booking }> {
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };

  if (roomNo === null) {
    if (booking.status === "checked_in") {
      return {
        ok: false,
        error: "Check the guest out, or assign a different room, before unassigning this one.",
      };
    }
    return { ok: true, booking: { ...booking, roomNo: null, roomAssignedAt: undefined } };
  }

  const error = assignableRoomError(data, booking, roomNo);
  if (error) return { ok: false, error };
  return {
    ok: true,
    booking: { ...booking, roomNo, roomAssignedAt: new Date().toISOString() },
  };
}

/**
 * The check-in invariant: a booking cannot become `checked_in` without a
 * room already assigned (removes the "checked-in but unassigned" ambiguity
 * at the source, rather than guessing how occupancy should count it), and
 * not into a room currently flagged `maintenance` — that flag can be set
 * *after* the room was assigned, so it's re-checked here, not only at
 * assignment time.
 */
export function checkInEligibilityError(
  data: { rooms?: RoomTile[] },
  booking: Booking,
): string | undefined {
  if (!booking.roomNo) return "Assign a room before checking in.";
  const room = (data.rooms ?? defaultRoomTiles()).find((r) => r.no === booking.roomNo);
  if (room?.status === "maintenance") {
    return `Room ${booking.roomNo} is under maintenance — reassign before checking in.`;
  }
  return undefined;
}

/**
 * Rooms free to sell right now — read off the floor board, so the sidebar badge
 * quotes the same figure as the Rooms screen it links to.
 *
 * "Available" is narrower than the dashboard's "vacant": a room being cleaned or
 * under maintenance is unoccupied but cannot be sold, so it counts toward vacant
 * and not toward this.
 */
export async function getAvailableRoomCount(
  data: BookingData,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<number> {
  const tiles = liveRoomTiles(data.rooms ?? defaultRoomTiles(), data.bookings, data.guests, today);
  return countTiles(tiles, "available");
}

/**
 * Tonight's occupancy, derived whole from the floor board: the percentage, the
 * per-type splits and the vacant count all fall out of the tiles, so the card
 * cannot contradict the Rooms screen or itself. Only the party-hall line is
 * still seeded (see below).
 *
 * The tiles passed in are expected to already be `liveRoomTiles`'s output —
 * this function itself has no opinion on where "occupied" comes from.
 */
function occupancyNow(tiles: RoomTile[] = defaultRoomTiles()): Occupancy {
  const occupied = countTiles(tiles, "occupied");
  const total = tiles.length;

  return {
    occupied,
    total,
    pct: Math.round((occupied / total) * 100),
    deluxe: {
      occupied: countTiles(tiles, "occupied", "deluxe"),
      total: tiles.filter((t) => t.type === "deluxe").length,
    },
    deluxeBalcony: {
      occupied: countTiles(tiles, "occupied", "deluxe_balcony"),
      total: tiles.filter((t) => t.type === "deluxe_balcony").length,
    },
    // Vacant means "nobody in it" — cleaning and maintenance rooms included.
    vacant: total - occupied,
    // FIXME: still seeded, and it disagrees with the pipeline — PH-20260822-007
    // ("Reception — Priya & Arjun", 22 Aug) is an *enquiry*, not a booking, so
    // "Booked" overstates it. Deriving this line is its own change.
    partyHall: "Booked 22 Aug",
  };
}

/**
 * Everything the admin dashboard renders, in one round-trip. The stat cards, the
 * arrivals queue, `unassignedRooms`, `occupancy` and `revenue` are all derived
 * from the live booking set so the figures stay truthful.
 *
 * Two things are still stubbed, because the data to derive them does not exist
 * yet — not because the design wants them fixed:
 *
 *   - the **recent-activity feed**, which needs an event log nothing writes today
 *     (there is no create/pay/cancel path outside invites) — spec 13's whole job;
 *   - each arrival's **time of day** and **party size**, which have no field in
 *     the booking model — they arrive with manual entry in spec 19.
 *
 * These are left as marked FIXME stubs rather than plausible-looking mock, so the
 * screen never quietly presents an invented number as a real one.
 */
export async function getDashboardData(
  data: BookingData,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<DashboardData> {
  const unassignedRooms = data.bookings.filter(
    (b) => b.roomNo === null && OCCUPYING_STATUSES.has(b.status),
  ).length;

  // Today's arrivals: everyone whose check-in is today and who has not voided
  // (cancelled/no_show). `arrived` and `pending` partition it, so total = sum.
  const arrivalsToday = data.bookings.filter(
    (b) =>
      b.checkIn === today &&
      (ARRIVED_STATUSES.has(b.status) || AWAITING_ARRIVAL_STATUSES.has(b.status)),
  );
  const checkInsToday = {
    total: arrivalsToday.length,
    arrived: arrivalsToday.filter((b) => ARRIVED_STATUSES.has(b.status)).length,
    pending: arrivalsToday.filter((b) => AWAITING_ARRIVAL_STATUSES.has(b.status)).length,
  };

  // Today's departures: `settled` has checked out, `late` is still in-house on
  // the checkout date. Same partition, so total = settled + late.
  const departuresToday = data.bookings.filter(
    (b) => b.checkOut === today && (b.status === "checked_out" || b.status === "checked_in"),
  );
  const checkOutsToday = {
    total: departuresToday.length,
    settled: departuresToday.filter((b) => b.status === "checked_out").length,
    late: departuresToday.filter((b) => b.status === "checked_in").length,
  };

  const awaitingArrival = arrivalsToday.filter((b) => AWAITING_ARRIVAL_STATUSES.has(b.status));
  const guestById = new Map(data.guests.map((g) => [g.id, g]));

  const arrivals: ArrivalItem[] = arrivalsToday.map((b) => {
    const name = guestById.get(b.guestId)?.name ?? "—";
    return {
      id: b.id,
      initials: initialsOf(name),
      name,
      roomType: ROOM_TYPE_SHORT[b.roomType],
      nights: b.urn,
      time: "", // FIXME(spec-19): booking model has no arrival time of day.
      assignment: b.roomNo ? `Room ${b.roomNo}` : "unassigned",
      assigned: b.roomNo !== null,
    };
  });

  return {
    checkInsToday,
    checkOutsToday,
    expectedArrivals: {
      total: awaitingArrival.length,
      // FIXME(spec-19): no arrival time means no "next"; show who is due, not a
      // fabricated 2:30 PM. `nextTime` stays blank until manual entry adds it.
      nextTime: "",
      nextLabel: awaitingArrival[0] ? (guestById.get(awaitingArrival[0].guestId)?.name ?? "") : "",
    },
    unassignedRooms,
    occupancy: occupancyNow(
      liveRoomTiles(data.rooms ?? defaultRoomTiles(), data.bookings, data.guests, today),
    ),
    revenue: revenuePeriods(data, today),
    // FIXME(spec-13): no event log exists to derive this from — nothing writes
    // check-in/payment/enquiry/cancellation events yet. Empty until spec 13.
    activity: [],
    arrivals,
  };
}

/** Physical rooms held off the market on a date by an occupying booking. */
function occupiedRoomsOn(bookings: Booking[], onDate: string): Set<string> {
  const occupied = new Set<string>();
  for (const b of bookings) {
    if (!b.roomNo || !OCCUPYING_STATUSES.has(b.status)) continue;
    if (b.checkIn <= onDate && onDate < b.checkOut) occupied.add(b.roomNo);
  }
  return occupied;
}

/**
 * Bookings whose stay starts or ends on `date`, for the day-details card's
 * Arrivals/Departures rows. Deliberately not `OCCUPYING_STATUSES` — that set
 * drops `checked_out`, which would zero out arrival/departure counts for any
 * past date once its guests have since left. The only bookings that
 * shouldn't count are ones where nobody actually moved: `cancelled` and
 * `no_show`. `pending_payment` counts as an expected arrival (Pay-at-Hotel is
 * the normal pre-arrival state here, consistent with
 * `AWAITING_ARRIVAL_STATUSES` grouping it with `confirmed`).
 */
function arrivalsOn(bookings: Booking[], date: string): Booking[] {
  return bookings.filter((b) => b.checkIn === date && !VOID_STAY_STATUSES.has(b.status));
}

/** See `arrivalsOn` — same non-void predicate, keyed on `checkOut` instead. */
function departuresOn(bookings: Booking[], date: string): Booking[] {
  return bookings.filter((b) => b.checkOut === date && !VOID_STAY_STATUSES.has(b.status));
}

/**
 * Everything the admin Bookings screen renders. Summary figures, tab counts
 * and the period-totals footer are all derived from the live booking set (not
 * seeded), so "totals auto" holds and the numbers stay honest across edits.
 */
export async function getBookingsPageData(
  data: BookingData,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<BookingsPageData> {
  const guestName = new Map(data.guests.map((g) => [g.id, g.name]));
  const rows = [...data.bookings].sort(byBookingNumber).map((booking) => ({
    booking,
    guestName: guestName.get(booking.guestId) ?? "—",
  }));

  const countsByStatus = data.bookings.reduce(
    (acc, b) => {
      acc[b.status] += 1;
      return acc;
    },
    {
      confirmed: 0,
      checked_in: 0,
      checked_out: 0,
      pending_payment: 0,
      cancelled: 0,
      no_show: 0,
    } as Record<BookingStatus, number>,
  );

  const totals = data.bookings.reduce<BookingsPageData["totals"]>(
    (acc, b) => {
      acc.roomRev += b.revenue.room;
      acc.earlyCheckIn += b.revenue.earlyCheckIn;
      acc.lateCheckOut += b.revenue.lateCheckOut;
      acc.other += b.revenue.other;
      acc.totalBill += b.totalBill;
      acc.paidToHotel += b.collection.paidToHotel;
      acc.otaCollection += b.collection.otaCollection;
      acc.pending += b.collection.pending;
      return acc;
    },
    {
      roomRev: 0,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      other: 0,
      totalBill: 0,
      paidToHotel: 0,
      otaCollection: 0,
      pending: 0,
    },
  );

  // "Occupied" is booking-driven (Slice 2): a room only counts once a
  // checked_in booking is assigned to it for tonight — see `liveRoomTiles`.
  const liveTiles = liveRoomTiles(
    data.rooms ?? defaultRoomTiles(),
    data.bookings,
    data.guests,
    today,
  );
  const tonight = occupancyNow(liveTiles);
  const totalUrn = data.bookings.reduce((sum, b) => sum + b.urn, 0);
  const totalCollected = data.bookings.reduce(
    (sum, b) => sum + computeTotalCollected(b.collection),
    0,
  );

  const unassignedRooms = data.bookings.filter(isUnassignedOccupyingBooking).length;

  const summary: BookingsPageData["summary"] = [
    {
      key: "unassignedRooms",
      label: "Unassigned rooms",
      value: String(unassignedRooms),
    },
    {
      key: "checkInsToday",
      label: "Today's check-ins",
      value: String(data.bookings.filter((b) => isCheckInOn(b, today)).length),
    },
    {
      key: "checkOutsToday",
      label: "Today's check-outs",
      value: String(data.bookings.filter((b) => isCheckOutOn(b, today)).length),
    },
    {
      key: "occupied",
      label: "Occupied rooms",
      value: `${tonight.occupied} / ${tonight.total}`,
    },
    {
      // Here "available" means unoccupied, matching this screen's design — the
      // Rooms screen counts only sellable rooms, so it reads lower.
      key: "available",
      label: "Available rooms",
      value: String(tonight.vacant),
    },
    { key: "totalUrn", label: "Total URN (period)", value: String(totalUrn) },
    { key: "roomRevenue", label: "Room revenue", value: formatINR(totals.roomRev) },
    {
      key: "totalCollected",
      label: "Total collected",
      value: formatINR(totalCollected),
    },
    {
      key: "pendingCollection",
      label: "Pending collection",
      value: formatINR(totals.pending),
    },
    {
      key: "otaReceivables",
      label: "OTA receivables",
      value: formatINR(totals.otaCollection),
    },
    {
      key: "cancellations",
      label: "Cancellations",
      value: String(countsByStatus.cancelled + countsByStatus.no_show),
    },
  ];

  return {
    today,
    total: data.bookings.length,
    summary,
    countsByStatus,
    rows,
    totals,
    rooms: liveTiles,
  };
}

// ── Rooms screen ───────────────────────────────────────────────────────────

const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  occupied: "Occupied",
  available: "Available",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

/** Legend order — matches the design's swatch row. */
const ROOM_STATUS_ORDER: RoomStatus[] = ["occupied", "available", "cleaning", "maintenance"];

/**
 * Per-room state overriding the default "available" — housekeeping opinions
 * only (`maintenance`/`cleaning`), set the same way staff would via
 * `updateRoomStatusFn`. `occupied` is never seeded here (Slice 2): it is
 * computed live from the booking ledger by `liveRoomTiles`, so a room's
 * "occupied" fact always traces back to an actual checked-in booking rather
 * than an invented board entry that could silently disagree with it.
 */
const ROOM_STATE_SEED: Record<string, { status: RoomStatus; detail: string }> = {
  "105": { status: "maintenance", detail: "AC repair" },
  "205": { status: "cleaning", detail: "Turnover" },
};

/**
 * The state of all 14 physical rooms right now, before the booking ledger's
 * live `occupied` overlay (`liveRoomTiles`) is applied. Everything asking
 * about room state today goes through here first.
 */
/** Rooms of a type in a given state — the one counting rule behind the tiles. */
function countTiles(tiles: RoomTile[], status: RoomStatus, type?: RoomType): number {
  return tiles.filter((t) => t.status === status && (!type || t.type === type)).length;
}

function buildRoomTile(unit: RoomUnit): RoomTile {
  const seed = ROOM_STATE_SEED[unit.no];
  return {
    no: unit.no,
    type: unit.type,
    floor: unit.floor,
    status: seed?.status ?? "available",
    detail: seed?.detail ?? "Ready",
    sizeSqm: null,
  };
}

/** The default 14-room inventory, seeded to mirror the design — the fallback
 *  every function here uses when `data.rooms` is not supplied. */
export function defaultRoomTiles(): RoomTile[] {
  return ROOM_UNITS.map(buildRoomTile);
}

/**
 * Room Settings redesign (slice B): statuses that count as "a real body in
 * the room tonight." Deliberately wider than `liveRoomTiles`'s `occupied`
 * status — a `confirmed` booking that was never manually flipped to
 * `checked_in` still holds the room. Shared by `currentOccupant` (one room)
 * and `inHouseGuestsOn` (the whole house) so the two can't drift apart.
 */
const IN_HOUSE_STATUSES = new Set<BookingStatus>(["checked_in", "confirmed"]);

/**
 * Who's actually in `roomNo` tonight, for the per-room table. `checkOut` is
 * exclusive (`check_out > today`, not `>=`): a guest checking out today has
 * already vacated by the time "tonight" is asked about.
 *
 * Multiple matches for one room are a data artifact (see #85's drift), not
 * something to throw on — the earliest `checkIn` wins and one name is always
 * returned rather than an error surfacing on a settings screen.
 */
export function currentOccupant(
  roomNo: string,
  bookings: Booking[],
  guests: Guest[],
  today: string,
): string | null {
  const matches = bookings
    .filter(
      (b) =>
        b.roomNo === roomNo &&
        IN_HOUSE_STATUSES.has(b.status) &&
        b.checkIn <= today &&
        today < b.checkOut,
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const occupant = matches[0];
  if (!occupant) return null;
  return guests.find((g) => g.id === occupant.guestId)?.name ?? null;
}

/**
 * The day-details card's in-house guest list: every guest occupying a room
 * on `date`, same predicate as `currentOccupant` (`checked_in`/`confirmed`,
 * `checkOut` exclusive) but for the whole house instead of one room.
 * Unassigned bookings (no `roomNo`) can't appear on a room list and are
 * skipped, same as `occupiedRoomsOn`. Sorted by room number so the card's
 * "+{n} more" truncation is stable.
 */
export function inHouseGuestsOn(
  bookings: Booking[],
  guests: Guest[],
  date: string,
): Array<{ guestName: string; roomNo: string }> {
  const guestName = new Map(guests.map((g) => [g.id, g.name]));
  return bookings
    .filter(
      (b) => b.roomNo && IN_HOUSE_STATUSES.has(b.status) && b.checkIn <= date && date < b.checkOut,
    )
    .map((b) => ({ guestName: guestName.get(b.guestId) ?? "—", roomNo: b.roomNo! }))
    .sort((a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }));
}

/** Whether `no` is already on the floor board — the duplicate-number guard
 *  `validateAddRoom` composes with. */
export function roomNumberTaken(rooms: RoomTile[], no: string): boolean {
  return rooms.some((r) => r.no === no);
}

/**
 * Whether a room can be hard-deleted. Counts *every* booking ever placed in
 * the room, not just currently-occupying ones — a checked-out booking from
 * months ago still needs the room row to exist for its history to make
 * sense, so it blocks deletion exactly like an active one does. No cascade,
 * no soft-delete: the caller either can't delete, or the row is just gone.
 */
export function canDeleteRoom(bookings: Booking[], roomNo: string): boolean {
  return !bookings.some((b) => b.roomNo === roomNo);
}

/**
 * Settings' "Add room" rule — same shape as `createGuest`'s phone-collision
 * guard: a pure check the server fn asks before it writes, so the error
 * message that names the conflict lives in one place, not duplicated between
 * a client-side check and the write path.
 */
export function validateAddRoom(
  rooms: RoomTile[],
  no: string,
  floor: 1 | 2,
  type: RoomType,
): Result {
  const trimmed = no.trim();
  if (!trimmed) return { ok: false, error: "Room number is required." };
  if (roomNumberTaken(rooms, trimmed)) {
    return { ok: false, error: `Room ${trimmed} already exists.` };
  }
  if (floor !== 1 && floor !== 2) {
    return { ok: false, error: "Floor must be 1 or 2." };
  }
  if (type !== "deluxe" && type !== "deluxe_balcony") {
    return { ok: false, error: "Unrecognized room type." };
  }
  return { ok: true };
}

/**
 * Each room type's rate/area/count for display, blending the persisted
 * overrides (rate, area) with a `count` that is never stored — it is always
 * however many tiles of that type actually exist on the floor board, so
 * adding or removing a room can never leave a stale count behind.
 */
export function resolveRoomTypes(
  tiles: RoomTile[],
  overrides?: BookingData["roomTypeOverrides"],
): RoomTypeInfo[] {
  return ROOM_TYPES.map((rt) => ({
    ...rt,
    name: overrides?.[rt.type]?.name ?? rt.name,
    count: tiles.filter((t) => t.type === rt.type).length,
    areaSqm: overrides?.[rt.type]?.areaSqm ?? rt.areaSqm,
    pricePerNight: overrides?.[rt.type]?.pricePerNight ?? rt.pricePerNight,
  }));
}

/**
 * The three Slice B add-on rates, blending persisted overrides over the
 * defaults above — same "override over default" shape as `resolveRoomTypes`,
 * so a rate shown in Settings, quoted to a guest, and snapshotted onto a
 * booking can never disagree.
 */
export function resolveRoomGstPct(override?: BookingData["gstRateOverride"]): number {
  return override ?? GST_PCT;
}

/** Party-hall's own GST rate — independent `addon_settings` row
 *  (`partyHallGstPct`) from the room rate above, same "override over
 *  default" shape. Missing falls back to `PARTY_HALL_GST_PCT`. */
export function resolvePartyHallGstPct(override?: BookingData["partyHallGstRateOverride"]): number {
  return override ?? PARTY_HALL_GST_PCT;
}

/**
 * The GST write-path guard — pulled out as a pure rule, same reason
 * `validateAddRoom` is, so the write handler and a test can agree on exactly
 * what "obviously wrong" means without duplicating the bounds. Stricter than
 * a plain add-on rate (which only rejects negative): 0% and anything over
 * 100% are both rejected too, since this is the one field on the panel where
 * a bad save mis-taxes every invoice issued after it, not just one booking.
 */
export function validateGstPct(pct: number): Result {
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { ok: false, error: "GST rate must be greater than 0 and no more than 100." };
  }
  return { ok: true };
}

export function resolveAddOnRates(overrides?: BookingData["addOnRateOverrides"]): AddOnRates {
  return {
    earlyCheckIn: overrides?.earlyCheckIn ?? EARLY_CHECKIN_FEE,
    lateCheckOut: overrides?.lateCheckOut ?? LATE_CHECKOUT_FEE,
    extraMattress: overrides?.extraMattress ?? EXTRA_MATTRESS_FEE,
  };
}

/**
 * Everything the admin Rooms screen renders. Tile statuses start from the
 * floor board (`data.rooms`, falling back to the seeded default) but
 * `occupied` is overlaid live from the booking ledger via `liveRoomTiles`
 * (Slice 2) — `available`/`cleaning`/`maintenance` stay manual opinions, but
 * a room with a checked-in guest in it always shows occupied here, the same
 * as the dashboard and Bookings screen. The legend counts and each type
 * card's availability are then derived from those tiles so they can never
 * drift out of sync with each other.
 */
export async function getRoomsPageData(
  data: BookingData,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<RoomsPageData> {
  const tiles = liveRoomTiles(data.rooms ?? defaultRoomTiles(), data.bookings, data.guests, today);
  const roomTypes = resolveRoomTypes(tiles, data.roomTypeOverrides);

  const countByStatus = tiles.reduce(
    (acc, t) => {
      acc[t.status] += 1;
      return acc;
    },
    { occupied: 0, available: 0, cleaning: 0, maintenance: 0 } as Record<RoomStatus, number>,
  );

  const typeCards: RoomTypeCard[] = roomTypes.map((rt) => ({
    type: rt.type,
    name: rt.name,
    count: rt.count,
    areaSqm: rt.areaSqm,
    pricePerNight: rt.pricePerNight,
    available: tiles.filter((t) => t.type === rt.type && t.status === "available").length,
  }));

  const legend: RoomsLegendItem[] = ROOM_STATUS_ORDER.map((status) => ({
    status,
    label: ROOM_STATUS_LABEL[status],
    count: countByStatus[status],
  }));

  const floorNumbers = [...new Set(tiles.map((t) => t.floor))].sort((a, b) => b - a) as (1 | 2)[];
  const floors: RoomFloor[] = floorNumbers.map((floor) => {
    const floorTiles = tiles.filter((t) => t.floor === floor);
    const mix = roomTypes
      .map((rt) => ({
        label: rt.name.split(" ")[0],
        n: floorTiles.filter((t) => t.type === rt.type).length,
      }))
      .filter((m) => m.n > 0)
      .map((m) => `${m.n} ${m.label}`)
      .join(" + ");
    return {
      floor,
      label: `${floor === 2 ? "Second" : "First"} floor${mix ? ` · ${mix}` : ""}`,
      rooms: floorTiles,
    };
  });

  const nextEvent = nextPartyHallEvent(data.partyHall, today);
  const partyHall = {
    nextLabel: nextEventLabel(nextEvent),
    // No events at all: "Next" already says "No events scheduled" — an
    // availability window under that is noise, so this line stays empty.
    // Once there's a next event, the line always renders, including the
    // fully-booked case ("Fully booked this week") — an absent line there
    // would read as a broken tile, not a true "nothing free".
    availability: nextEvent ? partyHallAvailability(data.partyHall, today) : "",
  };

  const summaryLine = `${tiles.length} rooms · ${countByStatus.occupied} occupied · ${countByStatus.available} available tonight · 1 party hall`;

  return { summaryLine, typeCards, legend, floors, partyHall };
}

/** Party-hall slot → display label. */
const SLOT_LABEL: Record<PartyHallEnquiry["slot"], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  full_day: "Full day",
};

// ── Calendar screen ────────────────────────────────────────────────────────

const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BAND_LABEL: Record<OccupancyBand, string> = {
  low: "Low (<40%)",
  medium: "Medium",
  high: "High (70%+)",
  full: "Full",
};

/** Legend order — matches the design's swatch row. */
const BAND_ORDER: OccupancyBand[] = ["low", "medium", "high", "full"];

export interface CalendarMonth {
  year: number;
  month: number;
}

/**
 * Parses the `year`/`month` search params for the admin Calendar and Party
 * Hall screens. Malformed in *either* piece — non-numeric, `month` outside
 * 1–12, `year` outside a sane range — falls back to the whole pair, not just
 * the bad one: a garbled URL lands on "today" entirely, rather than a hybrid
 * like a valid year paired with today's month that nobody asked for.
 *
 * `now` is a parameter (not read internally) so this stays pure and
 * deterministic to test.
 */
export function normalizeCalendarSearch(
  input: { year?: unknown; month?: unknown },
  now: Date = new Date(),
): CalendarMonth {
  const year = Number(input.year);
  const month = Number(input.month);
  const valid =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    year >= 1970 &&
    year <= 2100;
  if (valid) return { year, month };
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * `year`/`month` shifted by `delta` months, rolling the year at the Dec/Jan
 * boundary — `delta` is ±1 for Prev/Next, but this holds for any integer step.
 */
export function shiftCalendarMonth(year: number, month: number, delta: number): CalendarMonth {
  const zeroBased = month - 1 + delta;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: (((zeroBased % 12) + 12) % 12) + 1,
  };
}

/** Occupancy percent → shading band. Thresholds mirror the legend. */
export function occupancyBand(pct: number): OccupancyBand {
  if (pct >= 100) return "full";
  if (pct >= 70) return "high";
  if (pct >= 40) return "medium";
  return "low";
}

/**
 * The month grid the admin Calendar screen renders. Blanks pad the grid to whole
 * weeks so the first falls on its real weekday and the last row squares off.
 */
export async function getCalendarPageData(
  data: BookingData,
  year = 2026,
  month = 7,
): Promise<CalendarPageData> {
  // The denominator is live and maintenance-aware: a room under maintenance
  // isn't sellable inventory, so it comes out of the total rather than
  // counting toward it (a `cleaning` room is a same-day turnover state, still
  // sellable, and stays in). This isn't a per-day figure — room status has no
  // date-ranged history in this schema — so every day in the grid is measured
  // against the same sellable count, computed once here.
  //
  // KNOWN LIMITATION: because there's no history, this is also today's
  // maintenance status applied retroactively. Put a room into maintenance
  // this morning and every past day in the currently-rendered month reflects
  // that room as unsellable, including days last week when it was actually
  // available and sold. Past-month occupancy percentages are therefore not
  // historically reliable — they reflect current room status, not the status
  // in force on the date shown. Fixing this needs a room-status history
  // table; not worth building for this fix.
  const rooms = data.rooms ?? defaultRoomTiles();
  const maintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;
  const total = rooms.length - maintenanceRooms;
  // UTC throughout: local-time dates shift the weekday offset west of GMT.
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ kind: "blank" });

  // The day-details card's data is folded in here rather than fetched on
  // click: `data` is already the whole in-memory BookingData load() produced
  // for this page render, so deriving every day's card up front is pure CPU
  // over data already in hand — not a second DB read per day, and not one
  // per click either.
  const dayDetails: Record<string, CalendarDayDetails> = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const details = getCalendarDayDetails(data, date);
    dayDetails[date] = details;
    cells.push({
      kind: "day",
      date,
      day,
      occupied: details.occupied,
      total: details.total,
      maintenanceRooms,
      pct: details.pct,
      band: occupancyBand(details.pct),
      event: details.event,
    });
  }

  while (cells.length % 7 !== 0) cells.push({ kind: "blank" });

  return {
    year,
    month,
    monthLabel: firstOfMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    weekdays: CALENDAR_WEEKDAYS,
    cells,
    legend: BAND_ORDER.map((band) => ({ band, label: BAND_LABEL[band] })),
    totalRooms: total,
    maintenanceRooms,
    dayDetails,
  };
}

/**
 * The day-details card's data for one clicked day. `occupied`/`total`/`pct`
 * reuse `occupiedRoomsOn` — the same derivation `getCalendarPageData` feeds
 * the cell's own bar and caption with — so the card can never show a
 * different number than the grid it was opened from. `event` matches the
 * cell's pill for the same reason: same non-void-non-cancelled statuses
 * (`isUpcomingEvent`, no `today`), not `TILE_BLOCKING_STATUS` — that set is
 * a Rooms-tile sellability concern, unrelated to what the pill already
 * signaled.
 */
export function getCalendarDayDetails(data: BookingData, date: string): CalendarDayDetails {
  const rooms = data.rooms ?? defaultRoomTiles();
  const maintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;
  const total = rooms.length - maintenanceRooms;
  const occupied = occupiedRoomsOn(data.bookings, date).size;
  const pct = Math.round((occupied / total) * 100);

  const event = data.partyHall.find((e) => e.date === date && isUpcomingEvent(e));

  return {
    date,
    occupied,
    total,
    pct,
    arrivals: arrivalsOn(data.bookings, date).length,
    departures: departuresOn(data.bookings, date).length,
    event: event ? `${event.title} · ${event.guests} pax` : null,
    inHouseGuests: inHouseGuestsOn(data.bookings, data.guests, date),
  };
}

// ── Party hall screen ──────────────────────────────────────────────────────

const PARTY_HALL_STATUS_LABEL: Record<PartyHallStatus, string> = {
  enquiry: "New",
  quote_sent: "Quote sent",
  advance_paid: "Advance paid",
  confirmed: "Confirmed",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** Pipeline order — cards sort by this, so what needs action floats up. */
const PARTY_HALL_STATUS_ORDER: PartyHallStatus[] = [
  "enquiry",
  "quote_sent",
  "advance_paid",
  "confirmed",
  "completed",
  "declined",
  "cancelled",
];

/** Slot line for a card: "Full day" reads oddly as "Full day slot". */
function slotLine(slot: PartyHallEnquiry["slot"]): string {
  return slot === "full_day" ? "Full day" : `${SLOT_LABEL[slot]} slot`;
}

/** The status-dependent tail of a card's meta line. */
function metaNote(e: PartyHallEnquiry): string {
  switch (e.status) {
    case "enquiry":
      return "awaiting quote";
    case "quote_sent":
      return "quote sent";
    case "advance_paid": {
      // `advancePct` is the rate snapshotted at record time — shown for
      // context alongside the amount, never read back into a recompute.
      const pct = e.advancePct != null ? ` (${e.advancePct}%)` : "";
      return `advance ${formatINRCompact(e.advancePaid)}${pct} paid`;
    }
    case "confirmed":
      return "balance due on day";
    case "completed":
      return "settled";
    case "declined":
      return "declined";
    case "cancelled":
      return "cancelled";
  }
}

/** What the card's amount means, given where the event sits in the pipeline.
 *  `quote_sent`/`declined` append the quote date when one is on record —
 *  `quotedAt` is null for every row quoted before migration 0011, so this
 *  must degrade to the plain "Quoted" caption rather than render "on null"
 *  or "on Invalid Date" for those. */
function amountLabel(status: PartyHallStatus, quotedAt?: string): string {
  switch (status) {
    case "enquiry":
      return "Est. quote";
    case "quote_sent":
    case "declined": {
      if (!quotedAt) return "Quoted";
      const date = new Date(quotedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      return `Quoted on ${date}`;
    }
    case "completed":
      return "Collected";
    default:
      return "Total";
  }
}

/**
 * The exhaustive status → actions matrix — the single place that decides
 * which CTAs a Party Hall card offers, and in what order. `EventCard` reads
 * this list rather than each status scattering its own
 * `canDecline`/`canCancel`/`ctaAction`-style boolean, which is how the set
 * used to drift out of sync per status.
 *
 * `today` is an ISO date (`YYYY-MM-DD`); `date` is TEXT in the schema, so
 * the past/future split for `confirmed` is a lexicographic string compare —
 * the same kind of comparison every other date check in this file already
 * relies on (e.g. `nextBookingId`'s prefix match, `isUpcomingEvent`'s
 * callers). `isUpcomingEvent` itself does *not* do this: it only tests
 * status (excludes `cancelled`/`completed`/`declined`), never the date, so
 * it can't stand in for the future/past test below.
 *
 * Order matters: `EventCard` renders left to right, and the design puts the
 * one primary (dark) action rightmost, so the primary kind is always last
 * in the returned list.
 */
export function partyHallCtaKinds(
  e: Pick<PartyHallEnquiry, "status" | "date" | "refundedAt">,
  today: string = new Date().toISOString().slice(0, 10),
): PartyHallCtaKind[] {
  switch (e.status) {
    case "enquiry":
      return ["decline", "send_quote"];
    case "quote_sent":
      return ["whatsapp", "decline", "record_advance"];
    case "advance_paid":
      return ["invoice", "cancel", "confirm"];
    case "confirmed":
      // `complete` is offered regardless of date — `completePartyHallEvent`
      // itself has no date guard (see its doc comment), so an admin closing
      // an event out early isn't blocked by this matrix either. Past-due is
      // a read-only nudge (`isPartyHallEventPastDue`), not a gate here.
      return e.date < today
        ? ["invoice", "complete"]
        : ["invoice", "cancel", "view_details", "complete"];
    case "declined":
      return ["reopen"];
    case "cancelled":
      // cancelPartyHallEvent only ever fires from advance_paid/confirmed —
      // both already have money on the books — and always stamps
      // refundedAt. This guard only matters for legacy rows cancelled
      // before that field existed, where nothing is known to have moved.
      return e.refundedAt != null ? ["invoice"] : [];
    case "completed":
      return ["invoice"];
  }
}

function buildEventItem(
  e: PartyHallEnquiry,
  advancePct: number,
  today: string,
): PartyHallEventItem {
  const day = e.date.slice(8, 10);
  const monthName = new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    timeZone: "UTC",
  });

  // Called once — `meta` and `statusNote` both read this result rather than
  // each invoking `metaNote` separately, so the two can never drift.
  const note = metaNote(e);

  return {
    enquiry: e,
    day,
    mon: monthName,
    statusLabel: PARTY_HALL_STATUS_LABEL[e.status],
    meta: `${slotLine(e.slot)} · ${e.guests} guests · ${note}`,
    // Same status-dependent text as the tail of `meta`, exposed on its own
    // so the money block can show it without parsing `meta`'s combined string.
    statusNote: note,
    tags: [e.package, ...e.addOns],
    amountLabel: amountLabel(e.status, e.quotedAt),
    // An un-quoted enquiry has no number yet — say so rather than show "₹0".
    amount: e.amount > 0 ? formatINRCompact(e.amount) : "₹—",
    advancePct,
    pastDue: isPartyHallEventPastDue(e, today),
    ctas: partyHallCtaKinds(e, today),
  };
}

/** Days of a month the hall is held, from the live enquiry set. */
function bookedDaysIn(partyHall: PartyHallEnquiry[], year: number, month: number): Set<number> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const days = new Set<number>();
  for (const e of partyHall) {
    if (isUpcomingEvent(e) && e.date.startsWith(prefix)) days.add(Number(e.date.slice(8, 10)));
  }
  return days;
}

/**
 * The rail's availability mini-calendar. Same UTC/blank-padding approach as the
 * main calendar grid, but a day is simply booked or not — the hall is one room.
 */
function miniCalendar(
  partyHall: PartyHallEnquiry[],
  year: number,
  month: number,
): PartyHallMiniCalendar {
  const booked = bookedDaysIn(partyHall, year, month);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: PartyHallCalendarCell[] = [];
  for (let i = 0; i < firstOfMonth.getUTCDay(); i++) cells.push({ kind: "blank" });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      kind: "day",
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
      booked: booked.has(day),
    });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "blank" });

  return {
    monthLabel: firstOfMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    weekdays: CALENDAR_WEEKDAYS.map((d) => d.charAt(0)),
    cells,
  };
}

/**
 * Everything the admin Party Hall screen renders. Every figure is derived from
 * the enquiry set: the stat strip, the pill counts, each card's copy and the
 * rail's booked days. Nothing here is seeded, so the strip cannot claim three
 * new enquiries while the list shows two.
 *
 * `year`/`month` select the rail's availability month (default: the design's
 * August 2026 display month).
 */
export async function getPartyHallPageData(
  data: BookingData,
  year = 2026,
  month = 8,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<PartyHallPageData> {
  const events = [...data.partyHall].sort(
    (a, b) =>
      PARTY_HALL_STATUS_ORDER.indexOf(a.status) - PARTY_HALL_STATUS_ORDER.indexOf(b.status) ||
      a.date.localeCompare(b.date) ||
      // Two events can share a status and a date — the hall has slots. Without
      // this the pair would be ordered by row order, which Postgres does not have.
      a.id.localeCompare(b.id),
  );

  const advancePct = resolvePartyHallRates(data.partyHallRateOverrides).phAdvancePct;

  const newEnquiries = events.filter((e) => e.status === "enquiry").length;
  const confirmedUpcoming = events.filter(
    (e) => e.status === "confirmed" && isUpcomingEvent(e, today),
  ).length;
  const pastDueCount = events.filter((e) => isPartyHallEventPastDue(e, today)).length;

  // Money held against events still to come — a settled event's takings are
  // revenue already booked, not an advance the hall is sitting on. Left on
  // the status-only check for now (not the `today` cutoff `confirmedUpcoming`
  // and "Next event" use below) — flagged separately, not changed here.
  const advanceCollected = events
    .filter((e) => isUpcomingEvent(e))
    .reduce((sum, e) => sum + e.advancePaid, 0);

  const stats: PartyHallStat[] = [
    { key: "newEnquiries", label: "New enquiries", value: String(newEnquiries) },
    { key: "confirmed", label: "Confirmed · upcoming", value: String(confirmedUpcoming) },
    { key: "pastDue", label: "Past due", value: String(pastDueCount) },
    {
      key: "advanceCollected",
      label: "Advance collected",
      value: formatINRCompact(advanceCollected),
    },
    {
      key: "nextEvent",
      label: "Next event",
      value: nextEventLabel(nextPartyHallEvent(data.partyHall, today)),
    },
  ];

  const pills: PartyHallPill[] = [
    { key: "all", label: "All", count: events.length },
    { key: "new", label: "New", count: newEnquiries },
    {
      key: "quoted",
      label: "Quoted",
      count: events.filter((e) => e.status === "quote_sent").length,
    },
    { key: "confirmed", label: "Confirmed", count: confirmedUpcoming },
    { key: "pastDue", label: "Past due", count: pastDueCount },
    {
      key: "cancelled",
      label: "Cancelled",
      count: events.filter((e) => e.status === "cancelled").length,
    },
    {
      key: "declined",
      label: "Declined",
      count: events.filter((e) => e.status === "declined").length,
    },
  ];

  return {
    subtitle: `Up to 150 guests · tailored pricing · ${newEnquiries} enquiries need a quote`,
    stats,
    pills,
    events: events.map((e) => buildEventItem(e, advancePct, today)),
    calendar: miniCalendar(data.partyHall, year, month),
    packages: PARTY_HALL_PACKAGES,
    addOnsLine: `Add-ons: catering ₹450/plate · decor · DJ. ${PARTY_HALL_ADVANCE_PCT}% advance to confirm.`,
  };
}

// ── Guests ──────────────────────────────────────────────────────────────────

/** A guest with two or more stays has come back — that is what "repeat" means. */
const REPEAT_STAYS = 2;

/**
 * Statuses of a stay that actually happened. A cancelled or no-show booking is
 * a stay the guest never took, and a future booking is one they have yet to
 * take — neither can be anybody's last stay.
 */
const BEGUN_STAY_STATUSES = new Set<BookingStatus>(["checked_in", "checked_out"]);

/** Avatar disc fill/ink, cycled by row position per the design's `av` list. */
const AVATAR_TOKENS: { bg: string; color: string }[] = [
  { bg: "#f0e7d3", color: "#a8863f" },
  { bg: "#e4eef7", color: "#3a6ea5" },
  { bg: "#eee7f7", color: "#7c5cbf" },
  { bg: "#e6efe6", color: "#5a8a5a" },
  { bg: "#f7e6e0", color: "#b4553f" },
];

/** "2026-07-14" → "14 Jul 2026". */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Everything the admin Guests screen renders. The directory joins each guest to
 * the live booking set, so "in-house" and "last stay" answer to the same rows
 * the Bookings screen lists, and the stat strip is counted off the directory it
 * sits above rather than seeded beside it.
 *
 * Note the booking set is a recent slice, not a full history: a guest whose
 * stays predate it shows a last stay of "—" despite a stay count above zero.
 * The design carries that same case (its Deepak Rao has one stay and no date).
 */
export async function getGuestsPageData(data: BookingData): Promise<GuestsPageData> {
  const inHouse = new Set<string>();
  const lastStayOn = new Map<string, string>();

  for (const b of data.bookings) {
    if (!BEGUN_STAY_STATUSES.has(b.status)) continue;
    if (b.status === "checked_in") inHouse.add(b.guestId);

    // The arrival date is when the guest stayed; for someone still in-house the
    // check-out is a date in the future, which no "last stay" should show.
    const previous = lastStayOn.get(b.guestId);
    if (!previous || b.checkIn > previous) lastStayOn.set(b.guestId, b.checkIn);
  }

  const guests: GuestListItem[] = [...data.guests]
    // Biggest spender first, then by name. `id` last, because two guests can
    // share a name and the avatar each gets is keyed off this position — so a
    // tie resolved by row order would reshuffle the badges from one query to
    // the next.
    .sort(
      (a, b) =>
        b.lifetimeValue - a.lifetimeValue ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .map((guest, i) => {
      const stayed = lastStayOn.get(guest.id);
      const avatar = AVATAR_TOKENS[i % AVATAR_TOKENS.length];
      return {
        guest,
        initials: initialsOf(guest.name),
        avatarBg: avatar.bg,
        avatarColor: avatar.color,
        lastStay: stayed ? longDate(stayed) : "—",
        inHouse: inHouse.has(guest.id),
      };
    });

  const repeatCount = guests.filter((g) => g.guest.stays >= REPEAT_STAYS).length;
  const topLtv = guests.reduce((max, g) => Math.max(max, g.guest.lifetimeValue), 0);

  const stats: GuestStat[] = [
    { key: "total", label: "Total guests", value: String(guests.length) },
    { key: "inHouse", label: "In-house now", value: String(inHouse.size) },
    { key: "repeat", label: "Repeat guests", value: String(repeatCount) },
    { key: "topLtv", label: "Lifetime value · top", value: formatINRCompact(topLtv) },
  ];

  return {
    subtitle: `${guests.length} profiles · ${repeatCount} repeat guests`,
    stats,
    guests,
  };
}

// ── Payments ────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  net_banking: "Net Banking",
  wallet: "Wallet",
  paylater: "Pay Later",
  cash: "Cash",
  ota: "OTA",
};

const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  success: "Success",
  pending: "Pending",
  refunded: "Refunded",
};

/** Booking sources that are OTA channels, with their display name and disc letter. */
/**
 * The OTAs we sell through. `commissionPct` is the contracted rate and
 * `connected` is whether the channel manager is live.
 *
 * The rate is stated once, here. Payments does not read it — it derives each
 * channel's rate from the rupees that channel actually kept — so the two are
 * independent, and `settings.test.ts` holds them to the same number for every
 * channel that has sold a stay. That is what caught Goibibo: the design's
 * settings mock says 16%, but Goibibo's own money says 15%, and the money wins.
 */
const OTA_CHANNELS: Record<
  string,
  { name: string; abbr: string; commissionPct: number; connected: boolean }
> = {
  booking_com: { name: "Booking.com", abbr: "B", commissionPct: 15, connected: true },
  makemytrip: { name: "MakeMyTrip", abbr: "M", commissionPct: 18, connected: true },
  goibibo: { name: "Goibibo", abbr: "G", commissionPct: 15, connected: true },
  agoda: { name: "Agoda", abbr: "A", commissionPct: 17, connected: true },
  oyo: { name: "OYO", abbr: "O", commissionPct: 20, connected: false },
};

/** True for a booking sold through an OTA rather than direct/walk-in/phone. */
export function isOtaSource(source: BookingSource): boolean {
  return source in OTA_CHANNELS;
}

/** The non-OTA sources — a guest-owed balance on one of these is cash-at-desk
 *  collectible, unlike an OTA row's balance, which is a channel receivable. */
export const DIRECT_SOURCES = new Set<BookingSource>(["direct", "walk_in", "phone"]);

/**
 * The transaction ledger, derived whole from the booking set — no seed. A
 * void stay (cancelled/no-show) never earned anything, so it yields no row.
 * Which row a live booking yields is a question its `collection` answers:
 *   - money the channel collected (`otaCollection`) → *pending*, because an OTA
 *     holds the guest's payment until it settles to us;
 *   - money in hand (`paidToHotel`) → *success*;
 *   - money still owed (`pending`) → *pending*, dated its due date.
 *
 * `method`/`at` are the instrument and settlement clock — `paymentMethod`/
 * `paidAt` on the booking. No write path sets either yet (that's b-ii/b-iii),
 * so today every non-OTA row shows both as `null`, rendered "—" — never
 * inferred from `razorpayPaymentId` (an instrument we don't actually know) or
 * backfilled from `createdAt` (when the row was made, not when it paid).
 */
function transactionsFrom(
  bookings: Booking[],
  guestName: Map<string, string>,
): PaymentTransaction[] {
  const rows: { txn: PaymentTransaction; sortAt: string }[] = [];

  for (const b of bookings) {
    if (VOID_STAY_STATUSES.has(b.status)) continue;

    const total = b.collection.paidToHotel + b.collection.otaCollection + b.collection.pending;
    if (total <= 0) continue;

    const [amount, status]: [number, TransactionStatus] =
      b.collection.otaCollection > 0
        ? [b.collection.otaCollection, "pending"]
        : b.collection.paidToHotel > 0
          ? [b.collection.paidToHotel, "success"]
          : [b.collection.pending, "pending"];

    const method: PaymentMethod | null = isOtaSource(b.source)
      ? "ota"
      : b.paymentMethod && b.paymentMethod !== "online"
        ? b.paymentMethod
        : null;

    rows.push({
      txn: {
        id: `${b.id}-${status}`,
        bookingId: b.id,
        guestName: guestName.get(b.guestId) ?? "—",
        method,
        at: b.paidAt ?? null,
        amount,
        status,
      },
      // Sort key only — never shown. Falls back to `createdAt` so undated rows
      // still land in a stable, sensible order instead of clumping arbitrarily.
      sortAt: b.paidAt ?? b.createdAt,
    });
  }

  // Newest first, and `id` breaks the tie: two payments can share a timestamp,
  // and `sort` is stable, so without this the list would fall back on the order
  // the rows happened to arrive in — which, from Postgres, is no order at all.
  return rows
    .sort((a, b) => Date.parse(b.sortAt) - Date.parse(a.sortAt) || a.txn.id.localeCompare(b.txn.id))
    .map((r) => r.txn);
}

/** "9:42 am" for a movement today, "Yesterday", "20 Jul", or "—" when unrecorded. */
function transactionTime(at: string | null, today: string): string {
  if (at === null) return "—";
  const when = new Date(at);
  const day = at.slice(0, 10);

  if (day === today) {
    return when
      .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
      .toLowerCase();
  }
  const dayBefore = new Date(`${today}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  if (day === dayBefore.toISOString().slice(0, 10)) return "Yesterday";

  return when.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** Signed for display: money out reads "−₹3,000", money in "+₹5,040". */
function signedAmount(amount: number): string {
  return `${amount < 0 ? "−" : "+"}${formatINR(Math.abs(amount))}`;
}

/**
 * What each OTA channel is holding, derived from the bookings it sold. The
 * commission *rate* falls out of the money (`otaCommission / otaCollection`)
 * rather than being seeded beside it, so a channel's percentage can never
 * contradict the rupees it sits next to.
 *
 * `amount` is gross — what the channel took from the guest, before it keeps its
 * cut — which is the same figure the Bookings screen calls OTA receivables, and
 * what the monthly rollup then nets the commission out of.
 */
function otaSettlements(bookings: Booking[]): OtaSettlement[] {
  const byChannel = new Map<BookingSource, { count: number; amount: number; commission: number }>();

  for (const b of bookings) {
    if (!isOtaSource(b.source) || VOID_STAY_STATUSES.has(b.status)) continue;
    if (b.collection.otaCollection === 0) continue;

    const acc = byChannel.get(b.source) ?? { count: 0, amount: 0, commission: 0 };
    acc.count += 1;
    acc.amount += b.collection.otaCollection;
    acc.commission += b.collection.otaCommission;
    byChannel.set(b.source, acc);
  }

  return (
    [...byChannel.entries()]
      .map(([source, acc]) => ({
        source,
        name: OTA_CHANNELS[source].name,
        abbr: OTA_CHANNELS[source].abbr,
        count: acc.count,
        commissionPct: Math.round((acc.commission / acc.amount) * 100),
        amount: acc.amount,
      }))
      // Biggest first; the channel name breaks the tie, since two OTAs owing the
      // same amount must not be ordered by whatever the query returned.
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  );
}

/**
 * The month's takings, netted. Gross counts what stays actually billed — a
 * cancelled booking and a no-show earned nothing, so neither belongs in it —
 * and the OTAs' commission and any refunds come back off.
 */
function monthlyRollup(bookings: Booking[], today: string): PaymentsMonthlyRollup {
  const month = today.slice(0, 7);
  const inMonth = bookings.filter((b) => b.checkIn.startsWith(month));

  const gross = inMonth
    .filter((b) => !VOID_STAY_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.totalBill, 0);
  const commission = inMonth.reduce((sum, b) => sum + b.collection.otaCommission, 0);
  const refunds = inMonth
    .filter((b) => VOID_STAY_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.collection.paidToHotel + b.collection.otaCollection, 0);

  return {
    label: new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    gross,
    commission,
    refunds,
    net: gross - commission - refunds,
  };
}

/**
 * Everything the admin Payments screen renders. The screen is a view over the
 * booking set: every rupee on it is derived from `Booking.collection`, so it
 * cannot disagree with the Bookings screen about what was collected, what an
 * OTA owes, or what a guest still has to pay.
 *
 * `today` anchors the "collected today" KPI and the rollup's month; it defaults
 * to the live clock (spec 19 — the seed's one dead week is no longer the only
 * data that can exist once manual entry can add a booking on any date).
 */
export async function getPaymentsPageData(
  data: BookingData,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<PaymentsPageData> {
  const guestName = new Map(data.guests.map((g) => [g.id, g.name]));
  const txns = transactionsFrom(data.bookings, guestName);
  const live = data.bookings.filter((b) => !VOID_STAY_STATUSES.has(b.status));

  const collectedToday = txns.filter(
    (t) => t.status === "success" && t.at !== null && t.at.startsWith(today),
  );
  // Razorpay's involvement is a fact of the booking (`razorpayPaymentId`), not
  // the transaction's `method` — that stays "—" until b-ii/b-iii records it,
  // and a razorpayPaymentId is the one signal that's already real.
  const razorpaySettledBookings = live.filter(
    (b) => b.razorpayPaymentId != null && b.collection.paidToHotel > 0,
  );
  const ota = otaSettlements(data.bookings);
  // Keyed off the booking's *source* — the branch that built the row — not
  // `t.method`, which is "—" for every non-OTA row right now and would
  // otherwise wrongly exclude every guest-owed booking from this KPI.
  const otaBookingIds = new Set(live.filter((b) => isOtaSource(b.source)).map((b) => b.id));
  const pendingFromGuests = txns.filter(
    (t) => t.status === "pending" && !otaBookingIds.has(t.bookingId),
  );

  const sum = (list: PaymentTransaction[]) => list.reduce((total, t) => total + t.amount, 0);
  const totalCollected = live.reduce((total, b) => total + b.collection.paidToHotel, 0);
  const otaTotal = ota.reduce((total, o) => total + o.amount, 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const kpis: PaymentsKpi[] = [
    {
      key: "totalCollected",
      label: "Total collected",
      value: formatINR(totalCollected),
      note: "all-time, in hand",
    },
    {
      key: "razorpaySettled",
      label: "Razorpay · settled",
      value: formatINR(razorpaySettledBookings.reduce((s, b) => s + b.collection.paidToHotel, 0)),
      note: "to bank T+2",
    },
    {
      key: "otaReceivables",
      label: "OTA receivables",
      value: formatINR(otaTotal),
      note: `${plural(ota.length, "channel")} pending`,
    },
    {
      key: "pendingFromGuests",
      label: "Pending from guests",
      value: formatINR(sum(pendingFromGuests)),
      note: plural(pendingFromGuests.length, "booking"),
    },
    {
      key: "collectedToday",
      label: "Collected · today",
      value: formatINR(sum(collectedToday)),
      note: `${plural(collectedToday.length, "transaction")} · by recorded payment time`,
    },
  ];

  const transactions: PaymentsTxnItem[] = txns.map((txn) => ({
    txn,
    methodLabel: txn.method ? METHOD_LABEL[txn.method] : "N/A",
    amount: signedAmount(txn.amount),
    time: transactionTime(txn.at, today),
    statusLabel: TRANSACTION_STATUS_LABEL[txn.status],
  }));

  return {
    today,
    subtitle: `${longDate(today)} · Razorpay + OTA settlements`,
    kpis,
    transactions,
    ota,
    rollup: monthlyRollup(data.bookings, today),
  };
}

// ── Reports ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ISO date `n` days before/after `date`, without tripping over local timezones. */
function shiftDate(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * One night of one stay — the atom every report figure is counted from.
 *
 * A booking's bill covers its whole stay, so charging all of it to the check-in
 * date would credit a three-night stay's revenue to a single day and leave the
 * other two looking empty. Spreading it per night is both truer to how the room
 * earned the money and the only basis on which occupancy, ADR and RevPAR agree:
 * all three then divide the same nights by the same days.
 */
interface NightFact {
  /** The night itself, as an ISO date. */
  date: string;
  bookingId: string;
  source: BookingSource;
  roomType: RoomType;
  mealPlan: MealPlan;
  /** This night's share of the total bill, tax and extras included. */
  bill: number;
  /** This night's share of the room charge alone — what ADR is measured on. */
  roomRev: number;
}

/**
 * Every night the hotel actually sold, exploded out of the booking set. A
 * cancelled booking and a no-show sold nothing, so neither contributes nights:
 * the same rule the payments rollup applies to gross.
 */
function nightsFrom(bookings: Booking[]): NightFact[] {
  const nights: NightFact[] = [];

  for (const b of bookings) {
    if (VOID_STAY_STATUSES.has(b.status) || b.urn <= 0) continue;

    for (let i = 0; i < b.urn; i++) {
      nights.push({
        date: shiftDate(b.checkIn, i),
        bookingId: b.id,
        source: b.source,
        roomType: b.roomType,
        mealPlan: b.mealPlan,
        bill: b.totalBill / b.urn,
        roomRev: b.revenue.room / b.urn,
      });
    }
  }

  return nights;
}

/**
 * What the party hall earned, by the date it was held. Only a *completed* event
 * has earned anything — a confirmed booking is a promise, and the money against
 * it is an advance, which the party-hall screen already reports separately.
 */
function partyHallRevenueIn(partyHall: PartyHallEnquiry[], start: string, end: string): number {
  return partyHall
    .filter((e) => e.status === "completed" && e.date >= start && e.date <= end)
    .reduce((sum, e) => sum + e.amount, 0);
}

/** A trailing window: `days` long, ending on (and including) `end`. */
interface Window {
  start: string;
  end: string;
  days: number;
}

function daysBetween(start: string, end: string): number {
  return (
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY) + 1
  );
}

/**
 * The window a range covers, ending today.
 *
 * The year is aligned to calendar months rather than counted back 365 days, so
 * that its twelve monthly bars tile it exactly. A 365-day window would start
 * mid-month and leave that month's first half inside the total but outside
 * every bar — the total and the chart beneath it would quietly disagree.
 */
function windowFor(key: RevenuePeriodKey, today: string): Window {
  if (key === "12m") {
    const anchor = new Date(`${today}T00:00:00Z`);
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 11, 1))
      .toISOString()
      .slice(0, 10);
    return { start, end: today, days: daysBetween(start, today) };
  }

  const days = key === "7d" ? 7 : 30;
  return { start: shiftDate(today, -(days - 1)), end: today, days };
}

/** The window of equal length sitting immediately before `w`. */
function previousWindow(w: Window): Window {
  return { start: shiftDate(w.start, -w.days), end: shiftDate(w.start, -1), days: w.days };
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function inWindow(date: string, w: Window): boolean {
  return inRange(date, w.start, w.end);
}

/** Total earned in a window: what the rooms billed, plus what the hall billed. */
function revenueIn(nights: NightFact[], partyHall: PartyHallEnquiry[], w: Window): number {
  const rooms = nights.filter((n) => inWindow(n.date, w)).reduce((sum, n) => sum + n.bill, 0);
  return rooms + partyHallRevenueIn(partyHall, w.start, w.end);
}

/**
 * Percentage change against the preceding window, e.g. "▲ 12.4%".
 *
 * Returns null when the previous window was empty. Growth from zero has no
 * percentage — it is division by zero — and stating one anyway would be
 * inventing a trend the data cannot support.
 */
function deltaAgainst(current: number, previous: number): { text: string; up: boolean } | null {
  if (previous === 0) return null;

  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return { text: `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`, up };
}

/**
 * The window's bars, split direct vs OTA.
 *
 * Each range buckets at the grain it can actually show: 7 daily bars for a
 * week, five 6-day bars for a month (30 divides evenly, so no bar covers a
 * short period and reads artificially low), and 12 monthly bars for a year.
 */
function barsFor(
  nights: NightFact[],
  partyHall: PartyHallEnquiry[],
  key: RevenuePeriodKey,
  today: string,
): RevenueBar[] {
  const w = windowFor(key, today);
  const buckets: { label: string; start: string; end: string }[] = [];

  if (key === "12m") {
    const anchor = new Date(`${today}T00:00:00Z`);
    for (let i = 11; i >= 0; i--) {
      const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
      buckets.push({
        label: first.toLocaleDateString("en-IN", { month: "narrow", timeZone: "UTC" }),
        start: first.toISOString().slice(0, 10),
        end: last.toISOString().slice(0, 10),
      });
    }
  } else {
    const span = key === "7d" ? 1 : 6;
    const count = key === "7d" ? 7 : 5;
    for (let i = count - 1; i >= 0; i--) {
      const end = shiftDate(today, -i * span);
      const start = shiftDate(end, -(span - 1));
      buckets.push({
        label:
          key === "7d"
            ? new Date(`${start}T00:00:00Z`).toLocaleDateString("en-IN", {
                weekday: "short",
                timeZone: "UTC",
              })
            : `W${count - i}`,
        start,
        end,
      });
    }
  }

  // The current month runs past today, and the year's first month may start
  // before the window opens. Either would let a bar count nights the headline
  // above it doesn't, so every bucket is clipped back to the window itself.
  return buckets.map(({ label, start: bucketStart, end: bucketEnd }) => {
    const start = bucketStart < w.start ? w.start : bucketStart;
    const end = bucketEnd > w.end ? w.end : bucketEnd;
    const rooms = nights.filter((n) => inRange(n.date, start, end));
    const sum = (list: NightFact[]) => list.reduce((total, n) => total + n.bill, 0);

    // The hall is sold by us, never by a channel, so it lands on the direct side.
    const direct =
      sum(rooms.filter((n) => !isOtaSource(n.source))) + partyHallRevenueIn(partyHall, start, end);
    const ota = sum(rooms.filter((n) => isOtaSource(n.source)));
    return {
      label,
      direct: Math.round(direct),
      ota: Math.round(ota),
      total: Math.round(direct + ota),
    };
  });
}

/** How the design groups channels: the three it names, and everything else. */
const SOURCE_GROUPS: { key: string; label: string; match: (s: BookingSource) => boolean }[] = [
  { key: "direct", label: "Direct (site/phone)", match: (s) => !isOtaSource(s) },
  { key: "booking_com", label: "Booking.com", match: (s) => s === "booking_com" },
  { key: "makemytrip", label: "MakeMyTrip", match: (s) => s === "makemytrip" },
  {
    key: "others",
    label: "Others",
    match: (s) => isOtaSource(s) && s !== "booking_com" && s !== "makemytrip",
  },
];

/**
 * Share of the window's bookings by how they were sold.
 *
 * Percentages are apportioned by largest remainder so they total exactly 100 —
 * rounding each share independently would let a donut add up to 99% or 101%.
 */
function sourcesFor(nights: NightFact[], w: Window): SourceSlice[] {
  const sold = new Map<string, BookingSource>();
  for (const n of nights) {
    if (inWindow(n.date, w)) sold.set(n.bookingId, n.source);
  }
  const total = sold.size;
  if (total === 0) return [];

  const counted = SOURCE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    count: [...sold.values()].filter(g.match).length,
  })).filter((g) => g.count > 0);

  const exact = counted.map((g) => (g.count / total) * 100);
  const pcts = exact.map(Math.floor);
  let short = 100 - pcts.reduce((sum, p) => sum + p, 0);
  const byRemainder = exact
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem);
  for (let i = 0; short > 0; i++, short--) pcts[byRemainder[i % byRemainder.length].i] += 1;

  return counted.map((g, i) => ({ ...g, pct: pcts[i] })).sort((a, b) => b.count - a.count);
}

const MEAL_PLAN_NOTE: Record<MealPlan, string> = {
  EP: "room only",
  CP: "breakfast",
  MAP: "half board",
  AP: "full board",
};

/**
 * Share of room-nights sold on each plan. All four always show: a plan nobody
 * took is a fact about the mix, not a row to hide.
 */
function mealPlansFor(nights: NightFact[], w: Window): MealPlanShare[] {
  const inWin = nights.filter((n) => inWindow(n.date, w));
  const plans: MealPlan[] = ["EP", "CP", "MAP", "AP"];

  return plans.map((plan) => ({
    plan,
    note: MEAL_PLAN_NOTE[plan],
    pct:
      inWin.length === 0
        ? 0
        : Math.round((inWin.filter((n) => n.mealPlan === plan).length / inWin.length) * 100),
  }));
}

/** Each room type's takings and occupancy, with the party hall alongside. */
function roomTypesFor(
  nights: NightFact[],
  partyHall: PartyHallEnquiry[],
  w: Window,
  roomTypes: RoomTypeInfo[],
): RoomTypePerf[] {
  const inWin = nights.filter((n) => inWindow(n.date, w));

  const rows: RoomTypePerf[] = roomTypes.map((rt) => {
    const mine = inWin.filter((n) => n.roomType === rt.type);
    return {
      key: rt.type,
      name: rt.name,
      revenue: Math.round(mine.reduce((sum, n) => sum + n.bill, 0)),
      revenueLabel: "",
      occPct: Math.round((mine.length / (rt.count * w.days)) * 100),
      barPct: 0,
    };
  });

  const hall = partyHallRevenueIn(partyHall, w.start, w.end);
  rows.push({
    key: "party_hall",
    name: "Party Hall",
    revenue: hall,
    revenueLabel: "",
    // The hall is sold by the slot, not by the night, so a nightly occupancy
    // rate would be measuring it against a denominator it doesn't have.
    occPct: null,
    barPct: 0,
  });

  const best = Math.max(...rows.map((r) => r.revenue), 0);
  return rows
    .map((r) => ({
      ...r,
      revenueLabel: formatINRCompact(r.revenue),
      barPct: best === 0 ? 0 : Math.round((r.revenue / best) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

const RANGE_LABEL: Record<RevenuePeriodKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "12m": "last 12 months",
};

const RANGE_SWITCH: Record<RevenuePeriodKey, string> = {
  "7d": "7D",
  "30d": "30D",
  "12m": "12M",
};

const RANGE_KEYS: RevenuePeriodKey[] = ["7d", "30d", "12m"];

/**
 * The four headline measures for one window, each derived from the same nights.
 *
 * ADR is the room charge per night *sold*; RevPAR the room charge per night
 * *available*. Because both read the same numerator and occupancy divides the
 * same two denominators, RevPAR = ADR × occupancy holds by construction rather
 * than by three figures happening to agree.
 */
function kpisFor(
  nights: NightFact[],
  partyHall: PartyHallEnquiry[],
  w: Window,
  key: RevenuePeriodKey,
  sellableRooms: number,
): ReportsKpi[] {
  const inWin = nights.filter((n) => inWindow(n.date, w));
  const roomRev = inWin.reduce((sum, n) => sum + n.roomRev, 0);
  const sold = inWin.length;
  const available = sellableRooms * w.days;

  const revenue = revenueIn(nights, partyHall, w);
  const prev = previousWindow(w);
  const occPct = (sold / available) * 100;
  const prevIn = nights.filter((n) => inWindow(n.date, prev));

  const build = (
    k: ReportsKpi["key"],
    label: string,
    value: string,
    d: { text: string; up: boolean } | null,
  ): ReportsKpi => ({ key: k, label, value, delta: d?.text ?? null, deltaUp: d?.up ?? null });

  return [
    build(
      "revenue",
      `Revenue · ${RANGE_LABEL[key]}`,
      formatINRCompact(revenue),
      deltaAgainst(revenue, revenueIn(nights, partyHall, prev)),
    ),
    build(
      "occupancy",
      "Occupancy rate",
      `${Math.round(occPct)}%`,
      deltaAgainst(sold, prevIn.length),
    ),
    build(
      "adr",
      "ADR (avg daily rate)",
      formatINR(sold === 0 ? 0 : roomRev / sold),
      deltaAgainst(
        sold === 0 ? 0 : roomRev / sold,
        prevIn.length === 0 ? 0 : prevIn.reduce((sum, n) => sum + n.roomRev, 0) / prevIn.length,
      ),
    ),
    build(
      "revpar",
      "RevPAR",
      formatINR(roomRev / available),
      deltaAgainst(
        roomRev / available,
        prevIn.reduce((sum, n) => sum + n.roomRev, 0) / (sellableRooms * prev.days),
      ),
    ),
  ];
}

/**
 * Everything the admin Reports screen renders, for all three ranges at once so
 * the toggle switches without a round-trip — the same shape the dashboard's
 * revenue card uses.
 *
 * Nothing here is seeded. Every figure is counted off the nights the booking
 * set actually sold and the party-hall events it actually held, which is why
 * these numbers are smaller than the design's: the mock draws a full hotel, and
 * our seed holds ten bookings in one week of July.
 */
export async function getReportsPageData(
  data: BookingData,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<ReportsPageData> {
  const nights = nightsFrom(data.bookings);
  const tiles = data.rooms ?? defaultRoomTiles();
  const roomTypes = resolveRoomTypes(tiles, data.roomTypeOverrides);
  const sellableRooms = tiles.length;

  const ranges: ReportsRange[] = RANGE_KEYS.map((key) => {
    const w = windowFor(key, today);
    return {
      key,
      switchLabel: RANGE_SWITCH[key],
      rangeLabel: RANGE_LABEL[key],
      kpis: kpisFor(nights, data.partyHall, w, key, sellableRooms),
      bars: barsFor(nights, data.partyHall, key, today),
      sources: sourcesFor(nights, w),
      roomTypes: roomTypesFor(nights, data.partyHall, w, roomTypes),
      mealPlans: mealPlansFor(nights, w),
    };
  });

  return {
    today,
    subtitle: "Performance & revenue analytics",
    ranges,
  };
}

/**
 * The dashboard's revenue card, over the same windows and the same engine the
 * Reports screen reads. These figures used to be seeded strings beside seeded
 * bar heights, which meant the dashboard and Reports could answer "revenue,
 * last 30 days" differently — and did. Deriving both from one place is what
 * stops that.
 */
function revenuePeriods(data: BookingData, today: string): RevenuePeriod[] {
  const nights = nightsFrom(data.bookings);
  const switchLabel: Record<RevenuePeriodKey, string> = {
    "7d": "7 days",
    "30d": "30 days",
    "12m": "12 months",
  };

  return RANGE_KEYS.map((key) => {
    const w = windowFor(key, today);
    const total = revenueIn(nights, data.partyHall, w);
    const delta = deltaAgainst(total, revenueIn(nights, data.partyHall, previousWindow(w)));

    return {
      key,
      switchLabel: switchLabel[key],
      rangeLabel: rangeLabelFor(key, w),
      total: formatINRCompact(total),
      delta: delta && `${delta.text} vs prev`,
      bars: barsFor(nights, data.partyHall, key, today).map((b) => ({
        label: b.label,
        value: b.total,
      })),
    };
  });
}

/** "Wed 8 Jul – Tue 14 Jul" for a week; a plainer line for the longer windows. */
function rangeLabelFor(key: RevenuePeriodKey, w: Window): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

  if (key === "7d") {
    const short: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
    return `${fmt(w.start, short)} – ${fmt(w.end, short)}`;
  }
  if (key === "12m") {
    const my: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
    return `${fmt(w.start, my)} – ${fmt(w.end, my)}`;
  }
  return "Last 30 days";
}

// ── Settings ────────────────────────────────────────────────────────────────

/** The property itself. Nothing derives from this; it is the profile guests see. */
const PROPERTY: PropertyProfile = {
  name: "The Divine KRC",
  phone: "+91 87073 68307",
  whatsapp: "+91 87073 68307",
  checkInTime: "2:00 PM",
  checkOutTime: "11:00 AM",
};

/**
 * Who can log in. The Owner row is the account in `lib/auth.ts` — the console's
 * real (mock) login — so the list cannot show a team that excludes the person
 * using it. The rest are staff. Kept here rather than imported from `auth.ts`,
 * which pulls in server-only session code; the DB swap unifies the two.
 */
/**
 * Who can log in, read off the one roster. PR #11 seeded this list here and
 * noted the duplication with `auth.ts`; PR #12 removed it, because once an
 * invite can add someone, a roster that Settings keeps privately would be a
 * roster that goes stale the first time anyone joins. #12b moved that roster
 * into Postgres, so it now arrives as an argument for the same reason the
 * booking rows do — this file cannot reach the database and must not.
 *
 * Only accepted members appear. Someone invited and still deciding is on the
 * Team & access screen under their invite, not on the list of people with keys.
 */
function activeTeam(roster: TeamAccount[]): TeamMember[] {
  return roster
    .filter(isActive)
    .map((m) => ({ name: m.name, email: m.email, role: m.role, initials: initialsOf(m.name) }));
}

const PAYMENT_TOGGLES: ToggleSetting[] = [
  {
    key: "payAtHotel",
    label: "Pay at hotel",
    desc: "Reserve now, settle at front desk on arrival",
    on: true,
  },
  {
    key: "prepayOtaBlocked",
    label: "Require full prepayment for OTA-blocked dates",
    desc: "Force online payment on peak dates",
    on: false,
  },
];

const NOTIFICATION_TOGGLES: ToggleSetting[] = [
  {
    key: "newBooking",
    label: "New booking alerts",
    desc: "Email + WhatsApp on every new reservation",
    on: true,
  },
  {
    key: "paymentReceived",
    label: "Payment received",
    desc: "Notify when Razorpay confirms a payment",
    on: true,
  },
  {
    key: "partyHallEnquiry",
    label: "Party hall enquiries",
    desc: "Alert for new event enquiries",
    on: true,
  },
];

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "property", label: "Property profile" },
  { id: "pricing", label: "Rooms & pricing" },
  { id: "party-hall", label: "Party hall rates" },
  { id: "payments", label: "Payment integrations" },
  { id: "channels", label: "OTA channels" },
  { id: "team", label: "Team & access" },
  { id: "notifications", label: "Notifications" },
];

/** Tariffs read straight off the inventory, so a rate shown here is the rate charged. */
function tariffSettings(roomTypes: RoomTypeInfo[]): RoomTariff[] {
  return roomTypes.map((rt) => ({
    type: rt.type,
    name: rt.name,
    inventoryLabel: `${rt.count} rooms · ${rt.areaSqm} m²`,
    rate: rt.pricePerNight.toLocaleString("en-IN"),
    count: rt.count,
    areaSqm: rt.areaSqm,
    pricePerNight: rt.pricePerNight,
  }));
}

/** GST as its own editable setting (Room Settings redesign, slice C) — was
 *  read-only display over the `GST_PCT` constant; now backed by the
 *  `gstPct` `addon_settings` row like every other rate on this panel. */
function gstSetting(pct: number): GstSetting {
  return { pct };
}

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

/** Slice 2a's ten editable Party Hall rates, same blur-to-save shape as
 *  `addOnRateSettings`. `phAdvancePct` is the one percentage row — its `unit`
 *  tells `PartyHallRateRow` which suffix to show. */
function partyHallRateSettings(rates: PartyHallRates): PartyHallRateSetting[] {
  return (Object.keys(PARTY_HALL_RATE_LABEL) as PartyHallRateKey[]).map((key) => ({
    key,
    label: PARTY_HALL_RATE_LABEL[key],
    price: rates[key],
    unit: key === "phAdvancePct" ? "%" : "₹",
  }));
}

const ADD_ON_LABEL: Record<AddOnServiceKey, string> = {
  earlyCheckIn: "Early check-in fee",
  lateCheckOut: "Late check-out fee",
  extraMattress: "Extra mattress fee",
};

/** Slice B's three editable add-on rates, in the same blur-to-save shape a tariff uses. */
function addOnRateSettings(rates: AddOnRates): AddOnRateSetting[] {
  return (Object.keys(ADD_ON_LABEL) as AddOnServiceKey[]).map((key) => ({
    key,
    label: ADD_ON_LABEL[key],
    price: rates[key],
  }));
}

function paymentSettings(): PaymentSettings {
  return {
    gateway: {
      name: "Razorpay",
      connected: true,
      methodsLine: "UPI · Cards · Net Banking · Wallets · key ...a4F9",
    },
    toggles: PAYMENT_TOGGLES,
  };
}

/**
 * The channel list, in the order the money ranks them: the OTAs that have sold
 * the most stays first, then the ones yet to earn. A channel's booking count is
 * counted off the live set, so "not connected" beside a channel that has been
 * selling would be visible rather than plausible.
 */
function channelSettings(bookings: Booking[]): ChannelSetting[] {
  const sold = new Map<BookingSource, number>();
  for (const b of bookings) {
    if (!isOtaSource(b.source) || VOID_STAY_STATUSES.has(b.status)) continue;
    sold.set(b.source, (sold.get(b.source) ?? 0) + 1);
  }

  return Object.entries(OTA_CHANNELS)
    .map(([key, ch]) => ({
      key: key as BookingSource,
      name: ch.name,
      abbr: ch.abbr,
      commissionPct: ch.commissionPct,
      connected: ch.connected,
      bookings: sold.get(key as BookingSource) ?? 0,
    }))
    .sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name));
}

/** The Settings panel's per-room rows — status live-overlaid the same way
 *  the Rooms screen does (`liveRoomTiles`), plus the occupant name
 *  (`currentOccupant`) for the Guest column. Never trust the stored
 *  `occupied` opinion here either, so Status and Guest can't disagree. */
function roomSettingsRows(
  tiles: RoomTile[],
  bookings: Booking[],
  guests: Guest[],
  today: string,
): RoomSettingsRow[] {
  const live = liveRoomTiles(tiles, bookings, guests, today);
  return live.map((t) => ({ ...t, occupantName: currentOccupant(t.no, bookings, guests, today) }));
}

export async function getSettingsPageData(
  data: BookingData,
  roster: TeamAccount[],
  today: string = new Date().toISOString().slice(0, 10),
): Promise<SettingsPageData> {
  const bookings = data.bookings;
  const tiles = data.rooms ?? defaultRoomTiles();
  const roomTypes = resolveRoomTypes(tiles, data.roomTypeOverrides);
  const partyHallRates = resolvePartyHallRates(data.partyHallRateOverrides);

  return {
    sections: SETTINGS_SECTIONS,
    property: PROPERTY,
    pricing: {
      tariffs: tariffSettings(roomTypes),
      gst: gstSetting(resolveRoomGstPct(data.gstRateOverride)),
      partyHallGst: gstSetting(resolvePartyHallGstPct(data.partyHallGstRateOverride)),
      addOnRates: addOnRateSettings(resolveAddOnRates(data.addOnRateOverrides)),
      partyHallRates: partyHallRateSettings(partyHallRates),
      partyHallRatesArePlaceholder: PARTY_HALL_PLACEHOLDER_KEYS.some(
        (key) => partyHallRates[key] === PARTY_HALL_RATE_DEFAULTS[key],
      ),
      rooms: roomSettingsRows(tiles, bookings, data.guests, today),
    },
    payments: paymentSettings(),
    channels: channelSettings(bookings),
    team: activeTeam(roster),
    notifications: NOTIFICATION_TOGGLES,
  };
}
