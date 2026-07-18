import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";

import type { NotificationsData } from "@/lib/notifications-data";
import type { NotificationType } from "@/lib/notifications";
import { markAllReadFn } from "@/lib/notifications-data";
import { TYPE_META } from "@/components/admin/notification-types";
import { relativeTime } from "@/lib/format";

const ALL_TYPES: NotificationType[] = ["booking", "payment", "party", "checkin", "cancel"];
type Filter = "all" | NotificationType;

/** `/admin/notifications` — the full history behind the header bell. */
export function Notifications({ data }: { data: NotificationsData }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);

  const allItems = data.groups.flatMap((g) => g.items);
  const countByType = new Map<NotificationType, number>(
    ALL_TYPES.map((t) => [t, allItems.filter((i) => i.type === t).length]),
  );

  const groups = data.groups
    .map((g) => ({
      ...g,
      items: filter === "all" ? g.items : g.items.filter((i) => i.type === filter),
    }))
    .filter((g) => g.items.length > 0);

  async function markAll() {
    setBusy(true);
    await markAllReadFn();
    setBusy(false);
    await router.invalidate();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-obsidian sm:text-2xl">
            Notifications
          </h1>
          <p className="mt-1 text-[12px] text-[#7a746a]">
            {data.unread} unread · all activity across the property
          </p>
        </div>
        <button
          type="button"
          disabled={busy || data.unread === 0}
          onClick={() => void markAll()}
          className="h-10 cursor-pointer rounded-[5px] border border-[#d9d0bd] bg-white px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a4a4a] transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mark all read
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.75">
        <FilterPill
          active={filter === "all"}
          onClick={() => setFilter("all")}
          count={allItems.length}
        >
          All
        </FilterPill>
        {ALL_TYPES.map((t) => (
          <FilterPill
            key={t}
            active={filter === t}
            onClick={() => setFilter(t)}
            count={countByType.get(t) ?? 0}
            dot={TYPE_META[t].iconColor}
          >
            {TYPE_META[t].label}
          </FilterPill>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="rounded-[8px] border border-[#eae4d6] px-4 py-10 text-center text-[13px] text-warm-gray">
          Nothing here yet.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#a49d8d]">
              {g.label}
            </p>
            <div className="overflow-hidden rounded-[8px] border border-[#eae4d6]">
              {g.items.map((n) => {
                const meta = TYPE_META[n.type];
                return (
                  <div
                    key={n.id}
                    className="flex items-center gap-3 border-b border-[#eae4d6] px-4 py-3.25 transition-colors last:border-b-0 hover:bg-[#faf7ef]"
                  >
                    <span
                      className="flex size-9.5 shrink-0 items-center justify-center rounded-[9px] text-base"
                      style={{ background: meta.iconBg, color: meta.iconColor }}
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-obsidian">{n.title}</span>
                      <span className="block text-[11.5px] text-[#a49d8d]">
                        {meta.label} · {relativeTime(n.timestamp)}
                      </span>
                    </span>
                    {!n.read && <span className="size-2 shrink-0 rounded-full bg-gold" />}
                    <Link
                      to={n.href}
                      className="shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-gold hover:opacity-80"
                    >
                      {meta.cta}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  count,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.75 text-[12px] font-semibold transition-colors ${
        active
          ? "border-[#0a0a0a] bg-[#0a0a0a] text-[#f9f8f3]"
          : "border-[#eae4d6] bg-white text-[#4a4a4a]"
      }`}
    >
      {dot && <span className="size-1.75 rounded-full" style={{ background: dot }} />}
      {children}
      <span className="opacity-70">{count}</span>
    </button>
  );
}
