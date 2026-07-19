// Admin authentication for the booking console.
//
// PR #1 scope: a REAL sealed-cookie session + route guard, backed by a
// mock in-memory admin user. Google sign-in and reset-password email delivery
// are simulated (UI-complete) — see the clearly marked stubs below. Swap the
// mock store for a DB and the stubs for real OAuth / an email provider later.

import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";

import {
  findMember,
  isActive,
  makeToken,
  normalizeEmail,
  passwordProblem,
  type TeamAccount,
} from "@/lib/team";

// `roster.ts` and `password.ts` are reached through *dynamic* imports, and this
// is load-bearing, not a flourish.
//
// This module cannot be dropped from the client build the way `bookings-data.ts`
// can: `requireAuth` is called from `routes/admin/route.tsx`'s `beforeLoad`,
// which runs in the browser, so `auth.ts` is in the client graph. A static
// `import { loadRoster } from "@/lib/roster"` is then a module-level edge the
// bundler keeps even though every *caller* sits inside a stripped handler — and
// it dragged `roster.ts` → `schema.ts` → the neon driver into `dist/client`,
// putting `password_hash` and the connection parser's `PGPASSWORD` in the chunk
// the landing page serves anonymous visitors. `check:bundle` caught it; it is
// #12's shape exactly, and `db.ts`'s own header had already written down the
// rule this crossed.
//
// A dynamic import is not a module-level edge, so nothing follows it into the
// client. Each `await import()` runs only inside a server-fn handler (or
// `requireAuth`, which the router only invokes server-side for the guard), Node
// caches the module, and the cost is one lookup rather than a load.
const rosterStore = () => import("@/lib/roster");
const passwordLib = () => import("@/lib/password");

export interface SessionUser {
  email: string;
  name: string;
}

/**
 * The signed-in member, or null. Permission checks go through this rather than
 * through anything stored on the cookie: a role sealed at login would keep
 * working after it was taken away, and would be missing entirely from a session
 * minted before roles existed. The cookie proves who you are; the roster — one
 * source, `lib/team.ts` — decides what that currently means.
 */
export async function getSessionMember() {
  const user = await getSessionUser();
  if (!user) return null;
  const { loadRoster } = await rosterStore();
  const member = findMember(await loadRoster(), user.email);
  return member && isActive(member) ? member : null;
}

interface SessionData {
  user?: SessionUser;
}

// h3 sealed-cookie session. The password seals/verifies the cookie; it must be
// >= 32 chars.
const DEV_SESSION_SECRET = "krc-dev-session-secret-change-me-please-32b";

const isProduction = process.env.NODE_ENV === "production";

/**
 * The secret that seals the session cookie.
 *
 * The dev fallback is published in a public repo, so anything sealed with it can
 * be forged by anyone — mint the cookie, skip the login. In production we would
 * rather the admin console fail loudly than authenticate strangers quietly.
 *
 * Resolved per call rather than at module load, and only on paths that touch a
 * session: throwing at import time would take down the marketing site, which is
 * where the property's actual bookings come from. A broken /admin is a bad day;
 * a broken landing page is lost business.
 */
function sessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters in production. " +
        "The admin console is disabled until it is.",
    );
  }
  return DEV_SESSION_SECRET;
}

function getSession() {
  // Not a React hook: h3's server-side session helper just shares the `use`
  // prefix, so the rules-of-hooks check misfires on this server-only module.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<SessionData>({
    name: "krc_admin_session",
    password: sessionPassword(),
  });
}

/**
 * Sign the given member into the session directly. Exported so the invite
 * flow's simulated Google sign-up (`googleAcceptInviteFn` in `invites.ts`)
 * can land someone in the console the same way `loginFn`/`googleLoginFn` do,
 * without duplicating `getSession`'s h3 wiring outside this module.
 */
export const establishSession = createServerOnlyFn(async (user: SessionUser) => {
  const session = await getSession();
  await session.update({ user });
});

// --- Credentials --------------------------------------------------------
//
// Who exists is the roster — one list, shared with the Settings screen and the
// invite flow. How they prove it is here, and only here: this module is
// server-only (every export is a server function), so nothing in it reaches
// `dist/client`. #12 briefly kept passwords beside the roster and shipped them
// to the browser; that is the mistake this split exists to prevent.
//
// #12b: the store is now `team.password_hash`, scrypt-hashed, read through
// `roster.ts` and never through a `TeamAccount`. Two credentials, two homes:
//
//   - **Staff** hold a hash, set the moment they accept an invite. Before that
//     they hold nothing, which is the same fact that renders them Pending.
//   - **The Owner** holds no hash at all. `ADMIN_PASSWORD` is the Owner's
//     credential and lives in the env, so rotating it is a Netlify change rather
//     than a migration — and a stolen table does not contain it.
//
// The seeded staff therefore cannot log in, and that is correct: they accepted
// long before the console existed, so nothing here has any business inventing a
// password for them. Previously they were given a random one per boot to say the
// same thing; a null hash says it without the machinery.

