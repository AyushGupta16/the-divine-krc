// Team invitations for the admin console.
//
// PR #12 scope: a REAL invite lifecycle — tokenised, expiring, single-use — over
// the roster. Only delivery is stubbed: the accept link is logged rather than
// emailed, exactly as `auth.ts` has stubbed the password-reset mail since PR #1.
// Swap the console.info for a transactional email provider and nothing above it
// changes.
//
// This file is the permission boundary, and since #12b it is also the write.
// The rules it guards live in `team.ts` and decide without touching a database;
// the rows live in `roster.ts`. So each mutation below reads the same three
// beats: load the state the rule needs, ask the rule, persist what it decided.
// The rule stays testable with no connection, which is why it does not fetch.

import { createServerFn } from "@tanstack/react-start";

import { getSessionMember } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import {
  acceptMember,
  deleteInvite,
  findInviteByToken,
  loadInvites,
  loadRoster,
  purgeExpiredInvites,
  putInvite,
} from "@/lib/roster";
import {
  INVITABLE_ROLES,
  ROLE_HINTS,
  acceptInvite,
  can,
  createInvite,
  displayNameFromEmail,
  inviteStatus,
  isActive,
  passwordProblem,
  refreshInvite,
  revokeInvite,
  type Invite,
  type Result,
  type Role,
  type TeamAccount,
} from "@/lib/team";
import { initialsOf } from "@/lib/utils";
import type { InvitePageData, RoleOption, TeamRow } from "@/types/booking";

/** STUB: replace with a real transactional email. */
function sendInviteEmail(invite: Invite) {
  console.info(
    `[invites] Invite for ${invite.email} (${invite.role}): /admin/accept-invite?token=${invite.token}`,
  );
}

/**
 * Every mutation below funnels through this. A client that lies about who it is
 * gets nowhere: it would have to forge the sealed session cookie.
 */
async function requireManager(): Promise<Result> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Sign in to manage the team." };
  if (!can(member.role, "team:manage")) {
    return { ok: false, error: `A ${member.role} account cannot manage the team.` };
  }
  return { ok: true };
}

// --- Reads --------------------------------------------------------------

function memberRows(roster: TeamAccount[]): TeamRow[] {
  return roster.filter(isActive).map((m) => ({
    name: m.name,
    email: m.email,
    role: m.role,
    status: "Active" as const,
    initials: initialsOf(m.name),
    token: null,
  }));
}

function inviteRows(pending: Invite[], now: number): TeamRow[] {
  return pending.map((i) => {
    const name = displayNameFromEmail(i.email);
    return {
      name,
      email: i.email,
      role: i.role,
      status: inviteStatus(i, now),
      initials: initialsOf(name),
      token: i.token,
    };
  });
}

/**
 * The roster and the invites, as one list. Members first — the people who can
 * actually be relied on today lead — then anyone still deciding.
 */
export const getInvitePageData = createServerFn({ method: "GET" }).handler(
  async (): Promise<InvitePageData> => {
    const [member, roster, pending] = await Promise.all([
      getSessionMember(),
      loadRoster(),
      loadInvites(),
    ]);
    const now = Date.now();
    const rows = [...memberRows(roster), ...inviteRows(pending, now)];
    const pendingCount = rows.filter((r) => r.status === "Pending").length;
    const members = rows.filter((r) => r.status === "Active").length;

    const roles: RoleOption[] = INVITABLE_ROLES.map((role) => ({
      role,
      hint: ROLE_HINTS[role],
    }));

    return {
      rows,
      roles,
      seatLabel: `${members} member${members === 1 ? "" : "s"} · ${pendingCount} pending`,
      canManage: member ? can(member.role, "team:manage") : false,
    };
  },
);

/**
 * What the accept screen may know before anyone has proved who they are: the
 * address the invite was sent to, and nothing else. An unauthenticated caller
 * holding a guessed token learns only whether it is live.
 */
export const getInviteFn = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    const invite = await findInviteByToken(data.token);
    if (!invite || inviteStatus(invite) === "Expired") {
      return { ok: false, error: "This invite link is invalid or has expired." };
    }
    return { ok: true, email: invite.email };
  });

// --- Mutations ----------------------------------------------------------

export const sendInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; role: Role; message?: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    const auth = await requireManager();
    if (!auth.ok) return auth;

    const [roster, pending] = await Promise.all([loadRoster(), loadInvites()]);
    const res = createInvite({ roster, pending }, data);
    if (!res.ok) return res;

    // Replaces any invite this address already had — one person, one row. The
    // `email` unique constraint is the same rule where the database can hold it.
    await putInvite(res.invite);
    sendInviteEmail(res.invite);
    return { ok: true, email: res.invite.email };
  });

export const resendInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    const auth = await requireManager();
    if (!auth.ok) return auth;

    const res = refreshInvite(await findInviteByToken(data.token));
    if (!res.ok) return res;

    // The rotated invite keeps the address, so the upsert on `email` replaces
    // the old row — the previous token dies with it, which is the point of
    // resending rather than re-sending.
    await putInvite(res.invite);
    sendInviteEmail(res.invite);
    return { ok: true, email: res.invite.email };
  });

export const revokeInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    const auth = await requireManager();
    if (!auth.ok) return auth;

    const res = revokeInvite(await findInviteByToken(data.token));
    if (!res.ok) return res;

    await deleteInvite(data.token);
    return res;
  });

/**
 * Deliberately unauthenticated — the token is the proof, and the person holding
 * it has no account yet by definition.
 */
export const acceptInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; password: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    // Check the password before the token is spent, so a rejected one leaves the
    // invite usable rather than stranding them with a burnt link.
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem };

    const [roster, invite] = await Promise.all([loadRoster(), findInviteByToken(data.token)]);
    const { burn, result } = acceptInvite({ roster, invite });

    if (!result.ok) {
      // A dead token is burnt on sight rather than left to be retried.
      if (burn) await deleteInvite(burn);
      return result;
    }

    // One statement sets the roster row and the credential together. "Accepted"
    // and "can log in" are the same fact, so they must not be two writes with a
    // cold start available in between.
    await acceptMember(result.member, await hashPassword(data.password));
    if (burn) await deleteInvite(burn); // single use

    // Opportunistic tidy: tokens that died unused are of no interest to anyone.
    await purgeExpiredInvites();
    return { ok: true, email: result.member.email };
  });
