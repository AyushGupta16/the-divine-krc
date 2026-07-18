// The public "manage your booking" screen (spec 15): search state ->
// result state. Mirrors `Guest Booking Lookup.dc.html`. Uses the same
// ownership check both to *find* the booking and to *cancel* it —
// `findGuestBooking`/`cancelGuestBooking` in `lib/bookings.ts` — so nothing
// this screen shows or does can diverge from what the server actually
// verified.

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Home, Loader2, Zap } from "lucide-react";

import { formatINR } from "@/lib/booking-math";
import { cancelGuestBookingFn, lookupGuestBookingFn } from "@/lib/bookings-data";
import type { Booking, Guest } from "@/types/booking";
import { Nav } from "@/components/home/Nav";
import { Input } from "@/components/ui/input";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import roomBalcony from "@/assets/room-balcony.jpg";

const ROOM_IMAGES: Record<string, string> = {
  deluxe: roomDeluxe,
  deluxe_balcony: roomBalcony,
};

const FIELD =
  "h-auto rounded-[5px] border-[#e5ddcb] bg-white px-3.25 py-2.75 text-[13.5px] shadow-none " +
  "placeholder:text-[#b3aa96] focus-visible:border-gold focus-visible:ring-0";
const LABEL = "mb-1.75 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a746a]";

const STATUS_LABEL: Record<Booking["status"], string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  pending_payment: "Pending payment",
  cancelled: "Cancelled",
  no_show: "No show",
};

const STATUS_DOT: Record<Booking["status"], string> = {
  confirmed: "bg-[#7dc07d]",
  checked_in: "bg-[#7dc07d]",
  checked_out: "bg-warm-gray",
  pending_payment: "bg-gold",
  cancelled: "bg-[#c96a52]",
  no_show: "bg-[#c96a52]",
};

const STATUS_TEXT: Record<Booking["status"], string> = {
  confirmed: "text-[#7dc07d]",
  checked_in: "text-[#7dc07d]",
  checked_out: "text-warm-gray",
  pending_payment: "text-gold",
  cancelled: "text-[#c96a52]",
  no_show: "text-[#c96a52]",
};

interface Found {
  booking: Booking;
  guest: Guest;
  roomTypeName: string;
}

