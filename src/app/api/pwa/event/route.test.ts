import { describe, it, expect, vi, beforeEach } from "vitest";

const set = vi.fn();
vi.mock("@/utils/firebaseAdmin", () => ({
  adminDb: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: () => undefined }), set }) }) }),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const req = (body: unknown, ip = "1.1.1.1") =>
  new NextRequest("http://localhost/api/pwa/event", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/pwa/event", () => {
  beforeEach(() => set.mockClear());

  it("rejects malformed JSON", async () => {
    expect((await POST(req("{nope", "2.2.2.2"))).status).toBe(400);
  });

  it("rejects a device id that is not a UUID", async () => {
    expect((await POST(req({ deviceId: "abc", type: "launch" }, "3.3.3.3"))).status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects unknown event types", async () => {
    expect((await POST(req({ deviceId: ID, type: "bogus" }, "4.4.4.4"))).status).toBe(400);
  });

  it("records a valid event", async () => {
    const res = await POST(req({ deviceId: ID, type: "launch", platform: "ios" }, "5.5.5.5"));
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toMatchObject({ platform: "ios" });
  });

  it("rate-limits one IP after 30 requests a minute", async () => {
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await POST(req({ deviceId: ID, type: "launch" }, "9.9.9.9"))).status;
    expect(last).toBe(429);
  });
});
