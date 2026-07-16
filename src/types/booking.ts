// Booking system domain types.
// Source of truth: design_handoff_krc_booking/README.md "Data model".

export type RoomType = "deluxe" | "deluxe_balcony";

export type BookingSource =
  "direct" | "walk_in" | "phone" | "booking_com" | "makemytrip" | "goibibo" | "agoda" | "oyo";

export type MealPlan = "EP" | "CP" | "MAP" | "AP";

export type BookingStatus =
  "confirmed" | "checked_in" | "checked_out" | "pending_payment" | "cancelled" | "no_show";

export type PayMethod = "razorpay" | "pay_at_hotel";

export interface BookingRevenue {
  room: number;
  earlyCheckIn: number;
  lateCheckOut: number;
  other: number;
  discount: number;
  /** GST percentage applied to the taxable subtotal, e.g. 12 for 12%. */
  taxPct: number;
}

export interface BookingCollection {
  paidToHotel: number;
  otaCollection: number;
  otaCommission: number;
  complimentary: number;
  pending: number;
}

export interface Booking {
  /** KRC-YYYYMMDD-nnn */
  id: string;
  guestId: string;
  /** null until a physical room is assigned */
  roomNo: string | null;
  roomType: RoomType;
  /** ISO date (check-in) */
  checkIn: string;
  /** ISO date (check-out) */
  checkOut: string;
  /** nights = checkOut - checkIn */
  urn: number;
  source: BookingSource;
  mealPlan: MealPlan;
  revenue: BookingRevenue;
  /** auto = sum(revenue non-discount) - discount + GST */
  totalBill: number;
  collection: BookingCollection;
  status: BookingStatus;
  /** ISO timestamp */
  createdAt: string;
}

export type GuestTier = "gold" | "silver" | "new";

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  stays: number;
  lifetimeValue: number;
  tier: GuestTier;
}

export type PartyHallSlot = "morning" | "afternoon" | "evening" | "full_day";

/** Pipeline an event moves through, in order; `cancelled` leaves it. */
export type PartyHallStatus =
  "enquiry" | "quote_sent" | "advance_paid" | "confirmed" | "completed" | "cancelled";

export interface PartyHallEnquiry {
  id: string;
  title: string;
  /** ISO date */
  date: string;
  slot: PartyHallSlot;
  guests: number;
  /** Package tier name, matching a `PartyHallPackage` — e.g. "Platinum". */
  package: string;
  addOns: string[];
  status: PartyHallStatus;
  /** Quoted/agreed total in rupees; 0 until the enquiry has been quoted. */
  amount: number;
  /** Money in hand — derived from `amount` and `status`, never seeded. */
  advancePaid: number;
}

// ── Admin dashboard (PR #3) ──────────────────────────────────────────────
// Shapes for the dashboard screen. The mock data layer seeds figures that
// mirror `Admin Dashboard.dc.html`; a real DB swap keeps these signatures.

export interface CheckInStat {
  total: number;
  arrived: number;
  pending: number;
}

export interface CheckOutStat {
  total: number;
  settled: number;
  late: number;
}

export interface ArrivalsStat {
  total: number;
  /** Next arrival time + label, e.g. "2:30 PM" · "Sharma +2". */
  nextTime: string;
  nextLabel: string;
}

export interface RoomTypeOccupancy {
  occupied: number;
  total: number;
}

export interface Occupancy {
  occupied: number;
  total: number;
  /** Whole-percent occupancy for tonight. */
  pct: number;
  deluxe: RoomTypeOccupancy;
  deluxeBalcony: RoomTypeOccupancy;
  vacant: number;
  /** Free-text party-hall status line, e.g. "Booked 22 Aug". */
  partyHall: string;
}

export type RevenuePeriodKey = "7d" | "30d" | "12m";

export interface RevenuePeriod {
  key: RevenuePeriodKey;
  /** Toggle button text, e.g. "7 days". */
  switchLabel: string;
  /** Sub-title under "Revenue", e.g. "Mon 7 Jul – Sun 13 Jul". */
  rangeLabel: string;
  /** Pre-formatted total, e.g. "₹2.14L". */
  total: string;
  /** Trend line, e.g. "▲ 12.4% vs prev". */
  delta: string;
  /** One entry per bar; heights are derived client-side from `value`. */
  bars: { label: string; value: number }[];
}

