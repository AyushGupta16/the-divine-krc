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
  /** Loyalty standing — derived from `stays`, never seeded. See `guestTier`. */
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

/** A trailing window ending today: the last 7 days, 30 days, or 12 months. */
export type RevenuePeriodKey = "7d" | "30d" | "12m";

export interface RevenuePeriod {
  key: RevenuePeriodKey;
  /** Toggle button text, e.g. "7 days". */
  switchLabel: string;
  /** Sub-title under "Revenue", e.g. "Mon 7 Jul – Sun 13 Jul". */
  rangeLabel: string;
  /** Pre-formatted total, e.g. "₹2.14L". */
  total: string;
  /**
   * Trend against the preceding window of equal length, e.g. "▲ 12.4% vs prev"
   * — or `null` when that window earned nothing, because a change from zero has
   * no percentage to state.
   */
  delta: string | null;
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

// ── Admin guests (PR #13) ────────────────────────────────────────────────
// Shapes for the guest directory, mirroring `Admin Guests.dc.html`. Every
// figure is derived from the guest set and the live booking set; nothing on
// this screen is seeded twice.

/** One tile in the guest stat strip. */
export interface GuestStat {
  key: "total" | "inHouse" | "repeat" | "topLtv";
  label: string;
  /** Pre-formatted for display — counts as-is, money in short scale. */
  value: string;
}

/** A directory row: the guest plus what the booking set says about them. */
export interface GuestListItem {
  guest: Guest;
  /** Up to two letters from the name, for the avatar disc. */
  initials: string;
  /** Avatar disc fill/ink, cycled by row position per the design. */
  avatarBg: string;
  avatarColor: string;
  /** Arrival date of their most recent begun stay, e.g. "14 Jul 2026"; "—" if none. */
  lastStay: string;
  /** True while a stay of theirs is checked in. */
  inHouse: boolean;
}

export interface GuestsPageData {
  /** Sub-title under "Guests", e.g. "10 profiles · 6 repeat guests". */
  subtitle: string;
  stats: GuestStat[];
  /** Highest lifetime value first — the directory leads with the best guests. */
  guests: GuestListItem[];
}

// ── Admin payments (PR #9) ───────────────────────────────────────────────
// The payments screen is a *view over the booking set*, not a second ledger.
// Every amount on it — the KPI row, each transaction, the OTA panel and the
// monthly rollup — is derived from `Booking.collection`, so the screen can
// never claim takings the bookings behind it don't show. Only how the money
// moved (`method`) and when (`at`) are seeded: a booking records how much was
// collected, but not by what instrument or at what time.

/** Instrument the money moved by. The first three are Razorpay-processed. */
export type PaymentMethod = "upi" | "card" | "net_banking" | "cash" | "ota";

/** Where a transaction stands: money in, money promised, money given back. */
export type TransactionStatus = "success" | "pending" | "refunded";

/** One movement of money against a booking. Derived — see `getPaymentsPageData`. */
export interface PaymentTransaction {
  /** `<bookingId>-<status>`, e.g. "KRC-20260714-001-success". */
  id: string;
  bookingId: string;
  guestName: string;
  method: PaymentMethod;
  /** ISO timestamp the money moved (or is due, when pending). */
  at: string;
  /** Signed rupees: positive is money in, negative is a refund out. */
  amount: number;
  status: TransactionStatus;
}

/** A transaction plus the copy its row renders. */
export interface PaymentsTxnItem {
  txn: PaymentTransaction;
  /** e.g. "Net Banking". */
  methodLabel: string;
  /** Signed and formatted, e.g. "+₹5,040" / "−₹3,000". */
  amount: string;
  /** Clock time today, else a short date — e.g. "9:42 am" / "Yesterday" / "20 Jul". */
  time: string;
  /** e.g. "Success". */
  statusLabel: string;
}

export type PaymentsKpiKey =
  "collectedToday" | "razorpaySettled" | "otaReceivables" | "pendingFromGuests";

export interface PaymentsKpi {
  key: PaymentsKpiKey;
  label: string;
  /** Pre-formatted amount, e.g. "₹10,696". */
  value: string;
  /** Sub-line counting what makes up the figure, e.g. "2 transactions". */
  note: string;
}

/** One channel's settlement row: what it owes us and what it keeps. */
export interface OtaSettlement {
  source: BookingSource;
  /** e.g. "Booking.com". */
  name: string;
  /** Single-letter disc, e.g. "B". */
  abbr: string;
  /** Bookings of this channel with money collected. */
  count: number;
  /** Commission as a whole percent — derived from the money, never seeded. */
  commissionPct: number;
  /** Gross collected by the channel, before its commission. */
  amount: number;
}

/** The month's net takings: gross, less what the OTAs keep, less refunds. */
export interface PaymentsMonthlyRollup {
  /** e.g. "This month". */
  label: string;
  gross: number;
  commission: number;
  refunds: number;
  /** gross − commission − refunds. */
  net: number;
}

export interface PaymentsPageData {
  /** ISO date the page is anchored to (drives "today" and the rollup month). */
  today: string;
  /** Sub-title under "Payments", e.g. "14 Jul 2026 · Razorpay + OTA settlements". */
  subtitle: string;
  kpis: PaymentsKpi[];
  /** Most recent movement first. */
  transactions: PaymentsTxnItem[];
  /** Largest amount owed first; only channels holding money appear. */
  ota: OtaSettlement[];
  rollup: PaymentsMonthlyRollup;
}

// ── Admin reports (PR #10) ───────────────────────────────────────────────
// Every figure here is derived from the booking set and the party-hall
// pipeline; the screen seeds nothing. Revenue is recognised *per night* — a
// three-night stay earns a third of its bill on each of its nights — which is
// what lets occupancy, ADR and RevPAR stay mutually consistent rather than
// being three unrelated numbers. The same engine feeds the dashboard's revenue
// card, so the two screens cannot disagree about what a window earned.

/** The four headline measures. ADR and RevPAR are the standard hotel ratios. */
export type ReportsKpiKey = "revenue" | "occupancy" | "adr" | "revpar";

export interface ReportsKpi {
  key: ReportsKpiKey;
  label: string;
  /** Pre-formatted, e.g. "₹2.6L" / "68%" / "₹1,540". */
  value: string;
  /** e.g. "▲ 12.4%", or null when the preceding window had nothing to compare. */
  delta: string | null;
  /** Whether `delta` is an improvement — drives its colour. Null when no delta. */
  deltaUp: boolean | null;
}

/** One bar of the revenue trend, split by how the stay was sold. */
export interface RevenueBar {
  /** e.g. "Tue" / "W3" / "J". */
  label: string;
  direct: number;
  ota: number;
  /** direct + ota. */
  total: number;
}

/** One slice of the booking-source donut. Percentages sum to exactly 100. */
export interface SourceSlice {
  key: string;
  /** e.g. "Direct (site/phone)". */
  label: string;
  /** Bookings sold through this source in the window. */
  count: number;
  /** Whole-percent share of the window's bookings. */
  pct: number;
}

/** A room type's (or the party hall's) contribution over the window. */
export interface RoomTypePerf {
  key: string;
  /** e.g. "Deluxe Room". */
  name: string;
  revenue: number;
  /** Pre-formatted, e.g. "₹5.9L". */
  revenueLabel: string;
  /** Whole-percent occupancy, or null for the party hall — it has no nights. */
  occPct: number | null;
  /** Share of the best performer's revenue, for the bar width. */
  barPct: number;
}

/** Share of room-nights sold on each meal plan. All four always appear. */
export interface MealPlanShare {
  plan: MealPlan;
  /** e.g. "room only". */
  note: string;
  pct: number;
}

/** Everything the screen shows for one range. Switching ranges swaps this whole object. */
export interface ReportsRange {
  key: RevenuePeriodKey;
  /** Toggle button text, e.g. "30D". */
  switchLabel: string;
  /** e.g. "last 30 days". */
  rangeLabel: string;
  kpis: ReportsKpi[];
  bars: RevenueBar[];
  /** Largest share first; sources with no bookings in the window are omitted. */
  sources: SourceSlice[];
  /** Best performer first. */
  roomTypes: RoomTypePerf[];
  mealPlans: MealPlanShare[];
}

export interface ReportsPageData {
  /** ISO date every window is anchored to and counts back from. */
  today: string;
  /** Sub-title under "Reports". */
  subtitle: string;
  /** All three ranges, so the toggle switches without a round-trip. */
  ranges: ReportsRange[];
}

// ── Admin settings (PR #11) ─────────────────────────────────────────────────
//
// Settings is where the rules the rest of the console bills by are stated:
// tariffs, GST, fees, the party-hall advance, OTA commission. Every one of
// those already had a home in the data set before this screen existed, so the
// panels read them back rather than restating them — a rate shown here and a
// rate charged on a booking cannot disagree, because they are one value.

/** The property as guests see it on confirmations. */
export interface PropertyProfile {
  name: string;
  phone: string;
  whatsapp: string;
  /** e.g. "2:00 PM". */
  checkInTime: string;
  checkOutTime: string;
}

/** One room type's nightly tariff, as the pricing panel edits it. */
export interface RoomTariff {
  type: RoomType;
  name: string;
  /** e.g. "10 rooms · 24 m²". */
  inventoryLabel: string;
  /** Grouped rupees without the symbol, e.g. "1,500" — the ₹ sits outside the field. */
  rate: string;
}

/** A flat charge or rate the property applies on top of the tariff. */
export interface ChargeSetting {
  key: "earlyCheckIn" | "lateCheckOut" | "gst" | "partyHallAdvance";
  label: string;
  /** Pre-formatted with its unit, e.g. "₹400" or "12%". */
  value: string;
}

export interface PricingSettings {
  tariffs: RoomTariff[];
  charges: ChargeSetting[];
}

/** An on/off property setting. The screen controls these locally; Save is stubbed. */
export interface ToggleSetting {
  key: string;
  label: string;
  desc: string;
  on: boolean;
}

export interface PaymentGateway {
  name: string;
  connected: boolean;
  /** e.g. "UPI · Cards · Net Banking · Wallets · key ...a4F9". */
  methodsLine: string;
}

export interface PaymentSettings {
  gateway: PaymentGateway;
  toggles: ToggleSetting[];
}

/**
 * An OTA the property sells through. `commissionPct` is the contracted rate;
 * for any channel that has actually sold a stay it is also the rate the
 * Payments screen derives from the rupees that channel kept.
 */
export interface ChannelSetting {
  key: BookingSource;
  name: string;
  abbr: string;
  commissionPct: number;
  connected: boolean;
  /** How many stays this channel has sold us — 0 for a channel yet to earn. */
  bookings: number;
}

export interface TeamMember {
  name: string;
  email: string;
  role: string;
  /** Derived from the name, so a badge cannot spell someone else. */
  initials: string;
}

/** One entry in the sticky section nav; `id` is the panel it scrolls to. */
export interface SettingsSection {
  id: string;
  label: string;
}

export interface SettingsPageData {
  sections: SettingsSection[];
  property: PropertyProfile;
  pricing: PricingSettings;
  payments: PaymentSettings;
  channels: ChannelSetting[];
  team: TeamMember[];
  notifications: ToggleSetting[];
}
