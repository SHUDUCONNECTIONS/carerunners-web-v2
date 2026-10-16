// src/utils/firmSeats.ts
// Server-only. How many people a company may have on its plan, checked on the server so the limit
// can't be skipped from the browser. Members and pending invitations both use a seat.
import type { Firestore } from "firebase-admin/firestore";
import { activePlan } from "@/lib/plans";

// Returns why the company can't add anyone, or null when there is room.
// `countPendingInvites`: pending invitations hold a seat (an invitation already saved counts itself).
// `joining`: people about to become members on top of what is saved.
export async function checkSeats(
  db: Firestore,
  firmId: string,
  opts: { countPendingInvites: boolean; joining?: number }
): Promise<string | null> {
  const firm = (await db.collection("firms").doc(firmId).get()).data();
  const active = activePlan(firm);
  if (!active) return "Your company's plan isn't active. Please pay for a plan first.";
  const [members, invites] = await Promise.all([
    db.collection("users").where("firmId", "==", firmId).count().get(),
    opts.countPendingInvites
      ? db.collection("userInvitations").where("firmId", "==", firmId).where("status", "==", "pending").count().get()
      : null,
  ]);
  const used = members.data().count + (invites?.data().count ?? 0) + (opts.joining ?? 0);
  if (used > active.plan.maxUsers) {
    return `Your ${active.plan.name} plan allows ${active.plan.maxUsers} user${active.plan.maxUsers === 1 ? "" : "s"}. Remove someone or move to a bigger plan.`;
  }
  return null;
}