export type ActivityKind = "check_in" | "enquiry" | "payment" | "cancellation";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** May contain **bold** segments delimited by `*`. */
  title: string;
  meta: string;
}

export interface ArrivalItem {
  id: string;
  initials: string;
  name: string;
  /** Extra party size, e.g. "+2"; omitted for solo arrivals. */
  extra?: string;
  roomType: string;
  nights: number;
  time: string;
  /** Assigned room number, or "unassigned". */
  assignment: string;
  assigned: boolean;
}

export interface DashboardData {
  checkInsToday: CheckInStat;
  checkOutsToday: CheckOutStat;
  expectedArrivals: ArrivalsStat;
  unassignedRooms: number;
  occupancy: Occupancy;
  revenue: RevenuePeriod[];
  activity: ActivityItem[];
  arrivals: ArrivalItem[];
}

// ── Admin bookings (PR #4) ───────────────────────────────────────────────
// The bookings screen renders a wide reservations table plus summary cards,
// status tabs and a period-totals footer — all derived from the live booking
// set so the figures stay truthful when the mock swaps to a real DB.

/** Keys that let the component attach the right accent to each summary card. */
export type BookingsSummaryKey =
  | "checkInsToday"
  | "checkOutsToday"
  | "occupied"
  | "available"
  | "totalUrn"
  | "roomRevenue"
  | "totalCollected"
  | "pendingCollection"
  | "otaReceivables"
  | "cancellations";

export interface BookingsSummaryCard {
  key: BookingsSummaryKey;
  label: string;
  /** Pre-formatted display value, e.g. "9 / 14" or "₹2,14,000". */
  value: string;
}

/** A booking joined with its guest's display name for the table row. */
export interface BookingListItem {
  booking: Booking;
  guestName: string;
}

/** Column sums for the period-totals footer row. */
export interface BookingsTotals {
  roomRev: number;
  earlyCheckIn: number;
  lateCheckOut: number;
  other: number;
  totalBill: number;
  paidToHotel: number;
  otaCollection: number;
  pending: number;
}

export interface BookingsPageData {
  /** ISO date the page is anchored to (drives today-relative counts). */
  today: string;
  /** Reservation count for this period (all rows). */
  total: number;
  summary: BookingsSummaryCard[];
  /** Row count per status, for the filter-tab badges. */
  countsByStatus: Record<BookingStatus, number>;
  rows: BookingListItem[];
  totals: BookingsTotals;
}

// ── Admin rooms (PR #5) ──────────────────────────────────────────────────
// The room-management screen renders two type cards, a status legend and
// floor boards of tiles, plus the ground-floor party-hall card. Legend and
// type-card availability are derived from the tile set so the counts stay
// internally consistent.

/** Operational state of a physical room; colored per the design tokens. */
export type RoomStatus = "occupied" | "available" | "cleaning" | "maintenance";

/** One physical room on a floor board. */
export interface RoomTile {
  no: string;
  type: RoomType;
  floor: 1 | 2;
  status: RoomStatus;
  /** Occupant + checkout for occupied rooms, else a short state note. */
  detail: string;
}

/** A room-type summary card (photo, count, availability, editable rate). */
export interface RoomTypeCard {
  type: RoomType;
  name: string;
  count: number;
  areaSqm: number;
  pricePerNight: number;
  /** Rooms of this type currently free — derived from the tiles. */
  available: number;
}

/** A colored legend entry with its live count. */
export interface RoomsLegendItem {
  status: RoomStatus;
  label: string;
  count: number;
}

/** One floor board: a heading and its tiles left-to-right. */
export interface RoomFloor {
  floor: 1 | 2;
  label: string;
  rooms: RoomTile[];
}

/** Ground-floor party-hall card summary. */
export interface RoomsPartyHall {
  /** Next event line, e.g. "30 Jul · Evening". */
  nextLabel: string;
  /** Free-text availability window, e.g. "Available 14–21 Jul". */
  availability: string;
}

export interface RoomsPageData {
  /** Sub-title under "Rooms", e.g. "14 rooms · 9 occupied · …". */
  summaryLine: string;
  typeCards: RoomTypeCard[];
  legend: RoomsLegendItem[];
  floors: RoomFloor[];
  partyHall: RoomsPartyHall;
}

// ── Admin calendar (PR #6) ───────────────────────────────────────────────
// The calendar renders a month grid whose day cells are shaded by room
// occupancy, with party-hall events flagged on their day. Percentages and
// the shading band are derived from the occupied-room count so the "% +
// n/14" pair can never disagree.

