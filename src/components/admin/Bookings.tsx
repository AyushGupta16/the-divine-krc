import { useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";

import type {
  BookingListItem,
  BookingSource,
  BookingsPageData,
  BookingsSummaryKey,
  BookingStatus,
  BookingsTotals,
  MealPlan,
  RoomType,
} from "@/types/booking";
import { formatINR } from "@/lib/booking-math";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ── Display maps ──────────────────────────────────────────────────────────

/** Rupee amount, dashed when zero — mirrors the design's empty-cell treatment. */
function inr(n: number): string {
  return n === 0 ? "—" : formatINR(n);
}

/** "2026-07-13" → "13 Jul". */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  deluxe: "Deluxe",
  deluxe_balcony: "Deluxe · Balcony",
};

const SOURCE_LABEL: Record<BookingSource, string> = {
  direct: "Direct",
  walk_in: "Walk-in",
  phone: "Phone",
  booking_com: "Booking.com",
  makemytrip: "MakeMyTrip",
  goibibo: "Goibibo",
  agoda: "Agoda",
  oyo: "OYO",
};

/** Owned channels read green; OTAs read blue. */
const DIRECT_SOURCES = new Set<BookingSource>(["direct", "walk_in", "phone"]);

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

const STATUS_META: Record<BookingStatus, StatusMeta> = {
  confirmed: { label: "Confirmed", color: "#5a8a5a", bg: "#e6efe6" },
  checked_in: { label: "Checked In", color: "#3a6ea5", bg: "#e4eef7" },
  checked_out: { label: "Checked Out", color: "#7c5cbf", bg: "#eee7f7" },
  pending_payment: { label: "Pending Payment", color: "#a8863f", bg: "#f5ecd7" },
  cancelled: { label: "Cancelled", color: "#b4553f", bg: "#f7e6e0" },
  no_show: { label: "No Show", color: "#3a3a3a", bg: "#ececec" },
};

/** Tab order (after the pinned "All" tab). */
const STATUS_ORDER: BookingStatus[] = [
  "confirmed",
  "checked_in",
  "checked_out",
  "pending_payment",
  "cancelled",
  "no_show",
];

/** Per-card accent: left bar + optional value ink. */
const SUMMARY_ACCENT: Record<BookingsSummaryKey, { bar: string; ink?: string }> = {
  checkInsToday: { bar: "#5a8a5a" },
  checkOutsToday: { bar: "#7c5cbf" },
  occupied: { bar: "#c5a059" },
  available: { bar: "#5a8a5a" },
  totalUrn: { bar: "#3a6ea5" },
  roomRevenue: { bar: "#c5a059", ink: "#a8863f" },
  totalCollected: { bar: "#5a8a5a" },
  pendingCollection: { bar: "#b4553f", ink: "#b4553f" },
  otaReceivables: { bar: "#3a6ea5", ink: "#3a6ea5" },
  cancellations: { bar: "#3a3a3a" },
};

