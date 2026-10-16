import { describe, it, expect, vi, beforeEach } from "vitest";

// Every admin API route must turn away anyone who is not a verified admin, before it reads or writes
// any data. Firestore is mocked to throw, so a route that forgot the check would fail loudly.
vi.mock("@/utils/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/utils/firebaseAdmin", () => ({
  adminDb: vi.fn(() => {
    throw new Error("admin route touched the database without an admin check");
  }),
  adminAuth: vi.fn(() => {
    throw new Error("admin route touched auth without an admin check");
  }),
}));

import { requireAuth } from "@/utils/requireAuth";
import { LEGACY_ADMIN_EMAILS as ADMIN_EMAILS } from "@/utils/adminEmails";

import * as pwaStats from "./pwa-stats/route";
import * as approve from "./marketplace/approve/route";
import * as bulk from "./marketplace/bulk/route";
import * as companies from "./marketplace/companies/route";
import * as issues from "./marketplace/issues/route";
import * as listings from "./marketplace/listings/route";
import * as reviews from "./marketplace/reviews/route";
import * as searches from "./marketplace/searches/route";
import * as settings from "./marketplace/settings/route";

const routes: Record<string, Record<string, (req: any) => Promise<Response>>> = {
  "pwa-stats": pwaStats as any,
  approve: approve as any,
  bulk: bulk as any,
  companies: companies as any,
  issues: issues as any,
  listings: listings as any,
  reviews: reviews as any,
  searches: searches as any,
  settings: settings as any,
};

const handlers = Object.entries(routes).flatMap(([name, mod]) =>
  (["GET", "POST", "PUT", "PATCH", "DELETE"] as const)
    .filter((method) => typeof mod[method] === "function")
    .map((method) => ({ name, method, run: mod[method] }))
);

const request = (method: string) =>
  new Request("http://x/api/admin", {
    method,
    ...(method === "GET" ? {} : { body: JSON.stringify({}) }),
  }) as any;

describe("admin API routes", () => {
  beforeEach(() => vi.mocked(requireAuth).mockReset());

  it("covers every admin handler", () => {
    expect(handlers.length).toBeGreaterThanOrEqual(11);
  });

  describe.each(handlers)("$name $method", ({ run, method }) => {
    it("rejects someone who is not signed in", async () => {
      vi.mocked(requireAuth).mockResolvedValue(null);
      expect((await run(request(method))).status).toBe(403);
    });

    it("rejects a signed-in user who is not an admin", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ uid: "u1", email: "customer@example.com", emailVerified: true } as any);
      expect((await run(request(method))).status).toBe(403);
    });

    it("rejects an admin email that has not been verified", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ uid: "u2", email: ADMIN_EMAILS[0], emailVerified: false } as any);
      expect((await run(request(method))).status).toBe(403);
    });
  });
});
