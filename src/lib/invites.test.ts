import { beforeEach, describe, expect, it } from "vitest";

import { getSettingsPageData } from "@/lib/bookings";
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
  invites,
  isActive,
  passwordProblem,
  refreshInvite,
  revokeInvite,
  team,
  type Invite,
  type Role,
} from "@/lib/team";

// These call the same functions the server functions in `invites.ts` call —
// those add a permission check and an email stub and nothing else, so the
// lifecycle is tested here as it actually ships, not as a copy of itself.

const SEEDED_TEAM = [...team];
const SEEDED_INVITES = [...invites];

beforeEach(() => {
  team.splice(0, team.length, ...SEEDED_TEAM.map((m) => ({ ...m })));
  invites.splice(0, invites.length, ...SEEDED_INVITES.map((i) => ({ ...i })));
});

/** Send an invite and hand back the row it created. */
function send(email: string, role: Role = "Front desk"): Invite {
  const res = createInvite({ email, role });
  if (!res.ok) throw new Error(res.error);
  return res.invite;
}

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
    expect(createInvite({ email: "x@krc.in", role: "Owner" as Role }).ok).toBe(false);
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
    expect(acceptInvite(i.token).ok).toBe(true);

    const member = findMember("priya@thedivinekrc.in")!;
    expect(member.role).toBe("Accounts");

    // The acceptance criterion, end to end: they land on the roster Settings
    // renders. That screen keeps no list of its own, so this cannot pass by
    // coincidence — it reads the store the invite just wrote to.
    const { team: roster } = await getSettingsPageData();
    const row = roster.find((m) => m.email === "priya@thedivinekrc.in");
    expect(row).toBeDefined();
    expect(row!.role).toBe("Accounts");
    expect(row!.name).toBe("Priya");
  });

  it("keeps someone invited but undecided off the roster entirely", async () => {
    send("nobody@thedivinekrc.in");

    // On the roster you are a person with keys, and they have not taken theirs.
    const { team: roster } = await getSettingsPageData();
    expect(roster.map((m) => m.email)).not.toContain("nobody@thedivinekrc.in");
  });

  it("rejects an expired token and creates nobody", () => {
    const i = send("late@thedivinekrc.in", "Manager");
    i.expiresAt = Date.now() - 1;

    const res = acceptInvite(i.token);
    expect(res.ok).toBe(false);
    expect(findMember("late@thedivinekrc.in")).toBeUndefined();
  });

  it("burns the token on the way in, so an invite works exactly once", () => {
    const i = send("once@thedivinekrc.in");

    expect(acceptInvite(i.token).ok).toBe(true);
    const joined = findMember("once@thedivinekrc.in")!.acceptedAt;
    expect(findInvite(i.token)).toBeUndefined();
    // A forwarded link cannot be replayed to seize the account.
    expect(acceptInvite(i.token).ok).toBe(false);
    expect(findMember("once@thedivinekrc.in")!.acceptedAt).toBe(joined);
  });

  it("refuses a password too short to be worth having, and lets them retry", () => {
    const i = send("weak@thedivinekrc.in");

    // `acceptInviteFn` checks this before spending the token, so a rejected
    // password leaves the invite usable rather than stranding them.
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("a-good-password")).toBeNull();
    expect(findInvite(i.token)).toBeDefined();
    expect(acceptInvite(i.token).ok).toBe(true);
  });

  it("gives a resent invite a new token and lets the old link die", () => {
    const i = send("resend@thedivinekrc.in");
    const old = i.token;

    const res = refreshInvite(old);
    expect(res.ok).toBe(true);

    expect(findInvite(old)).toBeUndefined();
    expect(acceptInvite(old).ok).toBe(false);
    expect(acceptInvite(i.token).ok).toBe(true);
  });

  it("revives an expired invite when it is re-sent, rather than stranding them", () => {
    const i = send("lapsed@thedivinekrc.in");
    i.expiresAt = Date.now() - 1;

    expect(refreshInvite(i.token).ok).toBe(true);
    expect(acceptInvite(i.token).ok).toBe(true);
  });

  it("revokes an invite so the link stops working", () => {
    const i = send("revoked@thedivinekrc.in");

    expect(revokeInvite(i.token).ok).toBe(true);
    expect(acceptInvite(i.token).ok).toBe(false);
    expect(findMember("revoked@thedivinekrc.in")).toBeUndefined();
    // Revoking twice is a no-op, not a crash.
    expect(revokeInvite(i.token).ok).toBe(false);
  });

  it("holds one invite per person, so re-inviting cannot leave two live links", () => {
    const first = send("dup@thedivinekrc.in");
    const second = send("DUP@thedivinekrc.in", "Accounts");

    expect(invites.filter((x) => x.email === "dup@thedivinekrc.in")).toHaveLength(1);
    expect(findInvite(first.token)).toBeUndefined();
    expect(acceptInvite(second.token).ok).toBe(true);
    // The role that lands is the one from the invite they actually used.
    expect(findMember("dup@thedivinekrc.in")!.role).toBe("Accounts");
  });

  it("will not invite someone who is already on the team", () => {
    // Cased differently on purpose: the guard has to normalize before it looks.
    const existing = team[1].email;
    const res = createInvite({ email: existing.toUpperCase(), role: "Manager" });
    expect(res.ok).toBe(false);
    expect(invites.some((i) => i.email === existing)).toBe(false);
  });

  it("will not send an invite to something that is not an address", () => {
    for (const bad of ["", "  ", "nobody", "no@body", "@krc.in"]) {
      expect(createInvite({ email: bad, role: "Front desk" }).ok).toBe(false);
    }
    expect(invites).toHaveLength(SEEDED_INVITES.length);
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
    expect(findInviteByEmail("  MIXED.CASE@THEDIVINEKRC.IN  ")).toBeDefined();
    expect(findMember("ADMIN@thedivinekrc.in")).toBeDefined();
  });
});

describe("the seeded roster", () => {
  it("ships one open invite, so the screen has a pending row to act on", () => {
    expect(SEEDED_INVITES).toHaveLength(1);
    const [seed] = invites;
    expect(seed.expiresAt).toBeGreaterThan(Date.now());
    expect(seed.expiresAt - seed.createdAt).toBe(INVITE_TTL_MS);
  });

  it("only lets people who have accepted sign in", () => {
    // `verify` in auth.ts applies this same filter, which is why an invited but
    // undecided person cannot log in despite being known to the system.
    expect(findMember("admin@thedivinekrc.in")!.role).toBe("Owner");
    expect(findMember("aarti@thedivinekrc.in")).toBeUndefined();
    for (const m of team) expect(isActive(m)).toBe(true);
  });

  it("keeps every credential out of this module, and so out of the browser", () => {
    // The regression that made this file exist: #12 held passwords beside the
    // roster, `bookings.ts` imports the roster for Settings, route loaders run
    // on the client — and `krc-admin` landed in dist/client. A TeamAccount must
    // carry no secret, only the fact that one exists elsewhere.
    for (const m of team) {
      expect(Object.keys(m).sort()).toEqual(["acceptedAt", "email", "name", "role"]);
    }
    const source = JSON.stringify(team) + JSON.stringify(invites);
    expect(source).not.toMatch(/password|secret/i);
  });
});
