import { Clock, UserCheck, Package, Navigation, CheckCircle, Star } from "lucide-react";

// Canonical trip lifecycle. "awaiting-payment" precedes step 1 (set by the
// booking wizard before checkout) and "cancelled" is a terminal state
// reachable from anywhere — neither appears in the numbered 6-step flow.
export type TripStatus =
  | "awaiting-payment"
  | "pending"
  | "assigned"
  | "picked-up"
  | "in-transit"
  | "delivered"
  | "completed"
  | "cancelled";

// Trips written before this lifecycle existed use an older, inconsistent set
// of status strings (see driver/dashboard and trips/tracking history). This
// map lets every page normalize a raw Firestore value without a data
// migration — old trips keep working, new trips write canonical values only.
const LEGACY_STATUS_MAP: Record<string, TripStatus> = {
  accepted: "assigned",
  "in-progress": "in-transit",
  "out-for-delivery": "in-transit",
  arrived: "in-transit",
};

export function normalizeStatus(raw: string | null | undefined): TripStatus {
  if (!raw) return "pending";
  return (LEGACY_STATUS_MAP[raw] ?? raw) as TripStatus;
}

interface StepMeta {
  status: TripStatus;
  label: string;
  icon: typeof Clock;
  time: string;
}

// The 6-step flow shown to customers: Book -> Assign -> Pick Up -> In Transit -> Deliver -> Complete.
export const TRIP_STEPS: StepMeta[] = [
  { status: "pending", label: "Booked", icon: Clock, time: "Scheduled pickup time" },
  { status: "assigned", label: "Runner Assigned", icon: UserCheck, time: "A runner has accepted your request" },
  { status: "picked-up", label: "Picked Up", icon: Package, time: "Runner has collected your item" },
  { status: "in-transit", label: "In Transit", icon: Navigation, time: "Your item is on the way" },
  { status: "delivered", label: "Delivered", icon: CheckCircle, time: "Item delivered — please rate your runner" },
  { status: "completed", label: "Complete", icon: Star, time: "Trip complete" },
];

const STATUS_TO_STEP_INDEX: Record<TripStatus, number> = {
  "awaiting-payment": 0,
  pending: 0,
  assigned: 1,
  "picked-up": 2,
  "in-transit": 3,
  delivered: 4,
  completed: 5,
  cancelled: 0,
};

export function getStepIndex(rawStatus: string | null | undefined): number {
  return STATUS_TO_STEP_INDEX[normalizeStatus(rawStatus)] ?? 0;
}

export const STATUS_LABEL: Record<TripStatus, string> = {
  "awaiting-payment": "Awaiting Payment",
  pending: "Pending",
  assigned: "Assigned",
  "picked-up": "Picked Up",
  "in-transit": "In Transit",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function getStatusLabel(rawStatus: string | null | undefined): string {
  return STATUS_LABEL[normalizeStatus(rawStatus)] ?? "Pending";
}

// Badge styling (bg/text/border), keyed by canonical status.
export const STATUS_BADGE_CLASS: Record<TripStatus, string> = {
  "awaiting-payment": "bg-gray-100 text-gray-500 border border-gray-200",
  pending: "bg-orange-100 text-orange-700 border border-orange-200",
  assigned: "bg-blue-100 text-blue-700 border border-blue-200",
  "picked-up": "bg-purple-100 text-purple-700 border border-purple-200",
  "in-transit": "bg-yellow-100 text-yellow-700 border border-yellow-200",
  delivered: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  completed: "bg-green-100 text-green-700 border border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
};

export function getStatusBadgeClass(rawStatus: string | null | undefined): string {
  return STATUS_BADGE_CLASS[normalizeStatus(rawStatus)] ?? STATUS_BADGE_CLASS.pending;
}

// Left accent-strip color, used on driver trip cards.
export const STATUS_ACCENT_CLASS: Record<TripStatus, string> = {
  "awaiting-payment": "border-gray-300",
  pending: "border-orange-400",
  assigned: "border-blue-500",
  "picked-up": "border-purple-500",
  "in-transit": "border-yellow-400",
  delivered: "border-indigo-500",
  completed: "border-green-500",
  cancelled: "border-gray-300",
};

export function getStatusAccentClass(rawStatus: string | null | undefined): string {
  return STATUS_ACCENT_CLASS[normalizeStatus(rawStatus)] ?? STATUS_ACCENT_CLASS.pending;
}