// ── Summary cards ─────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: BookingsPageData["summary"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {summary.map((s) => {
        const accent = SUMMARY_ACCENT[s.key];
        return (
          <div
            key={s.key}
            className="rounded-lg border border-[#eae4d6] bg-white px-[15px] py-[13px]"
            style={{ borderLeft: `3px solid ${accent.bar}` }}
          >
            <div className="text-[10px] font-bold uppercase leading-[1.3] tracking-[0.08em] text-[#7a746a]">
              {s.label}
            </div>
            <div
              className="mt-[7px] font-display text-[23px] font-semibold"
              style={accent.ink ? { color: accent.ink } : undefined}
            >
              {s.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Status filter tabs ────────────────────────────────────────────────────

type TabKey = BookingStatus | "all";

function StatusTabs({
  counts,
  total,
  active,
  onSelect,
}: {
  counts: Record<BookingStatus, number>;
  total: number;
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string; count: number; dot?: string }[] = [
    { key: "all", label: "All", count: total },
    ...STATUS_ORDER.map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      count: counts[s],
      dot: STATUS_META[s].color,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-[7px]">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            className={cn(
              "flex items-center gap-[7px] rounded-full border px-[13px] py-[6px] text-[12px] font-semibold transition-colors",
              on
                ? "border-obsidian bg-obsidian text-ivory"
                : "border-[#eae4d6] bg-white text-[#4a4a4a] hover:border-[#d8d0bf]",
            )}
          >
            {t.dot && (
              <span
                className="size-[7px] rounded-full"
                style={{ background: t.dot }}
              />
            )}
            {t.label}
            <span className="text-[11px] font-bold opacity-75">{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────

const bandHead =
  "h-auto whitespace-nowrap px-[14px] py-[9px] text-left align-middle text-[10px] font-bold uppercase tracking-[0.14em] text-[#e8c87a]";
const colHead =
  "h-auto whitespace-nowrap px-2 py-[10px] align-middle text-[10px] font-bold uppercase tracking-[0.05em] text-[#a49d8d]";
const cell = "whitespace-nowrap px-2 py-3 align-middle text-[12px]";
const num = "text-right tabular-nums";

function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, color, bg } = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-[6px] whitespace-nowrap rounded-full px-[9px] py-[3px] text-[10.5px] font-bold tracking-[0.02em]"
      style={{ background: bg, color }}
    >
      <span className="size-[6px] rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function BookingRow({ item, sr }: { item: BookingListItem; sr: number }) {
  const { booking: b, guestName } = item;
  const meal: MealPlan = b.mealPlan;
  return (
    <TableRow className="border-[#f2ede2] hover:bg-[#faf7ef]">
      <TableCell className={cn(cell, "text-[#a49d8d]")}>{sr}</TableCell>
      <TableCell className={cn(cell, "text-[11.5px] font-bold")}>{b.id}</TableCell>
      <TableCell className={cn(cell, "font-semibold")}>{guestName}</TableCell>
      <TableCell className={cell}>{b.roomNo ?? "—"}</TableCell>
      <TableCell className={cn(cell, "text-[#4a4a4a]")}>
        {ROOM_TYPE_LABEL[b.roomType]}
      </TableCell>
      <TableCell className={cn(cell, "text-[#4a4a4a]")}>{shortDate(b.checkIn)}</TableCell>
      <TableCell className={cn(cell, "text-[#4a4a4a]")}>{shortDate(b.checkOut)}</TableCell>
      <TableCell className={cn(cell, "font-semibold")}>{b.urn}</TableCell>
      <TableCell className={cell}>
        <span
          className="text-[11px] font-semibold"
          style={{ color: DIRECT_SOURCES.has(b.source) ? "#5a8a5a" : "#3a6ea5" }}
        >
          {SOURCE_LABEL[b.source]}
        </span>
      </TableCell>
      <TableCell className={cn(cell, "text-[#4a4a4a]")}>{meal}</TableCell>
      <TableCell className={cn(cell, num, "font-semibold")}>{inr(b.revenue.room)}</TableCell>
      <TableCell className={cn(cell, num, "text-[#7a746a]")}>
        {inr(b.revenue.earlyCheckIn)}
      </TableCell>
      <TableCell className={cn(cell, num, "text-[#7a746a]")}>
        {inr(b.revenue.lateCheckOut)}
      </TableCell>
      <TableCell className={cn(cell, num, "text-[#7a746a]")}>{inr(b.revenue.other)}</TableCell>
      <TableCell className={cn(cell, num, "font-display text-[13px] font-bold")}>
        {inr(b.totalBill)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-semibold text-[#5a8a5a]")}>
        {inr(b.collection.paidToHotel)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-semibold text-[#3a6ea5]")}>
        {inr(b.collection.otaCollection)}
      </TableCell>
      <TableCell
        className={cn(cell, num, "font-bold")}
        style={{ color: b.collection.pending > 0 ? "#b4553f" : "#c3bcae" }}
      >
        {inr(b.collection.pending)}
      </TableCell>
      <TableCell className={cell}>
        <StatusBadge status={b.status} />
      </TableCell>
    </TableRow>
  );
}

function TotalsRow({ totals }: { totals: BookingsTotals }) {
  return (
    <TableRow className="border-t-2 border-[#eae4d6] bg-[#faf7ef] hover:bg-[#faf7ef]">
      <TableCell
        colSpan={10}
        className="whitespace-nowrap px-2 py-[13px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#7a746a]"
      >
        Period totals
      </TableCell>
      <TableCell className={cn(cell, num, "font-display text-[13px] font-bold")}>
        {inr(totals.roomRev)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-bold text-[#7a746a]")}>
        {inr(totals.earlyCheckIn)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-bold text-[#7a746a]")}>
        {inr(totals.lateCheckOut)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-bold text-[#7a746a]")}>
        {inr(totals.other)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-display text-[14px] font-bold text-[#a8863f]")}>
        {inr(totals.totalBill)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-bold text-[#5a8a5a]")}>
        {inr(totals.paidToHotel)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-bold text-[#3a6ea5]")}>
        {inr(totals.otaCollection)}
      </TableCell>
      <TableCell className={cn(cell, num, "font-bold text-[#b4553f]")}>
        {inr(totals.pending)}
      </TableCell>
      <TableCell className={cell} />
    </TableRow>
  );
}

function BookingsTable({
  rows,
  totals,
}: {
  rows: BookingListItem[];
  totals: BookingsTotals;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#eae4d6] bg-white">
      <Table className="min-w-[1720px] border-separate border-spacing-0">
        <TableHeader>
          {/* group band */}
          <TableRow className="border-0 bg-obsidian hover:bg-obsidian">
            <TableHead colSpan={10} className={bandHead}>
              Booking details
            </TableHead>
            <TableHead
              colSpan={5}
              className={cn(bandHead, "border-l border-[#c5a05940]")}
            >
              Revenue (₹)
            </TableHead>
            <TableHead
              colSpan={3}
              className={cn(bandHead, "border-l border-[#c5a05940]")}
            >
              Collection (₹)
            </TableHead>
            <TableHead className={cn(bandHead, "border-l border-[#c5a05940]")} />
          </TableRow>
          {/* column heads */}
          <TableRow className="border-b border-[#eae4d6] bg-[#faf7ef] hover:bg-[#faf7ef]">
            <TableHead className={colHead}>Sr</TableHead>
            <TableHead className={colHead}>Booking ID</TableHead>
            <TableHead className={colHead}>Guest</TableHead>
            <TableHead className={colHead}>Room</TableHead>
            <TableHead className={colHead}>Type</TableHead>
            <TableHead className={colHead}>Check-in</TableHead>
            <TableHead className={colHead}>Check-out</TableHead>
            <TableHead className={colHead}>URN</TableHead>
            <TableHead className={colHead}>Source</TableHead>
            <TableHead className={colHead}>Meal</TableHead>
            <TableHead className={cn(colHead, "text-right")}>Room Rev</TableHead>
            <TableHead className={cn(colHead, "text-right")}>Early CI</TableHead>
            <TableHead className={cn(colHead, "text-right")}>Late CO</TableHead>
            <TableHead className={cn(colHead, "text-right")}>Other</TableHead>
            <TableHead className={cn(colHead, "text-right")}>Total Bill</TableHead>
            <TableHead className={cn(colHead, "text-right")}>Paid Hotel</TableHead>
            <TableHead className={cn(colHead, "text-right")}>OTA Coll</TableHead>
            <TableHead className={cn(colHead, "text-right")}>Pending</TableHead>
            <TableHead className={colHead}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={19}
                className="px-4 py-10 text-center text-[13px] text-[#a49d8d]"
              >
                No bookings match this filter.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((item, i) => (
              <BookingRow key={item.booking.id} item={item} sr={i + 1} />
            ))
          )}
        </TableBody>
        {rows.length > 0 && (
          <TableFooter className="bg-transparent">
            <TotalsRow totals={totals} />
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export function Bookings({ data }: { data: BookingsPageData }) {
  const [active, setActive] = useState<TabKey>("all");

  const visible = useMemo(
    () =>
      active === "all"
        ? data.rows
        : data.rows.filter((r) => r.booking.status === active),
    [active, data.rows],
  );

  // Footer totals track the visible rows so they stay honest as tabs filter.
  const totals = useMemo<BookingsTotals>(() => {
    if (active === "all") return data.totals;
    return visible.reduce<BookingsTotals>(
      (acc, { booking: b }) => {
        acc.roomRev += b.revenue.room;
        acc.earlyCheckIn += b.revenue.earlyCheckIn;
        acc.lateCheckOut += b.revenue.lateCheckOut;
        acc.other += b.revenue.other;
        acc.totalBill += b.totalBill;
        acc.paidToHotel += b.collection.paidToHotel;
        acc.otaCollection += b.collection.otaCollection;
        acc.pending += b.collection.pending;
        return acc;
      },
      {
        roomRev: 0,
        earlyCheckIn: 0,
        lateCheckOut: 0,
        other: 0,
        totalBill: 0,
        paidToHotel: 0,
        otaCollection: 0,
        pending: 0,
      },
    );
  }, [active, visible, data.totals]);

  const dateLine = new Date(data.today).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-[18px] p-4 sm:p-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">
          {dateLine} · {data.total} reservations this period
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-[#eae4d6] bg-white px-3 py-2 text-[12px] font-semibold text-[#4a4a4a] transition-colors hover:border-[#d8d0bf]"
          >
            <Download className="size-4" />
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
          >
            <Plus className="size-4" />
            New booking
          </button>
        </div>
      </div>

      <SummaryCards summary={data.summary} />

      <StatusTabs
        counts={data.countsByStatus}
        total={data.total}
        active={active}
        onSelect={setActive}
      />

      <BookingsTable rows={visible} totals={totals} />

      <p className="text-[12px] text-[#7a746a]">
        Showing {visible.length} of {data.total} · scroll the table sideways for
        revenue &amp; collection →
      </p>
    </div>
  );
}
