import { useState } from "react";
import { Download } from "lucide-react";

import type {
  MealPlanShare,
  ReportsKpi,
  ReportsPageData,
  ReportsRange,
  RevenueBar,
  RoomTypePerf,
  SourceSlice,
} from "@/types/booking";
import { cn } from "@/lib/utils";

// ── Tokens ──────────────────────────────────────────────────────────────────

/** The two halves of every revenue bar, and the legend beneath them. */
const SERIES = [
  { key: "direct", label: "Direct", color: "#c5a059" },
  { key: "ota", label: "OTA", color: "#0a0a0a" },
] as const;

/** Donut/legend colours, taken in order — the design's four slice colours. */
const SLICE_COLORS = ["#c5a059", "#3a6ea5", "#5a8a5a", "#7c5cbf"];

/** Bar colour per performance row; the hall is the obsidian one. */
const PERF_COLOR: Record<string, string> = {
  deluxe: "#c5a059",
  deluxe_balcony: "#a8863f",
  party_hall: "#0a0a0a",
};

const CARD = "rounded-lg border border-[#eae4d6] bg-white";

// ── KPI row ─────────────────────────────────────────────────────────────────

function KpiCard({ kpi }: { kpi: ReportsKpi }) {
  return (
    <div className={cn(CARD, "px-4.5 py-4")}>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7a746a]">
        {kpi.label}
      </div>
      <div className="mt-1.75 font-display text-[27px] font-semibold tabular-nums">{kpi.value}</div>
      {kpi.delta && (
        <div
          className="mt-0.75 text-[11px] font-semibold"
          style={{ color: kpi.deltaUp ? "#5a8a5a" : "#b4553f" }}
        >
          {kpi.delta}
        </div>
      )}
    </div>
  );
}

// ── Revenue trend ───────────────────────────────────────────────────────────

