"use client"

import { DeliveryDayPicker } from "@/components/DeliveryDayPicker"
import { defaultDeliveryDate, deliveryFeeForDate, type DeliveryZone } from "@/lib/marketplaceDeliveryDay"
import { CourierDelivery, DeliveryAreaNotice } from "@/components/marketplace/DeliveryAreaNotice"
import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { auth } from "@/utils/firebase"
import { fetchPublicListing } from "@/lib/marketplacePublicClient"
import { authedFetch } from "@/utils/authedFetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AddressAutocomplete, PickedPlace } from "@/components/AddressAutocomplete"
import { BUYER_ACCEPTANCE } from "@/lib/marketplaceTerms"
import { ArrowLeft, ImageOff, Trash2 } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { formatRand, isListingAvailable } from "@/lib/marketplace"
import { belowMinimum, deliveryCharge } from "@/lib/marketplaceSettings"
import { useMarketSettings } from "@/lib/useMarketSettings"
import {
  Cart,
  EMPTY_CART,
  cartCount,
  cartSubtotal,
  clampQuantity,
  loadCart,
  removeLine,
  saveCart,
  setLineQuantity,
  subscribeCart,
} from "@/lib/marketplaceCart"
import { cancelUnpaidOrder, settlePendingCart } from "@/lib/marketplaceCartSync"

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [loading, setLoading] = useState(true)
  // Lines whose item has sold out or been taken down since it was added.
  const [unavailable, setUnavailable] = useState<Record<string, string>>({})
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [deliveryDate, setDeliveryDate] = useState(() => defaultDeliveryDate())
  const [dropoff, setDropoff] = useState<PickedPlace | null>(null)
  const [quote, setQuote] = useState<{ km: number; zone: DeliveryZone; surcharge: number; courierFee: number | null } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [buying, setBuying] = useState(false)
  const [accepted, setAccepted] = useState<boolean[]>(BUYER_ACCEPTANCE.map(() => false))
  const [error, setError] = useState("")
  // An order was placed from this cart but hasn't been paid yet.
  const [pendingUnpaid, setPendingUnpaid] = useState(false)
  const settings = useMarketSettings()

  // Re-read every line from the server so the buyer sees today's price and stock.
  const refresh = useCallback(async () => {
    // The listings come from the server, which needs the user's token: wait for sign-in after a refresh.
    await auth.authStateReady()
    // An order placed from this cart earlier: empty the cart if it's been paid since.
    setPendingUnpaid((await settlePendingCart()) === "unpaid")
    const current = loadCart()
    setCart(current)
    const bad: Record<string, string> = {}
    let next = current
    await Promise.all(
      current.items.map(async (line) => {
        try {
          const l = await fetchPublicListing(line.listingId)
          if (!l) {
            bad[line.listingId] = "No longer listed"
            return
          }
          if (!isListingAvailable(l)) {
            bad[line.listingId] = l.stock === 0 || l.status === "sold" ? "Sold out" : "Not available"
            return
          }
          next = {
            ...next,
            items: next.items.map((i) =>
              i.listingId === line.listingId
                ? { ...i, unitPrice: l.sellingPrice ?? i.unitPrice, stock: l.stock, quantity: clampQuantity(i.quantity, l.stock) }
                : i
            ),
          }
        } catch {
          // keep the line as it was if it can't be re-read
        }
      })
    )
    setUnavailable(bad)
    if (JSON.stringify(next) !== JSON.stringify(current)) saveCart(next)
    setCart(next)
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
    return subscribeCart(() => setCart(loadCart()))
  }, [refresh])

  if (loading) return <LoadingComponent />

  const user = auth.currentUser
  const lines = cart.items
  const buyable = lines.filter((l) => !unavailable[l.listingId])
  const subtotal = cartSubtotal({ ...cart, items: buyable })
  // Beyond the driver area the quote carries a flat courier fee instead of the day price.
  const courierFee = quote?.zone === "courier" ? quote.courierFee : null
  const surcharge = quote?.surcharge ?? 0
  const charge = deliveryCharge(settings, subtotal, courierFee ?? (deliveryFeeForDate(deliveryDate) ?? 0) + surcharge)
  const deliveryFee = charge.charged
  const total = subtotal + deliveryFee
  const allAccepted = accepted.every(Boolean)

  const update = (next: Cart) => {
    saveCart(next)
    setCart(next)
  }

  const handlePick = async (place: PickedPlace) => {
    setDropoff(place)
    setQuote(null)
    setError("")
    if (buyable.length === 0) return
    setQuoting(true)
    try {
      const res = await authedFetch(`/api/marketplace/quote?listingId=${buyable[0].listingId}&lat=${place.lat}&lng=${place.lng}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't calculate delivery.")
      setQuote({ km: data.km, zone: data.zone ?? "driver", surcharge: Number(data.surcharge) || 0, courierFee: data.courierFee ?? null })
    } catch (err: any) {
      setError(err?.message || "Couldn't calculate the delivery fee.")
    } finally {
      setQuoting(false)
    }
  }

  const handleBuy = async () => {
    setError("")
    if (!user) {
      router.push("/auth/login")
      return
    }
    if (Object.keys(unavailable).length > 0) {
      setError("Remove the items that are no longer available to continue.")
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
      setError("Please accept the Terms and Conditions to continue.")
      return
    }
    setBuying(true)
    try {
      // An earlier unpaid order from this cart is replaced by this one, so its stock isn't held twice.
      if ((await settlePendingCart()) === "unpaid") {
        await cancelUnpaidOrder(loadCart().pendingRequestId!)
      } else if (loadCart().items.length === 0) {
        setError("This order has already been paid. You'll find it under My Trips.")
        refresh()
        return
      }
      const res = await authedFetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ listingId: l.listingId, quantity: l.quantity })),
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
        refresh()
        return
      }
      // The cart is only emptied once this order is paid (see marketplaceCartSync).
      saveCart({ ...loadCart(), pendingRequestId: data.requestId })
      router.push(`/payment?requestId=${data.requestId}`)
    } catch (err) {
      console.error("Error placing order:", err)
      setError("We couldn't place your order. Please try again.")
    } finally {
      setBuying(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="outline" size="sm">
        <Link href="/marketplace">
          <ArrowLeft className="mr-1 h-4 w-4" /> Keep shopping
        </Link>
      </Button>
      <h1 className="text-2xl font-bold text-gray-900">
        Your cart{cart.sellerName ? <span className="text-base font-medium text-gray-500"> from {cart.sellerName}</span> : null}
      </h1>

      {lines.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-12 text-center space-y-3">
          <p className="text-lg font-semibold text-gray-900">Your cart is empty</p>
          <p className="text-sm text-gray-500">Add items and pay one delivery fee for the whole order.</p>
          <Button asChild>
            <Link href="/marketplace">Browse MarketPortal</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingUnpaid && cart.pendingRequestId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span>You placed this order but haven&apos;t paid yet. Your items stay here until you do.</span>
              <Button asChild size="sm" className="bg-[var(--mp-green)] text-white hover:bg-[var(--mp-green-dark)]">
                <Link href={`/payment?requestId=${cart.pendingRequestId}`}>Pay now</Link>
              </Button>
            </div>
          )}
          <div className="space-y-3">
            {lines.map((l) => {
              const problem = unavailable[l.listingId]
              return (
                <div key={l.listingId} className={`flex gap-3 rounded-2xl border border-gray-300 bg-white p-3 shadow-sm ${problem ? "opacity-70" : ""}`}>
                  <Link href={`/marketplace/${l.listingId}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center">
                    {l.image ? <img src={l.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageOff className="h-6 w-6 text-gray-300" />}
                  </Link>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900">{l.title}</p>
                    <p className="text-sm text-gray-600">{formatRand(l.unitPrice)} each</p>
                    {problem ? (
                      <p className="text-sm font-medium text-red-600">{problem}. Remove it to continue.</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {l.stock === null ? (
                          <span className="text-xs text-gray-500">One-off item</span>
                        ) : (
                          <Input
                            aria-label={`Quantity for ${l.title}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={Math.max(1, l.stock)}
                            className="h-9 w-24"
                            value={l.quantity}
                            onChange={(e) => update(setLineQuantity(cart, l.listingId, Number(e.target.value)))}
                          />
                        )}
                        {l.stock !== null && <span className="text-xs text-gray-500">{l.stock} in stock</span>}
                        <span className="ml-auto text-sm font-bold text-gray-900">{formatRand(l.unitPrice * l.quantity)}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => update(removeLine(cart, l.listingId))}
                    aria-label={`Remove ${l.title}`}
                    className="self-start rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => update(EMPTY_CART)}>
              <Trash2 className="mr-1 h-4 w-4" /> Empty cart
            </Button>
          </div>

          <div>
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Delivery &amp; payment</h2>
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
                <p className="text-xs text-gray-500">One delivery fee for the whole order.</p>
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

              <div className="space-y-1.5 rounded-xl bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Items ({cartCount({ ...cart, items: buyable })})
                  </span>
                  <span>{formatRand(subtotal)}</span>
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
                {settings.deliverySubsidyAmount > 0 && settings.deliverySubsidyOver > subtotal && (
                  <p className="text-xs text-gray-600">
                    Spend {formatRand(settings.deliverySubsidyOver - subtotal)} more to get up to {formatRand(settings.deliverySubsidyAmount)} off delivery.
                  </p>
                )}
                {belowMinimum(settings, subtotal) && (
                  <p role="alert" className="text-sm text-red-600">
                    The minimum order is {formatRand(settings.minOrderAmount)}. Add {formatRand(settings.minOrderAmount - subtotal)} more to continue.
                  </p>
                )}

              {/* One box covers every buyer statement in BUYER_ACCEPTANCE (same as the product page). */}
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
                  , including the item descriptions, condition and delivery terms.
                </span>
              </label>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <Button
                onClick={handleBuy}
                disabled={buying || quoting || buyable.length === 0 || belowMinimum(settings, subtotal)}
                className="h-12 w-full bg-[var(--mp-green)] text-base text-white hover:bg-[var(--mp-green-dark)]"
              >
                {buying ? "Placing order…" : "Place order & pay"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
