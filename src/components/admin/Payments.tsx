import { Link } from "@tanstack/react-router";
import { Download, Plus, Search } from "lucide-react";

import type {
  OtaSettlement,
  PaymentMethod,
  PaymentsKpi,
  PaymentsPageData,
  PaymentsTxnItem,
  TransactionStatus,
} from "@/types/booking";
import { formatINR, formatINRCompact } from "@/lib/booking-math";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ── Tokens ──────────────────────────────────────────────────────────────────

/** Method → disc glyph and colours, per the design's `method` map. */
const METHOD_TOKENS: Record<PaymentMethod, { icon: string; bg: string; color: string }> = {
  upi: { icon: "U", bg: "#eee7f7", color: "#7c5cbf" },
  card: { icon: "C", bg: "#e4eef7", color: "#3a6ea5" },
  net_banking: { icon: "N", bg: "#e6efe6", color: "#5a8a5a" },
  cash: { icon: "₹", bg: "#f5ecd7", color: "#a8863f" },
  ota: { icon: "O", bg: "#f0f0f0", color: "#6b7280" },
};

/** Status → pill ink/fill, per the design's `stMap`. */
const STATUS_TOKENS: Record<TransactionStatus, { bg: string; color: string }> = {
  success: { bg: "#e6efe6", color: "#5a8a5a" },
  pending: { bg: "#f5ecd7", color: "#a8863f" },
  refunded: { bg: "#f7e6e0", color: "#b4553f" },
};

/** KPI key → the accent stripe down its left edge. The lead card is obsidian. */
const KPI_ACCENT: Record<PaymentsKpi["key"], string> = {
  collectedToday: "",
  razorpaySettled: "#5a8a5a",
  otaReceivables: "#3a6ea5",
  pendingFromGuests: "#b4553f",
};

/** KPI key → the ink its figure is set in. */
const KPI_INK: Record<PaymentsKpi["key"], string> = {
  collectedToday: "#e8c87a",
  razorpaySettled: "#0a0a0a",
  otaReceivables: "#3a6ea5",
  pendingFromGuests: "#b4553f",
};

/** Channel disc colours, cycled by row position per the design's OTA list. */
const CHANNEL_TOKENS: { bg: string; color: string }[] = [
  { bg: "#e4eef7", color: "#3a6ea5" },
  { bg: "#f7e6e0", color: "#b4553f" },
  { bg: "#e6efe6", color: "#5a8a5a" },
  { bg: "#eee7f7", color: "#7c5cbf" },
];

const colHead =
  "h-auto whitespace-nowrap px-2 py-2.5 align-middle text-[10px] font-bold uppercase tracking-[0.1em] text-[#a49d8d]";
const cell = "px-2 py-3.25 align-middle text-[12.5px]";

// ── KPI row ─────────────────────────────────────────────────────────────────

function KpiCard({ kpi }: { kpi: PaymentsKpi }) {
  const lead = kpi.key === "collectedToday";
  return (
    <div
      className={cn(
        "rounded-lg px-4.75 py-4.25",
        lead ? "bg-obsidian text-[#f9f8f3]" : "border border-[#eae4d6] border-l-[3px] bg-white",
      )}
      style={lead ? undefined : { borderLeftColor: KPI_ACCENT[kpi.key] }}
    >
      <div
        className={cn(
          "text-[10.5px] font-bold uppercase tracking-[0.1em]",
          lead ? "text-[#8a8479]" : "text-[#7a746a]",
        )}
      >
        {kpi.label}
      </div>
      <div
        className="mt-2 font-display text-[28px] font-semibold tabular-nums"
        style={{ color: KPI_INK[kpi.key] }}
      >
        {kpi.value}
      </div>
      <div className={cn("mt-1 text-[11px]", lead ? "text-[#c9c3b6]" : "text-[#a49d8d]")}>
        {kpi.note}
      </div>
    </div>
  );
}

// ── Transactions ────────────────────────────────────────────────────────────

function TxnRow({ item }: { item: PaymentsTxnItem }) {
  const m = METHOD_TOKENS[item.txn.method];
  const s = STATUS_TOKENS[item.txn.status];
  return (
    <TableRow className="border-[#f2ede2] hover:bg-[#faf7ef]">
      <TableCell className={cn(cell, "px-5")}>
        <div className="leading-tight">
          <div className="text-[12.5px] font-semibold">{item.txn.guestName}</div>
          <div className="text-[11px] text-[#a49d8d]">{item.txn.bookingId}</div>
        </div>
      </TableCell>
      <TableCell className={cn(cell, "hidden sm:table-cell")}>
        <div className="flex items-center gap-2">
          <span
            className="flex size-6.5 flex-none items-center justify-center rounded-md text-[10px] font-bold"
            style={{ background: m.bg, color: m.color }}
          >
            {m.icon}
          </span>
          <span className="whitespace-nowrap text-warm-gray">{item.methodLabel}</span>
        </div>
      </TableCell>
      <TableCell
        className={cn(cell, "text-right font-display text-[13.5px] font-bold tabular-nums")}
        style={{ color: item.txn.amount < 0 ? "#b4553f" : "#0a0a0a" }}
      >
        {item.amount}
      </TableCell>
      <TableCell
        className={cn(cell, "hidden whitespace-nowrap text-[11.5px] text-[#a49d8d] sm:table-cell")}
      >
        {item.time}
      </TableCell>
      <TableCell className={cn(cell, "px-5 text-right")}>
        <span
          className="inline-block whitespace-nowrap rounded-full px-2.25 py-0.75 text-[10.5px] font-bold"
          style={{ background: s.bg, color: s.color }}
        >
          {item.statusLabel}
        </span>
      </TableCell>
    </TableRow>
  );
}

