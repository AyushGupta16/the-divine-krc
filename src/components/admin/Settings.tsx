import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronDown, Plus, Save, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import type {
  AddOnRateSetting,
  ChannelSetting,
  GstSetting,
  PartyHallRateSetting,
  PropertyProfile,
  RoomSettingsRow,
  RoomStatus,
  RoomTariff,
  RoomType,
  SettingsPageData,
  TeamMember,
  ToggleSetting,
} from "@/types/booking";
import {
  addRoomFn,
  removeRoomFn,
  updateAddOnSettingsFn,
  updateGstSettingsFn,
  updatePartyHallRateSettingsFn,
  updateRoomDetailsFn,
  updateRoomTypeSettingsFn,
} from "@/lib/bookings-data";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Tokens ──────────────────────────────────────────────────────────────────

const PANEL = "rounded-lg border border-[#eae4d6] bg-white px-6 py-5.5 scroll-mt-4";
const FIELD =
  "h-auto rounded-[5px] border-[#e5ddcb] bg-white px-3 py-2.5 text-[13px] shadow-none " +
  "focus-visible:border-gold focus-visible:ring-0";
const LABEL = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a746a]";
const ROW = "rounded-[7px] border border-[#f0ebe0]";

/** Channel badge colours, in the design's order. */
const CHANNEL_COLOR: Record<string, { bg: string; color: string }> = {
  booking_com: { bg: "#e4eef7", color: "#3a6ea5" },
  makemytrip: { bg: "#f7e6e0", color: "#b4553f" },
  goibibo: { bg: "#e6efe6", color: "#5a8a5a" },
  agoda: { bg: "#eee7f7", color: "#7c5cbf" },
  oyo: { bg: "#f5ecd7", color: "#a8863f" },
};

/** Avatar colours, cycled by position — the team list has no colour of its own. */
const AVATAR_COLORS = [
  { bg: "#f0e7d3", color: "#a8863f" },
  { bg: "#e4eef7", color: "#3a6ea5" },
  { bg: "#e6efe6", color: "#5a8a5a" },
  { bg: "#eee7f7", color: "#7c5cbf" },
];

// ── Shared bits ─────────────────────────────────────────────────────────────

function PanelHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-4.5">
      <div className="font-display text-[17px] font-semibold">{title}</div>
      <div className="mt-1 text-[12px] text-[#a49d8d]">{note}</div>
    </div>
  );
}

function ConnectedChip({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.75 text-[11px] font-bold",
        connected ? "bg-[#e6efe6] text-[#5a8a5a]" : "bg-[#f1f2f3] text-[#a49d8d]",
      )}
    >
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function ToggleRow({
  toggle,
  onChange,
  bordered,
}: {
  toggle: ToggleSetting;
  onChange: (on: boolean) => void;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 px-1 py-3",
        bordered && "border-b border-[#f2ede2] last:border-b-0",
      )}
    >
      <div className="flex-1">
        <div className="text-[13px] font-semibold">{toggle.label}</div>
        <div className="text-[11.5px] text-[#a49d8d]">{toggle.desc}</div>
      </div>
      <Switch
        checked={toggle.on}
        onCheckedChange={onChange}
        aria-label={toggle.label}
        className="h-6 w-10.5 flex-none data-[state=checked]:bg-gold data-[state=unchecked]:bg-[#d9d0c4] [&>span]:size-5 [&>span]:data-[state=checked]:translate-x-4.5"
      />
    </div>
  );
}

// ── Panels ──────────────────────────────────────────────────────────────────

