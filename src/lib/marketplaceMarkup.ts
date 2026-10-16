// Care Runners sells on the companies' behalf (like a retailer): customers pay the company's price
// plus a fixed 30% markup, which Care Runners keeps. Every place that prices a listing uses this,
// so the customer price is never typed in by hand. scripts/import-wholesale-catalogue.mjs and
// scripts/apply-marketplace-markup.mjs repeat the same sum (they can't import TypeScript).
export const MARKUP_RATE = 0.3

const cents = (n: number) => Math.round(n * 100) / 100

export function priceWithMarkup(companyPrice: number): { markupAmount: number; sellingPrice: number } {
  const markupAmount = cents(companyPrice * MARKUP_RATE)
  return { markupAmount, sellingPrice: cents(companyPrice + markupAmount) }
}
