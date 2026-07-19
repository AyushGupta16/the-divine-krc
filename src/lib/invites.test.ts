import { beforeEach, describe, expect, it } from "vitest";

import { getSettingsPageData } from "@/lib/bookings";
import { fixtures } from "@/lib/__fixtures__/bookings";
import { invites as seedInvites, team as seedTeam } from "@/lib/__fixtures__/team";
import {
  INVITABLE_ROLES,
  INVITE_TTL_MS,
  ROLE_PERMISSIONS,
  acceptInvite,
  can,
  createInvite,
  displayNameFromEmail,
  findInvite,
  findInviteByEmail,
  findMember,
  isActive,
  passwordProblem,
  refreshInvite,
  revokeInvite,
  type Invite,
  type Role,
  type TeamAccount,
} from "@/lib/team";

// These call the same functions the server functions in `invites.ts` call —
// those add a permission check, an email stub, and the writes, and nothing else.
//
// #12b moved the rows to Postgres, so the rules no longer mutate: they decide
// and return, and the caller persists. The helpers below are that caller, kept
// deliberately tiny and in one place — they mirror the three beats `invites.ts`
// reads in (load, ask the rule, persist what it decided) and mirror the memory
// branch of `roster.ts`. What they are NOT is a second copy of the rules: every
// decision below still comes from `team.ts`, which is the code that ships.
//
// The SQL itself is not tested here, because the suite has no database — that
// is the price of the 122 tests running without one, and the cold-start
// acceptance in the PR is what covers it instead.

let roster: TeamAccount[];
let pending: Invite[];

beforeEach(() => {
  roster = seedTeam.map((m) => ({ ...m }));
  pending = seedInvites.map((i) => ({ ...i }));
});

/** What `putInvite` does: one row per address, newest link wins. */
function put(invite: Invite) {
  const i = pending.findIndex((x) => x.email === invite.email);
  if (i >= 0) pending.splice(i, 1);
  pending.push(invite);
}

function burnToken(token: string) {
  const i = pending.findIndex((x) => x.token === token);
  if (i >= 0) pending.splice(i, 1);
}

/** Send an invite and hand back the row it created. */
function send(email: string, role: Role = "Front desk"): Invite {
  const res = createInvite({ roster, pending }, { email, role });
  if (!res.ok) throw new Error(res.error);
  put(res.invite);
  return res.invite;
}

/** What `acceptInviteFn` does, minus the password and the hashing. */
function accept(token: string): boolean {
  const { burn, result } = acceptInvite({ roster, invite: findInvite(pending, token) });
  if (burn) burnToken(burn);
  if (!result.ok) return false;

  // `roster.acceptMember` — one upsert, roster row and credential together.
  const i = roster.findIndex((m) => m.email === result.member.email);
  if (i >= 0) roster[i] = result.member;
  else roster.push(result.member);
  return true;
}

function resend(token: string): boolean {
  const res = refreshInvite(findInvite(pending, token));
  if (!res.ok) return false;
  // The rotated invite keeps the address, so this replaces the old row — and
  // with it the old token.
  put(res.invite);
  return true;
}

function revoke(token: string): boolean {
  const res = revokeInvite(findInvite(pending, token));
  if (!res.ok) return false;
  burnToken(token);
  return true;
}

const member = (email: string) => findMember(roster, email);

describe("roles", () => {
  it("grants exactly what the sentence beside the role picker promises", () => {
    // The hint is what the person sending the invite is told they are handing
    // over. If a grant drifts from the prose, the invite lied to them.
    expect(can("Front desk", "bookings:write")).toBe(true);
    expect(can("Front desk", "payments:write")).toBe(false);
    expect(can("Front desk", "team:manage")).toBe(false);

    expect(can("Accounts", "payments:write")).toBe(true);
    expect(can("Accounts", "reports:read")).toBe(true);
    expect(can("Accounts", "bookings:write")).toBe(false);

    expect(can("Manager", "team:manage")).toBe(true);
    expect(can("Owner", "team:manage")).toBe(true);
  });

  it("never offers the Owner seat as something to invite someone into", () => {
    expect(INVITABLE_ROLES).not.toContain("Owner");
    for (const role of INVITABLE_ROLES) expect(ROLE_PERMISSIONS[role]).toBeDefined();
    expect(createInvite({ roster, pending }, { email: "x@krc.in", role: "Owner" as Role }).ok).toBe(
      false,
    );
  });

  it("lets only roles that can manage the team hand out access", () => {
    // This is the set `requireManager` in invites.ts admits. Front desk or
    // Accounts hitting the endpoint directly is refused by the role, not by a
    // hidden button.
    const allowed = (["Owner", "Manager", "Front desk", "Accounts"] as Role[]).filter((r) =>
      can(r, "team:manage"),
    );
    expect(allowed).toEqual(["Owner", "Manager"]);
  });
});