// ── OTA rail ────────────────────────────────────────────────────────────────

function ChannelRow({ item, index }: { item: OtaSettlement; index: number }) {
  const token = CHANNEL_TOKENS[index % CHANNEL_TOKENS.length];
  return (
    <div className="flex items-center gap-2.75">
      <span
        className="flex size-7.5 flex-none items-center justify-center rounded-md text-[11px] font-bold"
        style={{ background: token.bg, color: token.color }}
      >
        {item.abbr}
      </span>
      <div className="flex-1 leading-tight">
        <div className="text-[12.5px] font-semibold">{item.name}</div>
        <div className="text-[10.5px] text-[#a49d8d]">
          {item.count} booking{item.count === 1 ? "" : "s"} · {item.commissionPct}% comm
        </div>
      </div>
      <div className="font-display text-[15px] font-semibold tabular-nums">
        {formatINR(item.amount)}
      </div>
    </div>
  );
}

function RollupLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-[13px] text-[#c9c3b6]">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Payments({ data }: { data: PaymentsPageData }) {
  const { rollup } = data;
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">{data.subtitle}</p>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            title="Search payments"
            className="flex size-10 items-center justify-center rounded-md border border-[#eae4d6] bg-white text-warm-gray transition-colors hover:bg-black/[0.03]"
          >
            <Search className="size-4.25" />
            <span className="sr-only">Search payments</span>
          </button>
          <button
            type="button"
            title="Export"
            className="flex size-10 items-center justify-center rounded-md border border-[#eae4d6] bg-white text-warm-gray transition-colors hover:bg-black/[0.03]"
          >
            <Download className="size-4.25" />
            <span className="sr-only">Export payments</span>
          </button>
          <button
            type="button"
            title="Record payment"
            className="flex size-10 items-center justify-center rounded-md bg-gold text-obsidian transition-colors hover:bg-[#b8933f]"
          >
            <Plus className="size-4.25" strokeWidth={2.4} />
            <span className="sr-only">Record payment</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-lg border border-[#eae4d6] bg-white">
          <div className="flex items-center border-b border-[#eae4d6] px-5 py-3.75">
            <span className="font-display text-[17px] font-semibold">Recent transactions</span>
            <Link
              to="/admin/bookings"
              className="ml-auto text-[11px] font-bold uppercase tracking-[0.14em] text-gold hover:text-[#a8863f]"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#eae4d6] bg-[#faf7ef] hover:bg-[#faf7ef]">
                  <TableHead className={cn(colHead, "px-5")}>Booking / Guest</TableHead>
                  <TableHead className={cn(colHead, "hidden sm:table-cell")}>Method</TableHead>
                  <TableHead className={cn(colHead, "text-right")}>Amount</TableHead>
                  <TableHead className={cn(colHead, "hidden sm:table-cell")}>Time</TableHead>
                  <TableHead className={cn(colHead, "px-5 text-right")}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((item) => (
                  <TxnRow key={item.txn.id} item={item} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-4.5">
          <div className="rounded-lg border border-[#eae4d6] bg-white px-5 py-4.5">
            <div className="mb-3.5 font-display text-[16px] font-semibold">OTA settlements due</div>
            <div className="flex flex-col gap-3.25">
              {data.ota.map((item, i) => (
                <ChannelRow key={item.source} item={item} index={i} />
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-obsidian px-5 py-4.5 text-[#f9f8f3]">
            <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#8a8479]">
              {rollup.label}
            </div>
            <RollupLine label="Gross revenue" value={formatINRCompact(rollup.gross)} />
            <RollupLine label="OTA commission" value={`−${formatINR(rollup.commission)}`} />
            <div className="border-b border-gold/20">
              <RollupLine label="Refunds" value={`−${formatINR(rollup.refunds)}`} />
            </div>
            <div className="flex items-baseline justify-between pt-3.5">
              <span className="text-[11px] uppercase tracking-[0.16em] text-[#8a8479]">Net</span>
              <span className="font-display text-[23px] tabular-nums text-[#e8c87a]">
                {formatINRCompact(rollup.net)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
