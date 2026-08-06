import { SERVICE_TYPES, VEHICLE_TYPES, ServiceType, VehicleType } from "@/lib/services";

// Driver payout is a flat share of the trip price, applied once a trip is completed.
export const PAYOUT_RATE = 0.7;

/**
 * Distance-based pricing shared by every booking path (customer wizard,
 * admin price-repair tool). Home & Office Removal sources its base price
 * from the selected vehicle tier instead of the service default; every
 * other service type uses the service's own base price.
 */
export function calculatePrice(
  serviceType: ServiceType | null | undefined,
  distanceKm: number | string,
  vehicleType?: VehicleType | null
): number {
  const distance = typeof distanceKm === "string" ? parseFloat(distanceKm) : distanceKm;

  const service = serviceType ? SERVICE_TYPES[serviceType] : SERVICE_TYPES.legal_logistics;
  const vehicle =
    service.id === "home_office_removal" && vehicleType ? VEHICLE_TYPES[vehicleType] : null;

  const basePrice = vehicle?.basePrice ?? service.basePrice;
  const ratePerKm = vehicle?.ratePerKm ?? service.ratePerKm;

  const price = distance <= 1 ? basePrice : basePrice + (distance - 1) * ratePerKm;
  return Number(price.toFixed(2));
}

export function calculatePayout(price: number | string): number {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return Number((value * PAYOUT_RATE).toFixed(2));
}