function PropertyPanel({
  property,
  onChange,
}: {
  property: PropertyProfile;
  onChange: (patch: Partial<PropertyProfile>) => void;
}) {
  const fields: { key: keyof PropertyProfile; label: string; wide?: boolean }[] = [
    { key: "name", label: "Property name", wide: true },
    { key: "phone", label: "Contact phone" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "checkInTime", label: "Check-in time" },
    { key: "checkOutTime", label: "Check-out time" },
  ];

  return (
    <section id="property" className={PANEL}>
      <PanelHead
        title="Property profile"
        note="Shown to guests during booking & on confirmations."
      />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={cn(f.wide && "sm:col-span-2")}>
            <label className={LABEL} htmlFor={`prop-${f.key}`}>
              {f.label}
            </label>
            <Input
              id={`prop-${f.key}`}
              className={FIELD}
              value={property[f.key]}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

const STATUS_LABEL: Record<RoomStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

const STATUS_TONE: Record<RoomStatus, string> = {
  available: "#5a8a5a",
  occupied: "#a8863f",
  cleaning: "#3a6ea5",
  maintenance: "#b4553f",
};

const TYPE_LABEL: Record<RoomType, string> = {
  deluxe: "Deluxe",
  deluxe_balcony: "Deluxe · Balcony",
};

/**
 * Every server-fn call on this panel goes through here rather than a bare
 * `await`. #96 QA caught the gap this closes: a duplicate-room number is
 * blocked cleanly by `validateAddRoom` and shows a toast — but if the
 * request throws instead of resolving to a `Result` (a schema mismatch on
 * an unmigrated preview branch, a network blip, anything), an unhandled
 * promise rejection left `busy` stuck and no toast, no error, nothing
 * visible. Every write path in this file now goes through this so a thrown
 * exception is exactly as loud as a normal `{ ok: false }`.
 */
async function runWrite<T extends { ok: boolean; error?: string }>(
  setBusy: (busy: boolean) => void,
  action: () => Promise<T>,
): Promise<T | null> {
  setBusy(true);
  try {
    const res = await action();
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Something went wrong.");
    return res;
  } catch (err) {
    setBusy(false);
    console.error(err);
    toast.error("Something went wrong — please try again.");
    return null;
  }
}

/** One physical room's row: floor edit, live status/guest, and remove,
 *  inside its type's table. Status and Guest are read-only here — both are
 *  derived from the booking ledger (`liveRoomTiles`/`currentOccupant`),
 *  never a stored opinion; this screen's non-goal is editing status
 *  manually, that still only happens from the Rooms screen. No per-room
 *  size field — `size_sqm` (migration 0014) has no slot in the handoff's
 *  room table and stays unused until a design actually calls for it. */
function RoomRow({ room, onChanged }: { room: RoomSettingsRow; onChanged: () => void }) {
  const [floor, setFloor] = useState<"1" | "2">(String(room.floor) as "1" | "2");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => setFloor(String(room.floor) as "1" | "2"), [room.floor]);

  async function saveFloor(nextFloor: "1" | "2") {
    const res = await runWrite(setBusy, () =>
      updateRoomDetailsFn({
        data: { no: room.no, floor: Number(nextFloor) as 1 | 2, type: room.type },
      }),
    );
    if (!res?.ok) return;
    onChanged();
  }

  async function remove() {
    const res = await runWrite(setBusy, () => removeRoomFn({ data: { no: room.no } }));
    setConfirmOpen(false);
    if (!res?.ok) return;
    onChanged();
  }

  return (
    <div className="grid grid-cols-[52px_72px_90px_1fr_28px] items-center gap-2 border-b border-[#f2ede2] py-2 text-[12px] last:border-b-0 sm:grid-cols-[52px_74px_92px_1fr_28px]">
      <span className="font-display text-[14px] font-semibold">{room.no}</span>
      <Select
        value={floor}
        disabled={busy}
        onValueChange={(v: "1" | "2") => {
          setFloor(v);
          void saveFloor(v);
        }}
      >
        <SelectTrigger className={cn(FIELD, "h-8 py-1.5 text-[12px]")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Floor 1</SelectItem>
          <SelectItem value="2">Floor 2</SelectItem>
        </SelectContent>
      </Select>
      <span
        className="flex items-center gap-1.5 font-semibold"
        style={{ color: STATUS_TONE[room.status] }}
      >
        <span
          className="size-1.75 flex-none rounded-full"
          style={{ background: STATUS_TONE[room.status] }}
          aria-hidden
        />
        {STATUS_LABEL[room.status]}
      </span>
      <span className="truncate text-[#8a8578]">{room.occupantName ?? "—"}</span>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
          aria-label={`Remove room ${room.no}`}
          title="Remove room"
          className="flex size-7 flex-none items-center justify-center rounded-md text-[#c7bfae] transition-colors hover:bg-[#f7e6e0] hover:text-[#b4553f] disabled:opacity-50"
        >
          ✕
        </button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove room {room.no}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes room {room.no} from the {TYPE_LABEL[room.type]} floor board. Rooms with
              any booking history can't be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void remove()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Inline "add a room" form scoped to one type — room number and floor
 *  only; the type is implicit from the group it's rendered in, so adding
 *  under Deluxe can't create a Balcony room. */
function AddRoomForm({ type, onAdded }: { type: RoomType; onAdded: () => void }) {
  const [no, setNo] = useState("");
  const [floor, setFloor] = useState<"1" | "2">("1");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!no.trim()) {
      toast.error("Room number is required.");
      return;
    }
    const res = await runWrite(setBusy, () =>
      addRoomFn({ data: { no: no.trim(), floor: Number(floor) as 1 | 2, type } }),
    );
    if (!res?.ok) return;
    setNo("");
    onAdded();
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2.5">
      <div className="flex-1">
        <label className={LABEL} htmlFor={`new-room-no-${type}`}>
          Room no.
        </label>
        <Input
          id={`new-room-no-${type}`}
          className={FIELD}
          value={no}
          disabled={busy}
          placeholder="e.g. 208"
          onChange={(e) => setNo(e.target.value)}
        />
      </div>
      <div>
        <label className={LABEL}>Floor</label>
        <Select value={floor} onValueChange={(v: "1" | "2") => setFloor(v)}>
          <SelectTrigger className={cn(FIELD, "w-24")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Floor 1</SelectItem>
            <SelectItem value="2">Floor 2</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void add()}
        className="flex items-center gap-1.5 rounded-md bg-gold px-3.5 py-2.5 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f] disabled:opacity-50"
      >
        <Plus className="size-3.75" />
        Add to {TYPE_LABEL[type]}
      </button>
    </div>
  );
}

/** One room type's collapsible group: header (name, rate, expand/collapse),
 *  its rooms table, and a scoped add-room form. Session-only expand state —
 *  front-desk usage is "open, edit, done," so nothing here persists across
 *  navigation or reload. */
function RoomTypeGroup({
  tariff,
  rooms,
  defaultOpen,
  onSaved,
}: {
  tariff: RoomTariff;
  rooms: RoomSettingsRow[];
  defaultOpen: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rate, setRate] = useState(String(tariff.pricePerNight));
  const [areaSqm, setAreaSqm] = useState(String(tariff.areaSqm));
  const [busy, setBusy] = useState(false);

  useEffect(() => setRate(String(tariff.pricePerNight)), [tariff.pricePerNight]);
  useEffect(() => setAreaSqm(String(tariff.areaSqm)), [tariff.areaSqm]);

  async function save(nextRate: number, nextArea: number) {
    if (
      !Number.isFinite(nextRate) ||
      nextRate <= 0 ||
      !Number.isFinite(nextArea) ||
      nextArea <= 0
    ) {
      toast.error("Rate and area must be positive numbers.");
      setRate(String(tariff.pricePerNight));
      setAreaSqm(String(tariff.areaSqm));
      return;
    }
    if (nextRate === tariff.pricePerNight && nextArea === tariff.areaSqm) return;
    const res = await runWrite(setBusy, () =>
      updateRoomTypeSettingsFn({
        data: { type: tariff.type, areaSqm: nextArea, pricePerNight: nextRate },
      }),
    );
    if (!res?.ok) return;
    onSaved();
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(ROW, "mb-3 overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-3 bg-[#faf7ef] px-3.5 py-3">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex flex-1 items-center gap-2 text-left">
            <ChevronDown
              className={cn(
                "size-4 flex-none text-[#a49d8d] transition-transform",
                !open && "-rotate-90",
              )}
            />
            <span className="font-display text-[16px] font-semibold">{tariff.name}</span>
            <span className="text-[11.5px] text-[#a49d8d]">{rooms.length} rooms</span>
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#7a746a]">₹</span>
          <Input
            className={cn(FIELD, "w-24 text-right font-semibold")}
            value={rate}
            disabled={busy}
            aria-label={`${tariff.name} rate per night`}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => void save(Number(rate), Number(areaSqm))}
          />
          <span className="text-[11px] text-[#a49d8d]">/ night</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            className={cn(FIELD, "w-16 text-right")}
            value={areaSqm}
            disabled={busy}
            aria-label={`${tariff.name} area`}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setAreaSqm(e.target.value)}
            onBlur={() => void save(Number(rate), Number(areaSqm))}
          />
          <span className="text-[11px] text-[#a49d8d]">m²</span>
        </div>
      </div>
      <CollapsibleContent>
        <div className="px-3.5 pb-3.5 pt-1">
          <div className="grid grid-cols-[52px_72px_90px_1fr_28px] gap-2 border-b border-[#eee7d8] py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#a49d8d] sm:grid-cols-[52px_74px_92px_1fr_28px]">
            <span>Room</span>
            <span>Floor</span>
            <span>Status</span>
            <span>Guest</span>
            <span />
          </div>
          {rooms.map((room) => (
            <RoomRow key={room.no} room={room} onChanged={onSaved} />
          ))}
          <AddRoomForm type={tariff.type} onAdded={onSaved} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A Slice B add-on rate — one blur-to-save rupee field, same round-trip
 *  shape as a tariff's rate field but without the name/area/count that
 *  don't apply here. */
function AddOnRateRow({ rate, onSaved }: { rate: AddOnRateSetting; onSaved: () => void }) {
  const [price, setPrice] = useState(String(rate.price));
  const [busy, setBusy] = useState(false);

  useEffect(() => setPrice(String(rate.price)), [rate.price]);

  async function save() {
    const next = Number(price);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Rate must be zero or more.");
      setPrice(String(rate.price));
      return;
    }
    if (next === rate.price) return;
    const res = await runWrite(setBusy, () =>
      updateAddOnSettingsFn({ data: { key: rate.key, price: next } }),
    );
    if (!res?.ok) {
      setPrice(String(rate.price));
      return;
    }
    onSaved();
  }

  return (
    <div>
      <label className={LABEL} htmlFor={`addon-${rate.key}`}>
        {rate.label}
      </label>
      <Input
        id={`addon-${rate.key}`}
        className={FIELD}
        type="number"
        min="0"
        step="1"
        disabled={busy}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={() => void save()}
      />
    </div>
  );
}

/** A Party Hall rate (Slice 2a) — same blur-to-save shape as `AddOnRateRow`,
 *  but with a `unit`-driven suffix since `phAdvancePct` is a percentage. */
function PartyHallRateRow({ rate, onSaved }: { rate: PartyHallRateSetting; onSaved: () => void }) {
  const [price, setPrice] = useState(String(rate.price));
  const [busy, setBusy] = useState(false);

  useEffect(() => setPrice(String(rate.price)), [rate.price]);

  async function save() {
    const next = Number(price);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Rate must be zero or more.");
      setPrice(String(rate.price));
      return;
    }
    if (next === rate.price) return;
    const res = await runWrite(setBusy, () =>
      updatePartyHallRateSettingsFn({ data: { key: rate.key, price: next } }),
    );
    if (!res?.ok) {
      setPrice(String(rate.price));
      return;
    }
    onSaved();
  }

  return (
    <div>
      <label className={LABEL} htmlFor={`ph-rate-${rate.key}`}>
        {rate.label} ({rate.unit})
      </label>
      <Input
        id={`ph-rate-${rate.key}`}
        className={FIELD}
        type="number"
        min="0"
        step="1"
        disabled={busy}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={() => void save()}
      />
    </div>
  );
}

/** GST's own blur-to-save row (Room Settings redesign, slice C) — was a
 *  read-only `${GST_PCT}%` display; now round-trips through `gstPct` the
 *  same way every other rate on this panel does. */
function GstRateRow({ gst, onSaved }: { gst: GstSetting; onSaved: () => void }) {
  const [pct, setPct] = useState(String(gst.pct));
  const [busy, setBusy] = useState(false);

  useEffect(() => setPct(String(gst.pct)), [gst.pct]);

  async function save() {
    const next = Number(pct);
    if (!Number.isFinite(next) || next <= 0 || next > 100) {
      toast.error("GST rate must be greater than 0 and no more than 100.");
      setPct(String(gst.pct));
      return;
    }
    if (next === gst.pct) return;
    const res = await runWrite(setBusy, () => updateGstSettingsFn({ data: { pct: next } }));
    if (!res?.ok) {
      setPct(String(gst.pct));
      return;
    }
    onSaved();
  }

  return (
    <div>
      <label className={LABEL} htmlFor="charge-gst">
        GST rate (%)
      </label>
      <Input
        id="charge-gst"
        className={FIELD}
        type="number"
        min="0"
        step="1"
        disabled={busy}
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        onBlur={() => void save()}
      />
      <p className="mt-1.25 text-[10.5px] leading-tight text-[#a8863f]">
        Affects all future invoices — confirm with your accountant.
      </p>
    </div>
  );
}

/** The exact addon_settings keys the Extra Charges section's save handlers
 *  write to — verified against `updateAddOnSettingsFn`/
 *  `updatePartyHallRateSettingsFn`/`updateGstSettingsFn` before this panel
 *  was wired, so a case typo here can't silently create a parallel row. */
const EXTRA_CHARGE_KEYS = ["earlyCheckIn", "lateCheckOut", "phAdvancePct", "gstPct"] as const;

function PricingPanel({
  tariffs,
  gst,
  addOnRates,
  partyHallRates,
  rooms,
}: {
  tariffs: RoomTariff[];
  gst: GstSetting;
  addOnRates: AddOnRateSetting[];
  partyHallRates: PartyHallRateSetting[];
  rooms: RoomSettingsRow[];
}) {
  const router = useRouter();
  const refresh = () => void router.invalidate();
  const advance = partyHallRates.find((r) => r.key === "phAdvancePct");

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[Extra Charges] keys the save handlers write to:", EXTRA_CHARGE_KEYS);
    }
  }, []);

  return (
    <section id="pricing" className={PANEL}>
      <PanelHead
        title="Rooms & pricing"
        note="Tariff per type, rooms in an editable table beneath each."
      />
      <div className="flex flex-col gap-3">
        {tariffs.map((t, i) => (
          <RoomTypeGroup
            key={t.type}
            tariff={t}
            rooms={rooms.filter((r) => r.type === t.type)}
            defaultOpen={i === 0}
            onSaved={refresh}
          />
        ))}
      </div>

      <div className="mt-5 border-t border-[#f0ebe0] pt-4">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a746a]">
          Extra charges
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {addOnRates.map((rate) => (
            <AddOnRateRow key={rate.key} rate={rate} onSaved={refresh} />
          ))}
          <GstRateRow gst={gst} onSaved={refresh} />
          {advance && <PartyHallRateRow rate={advance} onSaved={refresh} />}
        </div>
      </div>
    </section>
  );
}

