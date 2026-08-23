// scripts/dev-reset-seed-passwords.mjs
// One-off: reset password_hash for the 3 seed team members on DEV Neon only.
// Run with: npx tsx scripts/dev-reset-seed-passwords.mjs --sneha=<pw> --vinod=<pw>
// Not committed. Not for prod.
//
// shivam@thedivinekrc.in is deliberately excluded: his live `role` is "Owner",
// which authenticates against the ADMIN_PASSWORD env var, not password_hash —
// see the skip message below.

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/lib/schema";
import { hashPassword } from "@/lib/password";

const SEED_EMAILS = {
  sneha: "sneha@thedivinekrc.in",
  vinod: "vinod@thedivinekrc.in",
};

const SHIVAM_EMAIL = "shivam@thedivinekrc.in";

function usage() {
  console.error("Usage: npx tsx scripts/dev-reset-seed-passwords.mjs --sneha=<pw> --vinod=<pw>");
  process.exit(1);
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--(sneha|vinod)=(.+)$/.exec(arg);
    if (m) args[m[1]] = m[2];
  }
  if (!args.sneha || !args.vinod) usage();
  return args;
}

function requireDevDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Refusing to run.");
    process.exit(1);
  }
  if (url.includes("sparkling-sky")) {
    console.error("DATABASE_URL points at the prod branch (sparkling-sky). Refusing to run.");
    process.exit(1);
  }
  return url;
}

async function main() {
  const args = parseArgs();
  const url = requireDevDatabaseUrl();
  const db = drizzle(neon(url), { schema });

  console.log(
    `Skipping ${SHIVAM_EMAIL} — role 'Owner' uses ADMIN_PASSWORD env var, not password_hash. ` +
      "Setting the hash would have no effect on login. Set ADMIN_PASSWORD if you need Owner testing.",
  );

  const passwords = {
    [SEED_EMAILS.sneha]: args.sneha,
    [SEED_EMAILS.vinod]: args.vinod,
    [SEED_EMAILS.shivam]: args.shivam,
  };

  for (const [email, password] of Object.entries(passwords)) {
    const rows = await db.select().from(schema.team).where(eq(schema.team.email, email));
    const row = rows[0];
    if (!row) {
      console.log(`SKIP: ${email} not found in team table.`);
      continue;
    }

    const hash = await hashPassword(password);
    const updated = await db
      .update(schema.team)
      .set({ passwordHash: hash })
      .where(eq(schema.team.email, email))
      .returning({
        email: schema.team.email,
        hashSet: sql`${schema.team.passwordHash} is not null`,
      });

    if (updated[0]?.hashSet === true) {
      console.log(`Reset password for ${email} (role: ${row.role})`);
    } else {
      console.error(`FAILED to verify password_hash for ${email} after update.`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
