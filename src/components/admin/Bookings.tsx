import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Download, FileText, LogIn, LogOut, Loader2, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

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
import { adminIssueInvoiceFn } from "@/lib/invoices-data";
import { setBookingPaymentStatusFn, updateBookingStatusFn } from "@/lib/bookings-data";
import { BookingEntryForm } from "@/components/admin/BookingEntryForm";
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
            className="rounded-lg border border-[#eae4d6] bg-white px-3.75 py-3.25"
            style={{ borderLeft: `3px solid ${accent.bar}` }}
          >
            <div className="text-[10px] font-bold uppercase leading-[1.3] tracking-[0.08em] text-[#7a746a]">
              {s.label}
            </div>
            <div
              className="mt-1.75 font-display text-[23px] font-semibold"
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
    <div className="flex flex-wrap items-center gap-1.75">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            className={cn(
              "flex items-center gap-1.75 rounded-full border px-3.25 py-1.5 text-[12px] font-semibold transition-colors",
              on
                ? "border-obsidian bg-obsidian text-ivory"
                : "border-[#eae4d6] bg-white text-warm-gray hover:border-[#d8d0bf]",
            )}
          >
            {t.dot && <span className="size-1.75 rounded-full" style={{ background: t.dot }} />}
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
  "h-auto whitespace-nowrap px-3.5 py-2.25 text-left align-middle text-[10px] font-bold uppercase tracking-[0.14em] text-gold-soft";
const colHead =
  "h-auto whitespace-nowrap px-2 py-2.5 align-middle text-[10px] font-bold uppercase tracking-[0.05em] text-[#a49d8d]";
const cell = "whitespace-nowrap px-2 py-3 align-middle text-[12px]";
const num = "text-right tabular-nums";

/**
 * Pinned columns while the table scrolls sideways to the revenue/collection
 * bands. Left offsets (Sr: 0, Booking ID: 40px, Guest: 184px) are
 * approximated from each column's min-width rather than measured, since the
 * data is fixed-format (Sr is 1-2 digits, `KRC-YYYYMMDD-NNN` is constant
 * width) — close enough for a sticky offset, no ResizeObserver needed.
 *
 * Below `sm` only Guest stays pinned (at left: 0) — pinning all three ate the
 * full width of a phone screen and left no room for anything else. Sr and
 * Booking ID become sticky from `sm` up, at which point Guest's offset shifts
 * to make room for them.
 */
const STICKY_HEAD: Record<"sr" | "id" | "guest", string> = {
  sr: "sm:sticky sm:left-0 sm:z-20 sm:bg-[#faf7ef] min-w-10",
  id: "sm:sticky sm:left-[40px] sm:z-20 sm:bg-[#faf7ef] min-w-36",
  guest: "sticky left-0 sm:left-[184px] z-20 bg-[#faf7ef] min-w-36",
};
const STICKY_CELL: Record<"sr" | "id" | "guest", string> = {
  sr: "sm:sticky sm:left-0 sm:z-10 sm:bg-white sm:group-hover:bg-[#faf7ef] min-w-10",
  id: "sm:sticky sm:left-[40px] sm:z-10 sm:bg-white sm:group-hover:bg-[#faf7ef] min-w-36",
  guest: "sticky left-0 sm:left-[184px] z-10 bg-white group-hover:bg-[#faf7ef] min-w-36",
};

function StatusSelect({
  status,
  disabled,
  onChange,
}: {
  status: BookingStatus;
  disabled: boolean;
  onChange: (status: BookingStatus) => void;
}) {
  const { label, color, bg } = STATUS_META[status];
  return (
    <select
      value={status}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as BookingStatus)}
      aria-label={`Status for booking (currently ${label})`}
      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-0 px-2.25 py-0.75 text-[10.5px] font-bold tracking-[0.02em] outline-none disabled:cursor-wait disabled:opacity-60"
      style={{ background: bg, color }}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].label}
        </option>
      ))}
    </select>
  );
}

