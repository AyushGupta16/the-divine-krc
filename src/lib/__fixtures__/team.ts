// The seeded roster and the one open invite.
//
// These used to live in `lib/team.ts`, which is client-reachable — the Settings
// screen renders the roster, so the names and roles shipped to the browser on
// purpose, and the header there still explains why no credential may join them.
// They move here for the same reason the booking rows did in #26: the rows are
// storage, and storage now means Postgres. `team.ts` keeps the rules.
//
// Read by the tests, by `db:seed`, and by `roster.ts` when there is no database
// (local dev). Nothing client-reachable may import this file; eslint enforces it.

import type { Invite, Role, TeamAccount } from "@/lib/team";
import { INVITE_TTL_MS, makeToken } from "@/lib/team";

/** Long enough ago to be uninteresting; the seed pre-dates the console. */
export const SEEDED_AT = Date.parse("2026-01-05T00:00:00Z");

export const team: TeamAccount[] = [
  { email: "admin@thedivinekrc.in", name: "Admin Ayush", role: "Owner", acceptedAt: SEEDED_AT },
  { email: "shivam@thedivinekrc.in", name: "Shivam Gupta", role: "Manager", acceptedAt: SEEDED_AT },
  {
    email: "sneha@thedivinekrc.in",
    name: "Sneha Pillai",
    role: "Front desk",
    acceptedAt: SEEDED_AT,
  },
  { email: "vinod@thedivinekrc.in", name: "Vinod Kumar", role: "Accounts", acceptedAt: SEEDED_AT },
];

/**
 * One invite still open, so the screen has a Pending row to act on.
 *
 * Deliberately just the one — an Expired row is reachable by letting a token die
 * rather than by seeding a corpse, and the tests age this one to prove it.
 *
 * The token is minted per process rather than fixed: a token committed to a
 * public repo is a token anyone can redeem, and this seed reaches production
 * until #14. `db:seed` writes whatever this mints, so the live link is only ever
 * known to whoever ran it.
 */
export function openInvite(role: Role = "Front desk"): Invite {
  const now = Date.now();
  return {
    email: "aarti@thedivinekrc.in",
    role,
    token: makeToken(),
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };
}

export const invites: Invite[] = [openInvite()];
