import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statCardVariants = cva("rounded-lg", {
  variants: {
    variant: {
      standard: "border border-[#e8e3d8] bg-[#f9f8f3] p-5",
      hero: "bg-[#1a1a1a] p-6",
    },
  },
  defaultVariants: {
    variant: "standard",
  },
});

const METATONE_COLOR = {
  neutral: "#8a8478",
  positive: "#5a7a5a",
  negative: "#a4463a",
} as const;

export type StatCardMetaTone = keyof typeof METATONE_COLOR;

export interface StatCardProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof statCardVariants> {
  label: string;
  value: string | number;
  meta?: React.ReactNode;
  metaTone?: StatCardMetaTone;
  /** Standard variant only — the design reserves icon chips for ivory cards. */
  icon?: React.ReactNode;
}

/**
 * The single stat-card shape used across every admin summary strip. Exactly
 * one `hero` card belongs on a screen — the one figure an owner reads first.
 */
function StatCard({
  className,
  variant,
  label,
  value,
  meta,
  metaTone = "neutral",
  icon,
  ...props
}: StatCardProps) {
  const hero = variant === "hero";
  return (
    <div className={cn(statCardVariants({ variant }), className)} {...props}>
      {hero && <div className="mb-3 h-px w-8 bg-[#a89060]/60" />}
      <div
        className={cn(
          "flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-wider",
          hero ? "text-[#a89060]" : "text-[#8a8478]",
        )}
      >
        {!hero && icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-3 font-display font-semibold leading-none",
          hero ? "text-4xl text-[#f4d68a]" : "text-3xl text-[#1a1a1a]",
        )}
      >
        <span className="tabular-nums">{value}</span>
      </div>
      {meta && (
        <div
          className={cn("mt-1.75 text-xs", hero && "text-[#c9c3b4]")}
          style={hero ? undefined : { color: METATONE_COLOR[metaTone] }}
        >
          {meta}
        </div>
      )}
    </div>
  );
}

export { StatCard, statCardVariants };
