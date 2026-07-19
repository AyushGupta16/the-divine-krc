// drizzle-kit config: generates SQL from `src/lib/schema.ts` into `drizzle/`.
//
// `generate` needs no database — it diffs the schema against the committed SQL,
// so it runs offline and in CI. Only `migrate` connects, and that happens in one
// place: the GitHub Action on push to `main`. Never `push` at production; it is
// a dev-branch tool, and the committed SQL is what gets reviewed.

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
