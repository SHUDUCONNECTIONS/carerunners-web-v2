"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/utils/firebase"
import { authedFetch } from "@/utils/authedFetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AddressAutocomplete, PickedPlace } from "@/components/AddressAutocomplete"
import { BUYER_ACCEPTANCE } from "@/lib/marketplaceTerms"
import { ArrowLeft, ImageOff, Trash2 } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { MARKET_LISTINGS, formatRand, isListingAvailable, listingFromDoc } from "@/lib/marketplace"
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

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [loading, setLoading] = useState(true)
  // Lines whose item has sold out or been taken down since it was added.
  const [unavailable, setUnavailable] = useState<Record<string, string>>({})
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [dropoff, setDropoff] = useState<PickedPlace | null>(null)
  const [quote, setQuote] = useState<{ km: number; fee: number } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [buying, setBuying] = useState(false)
  const [accepted, setAccepted] = useState<boolean[]>(BUYER_ACCEPTANCE.map(() => false))
  const [error, setError] = useState("")
  const settings = useMarketSettings()

  // Re-read every line from the server so the buyer sees today's price and stock.
  const refresh = useCallback(async () => {
    const current = loadCart()
    setCart(current)
    const bad: Record<string, string> = {}
    let next = current
    await Promise.all(
      current.items.map(async (line) => {
        try {
          const snap = await getDoc(doc(db, MARKET_LISTINGS, line.listingId))
          if (!snap.exists()) {
            bad[line.listingId] = "No longer listed"
            return
          }
          const l = listingFromDoc(snap.id, snap.data())
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
  const charge = deliveryCharge(settings, subtotal, quote?.fee ?? 0)
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
      setQuote({ km: data.km, fee: data.fee })
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
      setError("Please confirm every buyer statement to continue.")
      return
    }
    setBuying(true)
    try {
      const res = await authedFetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ listingId: l.listingId, quantity: l.quantity })),
          deliveryAddress: address.trim(),
          deliveryLat: dropoff.lat,
          deliveryLng: dropoff.lng,
          phone: phone.trim(),
          termsAccepted: true,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.requestId) {
        setError(data?.message || "We couldn't place your order. Please try again.")
        refresh()
        return
      }
      saveCart(EMPTY_CART)
      router.push(`/payment?requestId=${data.requestId}`)
    } catch (err) {
      console.error("Error placing order:", err)
      setError("We couldn't place your order. Please try again.")
    } finally {
      setBuying(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/marketplace" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" /> Keep shopping
      </Link>
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
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
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
            <button type="button" onClick={() => update(EMPTY_CART)} className="text-sm text-gray-500 underline">
              Empty cart
            </button>
          </div>

          <div className="lg:col-span-2">
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-6">
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
                <p className="text-xs text-gray-500">One delivery for the whole order, collected and delivered by Care Runners.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Contact number</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="082 555 1234" />
              </div>

              <div className="space-y-1.5 rounded-xl bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Items ({cartCount({ ...cart, items: buyable })})
                  </span>
                  <span>{formatRand(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery{quote ? ` (~${quote.km} km)` : ""}</span>
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

              <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-blue-900">
                    Please read the{" "}
                    <Link href="/marketplace/terms" target="_blank" className="font-medium underline">
                      Terms and Conditions
                    </Link>{" "}
                    and confirm:
                  </p>
                  <button
                    type="button"
                    onClick={() => setAccepted(BUYER_ACCEPTANCE.map(() => !allAccepted))}
                    className="shrink-0 text-xs font-medium text-[var(--brand-700)] underline"
                  >
                    {allAccepted ? "Clear all" : "Tick all"}
                  </button>
                </div>
                {BUYER_ACCEPTANCE.map((text, i) => (
                  <label key={text} className="flex items-start gap-3 py-1 text-sm text-blue-950">
                    <Checkbox
                      className="mt-0.5"
                      checked={accepted[i]}
                      onCheckedChange={(v) => setAccepted((prev) => prev.map((x, j) => (j === i ? v === true : x)))}
                    />
                    <span className="leading-snug">{text}</span>
                  </label>
                ))}
              </div>

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
