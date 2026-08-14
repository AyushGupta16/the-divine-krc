// The Party Hall's standalone enquiry page (audit Tier 1): same routing
// pattern as `/book` — a dedicated page, not embedded in the homepage
// section. A guest's submission is a request only; it never sets a status
// past "enquiry" or an amount past 0 — quoting/confirming is Tier 2's
// admin-side job (`resolveRequestedService`'s equivalent for Party Hall,
// not yet built).

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Check, Loader2 } from "lucide-react";

import {
  MAX_PARTY_HALL_GUESTS,
  PARTY_HALL_ADD_ONS,
  PARTY_HALL_EVENT_TYPES,
  PARTY_HALL_PACKAGES,
} from "@/lib/bookings";
import { createPartyHallEnquiryFn } from "@/lib/bookings-data";
import type { PartyHallSlot } from "@/types/booking";
import { Nav } from "@/components/home/Nav";
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

const SLOT_OPTIONS: { value: PartyHallSlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "full_day", label: "Full day" },
];

const FIELD =
  "h-auto rounded-[5px] border-[#e5ddcb] bg-white px-3.25 py-2.75 text-[13.5px] shadow-none " +
  "placeholder:text-[#b3aa96] focus-visible:border-gold focus-visible:ring-0";
const LABEL = "mb-1.75 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a746a]";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PartyHallEnquiry() {
  const [eventType, setEventType] = useState(PARTY_HALL_EVENT_TYPES[0]);
  const [otherEventType, setOtherEventType] = useState("");
  const [occasionName, setOccasionName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [dateOpen, setDateOpen] = useState(false);
  const [slot, setSlot] = useState<PartyHallSlot>("evening");
  const [guests, setGuests] = useState(50);
  const [pkg, setPkg] = useState(PARTY_HALL_PACKAGES[0].name);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // "Other" carries no meaning of its own in the admin list — fold the
  // guest's own description in ahead of any separate event title they gave,
  // same "Type — Occasion" composition `createPartyHallEnquiry` builds.
  const composedOccasionName =
    eventType === "Other" && otherEventType.trim()
      ? occasionName.trim()
        ? `${otherEventType.trim()} — ${occasionName.trim()}`
        : otherEventType.trim()
      : occasionName;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await createPartyHallEnquiryFn({
        data: {
          eventType,
          occasionName: composedOccasionName,
          date,
          slot,
          guests,
          package: pkg,
          addOns,
          contactName,
          contactPhone,
          contactEmail,
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <Nav alwaysSolid />
      <div className="mx-auto max-w-2xl px-6 pt-[110px] pb-24 md:px-10">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-gold" />
          <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
            Events & Celebrations
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl text-obsidian md:text-4xl">
          Enquire about your <span className="italic text-gold">event.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-warm-gray">
          Tell us what you need — we&apos;ll confirm availability and pricing. This is a request
          only; nothing is charged here.
        </p>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-sm border border-gold/20 bg-white p-10 text-center shadow-[0_30px_60px_-25px_rgba(10,10,10,0.25)]">
            <span className="flex size-10 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Check className="size-5" />
            </span>
            <p className="font-display text-lg text-obsidian">Enquiry received.</p>
            <p className="text-sm text-warm-gray">
              We&apos;ll reach out on the contact details you shared with availability and a quote.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-sm border border-gold/20 bg-white p-6 shadow-[0_30px_60px_-25px_rgba(10,10,10,0.25)] md:p-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Event type</label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className={`${FIELD} w-full`}>
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

              {eventType === "Other" && (
                <div>
                  <label className={LABEL} htmlFor="ph-other-type">
                    Please specify
                  </label>
                  <Input
                    id="ph-other-type"
                    value={otherEventType}
                    onChange={(e) => setOtherEventType(e.target.value)}
                    placeholder="e.g. Anniversary"
                    maxLength={80}
                    className={FIELD}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="ph-occasion">
                  Event title (optional)
                </label>
                <Input
                  id="ph-occasion"
                  value={occasionName}
                  onChange={(e) => setOccasionName(e.target.value)}
                  placeholder="e.g. Priya & Arjun's Reception"
                  maxLength={80}
                  className={FIELD}
                />
              </div>

              <div>
                <label className={LABEL}>Date</label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`${FIELD} flex w-full items-center justify-between text-left text-obsidian`}
                    >
                      {format(parseISO(date), "d MMM yyyy")}
                      <CalendarIcon className="size-3.5 text-warm-gray" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseISO(date)}
                      disabled={{ before: new Date() }}
                      onSelect={(d) => {
                        if (d) setDate(format(d, "yyyy-MM-dd"));
                        setDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className={LABEL}>Slot</label>
                <Select value={slot} onValueChange={(v) => setSlot(v as PartyHallSlot)}>
                  <SelectTrigger className={`${FIELD} w-full`}>
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

              <div>
                <label className={LABEL} htmlFor="ph-guests">
                  Guests (up to {MAX_PARTY_HALL_GUESTS})
                </label>
                <Input
                  id="ph-guests"
                  type="number"
                  min={1}
                  max={MAX_PARTY_HALL_GUESTS}
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className={FIELD}
                />
              </div>

              <div>
                <label className={LABEL}>Package</label>
                <Select value={pkg} onValueChange={setPkg}>
                  <SelectTrigger className={`${FIELD} w-full`}>
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

              <div>
                <label className={LABEL} htmlFor="ph-name">
                  Your name
                </label>
                <Input
                  id="ph-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className={FIELD}
                />
              </div>

              <div>
                <label className={LABEL} htmlFor="ph-phone">
                  Phone
                </label>
                <Input
                  id="ph-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className={FIELD}
                />
              </div>

              <div>
                <label className={LABEL} htmlFor="ph-email">
                  Email (optional)
                </label>
                <Input
                  id="ph-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={FIELD}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={LABEL}>Add-ons</label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {PARTY_HALL_ADD_ONS.map((tag) => (
                  <label
                    key={tag}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-obsidian"
                  >
                    <input
                      type="checkbox"
                      checked={addOns.includes(tag)}
                      onChange={(e) =>
                        setAddOns(
                          e.target.checked ? [...addOns, tag] : addOns.filter((a) => a !== tag),
                        )
                      }
                      className="accent-gold"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="mt-4 text-[12.5px] text-red-700">{error}</p>}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="inline-flex items-center gap-2 bg-gold text-obsidian text-[11px] uppercase tracking-[0.25em] font-semibold px-7 py-4 hover:bg-gold/90 transition-colors disabled:opacity-60"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Submit Enquiry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
