// The team: who exists, what each of them may do, and who has been asked to join.
//
// Before PR #12 this list was written twice — `auth.ts` held the accounts that
// could log in, `bookings.ts` held the roster Settings displayed — and nothing
// held them together. Spec 12 makes that a contradiction rather than a
// duplication: an accepted invite has to become "an active team member in the
// Settings roster", so the list you can join and the list Settings shows must be
// one list. This is it.
//
// It is deliberately free of `@tanstack/react-start/server` imports. That is the
// whole reason it exists as its own module: `bookings.ts` feeds a client loader
// and cannot pull server-only session code, so the shared store has to sit below
// both. Server functions live in `invites.ts`; this file is just the data and
// the rules. Swap the arrays for a DB and everything above them still holds.

/** Roles are fixed: permissions are code, not data, so a role cannot be invented. */
export type Role = "Owner" | "Manager" | "Front desk" | "Accounts";

/** The Owner is the property. It is not a seat you can be invited into. */
export const INVITABLE_ROLES: Role[] = ["Manager", "Front desk", "Accounts"];

export type Permission =
  | "bookings:read"
  | "bookings:write"
  | "rooms:write"
  | "guests:read"
  | "payments:read"
  | "payments:write"
  | "reports:read"
  | "settings:write"
  | "team:manage";

const ALL: Permission[] = [
  "bookings:read",
  "bookings:write",
  "rooms:write",
  "guests:read",
  "payments:read",
  "payments:write",
  "reports:read",
  "settings:write",
  "team:manage",
];

/**
 * What each role may do. The design states these in prose beside the role
 * picker; `ROLE_HINTS` is that prose and this is the same claim in code, so the
 * sentence shown to whoever is sending the invite is the sentence enforced on
 * whoever accepts it. If the two ever disagree, `invites.test.ts` fails.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  Owner: ALL,
  Manager: ALL,
  "Front desk": ["bookings:read", "bookings:write", "rooms:write", "guests:read"],
  Accounts: ["bookings:read", "payments:read", "payments:write", "reports:read"],
};

/** The prose beside the role picker. Kept next to the grants it describes. */
export const ROLE_HINTS: Record<Role, string> = {
  Owner: "The property account — full access, and the only role that cannot be invited.",
  Manager: "Full access — bookings, rooms, payments, reports, settings & team.",
  "Front desk":
    "Day-to-day — bookings, check-in/out, rooms & guests. No payments settings or team.",
  Accounts: "Payments, collections, OTA settlements & reports. Read-only on bookings.",
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// --- The roster (replace with a DB) -------------------------------------

export interface TeamAccount {
  email: string;
  name: string;
  role: Role;
  /**
   * Set when — and only when — the person has accepted and chosen a password.
   * This is what makes them Active: there is no status column to fall out of
   * step with reality, because holding a credential *is* being active.
   */
  password?: string;
}

export const team: TeamAccount[] = [
  { email: "admin@thedivinekrc.in", name: "KRC Admin", role: "Owner", password: "krc-admin" },
  { email: "rahul@thedivinekrc.in", name: "Rahul Menon", role: "Manager", password: "krc-rahul" },
  {
    email: "sneha@thedivinekrc.in",
    name: "Sneha Pillai",
    role: "Front desk",
    password: "krc-sneha",
  },
  { email: "vinod@thedivinekrc.in", name: "Vinod Kumar", role: "Accounts", password: "krc-vinod" },
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findMember(email: string): TeamAccount | undefined {
  const key = normalizeEmail(email);
  return team.find((m) => m.email.toLowerCase() === key);
}

// --- Invites ------------------------------------------------------------

export interface Invite {
  email: string;
  role: Role;
  /** The optional note the sender types; it rides along in the email. */
  message?: string;
  token: string;
  createdAt: number;
  expiresAt: number;
}

/** A week to accept. Longer than a password reset (30 min) — it is not a secret
 *  someone asked for and is waiting on, it is a request landing in their inbox. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const invites: Invite[] = [];

export function makeToken(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

export function findInvite(token: string): Invite | undefined {
  return invites.find((i) => i.token === token);
}

export function findInviteByEmail(email: string): Invite | undefined {
  const key = normalizeEmail(email);
  return invites.find((i) => i.email.toLowerCase() === key);
}

/**
 * A person's display name before they have ever logged in. An invite carries an
 * email and nothing else — the form asks for no name, because the person it is
 * addressed to has not typed anything yet — so the roster reads one out of the
 * address rather than showing a blank or a raw mailbox.
 */
export function displayNameFromEmail(email: string): string {
  return (
    normalizeEmail(email)
      .split("@")[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || normalizeEmail(email)
  );
}

export type MemberStatus = "Active" | "Pending" | "Expired";

/** An invite is Pending until its token dies, and Expired forever after. */
export function inviteStatus(invite: Invite, now = Date.now()): MemberStatus {
  return invite.expiresAt > now ? "Pending" : "Expired";
}

// --- The lifecycle ------------------------------------------------------
//
// The rules live here, as plain functions over the store, and the server
// functions in `invites.ts` are a permission check wrapped around them. That
// split is deliberate: it keeps the part worth testing reachable without a
// request context, so the tests exercise the code that actually ships rather
// than a copy of it written to be testable.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function createInvite(input: {
  email: string;
  role: Role;
  message?: string;
}): Result<{ invite: Invite }> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!INVITABLE_ROLES.includes(input.role)) {
    return { ok: false, error: "Pick a role for this invite." };
  }
  if (findMember(email)?.password) {
    return { ok: false, error: `${email} is already on the team.` };
  }

  // Re-inviting someone who already has an invite replaces it rather than
  // stacking a second one, so a person is only ever one row and the newest
  // link is the only one that works.
  const existing = findInviteByEmail(email);
  if (existing) invites.splice(invites.indexOf(existing), 1);

  const invite: Invite = {
    email,
    role: input.role,
    message: input.message?.trim() || undefined,
    token: makeToken(),
    createdAt: Date.now(),
    expiresAt: Date.now() + INVITE_TTL_MS,
  };
  invites.push(invite);
  return { ok: true, invite };
}