describe("the invite lifecycle", () => {
  it("turns an accepted invite into an active member on the Settings roster", async () => {
    const i = send("priya@thedivinekrc.in", "Accounts");
    expect(accept(i.token)).toBe(true);

    expect(member("priya@thedivinekrc.in")!.role).toBe("Accounts");

    // The acceptance criterion, end to end: they land on the roster Settings
    // renders. That screen keeps no list of its own, so this cannot pass by
    // coincidence — it reads the roster the invite just wrote to.
    const { team } = await getSettingsPageData(fixtures, roster);
    const row = team.find((m) => m.email === "priya@thedivinekrc.in");
    expect(row).toBeDefined();
    expect(row!.role).toBe("Accounts");
    expect(row!.name).toBe("Priya");
  });

  it("keeps someone invited but undecided off the roster entirely", async () => {
    send("nobody@thedivinekrc.in");

    // On the roster you are a person with keys, and they have not taken theirs.
    const { team } = await getSettingsPageData(fixtures, roster);
    expect(team.map((m) => m.email)).not.toContain("nobody@thedivinekrc.in");
  });

  it("rejects an expired token and creates nobody", () => {
    const i = send("late@thedivinekrc.in", "Manager");
    i.expiresAt = Date.now() - 1;
    put(i);

    expect(accept(i.token)).toBe(false);
    expect(member("late@thedivinekrc.in")).toBeUndefined();
  });

  it("burns the token on the way in, so an invite works exactly once", () => {
    const i = send("once@thedivinekrc.in");

    expect(accept(i.token)).toBe(true);
    const joined = member("once@thedivinekrc.in")!.acceptedAt;
    expect(findInvite(pending, i.token)).toBeUndefined();
    // A forwarded link cannot be replayed to seize the account.
    expect(accept(i.token)).toBe(false);
    expect(member("once@thedivinekrc.in")!.acceptedAt).toBe(joined);
  });

  it("burns a dead token rather than leaving it to be retried", () => {
    const i = send("dead@thedivinekrc.in");
    i.expiresAt = Date.now() - 1;
    put(i);

    expect(accept(i.token)).toBe(false);
    // The rule reports `burn` on the failure path too, which is the only reason
    // the row goes. Fold it into the success case and a dead token lives on.
    expect(findInvite(pending, i.token)).toBeUndefined();
  });

  it("refuses a password too short to be worth having, and lets them retry", () => {
    const i = send("weak@thedivinekrc.in");

    // `acceptInviteFn` checks this before spending the token, so a rejected
    // password leaves the invite usable rather than stranding them.
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("a-good-password")).toBeNull();
    expect(findInvite(pending, i.token)).toBeDefined();
    expect(accept(i.token)).toBe(true);
  });

  it("gives a resent invite a new token and lets the old link die", () => {
    const i = send("resend@thedivinekrc.in");
    const old = i.token;

    expect(resend(old)).toBe(true);

    expect(findInvite(pending, old)).toBeUndefined();
    expect(accept(old)).toBe(false);
    expect(pending.filter((x) => x.email === "resend@thedivinekrc.in")).toHaveLength(1);
  });

  it("revives an expired invite when it is re-sent, rather than stranding them", () => {
    const i = send("lapsed@thedivinekrc.in");
    i.expiresAt = Date.now() - 1;
    put(i);

    expect(resend(i.token)).toBe(true);
    const live = findInviteByEmail(pending, "lapsed@thedivinekrc.in")!;
    expect(accept(live.token)).toBe(true);
  });

  it("revokes an invite so the link stops working", () => {
    const i = send("revoked@thedivinekrc.in");

    expect(revoke(i.token)).toBe(true);
    expect(accept(i.token)).toBe(false);
    expect(member("revoked@thedivinekrc.in")).toBeUndefined();
    // Revoking twice is a no-op, not a crash.
    expect(revoke(i.token)).toBe(false);
  });

  it("holds one invite per person, so re-inviting cannot leave two live links", () => {
    const first = send("dup@thedivinekrc.in");
    const second = send("DUP@thedivinekrc.in", "Accounts");

    expect(pending.filter((x) => x.email === "dup@thedivinekrc.in")).toHaveLength(1);
    expect(findInvite(pending, first.token)).toBeUndefined();
    expect(accept(second.token)).toBe(true);
    // The role that lands is the one from the invite they actually used.
    expect(member("dup@thedivinekrc.in")!.role).toBe("Accounts");
  });

  it("will not invite someone who is already on the team", () => {
    // Cased differently on purpose: the guard has to normalize before it looks.
    const existing = roster[1].email;
    const res = createInvite(
      { roster, pending },
      { email: existing.toUpperCase(), role: "Manager" },
    );
    expect(res.ok).toBe(false);
    expect(pending.some((i) => i.email === existing)).toBe(false);
  });

  it("will not send an invite to something that is not an address", () => {
    for (const bad of ["", "  ", "nobody", "no@body", "@krc.in"]) {
      expect(createInvite({ roster, pending }, { email: bad, role: "Front desk" }).ok).toBe(false);
    }
    expect(pending).toHaveLength(seedInvites.length);
  });
});

