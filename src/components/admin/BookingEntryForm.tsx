import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

import type { BookingSource, MealPlan, RoomType } from "@/types/booking";
import { createBookingFn } from "@/lib/bookings-data";
import { ROOM_TYPES, ROOM_UNITS } from "@/lib/bookings";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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

const SOURCE_OPTIONS: { value: BookingSource; label: string }[] = [
  { value: "direct", label: "Direct" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "booking_com", label: "Booking.com" },
  { value: "makemytrip", label: "MakeMyTrip" },
  { value: "goibibo", label: "Goibibo" },
  { value: "agoda", label: "Agoda" },
  { value: "oyo", label: "OYO" },
];

const MEAL_PLAN_OPTIONS: { value: MealPlan; label: string }[] = [
  { value: "EP", label: "EP — room only" },
  { value: "CP", label: "CP — breakfast included" },
  { value: "MAP", label: "MAP — breakfast & dinner" },
  { value: "AP", label: "AP — all meals" },
];

const EMPTY_FORM = {
  guestName: "",
  guestPhone: "",
  guestEmail: "",
  guestCity: "",
  roomType: "deluxe" as RoomType,
  roomNo: "unassigned",
  checkIn: "",
  checkOut: "",
  source: "phone" as BookingSource,
  mealPlan: "EP" as MealPlan,
};

/**
 * The manual-entry drawer (spec 19) — the first form in the admin console that
 * writes a booking rather than reading one. Fields match `NewBookingInput`;
 * derived figures (total bill, tier, advance) are never entered here, same as
 * every other read path in `bookings.ts`.
 */
export function BookingEntryForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await createBookingFn({
      data: {
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        guestEmail: form.guestEmail,
        guestCity: form.guestCity,
        roomType: form.roomType,
        roomNo: form.roomNo === "unassigned" ? null : form.roomNo,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        source: form.source,
        mealPlan: form.mealPlan,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(`Booking ${res.booking.id} created.`);
    setForm(EMPTY_FORM);
    onOpenChange(false);
    await router.invalidate();
  }

  const roomOptions = ROOM_UNITS.filter((r) => r.type === form.roomType);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New booking</SheetTitle>
          <SheetDescription>
            Direct, OYO, phone or walk-in — the totals below are computed, not entered.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className={LABEL} htmlFor="be-name">
              Guest name
            </label>
            <Input
              id="be-name"
              className={FIELD}
              value={form.guestName}
              onChange={(e) => set("guestName", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="be-phone">
                Phone
              </label>
              <Input
                id="be-phone"
                className={FIELD}
                value={form.guestPhone}
                onChange={(e) => set("guestPhone", e.target.value)}
                placeholder="+91 …"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="be-email">
                Email
              </label>
              <Input
                id="be-email"
                type="email"
                className={FIELD}
                value={form.guestEmail}
                onChange={(e) => set("guestEmail", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="be-city">
              City
            </label>
            <Input
              id="be-city"
              className={FIELD}
              value={form.guestCity}
              onChange={(e) => set("guestCity", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={LABEL}>Room type</span>
              <Select
                value={form.roomType}
                onValueChange={(v: RoomType) => {
                  set("roomType", v);
                  set("roomNo", "unassigned");
                }}
              >
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((rt) => (
                    <SelectItem key={rt.type} value={rt.type}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className={LABEL}>Room (optional)</span>
              <Select value={form.roomNo} onValueChange={(v) => set("roomNo", v)}>
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {roomOptions.map((r) => (
                    <SelectItem key={r.no} value={r.no}>
                      Room {r.no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="be-checkin">
                Check-in
              </label>
              <Input
                id="be-checkin"
                type="date"
                className={FIELD}
                value={form.checkIn}
                onChange={(e) => set("checkIn", e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="be-checkout">
                Check-out
              </label>
              <Input
                id="be-checkout"
                type="date"
                className={FIELD}
                value={form.checkOut}
                onChange={(e) => set("checkOut", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={LABEL}>Source</span>
              <Select value={form.source} onValueChange={(v: BookingSource) => set("source", v)}>
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className={LABEL}>Meal plan</span>
              <Select value={form.mealPlan} onValueChange={(v: MealPlan) => set("mealPlan", v)}>
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_PLAN_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.25 py-2.5 text-[12.5px] font-medium text-[#b4553f]">
            {error}
          </p>
        )}

        <SheetFooter>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="flex h-[41px] cursor-pointer items-center justify-center gap-2 rounded-[5px] bg-gold px-5.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Create booking
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
