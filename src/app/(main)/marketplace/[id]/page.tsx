"use client"

import { DeliveryDayPicker } from "@/components/DeliveryDayPicker"
import { defaultDeliveryDate, deliveryFeeForDate, type DeliveryZone } from "@/lib/marketplaceDeliveryDay"
import { CourierDelivery, DeliveryAreaNotice } from "@/components/marketplace/DeliveryAreaNotice"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { auth } from "@/utils/firebase"
import { fetchPublicListing } from "@/lib/marketplacePublicClient"
import { authedFetch } from "@/utils/authedFetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AddressAutocomplete, PickedPlace } from "@/components/AddressAutocomplete"
import { BUYER_ACCEPTANCE } from "@/lib/marketplaceTerms"
import { addToCart, loadCart, saveCart } from "@/lib/marketplaceCart"
import { Reviews } from "@/components/marketplace/Reviews"
import { loadSaved, subscribeSaved, toggleSaved } from "@/lib/marketplaceSaved"
import { RatingSummary } from "@/components/marketplace/Stars"
import { ShareButton } from "@/components/marketplace/ShareButton"
import { averageRating } from "@/lib/marketplaceReviews"
import { belowMinimum, deliveryCharge } from "@/lib/marketplaceSettings"
import { useMarketSettings } from "@/lib/useMarketSettings"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImageOff,
} from "lucide-react"
import LoadingComponent from "@/components/loader"
import {
  MarketListing,
  categoryLabel,
  conditionBadgeClass,
  conditionLabel,
  brandNewNothingToDisclose,
  formatRand,
  isListingAvailable,
  reservationActive,
} from "@/lib/marketplace"

