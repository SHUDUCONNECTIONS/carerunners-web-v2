// A listing drawn as a card (photo, title, price, condition, store). It is the link-preview
// picture (marketplace/[id]/opengraph-image.tsx) and the image attached when an item is shared,
// so the item looks the same wherever it lands.
import { ImageResponse } from "next/og"
import sharp from "sharp"
import { conditionLabel, formatRand, itemKind } from "@/lib/marketplace"
import { loadSharedListing } from "@/utils/shareListing"

export const CARD_SIZE = { width: 1200, height: 630 }

const BRAND_700 = "#123b8f"
const BRAND_600 = "#1e4fa8"
const GREEN = "#16a34a"
const PHOTO_SIZE = 566

// The seller's photo, cropped to the card and re-encoded as a small JPEG. This also lets WebP
// photos through, which the card renderer can't read on its own.
async function photoDataUrl(src: string | null): Promise<string | null> {
  if (!src) return null
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`
  } catch {
    return null
  }
}

// The renderer only makes PNGs (about 450 KB with a photo). WhatsApp drops preview images over
// roughly 300 KB, so the card is sent as a JPEG (well under 100 KB).
async function asJpeg(card: ImageResponse): Promise<Response> {
  const jpeg = await sharp(Buffer.from(await card.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  })
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: BRAND_700 }}>MarketPortal</div>
      <div style={{ display: "flex", fontSize: 22, color: "#6b7280" }}>by Care Runners</div>
    </div>
  )
}

export async function renderListingCard(id: string): Promise<Response> {
  const listing = await loadSharedListing(id)

  if (!listing) {
    return asJpeg(new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 80,
            color: "white",
            background: `linear-gradient(135deg, ${BRAND_700}, ${BRAND_600} 60%, #3b82f6)`,
          }}
        >
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800 }}>MarketPortal</div>
          <div style={{ display: "flex", fontSize: 40, marginTop: 12 }}>Sell. Buy. Deliver.</div>
        </div>
      ),
      CARD_SIZE
    ))
  }

  const photo = await photoDataUrl(listing.image)
  const isNew = itemKind(listing.condition) === "new"
  const soldOut = listing.status === "sold" || listing.status === "inactive" || listing.stock === 0
  const title = listing.title.length > 90 ? `${listing.title.slice(0, 87)}…` : listing.title

  return asJpeg(new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f3f4f6", padding: 32 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            borderRadius: 32,
            border: "2px solid #d1d5db",
            background: "white",
          }}
        >
          {/* Photo */}
          <div
            style={{
              width: PHOTO_SIZE,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#e5e7eb",
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" width={PHOTO_SIZE} height={PHOTO_SIZE} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", fontSize: 32, color: "#9ca3af" }}>No photo</div>
            )}
          </div>

          {/* Details */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 44px" }}>
            <Brand />
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: title.length > 60 ? 38 : title.length > 30 ? 44 : 54,
                fontWeight: 700,
                lineHeight: 1.15,
                color: "#111827",
              }}
            >
              {title}
            </div>
            <div style={{ display: "flex", marginTop: 20, fontSize: 64, fontWeight: 800, color: BRAND_600 }}>
              {formatRand(listing.sellingPrice)}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  padding: "8px 20px",
                  borderRadius: 999,
                  fontSize: 26,
                  fontWeight: 700,
                  background: isNew ? "#d1fae5" : "#fef3c7",
                  color: isNew ? "#065f46" : "#78350f",
                }}
              >
                {conditionLabel(listing.condition)}
              </div>
              {soldOut && (
                <div
                  style={{
                    display: "flex",
                    padding: "8px 20px",
                    borderRadius: 999,
                    fontSize: 26,
                    fontWeight: 700,
                    background: "#e5e7eb",
                    color: "#374151",
                  }}
                >
                  Sold out
                </div>
              )}
            </div>
            <div style={{ display: "flex", marginTop: "auto", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", fontSize: 26, color: "#4b5563" }}>
                {`Sold by ${listing.sellerName}${listing.location ? ` · ${listing.location}` : ""}`}
              </div>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: GREEN }}>Delivered by Care Runners</div>
            </div>
          </div>
        </div>
      </div>
    ),
    CARD_SIZE
  ))
}
