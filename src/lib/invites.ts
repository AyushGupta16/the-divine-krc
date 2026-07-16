// Team invitations for the admin console.
//
// PR #12 scope: a REAL invite lifecycle — tokenised, expiring, single-use —
// over the in-memory roster in `lib/team.ts`. Only delivery is stubbed: the
// accept link is logged rather than emailed, exactly as `auth.ts` has stubbed
// the password-reset mail since PR #1. Swap the console.info for a
// transactional email provider and nothing above it changes.
//
// This file is the permission boundary and nothing else. The rules it guards
// live in `team.ts`; what lives here is the check that they may be invoked at
// all. Roles are read off the session, never off the caller's input, so the
// screen's hidden buttons are a courtesy and this is the closed door.

import { createServerFn } from "@tanstack/react-start";

import { getSessionMember } from "@/lib/auth";
import {
  INVITABLE_ROLES,
  ROLE_HINTS,
  acceptInvite,
  can,
  createInvite,
  displayNameFromEmail,
  findInvite,
  inviteStatus,
  invites,
  refreshInvite,
  revokeInvite,
  team,
  type Invite,
  type Result,
  type Role,
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

function memberRows(): TeamRow[] {
  return team
    .filter((m) => m.password)
    .map((m) => ({
      name: m.name,
      email: m.email,
      role: m.role,
      status: "Active" as const,
      initials: initialsOf(m.name),
      token: null,
    }));
}

function inviteRows(now: number): TeamRow[] {
  return invites.map((i) => {
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
    const member = await getSessionMember();
    const now = Date.now();
    const rows = [...memberRows(), ...inviteRows(now)];
    const pending = rows.filter((r) => r.status === "Pending").length;
    const members = rows.filter((r) => r.status === "Active").length;

    const roles: RoleOption[] = INVITABLE_ROLES.map((role) => ({
      role,
      hint: ROLE_HINTS[role],
    }));

    return {
      rows,
      roles,
      seatLabel: `${members} member${members === 1 ? "" : "s"} · ${pending} pending`,
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
    const invite = findInvite(data.token);
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

    const res = createInvite(data);
    if (!res.ok) return res;

    sendInviteEmail(res.invite);
    return { ok: true, email: res.invite.email };
  });

export const resendInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    const auth = await requireManager();
    if (!auth.ok) return auth;

    const res = refreshInvite(data.token);
    if (!res.ok) return res;

    sendInviteEmail(res.invite);
    return { ok: true, email: res.invite.email };
  });

export const revokeInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    const auth = await requireManager();
    if (!auth.ok) return auth;

    return revokeInvite(data.token);
  });

/**
 * Deliberately unauthenticated — the token is the proof, and the person holding
 * it has no account yet by definition.
 */
export const acceptInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; password: string }) => data)
  .handler(async ({ data }): Promise<Result<{ email: string }>> => {
    return acceptInvite(data.token, data.password);
  });