function RevenueTrend({ bars, rangeLabel }: { bars: RevenueBar[]; rangeLabel: string }) {
  // Bars are scaled against the tallest one, so an empty window doesn't divide
  // by zero — it just draws nothing.
  const max = Math.max(...bars.map((b) => b.total), 0);

  return (
    <div className={cn(CARD, "px-5.5 py-5")}>
      <div className="mb-5 flex items-baseline justify-between">
        <span className="font-display text-[17px] font-semibold">Revenue trend</span>
        <span className="text-[11.5px] text-[#a49d8d]">{rangeLabel}</span>
      </div>

      <div className="flex h-50 items-end gap-3 border-b border-[#efe9db] pb-0.5">
        {bars.map((bar, i) => (
          <div
            key={`${bar.label}-${i}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <div
              className="flex w-full max-w-10 flex-col justify-end transition-[height] duration-300"
              style={{ height: max === 0 ? "0%" : `${(bar.total / max) * 100}%` }}
            >
              {SERIES.map((s) => (
                <div
                  key={s.key}
                  className={cn(s.key === "direct" && "rounded-t-[3px]")}
                  style={{
                    background: s.color,
                    height: bar.total === 0 ? "0%" : `${(bar[s.key] / bar.total) * 100}%`,
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] text-[#a49d8d]">{bar.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex gap-5">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.75 text-[11.5px] text-warm-gray">
            <span className="size-2.75 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Booking sources ─────────────────────────────────────────────────────────

const DONUT_RADIUS = 58;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function SourceDonut({ sources }: { sources: SourceSlice[] }) {
  const lead = sources[0];
  let offset = 0;

  return (
    <div className={cn(CARD, "px-5.5 py-5")}>
      <div className="mb-4 font-display text-[17px] font-semibold">Booking sources</div>

      <div className="mb-4 flex justify-center">
        <div className="relative size-37.5">
          <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
            {sources.map((s, i) => {
              const arc = (s.pct / 100) * DONUT_CIRCUMFERENCE;
              const dash = `${arc} ${DONUT_CIRCUMFERENCE - arc}`;
              const thisOffset = offset;
              offset -= arc;
              return (
                <circle
                  key={s.key}
                  cx="75"
                  cy="75"
                  r={DONUT_RADIUS}
                  fill="none"
                  strokeWidth="18"
                  stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
                  strokeDasharray={dash}
                  strokeDashoffset={thisOffset}
                />
              );
            })}
          </svg>
          {lead && (
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <div className="font-display text-2xl font-semibold">{lead.pct}%</div>
              <div className="text-[10px] text-[#a49d8d]">
                {lead.key === "direct" ? "direct" : "top"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.25">
        {sources.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2.25">
            <span
              className="size-2.5 flex-none rounded-[3px]"
              style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
            />
            <span className="flex-1 text-[12.5px] text-warm-gray">{s.label}</span>
            <span className="text-[12.5px] font-bold tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Room type performance ───────────────────────────────────────────────────

function PerfRow({ row }: { row: RoomTypePerf }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-3">
        <span className="text-[13px] font-semibold">{row.name}</span>
        <span className="whitespace-nowrap text-[12.5px] text-[#7a746a] tabular-nums">
          {row.revenueLabel} · {row.occPct === null ? "—" : `${row.occPct}%`} occ
        </span>
      </div>
      <div className="h-2.25 overflow-hidden rounded-md bg-[#f2ede2]">
        <div
          className="h-full rounded-md transition-[width] duration-300"
          style={{ width: `${row.barPct}%`, background: PERF_COLOR[row.key] ?? "#c5a059" }}
        />
      </div>
    </div>
  );
}

// ── Meal plan mix ───────────────────────────────────────────────────────────

function MealPlanCard({ plans }: { plans: MealPlanShare[] }) {
  return (
    <div className="rounded-lg bg-obsidian px-5.5 py-5 text-ivory">
      <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-[#8a8479]">
        Meal plan mix
      </div>
      <div className="flex flex-col gap-3.25">
        {plans.map((p, i) => (
          <div
            key={p.plan}
            className={cn(
              "flex items-baseline justify-between",
              i > 0 && "border-t border-gold/16 pt-3.25",
            )}
          >
            <span className="text-[13px]">
              {p.plan} <span className="text-[11px] text-[#8a8479]">· {p.note}</span>
            </span>
            <span className="font-display tabular-nums text-[#e8c87a]">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Reports({ data }: { data: ReportsPageData }) {
  const [activeKey, setActiveKey] = useState(data.ranges[1]?.key ?? data.ranges[0].key);
  const range: ReportsRange = data.ranges.find((r) => r.key === activeKey) ?? data.ranges[0];

  return (
    <div className="flex flex-col gap-4.5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">{data.subtitle}</p>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-[#eae4d6]">
            {data.ranges.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setActiveKey(r.key)}
                className={cn(
                  "px-3.75 py-2.25 text-[12px] font-semibold transition-colors",
                  r.key === range.key
                    ? "bg-obsidian text-ivory"
                    : "bg-white text-warm-gray hover:bg-black/[0.03]",
                )}
              >
                {r.switchLabel}
              </button>
            ))}
          </div>
          <button
            type="button"
            title="Export PDF"
            className="flex size-10 flex-none items-center justify-center rounded-md bg-gold text-obsidian transition-colors hover:bg-[#b8933f]"
          >
            <Download className="size-4.25" />
            <span className="sr-only">Export PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {range.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[1fr_360px]">
        <RevenueTrend bars={range.bars} rangeLabel={range.rangeLabel} />
        <SourceDonut sources={range.sources} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[1fr_360px]">
        <div className={cn(CARD, "px-5.5 py-5")}>
          <div className="mb-4 font-display text-[17px] font-semibold">Room type performance</div>
          <div className="flex flex-col gap-4">
            {range.roomTypes.map((row) => (
              <PerfRow key={row.key} row={row} />
            ))}
          </div>
        </div>
        <MealPlanCard plans={range.mealPlans} />
      </div>
    </div>
  );
}
