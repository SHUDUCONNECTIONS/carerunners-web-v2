// src/utils/rateLimit.ts
// Server-only. A small shared limiter (counts live in Firestore, so it holds across server instances):
// "no more than `limit` requests per `windowSec` seconds for this key". Returns true when over the limit.
//
// Each check costs a Firestore transaction, so an attacker hammering a route would also run up the bill.
// To stop that, every instance remembers recent counts in memory and turns a caller away *without*
// touching Firestore once they are over the limit on this instance. The Firestore count is still the
// authority across instances; the memory is only a cheap early "no".
import { Timestamp, type Firestore } from "firebase-admin/firestore";

type Local = { windowStart: number; count: number };
const local = new Map<string, Local>();
const MAX_LOCAL_KEYS = 5000;

function overLocally(key: string, limit: number, windowSec: number, now: number): boolean {
  const entry = local.get(key);
  if (!entry || now - entry.windowStart > windowSec * 1000) {
    if (local.size >= MAX_LOCAL_KEYS) {
      for (const [k, v] of local) if (now - v.windowStart > windowSec * 1000) local.delete(k);
      if (local.size >= MAX_LOCAL_KEYS) local.clear();
    }
    local.set(key, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > limit * 2;
}

export function resetLocalRateLimits() {
  local.clear();
}

export async function isRateLimited(db: Firestore, key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  // Twice the limit locally: the Firestore count (below) is the real decision; this only cuts off floods.
  if (overLocally(key, limit, windowSec, now)) return true;

  const ref = db.collection("rateLimits").doc(key.replace(/[\/\s]/g, "_"));
  // `expiresAt` lets a Firestore TTL policy on rateLimits clear old counters automatically.
  const expiresAt = Timestamp.fromMillis(now + windowSec * 2000);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const start = snap.data()?.windowStart as number | undefined;
    if (!snap.exists || start === undefined || now - start > windowSec * 1000) {
      tx.set(ref, { windowStart: now, count: 1, expiresAt });
      return false;
    }
    const count = (snap.data()!.count as number) + 1;
    tx.update(ref, { count, expiresAt });
    return count > limit;
  });
}