describe("reading a person off an invite", () => {
  it("spells a name out of the address, since the form never asks for one", () => {
    expect(displayNameFromEmail("aarti@thedivinekrc.in")).toBe("Aarti");
    expect(displayNameFromEmail("aarti.singh@thedivinekrc.in")).toBe("Aarti Singh");
    expect(displayNameFromEmail("ravi_kumar@thedivinekrc.in")).toBe("Ravi Kumar");
    expect(displayNameFromEmail("  Meera@KRC.in ")).toBe("Meera");
  });

  it("matches an address however it was typed", () => {
    send("mixed.case@thedivinekrc.in");
    expect(findInviteByEmail(pending, "  MIXED.CASE@THEDIVINEKRC.IN  ")).toBeDefined();
    expect(member("ADMIN@thedivinekrc.in")).toBeDefined();
  });

  it("keeps the name someone already had rather than re-deriving it", () => {
    // Re-inviting an existing row must not rewrite "Shivam Gupta" into "Shivam".
    const existing = roster[1];
    existing.acceptedAt = undefined;
    const i = send(existing.email, "Manager");
    expect(accept(i.token)).toBe(true);
    expect(member(existing.email)!.name).toBe("Shivam Gupta");
  });
});

describe("the seeded roster", () => {
  it("ships one open invite, so the screen has a pending row to act on", () => {
    expect(seedInvites).toHaveLength(1);
    const [seed] = pending;
    expect(seed.expiresAt).toBeGreaterThan(Date.now());
    expect(seed.expiresAt - seed.createdAt).toBe(INVITE_TTL_MS);
  });

  it("only lets people who have accepted sign in", () => {
    // `verify` in auth.ts applies this same filter, which is why an invited but
    // undecided person cannot log in despite being known to the system.
    expect(member("admin@thedivinekrc.in")!.role).toBe("Owner");
    expect(member("aarti@thedivinekrc.in")).toBeUndefined();
    for (const m of roster) expect(isActive(m)).toBe(true);
  });

  it("keeps every credential out of this module, and so out of the browser", () => {
    // The regression that made this file exist: #12 held passwords beside the
    // roster, `bookings.ts` imports the roster for Settings, route loaders run
    // on the client — and `krc-admin` landed in dist/client. A TeamAccount must
    // carry no secret, only the fact that one exists elsewhere.
    for (const m of roster) {
      expect(Object.keys(m).sort()).toEqual(["acceptedAt", "email", "name", "role"]);
    }
    const source = JSON.stringify(roster) + JSON.stringify(pending);
    expect(source).not.toMatch(/password|secret/i);
  });

  it("keeps the hash off a member the rules just built", () => {
    // #12b gave `team` a `password_hash` column, so the shape above is no longer
    // the only way one could arrive: `acceptInvite` mints a TeamAccount, and
    // `roster.ts` maps rows into them. Either could widen and carry a hash back
    // into `bookings.ts` — which the client imports.
    const i = send("hash@thedivinekrc.in");
    const { result } = acceptInvite({ roster, invite: findInvite(pending, i.token) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.member).sort()).toEqual(["acceptedAt", "email", "name", "role"]);
  });
});
