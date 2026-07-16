import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import type {
  CalendarCell,
  CalendarDay,
  CalendarLegendItem,
  CalendarPageData,
  OccupancyBand,
} from "@/types/booking";

// ── Tokens ──────────────────────────────────────────────────────────────────

/** Per-band cell palette, per the design's `shade()`. */
interface BandTokens {
  cell: string;
  num: string;
  bar: string;
  track: string;
  occText: string;
  pct: string;
}

const BAND: Record<OccupancyBand, BandTokens> = {
  low: {
    cell: "#fff",
    num: "#0a0a0a",
    bar: "#7aa892",
    track: "#efe9db",
    occText: "#7a746a",
    pct: "#5a8a5a",
  },
  medium: {
    cell: "#fff",
    num: "#0a0a0a",
    bar: "#d8b96a",
    track: "#efe9db",
    occText: "#7a746a",
    pct: "#a8863f",
  },
  high: {
    cell: "#fff",
    num: "#0a0a0a",
    bar: "#c5a059",
    track: "#efe9db",
    occText: "#7a746a",
    pct: "#a8863f",
  },
  full: {
    cell: "#0a0a0a",
    num: "#f9f8f3",
    bar: "#c5a059",
    track: "#333",
    occText: "#c9c3b6",
    pct: "#e8c87a",
  },
};

/** Legend swatch fill/border naming each band of the ramp. */
const LEGEND_SWATCH: Record<OccupancyBand, { bg: string; border?: string }> = {
  low: { bg: "#e6efe6", border: "#cfe0cf" },
  medium: { bg: "#f0e7d3" },
  high: { bg: "#c5a059" },
  full: { bg: "#0a0a0a" },
};

// ── Legend ──────────────────────────────────────────────────────────────────

function Legend({ items }: { items: CalendarLegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      {items.map((l) => {
        const swatch = LEGEND_SWATCH[l.band];
        return (
          <div
            key={l.band}
            className="flex items-center gap-[7px] text-[12px] text-[#4a4a4a]"
          >
            <span
              className="size-[14px] rounded-[3px]"
              style={{
                background: swatch.bg,
                border: swatch.border ? `1px solid ${swatch.border}` : undefined,
              }}
            />
            {l.label}
          </div>
        );
      })}
      <div className="ml-2 flex items-center gap-[7px] text-[12px] text-[#4a4a4a]">
        <span className="relative size-[14px] rounded-[3px] border border-[#d9b8ad] bg-white">
          <span className="absolute right-px top-px size-[5px] rounded-full bg-[#b4553f]" />
        </span>
        Party hall event
      </div>
    </div>
  );
}

// ── Day cell ────────────────────────────────────────────────────────────────

function DayCell({ day }: { day: CalendarDay }) {
  const t = BAND[day.band];
  return (
    <button
      type="button"
      aria-label={`${day.date} — ${day.pct}% occupied`}
      className="relative min-h-[58px] border-b border-r border-[#f2ede2] px-[5px] py-[6px] text-left transition-colors hover:brightness-[0.98] sm:min-h-[104px] sm:px-[9px] sm:py-2"
      style={{ background: t.cell }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-display text-[15px] font-semibold"
          style={{ color: t.num }}
        >
          {day.day}
        </span>
        <span
          className="hidden text-[10px] font-bold sm:inline"
          style={{ color: t.pct }}
        >
          {day.pct}%
        </span>
      </div>

      <div className="mt-2">
        <div
          className="h-[5px] overflow-hidden rounded-[4px]"
          style={{ background: t.track }}
        >
          <div
            className="h-full"
            style={{ width: `${day.pct}%`, background: t.bar }}
          />
        </div>
        <div
          className="mt-[5px] hidden text-[10px] sm:block"
          style={{ color: t.occText }}
        >
          {day.occupied}/{day.total} rooms
        </div>
      </div>

      {day.event && (
        <span className="absolute inset-x-1 bottom-[5px] overflow-hidden text-ellipsis whitespace-nowrap rounded-[3px] bg-[#f7e6e0] px-[3px] py-[2px] text-[8px] font-semibold text-[#b4553f] sm:inset-x-[9px] sm:bottom-2 sm:px-[6px] sm:text-[9.5px]">
          ◆ {day.event}
        </span>
      )}
    </button>
  );
}

function GridCell({ cell }: { cell: CalendarCell }) {
  if (cell.kind === "blank") {
    return (
      <div className="min-h-[58px] border-b border-r border-[#f2ede2] bg-[#faf9f5] sm:min-h-[104px]" />
    );
  }
  return <DayCell day={cell} />;
}

// ── Month nav ───────────────────────────────────────────────────────────────

function MonthNav({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Previous month"
        className="flex h-9 w-[34px] items-center justify-center rounded-l-[5px] border border-[#eae4d6] bg-white text-[#4a4a4a] transition-colors hover:bg-black/[0.03]"
      >
        <ChevronLeft className="size-[15px]" strokeWidth={2.2} />
      </button>
      <span className="flex h-9 items-center border-y border-[#eae4d6] bg-white px-[14px] font-display text-[15px] font-semibold">
        {label}
      </span>
      <button
        type="button"
        aria-label="Next month"
        className="flex h-9 w-[34px] items-center justify-center rounded-r-[5px] border border-[#eae4d6] bg-white text-[#4a4a4a] transition-colors hover:bg-black/[0.03]"
      >
        <ChevronRight className="size-[15px]" strokeWidth={2.2} />
      </button>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Calendar({ data }: { data: CalendarPageData }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav label={data.monthLabel} />
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
        >
          <Plus className="size-4" />
          New booking
        </button>
      </div>

      <Legend items={data.legend} />

      <div className="overflow-hidden rounded-lg border border-[#eae4d6] bg-white">
        <div className="grid grid-cols-7">
          {data.weekdays.map((d) => (
            <div
              key={d}
              className="border-b border-[#eae4d6] bg-[#faf7ef] py-[11px] text-center text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#a49d8d]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {data.cells.map((cell, i) => (
            <GridCell key={cell.kind === "day" ? cell.date : `blank-${i}`} cell={cell} />
          ))}
        </div>
      </div>

      <p className="text-[11.5px] text-[#a49d8d]">
        Room occupancy shaded per day (of {data.totalRooms} rooms). Party-hall
        events flagged in terracotta. Click a day to see arrivals, departures
        &amp; in-house.
      </p>
    </div>
  );
}
