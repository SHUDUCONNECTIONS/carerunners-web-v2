// src/utils/tripPricing.ts
// Server-only. The browser shows the customer a price while they book, but the trip is written
// from the browser, so the saved `price` can't be trusted. Before any charge the server works the
// price out again from the pickup and dropoff addresses (where the driver actually goes) using the
// same pricing table as the booking wizard.
import { calculatePrice } from "@/lib/pricing";
import { SERVICE_TYPES, VEHICLE_TYPES, type ServiceType, type VehicleType } from "@/lib/services";
import { googleDrivingKm } from "./drivingDistance";

export type TripPrice = { price: number; distanceKm: number } | { error: string };

export async function priceTrip(trip: FirebaseFirestore.DocumentData): Promise<TripPrice> {
  const serviceType = trip.serviceType || null;
  if (serviceType !== null && !Object.hasOwn(SERVICE_TYPES, serviceType)) return { error: "Unknown service type." };
  const vehicleType = trip.vehicleType || null;
  if (vehicleType !== null && !Object.hasOwn(VEHICLE_TYPES, vehicleType)) return { error: "Unknown vehicle type." };

  const pickup = typeof trip.pickupLocation === "string" ? trip.pickupLocation.trim() : "";
  const dropoff = typeof trip.dropoffLocation === "string" ? trip.dropoffLocation.trim() : "";
  if (!pickup || !dropoff) return { error: "This trip is missing its pickup or dropoff address." };

  const distanceKm = await googleDrivingKm(pickup, dropoff);
  if (distanceKm === null) {
    return { error: "We couldn't work out the driving distance for this trip. Please check the addresses or try again shortly." };
  }
  return {
    price: calculatePrice(serviceType as ServiceType | null, distanceKm, vehicleType as VehicleType | null),
    distanceKm,
  };
}
