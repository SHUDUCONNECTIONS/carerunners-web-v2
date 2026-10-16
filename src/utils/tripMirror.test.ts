import { describe, expect, it, vi } from "vitest"

vi.mock("@/utils/firebaseAdmin", () => ({ adminDb: vi.fn(), adminRtdb: vi.fn() }))

import { mirrorPatch } from "./tripMirror"

describe("mirrorPatch", () => {
  it("copies the fields that change after booking", () => {
    expect(mirrorPatch({ status: "pending", payment_status: "paid", driverId: "d1", price: 99 })).toEqual({
      status: "pending",
      payment_status: "paid",
      driverId: "d1",
    })
  })

  it("clears a field the trip no longer has", () => {
    expect(mirrorPatch({ status: "cancelled", payment_status: "refunded" })).toEqual({
      status: "cancelled",
      payment_status: "refunded",
      driverId: null,
    })
  })
})