export function BookingLookup() {
  const [bookingId, setBookingId] = useState("");
  const [contact, setContact] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setBusy(true);
    setError(null);
    const res = await lookupGuestBookingFn({ data: { bookingId, contact } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setFound({ booking: res.booking, guest: res.guest, roomTypeName: res.roomTypeName });
  }

  function back() {
    setFound(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-ivory">
      <Nav alwaysSolid />
      <div className="mx-auto max-w-3xl px-6 pb-20 pt-28 md:pt-32">
        {found ? (
          <ResultCard
            found={found}
            onBack={back}
            onCancelled={(b) => setFound({ ...found, booking: b })}
          />
        ) : (
          <SearchCard
            bookingId={bookingId}
            setBookingId={setBookingId}
            contact={contact}
            setContact={setContact}
            busy={busy}
            error={error}
            onSubmit={find}
          />
        )}
      </div>
    </div>
  );
}

function SearchCard({
  bookingId,
  setBookingId,
  contact,
  setContact,
  busy,
  error,
  onSubmit,
}: {
  bookingId: string;
  setBookingId: (v: string) => void;
  contact: string;
  setContact: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const canSubmit = bookingId.trim().length > 0 && contact.trim().length > 0 && !busy;

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-3">
          <span className="h-px w-8 bg-gold" />
          <span className="text-[11px] font-bold uppercase tracking-[0.34em] text-gold-soft">
            Find your reservation
          </span>
          <span className="h-px w-8 bg-gold" />
        </div>
        <h1 className="font-display text-[32px] font-semibold leading-tight text-obsidian">
          Look up your booking
        </h1>
        <p className="mt-2.5 text-[14px] text-warm-gray">
          Enter your booking ID and the phone or email used to book.
        </p>
      </div>

      <form
        className="rounded-[8px] border border-gold/15 bg-white p-7 shadow-[0_24px_50px_-34px_rgba(10,10,10,0.5)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="flex flex-col gap-4.5">
          <div>
            <label className={LABEL} htmlFor="gl-id">
              Booking ID
            </label>
            <Input
              id="gl-id"
              className={FIELD}
              placeholder="KRC-20260101-001"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="gl-contact">
              Phone or email
            </label>
            <Input
              id="gl-contact"
              className={FIELD}
              placeholder="+91 98470 11223"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          {error && <p className="text-[12.5px] text-[#b4553f]">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-1 flex items-center justify-center gap-2 rounded-[4px] bg-gold py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Find my booking
          </button>
        </div>
      </form>
      <p className="mt-5.5 text-center text-[12.5px] text-warm-gray">
        Can&apos;t find it?{" "}
        <a href="https://wa.me/918707368307" target="_blank" rel="noopener noreferrer">
          WhatsApp us
        </a>{" "}
        or call <a href="tel:+918707368307">+91 87073 68307</a>
      </p>
    </div>
  );
}

function ResultCard({
  found,
  onBack,
  onCancelled,
}: {
  found: Found;
  onBack: () => void;
  onCancelled: (booking: Booking) => void;
}) {
  const { booking, guest, roomTypeName } = found;
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isCancellable = booking.status === "confirmed" || booking.status === "pending_payment";
  const paidOnline = booking.collection.paidToHotel > 0 || booking.collection.otaCollection > 0;

  async function cancel() {
    setCancelling(true);
    setCancelError(null);
    const res = await cancelGuestBookingFn({
      data: { bookingId: booking.id, contact: guest.phone },
    });
    setCancelling(false);
    if (!res.ok) {
      setCancelError(res.error);
      return;
    }
    setConfirmingCancel(false);
    onCancelled(res.booking);
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-4.5 text-[11px] font-bold uppercase tracking-[0.18em] text-warm-gray"
      >
        ← Search again
      </button>

      <div className="overflow-hidden rounded-[10px] border border-gold/15 bg-white">
        <div className="flex items-center justify-between bg-obsidian px-7 py-5">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-ivory/50">Booking ID</p>
            <p className="font-display text-2xl text-gold">{booking.id}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.75 rounded-full bg-white/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] ${STATUS_TEXT[booking.status]}`}
          >
            <span className={`size-1.75 rounded-full ${STATUS_DOT[booking.status]}`} />
            {STATUS_LABEL[booking.status]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr]">
          <img
            src={ROOM_IMAGES[booking.roomType]}
            alt={roomTypeName}
            className="h-[230px] w-full object-cover sm:h-full"
          />
          <div className="p-6">
            <h2 className="font-display text-[23px] font-semibold text-obsidian">{roomTypeName}</h2>
            <p className="mb-5 text-[12px] text-warm-gray">
              {booking.roomNo ? `Room ${booking.roomNo}` : "Room to be assigned"} · {booking.urn}{" "}
              night{booking.urn === 1 ? "" : "s"}
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              <Detail label="Check-in" value={format(parseISO(booking.checkIn), "EEE, dd MMM")} />
              <Detail label="Check-out" value={format(parseISO(booking.checkOut), "EEE, dd MMM")} />
              <Detail label="Rooms" value="1 Room" />
              <Detail label="Booked under" value={guest.name} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gold/10 bg-[#faf7ef] px-7 py-4.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[7px] bg-obsidian text-gold">
              {paidOnline ? <Zap className="size-4" /> : <Home className="size-4" />}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[#5a8a5a]">
                {paidOnline ? "Paid via Razorpay" : "Pay at hotel"}
              </p>
              <p className="text-[11px] text-warm-gray">
                {booking.urn} night{booking.urn === 1 ? "" : "s"} + taxes
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.2em] text-warm-gray">
              {paidOnline ? "Total paid" : "Total due"}
            </p>
            <p className="font-display text-2xl text-gold-soft">{formatINR(booking.totalBill)}</p>
          </div>
        </div>
      </div>

      {cancelError && <p className="mt-3 text-[12.5px] text-[#b4553f]">{cancelError}</p>}

      {confirmingCancel ? (
        <div className="mt-5 rounded-[6px] border border-[#e6cbc2] bg-[#fdf5f2] p-5">
          <p className="text-[13.5px] font-semibold text-obsidian">Cancel this booking?</p>
          <p className="mt-1.5 text-[12.5px] text-warm-gray">
            This can&apos;t be undone. You can rebook any time from the home page.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              className="rounded-[4px] border border-gold/30 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian"
            >
              Keep booking
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={cancel}
              className="flex items-center justify-center gap-2 rounded-[4px] bg-[#b4553f] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {cancelling && <Loader2 className="size-3.5 animate-spin" />}
              Yes, cancel it
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="min-w-[170px] flex-1 rounded-[4px] bg-obsidian py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold"
          >
            Download receipt
          </button>
          <a
            href="https://wa.me/918707368307"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-[170px] flex-1 items-center justify-center rounded-[4px] border border-[#d9d0bd] bg-white py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian"
          >
            Modify via WhatsApp
          </a>
          {isCancellable && (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="min-w-[170px] flex-1 rounded-[4px] border border-[#e6cbc2] bg-white py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b4553f]"
            >
              Cancel booking
            </button>
          )}
        </div>
      )}
      {isCancellable && !confirmingCancel && (
        <p className="mt-4.5 text-center text-[12px] text-warm-gray">
          Free cancellation any time before check-in.
        </p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[9px] uppercase tracking-[0.2em] text-warm-gray">{label}</div>
      <div className="text-[14px] font-semibold text-obsidian">{value}</div>
    </div>
  );
}
