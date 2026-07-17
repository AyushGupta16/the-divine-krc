// The database client. Server-only, and the only module that touches the driver.
//
// !! NOTHING CLIENT-REACHABLE MAY IMPORT THIS. !!
//
// `DATABASE_URL` is a production credential and the repo is public. Route
// loaders run in the browser, so anything reachable from `lib/bookings.ts` is
// compiled into `dist/client`. This file is imported only by `bookings-data.ts`,
// `invites.ts` and `auth.ts` — all of whose exports are server functions, whose
// handler bodies never reach the browser — and eslint enforces that.
//
// Lazy on purpose, and the laziness is load-bearing:
//
//   - The URL is read **per call, inside the accessor**, never at module scope.
//     `auth.ts:41-60` is the precedent and its comments say why: throwing at
//     import time takes down the landing page, which is where the property's
//     real WhatsApp bookings come from. A broken /admin is a bad day; a broken
//     landing page is lost business.
//   - `package.json` sets `"sideEffects": false`, which makes a module-scope
//     `drizzle(neon(process.env.DATABASE_URL!))` *look* safe to tree-shake and
//     is exactly why it would bite. #12 shipped credentials to every browser
//     through a module-level side effect once already.
//
// HTTP mode, not TCP: deploy is Netlify Functions (Node Lambda, not Edge), so
// `pg` would work — it is just worse. Lambda freeze/thaw wrecks connection
// pools, and this database scales to zero after 5 minutes idle. Every query is a
// stateless fetch; there is no pool to exhaust. If a genuinely interactive
// transaction ever appears, the same package's WebSocket `Pool` is a one-import
// swap.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/lib/schema";

export type Db = ReturnType<typeof connect>;

function connect(url: string) {
  return drizzle(neon(url), { schema });
}

let cached: Db | undefined;

/**
 * The connection, or `null` when there is no database configured.
 *
 * Null is a real answer, not a failure: local dev deliberately leaves
 * `DATABASE_URL` blank, and the test suite has no database at all. Callers fall
 * back to fixtures there — see `missingDbInProduction` for why that can never
 * happen on a deployed site.
 */
export function db(): Db | null {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = connect(url);
  return cached;
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Whether a deployed environment is missing its database.
 *
 * Blank `DATABASE_URL` under `vite dev` means "use the fixtures". Blank in a
 * built server means somebody shipped a broken deploy, and the console must say
 * so rather than quietly serve mock guests as though they were real bookings.
 * Callers use this to fail closed on the admin side — never to throw at import
 * time, and never anywhere the landing page can reach.
 *
 * Note `NODE_ENV` is **constant-folded at build time**, not read at runtime: this
 * compiles to `return !process.env.DATABASE_URL` in `dist/server`. So the fixture
 * fallback is not merely discouraged in production — it is not in the bundle.
 * Setting `NODE_ENV=development` against a built server will not resurrect it,
 * and that is the point. `vite dev` is the only place it lives.
 */
export function missingDbInProduction(): boolean {
  return isProduction && !process.env.DATABASE_URL;
}
