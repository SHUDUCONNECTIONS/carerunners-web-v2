// Validation for the admin's bulk price/stock changes (used by the API route and its tests).
// There is no markup to send: the customer price is always the company price plus the standard
// markup (src/lib/marketplaceMarkup.ts).
export interface BulkChange {
  id: string;
  companyPrice?: number;
  stock?: number;
}

export function validateChange(c: any): { error: string } | { change: BulkChange } {
  if (!c || typeof c.id !== "string" || !c.id) return { error: "Each change needs an item." };
  const out: BulkChange = { id: c.id };
  if (c.companyPrice !== undefined) {
    const v = Number(c.companyPrice);
    if (!Number.isFinite(v) || v <= 0 || v > 1_000_000) return { error: "A price must be more than 0." };
    out.companyPrice = Math.round(v * 100) / 100;
  }
  if (c.stock !== undefined) {
    const v = Number(c.stock);
    if (!Number.isInteger(v) || v < 0 || v > 1_000_000) return { error: "Stock must be a whole number, 0 or more." };
    out.stock = v;
  }
  return { change: out };
}

