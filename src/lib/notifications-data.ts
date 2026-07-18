// Server boundary + row store for notifications (spec 13).
//
// Notification *items* are never stored — `notifications.ts` derives them from
// bookings on every read, per `schema.ts` rule 1. The one thing that can't be
// derived is read state, so `notification_reads` (one row per admin) is the
// only table this module touches. Same in-memory dev fallback as `roster.ts`'s
// `mem()`: built on first use, never at module scope, so a bundler stripping
// handler bodies still can't drag `DATABASE_URL` or a column name into the
// browser through a module-level initialiser.
//
// Reads `bookings`/`guests` directly rather than importing a helper from
// `bookings-data.ts`: that file's contract is "every export is a
// `createServerFn` handler" — a plain exported function there would carry its
// body, and the `fixtures` it reaches, straight into the client bundle
// unstripped. Owning this query here keeps that invariant intact.

import { eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import {
  deriveNotifications,
  groupByDay,
  type BookingEvent,
  type NotificationGroup,
} from "@/lib/notifications";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { getSessionMember } from "@/lib/auth";
import { db, missingDbInProduction } from "@/lib/db";
import * as schema from "@/lib/schema";
import { normalizeEmail, type Result } from "@/lib/team";
import type { RoomType } from "@/types/booking";

let memory: Map<string, string> | undefined;

function mem(): Map<string, string> {
  memory ??= new Map();
  return memory;
}

function noDb(): void {
  if (missingDbInProduction()) {
    throw new Error(
      "DATABASE_URL is not set. The admin console is unavailable until it is. " +
        "(The marketing site does not read the database and is unaffected.)",
    );
  }
}

async function loadBookingEvents(): Promise<{
  bookings: BookingEvent[];
  guestName: Map<string, string>;
}> {
  const conn = db();
  if (!conn) {
    noDb();
    return {
      bookings: fixtures.bookings.map((b) => ({
        id: b.id,
        guestId: b.guestId,
        roomType: b.roomType,
        urn: b.urn,
        createdAt: b.createdAt,
      })),
      guestName: new Map(fixtures.guests.map((g) => [g.id, g.name])),
    };
  }
  const [bookingRows, guestRows] = await Promise.all([
    conn
      .select({
        id: schema.bookings.id,
        guestId: schema.bookings.guestId,
        roomType: schema.bookings.roomType,
        urn: schema.bookings.urn,
        createdAt: schema.bookings.createdAt,
      })
      .from(schema.bookings)
      .orderBy(schema.bookings.id),
    conn.select({ id: schema.guests.id, name: schema.guests.name }).from(schema.guests),
  ]);
  return {
    bookings: bookingRows.map((b) => ({
      ...b,
      roomType: b.roomType as RoomType,
      createdAt: b.createdAt.toISOString(),
    })),
    guestName: new Map(guestRows.map((g) => [g.id, g.name])),
  };
}

async function loadLastReadAt(email: string): Promise<string | null> {
  const key = normalizeEmail(email);
  const conn = db();
  if (!conn) {
    noDb();
    return mem().get(key) ?? null;
  }
  const rows = await conn
    .select({ lastReadAt: schema.notificationReads.lastReadAt })
    .from(schema.notificationReads)
    .where(eq(schema.notificationReads.memberEmail, key));
  return rows[0]?.lastReadAt?.toISOString() ?? null;
}

async function markReadNow(email: string): Promise<void> {
  const key = normalizeEmail(email);
  const now = new Date();
  const conn = db();
  if (!conn) {
    noDb();
    mem().set(key, now.toISOString());
    return;
  }
  await conn
    .insert(schema.notificationReads)
    .values({ memberEmail: key, lastReadAt: now })
    .onConflictDoUpdate({ target: schema.notificationReads.memberEmail, set: { lastReadAt: now } });
}

export interface NotificationsData {
  groups: NotificationGroup[];
  unread: number;
}

async function loadNotificationsData(email: string): Promise<NotificationsData> {
  const [{ bookings, guestName }, lastReadAt] = await Promise.all([
    loadBookingEvents(),
    loadLastReadAt(email),
  ]);
  const items = deriveNotifications(bookings, guestName, lastReadAt);
  return { groups: groupByDay(items), unread: items.filter((i) => !i.read).length };
}

/**
 * Backs both the bell (called from `/admin`'s route loader) and the
 * notifications center (`/admin/notifications`'s own loader). Same function,
 * same fresh read every navigation — that's what keeps them from disagreeing,
 * per the spec's constraint, without a shared cache to keep in sync.
 */
export const notificationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificationsData> => {
    const member = await getSessionMember();
    if (!member) return { groups: [], unread: 0 };
    return loadNotificationsData(member.email);
  },
);

export const markAllReadFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<Result> => {
    const member = await getSessionMember();
    if (!member) return { ok: false, error: "Sign in to mark notifications read." };
    await markReadNow(member.email);
    return { ok: true };
  },
);