function BookingRow({ item, sr }: { item: BookingListItem; sr: number }) {
  const { booking: b, guestName } = item;
  const meal: MealPlan = b.mealPlan;
  const [issuing, setIssuing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [pendingInputOpen, setPendingInputOpen] = useState(false);
  const [pendingAmount, setPendingAmount] = useState("");
  const router = useRouter();

  async function openInvoice() {
    setIssuing(true);
    const res = await adminIssueInvoiceFn({ data: { kind: "booking", id: b.id } });
    setIssuing(false);
    if (res.ok) window.open(`/invoice/${res.invoiceNo}`, "_blank", "noopener,noreferrer");
  }

  async function setStatus(status: BookingStatus) {
    setChangingStatus(true);
    const res = await updateBookingStatusFn({ data: { id: b.id, status } });
    setChangingStatus(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${b.id} → ${STATUS_META[status].label}.`);
    await router.invalidate();
  }

  async function markPaid() {
    setChangingStatus(true);
    const res = await setBookingPaymentStatusFn({ data: { id: b.id, status: "confirmed" } });
    setChangingStatus(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${b.id} → Confirmed, balance cleared.`);
    await router.invalidate();
  }

  async function submitPending() {
    const amount = Number(pendingAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a pending amount greater than zero.");
      return;
    }
    setChangingStatus(true);
    const res = await setBookingPaymentStatusFn({
      data: { id: b.id, status: "pending_payment", pendingAmount: amount },
    });
    setChangingStatus(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${b.id} → Pending Payment, balance ${formatINR(amount)}.`);
    setPendingInputOpen(false);
    setPendingAmount("");
    await router.invalidate();
  }

  return (
    <TableRow className="group border-[#f2ede2] hover:bg-[#faf7ef]">
      <TableCell className={cn(cell, STICKY_CELL.sr, "text-[#a49d8d]")}>{sr}</TableCell>
      <TableCell className={cn(cell, STICKY_CELL.id, "text-[11.5px] font-bold")}>{b.id}</TableCell>
      <TableCell className={cn(cell, STICKY_CELL.guest, "font-semibold")}>{guestName}</TableCell>
      <TableCell className={cell}>{b.roomNo ?? "—"}</TableCell>
      <TableCell className={cn(cell, "text-warm-gray")}>{ROOM_TYPE_LABEL[b.roomType]}</TableCell>
      <TableCell className={cn(cell, "text-warm-gray")}>{shortDate(b.checkIn)}</TableCell>
      <TableCell className={cn(cell, "text-warm-gray")}>{shortDate(b.checkOut)}</TableCell>
      <TableCell className={cn(cell, "font-semibold")}>{b.urn}</TableCell>
      <TableCell className={cell}>
        <span
          className="text-[11px] font-semibold"
          style={{ color: DIRECT_SOURCES.has(b.source) ? "#5a8a5a" : "#3a6ea5" }}
        >
          {SOURCE_LABEL[b.source]}
        </span>
      </TableCell>
      <TableCell className={cn(cell, "text-warm-gray")}>{meal}</TableCell>
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
        <StatusSelect status={b.status} disabled={changingStatus} onChange={setStatus} />
      </TableCell>
      <TableCell className={cell}>
        <button
          type="button"
          disabled={issuing}
          onClick={openInvoice}
          className="flex items-center gap-1.25 text-[11px] font-bold uppercase tracking-[0.06em] text-[#3a6ea5] hover:opacity-75 disabled:opacity-50"
        >
          {issuing ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
          Invoice
        </button>
      </TableCell>
      <TableCell className={cell}>
        <div className="flex items-center gap-2.5">
          {(b.status === "confirmed" || b.status === "pending_payment") && (
            <button
              type="button"
              disabled={changingStatus}
              onClick={() => setStatus("checked_in")}
              className="flex items-center gap-1.25 text-[11px] font-bold uppercase tracking-[0.06em] text-[#3a6ea5] hover:opacity-75 disabled:opacity-50"
            >
              <LogIn className="size-3" />
              Check in
            </button>
          )}
          {b.status === "checked_in" && (
            <button
              type="button"
              disabled={changingStatus}
              onClick={() => setStatus("checked_out")}
              className="flex items-center gap-1.25 text-[11px] font-bold uppercase tracking-[0.06em] text-[#7c5cbf] hover:opacity-75 disabled:opacity-50"
            >
              <LogOut className="size-3" />
              Check out
            </button>
          )}
          {b.status === "pending_payment" && (
            <button
              type="button"
              disabled={changingStatus}
              onClick={markPaid}
              className="flex items-center gap-1.25 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5a8a5a] hover:opacity-75 disabled:opacity-50"
            >
              <Wallet className="size-3" />
              Mark paid
            </button>
          )}
          {b.status === "confirmed" &&
            (pendingInputOpen ? (
              <form
                className="flex items-center gap-1.25"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitPending();
                }}
              >
                <input
                  type="number"
                  min="1"
                  step="1"
                  autoFocus
                  disabled={changingStatus}
                  value={pendingAmount}
                  onChange={(e) => setPendingAmount(e.target.value)}
                  placeholder="Balance ₹"
                  className="w-20 rounded border border-[#eae4d6] px-1.5 py-0.5 text-[11px] outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={changingStatus}
                  className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8863f] hover:opacity-75 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={changingStatus}
                  onClick={() => {
                    setPendingInputOpen(false);
                    setPendingAmount("");
                  }}
                  className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a49d8d] hover:opacity-75"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => setPendingInputOpen(true)}
                className="flex items-center gap-1.25 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8863f] hover:opacity-75 disabled:opacity-50"
              >
                <Wallet className="size-3" />
                Mark pending
              </button>
            ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function TotalsRow({ totals }: { totals: BookingsTotals }) {
  return (
    <TableRow className="border-t-2 border-[#eae4d6] bg-[#faf7ef] hover:bg-[#faf7ef]">
      <TableCell
        colSpan={10}
        className="whitespace-nowrap px-2 py-3.25 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#7a746a]"
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
      <TableCell className={cell} />
      <TableCell className={cell} />
    </TableRow>
  );
}

function BookingsTable({ rows, totals }: { rows: BookingListItem[]; totals: BookingsTotals }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#eae4d6] bg-white">
      <Table className="min-w-430 border-separate border-spacing-0">
        <TableHeader>
          {/* group band */}
          <TableRow className="border-0 bg-obsidian hover:bg-obsidian">
            <TableHead colSpan={10} className={bandHead}>
              Booking details
            </TableHead>
            <TableHead colSpan={5} className={cn(bandHead, "border-l border-[#c5a05940]")}>
              Revenue (₹)
            </TableHead>
            <TableHead colSpan={3} className={cn(bandHead, "border-l border-[#c5a05940]")}>
              Collection (₹)
            </TableHead>
            <TableHead colSpan={3} className={cn(bandHead, "border-l border-[#c5a05940]")} />
          </TableRow>
          {/* column heads */}
          <TableRow className="border-b border-[#eae4d6] bg-[#faf7ef] hover:bg-[#faf7ef]">
            <TableHead className={cn(colHead, STICKY_HEAD.sr)}>Sr</TableHead>
            <TableHead className={cn(colHead, STICKY_HEAD.id)}>Booking ID</TableHead>
            <TableHead className={cn(colHead, STICKY_HEAD.guest)}>Guest</TableHead>
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
            <TableHead className={colHead}>Invoice</TableHead>
            <TableHead className={colHead}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={20} className="px-4 py-10 text-center text-[13px] text-[#a49d8d]">
                No bookings match this filter.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((item, i) => <BookingRow key={item.booking.id} item={item} sr={i + 1} />)
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

export function Bookings({
  data,
  openEntryForm = false,
  guestFilter,
}: {
  data: BookingsPageData;
  openEntryForm?: boolean;
  guestFilter?: string;
}) {
  const [active, setActive] = useState<TabKey>("all");
  const [entryOpen, setEntryOpen] = useState(openEntryForm);

  const byStatus = useMemo(
    () => (active === "all" ? data.rows : data.rows.filter((r) => r.booking.status === active)),
    [active, data.rows],
  );

  const visible = useMemo(
    () =>
      guestFilter
        ? byStatus.filter((r) => r.guestName.toLowerCase() === guestFilter.toLowerCase())
        : byStatus,
    [byStatus, guestFilter],
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
    <div className="flex flex-col gap-4.5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">
          {dateLine} · {data.total} reservations this period
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-[#eae4d6] bg-white px-3 py-2 text-[12px] font-semibold text-warm-gray transition-colors hover:border-[#d8d0bf]"
          >
            <Download className="size-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setEntryOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
          >
            <Plus className="size-4" />
            New booking
          </button>
        </div>
      </div>

      <BookingEntryForm open={entryOpen} onOpenChange={setEntryOpen} />

      <SummaryCards summary={data.summary} />

      <StatusTabs
        counts={data.countsByStatus}
        total={data.total}
        active={active}
        onSelect={setActive}
      />

      <BookingsTable rows={visible} totals={totals} />

      <p className="text-[12px] text-[#7a746a]">
        Showing {visible.length} of {data.total} · scroll the table sideways for revenue &amp;
        collection →
      </p>
    </div>
  );
}
