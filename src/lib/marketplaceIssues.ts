// "Report a problem" on a MarketPortal order. A buyer reports it, an admin works it and records the outcome.
// Refunds are still paid by an admin; this keeps the request, the evidence and the decision in one place.
export const ISSUES_COLLECTION = "marketplaceIssues";
export const ISSUE_WINDOW_DAYS = 14;
export const MAX_ISSUE_TEXT = 1000;

export const ISSUE_REASONS = [
  { id: "not-delivered", label: "My order didn't arrive" },
  { id: "damaged", label: "An item arrived damaged" },
  { id: "not-as-described", label: "An item isn't as described" },
  { id: "missing-items", label: "Items are missing" },
  { id: "other", label: "Something else" },
] as const;

export type IssueReasonId = (typeof ISSUE_REASONS)[number]["id"];
export type IssueStatus = "open" | "resolved" | "rejected";

export const reasonLabel = (id: string) => ISSUE_REASONS.find((r) => r.id === id)?.label ?? "Something else";

export interface IssueView {
  id: string;
  orderId: string;
  title: string;
  reason: string;
  description: string;
  status: IssueStatus;
  adminNote: string;
  buyerEmail: string;
  createdAt: number;
}

export function parseIssue(b: any): { error: string } | { orderId: string; reason: IssueReasonId; description: string } {
  const orderId = typeof b?.orderId === "string" ? b.orderId : "";
  const reason = ISSUE_REASONS.find((r) => r.id === b?.reason)?.id;
  const description = typeof b?.description === "string" ? b.description.trim() : "";
  if (!orderId) return { error: "Choose the order." };
  if (!reason) return { error: "Choose what went wrong." };
  if (description.length < 10) return { error: "Please describe the problem in a few words so we can help." };
  if (description.length > MAX_ISSUE_TEXT) return { error: `Keep it under ${MAX_ISSUE_TEXT} characters.` };
  return { orderId, reason, description };
}

// Reports are accepted for a fixed number of days after the order was placed.
export function withinIssueWindow(createdAtMs: number, now = Date.now()): boolean {
  return createdAtMs > 0 && now - createdAtMs <= ISSUE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
