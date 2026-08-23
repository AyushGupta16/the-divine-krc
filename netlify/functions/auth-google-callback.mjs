// Google OAuth callback: separate Netlify Function, mapped to
// /api/auth-google-callback via a netlify.toml redirect (see
// auth-google-start.mjs for why the path must stay fixed).
//
// This function verifies the Google identity and checks the roster, but it
// does NOT mint `krc_admin_session` itself — Netlify Functions have no h3
// event, so they can't call `useSession()`/`establishSession()`. Instead it
// hands off a short-lived HMAC-signed token to `/admin/login/finish`, a
// normal TanStack Start route running inside the main app with a real h3
// event, which does the actual session issuance.
//
// The signing here and `verifyOAuthToken` in `src/lib/auth.ts` are two
// separate, independent implementations of the same format rather than a
// shared `src/lib` module — this function and the main app are two different
// Netlify Functions with no shared runtime, so a shared module would only be
// a shared source file, not shared code at request time. `SESSION_SECRET` is
// the one thing that does need to actually match between them: the same env
// var `auth.ts`'s `sessionPassword()` already reads to seal `krc_admin_session`,
// so it must already be configured wherever this app already has working
// sessions — no new env var required.

import { createHmac } from "node:crypto";

// Mirrors `auth.ts`'s `DEV_SESSION_SECRET` fallback (also a known value in a
// public repo, deliberately) so local `netlify dev` without a `.env` still
// works. In production `SESSION_SECRET` is required — see the guard below.
const DEV_SESSION_SECRET = "krc-dev-session-secret-change-me-please-32b";

function tokenSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  return DEV_SESSION_SECRET;
}

function signHandoffToken(email) {
  const payload = JSON.stringify({ email, exp: Date.now() + 30_000 });
  const sig = createHmac("sha256", tokenSecret()).update(payload).digest("hex");
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${b64}.${sig}`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

const clearCookieHeaders = () => [
  "google_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0",
  "google_oauth_code_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0",
];

function redirectTo(pathAndQuery, extraSetCookies = clearCookieHeaders()) {
  const headers = new Headers();
  headers.append("Location", pathAndQuery);
  for (const cookie of extraSetCookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

// Must produce the identical origin `auth-google-start.mjs` used to build the
// authorization URL — Google's token exchange requires `redirect_uri` to match
// byte for byte. `DEPLOY_URL`/`URL` don't reliably reflect the actual deploy
// context in a Function's runtime (see `auth-google-start.mjs`'s copy of this
// comment for what that broke), so both functions derive it from the request
// instead.
function requestOrigin(request) {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.DEPLOY_URL ?? process.env.URL ?? null;
}

export default async (request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieState = cookies["google_oauth_state"];
  const codeVerifier = cookies["google_oauth_code_verifier"];

  if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
    return redirectTo("/admin/login?error=oauth_state_mismatch");
  }

  const origin = requestOrigin(request);
  if (!origin) {
    return redirectTo("/admin/login?error=oauth_failed");
  }

  const { getRedirectUri, exchangeCode, fetchGoogleUser } =
    await import("../../src/lib/google-oauth.ts");
  const redirectUri = getRedirectUri(origin);

  let googleUser;
  try {
    const { accessToken } = await exchangeCode(redirectUri, code, codeVerifier);
    googleUser = await fetchGoogleUser(accessToken);
  } catch {
    return redirectTo("/admin/login?error=email_not_verified");
  }

  const { loadRoster } = await import("../../src/lib/roster.ts");
  const { findMember, isActive } = await import("../../src/lib/team.ts");
  const roster = await loadRoster();
  const member = findMember(roster, googleUser.email);

  if (!member || !isActive(member)) {
    return redirectTo("/admin/login?error=not_authorized");
  }

  const token = signHandoffToken(member.email);

  return redirectTo(`/admin/login/finish?token=${encodeURIComponent(token)}`);
};
