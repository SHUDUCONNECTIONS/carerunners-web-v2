import { Package, Shirt, Briefcase, Truck } from "lucide-react";

export type ServiceType =
  | "parcel_delivery"
  | "laundry"
  | "legal_logistics"
  | "home_office_removal";

export type VehicleType = "mini_van" | "small" | "medium" | "large" | "extra_large";

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
  image: string;
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

// Only relevant when serviceType === "home_office_removal". All five tiers
// share the same R500 base price and R10/km rate.
export const VEHICLE_TYPES: Record<VehicleType, VehicleConfig> = {
  mini_van: { id: "mini_van", label: "Mini Van", icon: Truck, image: "/vehicles/mini-van.svg", basePrice: 500, ratePerKm: 10 },
  small: { id: "small", label: "Small", icon: Truck, image: "/vehicles/small.svg", basePrice: 500, ratePerKm: 10 },
  medium: { id: "medium", label: "Medium", icon: Truck, image: "/vehicles/medium.svg", basePrice: 500, ratePerKm: 10 },
  large: { id: "large", label: "Large", icon: Truck, image: "/vehicles/large.svg", basePrice: 500, ratePerKm: 10 },
  extra_large: { id: "extra_large", label: "Extra Large", icon: Truck, image: "/vehicles/extra-large.svg", basePrice: 500, ratePerKm: 10 },
};

export const VEHICLE_TYPE_LIST = Object.values(VEHICLE_TYPES);
