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
// and cannot pull server-only session code, so the shared rules have to sit below
// both. Server functions live in `invites.ts`; this file is just the rules.
//
// #12b took the arrays out. The promise above them — "swap the arrays for a DB
// and everything here still holds" — is the one this file now has to keep, so
// the lifecycle functions below decide and return; they no longer mutate. The
// caller (`invites.ts`) is what writes, because writing is what needs the
// database and the rules must not. That is what keeps them testable with no
// connection, which is the same trick `bookings.ts` plays with `BookingData`.
//
// !! Which is exactly why NO CREDENTIAL MAY EVER LIVE IN THIS FILE. !!
//
// #12 first held each member's password here, reasoning that holding one *is*
// being active. It read well and it shipped `krc-admin` to every browser: a
// route loader runs on the client too, so `bookings.ts` importing this module
// for the roster pulled the passwords into `dist/client`. Nobody had to read
// the repo — View Source was enough.
//
// So this file knows *that* someone accepted (`acceptedAt`) and never *how they
// prove it*. Passwords live in `auth.ts`, which is server-only and stays that
// way. The invariant — accepted iff a credential exists — is established in one
// place, `acceptInviteFn`, which sets both or neither.

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
   * When they accepted — set by `acceptInvite`, at the same moment `auth.ts` is
   * given their password. Presence is what makes them Active, so status is
   * still derived rather than stored, but the secret itself stays server-side.
   * `null` means invited and undecided.
   */
  acceptedAt?: number;
}

/** Accepted, and therefore holding a credential `auth.ts` knows and this file does not. */
export function isActive(member: TeamAccount): boolean {
  return member.acceptedAt != null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The roster, as whoever loaded it has it. */
export function findMember(roster: TeamAccount[], email: string): TeamAccount | undefined {
  const key = normalizeEmail(email);
  return roster.find((m) => m.email.toLowerCase() === key);
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

export function makeToken(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

export function findInvite(list: Invite[], token: string): Invite | undefined {
  return list.find((i) => i.token === token);
}

export function findInviteByEmail(list: Invite[], email: string): Invite | undefined {
  const key = normalizeEmail(email);
  return list.find((i) => i.email.toLowerCase() === key);
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

/**
 * Decide an invite. The caller writes it: delete any invite for this address,
 * insert this one.
 *
 * `roster` and `pending` are the state as the caller loaded it — a query in
 * production, an array in the tests. The rule is the same either way, which is
 * the point of it not fetching its own.
 */
export function createInvite(
  state: { roster: TeamAccount[]; pending: Invite[] },
  input: { email: string; role: Role; message?: string },
  now = Date.now(),
): Result<{ invite: Invite }> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!INVITABLE_ROLES.includes(input.role)) {
    return { ok: false, error: "Pick a role for this invite." };
  }
  const member = findMember(state.roster, email);
  if (member && isActive(member)) {
    return { ok: false, error: `${email} is already on the team.` };
  }

  // Re-inviting someone who already has an invite replaces it rather than
  // stacking a second one, so a person is only ever one row and the newest link
  // is the only one that works. The `invites.email` unique constraint is the
  // same rule, stated where the database can enforce it.
  const invite: Invite = {
    email,
    role: input.role,
    message: input.message?.trim() || undefined,
    token: makeToken(),
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };
  return { ok: true, invite };
}

/** Resend mints a fresh token: the old link dies, so a forwarded mail cannot
 *  outlive the one the person was actually meant to use. The caller replaces the
 *  row keyed by the *old* token. */
export function refreshInvite(
  invite: Invite | undefined,
  now = Date.now(),
): Result<{ invite: Invite }> {
  if (!invite) return { ok: false, error: "That invite no longer exists." };

  return {
    ok: true,
    invite: { ...invite, token: makeToken(), createdAt: now, expiresAt: now + INVITE_TTL_MS },
  };
}

/** The caller deletes the row. */
export function revokeInvite(invite: Invite | undefined): Result<{ email: string }> {
  if (!invite) return { ok: false, error: "That invite no longer exists." };
  return { ok: true, email: invite.email };
}

export const MIN_PASSWORD_LENGTH = 8;

/** The password rule, stated once so both token screens refuse the same thing. */
export function passwordProblem(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    : null;
}

/**
 * Accept: mark them joined and burn the token.
 *
 * The password is *not* passed here, and that is the point — this module must
 * never see one. `acceptInviteFn` in `invites.ts` checks `passwordProblem`
 * first, then hands the secret to `auth.ts` and calls this. Both happen or the
 * token is untouched, which is what keeps "accepted" and "has a credential" the
 * same fact.
 */
export interface AcceptDecision {
  /**
   * The token to delete, on success *and* on failure — an expired link is burnt
   * on sight rather than left to be retried. Null only when there was no invite
   * to burn. Separate from `result` precisely because it is not conditional on
   * it; folding it into the success case is how a dead token survives.
   */
  burn: string | null;
  result: Result<{ member: TeamAccount }>;
}

export function acceptInvite(
  state: { roster: TeamAccount[]; invite: Invite | undefined },
  now = Date.now(),
): AcceptDecision {
  const { invite } = state;
  if (!invite || inviteStatus(invite, now) === "Expired") {
    return {
      burn: invite?.token ?? null,
      result: { ok: false, error: "This invite link is invalid or has expired." },
    };
  }

  const email = invite.email;
  const existing = findMember(state.roster, email);

  // An existing row keeps its name — the person typed it, or an earlier accept
  // derived it; either way it beats re-deriving from the address. A new one has
  // no name to keep, because the invite form never asked for one.
  const member: TeamAccount = {
    email,
    name: existing?.name ?? displayNameFromEmail(email),
    role: invite.role,
    acceptedAt: now,
  };
  return { burn: invite.token, result: { ok: true, member } };
}
