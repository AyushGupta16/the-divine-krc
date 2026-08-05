// drizzle-kit config: generates SQL from `src/lib/schema.ts` into `drizzle/`.
//
// `generate` needs no database — it diffs the schema against the committed SQL,
// so it runs offline and in CI. Only `migrate` connects, and that happens in one
// place: the GitHub Action on push to `main`. Never `push` at production; it is
// a dev-branch tool, and the committed SQL is what gets reviewed.
//
// NEVER EDIT AN APPLIED MIGRATION. `migrate` tracks what's run by hashing each
// file's content; editing a migration that already ran against any shared
// database changes its hash, so `migrate` no longer recognizes it as applied
// and replays the whole file — including the original `ADD COLUMN`s, which
// then fail on "column already exists" because they're still there from the
// first run. Always add a new migration instead, even for "just one more
// column" on a migration that hasn't merged yet: if it's already reached a
// shared database (dev/preview included, not just production), it's applied.
// This is what PR #79 had to revert 0010 for, and what 0012 was added as a
// separate migration to avoid repeating on 0011.

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only read by `migrate`. Blank locally, which is why `generate` must not
    // need it.
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