/** Occupancy shading band. Thresholds mirror the legend: <40 / 40–69 / 70–99 / 100. */
export type OccupancyBand = "low" | "medium" | "high" | "full";

/** A legend entry naming one band of the shading ramp. */
export interface CalendarLegendItem {
  band: OccupancyBand;
  label: string;
}

/** One dated day cell in the month grid. */
export interface CalendarDay {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Day of month, 1-31. */
  day: number;
  /** Rooms held on this date, of `total`. */
  occupied: number;
  total: number;
  /** `occupied / total` as a whole percent — derived, never seeded. */
  pct: number;
  band: OccupancyBand;
  /** Party-hall event headline, e.g. "Reception · 140 pax". */
  event: string | null;
}

/**
 * A grid slot: either a real day or a filler keeping the weekday offset (before
 * the 1st) and squaring off the final week (after the last).
 */
export type CalendarCell = { kind: "blank" } | ({ kind: "day" } & CalendarDay);

export interface CalendarPageData {
  year: number;
  /** 1-12. */
  month: number;
  /** e.g. "July 2026". */
  monthLabel: string;
  /** Column headers, Sunday-first. */
  weekdays: string[];
  /** Always a whole number of weeks — blanks pad both ends. */
  cells: CalendarCell[];
  legend: CalendarLegendItem[];
  /** Room inventory the occupancy is measured against (14). */
  totalRooms: number;
}

// ── Admin party hall (PR #7) ─────────────────────────────────────────────
// The party-hall screen renders a stat strip, the enquiry/event pipeline and
// a right rail (month availability + package reference). Every figure — stat
// values, pill counts, per-card copy, booked days — is derived from the live
// enquiry set, so the screen can never contradict the data behind it.

export type PartyHallStatKey = "newEnquiries" | "confirmed" | "advanceCollected" | "nextEvent";

export interface PartyHallStat {
  key: PartyHallStatKey;
  label: string;
  /** Pre-formatted display value, e.g. "3" or "₹1.4L". */
  value: string;
}

export type PartyHallPillKey = "all" | "new" | "confirmed";

/** A filter chip over the pipeline; counts derive from the event set. */
export interface PartyHallPill {
  key: PartyHallPillKey;
  label: string;
  count: number;
}

/** One enquiry/event card: the raw record plus its rendered copy. */
export interface PartyHallEventItem {
  enquiry: PartyHallEnquiry;
  /** Date chip, e.g. "22" / "Aug". */
  day: string;
  mon: string;
  /** Status pill text, e.g. "Quote sent". */
  statusLabel: string;
  /** Sub-line, e.g. "Evening slot · 140 guests · advance ₹22k paid". */
  meta: string;
  /** Package tier followed by each add-on. */
  tags: string[];
  /** What the amount means for this status, e.g. "Quoted" / "Collected". */
  amountLabel: string;
  /** Pre-formatted amount, or "₹—" before a quote exists. */
  amount: string;
  /** Context action, e.g. "Send quote" when new, else View/Invoice. */
  cta: string;
  /** Only the action that moves a *new* enquiry forward is emphasised. */
  ctaPrimary: boolean;
}

/** A day slot in the rail's availability mini-calendar. */
export type PartyHallCalendarCell =
  { kind: "blank" } | { kind: "day"; date: string; day: number; booked: boolean };

export interface PartyHallMiniCalendar {
  /** e.g. "August 2026". */
  monthLabel: string;
  /** Single-letter column headers, Sunday-first. */
  weekdays: string[];
  cells: PartyHallCalendarCell[];
}

/** A package tier in the rail's reference card. */
export interface PartyHallPackage {
  name: string;
  /** Guest ceiling, e.g. "up to 60". */
  capacity: string;
  /** Pre-formatted price, e.g. "from ₹35k" or "tailored". */
  price: string;
}

export interface PartyHallPageData {
  /** Sub-title under "Party Hall", e.g. "Up to 150 guests · …". */
  subtitle: string;
  stats: PartyHallStat[];
  pills: PartyHallPill[];
  /** Pipeline order: new first, completed last; then by date. */
  events: PartyHallEventItem[];
  calendar: PartyHallMiniCalendar;
  packages: PartyHallPackage[];
  /** Add-on pricing line under the package reference. */
  addOnsLine: string;
}
