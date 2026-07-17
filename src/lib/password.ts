// Password hashing. Server-only, and deliberately Node core.
//
// scrypt ships with Node: no native module to build, nothing extra to bundle
// onto Lambda, and no dependency that could later pull a roster of its own. That
// last part matters more than it sounds — adopting a provider's auth would mean
// a second list of who may log in, drifting from `lib/team.ts`, which is the bug
// #18 fixed. One roster, always.
//
// Format: `scrypt$N$r$p$<salt-b64>$<hash-b64>`. Self-describing on purpose — the
// parameters travel with the hash, so raising the cost later verifies old rows
// with their own settings instead of locking everyone out.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// Node's default cost. ~100ms and ~32MB per hash, which is the point: a login is
// once per session, and a stolen table is worth nothing without the compute.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
// scrypt's own guard is 32MB and `N=16384, r=8` sits just under it; give it room
// rather than have hashing throw in production the first time someone logs in.
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/**
 * Whether `password` produced `stored`.
 *
 * Never throws on a malformed hash and never reports *why* it failed: a caller
 * cannot tell a bad password from a corrupt row, and neither can an attacker.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, salt64, hash64] = parts;
  const [nN, nR, nP] = [Number(n), Number(r), Number(p)];
  if (!nN || !nR || !nP) return false;

  const expected = Buffer.from(hash64, "base64");
  if (expected.length === 0) return false;

  try {
    const actual = await scrypt(password, Buffer.from(salt64, "base64"), expected.length, {
      N: nN,
      r: nR,
      p: nP,
      maxmem: MAXMEM,
    });
    // Lengths match by construction, so this is a real constant-time compare
    // rather than one that leaks through a thrown length mismatch.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Constant-time compare for a secret that is not hashed — the Owner's
 * ADMIN_PASSWORD, which lives in the env and never in the table.
 */
export function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length. Compare lengths only after both buffers exist, and always run the
  // comparison against something of the right size.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
