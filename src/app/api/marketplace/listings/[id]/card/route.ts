// app/api/marketplace/listings/[id]/card/route.ts
// The listing's share card as a JPEG, attached when a buyer shares an item so the picture travels
// with the link (email, chats) even where the app doesn't build link previews.
// Public like the link preview itself: it only shows what the preview shows.
import { NextRequest } from "next/server";
import { renderListingCard } from "@/utils/listingCard";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderListingCard(id);
}
