import { useState, type ComponentType } from "react";
import { LogIn, LogOut, Globe, TriangleAlert, Check, Sparkles, CreditCard, X } from "lucide-react";

import type {
  ActivityItem,
  ActivityKind,
  ArrivalItem,
  DashboardData,
  Occupancy,
  RevenuePeriod,
} from "@/types/booking";
import { cn } from "@/lib/utils";

/** Card chrome shared by every panel on the dashboard. */
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-[#eae4d6] bg-white p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

// ── Stat cards ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent = "gold",
  valueClassName,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: "gold" | "terracotta";
  valueClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7a746a]">
        <span
          className={cn(
            "flex size-[30px] items-center justify-center rounded-md",
            accent === "gold" ? "bg-[#f0e7d3]" : "bg-[#f2e0dc]",
          )}
        >
          <Icon className={cn("size-4", accent === "gold" ? "text-gold" : "text-[#b4553f]")} />
        </span>
        {label}
      </div>
      <div
        className={cn(
          "mb-[7px] mt-[15px] font-display text-[40px] font-semibold leading-none",
          valueClassName,
        )}
      >
        {value}
      </div>
      <div className="text-[12px] text-[#7a746a]">{children}</div>
    </Card>
  );
}

function StatCards({ data }: { data: DashboardData }) {
  const { checkInsToday, checkOutsToday, expectedArrivals, unassignedRooms } = data;
  return (
    <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
      <StatCard icon={LogIn} label="Check-ins today" value={checkInsToday.total}>
        {checkInsToday.arrived} arrived ·{" "}
        <span className="font-semibold text-[#a8863f]">{checkInsToday.pending} pending</span>
      </StatCard>
      <StatCard icon={LogOut} label="Check-outs today" value={checkOutsToday.total}>
        {checkOutsToday.settled} settled ·{" "}
        <span className="font-semibold text-[#b4553f]">{checkOutsToday.late} late</span>
      </StatCard>
      <StatCard icon={Globe} label="Expected arrivals" value={expectedArrivals.total}>
        Next: <span className="font-semibold text-obsidian">{expectedArrivals.nextTime}</span>,{" "}
        {expectedArrivals.nextLabel}
      </StatCard>
      <StatCard
        icon={TriangleAlert}
        label="Unassigned rooms"
        value={unassignedRooms}
        accent="terracotta"
        valueClassName="text-[#b4553f]"
      >
        Needs allocation <span className="font-semibold text-[#b4553f]">Assign →</span>
      </StatCard>
    </div>
  );
}

// ── Occupancy donut ───────────────────────────────────────────────────────

function LegendRow({
  swatch,
  label,
  value,
  valueClassName,
  className,
}: {
  swatch: string;
  label: string;
  value: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: swatch }} />
      <span className="flex-1 text-[12.5px] text-warm-gray">{label}</span>
      <span className={cn("text-[12.5px] font-bold", valueClassName)}>{value}</span>
    </div>
  );
}

function OccupancyCard({ occupancy }: { occupancy: Occupancy }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = (occupancy.pct / 100) * circumference;

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Occupancy</h2>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#a49d8d]">tonight</span>
      </div>
      <div className="mt-4 flex items-center gap-[22px]">
        <div className="relative size-[132px] shrink-0">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={r} fill="none" stroke="#efe9db" strokeWidth="14" />
            <circle
              cx="66"
              cy="66"
              r={r}
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <div className="font-display text-[32px] font-semibold">{occupancy.pct}%</div>
            <div className="mt-[3px] text-[10.5px] text-[#a49d8d]">
              {occupancy.occupied} / {occupancy.total}
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[11px]">
          <LegendRow
            swatch="var(--color-gold)"
            label="Deluxe"
            value={`${occupancy.deluxe.occupied}/${occupancy.deluxe.total}`}
          />
          <LegendRow
            swatch="#e8c87a"
            label="Deluxe · Balcony"
            value={`${occupancy.deluxeBalcony.occupied}/${occupancy.deluxeBalcony.total}`}
          />
          <LegendRow swatch="#efe9db" label="Vacant" value={String(occupancy.vacant)} />
          <LegendRow
            swatch="#b4553f"
            label="Party hall"
            value={occupancy.partyHall}
            valueClassName="text-[11.5px] font-semibold text-[#b4553f]"
            className="mt-px border-t border-[#efe9db] pt-[9px]"
          />
        </div>
      </div>
    </Card>
  );
}

// ── Revenue chart ─────────────────────────────────────────────────────────

