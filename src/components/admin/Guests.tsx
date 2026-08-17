import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Pencil, Plus } from "lucide-react";

import type { Guest, GuestListItem, GuestsPageData, GuestTier } from "@/types/booking";
import { formatINR } from "@/lib/booking-math";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { GuestEntryForm } from "@/components/admin/GuestEntryForm";
import { useEntryForms } from "@/components/admin/entry-forms-context";
import { cn } from "@/lib/utils";

// ── Tokens ──────────────────────────────────────────────────────────────────

/** Tier → badge ink/fill and label, per the design's `tier` map. */
const TIER_TOKENS: Record<GuestTier, { label: string; color: string; bg: string }> = {
  gold: { label: "Gold", color: "#a8863f", bg: "#f5ecd7" },
  silver: { label: "Silver", color: "#6b7280", bg: "#eef0f2" },
  new: { label: "New", color: "#5a8a5a", bg: "#e6efe6" },
};

const colHead =
  "h-auto whitespace-nowrap px-2 py-2.5 align-middle text-[10px] font-bold uppercase tracking-[0.1em] text-[#a49d8d]";
const cell = "px-2 py-3.5 align-middle text-[12.5px]";

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

function GuestRow({ item, onEdit }: { item: GuestListItem; onEdit: (guest: Guest) => void }) {
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
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onEdit(g)}
            aria-label={`Edit ${g.name}`}
            title="Edit guest"
            className="flex size-6.5 items-center justify-center rounded-[5px] text-[#a49d8d] transition-colors hover:bg-black/4 hover:text-obsidian"
          >
            <Pencil className="size-3.5" />
          </button>
          <Link
            to="/admin/bookings"
            search={{ guest: g.name }}
            className="text-[11px] font-semibold text-gold hover:text-[#a8863f]"
          >
            View &rarr;
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Guests({ data }: { data: GuestsPageData }) {
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const { openGuest } = useEntryForms();

  function exportCsv() {
    const csv = toCsv(
      // No client-side filter on this page — the loaded list is the visible
      // list. Only fields already on screen; no new server call, no wider PII.
      data.guests.map(({ guest: g, lastStay, inHouse }) => ({
        name: g.name,
        phone: g.phone,
        email: g.email,
        city: g.city,
        stays: g.stays,
        // Raw number; the helper stringifies it (screen formats via formatINR).
        lifetimeValue: g.lifetimeValue,
        // Human label the tier badge renders (TIER_TOKENS).
        tier: TIER_TOKENS[g.tier].label,
        lastStay,
        inHouse: inHouse ? "Yes" : "No",
      })),
      [
        { key: "name", header: "Name" },
        { key: "phone", header: "Phone" },
        { key: "email", header: "Email" },
        { key: "city", header: "City" },
        { key: "stays", header: "Stays" },
        { key: "lifetimeValue", header: "Lifetime Value" },
        { key: "tier", header: "Tier" },
        { key: "lastStay", header: "Last Stay" },
        { key: "inHouse", header: "In-House" },
      ],
    );
    // GuestsPageData has no date anchor. This Date is filename-cosmetic only —
    // a download label to avoid collisions, never written into the CSV content.
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`guests-${stamp}.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">{data.subtitle}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Export CSV"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-md border border-[#eae4d6] bg-white px-3 py-2 text-[12px] font-semibold text-warm-gray transition-colors hover:border-[#d8d0bf]"
          >
            <Download className="size-4" />
            Export
          </button>
          <button
            type="button"
            onClick={openGuest}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
          >
            <Plus className="size-4" />
            New guest
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.stats.map((stat) => (
          <StatCard key={stat.key} label={stat.label} value={stat.value} />
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
              <GuestRow key={item.guest.id} item={item} onEdit={setEditingGuest} />
            ))}
          </TableBody>
        </Table>
      </div>

      <GuestEntryForm
        mode="edit"
        guest={editingGuest ?? undefined}
        open={editingGuest !== null}
        onOpenChange={(open) => {
          if (!open) setEditingGuest(null);
        }}
      />
    </div>
  );
}
