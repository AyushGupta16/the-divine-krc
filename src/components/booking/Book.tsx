// The public 4-step booking flow (spec 14): Rooms -> Details -> Payment -> Confirmed.
// Mirrors `Guest Booking.dc.html`. Totals reuse the same pure helpers the admin
// console's manual-entry drawer uses, so a guest sees the number that actually
// gets persisted. Payment is UI-only — no Razorpay SDK — real gateway wiring is
// spec #16; selecting it here just records the guest's preference for the
// confirmation screen, as `schema.ts` already documents that split.
//
// A guest picks a *quantity per room type* rather than one room per pass, so a
// family needing two Deluxe rooms and one Balcony room books and pays once.
// The backend still has no notion of a multi-room booking, though — each unit
// becomes its own `Booking` row via a sequential loop of the same
// `createGuestBookingFn` call the single-room flow used, sharing one guest by
// phone reuse (see `createBooking`). Not a transaction: a mid-loop failure
// leaves whatever already posted in place, same accepted tradeoff
// `insertBooking` documents for the two-statement guest+booking write.

import { useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Check, Home, Info, Loader2, Lock, Zap } from "lucide-react";

import type { PayMethod, RoomType } from "@/types/booking";
import { GST_PCT, ROOM_TYPES } from "@/lib/bookings";
import { computeTotalBill, formatINR, urn } from "@/lib/booking-math";
import {
  createGuestBookingFn,
  createRazorpayOrderFn,
  verifyRazorpayPaymentFn,
} from "@/lib/bookings-data";
import type { Booking } from "@/types/booking";
import { Nav } from "@/components/home/Nav";
import { CounterField } from "@/components/home/CounterField";
import { TIME_SLOTS, formatTimeLabel } from "@/lib/time-slots";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import roomBalcony from "@/assets/room-balcony.jpg";

const STEPS = ["Rooms", "Details", "Payment", "Confirmed"] as const;

// Checkout is a third-party `<script>`, not an npm package — Razorpay only
// ships it that way. `window.Razorpay` stays undefined until it loads, so
// every call site awaits `loadRazorpayCheckout()` first.
interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let checkoutScript: Promise<void> | null = null;
function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  checkoutScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window."));
    document.body.appendChild(script);
  });
  return checkoutScript;
}

const ROOM_IMAGES: Record<RoomType, string> = {
  deluxe: roomDeluxe,
  deluxe_balcony: roomBalcony,
};

const FIELD =
  "h-auto rounded-[5px] border-[#e5ddcb] bg-white px-3.25 py-2.75 text-[13.5px] shadow-none " +
  "placeholder:text-[#b3aa96] focus-visible:border-gold focus-visible:ring-0";
const LABEL = "mb-1.75 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a746a]";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const EMPTY_GUEST = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  specialRequests: "",
};

const EMPTY_CART: Record<RoomType, number> = Object.fromEntries(
  ROOM_TYPES.map((rt) => [rt.type, 0]),
) as Record<RoomType, number>;

interface CartLine {
  type: RoomType;
  name: string;
  pricePerNight: number;
  qty: number;
}