function RevenueCard({ periods }: { periods: RevenuePeriod[] }) {
  const [activeKey, setActiveKey] = useState(periods[0]?.key);
  const period = periods.find((p) => p.key === activeKey) ?? periods[0];
  const max = Math.max(...period.bars.map((b) => b.value));

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Revenue</h2>
          <div className="mt-[3px] text-[11px] tracking-[0.06em] text-[#a49d8d]">
            {period.rangeLabel}
          </div>
        </div>
        <div className="flex flex-1 justify-center">
          <div className="flex rounded-md border border-[#eae4d6] p-0.5">
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setActiveKey(p.key)}
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                  p.key === period.key
                    ? "bg-gold text-obsidian"
                    : "text-[#7a746a] hover:text-obsidian",
                )}
              >
                {p.switchLabel}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="font-display text-[27px] font-semibold leading-none">{period.total}</div>
          <div className="mt-1 text-[11.5px] font-semibold tracking-[0.02em] text-[#5a8a5a]">
            {period.delta}
          </div>
        </div>
      </div>
      <div className="mt-[22px] flex h-[103px] items-end gap-2.5 border-b border-[#efe9db] pb-0.5">
        {period.bars.map((b, i) => (
          <div
            key={`${period.key}-${b.label}-${i}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <div
              className="w-full max-w-[34px] rounded-t-[3px] transition-[height] duration-300"
              style={{
                height: `${(b.value / max) * 100}%`,
                background: b.value === max ? "var(--color-gold)" : "#e2d8bf",
              }}
            />
            <span className="text-[10.5px] text-[#a49d8d]">{b.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Recent activity ───────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<
  ActivityKind,
  { icon: ComponentType<{ className?: string }>; tone: "gold" | "terracotta" }
> = {
  check_in: { icon: Check, tone: "gold" },
  enquiry: { icon: Sparkles, tone: "terracotta" },
  payment: { icon: CreditCard, tone: "gold" },
  cancellation: { icon: X, tone: "terracotta" },
};

/** Renders a title with `*bold*` segments emphasised. */
function RichTitle({ text }: { text: string }) {
  return (
    <>
      {text.split("*").map((part, i) =>
        i % 2 === 1 ? (
          <b key={i} className="font-bold">
            {part}
          </b>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ActivityRow({ item, last }: { item: ActivityItem; last: boolean }) {
  const { icon: Icon, tone } = ACTIVITY_ICON[item.kind];
  return (
    <div className={cn("flex gap-[13px] py-[13px]", !last && "border-b border-[#f2ede2]")}>
      <span
        className={cn(
          "flex size-[34px] shrink-0 items-center justify-center rounded-[7px]",
          tone === "gold" ? "bg-[#f0e7d3]" : "bg-[#f2e0dc]",
        )}
      >
        <Icon className={cn("size-[17px]", tone === "gold" ? "text-gold" : "text-[#b4553f]")} />
      </span>
      <div className="flex-1">
        <div className="text-[13.5px]">
          <RichTitle text={item.title} />
        </div>
        <div className="text-[11.5px] text-[#a49d8d]">{item.meta}</div>
      </div>
    </div>
  );
}

function ActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex shrink-0 items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Recent activity</h2>
        <button
          type="button"
          className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold hover:text-[#a8863f]"
        >
          View all
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {items.map((item, i) => (
          <ActivityRow key={item.id} item={item} last={i === items.length - 1} />
        ))}
      </div>
    </Card>
  );
}

// ── Arrivals queue ────────────────────────────────────────────────────────

function ArrivalRow({ item }: { item: ArrivalItem }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f0e7d3] text-[12.5px] font-bold text-[#a8863f]">
        {item.initials}
      </div>
      <div className="flex-1 leading-[1.25]">
        <div className="text-[13px] font-semibold">
          {item.name}
          {item.extra && <span className="font-normal text-[#a49d8d]"> {item.extra}</span>}
        </div>
        <div className="text-[11.5px] text-[#a49d8d]">
          {item.roomType} · {item.nights} night{item.nights === 1 ? "" : "s"}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[12.5px] font-bold">{item.time}</div>
        <div className={cn("text-[10.5px]", item.assigned ? "text-[#5a8a5a]" : "text-[#b4553f]")}>
          {item.assignment}
        </div>
      </div>
    </div>
  );
}

function ArrivalsCard({ items }: { items: ArrivalItem[] }) {
  return (
    <Card className="flex min-h-0 flex-col lg:w-[580px] lg:shrink-0">
      <div className="mb-3.5 flex shrink-0 items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Arrivals queue</h2>
        <span className="rounded-full bg-[#f2e0dc] px-[9px] py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#b4553f]">
          {items.length} today
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {items.map((item) => (
          <ArrivalRow key={item.id} item={item} />
        ))}
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

// The greeting/date line lives in the shell header (see AdminShell), so the body
// carries only the panels — kept to a single desktop screen with tight gaps.
export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      <StatCards data={data} />
      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <OccupancyCard occupancy={data.occupancy} />
        <RevenueCard periods={data.revenue} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <ActivityCard items={data.activity} />
        <ArrivalsCard items={data.arrivals} />
      </div>
    </div>
  );
}
