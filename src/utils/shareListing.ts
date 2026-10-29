// What a link preview (WhatsApp, Facebook, X, iMessage…) may show of a listing.
// Crawlers aren't signed in, so this reads Firestore directly and keeps to buyer-safe fields.
// Items waiting for review (or rejected) get no preview, like the product page.
import { cache } from "react"
import { adminDb } from "@/utils/firebaseAdmin"
import { MARKET_LISTINGS } from "@/lib/marketplace"

const HIDDEN_STATUSES = ["pending", "rejected"]

export type SharedListing = {
  title: string
  description: string
  sellingPrice: number | null
  condition: string
  category: string
  sellerName: string
  location: string
  image: string | null
  status: string
  stock: number | null
}

export const loadSharedListing = cache(async (id: string): Promise<SharedListing | null> => {
  try {
    const data = (await adminDb().collection(MARKET_LISTINGS).doc(id).get()).data()
    if (!data || HIDDEN_STATUSES.includes(data.status)) return null
    return {
      title: data.title ?? "",
      description: data.description ?? "",
      sellingPrice: data.sellingPrice ?? null,
      condition: data.condition ?? "",
      category: data.category ?? "",
      sellerName: data.sellerName || "Store",
      location: data.location ?? "",
      image: Array.isArray(data.images) && data.images[0] ? data.images[0] : null,
      status: data.status ?? "",
      stock: data.stock ?? null,
    }
  } catch (err) {
    console.error("Error loading listing for link preview:", err)
    return null
  }
})

// Previews need absolute links.
export function siteUrl(host: string | null, proto: string | null): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  return host ? `${proto ?? "https"}://${host}` : "http://localhost:3000"
}
