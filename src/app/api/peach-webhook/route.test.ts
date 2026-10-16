import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const KNOWN = "8ac7a4ca8a1b2c3d.uat01-vm-tx01";
const finalize = vi.fn();
vi.mock("@/utils/finalizeCheckout", () => ({ finalizeCheckout: (...a: unknown[]) => finalize(...a) }));
vi.mock("@/utils/firebaseAdmin", () => ({
  adminDb: () => ({
    collection: () => ({ doc: (id: string) => ({ get: async () => ({ exists: id === KNOWN }) }) }),
  }),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const req = (body: string, query = "", type = "application/json") =>
  new NextRequest(`http://localhost/api/peach-webhook${query}`, {
    method: "POST",
    headers: { "content-type": type },
    body,
  });

describe("POST /api/peach-webhook", () => {
  beforeEach(() => {
    finalize.mockReset().mockResolvedValue({ kind: "ok", peachResult: {} });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.PEACH_WEBHOOK_TOKEN;
    vi.restoreAllMocks();
  });

  it("finalizes a known checkout found in a JSON body", async () => {
    const res = await POST(req(JSON.stringify({ payload: { id: KNOWN, amount: "1.00" } })));
    expect(res.status).toBe(200);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize.mock.calls[0][1]).toBe(KNOWN);
  });

  it("finds the checkout id inside an ndc value in a form body", async () => {
    await POST(req(`ndc=${KNOWN}_0f1e2d3c&amount=5.00`, "", "application/x-www-form-urlencoded"));
    expect(finalize.mock.calls[0][1]).toBe(KNOWN);
  });

  it("answers 200 and does nothing for an unknown id", async () => {
    const res = await POST(req(JSON.stringify({ id: "not-a-real-checkout-id" })));
    expect(res.status).toBe(200);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("returns 500 so Peach retries when finalizing fails", async () => {
    finalize.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(req(JSON.stringify({ id: KNOWN })))).status).toBe(500);
  });

  it("rejects a wrong or missing token when one is configured", async () => {
    process.env.PEACH_WEBHOOK_TOKEN = "s3cret";
    expect((await POST(req(JSON.stringify({ id: KNOWN })))).status).toBe(403);
    expect((await POST(req(JSON.stringify({ id: KNOWN }), "?token=nope"))).status).toBe(403);
    expect(finalize).not.toHaveBeenCalled();
    expect((await POST(req(JSON.stringify({ id: KNOWN }), "?token=s3cret"))).status).toBe(200);
    expect(finalize).toHaveBeenCalledTimes(1);
  });
});
