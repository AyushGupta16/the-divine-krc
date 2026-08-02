// Notifications (spec 13) — derived, never stored. See `schema.ts` rule 1:
// the only thing that can't be derived is per-admin read state
// (`notification_reads`, in `notifications-data.ts`); everything else here is
// a pure function of `bookings.ts` data, same as `totalBill` or `tier`.
//
// "booking", "party" and "room" are produced today, each off its own event
// timestamp (`bookings.createdAt`, `party_hall_enquiries.createdAt`,
// `bookings.roomAssignedAt`). "payment" and "checkin" stay unproduced: no
// column records when a payment status or check-in actually changed, and
// which transition is notification-worthy there is its own design question,
// not a rushed extension of this pattern — see the tracked follow-up issue.

import type { Booking, PartyHallEnquiry } from "@/types/booking";
import { ROOM_TYPES } from "@/lib/bookings";

export type NotificationType = "booking" | "payment" | "party" | "room" | "checkin" | "cancel";

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
export type BookingEvent = Pick<
  Booking,
  "id" | "guestId" | "roomType" | "urn" | "createdAt" | "specialRequest"
>;

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
      // Presence-only check — never parse `specialRequest`'s contents for
      // emptiness. The write path collapses "nothing selected" to `undefined`/
      // `NULL` specifically so this flag never has to look inside the JSON.
      title: `New booking — ${guestName.get(b.guestId) ?? "—"}, ${roomTypeName(b.roomType)}${b.specialRequest ? " · has requests" : ""}`,
      subtitle: `${b.urn} night${b.urn === 1 ? "" : "s"} · ${b.id}`,
      timestamp: b.createdAt,
      href: "/admin/bookings",
      read: lastReadAt !== null && b.createdAt <= lastReadAt,
    }));
}

/** Only the fields a "room" notification needs. */
export type RoomAssignmentEvent = Pick<Booking, "id" | "guestId" | "roomNo" | "roomAssignedAt">;

/**
 * One "room" item per assigned booking, newest first. Bookings with no
 * `roomAssignedAt` (predate the column, or were never assigned) produce
 * nothing — there is no event timestamp to derive from.
 */
export function deriveRoomAssignmentNotifications(
  bookings: RoomAssignmentEvent[],
  guestName: Map<string, string>,
  lastReadAt: string | null,
): NotificationItem[] {
  return bookings
    .filter((b): b is RoomAssignmentEvent & { roomAssignedAt: string } => !!b.roomAssignedAt)
    .sort((a, b) => b.roomAssignedAt.localeCompare(a.roomAssignedAt))
    .map((b) => ({
      id: b.id,
      type: "room" as const,
      title: `Room assigned — ${b.roomNo ?? "—"}, ${guestName.get(b.guestId) ?? "—"}`,
      subtitle: b.id,
      timestamp: b.roomAssignedAt,
      href: "/admin/bookings",
      read: lastReadAt !== null && b.roomAssignedAt <= lastReadAt,
    }));
}

/** Only the fields a "party" notification needs. */
export type PartyHallEvent = Pick<PartyHallEnquiry, "id" | "title" | "guests" | "createdAt">;

/**
 * One "party" item per enquiry, newest first. Enquiries with no `createdAt`
 * (seed data, hand-entered rows that predate the guest-facing form) produce
 * nothing — same reasoning as `deriveRoomAssignmentNotifications`.
 */
export function derivePartyHallNotifications(
  enquiries: PartyHallEvent[],
  lastReadAt: string | null,
): NotificationItem[] {
  return enquiries
    .filter((e): e is PartyHallEvent & { createdAt: string } => !!e.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({
      id: e.id,
      type: "party" as const,
      title: `New party hall enquiry — ${e.title}`,
      subtitle: `${e.guests} guests · ${e.id}`,
      timestamp: e.createdAt,
      href: "/admin/party-hall",
      read: lastReadAt !== null && e.createdAt <= lastReadAt,
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
