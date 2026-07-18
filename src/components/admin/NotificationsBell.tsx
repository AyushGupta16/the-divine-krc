import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import type { NotificationsData } from "@/lib/notifications-data";
import { markAllReadFn } from "@/lib/notifications-data";
import type { NotificationType } from "@/lib/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TYPE_META } from "@/components/admin/notification-types";
import { relativeTime } from "@/lib/format";

/** Shared dropdown bell — every admin header. Matches `Notifications Bell.dc.html`. */
export function NotificationsBell({ notifications }: { notifications: NotificationsData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = notifications.unread;
  const recent = notifications.groups.flatMap((g) => g.items).slice(0, 8);

  async function markAll() {
    setBusy(true);
    await markAllReadFn();
    setBusy(false);
    await router.invalidate();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="relative flex size-10 items-center justify-center rounded-[5px] border border-[#eae4d6] bg-white text-warm-gray outline-none transition-colors hover:bg-black/[0.03]"
      >
        <Bell className="size-4.25" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-[#b4553f] px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-93 max-w-[calc(100vw-2rem)] rounded-[10px] border border-[#eae4d6] bg-white p-0 shadow-[0_20px_50px_-16px_rgba(10,10,10,0.35)]"
      >
        <div className="flex items-center gap-2 border-b border-[#f6f2e9] px-4.5 py-3.5">
          <span className="font-display text-base font-semibold text-obsidian">Notifications</span>
          {unread > 0 && (
            <span className="rounded-full bg-[#f7e6e0] px-2 py-px text-[10.5px] font-bold text-[#b4553f]">
              {unread} new
            </span>
          )}
          <button
            type="button"
            disabled={busy || unread === 0}
            onClick={() => void markAll()}
            className="ml-auto cursor-pointer text-[11px] font-semibold text-gold hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>

        <div className="max-h-94 overflow-y-auto">
          {recent.length === 0 && (
            <p className="px-4.5 py-6 text-center text-[12.5px] text-warm-gray">
              Nothing yet — new bookings will show up here.
            </p>
          )}
          {recent.map((n) => {
            const meta = TYPE_META[n.type as NotificationType];
            return (
              <Link
                key={n.id}
                to={n.href}
                className={`flex items-start gap-3 border-b border-[#f6f2e9] px-4.5 py-3.25 last:border-b-0 ${n.read ? "bg-white" : "bg-[#fdfbf5]"}`}
              >
                <span
                  className="flex size-8.5 shrink-0 items-center justify-center rounded-[8px] text-base"
                  style={{ background: meta.iconBg, color: meta.iconColor }}
                >
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-[#22201b]">{n.title}</span>
                  <span className="block text-[11px] text-[#a49d8d]">
                    {relativeTime(n.timestamp)}
                  </span>
                </span>
                {!n.read && <span className="mt-1 size-1.75 shrink-0 rounded-full bg-gold" />}
              </Link>
            );
          })}
        </div>

        <Link
          to="/admin/notifications"
          className="block border-t border-[#eae4d6] bg-[#faf7ef] py-2.75 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-obsidian"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
