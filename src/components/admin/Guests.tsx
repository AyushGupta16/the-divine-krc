import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import type { GuestListItem, GuestsPageData, GuestStat, GuestTier } from "@/types/booking";
import { formatINR } from "@/lib/booking-math";
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

/** Tier → badge ink/fill and label, per the design's `tier` map. */
const TIER_TOKENS: Record<GuestTier, { label: string; color: string; bg: string }> = {
  gold: { label: "Gold", color: "#a8863f", bg: "#f5ecd7" },
  silver: { label: "Silver", color: "#6b7280", bg: "#eef0f2" },
  new: { label: "New", color: "#5a8a5a", bg: "#e6efe6" },
};

/** Stat key → the accent stripe down its left edge. */
const STAT_ACCENT: Record<GuestStat["key"], string> = {
  total: "#c5a059",
  inHouse: "#5a8a5a",
  repeat: "#7c5cbf",
  topLtv: "#a8863f",
};

const colHead =
  "h-auto whitespace-nowrap px-2 py-2.5 align-middle text-[10px] font-bold uppercase tracking-[0.1em] text-[#a49d8d]";
const cell = "px-2 py-3.5 align-middle text-[12.5px]";

// ── Stat strip ──────────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: GuestStat }) {
  return (
    <div
      className="rounded-lg border border-[#eae4d6] border-l-[3px] bg-white px-4.25 py-3.75"
      style={{ borderLeftColor: STAT_ACCENT[stat.key] }}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7a746a]">
        {stat.label}
      </div>
      <div
        className={cn(
          "mt-1.5 font-display text-[26px] font-semibold",
          stat.key === "topLtv" && "text-[#a8863f]",
        )}
      >
        {stat.value}
      </div>
    </div>
  );
}

// ── Directory row ───────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: GuestTier }) {
  const t = TIER_TOKENS[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.75 text-[11px] font-semibold"
      style={{ background: t.bg, color: t.color }}
    >
      {t.label}
    </span>
  );
}

function GuestRow({ item }: { item: GuestListItem }) {
  const { guest: g } = item;
  return (
    <TableRow className="border-[#f2ede2] hover:bg-[#faf7ef]">
      <TableCell className={cell}>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9.5 flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
            style={{ background: item.avatarBg, color: item.avatarColor }}
          >
            {item.initials}
          </div>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold">{g.name}</div>
            <div className="text-[11px] text-[#a49d8d]">{g.city}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className={cell}>
        <div className="leading-tight">
          <div className="whitespace-nowrap text-[12.5px]">{g.phone}</div>
          <div className="text-[11px] text-[#a49d8d]">{g.email}</div>
        </div>
      </TableCell>
      <TableCell className={cn(cell, "text-[13px] font-semibold tabular-nums")}>
        {g.stays}
      </TableCell>
      <TableCell className={cn(cell, "whitespace-nowrap text-warm-gray")}>
        {item.inHouse ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#5a8a5a]">
            <span className="size-1.5 rounded-full bg-[#5a8a5a]" />
            In-house
          </span>
        ) : (
          item.lastStay
        )}
      </TableCell>
      <TableCell className={cn(cell, "font-display text-[15px] font-semibold tabular-nums")}>
        {formatINR(g.lifetimeValue)}
      </TableCell>
      <TableCell className={cell}>
        <TierBadge tier={g.tier} />
      </TableCell>
      <TableCell className={cn(cell, "text-right")}>
        <Link
          to="/admin/bookings"
          search={{ guest: g.name }}
          className="text-[11px] font-semibold text-gold hover:text-[#a8863f]"
        >
          View &rarr;
        </Link>
      </TableCell>
    </TableRow>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Guests({ data }: { data: GuestsPageData }) {
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">{data.subtitle}</p>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            title="Search name, phone, email"
            className="flex size-10 items-center justify-center rounded-md border border-[#eae4d6] bg-white text-warm-gray transition-colors hover:bg-black/[0.03]"
          >
            <Search className="size-4.25" />
            <span className="sr-only">Search guests</span>
          </button>
          <button
            type="button"
            title="Add guest"
            className="flex size-10 items-center justify-center rounded-md bg-gold text-obsidian transition-colors hover:bg-[#b8933f]"
          >
            <Plus className="size-4.25" strokeWidth={2.4} />
            <span className="sr-only">Add guest</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#eae4d6] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-[#eae4d6] bg-[#faf7ef] hover:bg-[#faf7ef]">
              <TableHead className={cn(colHead, "px-5")}>Guest</TableHead>
              <TableHead className={colHead}>Contact</TableHead>
              <TableHead className={colHead}>Stays</TableHead>
              <TableHead className={colHead}>Last stay</TableHead>
              <TableHead className={colHead}>Lifetime value</TableHead>
              <TableHead className={colHead}>Tier</TableHead>
              <TableHead className={cn(colHead, "px-5")}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.guests.map((item) => (
              <GuestRow key={item.guest.id} item={item} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
