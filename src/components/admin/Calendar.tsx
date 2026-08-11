import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";

import { shiftCalendarMonth } from "@/lib/bookings";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
  CalendarCell,
  CalendarDay,
  CalendarDayDetails,
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
          <div key={l.band} className="flex items-center gap-1.75 text-[12px] text-warm-gray">
            <span
              className="size-3.5 rounded-[3px]"
              style={{
                background: swatch.bg,
                border: swatch.border ? `1px solid ${swatch.border}` : undefined,
              }}
            />
            {l.label}
          </div>
        );
      })}
      <div className="ml-2 flex items-center gap-1.75 text-[12px] text-warm-gray">
        <span className="relative size-3.5 rounded-[3px] border border-[#d9b8ad] bg-white">
          <span className="absolute right-px top-px size-1.25 rounded-full bg-[#b4553f]" />
        </span>
        Party hall event
      </div>
    </div>
  );
}

// ── Day details card ───────────────────────────────────────────────────────

const MAX_IN_HOUSE_ROWS = 5;

/** "July 30, 2026" — matches the eyebrow's UTC convention used elsewhere in this file. */
function dayEyebrow(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="text-[#4a4a4a]">{label}</span>
      <span className="font-semibold text-[#0a0a0a]">{value}</span>
    </div>
  );
}

