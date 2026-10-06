"use client"

import React, { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { authedFetch } from "@/utils/authedFetch"
import { cartCount, loadCart, subscribeCart } from "@/lib/marketplaceCart"
import { RatingSummary } from "@/components/marketplace/Stars"
import { averageRating } from "@/lib/marketplaceReviews"
import { loadSaved, subscribeSaved } from "@/lib/marketplaceSaved"
import { isListingAvailable } from "@/lib/marketplace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, ImageOff, ListChecks, Search } from "lucide-react"
import LoadingComponent from "@/components/loader"
import {
  MARKET_CATEGORIES,
  MarketListing,
  categoryLabel,
  conditionLabel,
  formatRand,
  reservationActive,
} from "@/lib/marketplace"

const STEPS = [
  { title: "Browse", text: "Find something you like. Photos, condition and defects are all disclosed." },
  { title: "Choose delivery", text: "Enter your delivery address and see the full price up front." },
  { title: "Pay securely", text: "Pay once online. We hold your payment until the item is delivered." },
  { title: "We collect & deliver", text: "Care Runners collects the item and brings it to your door." },
]

const TRUST = ["Secure payments", "Delivered by Care Runners", "Every listing reviewed", "Condition & defects disclosed"]

type Sort = "newest" | "price-asc" | "price-desc" | "rating"

const PRICE_BANDS = [
  { id: "any", label: "Any price", min: 0, max: Infinity },
  { id: "u50", label: "Under R50", min: 0, max: 50 },
  { id: "50-200", label: "R50 to R200", min: 50, max: 200 },
  { id: "200-1000", label: "R200 to R1,000", min: 200, max: 1000 },
  { id: "o1000", label: "Over R1,000", min: 1000, max: Infinity },
]
const NEW_LISTING_DAYS = 7
// A big catalogue is shown a page at a time so the grid stays quick.
const PAGE_SIZE = 48

// useSearchParams (the ?store= filter) needs a Suspense boundary.
export default function MarketplacePage() {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <MarketplaceContent />
    </Suspense>
  )
}

