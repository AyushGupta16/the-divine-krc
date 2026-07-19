// Derivation layer for invoices/receipts (design_handoff_krc_invoices).
//
// Same rule as `bookings.ts`: pure functions of their arguments, no data of
// its own, safe for route loaders to import. Everything on an `Invoice` —
// lines, totals, GST — is recomputed from the booking/enquiry rows every
// time; only the invoice number and issue date are ever persisted (in
// `schema.ts`'s `invoices` table), because those two are the only things
// that must stay the same across repeat downloads.

import { computeTotalCollected, formatINR, urn } from "@/lib/booking-math";
import { GST_PCT, ROOM_TYPES } from "@/lib/bookings";
import type { Booking, Guest, PartyHallEnquiry } from "@/types/booking";

export const PARTY_HALL_GST_PCT = 18;

export type InvoiceType = "room" | "group" | "party_hall";

export interface InvoiceLine {
  name: string;
  note: string;
  qty: string;
  rate: string;
  amount: string;
}

export interface InvoiceSection {
  title: string;
  refId: string;
  meta: string;
  lines: InvoiceLine[];
  subtotal: number;
}

export interface InvoiceTotalRow {
  label: string;
  value: string;
  negative?: boolean;
}

export interface InvoiceFact {
  label: string;
  value: string;
}

export interface InvoicePayment {
  method: string;
  reference: string;
  status: string;
}

export interface Invoice {
  invoiceNo: string;
  type: InvoiceType;
  refId: string;
  issuedAt: string;
  billedTo: { name: string; phone: string; email: string; city: string };
  facts: InvoiceFact[];
  checkIn?: string;
  checkOut?: string;
  eventDate?: string;
  sections: InvoiceSection[];
  totalRows: InvoiceTotalRow[];
  gstRate: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  advance?: number;
  payment: InvoicePayment;
}

function roomTypeName(type: Booking["roomType"]): string {
  return ROOM_TYPES.find((rt) => rt.type === type)?.name ?? type;
}

function bookingLines(b: Booking): InvoiceLine[] {
  const lines: InvoiceLine[] = [
    {
      name: `${roomTypeName(b.roomType)}${b.roomNo ? ` · Room ${b.roomNo}` : ""}`,
      note: `${b.urn} nt${b.urn === 1 ? "" : "s"} · ${b.mealPlan}`,
      qty: `${b.urn}`,
      rate: formatINR(b.revenue.room / Math.max(1, b.urn)),
      amount: formatINR(b.revenue.room),
    },
  ];
  if (b.revenue.earlyCheckIn > 0) {
    lines.push({
      name: "Early check-in",
      note: "",
      qty: "1",
      rate: formatINR(b.revenue.earlyCheckIn),
      amount: formatINR(b.revenue.earlyCheckIn),
    });
  }
  if (b.revenue.lateCheckOut > 0) {
    lines.push({
      name: "Late check-out",
      note: "",
      qty: "1",
      rate: formatINR(b.revenue.lateCheckOut),
      amount: formatINR(b.revenue.lateCheckOut),
    });
  }
  if (b.revenue.other > 0) {
    lines.push({
      name: "Other charges",
      note: "",
      qty: "—",
      rate: "—",
      amount: formatINR(b.revenue.other),
    });
  }
  return lines;
}

function bookingSubtotal(b: Booking): number {
  return b.revenue.room + b.revenue.earlyCheckIn + b.revenue.lateCheckOut + b.revenue.other;
}

function totalRowsFor(
  subtotal: number,
  discount: number,
  gstRate: number,
): {
  rows: InvoiceTotalRow[];
  taxable: number;
  gst: number;
  grandTotal: number;
} {
  const taxable = Math.max(0, subtotal - discount);
  const gst = Math.round(taxable * (gstRate / 100));
  const grandTotal = taxable + gst;
  const rows: InvoiceTotalRow[] = [{ label: "Subtotal", value: formatINR(subtotal) }];
  if (discount > 0)
    rows.push({ label: "Discount", value: `– ${formatINR(discount)}`, negative: true });
  rows.push({ label: "Taxable value", value: formatINR(taxable) });
  rows.push({ label: `GST (${gstRate}%)`, value: formatINR(gst) });
  return { rows, taxable, gst, grandTotal };
}

function paymentFor(b: Booking): InvoicePayment {
  const paid = computeTotalCollected(b.collection);
  return {
    method: b.razorpayPaymentId ? "Razorpay" : "Pay at hotel",
    reference: b.razorpayPaymentId ?? "—",
    status: paid >= b.totalBill ? "Paid" : paid > 0 ? "Partially paid" : "Pending",
  };
}

/** Single-room invoice — one Booking, one section-worth of lines inline. */
export function buildRoomInvoice(
  invoiceNo: string,
  issuedAt: string,
  booking: Booking,
  guest: Guest,
): Invoice {
  const subtotal = bookingSubtotal(booking);
  const { rows, grandTotal } = totalRowsFor(
    subtotal,
    booking.revenue.discount,
    booking.revenue.taxPct,
  );
  const amountPaid = computeTotalCollected(booking.collection);
  return {
    invoiceNo,
    type: "room",
    refId: booking.id,
    issuedAt,
    billedTo: { name: guest.name, phone: guest.phone, email: guest.email, city: guest.city },
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    facts: [
      { label: "Room", value: booking.roomNo ?? "Unassigned" },
      { label: "Type", value: roomTypeName(booking.roomType) },
      { label: "Nights (URN)", value: `${booking.urn}` },
      { label: "Meal plan", value: booking.mealPlan },
    ],
    sections: [
      {
        title: roomTypeName(booking.roomType),
        refId: booking.id,
        meta: booking.mealPlan,
        lines: bookingLines(booking),
        subtotal,
      },
    ],
    totalRows: rows,
    gstRate: booking.revenue.taxPct,
    grandTotal,
    amountPaid,
    balanceDue: Math.max(0, grandTotal - amountPaid),
    payment: paymentFor(booking),
  };
}