/**
 * The owner's password. `ADMIN_PASSWORD` in production; a known value in dev so
 * the console is usable. Unset in production means no owner login rather than a
 * publicly-known one — it fails closed.
 */
function ownerPassword(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;
  return isProduction ? null : "krc-admin";
}

/** Record a password. Called only where a token has already proved the person. */
async function setCredential(email: string, secret: string) {
  const [{ setPasswordHash }, { hashPassword }] = await Promise.all([rosterStore(), passwordLib()]);
  await setPasswordHash(email, await hashPassword(secret));
}

/**
 * A member who is on the roster, has accepted, and whose password matches.
 * Someone invited but undecided has no credential, so they fall out here — the
 * same fact that renders them as Pending.
 */
async function verify(email: string, attempt: string): Promise<TeamAccount | undefined> {
  const [{ loadRoster, passwordHashFor }, { secretsMatch, verifyPassword }] = await Promise.all([
    rosterStore(),
    passwordLib(),
  ]);
  const member = findMember(await loadRoster(), email);
  if (!member || !isActive(member)) return undefined;

  if (member.role === "Owner") {
    const secret = ownerPassword();
    return secret && secretsMatch(attempt, secret) ? member : undefined;
  }
  return (await verifyPassword(attempt, await passwordHashFor(email))) ? member : undefined;
}

// Reset tokens: token -> { email, expiresAt }. In-memory, single-use.
const resetTokens = new Map<string, { email: string; expiresAt: number }>();
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes, per design copy.

// --- Server functions ---------------------------------------------------

export const getSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await getSession();
    return session.data.user ?? null;
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const admin = await verify(data.email, data.password);
    if (!admin) {
      return { ok: false, error: "Incorrect email or password." };
    }
    const session = await getSession();
    await session.update({ user: { email: admin.email, name: admin.name } });
    return { ok: true };
  });

// Simulated Google sign-in: real OAuth needs a Google client id/secret +
// redirect flow. Here we sign the demo admin in so the UX is exercisable.
// Gated on the owner having a password at all, so it cannot become a way past
// the login on a production deploy that never set ADMIN_PASSWORD.
export const googleLoginFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { loadRoster } = await rosterStore();
    const admin = findMember(await loadRoster(), "admin@thedivinekrc.in");
    // Still gated on the owner having a credential at all — which, now that the
    // Owner's lives in the env rather than the table, means ADMIN_PASSWORD is
    // set. A production deploy that never set one must not gain a way past the
    // login here.
    if (!admin || !ownerPassword()) {
      return { ok: false, error: "Google sign-in is unavailable." };
    }
    await establishSession({ email: admin.email, name: admin.name });
    return { ok: true };
  },
);

export const logoutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const session = await getSession();
    await session.clear();
    return { ok: true };
  },
);

// Forgot password: always report success (never reveal whether the email
// exists). When it does exist we mint a single-use token. Real delivery is
// stubbed — in dev the link is logged; a later PR emails it.
export const requestResetFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { loadRoster } = await rosterStore();
    const admin = findMember(await loadRoster(), data.email);
    if (admin && isActive(admin)) {
      const token = makeToken();
      resetTokens.set(token, {
        email: admin.email,
        expiresAt: Date.now() + RESET_TTL_MS,
      });
      // STUB: replace with a real transactional email.
      console.info(
        `[auth] Password reset link for ${admin.email}: /admin/reset-password?token=${token}`,
      );
    }
    return { ok: true };
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; password: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const entry = resetTokens.get(data.token);
    if (!entry || entry.expiresAt < Date.now()) {
      resetTokens.delete(data.token);
      return { ok: false, error: "This reset link is invalid or has expired." };
    }
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem };

    await setCredential(entry.email, data.password);
    resetTokens.delete(data.token); // single use
    return { ok: true };
  });

// `setMemberCredential` is gone. `acceptInviteFn` used to call it right after
// `acceptInvite`, so "on the roster" and "has a credential" were two writes with
// a gap between them — a cold start in that gap left someone accepted who could
// never log in. `roster.acceptMember` now sets both halves in one statement,
// which is what "both or neither" was always claiming.

/**
 * Route-guard helper for admin console routes. Call from `beforeLoad`.
 * Throws a redirect to /admin/login (carrying ?redirect=) when signed out.
 */
export async function requireAuth(redirectHref: string) {
  const user = await getSessionUser();
  if (!user) {
    throw redirect({
      to: "/admin/login",
      search: { redirect: redirectHref },
    });
  }
  return user;
}
