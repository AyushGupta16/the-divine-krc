// Where the roster and the invites are kept. Server-only.
//
// !! NOTHING CLIENT-REACHABLE MAY IMPORT THIS. !!
//
// It imports `lib/db`, which reads DATABASE_URL, and it is the only module that
// can read a password hash. `lib/team.ts` holds the rules and stays importable
// by anyone; this holds the rows and is importable by `invites.ts`, `auth.ts`
// and `bookings-data.ts` — modules whose every export is a server function.
//
// The in-memory fallback is `vite dev` only, exactly as in `bookings-data.ts`:
// `missingDbInProduction()` means a deployed site with no DATABASE_URL fails
// closed rather than quietly serving a fake roster that anyone could "accept" an
// invite into. Note the local arrays are mutated, so an invite created in dev
// lives as long as the dev server does — which is precisely the cold-start bug
// this module exists to end in production.

import { and, eq, lte } from "drizzle-orm";

import { db, missingDbInProduction } from "@/lib/db";
import * as schema from "@/lib/schema";
import { normalizeEmail, type Invite, type Role, type TeamAccount } from "@/lib/team";
import { invites as seedInvites, team as seedTeam } from "@/lib/__fixtures__/team";

/**
 * The dev-only store. Copies, so a mutation here cannot rewrite the fixtures the
 * tests derive against.
 *
 * Built on first use, never at module scope, and this is not a style choice —
 * it is the #12 bug. `auth.ts` imports this module and is itself reachable from
 * the client (the login page imports `loginFn`), and a bundler must keep
 * module-level initialisers even when it strips the handler bodies around them.
 * A `const memory = { team: seedTeam.map(...) }` up here therefore runs in the
 * browser, drags `__fixtures__/team` in with it, and takes `schema.ts` — column
 * names and all — along for the ride. Verified: it did exactly that, and
 * `check:bundle` failed on `password_hash` in the entry chunk.
 */
let memory: { team: TeamAccount[]; invites: Invite[]; hashes: Map<string, string> } | undefined;

function mem() {
  memory ??= {
    team: seedTeam.map((m) => ({ ...m })),
    invites: seedInvites.map((i) => ({ ...i })),
    hashes: new Map<string, string>(),
  };
  return memory;
}

function noDb(): never | void {
  if (missingDbInProduction()) {
    throw new Error(
      "DATABASE_URL is not set. The admin console is unavailable until it is. " +
        "(The marketing site does not read the database and is unaffected.)",
    );
  }
}

type TeamRow = typeof schema.team.$inferSelect;

/** Rows out, roster in — and the hash is dropped on the way. See `schema.team`. */
function toMember(r: TeamRow): TeamAccount {
  return {
    email: r.email,
    name: r.name,
    role: r.role as Role,
    ...(r.acceptedAt ? { acceptedAt: r.acceptedAt.getTime() } : {}),
  };
}

function toInvite(r: typeof schema.invites.$inferSelect): Invite {
  return {
    email: r.email,
    role: r.role as Role,
    ...(r.message ? { message: r.message } : {}),
    token: r.token,
    createdAt: r.createdAt.getTime(),
    expiresAt: r.expiresAt.getTime(),
  };
}

export async function loadRoster(): Promise<TeamAccount[]> {
  const conn = db();
  if (!conn) {
    noDb();
    return mem().team.map((m) => ({ ...m }));
  }
  // ORDER BY, because Postgres has no row order to inherit — same reason as
  // `bookings-data.ts`. The Settings roster renders in this order.
  const rows = await conn.select().from(schema.team).orderBy(schema.team.email);
  return rows.map(toMember);
}

export async function loadInvites(): Promise<Invite[]> {
  const conn = db();
  if (!conn) {
    noDb();
    return mem().invites.map((i) => ({ ...i }));
  }
  const rows = await conn.select().from(schema.invites).orderBy(schema.invites.email);
  return rows.map(toInvite);
}

