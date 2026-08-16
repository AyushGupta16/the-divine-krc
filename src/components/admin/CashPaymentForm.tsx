import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

import { getOpenBalanceDirectBookingsFn, recordCashPaymentFn } from "@/lib/bookings-data";
import { formatINR } from "@/lib/booking-math";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetEyebrow,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FIELD =
  "h-auto rounded-[5px] border-[#e5ddcb] bg-white px-3.25 py-2.75 text-[13.5px] shadow-none " +
  "placeholder:text-[#b3aa96] focus-visible:border-gold focus-visible:ring-0";
const LABEL = "mb-1.75 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a746a]";

export interface CashPaymentOption {
  bookingId: string;
  guestName: string;
  /** Outstanding balance in rupees — the ceiling this dialog enforces client-side. */
  pending: number;
}

/**
 * The admin console's cash-recording drawer — the Payments screen's "Record
 * payment" button, and (unify slice) Bookings' direct-row "Mark paid". Self-
 * loading: fetches its own open-balance list on every open via
 * `getOpenBalanceDirectBookingsFn`, the same booking scan `getPaymentsPageData`
 * draws `collection.pending` from, so this never carries a second, possibly
 * stale, derivation of what's owed. Re-fetching on each open (rather than once)
 * is what keeps a second consecutive payment in the same sitting looking at a
 * current list instead of the one from before the first payment landed.
 *
 * `pending` shown per option is a UX default/hint, not the source of truth —
 * `recordCashPaymentFn` re-reads the booking's real pending itself, so a stale
 * value on screen can reject but never over-collect.
 */
export function CashPaymentForm({
  open,
  onOpenChange,
  preselectBookingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Row-scoped open (e.g. Bookings' "Mark paid") — preselects this booking
   *  once the fetched list confirms it still has a balance. */
  preselectBookingId?: string;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<CashPaymentOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setOptions(null);
      return;
    }
    setLoading(true);
    setError(null);
    getOpenBalanceDirectBookingsFn()
      .then((list) => {
        setOptions(list);
        const preselected = preselectBookingId
          ? list.find((o) => o.bookingId === preselectBookingId)
          : undefined;
        const initial = preselected ?? list[0];
        setBookingId(initial?.bookingId ?? "");
        setAmount(initial ? String(initial.pending) : "");
      })
      .finally(() => setLoading(false));
    // Only the open transition (and which booking to preselect) should
    // re-trigger the fetch — not every keystroke inside the drawer.
  }, [open, preselectBookingId]);

  const selected = options?.find((o) => o.bookingId === bookingId);

  function selectBooking(id: string) {
    setBookingId(id);
    const opt = options?.find((o) => o.bookingId === id);
    setAmount(opt ? String(opt.pending) : "");
  }

  async function submit() {
    setError(null);
    const value = Number(amount);
    if (!bookingId) {
      setError("Pick a booking.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    const res = await recordCashPaymentFn({ data: { bookingId, amount: value } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(`${bookingId}: ${formatINR(value)} recorded in cash.`);
    onOpenChange(false);
    await router.invalidate();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetEyebrow>Front desk</SheetEyebrow>
          <SheetTitle>Record payment</SheetTitle>
          <SheetDescription>
            Cash collected against a booking's outstanding balance — partial amounts settle down
            from what's owed.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-[#a49d8d]">
            <Loader2 className="size-4 animate-spin" />
            Loading open balances…
          </div>
        ) : options && options.length === 0 ? (
          <p className="rounded-md border border-[#eae4d6] bg-[#faf7ef] px-3.25 py-4 text-center text-[12.5px] text-[#7a746a]">
            No bookings with an outstanding balance.
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div>
              <span className={LABEL}>Booking</span>
              <Select value={bookingId} onValueChange={selectBooking}>
                <SelectTrigger className={FIELD}>
                  <SelectValue placeholder="Select a booking" />
                </SelectTrigger>
                <SelectContent>
                  {(options ?? []).map((o) => (
                    <SelectItem key={o.bookingId} value={o.bookingId}>
                      {o.bookingId} · {o.guestName} — {formatINR(o.pending)} owed
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={LABEL} htmlFor="cp-amount">
                Amount (₹)
              </label>
              <Input
                id="cp-amount"
                type="number"
                min="1"
                step="1"
                max={selected?.pending}
                className={FIELD}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {selected && (
                <p className="mt-1.25 text-[11px] text-[#a49d8d]">
                  Up to {formatINR(selected.pending)} outstanding.
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.25 py-2.5 text-[12.5px] font-medium text-[#b4553f]">
            {error}
          </p>
        )}

        <SheetFooter>
          <button
            type="button"
            disabled={busy || loading || !bookingId}
            onClick={() => void submit()}
            className="flex h-[41px] cursor-pointer items-center justify-center gap-2 rounded-[5px] bg-gold px-5.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Record cash payment
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
