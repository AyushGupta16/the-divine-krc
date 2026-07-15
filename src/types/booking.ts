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
