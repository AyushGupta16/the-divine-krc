// Admin authentication for the booking console.
//
// Multi-account session support: the sealed cookie carries a dictionary of
// authenticated accounts keyed by email, alongside an `activeEmail` pointer.
// This lets a property owner sign in as themselves, then add the front-desk
// account in the same tab without losing the first session. Switching is a
// pointer update; adding is a map insert; logging out is a map delete.
//
// The cookie budget is ~4KB (browser limit). Each account entry is ~60 bytes
// of JSON before sealing, so a hard cap of 5 concurrent accounts keeps the
// payload well within budget even after h3's encryption overhead.
//
// Google sign-in and reset-password email delivery are simulated (UI-complete)
// — see the clearly marked stubs below.

import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";

import {
  can,
  findMember,
  isActive,
  makeToken,
  normalizeEmail,
  passwordProblem,
  type Permission,
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
 * The sealed-cookie payload. Stores up to `MAX_ACCOUNTS` authenticated
 * accounts keyed by email, with `activeEmail` pointing at the one whose
 * perspective the console currently shows.
 *
 * Layout:
 * ```json
 * {
 *   "activeEmail": "admin@thedivinekrc.in",
 *   "accounts": {
 *     "admin@thedivinekrc.in": { "email": "...", "name": "..." },
 *     "sneha@thedivinekrc.in": { "email": "...", "name": "..." }
 *   }
 * }
 * ```
 */
interface SessionData {
  activeEmail?: string;
  accounts?: Record<string, SessionUser>;
}

/** Browser cookie budget is ~4KB; each account is ~60B of JSON before sealing. */
const MAX_ACCOUNTS = 5;

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
 * Add (or re-activate) `user` in the multi-account session and make them the
 * active account. Returns `{ ok: false, error }` if the 5-account cap would
 * be exceeded; otherwise updates the cookie and returns `{ ok: true }`.
 *
 * Every login path funnels through this, so the cap is enforced once.
 */
async function addAccountToSession(
  user: SessionUser,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  const accounts = { ...(session.data.accounts ?? {}) };

  // The cap only matters when inserting a genuinely new account; re-logging
  // into an address already in the map just refreshes the name and moves the
  // pointer, which cannot grow the map.
  if (!accounts[user.email] && Object.keys(accounts).length >= MAX_ACCOUNTS) {
    return {
      ok: false,
      error:
        "Maximum limit of 5 active accounts reached. " +
        "Please sign out of an account before adding a new one.",
    };
  }

  accounts[user.email] = user;
  await session.update({ activeEmail: user.email, accounts });
  return { ok: true };
}

/**
 * Sign the given member into the session directly. Exported so the invite
 * flow's simulated Google sign-up (`googleAcceptInviteFn` in `invites.ts`)
 * can land someone in the console the same way `loginFn` does, without
 * duplicating `getSession`'s h3 wiring outside this module.
 */
export const establishSession = createServerOnlyFn(async (user: SessionUser) => {
  await addAccountToSession(user);
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
    const { activeEmail, accounts } = session.data;
    if (!activeEmail || !accounts?.[activeEmail]) return null;
    return accounts[activeEmail];
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const admin = await verify(data.email, data.password);
    if (!admin) {
      return { ok: false, error: "Incorrect email or password." };
    }
    return addAccountToSession({ email: admin.email, name: admin.name });
  });

// --- Real Google sign-in, PR 2 of 3 --------------------------------------
//
// `netlify/functions/auth-google-start.mjs` and `auth-google-callback.mjs`
// run the actual OAuth exchange, but they are separate Netlify Functions with
// no h3 event — they can't call `useSession()`/`establishSession()` directly.
// The callback instead hands off a short-lived HMAC-signed token to
// `/admin/login/finish`, which calls `googleFinishFn` here — running inside
// this app, with a real request context — to verify the token and finish the
// sign-in exactly like `loginFn` does above.
//
// The signing (in the Netlify callback) and the verification (`verifyOAuthToken`
// below) are two independent implementations of the same format, not a shared
// module: the callback function and this app have no shared runtime, so a
// shared module would only be a shared source file. `sessionPassword()` is
// reused as the HMAC key rather than inventing a second secret — same env var
// (`SESSION_SECRET`) `netlify/functions/auth-google-callback.mjs` reads
// directly (it can't import this module either), so it must already be
// configured wherever session cookies already work — no new env var.
//
// This module is client-reachable (`login.tsx` imports `loginFn`), so
// `node:crypto` is loaded lazily rather than imported at module scope — a
// static top-level import would be a module-level edge the client bundle has
// to resolve too, the same class of leak this file's own header describes for
// `roster.ts`/`password.ts`.
const nodeCrypto = () => import("node:crypto");

/**
 * Verifies a token minted by `auth-google-callback.mjs`'s `signOAuthToken`:
 * `base64url(JSON.stringify({ email, exp })) + "." + hex(hmacSha256(payload))`.
 * Returns the email on success, `null` on any failure (bad shape, bad
 * signature, expired) — never partial trust.
 */
async function verifyOAuthToken(token: string): Promise<string | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const { createHmac, timingSafeEqual } = await nodeCrypto();
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const expectedSig = createHmac("sha256", sessionPassword()).update(payload).digest("hex");

  const expected = Buffer.from(expectedSig, "utf8");
  const actual = Buffer.from(sig, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let parsed: { email?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
  if (parsed.exp < Date.now()) return null;
  return parsed.email;
}

/**
 * Called by `/admin/login/finish` once the Netlify OAuth callback has
 * redirected there with a token. Re-checks the roster rather than trusting
 * the token's email blindly — the callback already checked it once, but the
 * roster can change in the ~30 seconds a token is valid for, and this is the
 * one place with a real database connection to check again.
 */
export const googleFinishFn = createServerFn({ method: "GET" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const email = await verifyOAuthToken(data.token);
    if (!email) return { ok: false, error: "oauth_failed" };

    const { loadRoster } = await rosterStore();
    const member = findMember(await loadRoster(), email);
    if (!member || !isActive(member)) return { ok: false, error: "not_authorized" };

    await establishSession({ email: member.email, name: member.name });
    return { ok: true };
  });

/**
 * Sign out of all accounts. Clears the entire session cookie.
 * This is the original `logoutFn` — kept as-is so the sidebar's "Sign out"
 * button works without changes to `AdminShell.tsx`.
 */
export const logoutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const session = await getSession();
    await session.clear();
    return { ok: true };
  },
);

