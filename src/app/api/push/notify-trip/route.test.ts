import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/rateLimit", () => ({ isRateLimited: vi.fn(async () => false) }));
vi.mock("@/utils/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/utils/firebaseAdmin", () => ({ adminDb: vi.fn() }));
vi.mock("@/utils/requireAdmin", () => ({ isAdminUser: vi.fn(() => false) }));
vi.mock("@/utils/pushServer", () => ({ sendPushToUser: vi.fn() }));

import { NextRequest } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { sendPushToUser } from "@/utils/pushServer";
import { POST } from "./route";

function setup(trip: Record<string, unknown> | undefined) {
  const update = vi.fn(async () => {});
  vi.mocked(adminDb).mockReturnValue({
    collection: () => ({ doc: () => ({ get: async () => ({ data: () => trip }), update }) }),
  } as any);
  return update;
}
const req = (body: unknown) => new NextRequest("http://localhost/api/push/notify-trip", { method: "POST", body: JSON.stringify(body) });
const driver = () => vi.mocked(requireAuth).mockResolvedValue({ uid: "d1", email: "d@x.com", emailVerified: true });

describe("POST /api/push/notify-trip", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects callers who are not signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null);
    expect((await POST(req({ tripId: "t1" }))).status).toBe(401);
  });

  it("rejects someone who is not the trip's driver", async () => {
    driver();
    setup({ driverId: "someone-else", userId: "r1", status: "assigned" });
    expect((await POST(req({ tripId: "t1" }))).status).toBe(403);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("pushes the rider named on the trip, not anyone named in the request", async () => {
    driver();
    const update = setup({ driverId: "d1", userId: "r1", status: "assigned" });
    vi.mocked(sendPushToUser).mockResolvedValue(2);
    const res = await POST(req({ tripId: "t1", userId: "attacker" }));
    expect(await res.json()).toEqual({ sent: 2 });
    expect(vi.mocked(sendPushToUser).mock.calls[0][0]).toBe("r1");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("only pushes each step once", async () => {
    driver();
    setup({ driverId: "d1", userId: "r1", status: "assigned", pushNotified: { assigned: {} } });
    expect(await (await POST(req({ tripId: "t1" }))).json()).toEqual({ sent: 0 });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("sends nothing for steps without a message", async () => {
    driver();
    setup({ driverId: "d1", userId: "r1", status: "cancelled" });
    expect(await (await POST(req({ tripId: "t1" }))).json()).toEqual({ sent: 0 });
  });

  it("releases the step if sending fails so it can be retried", async () => {
    driver();
    const update = setup({ driverId: "d1", userId: "r1", status: "assigned" });
    vi.mocked(sendPushToUser).mockRejectedValue(new Error("fcm down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(req({ tripId: "t1" }))).status).toBe(500);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
