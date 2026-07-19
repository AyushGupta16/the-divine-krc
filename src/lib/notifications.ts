// Notifications (spec 13) — derived, never stored. See `schema.ts` rule 1:
// the only thing that can't be derived is per-admin read state
// (`notification_reads`, in `notifications-data.ts`); everything else here is
// a pure function of `bookings.ts` data, same as `totalBill` or `tier`.
//
// Only "booking" is ever produced today — it's the one event source that
// exists (spec 19's `createBookingFn`). The other four types are real design
// intent, not placeholders: a later spec that adds a payment or party-hall
// write path adds a producer here, not new UI.

import type { Booking } from "@/types/booking";
import { ROOM_TYPES } from "@/lib/bookings";

export type NotificationType = "booking" | "payment" | "party" | "checkin" | "cancel";

export interface NotificationItem {
  /** The booking id today — stable and already unique, nothing to invent. */
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  /** ISO timestamp, from the source row's `createdAt`. */
  timestamp: string;
  href: string;
  read: boolean;
}

export type NotificationGroupLabel = "Today" | "Yesterday" | "Earlier";

export interface NotificationGroup {
  label: NotificationGroupLabel;
  items: NotificationItem[];
}

function roomTypeName(type: Booking["roomType"]): string {
  return ROOM_TYPES.find((rt) => rt.type === type)?.name ?? type;
}

/** Only the fields a "booking" notification needs — not a full `Booking`. */
export type BookingEvent = Pick<Booking, "id" | "guestId" | "roomType" | "urn" | "createdAt">;

/**
 * One "booking" item per booking, newest first. `lastReadAt === null` means
 * this admin has never read anything, so everything is unread.
 */
export function deriveNotifications(
  bookings: BookingEvent[],
  guestName: Map<string, string>,
  lastReadAt: string | null,
): NotificationItem[] {
  return [...bookings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => ({
      id: b.id,
      type: "booking" as const,
      title: `New booking — ${guestName.get(b.guestId) ?? "—"}, ${roomTypeName(b.roomType)}`,
      subtitle: `${b.urn} night${b.urn === 1 ? "" : "s"} · ${b.id}`,
      timestamp: b.createdAt,
      href: "/admin/bookings",
      read: lastReadAt !== null && b.createdAt <= lastReadAt,
    }));
}

/** Today / Yesterday / Earlier, using the same live-clock convention as `bookings.ts`. */
export function groupByDay(
  items: NotificationItem[],
  today: string = new Date().toISOString().slice(0, 10),
): NotificationGroup[] {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const yesterday = new Date(todayDate.getTime() - 86_400_000).toISOString().slice(0, 10);

  const buckets: Record<NotificationGroupLabel, NotificationItem[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };
  for (const item of items) {
    const day = item.timestamp.slice(0, 10);
    if (day === today) buckets.Today.push(item);
    else if (day === yesterday) buckets.Yesterday.push(item);
    else buckets.Earlier.push(item);
  }

  return (["Today", "Yesterday", "Earlier"] as const)
    .map((label) => ({ label, items: buckets[label] }))
    .filter((g) => g.items.length > 0);
}
