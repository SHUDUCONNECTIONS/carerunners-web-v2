import { normalizeStatus } from "@/lib/tripStatus";

// What a rider is told when their trip reaches each step. Steps not listed here (booked, awaiting
// payment) don't send a push: the rider caused them and already knows.
const RIDER_MESSAGES: Record<string, { title: string; body: string }> = {
  assigned: { title: "Runner assigned", body: "A Care Runners driver has accepted your request." },
  "picked-up": { title: "Picked up", body: "Your runner has collected your item." },
  "in-transit": { title: "On the way", body: "Your item is on its way." },
  delivered: { title: "Delivered", body: "Your item has been delivered. Please rate your runner." },
  completed: { title: "Trip complete", body: "Your trip is complete." },
};

export function riderTripMessage(rawStatus: string | null | undefined) {
  return RIDER_MESSAGES[normalizeStatus(rawStatus)] ?? null;
}
