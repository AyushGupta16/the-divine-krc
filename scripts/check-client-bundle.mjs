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
