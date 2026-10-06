// MarketPortal settings an admin controls. Everything starts switched off (0).
//  - minOrderAmount:      an order's item total must reach this (rand). 0 = no minimum.
//  - deliverySubsidyOver: orders whose item total reaches this get a delivery discount. 0 = no discount.
//  - deliverySubsidyAmount: the most Care Runners will take off the delivery fee (rand).
// The driver is always paid from the full delivery fee; a discount is paid by Care Runners.
export interface MarketSettings {
  minOrderAmount: number;
  deliverySubsidyOver: number;
  deliverySubsidyAmount: number;
}

export const DEFAULT_SETTINGS: MarketSettings = { minOrderAmount: 0, deliverySubsidyOver: 0, deliverySubsidyAmount: 0 };
export const SETTINGS_DOC = "main";
export const SETTINGS_COLLECTION = "marketplaceSettings";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, 1_000_000) : 0;
};

export function parseSettings(raw: any): MarketSettings {
  return {
    minOrderAmount: money(raw?.minOrderAmount),
    deliverySubsidyOver: money(raw?.deliverySubsidyOver),
    deliverySubsidyAmount: money(raw?.deliverySubsidyAmount),
  };
}

// What the buyer pays for delivery once any discount is taken off.
export function deliveryCharge(s: MarketSettings, itemTotal: number, fee: number) {
  const eligible = s.deliverySubsidyAmount > 0 && s.deliverySubsidyOver > 0 && itemTotal >= s.deliverySubsidyOver;
  const subsidy = eligible ? Math.min(fee, s.deliverySubsidyAmount) : 0;
  return { fee, subsidy, charged: Math.round((fee - subsidy) * 100) / 100 };
}

export const belowMinimum = (s: MarketSettings, itemTotal: number) => s.minOrderAmount > 0 && itemTotal < s.minOrderAmount;
