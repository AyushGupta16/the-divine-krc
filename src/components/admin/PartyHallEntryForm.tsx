import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

import {
  MAX_PARTY_HALL_GUESTS,
  PARTY_HALL_ADD_ONS,
  PARTY_HALL_EVENT_TYPES,
  PARTY_HALL_PACKAGES,
} from "@/lib/bookings";
import { createPartyHallEnquiryAdminFn } from "@/lib/bookings-data";
import type { PartyHallSlot } from "@/types/booking";
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

const SLOT_OPTIONS: { value: PartyHallSlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "full_day", label: "Full day" },
];

const SOURCE_OPTIONS: { value: "phone" | "walk_in"; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "walk_in", label: "Walk-in" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  eventType: PARTY_HALL_EVENT_TYPES[0],
  occasionName: "",
  date: todayIso(),
  slot: "evening" as PartyHallSlot,
  guests: 50,
  package: PARTY_HALL_PACKAGES[0].name,
  addOns: [] as string[],
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  source: "phone" as "phone" | "walk_in",
};

/**
 * The Party Hall screen's manual-entry drawer — front desk recording a
 * walk-in or phoned-in enquiry. Same controlled `Sheet` shape as
 * `BookingEntryForm`, and deliberately makes no assumption about where it's
 * mounted (`open`/`onOpenChange` only) so the nav "+" can reuse it later.
 * Unlike the guest form, past dates are allowed (a walk-in already happened)
 * and `source` is a required field, never the guest form's implicit
 * "direct".
 */
export function PartyHallEntryForm({
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
    const res = await createPartyHallEnquiryAdminFn({
      data: {
        eventType: form.eventType,
        occasionName: form.occasionName,
        date: form.date,
        slot: form.slot,
        guests: form.guests,
        package: form.package,
        addOns: form.addOns,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        source: form.source,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(`Enquiry ${res.enquiry.id} recorded.`);
    setForm(EMPTY_FORM);
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
          <SheetTitle>New event</SheetTitle>
          <SheetDescription>
            Record a walk-in or phoned-in enquiry — no quote or amount is set here.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={LABEL}>Event type</span>
              <Select value={form.eventType} onValueChange={(v) => set("eventType", v)}>
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_HALL_EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={LABEL} htmlFor="pe-occasion">
                Event title (optional)
              </label>
              <Input
                id="pe-occasion"
                className={FIELD}
                value={form.occasionName}
                onChange={(e) => set("occasionName", e.target.value)}
                placeholder="e.g. Priya & Arjun's Reception"
                maxLength={80}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="pe-date">
                Event date
              </label>
              <Input
                id="pe-date"
                type="date"
                className={FIELD}
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div>
              <span className={LABEL}>Slot</span>
              <Select value={form.slot} onValueChange={(v: PartyHallSlot) => set("slot", v)}>
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="pe-guests">
                Guests (up to {MAX_PARTY_HALL_GUESTS})
              </label>
              <Input
                id="pe-guests"
                type="number"
                min={1}
                max={MAX_PARTY_HALL_GUESTS}
                className={FIELD}
                value={form.guests}
                onChange={(e) => set("guests", Number(e.target.value))}
              />
            </div>
            <div>
              <span className={LABEL}>Package</span>
              <Select value={form.package} onValueChange={(v) => set("package", v)}>
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_HALL_PACKAGES.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name} — {p.capacity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="pe-name">
              Contact name
            </label>
            <Input
              id="pe-name"
              className={FIELD}
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="pe-phone">
                Contact phone
              </label>
              <Input
                id="pe-phone"
                className={FIELD}
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                placeholder="+91 …"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="pe-email">
                Contact email (optional)
              </label>
              <Input
                id="pe-email"
                type="email"
                className={FIELD}
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className={LABEL}>Source</span>
            <Select
              value={form.source}
              onValueChange={(v: "phone" | "walk_in") => set("source", v)}
            >
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
            <label className={LABEL}>Add-ons</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {PARTY_HALL_ADD_ONS.map((tag) => (
                <label
                  key={tag}
                  className="flex cursor-pointer items-center gap-2 text-[13px] text-obsidian"
                >
                  <input
                    type="checkbox"
                    checked={form.addOns.includes(tag)}
                    onChange={(e) =>
                      set(
                        "addOns",
                        e.target.checked
                          ? [...form.addOns, tag]
                          : form.addOns.filter((a) => a !== tag),
                      )
                    }
                    className="accent-gold"
                  />
                  <span>{tag}</span>
                </label>
              ))}
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
            Record enquiry
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