/** Group invoice — one Reservation covering several room Bookings for one guest/stay. */
export function buildGroupInvoice(
  invoiceNo: string,
  issuedAt: string,
  refId: string,
  bookings: Booking[],
  guest: Guest,
): Invoice {
  const sections: InvoiceSection[] = bookings.map((b) => ({
    title: `${roomTypeName(b.roomType)}${b.roomNo ? ` · Room ${b.roomNo}` : ""}`,
    refId: b.id,
    meta: `${b.mealPlan} · ${b.urn} nt${b.urn === 1 ? "" : "s"}`,
    lines: bookingLines(b),
    subtotal: bookingSubtotal(b),
  }));
  const subtotal = sections.reduce((sum, s) => sum + s.subtotal, 0);
  const discount = bookings.reduce((sum, b) => sum + b.revenue.discount, 0);
  const gstRate = bookings[0]?.revenue.taxPct ?? GST_PCT;
  const { rows, grandTotal } = totalRowsFor(subtotal, discount, gstRate);
  const amountPaid = bookings.reduce((sum, b) => sum + computeTotalCollected(b.collection), 0);
  const totalNights = bookings.reduce((sum, b) => sum + b.urn, 0);
  const paidCount = bookings.filter((b) => b.razorpayPaymentId).length;
  return {
    invoiceNo,
    type: "group",
    refId,
    issuedAt,
    billedTo: { name: guest.name, phone: guest.phone, email: guest.email, city: guest.city },
    checkIn: bookings[0]?.checkIn,
    checkOut: bookings[0]?.checkOut,
    facts: [
      { label: "Rooms", value: `${bookings.length}` },
      { label: "Total nights", value: `${totalNights}` },
      {
        label: "Plan",
        value:
          new Set(bookings.map((b) => b.mealPlan)).size > 1
            ? "Mixed"
            : (bookings[0]?.mealPlan ?? "—"),
      },
      { label: "GST rate", value: `${gstRate}%` },
    ],
    sections,
    totalRows: rows,
    gstRate,
    grandTotal,
    amountPaid,
    balanceDue: Math.max(0, grandTotal - amountPaid),
    payment: {
      method: paidCount > 0 ? "Razorpay" : "Pay at hotel",
      reference: bookings.find((b) => b.razorpayPaymentId)?.razorpayPaymentId ?? "—",
      status: amountPaid >= grandTotal ? "Paid" : amountPaid > 0 ? "Partially paid" : "Pending",
    },
  };
}

const SLOT_LABEL: Record<PartyHallEnquiry["slot"], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  full_day: "Full day",
};

/** Party hall invoice — one Enquiry, quoted total + 25% advance/balance split. */
export function buildPartyHallInvoice(
  invoiceNo: string,
  issuedAt: string,
  enquiry: PartyHallEnquiry,
): Invoice {
  const lines: InvoiceLine[] = [
    {
      name: `Party Hall — ${enquiry.package} package`,
      note: `${SLOT_LABEL[enquiry.slot]} slot · up to ${enquiry.guests} guests`,
      qty: "1",
      rate: formatINR(enquiry.amount),
      amount: formatINR(enquiry.amount),
    },
    ...enquiry.addOns.map((addOn): InvoiceLine => ({
      name: addOn,
      note: "Included in package",
      qty: "1",
      rate: "—",
      amount: "—",
    })),
  ];
  const { rows, grandTotal } = totalRowsFor(enquiry.amount, 0, PARTY_HALL_GST_PCT);
  const advance = enquiry.advancePaid;
  return {
    invoiceNo,
    type: "party_hall",
    refId: enquiry.id,
    issuedAt,
    billedTo: {
      name: enquiry.contactName ?? enquiry.title,
      phone: enquiry.contactPhone ?? "—",
      email: enquiry.contactEmail ?? "—",
      city: "—",
    },
    eventDate: enquiry.date,
    facts: [
      { label: "Package", value: enquiry.package },
      { label: "Guests", value: `${enquiry.guests}` },
      { label: "Slot", value: SLOT_LABEL[enquiry.slot] },
      { label: "Event date", value: enquiry.date },
    ],
    sections: [
      {
        title: enquiry.title,
        refId: enquiry.id,
        meta: SLOT_LABEL[enquiry.slot],
        lines,
        subtotal: enquiry.amount,
      },
    ],
    totalRows: rows,
    gstRate: PARTY_HALL_GST_PCT,
    grandTotal,
    amountPaid: advance,
    balanceDue: Math.max(0, grandTotal - advance),
    advance,
    payment: {
      method: "Razorpay",
      reference: "—",
      status: advance >= grandTotal ? "Paid" : advance > 0 ? "Advance paid" : "Pending",
    },
  };
}

/**
 * Which bookings a room/group invoice for `bookingId` should cover: itself
 * plus any other non-cancelled booking for the same guest with the exact
 * same check-in/check-out (i.e. rooms taken together in one stay). No
 * "reservation group" is ever stored — this is the derivation.
 */
export function resolveInvoiceParty(bookingId: string, bookings: Booking[]): Booking[] {
  const target = bookings.find((b) => b.id === bookingId);
  if (!target) return [];
  return bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        b.guestId === target.guestId &&
        b.checkIn === target.checkIn &&
        b.checkOut === target.checkOut,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
