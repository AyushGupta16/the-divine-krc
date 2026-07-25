# Recovery: migration journal drift

## The failure mode

`drizzle-kit migrate` (and drizzle-orm's `migrate()` under the hood) decides
what to apply by looking at **one row**: the single latest entry in
`drizzle.__drizzle_migrations`, ordered by `created_at`. Anything in
`drizzle/meta/_journal.json` with a newer `when` than that one row's
`created_at` gets (re-)applied.

If that latest row's `created_at` is stale — older than what the current
`_journal.json` says for a migration that has, in fact, already run against
that branch — `migrate` wrongly concludes the migration is still pending,
tries to re-run its `CREATE TABLE` / `ALTER TABLE` statements, and dies with
`relation "X" already exists` before ever reaching the real, later gap. The
CLI's spinner swallows the actual error, so what you see is a hang followed by
a bare non-zero exit code and nothing else.

This is not a one-time fat-finger. The trigger is drift between a branch's
migration bookkeeping and `_journal.json`'s timestamps — that can happen again
from a Neon branch reset/snapshot, a `db:push` run against a branch that
skips `migrate`'s bookkeeping, or forking a new environment from a branch
whose journal was already drifted. Expect to need this again.

## How to recognize it

- A route or admin screen 500s with `Failed query: select ... from <table>`
  and the error mentions a column that a recent migration added.
- `npm run db:migrate` (or `npx drizzle-kit migrate`) against that branch just
  hangs at `applying migrations...` and exits non-zero with no further output.
- Running `manual-migrate-http.mjs` against the same branch prints the real
  error: `relation "X" already exists` for some table from an *earlier*
  migration than the one you actually need.

## How to fix it

1. Point `DATABASE_URL` at the affected branch specifically (never guess —
   confirm which branch/environment it is first, e.g. via the Neon console).
2. Run `manual-migrate-http.mjs` to see the real error and identify which
   already-applied migration tag it's stuck retrying.
3. Run `backfill-migration-journal.mjs <that-tag>` — it inserts one correct
   journal row for that tag (read from `_journal.json`, not hand-typed), which
   lets `migrate` correctly resume after it.
4. Re-run `manual-migrate-http.mjs` — it should now apply only the real,
   later migrations that were actually missing.
5. Verify against the live app (curl the affected routes), not just a clean
   exit code.

## Origin

First diagnosed on PR #55 (the `/hotel-near-pari-chowk` landmark page): the
Neon `dev` branch — used by Netlify's preview and branch deploys — had a
drifted timestamp recorded for `0006_party_hall_contact_and_invoices`, which
blocked `0007_booking_batch_id` from ever applying and 500'd every route that
reads bookings/room data, including the marketing pages, not just the admin
console.