/** Resend mints a fresh token: the old link dies, so a forwarded mail cannot
 *  outlive the one the person was actually meant to use. */
export function refreshInvite(token: string): Result<{ invite: Invite }> {
  const invite = findInvite(token);
  if (!invite) return { ok: false, error: "That invite no longer exists." };

  invite.token = makeToken();
  invite.createdAt = Date.now();
  invite.expiresAt = Date.now() + INVITE_TTL_MS;
  return { ok: true, invite };
}

export function revokeInvite(token: string): Result<{ email: string }> {
  const invite = findInvite(token);
  if (!invite) return { ok: false, error: "That invite no longer exists." };

  invites.splice(invites.indexOf(invite), 1);
  return { ok: true, email: invite.email };
}

/**
 * Accept. Choosing a password is what creates the member — there is no status
 * to set, because holding a credential is what being active means.
 */
export function acceptInvite(token: string, password: string): Result<{ email: string }> {
  const invite = findInvite(token);
  if (!invite || inviteStatus(invite) === "Expired") {
    // Burn an expired token on sight rather than leaving it to be retried.
    if (invite) invites.splice(invites.indexOf(invite), 1);
    return { ok: false, error: "This invite link is invalid or has expired." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const email = invite.email;
  const existing = findMember(email);
  if (existing) {
    existing.password = password;
    existing.role = invite.role;
  } else {
    team.push({
      email,
      name: displayNameFromEmail(email),
      role: invite.role,
      password,
    });
  }
  invites.splice(invites.indexOf(invite), 1); // single use
  return { ok: true, email };
}

// Seed: one invite still open, so the screen has a Pending row to act on.
// Deliberately just the one — an Expired row is reachable by letting a token
// die rather than by seeding a corpse, and the tests age this one to prove it.
invites.push({
  email: "aarti@thedivinekrc.in",
  role: "Front desk",
  token: makeToken(),
  createdAt: Date.now(),
  expiresAt: Date.now() + INVITE_TTL_MS,
});
