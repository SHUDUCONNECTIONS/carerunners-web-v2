// Buyers read listings and their own orders through the server (see marketplacePublic.ts), so the
// company's price and the markup never reach the browser.
import { authedFetch } from "@/utils/authedFetch"
import { listingFromDoc, orderFromDoc, type MarketListing, type MarketOrder } from "./marketplace"

export async function fetchPublicListing(id: string): Promise<MarketListing | null> {
  const res = await authedFetch(`/api/marketplace/listings/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Listing ${id}: ${res.status}`)
  return listingFromDoc(id, (await res.json()).listing)
}

/** The signed-in buyer's orders, or just the one with this id. */
export async function fetchMyOrders(id?: string): Promise<MarketOrder[]> {
  const res = await authedFetch(`/api/marketplace/orders${id ? `?id=${encodeURIComponent(id)}` : ""}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Orders: ${res.status}`)
  return ((await res.json()).orders as any[]).map((o) => orderFromDoc(o.id, o))
}