// --- Multi-account server functions -------------------------------------

/**
 * Switch the active account pointer to a different already-authenticated
 * account in the session. Does not re-verify credentials — the user proved
 * who they were when they originally logged in, and the sealed cookie has
 * been carrying that proof since.
 */
export const switchAccountFn = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; activeUser: SessionUser } | { ok: false; error: string }> => {
      const session = await getSession();
      const accounts = session.data.accounts ?? {};
      const target = accounts[data.email];
      if (!target) {
        return { ok: false, error: "That account is not signed in." };
      }
      await session.update({ ...session.data, activeEmail: data.email });
      return { ok: true, activeUser: target };
    },
  );

/**
 * Sign out of a single account. If omitted, signs out the currently active
 * account. If other accounts remain, the pointer moves to the first
 * remaining one; if none remain, the session is cleared entirely.
 */
export const logoutAccountFn = createServerFn({ method: "POST" })
  .validator((data: { email?: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const session = await getSession();
    const accounts = { ...(session.data.accounts ?? {}) };
    const targetEmail = data.email ?? session.data.activeEmail;

    if (!targetEmail || !accounts[targetEmail]) {
      // Nothing to sign out — clear defensively.
      await session.clear();
      return { ok: true };
    }

    delete accounts[targetEmail];
    const remaining = Object.keys(accounts);

    if (remaining.length === 0) {
      await session.clear();
    } else {
      // If we just removed the active account, fall back to the first remaining.
      const nextActive =
        session.data.activeEmail === targetEmail
          ? remaining[0]
          : (session.data.activeEmail ?? remaining[0]);
      await session.update({ activeEmail: nextActive, accounts });
    }
    return { ok: true };
  });

/**
 * Sign out of every account at once. Identical to `logoutFn` but named
 * explicitly so the multi-account switcher UI can offer both options.
 */
export const logoutAllFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const session = await getSession();
    await session.clear();
    return { ok: true };
  },
);

/**
 * Return the full set of accounts in the session, plus which one is active.
 * Used by the sidebar account switcher to render the account list.
 */
export const getSessionAccountsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ activeUser: SessionUser | null; accounts: SessionUser[] }> => {
    const session = await getSession();
    const { activeEmail, accounts } = session.data;
    const all = Object.values(accounts ?? {});
    const active = activeEmail && accounts?.[activeEmail] ? accounts[activeEmail] : null;
    return { activeUser: active, accounts: all };
  },
);

/**
 * `getSessionMember` wrapped as a server function. `beforeLoad` runs on the
 * client too, so calling the bare function directly from a route would pull
 * its `rosterStore()` dynamic import — and `password_hash`/`DATABASE_URL`
 * behind it — into a chunk the browser actually executes, not just retains.
 */
export const getSessionMemberFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TeamAccount | null> => {
    return getSessionMember();
  },
);

// Forgot password: always report success (never reveal whether the email
// exists). When it does exist we mint a single-use token. Real delivery is
// stubbed — in dev the link is logged; a later PR emails it.
export const requestResetFn = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
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
  .validator((data: { token: string; password: string }) => data)
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

/**
 * Server function permission-guard helper. Call inside server functions.
 * Throws redirect to /admin/login if signed out, or redirect to /admin if lacking permission.
 */
export async function requireServerPermission(permission: Permission) {
  const member = await getSessionMember();
  if (!member) {
    throw redirect({
      to: "/admin/login",
    });
  }
  if (!can(member.role, permission)) {
    throw redirect({
      to: "/admin",
    });
  }
  return member;
}
