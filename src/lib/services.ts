import { Package, Shirt, Briefcase, Truck, Bike, Car, CarFront } from "lucide-react";

export type ServiceType =
  | "parcel_delivery"
  | "laundry"
  | "legal_logistics"
  | "home_office_removal";

export type VehicleType = "motorcycle" | "hatchback" | "sedan" | "half_ton_bakkie";

interface ServiceConfig {
  id: ServiceType;
  label: string;
  description: string;
  icon: typeof Package;
  basePrice: number;
  ratePerKm: number;
  /** Label used for the item-description field in the booking wizard. */
  itemFieldLabel: string;
  itemFieldPlaceholder: string;
}

interface VehicleConfig {
  id: VehicleType;
  label: string;
  icon: typeof Package;
  basePrice: number;
  ratePerKm: number;
}

// Every service shares the app's existing distance-pricing floor — choosing a
// category doesn't change the price on its own, only Home & Office Removal's
// vehicle picker does (see VEHICLE_TYPES below).
export const SERVICE_TYPES: Record<ServiceType, ServiceConfig> = {
  parcel_delivery: {
    id: "parcel_delivery",
    label: "Parcel Delivery",
    description: "Send parcels safely and affordably.",
    icon: Package,
    basePrice: 25,
    ratePerKm: 10,
    itemFieldLabel: "Parcel Description",
    itemFieldPlaceholder: "Describe the parcel(s) being transported…",
  },
  laundry: {
    id: "laundry",
    label: "Laundry Collection & Drop-off",
    description: "We collect your laundry and deliver it back fresh and clean.",
    icon: Shirt,
    basePrice: 25,
    ratePerKm: 10,
    itemFieldLabel: "Laundry Details",
    itemFieldPlaceholder: "Describe the laundry items and any care instructions…",
  },
  legal_logistics: {
    id: "legal_logistics",
    label: "Legal Logistics & Records",
    description: "Secure collection and delivery of legal documents & records.",
    icon: Briefcase,
    basePrice: 25,
    ratePerKm: 10,
    itemFieldLabel: "Document Description",
    itemFieldPlaceholder: "Describe the document(s) being transported…",
  },
  home_office_removal: {
    id: "home_office_removal",
    label: "Home & Office Removal",
    description: "Moving made easy. Choose the right vehicle for your move.",
    icon: Truck,
    basePrice: 25,
    ratePerKm: 10,
    itemFieldLabel: "Removal Details",
    itemFieldPlaceholder: "Describe the items being moved…",
  },
};

export const SERVICE_TYPE_LIST = Object.values(SERVICE_TYPES);

// Only relevant when serviceType === "home_office_removal". Motorcycle,
// hatchback and sedan intentionally reuse the app's standard base price —
// only the half ton bakkie has a distinct (higher) base.
export const VEHICLE_TYPES: Record<VehicleType, VehicleConfig> = {
  motorcycle: { id: "motorcycle", label: "Motorcycle", icon: Bike, basePrice: 25, ratePerKm: 10 },
  hatchback: { id: "hatchback", label: "Hatchback", icon: Car, basePrice: 25, ratePerKm: 10 },
  sedan: { id: "sedan", label: "Sedan", icon: CarFront, basePrice: 25, ratePerKm: 10 },
  half_ton_bakkie: { id: "half_ton_bakkie", label: "Half Ton Bakkie", icon: Truck, basePrice: 400, ratePerKm: 10 },
};

export const VEHICLE_TYPE_LIST = Object.values(VEHICLE_TYPES);
