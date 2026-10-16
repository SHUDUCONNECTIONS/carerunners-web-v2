// Which trips need the driver's photos at collection and at delivery. Parcels (MarketPortal deliveries included),
// laundry and removals do; Legal Logistics & Records doesn't, and neither do older bookings that have no service
// set (those are all court and legal runs). firebase-rules/firestore.rules applies the same list.
import type { ServiceType } from "@/lib/services"

export const PHOTO_PROOF_SERVICES: ServiceType[] = ["parcel_delivery", "laundry", "home_office_removal"]

export function needsPhotoProof(trip: { serviceType?: string | null }): boolean {
  return PHOTO_PROOF_SERVICES.includes(trip.serviceType as ServiceType)
}
