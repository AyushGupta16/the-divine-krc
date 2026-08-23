import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildAuthUrl, getRedirectUri } from "@/lib/google-oauth";

describe("buildAuthUrl", () => {
  const ORIGINAL_ID = process.env.GOOGLE_CLIENT_ID;
  const ORIGINAL_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = ORIGINAL_ID;
    process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_SECRET;
  });

  it("requests the openid/email/profile scopes and carries the given state", () => {
    const redirectUri = getRedirectUri("http://localhost:3000");
    const url = buildAuthUrl(redirectUri, "csrf-state-value", "pkce-code-verifier");

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("state")).toBe("csrf-state-value");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining(["openid", "email", "profile"]),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    // PKCE: the verifier itself must never appear in the URL, only its S256 challenge.
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).not.toBe("pkce-code-verifier");
  });
});

describe("getRedirectUri", () => {
  it("appends the callback path to the given origin", () => {
    expect(getRedirectUri("http://localhost:3000")).toBe(
      "http://localhost:3000/api/auth-google-callback",
    );
  });
});