function TitleBlock({ listing, price }: { listing: MarketListing; price: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/marketplace?store=${encodeURIComponent(listing.sellerId)}`}
          className="inline-block rounded-full border border-[var(--brand-600)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] hover:bg-[var(--brand-50)]"
        >
          Sold by {listing.sellerName || "Store"} · see all items
        </Link>
        <ShareButton listingId={listing.id} title={listing.title} />
      </div>
      <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">{listing.title}</h1>
      <p className="text-3xl font-extrabold text-[var(--brand-600)]">{price}</p>
      <a href="#reviews" className="inline-block">
        <RatingSummary average={averageRating(listing.ratingSum, listing.ratingCount)} count={listing.ratingCount ?? 0} />
      </a>
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${conditionBadgeClass(listing.condition)}`}>{conditionLabel(listing.condition)}</span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">{categoryLabel(listing.category)}</span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">Ships from {listing.location}</span>
      </div>
    </div>
  )
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [listing, setListing] = useState<MarketListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [deliveryDate, setDeliveryDate] = useState(() => defaultDeliveryDate())
  const [dropoff, setDropoff] = useState<PickedPlace | null>(null)
  const [quote, setQuote] = useState<{ km: number; zone: DeliveryZone; surcharge: number; courierFee: number | null } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [buying, setBuying] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [cartMsg, setCartMsg] = useState("")
  const settings = useMarketSettings()
  const [saved, setSaved] = useState<string[]>([])
  useEffect(() => {
    const sync = () => setSaved(loadSaved())
    sync()
    return subscribeSaved(sync)
  }, [])
  const [accepted, setAccepted] = useState<boolean[]>(BUYER_ACCEPTANCE.map(() => false))
  const [error, setError] = useState("")

  // Re-read the listing (after a buyer rates it, so the average updates).
  const reloadListing = async () => {
    const l = await fetchPublicListing(id)
    if (l) setListing(l)
  }

  useEffect(() => {
    const load = async () => {
      try {
        // Wait for sign-in to be restored after a refresh: the server needs the user's token.
        await auth.authStateReady()
        setListing(await fetchPublicListing(id))
      } catch (err) {
        console.error("Error loading listing:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <LoadingComponent />

  if (!listing) {
    return (
      <div className="max-w-xl mx-auto text-center space-y-4 py-12">
        <p className="text-gray-600">This item could not be found.</p>
        <Button asChild>
          <Link href="/marketplace">Back to MarketPortal</Link>
        </Button>
      </div>
    )
  }

  const user = auth.currentUser
  const isOwner = user?.uid === listing.sellerId
  const available = isListingAvailable(listing)
  const reserved = reservationActive(listing)
  const unitPrice = listing.sellingPrice ?? 0
  const maxQty = listing.stock !== null ? Math.max(1, listing.stock) : 1
  const qty = Math.min(Math.max(1, quantity), maxQty)
  const itemPrice = unitPrice * qty
  // The discount the admin has set is applied here for display; the server works it out again at checkout.
  // Beyond the driver area the quote carries a flat courier fee instead of the day price.
  const courierFee = quote?.zone === "courier" ? quote.courierFee : null
  const surcharge = quote?.surcharge ?? 0
  const charge = deliveryCharge(settings, itemPrice, courierFee ?? (deliveryFeeForDate(deliveryDate) ?? 0) + surcharge)
  const deliveryFee = charge.charged
  const total = itemPrice + deliveryFee
  const priceLabel = available || reserved ? formatRand(unitPrice) : "N/A"
  const images = listing.images
  const specs = listing.specifications.split("\n").map((l) => l.trim()).filter(Boolean)
  const allAccepted = accepted.every(Boolean)

  const showImage = (i: number) => setActiveImage((i + images.length) % images.length)

  const handlePick = async (place: PickedPlace) => {
    setDropoff(place)
    setQuote(null)
    setError("")
    setQuoting(true)
    try {
      const res = await authedFetch(`/api/marketplace/quote?listingId=${listing.id}&lat=${place.lat}&lng=${place.lng}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't calculate delivery.")
      setQuote({ km: data.km, zone: data.zone ?? "driver", surcharge: Number(data.surcharge) || 0, courierFee: data.courierFee ?? null })
    } catch (err: any) {
      setError(err?.message || "Couldn't calculate the delivery fee.")
    } finally {
      setQuoting(false)
    }
  }

  const handleAddToCart = () => {
    setError("")
    const result = addToCart(
      loadCart(),
      { id: listing.sellerId, name: listing.sellerName },
      { listingId: listing.id, title: listing.title, image: listing.images[0] ?? null, unitPrice, stock: listing.stock },
      qty
    )
    if (result.error) {
      setCartMsg("")
      setError(result.error)
      return
    }
    saveCart(result.cart)
    setCartMsg("Added to your cart.")
  }

  const handleBuy = async () => {
    setError("")
    if (!user) {
      router.push("/auth/login")
      return
    }
    if (!dropoff || dropoff.address !== address || !quote) {
      setError("Please choose your delivery address from the suggestions.")
      return
    }
    if (!phone.trim()) {
      setError("Please enter a contact number.")
      return
    }
    if (!allAccepted) {
      setError("Please confirm every buyer statement to continue.")
      return
    }

    setBuying(true)
    try {
      // The server prices the order, reserves the item and creates the
      // Care Runners delivery trip; payment happens on the existing page.
      const res = await authedFetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          quantity: qty,
          deliveryAddress: address.trim(),
          deliveryLat: dropoff.lat,
          deliveryLng: dropoff.lng,
          phone: phone.trim(),
          deliveryDate,
          termsAccepted: true,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.requestId) {
        setError(data?.message || "We couldn't place your order. Please try again.")
        return
      }
      router.push(`/payment?requestId=${data.requestId}`)
    } catch (err) {
      console.error("Error placing order:", err)
      setError("We couldn't place your order. Please try again.")
    } finally {
      setBuying(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-24 lg:pb-0">
      <Link href="/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="mr-1 h-4 w-4" /> MarketPortal
      </Link>

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
            {images[activeImage] ? (
              <img src={images[activeImage]} alt={listing.title} className="h-full w-full object-contain" />
            ) : (
              <ImageOff className="h-10 w-10 text-gray-300" />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => showImage(activeImage - 1)}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => showImage(activeImage + 1)}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">
                  {activeImage + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setActiveImage(i)}
                  aria-label={`Show photo ${i + 1}`}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 sm:h-20 sm:w-24 ${
                    i === activeImage ? "border-[var(--brand-600)]" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

      <div id="checkout" className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <TitleBlock listing={listing} price={priceLabel} />
        </div>

        {reserved ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            Someone is completing a purchase on this item. If they don&apos;t finish, it becomes available again shortly.
          </p>
        ) : !available ? (
          <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">
            {listing.status === "sold"
              ? listing.stock !== null
                ? "This item is sold out."
                : "This item has been sold."
              : "This item is not currently available."}
          </p>
        ) : isOwner ? (
          <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">This is your listing.</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="address">Delivery address</Label>
              <AddressAutocomplete
                id="address"
                value={address}
                onChange={(v) => {
                  setAddress(v)
                  if (dropoff && v !== dropoff.address) {
                    setDropoff(null)
                    setQuote(null)
                  }
                }}
                onPick={handlePick}
                placeholder="Search your delivery address…"
              />
              <DeliveryAreaNotice />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Contact number</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="082 555 1234" />
            </div>

            {courierFee !== null ? (
              <CourierDelivery fee={courierFee} />
            ) : (
              <DeliveryDayPicker value={deliveryDate} onChange={setDeliveryDate} surcharge={surcharge} />
            )}

            {listing.stock !== null && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxQty}
                    className="w-28"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.floor(Number(e.target.value)) || 1)}
                  />
                  <span className="text-xs text-gray-500">{listing.stock} in stock</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Item{qty > 1 ? ` (${qty} x ${formatRand(unitPrice)})` : ""}</span>
                <span>{formatRand(itemPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery{courierFee !== null ? " (courier)" : ""}</span>
                <span>{quoting ? "Calculating…" : quote ? formatRand(deliveryFee) : "Enter address"}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-[var(--brand-700)]">{quote ? formatRand(total) : "Enter address"}</span>
              </div>
            </div>

            {charge.subsidy > 0 && (
              <p className="text-xs font-medium text-green-700">{formatRand(charge.subsidy)} delivery discount applied</p>
            )}
            {settings.deliverySubsidyAmount > 0 && settings.deliverySubsidyOver > itemPrice && (
              <p className="text-xs text-gray-600">
                Spend {formatRand(settings.deliverySubsidyOver - itemPrice)} more to get up to {formatRand(settings.deliverySubsidyAmount)} off delivery.
              </p>
            )}
            {belowMinimum(settings, itemPrice) && (
              <p role="alert" className="text-sm text-red-600">
                The minimum order is {formatRand(settings.minOrderAmount)}. Add {formatRand(settings.minOrderAmount - itemPrice)} more to continue.
              </p>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-950">
              <Checkbox
                className="mt-0.5"
                checked={allAccepted}
                onCheckedChange={(v) => setAccepted(BUYER_ACCEPTANCE.map(() => v === true))}
              />
              <span className="leading-snug">
                I have read and agree to the{" "}
                <Link href="/marketplace/terms" target="_blank" className="font-medium underline">
                  Terms and Conditions
                </Link>
                {" "}and{" "}
                <Link href="/marketplace/returns" target="_blank" className="font-medium underline">
                  Return Policy
                </Link>
                , including the item description, condition and delivery terms.
              </span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <Button
              onClick={handleBuy}
              disabled={buying || quoting || belowMinimum(settings, itemPrice)}
              className="h-12 w-full bg-[var(--mp-green)] text-base text-white hover:bg-[var(--mp-green-dark)]"
            >
              {buying ? "Reserving…" : "Buy Now & Pay"}
            </Button>

            <Button type="button" variant="outline" onClick={handleAddToCart} className="h-11 w-full">
              Add to cart
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => toggleSaved(listing.id)}
              aria-pressed={saved.includes(listing.id)}
              className="h-11 w-full"
            >
              {saved.includes(listing.id) ? "Saved · tap to remove" : "Save for later"}
            </Button>
            {cartMsg && (
              <div role="status" className="flex items-center justify-center gap-3 text-sm text-green-700">
                {cartMsg}
                <Button asChild size="sm" variant="outline">
                  <Link href="/marketplace/cart">View cart</Link>
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-gray-500">Secure payment · Company paid out after delivery</p>
          </>
        )}
      </div>

        <section className="space-y-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-gray-900">About this item</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{listing.description}</p>
          {listing.additionalInfo && (
            <p className="whitespace-pre-line text-sm text-gray-500">{listing.additionalInfo}</p>
          )}
        </section>

        {specs.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-900">Specifications</h2>
            <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {specs.map((line) => (
                <li key={line} className="flex items-start gap-2 text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-600)]" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}

        {brandNewNothingToDisclose(listing) ? (
          // A brand-new item with nothing to disclose: no warning box.
          <section className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-bold">Brand new.</span> The seller reports no defects.
            </p>
          </section>
        ) : (
        <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Condition &amp; defects disclosed by the seller
          </h2>
          <p className="text-sm font-medium text-amber-900">{conditionLabel(listing.condition)}</p>
          <p className="whitespace-pre-line text-sm text-amber-900">{listing.defects || "None disclosed."}</p>
          {listing.knownIssues.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {listing.knownIssues.map((i) => (
                <span key={i} className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                  {i}
                </span>
              ))}
            </div>
          )}
        </section>
        )}

        <Reviews
          listingId={listing.id}
          ratingSum={listing.ratingSum ?? 0}
          ratingCount={listing.ratingCount ?? 0}
          onChanged={reloadListing}
        />
      </div>

      {/* Mobile: sticky price bar that jumps to checkout */}
      {available && !isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-white px-4 py-3 pr-20 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
          <div className="leading-tight">
            <p className="text-xs text-gray-500">Item price</p>
            <p className="text-lg font-bold text-[var(--brand-600)]">{formatRand(unitPrice)}</p>
          </div>
          <Button
            onClick={() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-[var(--mp-green)] text-white hover:bg-[var(--mp-green-dark)]"
          >
            Buy now
          </Button>
        </div>
      )}
    </div>
  )
}
