import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/rateLimit", () => ({ isRateLimited: vi.fn(async () => false) }));
vi.mock("@/utils/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/utils/firebaseAdmin", () => ({ adminDb: vi.fn(), adminAuth: vi.fn() }));
vi.mock("@/utils/firmSeats", () => ({ checkSeats: vi.fn(async () => null) }));

import { NextRequest } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminAuth, adminDb } from "@/utils/firebaseAdmin";
import { checkSeats } from "@/utils/firmSeats";
import { POST } from "./route";

// Tiny in-memory stand-in for the two documents this route touches.
function setup(invitation: Record<string, unknown> | null, existingUser = false) {
  const writes: { set: any[]; update: any[] } = { set: [], update: [] };
  const tx = {
    get: async (ref: { _name: string }) =>
      ref._name === "userInvitations"
        ? { exists: invitation !== null, data: () => invitation ?? undefined }
        : { exists: existingUser, data: () => undefined },
    set: (_ref: unknown, data: unknown) => writes.set.push(data),
    update: (_ref: unknown, data: unknown) => writes.update.push(data),
  };
  vi.mocked(adminDb).mockReturnValue({
    collection: (name: string) => ({ doc: (id: string) => ({ _name: name, _id: id }) }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as any);
  vi.mocked(adminAuth).mockReturnValue({ getUser: async () => ({ displayName: "Test User" }) } as any);
  return writes;
}

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/accept-invitation", { method: "POST", body: JSON.stringify(body) });
const signedIn = (over: Record<string, unknown> = {}) =>
  vi.mocked(requireAuth).mockResolvedValue({ uid: "u1", email: "a@x.com", emailVerified: true, ...over } as any);

describe("POST /api/accept-invitation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(checkSeats).mockResolvedValue(null);
  });

  it("rejects callers who are not signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as any);
    expect((await POST(req({ invitationId: "i1" }))).status).toBe(401);
  });

  it("rejects unverified email addresses", async () => {
    signedIn({ emailVerified: false });
    expect((await POST(req({ invitationId: "i1" }))).status).toBe(403);
  });

  it("requires an invitationId", async () => {
    signedIn();
    expect((await POST(req({}))).status).toBe(400);
  });

  it("404s on an unknown invitation", async () => {
    signedIn();
    setup(null);
    expect((await POST(req({ invitationId: "i1" }))).status).toBe(404);
  });

  it("refuses an invitation that was already used", async () => {
    signedIn();
    setup({ firmId: "f1", email: "a@x.com", status: "accepted" });
    expect((await POST(req({ invitationId: "i1" }))).status).toBe(409);
  });

  it("refuses an invitation sent to a different email", async () => {
    signedIn();
    const writes = setup({ firmId: "f1", email: "other@x.com", status: "pending" });
    expect((await POST(req({ invitationId: "i1" }))).status).toBe(403);
    expect(writes.set).toHaveLength(0);
  });

  it("joins the caller to the invited firm, matching email case-insensitively", async () => {
    signedIn({ email: "A@X.com" });
    const writes = setup({ firmId: "f1", email: "a@x.COM", status: "pending" });
    const res = await POST(req({ invitationId: "i1" }));
    expect(res.status).toBe(200);
    expect(writes.set[0]).toMatchObject({ firmId: "f1", role: "user" });
    expect(writes.update[0]).toMatchObject({ status: "accepted", acceptedBy: "u1" });
  });

  it("refuses to join a company with no seats left on its plan", async () => {
    signedIn();
    const writes = setup({ firmId: "f1", email: "a@x.com", status: "pending" });
    vi.mocked(checkSeats).mockResolvedValue("Your Bronze plan allows 1 user.");
    const res = await POST(req({ invitationId: "i1" }));
    expect(res.status).toBe(409);
    expect(writes.set).toHaveLength(0);
    expect(writes.update).toHaveLength(0);
  });
});
