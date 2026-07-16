import { useState } from "react";
import { Save, Zap } from "lucide-react";

import type {
  ChannelSetting,
  ChargeSetting,
  PropertyProfile,
  RoomTariff,
  SettingsPageData,
  TeamMember,
  ToggleSetting,
} from "@/types/booking";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

function PricingPanel({
  tariffs,
  charges,
  onRate,
  onCharge,
}: {
  tariffs: RoomTariff[];
  charges: ChargeSetting[];
  onRate: (type: string, rate: string) => void;
  onCharge: (key: string, value: string) => void;
}) {
  return (
    <section id="pricing" className={PANEL}>
      <PanelHead
        title="Rooms & pricing"
        note="Base tariffs and extra charges (₹, incl. taxes applied at billing)."
      />
      <div className="flex flex-col gap-3">
        {tariffs.map((t) => (
          <div key={t.type} className={cn(ROW, "flex flex-wrap items-center gap-3.5 px-3.5 py-3")}>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">{t.name}</div>
              <div className="text-[11.5px] text-[#a49d8d]">{t.inventoryLabel}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#7a746a]">₹</span>
              <Input
                className={cn(FIELD, "w-24 text-right font-semibold")}
                value={t.rate}
                aria-label={`${t.name} rate per night`}
                onChange={(e) => onRate(t.type, e.target.value)}
              />
            </div>
            <span className="text-[11px] text-[#a49d8d]">/ night</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {charges.map((c) => (
          <div key={c.key}>
            <label className={LABEL} htmlFor={`charge-${c.key}`}>
              {c.label}
            </label>
            <Input
              id={`charge-${c.key}`}
              className={FIELD}
              value={c.value}
              onChange={(e) => onCharge(c.key, e.target.value)}
            />
          </div>
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
        <button
          type="button"
          className="flex-none rounded-[5px] border border-[#d9d0bd] bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#4a4a4a] transition-colors hover:bg-black/[0.03]"
        >
          Invite
        </button>
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
  const [tariffs, setTariffs] = useState(data.pricing.tariffs);
  const [charges, setCharges] = useState(data.pricing.charges);
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
            tariffs={tariffs}
            charges={charges}
            onRate={(type, rate) =>
              setTariffs(tariffs.map((t) => (t.type === type ? { ...t, rate } : t)))
            }
            onCharge={(key, value) =>
              setCharges(charges.map((c) => (c.key === key ? { ...c, value } : c)))
            }
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