function MarketplaceContent() {
  // ?store=<company id> shows one store's products only.
  const storeId = useSearchParams().get("store")
  const [listings, setListings] = useState<MarketListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [sort, setSort] = useState<Sort>("newest")
  const [band, setBand] = useState("any")
  const [inStockOnly, setInStockOnly] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)
  const [saved, setSaved] = useState<string[]>([])

  useEffect(() => {
    const sync = () => setSaved(loadSaved())
    sync()
    return subscribeSaved(sync)
  }, [])
  const [shown, setShown] = useState(PAGE_SIZE)
  const [inCart, setInCart] = useState(0)

  useEffect(() => {
    const sync = () => setInCart(cartCount(loadCart()))
    sync()
    return subscribeCart(sync)
  }, [])

  useEffect(() => setShown(PAGE_SIZE), [search, category, sort, band, inStockOnly, savedOnly])

  useEffect(() => {
    const load = async () => {
      try {
        // One cached list from the server, not one Firestore read per listing per
        // visitor. Reserved items stay visible (marked as reserved) so an
        // abandoned checkout can never hide an item permanently.
        const res = await authedFetch("/api/marketplace/listings")
        if (!res.ok) throw new Error(`Listings request failed: ${res.status}`)
        const { listings: rows } = await res.json()
        setListings(
          rows.map((r: any) => ({
            id: r.id,
            sellerId: r.sellerId,
            sellerName: r.sellerName,
            title: r.title,
            description: r.description,
            category: r.category,
            condition: r.condition,
            defects: "",
            knownIssues: [],
            specifications: "",
            additionalInfo: "",
            askingPrice: 0,
            markupAmount: null,
            sellingPrice: r.sellingPrice,
            stock: r.stock,
            ratingSum: r.ratingSum,
            ratingCount: r.ratingCount,
            location: r.location,
            images: r.image ? [r.image] : [],
            imageCount: r.imageCount,
            reservedAt: r.reservedAt,
            status: r.status,
            createdAt: r.createdAt,
          }))
        )
      } catch (err) {
        console.error("Error loading marketplace listings:", err)
        setError("We couldn't load the marketplace. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const counts = useMemo(() => {
    const inStore = storeId ? listings.filter((l) => l.sellerId === storeId) : listings
    const c: Record<string, number> = { all: inStore.length }
    for (const l of inStore) c[l.category] = (c[l.category] ?? 0) + 1
    return c
  }, [listings, storeId])

  // Stores seen in the live listings (the store name is stored on each listing).
  const stores = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>()
    for (const l of listings) {
      const s = m.get(l.sellerId) ?? { id: l.sellerId, name: l.sellerName || "Store", count: 0 }
      s.count++
      m.set(l.sellerId, s)
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [listings])
  const store = storeId ? stores.find((s) => s.id === storeId) : undefined

  const visible = useMemo(() => {
    // Every word typed has to match somewhere (title, description or store), in any order.
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const range = PRICE_BANDS.find((b) => b.id === band) ?? PRICE_BANDS[0]
    const hay = (l: MarketListing) => `${l.title} ${l.description} ${l.sellerName}`.toLowerCase()
    const filtered = listings.filter(
      (l) =>
        (!storeId || l.sellerId === storeId) &&
        (category === "all" || l.category === category) &&
        terms.every((t) => hay(l).includes(t)) &&
        (l.sellingPrice ?? 0) >= range.min &&
        (l.sellingPrice ?? 0) < range.max &&
        (!inStockOnly || isListingAvailable(l)) &&
        (!savedOnly || saved.includes(l.id))
    )
    const price = (l: MarketListing) => l.sellingPrice ?? 0
    // Items whose title has the typed words come first.
    const titleHits = (l: MarketListing) => terms.filter((t) => l.title.toLowerCase().includes(t)).length
    const stars = (l: MarketListing) => averageRating(l.ratingSum, l.ratingCount) ?? 0
    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return price(a) - price(b)
      if (sort === "price-desc") return price(b) - price(a)
      if (sort === "rating") return stars(b) - stars(a) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
      return titleHits(b) - titleHits(a) || b.createdAt - a.createdAt
    })
  }, [listings, search, category, sort, storeId, band, inStockOnly, savedOnly, saved])

  if (loading) return <LoadingComponent />

  const now = Date.now()

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--brand-500)] text-white">
        <div className="relative grid md:grid-cols-[1fr_auto] gap-5 p-5 sm:p-6 md:p-8 items-center">
          <div className="space-y-3">
            <div className="leading-tight">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">MarketPortal</h1>
              <p className="text-sm md:text-base font-medium text-white/90">Sell. Buy. Deliver.</p>
            </div>
            <p className="max-w-xl text-sm sm:text-base text-white/90">
              Quality pre-owned items from trusted companies. Pick what you like and Care Runners delivers it to your door.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="outline"
                className="bg-white/10 border-white/60 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/marketplace/my-listings">
                  <ListChecks className="h-4 w-4 mr-1" /> My MarketPortal
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="bg-white/10 border-white/60 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/marketplace/cart">Cart{inCart > 0 ? ` (${inCart})` : ""}</Link>
              </Button>
            </div>
          </div>

          <div className="hidden md:block w-64 rounded-2xl bg-[var(--mp-green)] p-5 shadow-lg">
            <p className="text-lg font-bold leading-snug">Delivered by Care Runners</p>
            <p className="mt-1 text-sm text-white/90">
              Every item is collected from the seller and delivered to your door by our drivers.
            </p>
          </div>
        </div>
      </section>

      {/* Store header (when viewing one store) */}
      {storeId && (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-gray-900">{store?.name ?? "Store"}</p>
            <p className="text-sm text-gray-500">
              {store ? `${store.count} item${store.count === 1 ? "" : "s"} on MarketPortal` : "No items from this store right now"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/marketplace">All stores</Link>
          </Button>
        </div>
      )}

      {/* Search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="text-base md:text-sm pl-9 bg-white h-12 rounded-xl shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for items…"
            aria-label="Search listings"
          />
        </div>
        <div className="sm:w-52">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-12 bg-white shadow-sm" aria-label="Sort items">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="price-asc">Price: low to high</SelectItem>
              <SelectItem value="price-desc">Price: high to low</SelectItem>
              <SelectItem value="rating">Top rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={band} onValueChange={setBand}>
          <SelectTrigger className="h-10 w-44 bg-white" aria-label="Price range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICE_BANDS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
          In stock only
        </label>
        <button
          type="button"
          onClick={() => setSavedOnly((v) => !v)}
          aria-pressed={savedOnly}
          className={`rounded-lg border px-3 py-2 ${savedOnly ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white" : "border-gray-300 bg-white text-gray-700"}`}
        >
          Saved ({saved.length})
        </button>
      </div>

      {/* Stores (only shown once there is more than one) */}
      {!storeId && stores.length > 1 && (
        <nav aria-label="Stores" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/marketplace?store=${encodeURIComponent(s.id)}`}
              className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-[var(--brand-500)]"
            >
              {s.name}
              <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-500">{s.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* Categories: one scrollable row, so items stay near the top */}
      <nav aria-label="Categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[{ id: "all", label: "All items" }, ...MARKET_CATEGORIES]
          .filter((c) => c.id === "all" || counts[c.id])
          .map((c) => {
            const active = category === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white shadow-md"
                    : "border-gray-200 bg-white text-gray-700 hover:border-[var(--brand-500)] hover:text-[var(--brand-700)]"
                }`}
              >
                {c.label}
                <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>
                  {counts[c.id] ?? 0}
                </span>
              </button>
            )
          })}
      </nav>

      {/* Listings */}
      <section aria-label="Listings" className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-bold text-gray-900">{category === "all" ? "Latest items" : categoryLabel(category)}</h2>
          <p className="text-sm text-gray-500">
            {visible.length} item{visible.length === 1 ? "" : "s"}
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {visible.length === 0 && !error ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-12 text-center space-y-3">
            <p className="text-lg font-semibold text-gray-900">Nothing here yet</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {listings.length === 0
                ? "New items are added regularly. Please check back soon."
                : "No items match your search. Try another category or search term."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {visible.slice(0, shown).map((l) => {
              const isNew = now - l.createdAt < NEW_LISTING_DAYS * 24 * 60 * 60 * 1000
              const reserved = reservationActive(l, now)
              return (
                <Link
                  key={l.id}
                  href={`/marketplace/${l.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand-500)] hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 flex items-center justify-center">
                    {l.images[0] ? (
                      <img
                        src={l.images[0]}
                        alt={l.title}
                        loading="lazy"
                        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${reserved ? "opacity-60" : ""}`}
                      />
                    ) : (
                      <ImageOff className="h-8 w-8 text-gray-300" />
                    )}
                    {reserved ? (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow">
                        <Clock className="h-3 w-3" /> Reserved
                      </span>
                    ) : (
                      isNew && (
                        <span className="absolute left-2 top-2 rounded-full bg-[var(--mp-green)] px-2.5 py-0.5 text-xs font-semibold text-white shadow">
                          New
                        </span>
                      )
                    )}
                    {(l.imageCount ?? l.images.length) > 1 && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                        {l.imageCount ?? l.images.length} photos
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-gray-900 sm:text-base sm:min-h-[3rem]">
                      {l.title}
                    </p>
                    <p className="text-lg font-bold text-[var(--brand-600)] sm:text-xl">{formatRand(l.sellingPrice)}</p>
                    <RatingSummary average={averageRating(l.ratingSum, l.ratingCount)} count={l.ratingCount ?? 0} />
                    <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs">
                      <span className="rounded-full bg-[var(--brand-50)] px-2 py-0.5 font-medium text-[var(--brand-700)]">
                        {conditionLabel(l.condition)}
                      </span>
                      {!reserved && (
                        <span className="font-medium text-green-700">
                          {l.stock === null ? "In stock" : l.stock > 0 ? `${l.stock} in stock` : "Out of stock"}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-600">
                      <span className="font-medium">{l.sellerName || "Store"}</span>
                      {" · "}
                      {l.location || categoryLabel(l.category)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {visible.length > shown && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show more ({visible.length - shown} more)
            </Button>
          </div>
        )}
      </section>

      {/* Trust bar */}
      <ul aria-label="Why use MarketPortal" className="flex flex-wrap justify-center gap-x-8 gap-y-1 border-y border-gray-200 py-3 text-sm font-medium text-gray-700">
        {TRUST.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>

      {/* How it works */}
      <section aria-label="How it works" className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">How MarketPortal works</h2>
          <p className="text-sm text-gray-500">Buying is simple. We do the hard work.</p>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(({ title, text }, i) => (
            <li key={title} className="space-y-0.5">
              <p className="font-semibold text-gray-900">
                {i + 1}. {title}
              </p>
              <p className="text-sm text-gray-600">{text}</p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-gray-500">
          <Link href="/marketplace/terms" className="underline">
            Seller &amp; Buyer Terms and Conditions
          </Link>
        </p>
      </section>
    </div>
  )
}
