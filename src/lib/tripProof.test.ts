import { describe, expect, it } from "vitest"
import { needsPhotoProof } from "./tripProof"

describe("needsPhotoProof", () => {
  it("asks for photos on parcels, laundry and removals", () => {
    expect(needsPhotoProof({ serviceType: "parcel_delivery" })).toBe(true)
    expect(needsPhotoProof({ serviceType: "laundry" })).toBe(true)
    expect(needsPhotoProof({ serviceType: "home_office_removal" })).toBe(true)
  })

  it("doesn't on legal runs or older bookings without a service", () => {
    expect(needsPhotoProof({ serviceType: "legal_logistics" })).toBe(false)
    expect(needsPhotoProof({})).toBe(false)
    expect(needsPhotoProof({ serviceType: null })).toBe(false)
  })
})
