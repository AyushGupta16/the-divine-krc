import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import type {
  PartyHallCalendarCell,
  PartyHallEventItem,
  PartyHallMiniCalendar,
  PartyHallPackage,
  PartyHallPageData,
  PartyHallPill,
  PartyHallStat,
  PartyHallStatus,
} from "@/types/booking";
import { cn } from "@/lib/utils";

// ── Tokens ──────────────────────────────────────────────────────────────────

/** Status → pill ink/fill, per the design's `S` map. */
const STATUS_TOKENS: Record<PartyHallStatus, { color: string; bg: string }> = {
  enquiry: { color: "#a8863f", bg: "#f5ecd7" },
  quote_sent: { color: "#3a6ea5", bg: "#e4eef7" },
  advance_paid: { color: "#5a8a5a", bg: "#e6efe6" },
  confirmed: { color: "#5a8a5a", bg: "#e6efe6" },
  completed: { color: "#6b7280", bg: "#eef0f2" },
  cancelled: { color: "#b4553f", bg: "#f7e6e0" },
};

// ── Stat strip ──────────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: PartyHallStat }) {
  // The next-event value is a date + slot line, so it sets in a smaller size.
  const isLine = stat.key === "nextEvent";
  return (
    <div className="rounded-lg border border-[#eae4d6] bg-white px-4.5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7a746a]">
        {stat.label}
      </div>
      <div
        className={cn(
          "font-display font-semibold",
          isLine ? "mt-2.75 text-[19px]" : "mt-2 text-[32px]",
          stat.key === "advanceCollected" && "text-[#a8863f]",
        )}
      >
        {stat.value}
      </div>
    </div>
  );
}

// ── Event card ──────────────────────────────────────────────────────────────

function StatusPill({ item }: { item: PartyHallEventItem }) {
  const t = STATUS_TOKENS[item.enquiry.status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: t.bg, color: t.color }}
    >
      <span className="size-1.5 rounded-full" style={{ background: t.color }} />
      {item.statusLabel}
    </span>
  );
}

function EventCard({ item }: { item: PartyHallEventItem }) {
  return (
    <div className="rounded-lg border border-[#eae4d6] bg-white px-5 py-4.5 transition-colors hover:border-[#d9cba6]">
      <div className="flex flex-wrap items-start gap-3.5">
        <div className="w-13 flex-none rounded-md border border-[#efe4cc] bg-[#faf7ef] py-2 text-center">
          <div className="font-display text-[20px] font-semibold leading-none">{item.day}</div>
          <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.12em] text-[#a8863f]">
            {item.mon}
          </div>
        </div>

        <div className="flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[15px] font-bold">{item.enquiry.title}</span>
            <StatusPill item={item} />
          </div>
          <div className="mt-1.25 text-[12.5px] text-[#7a746a]">{item.meta}</div>
          <div className="mt-2.75 flex flex-wrap gap-1.75">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#e5ddcb] px-2.5 py-0.5 text-[11px] text-warm-gray"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-2.5 border-t border-[#f2ede2] pt-3 sm:w-auto sm:flex-col sm:items-end sm:border-t-0 sm:pt-0 sm:text-right">
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#a49d8d]">
              {item.amountLabel}
            </div>
            <div className="font-display text-[19px]">{item.amount}</div>
          </div>
          <button
            type="button"
            className={cn(
              "rounded px-4 py-2.25 text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors",
              item.ctaPrimary
                ? "bg-obsidian text-gold-soft hover:bg-[#262626]"
                : "border border-[#d9d0bd] bg-white text-warm-gray hover:bg-black/[0.03]",
            )}
          >
            {item.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Right rail ──────────────────────────────────────────────────────────────

function MiniCalendarCell({ cell }: { cell: PartyHallCalendarCell }) {
  if (cell.kind === "blank") return <div className="aspect-square" />;
  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center rounded-[5px] text-[11.5px]",
        cell.booked ? "bg-gold font-bold text-obsidian" : "font-medium text-warm-gray",
      )}
    >
      {cell.day}
    </div>
  );
}

function AvailabilityCalendar({ calendar }: { calendar: PartyHallMiniCalendar }) {
  return (
    <div className="rounded-lg border border-[#eae4d6] bg-white px-5 py-4.5">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="font-display text-[16px] font-semibold">{calendar.monthLabel}</span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            className="flex size-6 items-center justify-center rounded border border-[#eae4d6] text-[#a49d8d] transition-colors hover:bg-black/[0.03]"
          >
            <ChevronLeft className="size-3" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="flex size-6 items-center justify-center rounded border border-[#eae4d6] text-warm-gray transition-colors hover:bg-black/[0.03]"
          >
            <ChevronRight className="size-3" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-0.75">
        {calendar.weekdays.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="py-0.5 text-center text-[9.5px] font-bold tracking-[0.04em] text-[#b3aa96]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.75">
        {calendar.cells.map((cell, i) => (
          <MiniCalendarCell key={cell.kind === "day" ? cell.date : `blank-${i}`} cell={cell} />
        ))}
      </div>

      <div className="mt-3.5 flex items-center gap-1.75 text-[11px] text-[#7a746a]">
        <span className="size-2.5 rounded-[3px] bg-gold" />
        Booked / confirmed
      </div>
    </div>
  );
}

function PackageReference({
  packages,
  addOnsLine,
}: {
  packages: PartyHallPackage[];
  addOnsLine: string;
}) {
  return (
    <div className="rounded-lg bg-obsidian px-5.5 py-5 text-ivory">
      <div className="mb-3.5 text-[10px] uppercase tracking-[0.22em] text-[#8a8479]">
        Package reference
      </div>
      <div className="flex flex-col gap-3">
        {packages.map((p, i) => (
          <div
            key={p.name}
            className={cn(
              "flex items-baseline justify-between",
              i > 0 && "border-t border-gold/15 pt-3",
            )}
          >
            <span className="text-[13px]">
              {p.name} <span className="text-[11px] text-[#8a8479]">· {p.capacity}</span>
            </span>
            <span className="font-display text-gold-soft">{p.price}</span>
          </div>
        ))}
      </div>
      <div className="mt-3.5 text-[11px] leading-relaxed text-[#8a8479]">{addOnsLine}</div>
    </div>
  );
}

// ── Pills ───────────────────────────────────────────────────────────────────

function FilterPills({ pills }: { pills: PartyHallPill[] }) {
  return (
    <div className="flex flex-wrap gap-1.75">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className={cn(
            "rounded-full px-3 py-1.25 text-[11.5px] font-semibold",
            // "All" is the active filter until the interaction pass wires these up.
            pill.key === "all"
              ? "bg-obsidian text-ivory"
              : "border border-[#eae4d6] bg-white text-warm-gray",
          )}
        >
          {pill.label} {pill.count}
        </span>
      ))}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function PartyHall({ data }: { data: PartyHallPageData }) {
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">{data.subtitle}</p>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
        >
          <Plus className="size-4" />
          New event
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4.5 lg:grid-cols-4">
        {data.stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>

      <div className="grid items-start gap-4.5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-[18px] font-semibold">Enquiries &amp; events</span>
            <FilterPills pills={data.pills} />
          </div>
          {data.events.map((item) => (
            <EventCard key={item.enquiry.id} item={item} />
          ))}
        </div>

        <div className="flex flex-col gap-4.5">
          <AvailabilityCalendar calendar={data.calendar} />
          <PackageReference packages={data.packages} addOnsLine={data.addOnsLine} />
        </div>
      </div>
    </div>
  );
}
