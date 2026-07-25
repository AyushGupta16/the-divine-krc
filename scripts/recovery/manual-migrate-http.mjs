// Manual migration runner using the HTTP driver (the same one src/lib/db.ts
// uses at runtime), for running `migrate` by hand against a specific branch.
// `drizzle-kit migrate`'s own CLI uses a websocket-based driver and, on a
// migrations-table timestamp-drift failure, hangs and swallows the real error
// behind its spinner (see README.md in this folder) — this script surfaces it.
// Requires DATABASE_URL in the environment, pointed at the branch you mean to
// migrate. Origin: incident diagnosed in PR #55 (see README.md).
// Usage: node scripts/recovery/manual-migrate-http.mjs

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = drizzle(neon(url));

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully.");
} catch (err) {
  console.error("Migration failed:");
  console.error(err);
  process.exit(1);
}
