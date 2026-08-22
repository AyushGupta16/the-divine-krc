// Google OAuth start: separate Netlify Function, not a TanStack Start route
// (see feat/google-oauth-routes PR body for why). Mapped to
// /api/auth/google/start via a netlify.toml redirect — `getRedirectUri` in
// `src/lib/google-oauth.ts` hardcodes the callback path, so the URLs the rest
// of the app expects must stay stable regardless of where the function
// physically lives.
//
// Dynamic imports only: this file's own module scope must not statically
// import anything from `src/lib`, matching the pattern `auth.ts` and PR #142
// use to keep server-only modules out of the client bundle. It doesn't
// strictly matter for a Netlify Function (never bundled into dist/client),
// but keeping the same discipline means nobody has to remember an exception.

export default async (request) => {
  const { generateState, generateCodeVerifier } = await import("arctic");
  const { buildAuthUrl, getRedirectUri } = await import("../../src/lib/google-oauth.ts");

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const origin = process.env.DEPLOY_URL ?? process.env.URL;
  if (!origin) {
    return new Response("Google sign-in is unavailable (no deploy URL configured).", {
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
