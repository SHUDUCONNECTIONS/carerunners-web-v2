// What buyers may see of a listing or an order. The company's price and the Care Runners markup
// stay on the server: buyers only ever get the selling price. Admins and the selling company read
// the full records directly from Firestore.

const PRIVATE_LISTING_FIELDS = ["askingPrice", "markupAmount", "reservedBy", "reservedOrderId", "createdBy", "submittedByCompany", "rejectionReason"]
const PRIVATE_ORDER_FIELDS = ["sellerPrice", "markupAmount", "sellerPaidOut", "sellerPaidOutAt", "sellerPayoutRef", "sellerPayoutMethod"]

// Firestore timestamps don't survive JSON, so they're sent as milliseconds.
function plain(data: Record<string, any>, hidden: string[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) {
    if (hidden.includes(k)) continue
    out[k] = v && typeof v.toMillis === "function" ? v.toMillis() : v
  }
  return out
}

export function publicListingData(data: Record<string, any>): Record<string, any> {
  return plain(data, PRIVATE_LISTING_FIELDS)
}

export function publicOrderData(data: Record<string, any>): Record<string, any> {
  const out = plain(data, PRIVATE_ORDER_FIELDS)
  if (Array.isArray(out.items)) {
    out.items = out.items.map(({ sellerUnitPrice, markupUnit, ...line }: Record<string, any>) => line)
  }
  return out
}
