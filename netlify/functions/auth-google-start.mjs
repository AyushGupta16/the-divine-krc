// Google OAuth start: separate Netlify Function, not a TanStack Start route
// (see feat/google-oauth-routes PR body for why). Mapped to
// /api/auth-google-start via a netlify.toml redirect — `getRedirectUri` in
// `src/lib/google-oauth.ts` hardcodes the (hyphenated) callback path to match
// the Google Cloud OAuth client's registered redirect URIs, so the URLs the
// rest of the app expects must stay stable regardless of where the function
// physically lives.
//
// Dynamic imports only: this file's own module scope must not statically
// import anything from `src/lib`, matching the pattern `auth.ts` and PR #142
// use to keep server-only modules out of the client bundle. It doesn't
// strictly matter for a Netlify Function (never bundled into dist/client),
// but keeping the same discipline means nobody has to remember an exception.

// `DEPLOY_URL`/`URL` are unreliable here: they're documented primarily as
// build-time env vars, and in practice `DEPLOY_URL` isn't populated in this
// function's runtime `process.env` on any deploy context we tested (preview
// or `dev` branch) — it silently fell through to `URL`, the *production*
// domain, on every request regardless of which deploy actually served it.
// The request itself always knows the real host, so derive the origin from
// that instead — this is the same helper `auth-google-callback.mjs` uses, and
// it must produce the identical origin on both ends: Google's token exchange
// requires the callback's `redirect_uri` to match the one the auth URL was
// built with, byte for byte.
function requestOrigin(request) {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) return `${proto}://${host}`;
  // Only reachable if a proxy strips both headers, which Netlify's own edge
  // never does — kept as a last resort rather than a 500.
  return process.env.DEPLOY_URL ?? process.env.URL ?? null;
}

export default async (request) => {
  const { generateState, generateCodeVerifier } = await import("arctic");
  const { buildAuthUrl, getRedirectUri } = await import("../../src/lib/google-oauth.ts");

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const origin = requestOrigin(request);
  if (!origin) {
    return new Response("Google sign-in is unavailable (could not determine the request origin).", {
      status: 500,
    });
  }
  const redirectUri = getRedirectUri(origin);
  const authUrl = buildAuthUrl(redirectUri, state, codeVerifier);

  const cookieBase = "HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600";
  const headers = new Headers();
  headers.append("Location", authUrl.toString());
  headers.append("Set-Cookie", `google_oauth_state=${state}; ${cookieBase}`);
  headers.append("Set-Cookie", `google_oauth_code_verifier=${codeVerifier}; ${cookieBase}`);

  return new Response(null, { status: 302, headers });
};
