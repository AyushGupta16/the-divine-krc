// Fails if anything that must stay on the server reached the browser bundle.
//
// This exists because tsc, eslint, vitest and `vite build` all passed happily
// while `dist/client` contained the admin password. Nothing in the toolchain
// has an opinion about what ends up in a bundle a stranger can read, so this
// does. Run after `npm run build`; CI runs it on every PR.
//
// How the leaks happened, both worth remembering:
//   1. Route loaders run on the client too, so anything `lib/bookings.ts`
//      imports is public. #12 put passwords in `lib/team.ts` for the Settings
//      roster and shipped them to every visitor.
//   2. `lib/auth.ts` is client-reachable (the login page imports `loginFn`) and
//      a bundler must keep module-level side effects. A seeding loop at module
//      scope dragged `ownerPassword` into the bundle even though the secret
//      itself was folded out.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = "dist/client";

/**
 * Exact strings, not patterns. A regex for /password/i drowns in false hits
 * (autocomplete attributes, placeholder copy, "Passwords don't match"), and a
 * check that cries wolf gets deleted.
 */
const FORBIDDEN = [
  // Mock credentials. Quoted, because bare `krc-admin` also matches the
  // sidebar's `krc-admin-sidebar-collapsed` localStorage key — that false
  // positive cost real time once already.
  { needle: '"krc-admin"', why: "the owner's dev password" },
  { needle: "krc-rahul", why: "a staff dev password" },
  { needle: "krc-sneha", why: "a staff dev password" },
  { needle: "krc-vinod", why: "a staff dev password" },

  // Anything sealed with this can be forged: mint a cookie, skip the login.
  { needle: "krc-dev-session-secret", why: "the dev session secret" },

  // The credential machinery itself. Even when constant folding strips the
  // secret, these appearing means server-only code is being retained again —
  // the leak is one careless line away from returning.
  { needle: "ownerPassword", why: "credential seeding (server-only)" },
  { needle: "unguessable", why: "credential seeding (server-only)" },

  // `process.env` becomes `{}` client-side, so these names surviving means a
  // server-only module got pulled in.
  { needle: "ADMIN_PASSWORD", why: "a server-only env read" },
  { needle: "SESSION_SECRET", why: "a server-only env read" },

  // Guest data. These rows used to live in `lib/bookings.ts`, which loaders
  // import, so every guest's name, email and phone shipped in the entry chunk
  // the landing page hands anonymous visitors. Mock rows made that survivable;
  // spec #14's real ones would not. The fixtures now sit behind
  // `bookings-data.ts`'s server functions — if any of these come back, that
  // boundary has broken and the next leak is somebody's actual phone number.
  //
  // Deliberately NOT guest *names*: "Aarav Mehta" and "Priya" also name the
  // landing page's testimonials, which are public marketing copy and belong in
  // the bundle. An email, a phone and the row ids are unambiguous.
  { needle: "aarav.mehta@example.com", why: "a seeded guest's email" },
  { needle: "98110 22334", why: "a seeded guest's phone number" },
  { needle: "KRC-20260714-001", why: "a seeded booking row" },
  { needle: "PH-20260622-001", why: "a seeded party-hall enquiry" },

  // The database (#12b). `DATABASE_URL` is the production connection string,
  // and this repo is public — it reaching the browser is the worst outcome in
  // this file, since it is read/write access to every real guest record rather
  // than a copy of one page's rows.
  //
  // `neondb_owner` and `.neon.tech` are parts of the URL itself: if the string
  // is ever inlined rather than read from env, the name and host give it away
  // even when the password does not appear verbatim.
  { needle: "DATABASE_URL", why: "the database connection string (server-only env)" },
  { needle: "PGPASSWORD", why: "a database password (server-only env)" },
  { needle: "neondb_owner", why: "the database role — part of the connection string" },
  { needle: ".neon.tech", why: "the database host — part of the connection string" },
  // Server-only modules. These names surviving means the driver got pulled into
  // a client chunk, which means the connection string is one careless line away.
  { needle: "@neondatabase/serverless", why: "the database driver (server-only)" },
  { needle: "drizzle-orm/neon-http", why: "the database client (server-only)" },
];

function jsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (entry.endsWith(".js")) out.push(path);
  }
  return out;
}

let files;
try {
  files = jsFiles(CLIENT_DIR);
} catch {
  console.error(`✗ ${CLIENT_DIR} not found — run \`npm run build\` first.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(
    `✗ no .js files under ${CLIENT_DIR} — did the build actually emit a client bundle?`,
  );
  process.exit(1);
}

const hits = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const { needle, why } of FORBIDDEN) {
    if (source.includes(needle)) hits.push({ file, needle, why });
  }
}

if (hits.length > 0) {
  console.error(`\n✗ ${hits.length} secret(s) reached the client bundle:\n`);
  for (const h of hits) console.error(`  ${h.file}\n    ${h.needle} — ${h.why}`);
  console.error(
    "\nAnything a route loader can reach ships to the browser. Move it behind a\n" +
      "server function, and keep it out of module scope so it tree-shakes away.\n",
  );
  process.exit(1);
}

console.log(`✓ ${files.length} client chunks checked, no credentials found`);