function DayDetailsCardContent({
  details,
  onClose,
}: {
  details: CalendarDayDetails;
  onClose: () => void;
}) {
  const shown = details.inHouseGuests.slice(0, MAX_IN_HOUSE_ROWS);
  const extra = details.inHouseGuests.length - shown.length;

  return (
    <div className="w-70 max-w-[calc(100vw-1.5rem)] rounded-lg border border-[#eae4d6] bg-white p-4.5 shadow-[0_12px_32px_rgba(10,10,10,0.16)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a49d8d]">
            {dayEyebrow(details.date)}
          </div>
          <div className="mt-0.5 font-display text-[19px] font-semibold text-[#0a0a0a]">
            {details.pct}% occupied
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-6.5 flex-none items-center justify-center rounded-[5px] border border-[#eae4d6] text-[#7a746a] transition-colors hover:bg-black/3"
        >
          <X className="size-3.5" strokeWidth={2.2} />
        </button>
      </div>

      <div className="mt-3.5 flex flex-col gap-2">
        <StatRow label="Rooms occupied" value={`${details.occupied}/${details.total}`} />
        <StatRow label="Arrivals" value={details.arrivals} />
        <StatRow label="Departures" value={details.departures} />
      </div>

      {details.event && (
        <div className="mt-3 rounded-[5px] bg-[#f7e6e0] px-2 py-1.5 text-[12px] font-semibold text-[#b4553f]">
          ◆ {details.event}
        </div>
      )}

      <div className="mt-3.5 border-t border-[#f2ede2] pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a49d8d]">
          In-house guests
        </div>
        {shown.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-[#a49d8d]">No guests in-house.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.75">
            {shown.map((g) => (
              <div key={g.roomNo} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate text-[#0a0a0a]">{g.guestName}</span>
                <span className="flex-none font-display font-semibold text-[#a8863f]">
                  {g.roomNo}
                </span>
              </div>
            ))}
          </div>
        )}
        {extra > 0 && <p className="mt-1.5 text-[11.5px] text-[#a49d8d]">+{extra} more</p>}
      </div>
    </div>
  );
}

// ── Day cell ────────────────────────────────────────────────────────────────

function DayCell({ day, details }: { day: CalendarDay; details: CalendarDayDetails }) {
  const t = BAND[day.band];
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${day.date} — ${day.pct}% occupied`}
          className={cn(
            "relative min-h-14.5 border-b border-r border-[#f2ede2] px-1.25 py-1.5 text-left transition-colors hover:brightness-[0.98] sm:min-h-26 sm:px-2.25 sm:py-2",
            // Extra bottom clearance so the absolutely-positioned event pill
            // never overlaps the occupancy caption above it — the caption can
            // now run onto a second line (the maintenance note), and the pill's
            // `bottom` offset is anchored to the padding edge regardless of how
            // much padding there is, so only increasing it actually makes room.
            day.event && "pb-6 sm:pb-7",
          )}
          style={{ background: t.cell }}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[15px] font-semibold" style={{ color: t.num }}>
              {day.day}
            </span>
            <span className="hidden text-[10px] font-bold sm:inline" style={{ color: t.pct }}>
              {day.pct}%
            </span>
          </div>

          <div className="mt-2">
            <div className="h-1.25 overflow-hidden rounded-[4px]" style={{ background: t.track }}>
              <div className="h-full" style={{ width: `${day.pct}%`, background: t.bar }} />
            </div>
            <div className="mt-1.25 hidden text-[10px] sm:block" style={{ color: t.occText }}>
              {day.occupied}/{day.total} rooms
              {day.maintenanceRooms > 0 && ` (${day.maintenanceRooms} under maintenance)`}
            </div>
          </div>

          {day.event && (
            <span className="absolute inset-x-1 bottom-1.25 overflow-hidden text-ellipsis whitespace-nowrap rounded-[3px] bg-[#f7e6e0] px-0.75 py-0.5 text-[8px] font-semibold text-[#b4553f] sm:inset-x-2.25 sm:bottom-2 sm:px-1.5 sm:text-[9.5px]">
              ◆ {day.event}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-none bg-transparent p-0 shadow-none"
        align="start"
        sideOffset={6}
        collisionPadding={12}
      >
        <DayDetailsCardContent details={details} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function GridCell({
  cell,
  dayDetails,
}: {
  cell: CalendarCell;
  dayDetails: Record<string, CalendarDayDetails>;
}) {
  if (cell.kind === "blank") {
    return (
      <div className="min-h-14.5 border-b border-r border-[#f2ede2] bg-[#faf9f5] sm:min-h-26" />
    );
  }
  return <DayCell day={cell} details={dayDetails[cell.date]} />;
}

// ── Month nav ───────────────────────────────────────────────────────────────

function MonthNav({ label, year, month }: { label: string; year: number; month: number }) {
  const prev = shiftCalendarMonth(year, month, -1);
  const next = shiftCalendarMonth(year, month, 1);
  return (
    <div className="flex items-center gap-0.5">
      <Link
        to="/admin/calendar"
        search={prev}
        aria-label="Previous month"
        className="flex h-9 w-8.5 items-center justify-center rounded-l-[5px] border border-[#eae4d6] bg-white text-warm-gray transition-colors hover:bg-black/[0.03]"
      >
        <ChevronLeft className="size-3.75" strokeWidth={2.2} />
      </Link>
      <span className="flex h-9 items-center border-y border-[#eae4d6] bg-white px-3.5 font-display text-[15px] font-semibold">
        {label}
      </span>
      <Link
        to="/admin/calendar"
        search={next}
        aria-label="Next month"
        className="flex h-9 w-8.5 items-center justify-center rounded-r-[5px] border border-[#eae4d6] bg-white text-warm-gray transition-colors hover:bg-black/[0.03]"
      >
        <ChevronRight className="size-3.75" strokeWidth={2.2} />
      </Link>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Calendar({
  data,
  year,
  month,
}: {
  data: CalendarPageData;
  year: number;
  month: number;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav label={data.monthLabel} year={year} month={month} />
        <Link
          to="/admin/bookings"
          search={{ new: "1" }}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
        >
          <Plus className="size-4" />
          New booking
        </Link>
      </div>

      <Legend items={data.legend} />

      <div className="overflow-hidden rounded-lg border border-[#eae4d6] bg-white">
        <div className="grid grid-cols-7">
          {data.weekdays.map((d) => (
            <div
              key={d}
              className="border-b border-[#eae4d6] bg-[#faf7ef] py-2.75 text-center text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#a49d8d]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {data.cells.map((cell, i) => (
            <GridCell
              key={cell.kind === "day" ? cell.date : `blank-${i}`}
              cell={cell}
              dayDetails={data.dayDetails}
            />
          ))}
        </div>
      </div>

      <p className="text-[11.5px] text-[#a49d8d]">
        Room occupancy shaded per day (of {data.totalRooms} rooms). Party-hall events flagged in
        terracotta. Click a day to see arrivals, departures &amp; in-house.
      </p>
    </div>
  );
}
