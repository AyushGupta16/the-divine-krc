// Repairs a branch whose drizzle.__drizzle_migrations table has fallen out of
// sync with drizzle/meta/_journal.json — the specific failure mode is a stale
// `created_at` recorded for some already-applied migration (older than that
// migration's current journal timestamp). `drizzle-kit migrate` (and the HTTP
// migrator in manual-migrate-http.mjs) only compares journal timestamps against
// the single latest recorded row — see readMigrationFiles/migrate in
// node_modules/drizzle-orm/{migrator,neon-http/migrator}.js — so a drifted
// timestamp makes it think an applied migration is still pending, retries it,
// and dies on "relation already exists" before ever reaching the real gap.
//
// This inserts one correct journal row for the given already-applied tag, so
// the next `migrate` run correctly resumes after it. See README.md in this
// folder for the full failure mode and how to recognize it, and PR #55 for
// the incident this was first built for (tag was 0006_party_hall_contact_and_invoices).
//
// Usage: node scripts/recovery/backfill-migration-journal.mjs <tag>
//   <tag> is the migration file's tag as it appears in drizzle/meta/_journal.json,
//   e.g. "0006_party_hall_contact_and_invoices". Its "when" value is read from
//   that journal entry, not hardcoded, so this works for any future drifted tag.

import fs from "node:fs";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node scripts/recovery/backfill-migration-journal.mjs <migration-tag>");
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync("./drizzle/meta/_journal.json").toString());
const entry = journal.entries.find((e) => e.tag === tag);
if (!entry) {
  console.error(`No journal entry for tag "${tag}" in drizzle/meta/_journal.json`);
  process.exit(1);
}
const when = entry.when;

const query = fs.readFileSync(`./drizzle/${tag}.sql`).toString();
const hash = crypto.createHash("sha256").update(query).digest("hex");

const sql = neon(url);

const existing = await sql`select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`;
console.log("Current latest recorded migration row:", existing[0] ?? "(none)");

if (existing[0] && Number(existing[0].created_at) >= when) {
  console.log(`Latest recorded migration is already at or past ${tag} — not inserting. Stopping.`);
  process.exit(0);
}

await sql`insert into drizzle.__drizzle_migrations ("hash", "created_at") values (${hash}, ${when})`;
console.log(`Inserted journal row for ${tag}.`);
