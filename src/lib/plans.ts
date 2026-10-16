// Company subscription plans. Shared by the pricing page (to show them) and
// /api/prepare-checkout (to charge for them): the amount charged always comes
// from this table, never from the price saved on the firm document.
export type PlanTier = {
  name: string;
  price: number;
  description: string;
  features: string[];
  maxUsers: number;
};

export const standardPlans: PlanTier[] = [
  {
    name: "Bronze",
    price: 50,
    description: "Great for getting started",
    features: ["Basic features", "Email support", "1 user"],
    maxUsers: 1,
  },
  {
    name: "Silver",
    price: 80,
    description: "Perfect for small teams",
    features: [
      "All Bronze features",
      "Priority support",
      "5 users",
      "Advanced analytics",
    ],
    maxUsers: 5,
  },
];

export const premiumPlans: PlanTier[] = [
  {
    name: "Gold",
    price: 120,
    description: "Best for growing businesses",
    features: [
      "All Silver features",
      "24/7 phone support",
      "10 users",
      "Custom integrations",
    ],
    maxUsers: 10,
  },
  {
    name: "Platinum",
    price: 150,
    description: "For large enterprises",
    features: [
      "All Gold features",
      "Dedicated account manager",
      "Unlimited users",
      "Advanced security",
    ],
    maxUsers: Infinity,
  },
];

export function findPlan(name: unknown): PlanTier | undefined {
  return [...standardPlans, ...premiumPlans].find((p) => p.name === name);
}

// One payment buys this many days of the plan.
export const PLAN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// The plan a company has actually paid for, while it lasts. `paidPlan` and `paidUntil` are written by the
// server when a plan payment clears (finalizeCheckout); `selectedPlan` is only the plan picked before paying,
// which the company can change, so it never counts as paid. Companies that paid before paidPlan existed
// keep their plan for PLAN_DAYS after their last payment.
export function activePlan(firm: any, now: number = Date.now()): { plan: PlanTier; paidUntil: number } | null {
  if (!firm) return null;
  const legacy = !firm.paidPlan && firm.paymentStatus === "paid";
  const plan = findPlan(legacy ? firm.selectedPlan : firm.paidPlan);
  const paidUntil = legacy ? Date.parse(firm.lastPaymentDate ?? "") + PLAN_DAYS * DAY_MS : Date.parse(firm.paidUntil ?? "");
  if (!plan || !Number.isFinite(paidUntil) || paidUntil <= now) return null;
  return { plan, paidUntil };
}

// When a new payment for `planName` runs out: renewing the same plan early adds to the time left;
// paying for a different plan starts afresh.
export function nextPaidUntil(firm: any, planName: string, now: number = Date.now()): string {
  const current = activePlan(firm, now);
  const from = current && current.plan.name === planName ? current.paidUntil : now;
  return new Date(from + PLAN_DAYS * DAY_MS).toISOString();
}
