// Pure row -> domain mappers shared by bookings-data.ts and invoices-data.ts.
//
// This file must never import fixtures, db, or schema (not even type-only —
// eslint's no-restricted-imports blocks `@/lib/schema` from anywhere outside
// its explicit allowlist, so `BookingRow` below is declared structurally
// instead; the actual rows returned by `conn.select().from(schema.bookings)`
// satisfy it by shape). See bookings-data.ts's LANDMINE comment: a plain
// exported function that touches fixtures/db/schema at module scope ships
// the whole seed dataset (and DB secrets) to the client bundle. toBooking
// only ever touches its typed row argument, same pattern as toPartyHall.

import { withTotal } from "@/lib/bookings";
import type {
  Booking,
  BookingCollection,
  BookingRevenue,
  BookingSource,
  BookingStatus,
  GuestRequest,
  MealPlan,
  PaymentMethod,
  RequestedServices,
  RoomType,
} from "@/types/booking";

/** Structural mirror of the `bookings` table row — see the file header for why
 *  this isn't `typeof schema.bookings.$inferSelect`. Keep in sync with
 *  `schema.ts`'s `bookings` table by hand. */
export interface BookingRow {
  id: string;
  guestId: string;
  roomNo: string | null;
  roomType: string;
  checkIn: string;
  checkOut: string;
  urn: number;
  source: string;
  mealPlan: string;
  revenueRoom: number;
  revenueEarlyCheckIn: number;
  revenueLateCheckOut: number;
  revenueOther: number;
  revenueDiscount: number;
  revenueTaxPct: number;
  collectionPaidToHotel: number;
  collectionOtaCollection: number;
  collectionOtaCommission: number;
  collectionComplimentary: number;
  collectionPending: number;
  status: string;
  createdAt: Date;
  roomAssignedAt: Date | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  batchId: string | null;
  specialRequest: { preferences: string[]; note?: string } | null;
  requestedServices: {
    earlyCheckIn?: { requested: boolean; status: "pending" | "applied" | "declined" | "reversed" };
    lateCheckOut?: { requested: boolean; status: "pending" | "applied" | "declined" | "reversed" };
    extraMattress?: {
      requested: boolean;
      status: "pending" | "applied" | "declined" | "reversed";
      qty: number;
    };
  } | null;
  revenueOtherNote: string | null;
}

export function toBooking(r: BookingRow): Booking {
  const revenue: BookingRevenue = {
    room: r.revenueRoom,
    earlyCheckIn: r.revenueEarlyCheckIn,
    lateCheckOut: r.revenueLateCheckOut,
    other: r.revenueOther,
    discount: r.revenueDiscount,
    taxPct: r.revenueTaxPct,
  };
  const collection: BookingCollection = {
    paidToHotel: r.collectionPaidToHotel,
    otaCollection: r.collectionOtaCollection,
    otaCommission: r.collectionOtaCommission,
    complimentary: r.collectionComplimentary,
    pending: r.collectionPending,
  };
  return withTotal({
    id: r.id,
    guestId: r.guestId,
    roomNo: r.roomNo,
    roomType: r.roomType as RoomType,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    urn: r.urn,
    source: r.source as BookingSource,
    mealPlan: r.mealPlan as MealPlan,
    revenue,
    collection,
    status: r.status as BookingStatus,
    createdAt: r.createdAt.toISOString(),
    roomAssignedAt: r.roomAssignedAt?.toISOString() ?? undefined,
    razorpayOrderId: r.razorpayOrderId ?? undefined,
    razorpayPaymentId: r.razorpayPaymentId ?? undefined,
    paymentMethod: (r.paymentMethod ?? undefined) as PaymentMethod | "online" | undefined,
    paidAt: r.paidAt?.toISOString() ?? undefined,
    batchId: r.batchId ?? undefined,
    specialRequest: (r.specialRequest ?? undefined) as GuestRequest | undefined,
    requestedServices: (r.requestedServices ?? undefined) as RequestedServices | undefined,
    revenueOtherNote: r.revenueOtherNote ?? undefined,
  });
}
