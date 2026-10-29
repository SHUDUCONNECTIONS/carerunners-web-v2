// Gives a shared item link a full preview card: title, price, condition and a picture of the
// listing (opengraph-image.tsx). The page itself is a client component, so the tags live here.
import type { Metadata } from "next"
import { headers } from "next/headers"
import { conditionLabel, formatRand } from "@/lib/marketplace"
import { loadSharedListing, siteUrl } from "@/utils/shareListing"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const h = await headers()
  const base = siteUrl(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"))
  const url = `${base}/marketplace/${id}`
  const listing = await loadSharedListing(id)
  if (!listing) {
    return { metadataBase: new URL(base), title: "MarketPortal · Care Runners" }
  }

  const title = `${listing.title} · ${formatRand(listing.sellingPrice)}`
  const summary = listing.description.replace(/\s+/g, " ").trim()
  const description = [
    `${conditionLabel(listing.condition)} · Sold by ${listing.sellerName}.`,
    "Delivered by Care Runners.",
    summary.length > 140 ? `${summary.slice(0, 137)}…` : summary,
  ]
    .filter(Boolean)
    .join(" ")

  return {
    metadataBase: new URL(base),
    title: `${listing.title} | MarketPortal`,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "MarketPortal by Care Runners", url, title, description },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default function ListingLayout({ children }: { children: React.ReactNode }) {
  return children
}
