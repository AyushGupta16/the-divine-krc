// Booking system domain types.
// Source of truth: design_handoff_krc_booking/README.md "Data model".

export type RoomType = "deluxe" | "deluxe_balcony";

export type BookingSource =
  | "direct"
  | "walk_in"
  | "phone"
  | "booking_com"
  | "makemytrip"
  | "goibibo"
  | "agoda"
  | "oyo";

export type MealPlan = "EP" | "CP" | "MAP" | "AP";

export type BookingStatus =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "pending_payment"
  | "cancelled"
  | "no_show";

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

export type PartyHallStatus =
  | "enquiry"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface PartyHallEnquiry {
  id: string;
  title: string;
  /** ISO date */
  date: string;
  slot: PartyHallSlot;
  guests: number;
  package: string;
  addOns: string[];
  status: PartyHallStatus;
  amount: number;
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

export type ActivityKind =
  | "check_in"
  | "enquiry"
  | "payment"
  | "cancellation";

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
