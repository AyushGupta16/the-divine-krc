// Google OAuth (PKCE), via `arctic`. Server-only.
//
// PR 1 of 3: library + this module only. No routes, no button, no wiring into
// `loginFn`/`googleLoginFn` yet — those land in PR 2 (start/callback routes)
// and PR 3 (button + stub removal). Nothing here is imported by any
// client-reachable module today, and it must stay that way: `GOOGLE_CLIENT_ID`/
// `GOOGLE_CLIENT_SECRET` are read from `process.env` at module scope inside
// `googleClient()`, the same shape `db.ts` and `auth.ts`'s `sessionPassword()`
// use for `DATABASE_URL`/`SESSION_SECRET` — resolved per call, never hoisted
// to a module-level constant, so nothing here survives tree-shaking into a
// client chunk the way #12's `ownerPassword` briefly did.
//
// PR 2's routes must reach this the same way `auth.ts` reaches `roster.ts` —
// through a dynamic `import()` inside a server-fn/API-route handler, never a
// static `import ... from "@/lib/google-oauth"` from anything a route loader
// can retain. A static edge from a client-reachable module is exactly the
// class of leak `check:bundle` exists to catch (see its own header).

import { Google, type OAuth2Tokens } from "arctic";

const CALLBACK_PATH = "/api/auth/google/callback";
const SCOPES = ["openid", "email", "profile"];

/** Appends the (not-yet-existing, PR 2) callback route to a request's origin. */
export function getRedirectUri(origin: string): string {
  return new URL(CALLBACK_PATH, origin).toString();
}

/**
 * A configured Google client. Throws rather than constructing one with an
 * `undefined` id/secret — `new Google(undefined, undefined, ...)` would build
 * successfully and fail confusingly at the first real request instead of here,
 * at the one place that actually knows the credential is missing.
 */
export function googleClient(redirectUri: string): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set to use Google sign-in.",
    );
  }
  return new Google(clientId, clientSecret, redirectUri);
}

/**
 * Google's consent-screen URL. `codeVerifier` is the PKCE secret this request
 * generated (kept server-side, e.g. in a short-lived cookie by PR 2's start
 * route) — `Google#createAuthorizationURL` derives the S256 challenge from it
 * and embeds that, not the verifier itself, in the URL.
 */
export function buildAuthUrl(redirectUri: string, state: string, codeVerifier: string): URL {
  return googleClient(redirectUri).createAuthorizationURL(state, codeVerifier, SCOPES);
}

/**
 * Exchanges the callback's `code` for tokens, verifying it against the same
 * `codeVerifier` the auth URL was built with — arctic checks the challenge
 * matches server-side, so a stolen `code` is useless without also holding the
 * verifier (never sent to Google, never visible in the redirect).
 */
export async function exchangeCode(
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; idToken?: string }> {
  const tokens: OAuth2Tokens = await googleClient(redirectUri).validateAuthorizationCode(
    code,
    codeVerifier,
  );
  let idToken: string | undefined;
  try {
    idToken = tokens.idToken();
  } catch {
    // `openid` was requested, so Google should always include one — but the
    // return type stays optional rather than asserting a third-party response
    // shape we don't control.
    idToken = undefined;
  }
  return { accessToken: tokens.accessToken(), idToken };
}

export interface GoogleUserInfo {
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * The signed-in Google account's profile. Throws on an unverified email
 * rather than returning one — an unverified address is not proof of who
 * holds it, and every caller of this function is about to treat the result
 * as an identity claim strong enough to sign someone into the admin console.
 */
export async function fetchGoogleUser(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo request failed: ${res.status} ${res.statusText}`);
  }
  const profile = (await res.json()) as GoogleUserInfo;
  if (!profile.email_verified) {
    throw new Error(`Google account ${profile.email} has an unverified email.`);
  }
  return profile;
}
