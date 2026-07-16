// Admin authentication for the booking console.
//
// PR #1 scope: a REAL sealed-cookie session + route guard, backed by a
// mock in-memory admin user. Google sign-in and reset-password email delivery
// are simulated (UI-complete) — see the clearly marked stubs below. Swap the
// mock store for a DB and the stubs for real OAuth / an email provider later.

import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";

import { findMember, makeToken } from "@/lib/team";

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
  return member?.password ? member : null;
}

interface SessionData {
  user?: SessionUser;
}

// h3 sealed-cookie session. The password seals/verifies the cookie; it must be
// >= 32 chars. In production set SESSION_SECRET; the fallback is dev-only.
const SESSION_PASSWORD =
  process.env.SESSION_SECRET ?? "krc-dev-session-secret-change-me-please-32b";

function getSession() {
  // Not a React hook: h3's server-side session helper just shares the `use`
  // prefix, so the rules-of-hooks check misfires on this server-only module.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<SessionData>({
    name: "krc_admin_session",
    password: SESSION_PASSWORD,
  });
}

// --- Accounts -----------------------------------------------------------
//
// The admin store used to live here as its own array. It is now `team` in
// `lib/team.ts`, shared with the Settings roster and the invite flow, because
// PR #12 needs accepting an invite to put someone on both at once.

/**
 * Only a member who has set a password can sign in. Someone invited but not yet
 * accepted is on the roster and has no credential, so they fall out here — the
 * check is the same one that renders them as Pending.
 */
function findAdmin(email: string) {
  const member = findMember(email);
  return member?.password ? member : undefined;
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
    const admin = findAdmin(data.email);
    if (!admin || admin.password !== data.password) {
      return { ok: false, error: "Incorrect email or password." };
    }
    const session = await getSession();
    await session.update({ user: { email: admin.email, name: admin.name } });
    return { ok: true };
  });

// Simulated Google sign-in: real OAuth needs a Google client id/secret +
// redirect flow. Here we sign the demo admin in so the UX is exercisable.
export const googleLoginFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const admin = findAdmin("admin@thedivinekrc.in")!;
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
    const admin = findAdmin(data.email);
    if (admin) {
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
    if (data.password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }
    const member = findMember(entry.email);
    if (member) member.password = data.password;
    resetTokens.delete(data.token); // single use
    return { ok: true };
  });

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
