// The picture shown when an item link is shared (see utils/listingCard.tsx).
import { renderListingCard } from "@/utils/listingCard"

export const alt = "An item on MarketPortal by Care Runners"
export const size = { width: 1200, height: 630 }
export const contentType = "image/jpeg"

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return renderListingCard(id)
}
