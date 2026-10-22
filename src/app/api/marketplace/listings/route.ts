// app/api/marketplace/listings/route.ts
// The browse grid's data: every live listing, trimmed to what a card needs.
// The whole list is read from Firestore at most once a minute (per server
// instance) instead of once per visitor, which keeps reads and load time down
// as the catalogue grows. Stock here can be up to a minute old; the product
// page and checkout always use the live record.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_LISTINGS, toMillis } from "@/lib/marketplace";
import { releaseExpiredOrdersThrottled } from "@/utils/marketplaceStock";

const TTL_MS = 60 * 1000;
let cache: { at: number; rows: ListingCard[] } | null = null;

export interface ListingCard {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  sellingPrice: number | null;
  stock: number | null;
  ratingSum: number;
  ratingCount: number;
  status: string;
  reservedAt: number;
  image: string | null;
  imageCount: number;
  location: string;
  createdAt: number;
}

async function loadCards(): Promise<ListingCard[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const snap = await adminDb().collection(MARKET_LISTINGS).where("status", "in", ["active", "reserved"]).get();
  const rows = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      sellerId: x.sellerId ?? "",
      sellerName: x.sellerName ?? "",
      title: x.title ?? "",
      description: String(x.description ?? "").slice(0, 160),
      category: x.category ?? "other",
      condition: x.condition ?? "used_good",
      sellingPrice: x.sellingPrice ?? null,
      stock: typeof x.stock === "number" ? x.stock : null,
      ratingSum: Number(x.ratingSum) || 0,
      ratingCount: Number(x.ratingCount) || 0,
      status: x.status,
      reservedAt: toMillis(x.reservedAt),
      image: x.images?.[0] ?? null,
      imageCount: x.images?.length ?? 0,
      location: x.location ?? "",
      createdAt: toMillis(x.createdAt),
    };
  });
  cache = { at: Date.now(), rows };
  return rows;
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    // Abandoned checkouts give their stock back before the grid is built (and the cached grid is
    // rebuilt when they do), so an unpaid item doesn't sit at "Out of stock".
    if ((await releaseExpiredOrdersThrottled(adminDb())) > 0) cache = null;
    return NextResponse.json({ listings: await loadCards() }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (err) {
    console.error("Error loading marketplace listings:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
