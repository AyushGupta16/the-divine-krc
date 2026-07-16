// Admin authentication for the booking console.
//
// PR #1 scope: a REAL sealed-cookie session + route guard, backed by a
// mock in-memory admin user. Google sign-in and reset-password email delivery
// are simulated (UI-complete) — see the clearly marked stubs below. Swap the
// mock store for a DB and the stubs for real OAuth / an email provider later.

import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";

import { findMember, isActive, makeToken, normalizeEmail, passwordProblem, team } from "@/lib/team";

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
  const member = findMember(user.email);
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

// --- Credentials (replace with hashed rows in a DB) ---------------------
//
// Who exists is `team` in `lib/team.ts`, shared with the Settings roster and the
// invite flow. How they prove it is here, and only here: this module is
// server-only — it imports `@tanstack/react-start/server`, and every export is a
// server function — so nothing in it reaches `dist/client`. #12 briefly kept
// passwords beside the roster and shipped them to the browser; that is the
// mistake this split exists to prevent.
//
// A real store would hold a hash. This one holds the mock's plaintext, which is
// tolerable only while it stays server-side and the data behind it is fake.

const credentials = new Map<string, string>();

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

/**
 * The seeded staff hold a credential nobody knows: they accepted long before the
 * console existed, so the mock has no business inventing a password for them,
 * and a guessable one would be four public logins rather than one. Random per
 * boot means they are Active — which they are — and unreachable, which is right.
 */
function unguessable(): string {
  return makeToken() + makeToken();
}

/**
 * Seeded on first use rather than at module load, and this is not a style
 * choice. `auth.ts` is reachable from the client — the login page imports
 * `loginFn` — and a bundler must keep module-level side effects, so a seeding
 * loop up here would run in the browser and drag `ownerPassword` into
 * `dist/client` with it. Everything below is called only from inside server
 * function handlers, whose bodies are stripped client-side, so this whole store
 * tree-shakes away. Nothing about credentials should survive into a bundle a
 * stranger can read.
 */
let seeded = false;
function store(): Map<string, string> {
  if (seeded) return credentials;
  seeded = true;
  for (const member of team) {
    if (!isActive(member)) continue;
    const password = member.role === "Owner" ? ownerPassword() : unguessable();
    if (password) credentials.set(member.email.toLowerCase(), password);
  }
  return credentials;
}

/** Record a password. Called only where a token has already proved the person. */
function setCredential(email: string, password: string) {
  store().set(normalizeEmail(email), password);
}

/**
 * A member who is on the roster, has accepted, and whose password matches.
 * Someone invited but undecided has no credential, so they fall out here — the
 * same fact that renders them as Pending.
 */
function verify(email: string, password: string) {
  const member = findMember(email);
  if (!member || !isActive(member)) return undefined;
  const stored = store().get(normalizeEmail(email));
  return stored && stored === password ? member : undefined;
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
    const admin = verify(data.email, data.password);
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
    const admin = findMember("admin@thedivinekrc.in");
    if (!admin || !store().has(admin.email.toLowerCase())) {
      return { ok: false, error: "Google sign-in is unavailable." };
    }
    const session = await getSession();
    await session.update({ user: { email: admin.email, name: admin.name } });
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
    const admin = findMember(data.email);
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

    setCredential(entry.email, data.password);
    resetTokens.delete(data.token); // single use
    return { ok: true };
  });

/**
 * Give a member a password. Exported for `acceptInviteFn`, which owns the only
 * other moment someone proves a token and chooses one; keeping the store here
 * is what keeps it off the client. Never call this without a proven token.
 */
export const setMemberCredential = (email: string, password: string) =>
  setCredential(email, password);

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