export function Book() {
  const [step, setStep] = useState(0);
  const [cart, setCart] = useState<Record<RoomType, number>>(EMPTY_CART);
  const [guests, setGuests] = useState(2);
  const [checkIn, setCheckIn] = useState(todayIso());
  const [checkOut, setCheckOut] = useState(tomorrowIso());
  const [arrivalTime, setArrivalTime] = useState("14:00");
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [payMethod, setPayMethod] = useState<PayMethod>("razorpay");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights = urn(checkIn, checkOut);
  const cartLines: CartLine[] = ROOM_TYPES.filter((rt) => cart[rt.type] > 0).map((rt) => ({
    type: rt.type,
    name: rt.name,
    pricePerNight: rt.pricePerNight,
    qty: cart[rt.type],
  }));
  const roomCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const subtotal = cartLines.reduce((sum, l) => sum + l.pricePerNight * nights * l.qty, 0);
  const total =
    roomCount > 0
      ? computeTotalBill({
          room: subtotal,
          earlyCheckIn: 0,
          lateCheckOut: 0,
          other: 0,
          discount: 0,
          taxPct: GST_PCT,
        })
      : 0;

  function setQty(type: RoomType, qty: number) {
    setCart((c) => ({ ...c, [type]: qty }));
  }

  function restart() {
    setStep(0);
    setCart(EMPTY_CART);
    setGuests(2);
    setGuest(EMPTY_GUEST);
    setPayMethod("razorpay");
    setBookings(null);
    setError(null);
  }

  async function submit() {
    if (roomCount === 0) return;
    setError(null);
    setBusy(true);
    const guestName = `${guest.firstName} ${guest.lastName}`.trim();
    const created: Booking[] = [];
    for (const line of cartLines) {
      for (let i = 0; i < line.qty; i++) {
        const res = await createGuestBookingFn({
          data: {
            guestName,
            guestPhone: guest.phone,
            guestEmail: guest.email,
            guestCity: "",
            roomType: line.type,
            roomNo: null,
            checkIn,
            checkOut,
            source: "direct",
            mealPlan: "EP",
          },
        });
        if (!res.ok) {
          setBusy(false);
          setError(res.error);
          return;
        }
        created.push(res.booking);
      }
    }

    if (payMethod === "pay_at_hotel") {
      setBusy(false);
      setBookings(created);
      setStep(3);
      return;
    }

    const orderRes = await createRazorpayOrderFn({
      data: { bookingIds: created.map((b) => b.id) },
    });
    if (!orderRes.ok) {
      setBusy(false);
      setError(orderRes.error);
      return;
    }

    try {
      await loadRazorpayCheckout();
    } catch {
      setBusy(false);
      setError("Could not load the payment window. Please try again.");
      return;
    }

    const rzp = new window.Razorpay!({
      key: orderRes.keyId,
      amount: orderRes.amount,
      currency: orderRes.currency,
      order_id: orderRes.orderId,
      name: "The Divine KRC",
      description: `${created.length} room${created.length > 1 ? "s" : ""} · ${nights} night${nights > 1 ? "s" : ""}`,
      prefill: { name: guestName, email: guest.email, contact: guest.phone },
      theme: { color: "#c5a059" },
      handler: (response) => {
        void (async () => {
          const verifyRes = await verifyRazorpayPaymentFn({
            data: {
              bookingIds: created.map((b) => b.id),
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            },
          });
          setBusy(false);
          if (!verifyRes.ok) {
            setError(verifyRes.error);
            return;
          }
          setBookings(verifyRes.bookings);
          setStep(3);
        })();
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.open();
  }

  return (
    <div className="min-h-screen bg-ivory">
      <Nav alwaysSolid />
      <div className="pt-[74px]">
        {step < 3 && <StepRail step={step} />}

        {step === 0 && (
          <RoomsStep
            guests={guests}
            setGuests={setGuests}
            checkIn={checkIn}
            setCheckIn={setCheckIn}
            checkOut={checkOut}
            setCheckOut={setCheckOut}
            arrivalTime={arrivalTime}
            setArrivalTime={setArrivalTime}
            nights={nights}
            cart={cart}
            setQty={setQty}
            roomCount={roomCount}
            onContinue={() => setStep(1)}
          />
        )}

        {step === 1 && roomCount > 0 && (
          <DetailsStep
            guest={guest}
            setGuest={setGuest}
            cartLines={cartLines}
            checkIn={checkIn}
            checkOut={checkOut}
            nights={nights}
            subtotal={subtotal}
            total={total}
            onBack={() => setStep(0)}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && roomCount > 0 && (
          <PaymentStep
            payMethod={payMethod}
            setPayMethod={setPayMethod}
            cartLines={cartLines}
            checkIn={checkIn}
            checkOut={checkOut}
            arrivalTime={arrivalTime}
            nights={nights}
            subtotal={subtotal}
            total={total}
            busy={busy}
            error={error}
            onBack={() => setStep(1)}
            onSubmit={() => void submit()}
          />
        )}

        {step === 3 && bookings && (
          <ConfirmedStep
            bookings={bookings}
            cartLines={cartLines}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            payMethod={payMethod}
            total={total}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  );
}

function StepRail({ step }: { step: number }) {
  return (
    <div className="border-b border-gold/10 bg-obsidian">
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-6 py-4">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i < step
                    ? "bg-gold text-obsidian"
                    : i === step
                      ? "border border-gold text-gold"
                      : "border border-ivory/20 text-ivory/40"
                }`}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={`text-[11px] uppercase tracking-[0.16em] ${
                  i <= step ? "text-ivory" : "text-ivory/40"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-8 bg-ivory/15" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomsStep({
  guests,
  setGuests,
  checkIn,
  setCheckIn,
  checkOut,
  setCheckOut,
  arrivalTime,
  setArrivalTime,
  nights,
  cart,
  setQty,
  roomCount,
  onContinue,
}: {
  guests: number;
  setGuests: (n: number) => void;
  checkIn: string;
  setCheckIn: (v: string) => void;
  checkOut: string;
  setCheckOut: (v: string) => void;
  arrivalTime: string;
  setArrivalTime: (v: string) => void;
  nights: number;
  cart: Record<RoomType, number>;
  setQty: (type: RoomType, qty: number) => void;
  roomCount: number;
  onContinue: () => void;
}) {
  const [departureTime, setDepartureTime] = useState("11:00");
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [departureOpen, setDepartureOpen] = useState(false);

  const arrivalDate = parseISO(checkIn);
  const departureDate = parseISO(checkOut);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 rounded-sm border border-gold/20 bg-ivory shadow-[0_30px_60px_-25px_rgba(10,10,10,0.25)]">
        <div className="grid grid-cols-2 divide-y divide-stone-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-warm-gray/70">
              Arrival
            </div>
            <Popover open={arrivalOpen} onOpenChange={setArrivalOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-left font-display text-lg text-obsidian transition-colors hover:text-gold md:text-xl"
                >
                  {format(arrivalDate, "EEE, dd MMM")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={arrivalDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setCheckIn(format(d, "yyyy-MM-dd"));
                    setArrivalOpen(false);
                    if (d >= departureDate) setCheckOut(format(addDays(d, 2), "yyyy-MM-dd"));
                  }}
                  disabled={{ before: new Date() }}
                />
              </PopoverContent>
            </Popover>
            <Select value={arrivalTime} onValueChange={setArrivalTime}>
              <SelectTrigger className="mt-1 h-auto w-fit gap-1 border-none bg-transparent p-0 text-[11px] text-warm-gray/70 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatTimeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-warm-gray/70">
              Departure
            </div>
            <Popover open={departureOpen} onOpenChange={setDepartureOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-left font-display text-lg text-obsidian transition-colors hover:text-gold md:text-xl"
                >
                  {format(departureDate, "EEE, dd MMM")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={departureDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setCheckOut(format(d, "yyyy-MM-dd"));
                    setDepartureOpen(false);
                  }}
                  disabled={{ before: arrivalDate }}
                />
              </PopoverContent>
            </Popover>
            <Select value={departureTime} onValueChange={setDepartureTime}>
              <SelectTrigger className="mt-1 h-auto w-fit gap-1 border-none bg-transparent p-0 text-[11px] text-warm-gray/70 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatTimeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-warm-gray/70">
              Guests
            </div>
            <CounterField
              value={guests}
              onChange={setGuests}
              min={1}
              max={6}
              label="Guests"
              unitLabel={(n) => `${n} ${n === 1 ? "Adult" : "Adults"}`}
            />
          </div>

          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-warm-gray/70">
              Nights
            </div>
            <p className="font-display text-lg text-obsidian md:text-xl">
              {nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "—"}
            </p>
          </div>
        </div>
      </div>

      <p className="mb-4 text-xs uppercase tracking-[0.18em] text-gold">Available for your dates</p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {ROOM_TYPES.map((rt) => (
          <div
            key={rt.type}
            className="overflow-hidden rounded-[6px] border border-gold/15 bg-white"
          >
            <div className="relative h-[230px]">
              <img src={ROOM_IMAGES[rt.type]} alt={rt.name} className="size-full object-cover" />
              <span className="absolute left-3 top-3 rounded-full bg-obsidian/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-ivory">
                {rt.count} left
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-obsidian/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-ivory">
                {rt.areaSqm} m²
              </span>
            </div>
            <div className="p-5">
              <h3 className="font-display text-xl text-obsidian">{rt.name}</h3>
              <p className="mt-1 text-[12.5px] text-warm-gray">{rt.count} rooms available</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-gold">
                  {formatINR(rt.pricePerNight)}{" "}
                  <span className="text-xs text-warm-gray">/night</span>
                </p>
                <RoomTypeCounter
                  value={cart[rt.type]}
                  max={rt.count}
                  onChange={(n) => setQty(rt.type, n)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between rounded-[6px] border border-gold/15 bg-white px-5 py-4">
        <p className="text-[12.5px] text-warm-gray">
          {roomCount > 0
            ? `${roomCount} room${roomCount === 1 ? "" : "s"} selected`
            : "Choose at least one room"}
        </p>
        <button
          type="button"
          disabled={roomCount === 0}
          onClick={onContinue}
          className="rounded-[5px] bg-gold px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

/** A room type's quantity in the cart — 0 shows a plain "Add" button, 1+ shows a stepper. */
function RoomTypeCounter({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  if (value === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        className="rounded-[5px] bg-gold px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90"
      >
        Add
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-[5px] border border-gold/30 px-2 py-1.5">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        aria-label="Fewer rooms"
        className="flex size-6 items-center justify-center rounded-full border border-gold/30 text-obsidian hover:border-gold"
      >
        −
      </button>
      <span className="w-4 text-center text-[13.5px] font-semibold text-obsidian">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="More rooms"
        className="flex size-6 items-center justify-center rounded-full border border-gold/30 text-obsidian hover:border-gold disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

function Summary({
  cartLines,
  checkIn,
  checkOut,
  nights,
  subtotal,
  total,
}: {
  cartLines: CartLine[];
  checkIn: string;
  checkOut: string;
  nights: number;
  subtotal: number;
  total: number;
}) {
  const coverImage = cartLines.length > 0 ? ROOM_IMAGES[cartLines[0].type] : undefined;

  return (
    <div className="w-full shrink-0 overflow-hidden rounded-[6px] bg-obsidian text-ivory sm:w-[380px]">
      {coverImage && <img src={coverImage} alt="" className="h-[155px] w-full object-cover" />}
      <div className="p-6">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ivory/50">Your stay</p>
        <h3 className="mt-1 font-display text-lg text-gold">
          {cartLines.map((l) => l.name).join(" + ")}
        </h3>
        <p className="mt-1 text-[12.5px] text-ivory/70">
          {checkIn} → {checkOut} · {nights} night{nights === 1 ? "" : "s"}
        </p>
        <div className="mt-5 flex flex-col gap-2 border-t border-ivory/10 pt-4 text-[13px]">
          {cartLines.map((l) => (
            <div key={l.type} className="flex justify-between text-ivory/80">
              <span>
                {l.name} × {l.qty} × {nights} night{nights === 1 ? "" : "s"}
              </span>
              <span>{formatINR(l.pricePerNight * nights * l.qty)}</span>
            </div>
          ))}
          <div className="flex justify-between text-ivory/80">
            <span>Taxes & fees ({GST_PCT}%)</span>
            <span>{formatINR(total - subtotal)}</span>
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-ivory/10 pt-4">
          <span className="text-[12px] uppercase tracking-[0.14em] text-ivory/60">Total</span>
          <span className="font-display text-2xl text-gold">{formatINR(total)}</span>
        </div>
      </div>
    </div>
  );
}

function DetailsStep({
  guest,
  setGuest,
  cartLines,
  checkIn,
  checkOut,
  nights,
  subtotal,
  total,
  onBack,
  onContinue,
}: {
  guest: typeof EMPTY_GUEST;
  setGuest: (v: typeof EMPTY_GUEST) => void;
  cartLines: CartLine[];
  checkIn: string;
  checkOut: string;
  nights: number;
  subtotal: number;
  total: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  const canContinue = guest.firstName.trim() && guest.lastName.trim() && guest.phone.trim();

  function set<K extends keyof typeof EMPTY_GUEST>(key: K, value: string) {
    setGuest({ ...guest, [key]: value });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 sm:flex-row">
      <div className="flex-1">
        <h2 className="font-display text-2xl text-obsidian">Guest details</h2>
        <div className="mt-6 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="gb-first">
                First name
              </label>
              <Input
                id="gb-first"
                className={FIELD}
                value={guest.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="gb-last">
                Last name
              </label>
              <Input
                id="gb-last"
                className={FIELD}
                value={guest.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="gb-phone">
                Phone
              </label>
              <Input
                id="gb-phone"
                className={FIELD}
                value={guest.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 …"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="gb-email">
                Email
              </label>
              <Input
                id="gb-email"
                type="email"
                className={FIELD}
                value={guest.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="gb-requests">
              Special requests (optional)
            </label>
            <textarea
              id="gb-requests"
              rows={3}
              className={`${FIELD} w-full`}
              value={guest.specialRequests}
              onChange={(e) => set("specialRequests", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-[5px] border border-gold/30 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className="rounded-[5px] bg-gold px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Continue to payment
          </button>
        </div>
      </div>
      <Summary
        cartLines={cartLines}
        checkIn={checkIn}
        checkOut={checkOut}
        nights={nights}
        subtotal={subtotal}
        total={total}
      />
    </div>
  );
}

function PaymentStep({
  payMethod,
  setPayMethod,
  cartLines,
  checkIn,
  checkOut,
  arrivalTime,
  nights,
  subtotal,
  total,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  payMethod: PayMethod;
  setPayMethod: (v: PayMethod) => void;
  cartLines: CartLine[];
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  nights: number;
  subtotal: number;
  total: number;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 sm:flex-row">
      <div className="flex-1">
        <h2 className="font-display text-2xl text-obsidian">Payment</h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPayMethod("razorpay")}
            className={`flex items-center gap-3 rounded-[6px] border p-4 text-left transition-colors ${
              payMethod === "razorpay" ? "border-gold bg-gold/5" : "border-[#e5ddcb] bg-white"
            }`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-obsidian text-gold">
              <Zap className="size-4" />
            </span>
            <span>
              <p className="text-[13.5px] font-semibold text-obsidian">Pay online</p>
              <p className="text-[12px] text-warm-gray">via Razorpay</p>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPayMethod("pay_at_hotel")}
            className={`flex items-center gap-3 rounded-[6px] border p-4 text-left transition-colors ${
              payMethod === "pay_at_hotel" ? "border-gold bg-gold/5" : "border-[#e5ddcb] bg-white"
            }`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-gold/15 text-gold">
              <Home className="size-4" />
            </span>
            <span>
              <p className="text-[13.5px] font-semibold text-obsidian">Pay at hotel</p>
              <p className="text-[12px] text-warm-gray">Reserve, pay on arrival</p>
            </span>
          </button>
        </div>

        {payMethod === "razorpay" ? (
          <div className="mt-5 overflow-hidden rounded-[6px] border border-gold/15">
            <div className="flex items-center gap-2 bg-obsidian px-4 py-3 text-[13px] text-ivory">
              <Lock className="size-3.5 text-gold" />
              <span>
                Secure checkout powered by <span className="font-semibold text-gold">Razorpay</span>
              </span>
            </div>
            <div className="bg-white p-4 text-[12.5px] text-warm-gray">
              <p>Continue to Razorpay to complete payment. Choose from:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["UPI", "Cards", "Net Banking", "Wallets"].map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-gold/25 px-3 py-1 text-[11px] text-obsidian"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-[6px] border border-gold/25 bg-gold/10 p-4 text-[13px] text-obsidian">
            <Info className="mt-0.5 size-4 shrink-0 text-gold" />
            <p>
              Reserve now and pay the full amount at the front desk on arrival. We hold your room
              until{" "}
              <span className="font-semibold">
                {formatTimeLabel(arrivalTime)} on {format(parseISO(checkIn), "d MMM")}
              </span>
              . A valid ID is required at check-in.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.25 py-2.5 text-[12.5px] font-medium text-[#b4553f]">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="rounded-[5px] border border-gold/30 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSubmit}
            className="flex items-center gap-2 rounded-[5px] bg-gold px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {payMethod === "razorpay" ? `Pay ${formatINR(total)} with Razorpay` : "Reserve rooms"}
          </button>
        </div>
      </div>
      <Summary
        cartLines={cartLines}
        checkIn={checkIn}
        checkOut={checkOut}
        nights={nights}
        subtotal={subtotal}
        total={total}
      />
    </div>
  );
}

function ConfirmedStep({
  bookings,
  cartLines,
  checkIn,
  checkOut,
  guests,
  payMethod,
  total,
  onRestart,
}: {
  bookings: Booking[];
  cartLines: CartLine[];
  checkIn: string;
  checkOut: string;
  guests: number;
  payMethod: PayMethod;
  total: number;
  onRestart: () => void;
}) {
  const roomSummary = cartLines.map((l) => `${l.qty}× ${l.name}`).join(", ");
  const roomCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const paid = bookings.every((b) => b.status === "confirmed");
  const paymentValue =
    payMethod === "razorpay"
      ? paid
        ? "Paid via Razorpay"
        : "Pending — pay online"
      : "Pay at hotel · Reserved";

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-gold text-obsidian">
        <Check className="size-8" />
      </div>
      <h2 className="mt-6 font-display text-3xl font-semibold text-obsidian">Booking confirmed</h2>
      <p className="mt-2 text-[13.5px] text-warm-gray">
        A confirmation has been sent to your email &amp; WhatsApp.
      </p>
      <div className="mt-8 overflow-hidden rounded-[6px] border border-gold/15 bg-white text-left">
        <div className="flex items-baseline justify-between bg-obsidian px-5 py-3.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ivory/50">Booking ID</p>
          <p className="font-display text-lg text-gold">{bookings.map((b) => b.id).join(" · ")}</p>
        </div>
        <dl className="flex flex-col gap-2.5 px-5 py-4 text-[13px]">
          <Row label="Rooms" value={roomSummary} />
          <Row label="Dates" value={`${checkIn} → ${checkOut}`} />
          <Row
            label="Guests"
            value={`${guests} · ${roomCount} room${roomCount === 1 ? "" : "s"}`}
          />
          <Row
            label="Payment"
            value={paymentValue}
            valueClassName={payMethod === "pay_at_hotel" || paid ? "text-[#3f7a4f]" : undefined}
          />
        </dl>
        <div className="flex items-baseline justify-between border-t border-gold/10 px-5 py-4">
          <span className="text-[13.5px] font-semibold text-obsidian">Total</span>
          <span className="font-display text-xl text-gold">{formatINR(total)}</span>
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-[5px] bg-obsidian px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold transition-opacity hover:opacity-90"
        >
          Download receipt
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-[5px] bg-gold px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90"
        >
          New booking
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-warm-gray">{label}</dt>
      <dd className={`font-semibold ${valueClassName ?? "text-obsidian"}`}>{value}</dd>
    </div>
  );
}