function PartyHallRatesPanel({
  partyHallRates,
  partyHallRatesArePlaceholder,
}: {
  partyHallRates: PartyHallRateSetting[];
  partyHallRatesArePlaceholder: boolean;
}) {
  const router = useRouter();
  const refresh = () => void router.invalidate();

  return (
    <section id="party-hall" className={PANEL}>
      <PanelHead
        title="Party hall rates"
        note="Package bases and add-on rates (Slice 2a) — used to compute a Send Quote amount."
      />
      {partyHallRatesArePlaceholder && (
        <div className="mb-3.5 rounded-md border border-gold-soft/40 bg-[#f5ecd7] px-3 py-2 text-[11.5px] text-[#8a6d1f]">
          Placeholder rates in use — Silver/Gold/Platinum bases and the flat add-ons below are ₹1
          stand-ins until the owner confirms real numbers. A quote sent now will under-charge.
          Catering and the advance percentage are already real.
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {partyHallRates.map((rate) => (
          <PartyHallRateRow key={rate.key} rate={rate} onSaved={refresh} />
        ))}
      </div>
    </section>
  );
}

function ChannelsPanel({ channels }: { channels: ChannelSetting[] }) {
  return (
    <section id="channels" className={PANEL}>
      <PanelHead title="OTA channels" note="Sync availability & reconcile OTA collections." />
      <div className="flex flex-col gap-2.5">
        {channels.map((c) => {
          const tone = CHANNEL_COLOR[c.key] ?? { bg: "#f5ecd7", color: "#a8863f" };
          return (
            <div key={c.key} className={cn(ROW, "flex items-center gap-3.25 px-3.5 py-2.75")}>
              <span
                className="flex size-7.5 flex-none items-center justify-center rounded-md text-[11px] font-bold"
                style={{ background: tone.bg, color: tone.color }}
              >
                {c.abbr}
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-semibold">{c.name}</div>
                <div className="text-[11px] text-[#a49d8d]">
                  {c.commissionPct}% commission
                  {c.bookings > 0 && ` · ${c.bookings} ${c.bookings === 1 ? "stay" : "stays"} sold`}
                </div>
              </div>
              <ConnectedChip connected={c.connected} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamPanel({ team }: { team: TeamMember[] }) {
  return (
    <section id="team" className={PANEL}>
      <div className="mb-4.5 flex items-center gap-3">
        <div className="flex-1">
          <div className="font-display text-[17px] font-semibold">Team & access</div>
          <div className="mt-1 text-[12px] text-[#a49d8d]">
            Who can log in to the admin console.
          </div>
        </div>
        <Link
          to="/admin/settings/invite"
          className="flex-none rounded-[5px] border border-[#d9d0bd] bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#4a4a4a] transition-colors hover:bg-black/[0.03]"
        >
          Invite
        </Link>
      </div>
      <div className="flex flex-col">
        {team.map((m, i) => {
          const tone = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div
              key={m.email}
              className="flex items-center gap-3.25 border-b border-[#f2ede2] px-1 py-2.75 last:border-b-0"
            >
              <div
                className="flex size-9 flex-none items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: tone.bg, color: tone.color }}
              >
                {m.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{m.name}</div>
                <div className="truncate text-[11.5px] text-[#a49d8d]">{m.email}</div>
              </div>
              <span className="flex-none rounded-full border border-[#e5ddcb] px-3 py-0.75 text-[11px] font-semibold text-[#4a4a4a]">
                {m.role}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Settings({ data }: { data: SettingsPageData }) {
  const [property, setProperty] = useState(data.property);
  const [payToggles, setPayToggles] = useState(data.payments.toggles);
  const [notifications, setNotifications] = useState(data.notifications);
  const [active, setActive] = useState(data.sections[0].id);

  const setToggle = (
    list: ToggleSetting[],
    set: (next: ToggleSetting[]) => void,
    key: string,
    on: boolean,
  ) => set(list.map((t) => (t.key === key ? { ...t, on } : t)));

  return (
    <div className="flex flex-col gap-4.5 p-4 sm:p-6.5">
      <div className="flex max-w-[980px] flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">
          Property, pricing, integrations &amp; team
        </p>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-gold px-4 py-2.25 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
        >
          <Save className="size-4" />
          Save changes
        </button>
      </div>

      <div className="grid max-w-[980px] grid-cols-1 items-start gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1.75 overflow-x-auto pb-1 lg:sticky lg:top-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
          {data.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex-none whitespace-nowrap rounded-md px-3.25 py-2.25 text-[13px] transition-colors",
                s.id === active
                  ? "bg-[#f5ecd7] font-bold text-obsidian"
                  : "border border-[#eae4d6] font-medium text-[#7a746a] hover:bg-black/[0.02] lg:border-transparent",
              )}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-4.5">
          <PropertyPanel
            property={property}
            onChange={(patch) => setProperty({ ...property, ...patch })}
          />

          <PricingPanel
            tariffs={data.pricing.tariffs}
            gst={data.pricing.gst}
            addOnRates={data.pricing.addOnRates}
            partyHallRates={data.pricing.partyHallRates}
            rooms={data.pricing.rooms}
          />

          <PartyHallRatesPanel
            partyHallRates={data.pricing.partyHallRates}
            partyHallRatesArePlaceholder={data.pricing.partyHallRatesArePlaceholder}
          />

          <section id="payments" className={PANEL}>
            <PanelHead
              title="Payment integrations"
              note="Online collection & guest payment options."
            />
            <div className={cn(ROW, "mb-3 flex items-center gap-3.5 px-4 py-3.5")}>
              <span className="flex size-9.5 flex-none items-center justify-center rounded-lg bg-obsidian">
                <Zap className="size-5 text-[#e8c87a]" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  {data.payments.gateway.name}
                  <ConnectedChip connected={data.payments.gateway.connected} />
                </div>
                <div className="text-[11.5px] text-[#a49d8d]">
                  {data.payments.gateway.methodsLine}
                </div>
              </div>
              <button
                type="button"
                className="flex-none text-[11px] font-bold uppercase tracking-[0.1em] text-gold hover:text-[#a8863f]"
              >
                Manage
              </button>
            </div>
            {payToggles.map((t) => (
              <ToggleRow
                key={t.key}
                toggle={t}
                onChange={(on) => setToggle(payToggles, setPayToggles, t.key, on)}
              />
            ))}
          </section>

          <ChannelsPanel channels={data.channels} />
          <TeamPanel team={data.team} />

          <section id="notifications" className={PANEL}>
            <PanelHead
              title="Notifications"
              note="Alerts for new bookings, payments & enquiries."
            />
            {notifications.map((t) => (
              <ToggleRow
                key={t.key}
                toggle={t}
                bordered
                onChange={(on) => setToggle(notifications, setNotifications, t.key, on)}
              />
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