export async function findInviteByToken(token: string): Promise<Invite | undefined> {
  const conn = db();
  if (!conn) {
    noDb();
    return mem().invites.find((i) => i.token === token);
  }
  const rows = await conn.select().from(schema.invites).where(eq(schema.invites.token, token));
  return rows[0] ? toInvite(rows[0]) : undefined;
}

/**
 * Write an invite, replacing whatever that address had.
 *
 * One statement, not a read-then-write: `email` is unique, so the conflict is
 * the rule ("a person is only ever one row") enforced by the database rather
 * than by two admins not clicking at once.
 */
export async function putInvite(invite: Invite): Promise<void> {
  const conn = db();
  if (!conn) {
    noDb();
    const i = mem().invites.findIndex((x) => x.email === invite.email);
    if (i >= 0) mem().invites.splice(i, 1);
    mem().invites.push({ ...invite });
    return;
  }
  await conn
    .insert(schema.invites)
    .values({
      token: invite.token,
      email: invite.email,
      role: invite.role,
      message: invite.message ?? null,
      createdAt: new Date(invite.createdAt),
      expiresAt: new Date(invite.expiresAt),
    })
    .onConflictDoUpdate({
      target: schema.invites.email,
      set: {
        token: invite.token,
        role: invite.role,
        message: invite.message ?? null,
        createdAt: new Date(invite.createdAt),
        expiresAt: new Date(invite.expiresAt),
      },
    });
}

export async function deleteInvite(token: string): Promise<void> {
  const conn = db();
  if (!conn) {
    noDb();
    const i = mem().invites.findIndex((x) => x.token === token);
    if (i >= 0) mem().invites.splice(i, 1);
    return;
  }
  await conn.delete(schema.invites).where(eq(schema.invites.token, token));
}

/** Sweep tokens that died without being used, so the table is not a graveyard. */
export async function purgeExpiredInvites(now = Date.now()): Promise<void> {
  const conn = db();
  if (!conn) return;
  await conn.delete(schema.invites).where(lte(schema.invites.expiresAt, new Date(now)));
}

/**
 * Add or update a member and set their credential — the two halves of "accepted".
 *
 * Both or neither: the roster saying someone accepted while no credential exists
 * would lock out exactly the person the invite was for, and a credential with no
 * roster row is an account nobody can see. `acceptInviteFn` is the only caller.
 */
export async function acceptMember(member: TeamAccount, passwordHash: string): Promise<void> {
  const conn = db();
  if (!conn) {
    noDb();
    const i = mem().team.findIndex((m) => m.email === member.email);
    if (i >= 0) mem().team[i] = { ...member };
    else mem().team.push({ ...member });
    mem().hashes.set(normalizeEmail(member.email), passwordHash);
    return;
  }
  await conn
    .insert(schema.team)
    .values({
      email: member.email,
      name: member.name,
      role: member.role,
      acceptedAt: member.acceptedAt ? new Date(member.acceptedAt) : null,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: schema.team.email,
      set: {
        name: member.name,
        role: member.role,
        acceptedAt: member.acceptedAt ? new Date(member.acceptedAt) : null,
        passwordHash,
      },
    });
}

/**
 * The stored hash for an address, or null.
 *
 * The only read of `password_hash` in the codebase, and `auth.ts` is its only
 * caller. Never widen this to return the row: `TeamAccount` must stay free of
 * credentials, which is what stops the roster carrying one into the browser.
 */
export async function passwordHashFor(email: string): Promise<string | null> {
  const key = normalizeEmail(email);
  const conn = db();
  if (!conn) {
    noDb();
    return mem().hashes.get(key) ?? null;
  }
  const rows = await conn
    .select({ hash: schema.team.passwordHash })
    .from(schema.team)
    .where(and(eq(schema.team.email, key)));
  return rows[0]?.hash ?? null;
}

/** Set a credential for someone already on the roster (password reset). */
export async function setPasswordHash(email: string, hash: string): Promise<void> {
  const key = normalizeEmail(email);
  const conn = db();
  if (!conn) {
    noDb();
    mem().hashes.set(key, hash);
    return;
  }
  await conn.update(schema.team).set({ passwordHash: hash }).where(eq(schema.team.email, key));
}
