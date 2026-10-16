import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRateLimited, resetLocalRateLimits } from "./rateLimit";

// A Firestore fake with just collection().doc() and runTransaction(), counting transactions.
function fakeDb() {
  const store: Record<string, any> = {};
  const db = {
    transactions: 0,
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: async (fn: any) => {
      db.transactions += 1;
      const tx = {
        get: async (ref: { id: string }) => ({ exists: ref.id in store, data: () => store[ref.id] }),
        set: (ref: { id: string }, v: any) => void (store[ref.id] = v),
        update: (ref: { id: string }, v: any) => void (store[ref.id] = { ...store[ref.id], ...v }),
      };
      return fn(tx);
    },
  };
  return db;
}

describe("isRateLimited", () => {
  beforeEach(() => {
    resetLocalRateLimits();
    vi.useRealTimers();
  });

  it("allows up to the limit then blocks", async () => {
    const db = fakeDb();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await isRateLimited(db as any, "k", 3, 60));
    expect(results).toEqual([false, false, false, true]);
  });

  it("keeps keys separate", async () => {
    const db = fakeDb();
    for (let i = 0; i < 3; i++) await isRateLimited(db as any, "a", 3, 60);
    expect(await isRateLimited(db as any, "b", 3, 60)).toBe(false);
  });

  it("stops touching Firestore once a caller floods past the limit", async () => {
    const db = fakeDb();
    for (let i = 0; i < 50; i++) await isRateLimited(db as any, "flood", 3, 60);
    // Only the first few (up to twice the limit) reach Firestore.
    expect(db.transactions).toBeLessThanOrEqual(6);
  });

  it("starts a fresh window after the time is up", async () => {
    vi.useFakeTimers();
    const db = fakeDb();
    for (let i = 0; i < 4; i++) await isRateLimited(db as any, "w", 3, 60);
    vi.advanceTimersByTime(61_000);
    expect(await isRateLimited(db as any, "w", 3, 60)).toBe(false);
  });
});
