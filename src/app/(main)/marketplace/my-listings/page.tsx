"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { auth, db } from "@/utils/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Building2, ImageOff } from "lucide-react"
import LoadingComponent from "@/components/loader"
import {
  LISTING_STATUS_STYLES,
  MARKET_COMPANIES,
  MARKET_LISTINGS,
  MARKET_ORDERS,
  MarketCompany,
  MarketListing,
  MarketOrder,
  companyFromDoc,
  formatRand,
  isListingAvailable,
  listingFromDoc,
  orderFromDoc,
  orderLines,
} from "@/lib/marketplace"
import { addToCart, loadCart, saveCart } from "@/lib/marketplaceCart"
import { ReportProblem, type MyIssue } from "@/components/marketplace/ReportProblem"
import { authedFetch } from "@/utils/authedFetch"

// Everyone sees their purchases. If the signed-in email is one of a company's
// login emails (set by an admin), the company's items and sales appear too.
export default function MyMarketPortalPage() {
  const [companies, setCompanies] = useState<MarketCompany[]>([])
  const [listings, setListings] = useState<MarketListing[]>([])
  const [sales, setSales] = useState<MarketOrder[]>([])
  const [purchases, setPurchases] = useState<MarketOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [issues, setIssues] = useState<MyIssue[]>([])

  const loadIssues = async () => {
    try {
      const res = await authedFetch("/api/marketplace/issues")
      if (res.ok) setIssues((await res.json()).issues)
    } catch {
      // reports are optional: purchases still show
    }
  }
  useEffect(() => {
    loadIssues()
  }, [])
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser
      if (!user) {
        setLoading(false)
        return
      }
      try {
        const purchaseSnap = await getDocs(query(collection(db, MARKET_ORDERS), where("buyerId", "==", user.uid)))
        setPurchases(
          purchaseSnap.docs
            .map((d) => orderFromDoc(d.id, d.data()))
            .filter((o) => o.status !== "cancelled")
            .sort((a, b) => b.createdAt - a.createdAt)
        )

        const email = user.email?.toLowerCase()
        if (email) {
          const companySnap = await getDocs(
            query(collection(db, MARKET_COMPANIES), where("loginEmails", "array-contains", email))
          )
          const mine = companySnap.docs.map((d) => companyFromDoc(d.id, d.data()))
          setCompanies(mine)

          if (mine.length > 0) {
            // Firestore "in" queries take up to 10 values.
            const ids = mine.slice(0, 10).map((c) => c.id)
            const [listingSnap, salesSnap] = await Promise.all([
              getDocs(query(collection(db, MARKET_LISTINGS), where("companyId", "in", ids))),
              getDocs(query(collection(db, MARKET_ORDERS), where("sellerId", "in", ids))),
            ])
            setListings(listingSnap.docs.map((d) => listingFromDoc(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt))
            setSales(
              salesSnap.docs
                .map((d) => orderFromDoc(d.id, d.data()))
                .filter((o) => o.status === "paid")
                .sort((a, b) => b.createdAt - a.createdAt)
            )
          }
        }
      } catch (err) {
        console.error("Error loading MarketPortal data:", err)
        setError("We couldn't load your MarketPortal data. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Puts everything from an earlier order back in the cart at today's price and stock.
  const buyAgain = async (o: MarketOrder) => {
    setError("")
    setNotice("")
    let cart = loadCart()
    const skipped: string[] = []
    for (const line of orderLines(o)) {
      try {
        const snap = await getDoc(doc(db, MARKET_LISTINGS, line.listingId))
        const l = snap.exists() ? listingFromDoc(snap.id, snap.data()) : null
        if (!l || !isListingAvailable(l)) {
          skipped.push(line.title)
          continue
        }
        const result = addToCart(
          cart,
          { id: l.sellerId, name: l.sellerName },
          { listingId: l.id, title: l.title, image: l.images[0] ?? null, unitPrice: l.sellingPrice ?? 0, stock: l.stock },
          line.quantity
        )
        if (result.error) {
          setError(result.error)
          return
        }
        cart = result.cart
      } catch {
        skipped.push(line.title)
      }
    }
    saveCart(cart)
    if (skipped.length > 0) setNotice(`Not available right now: ${skipped.join(", ")}.`)
    else router.push("/marketplace/cart")
  }

  if (loading) return <LoadingComponent />

  const isCompany = companies.length > 0

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/marketplace" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My MarketPortal</h1>
          {isCompany && (
            <p className="flex items-center gap-1.5 text-sm text-gray-600">
              <Building2 className="h-4 w-4" /> {companies.map((c) => c.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-amber-800">{notice}</p>}

      <Tabs defaultValue={isCompany ? "listings" : "purchases"}>
        <TabsList className="w-full sm:w-auto">
          {isCompany && <TabsTrigger value="listings">Company items ({listings.length})</TabsTrigger>}
          {isCompany && <TabsTrigger value="sales">Company sales ({sales.length})</TabsTrigger>}
          <TabsTrigger value="purchases">My purchases ({purchases.length})</TabsTrigger>
        </TabsList>

        {isCompany && (
          <TabsContent value="listings" className="space-y-3">
            {listings.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-500">
                  No items listed for your company yet. Care Runners lists items on your behalf.
                </CardContent>
              </Card>
            ) : (
              listings.map((l) => {
                const status = LISTING_STATUS_STYLES[l.status] ?? LISTING_STATUS_STYLES.inactive
                return (
                  <Card key={l.id}>
                    <CardContent className="p-3 flex gap-3">
                      <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        {l.images[0] ? (
                          <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" />
                        ) : (
                          <ImageOff className="h-6 w-6 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold truncate">{l.title}</p>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Your price: {formatRand(l.askingPrice)}</p>
                        {l.sellingPrice !== null && (
                          <p className="text-sm text-gray-600">Customers pay: {formatRand(l.sellingPrice)}</p>
                        )}
                        {l.status === "rejected" && l.rejectionReason && (
                          <p className="text-sm text-red-600">Reason: {l.rejectionReason}</p>
                        )}
                        {l.status === "active" && (
                          <Link href={`/marketplace/${l.id}`} className="text-sm text-[var(--brand-700)] underline">
                            View listing
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>
        )}

        {isCompany && (
          <TabsContent value="sales" className="space-y-3">
            {sales.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-500">No sales yet.</CardContent>
              </Card>
            ) : (
              sales.map((o) => (
                <Card key={o.id}>
                  <CardContent className="p-4 space-y-1 text-sm">
                    <div className="flex justify-between gap-2 font-semibold">
                      <span>{o.listingTitle}</span>
                      <span className="text-right">
                        {o.sellerPaidOut ? "Paid out" : "Awaiting delivery / payout"}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>You receive</span>
                      <span>{formatRand(o.sellerPrice)}</span>
                    </div>
                    <p className="text-xs text-gray-500">Delivered by Care Runners · paid out after delivery</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        )}

        <TabsContent value="purchases" className="space-y-3">
          {purchases.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                You haven&apos;t bought anything yet.{" "}
                <Link href="/marketplace" className="underline">
                  Browse MarketPortal
                </Link>
              </CardContent>
            </Card>
          ) : (
            purchases.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-3 flex gap-3">
                  <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    {o.listingImage ? (
                      <img src={o.listingImage} alt={o.listingTitle} className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-sm space-y-0.5">
                    {orderLines(o).map((line) => (
                      <p key={line.listingId} className="font-semibold">
                        {line.quantity} x {line.title}
                      </p>
                    ))}
                    <p className="text-gray-600">
                      Total {formatRand(o.totalAmount)} (item {formatRand(o.itemPrice)} + delivery {formatRand(o.deliveryCharged ?? o.deliveryFee)})
                    </p>
                    <p className="text-gray-500 break-words">Delivering to {o.deliveryAddress}</p>
                    {o.status !== "awaiting-payment" && (
                      <button type="button" onClick={() => buyAgain(o)} className="mr-3 inline-block text-[var(--brand-700)] underline">
                        Buy again
                      </button>
                    )}
                    <Link href={`/marketplace/receipt?id=${o.id}`} className="mr-3 inline-block text-[var(--brand-700)] underline">
                      Receipt
                    </Link>
                    {o.status !== "awaiting-payment" &&
                      orderLines(o).map((line) => (
                        <Link key={line.listingId} href={`/marketplace/${line.listingId}#reviews`} className="mr-3 inline-block text-[var(--brand-700)] underline">
                          Rate {orderLines(o).length > 1 ? line.title : "this item"}
                        </Link>
                      ))}
                    {o.status === "paid" && <ReportProblem orderId={o.id} issues={issues} onSent={loadIssues} />}
                    {o.status === "awaiting-payment" ? (
                      <Button asChild size="sm" className="mt-1">
                        <Link href={`/payment?requestId=${o.tripId}`}>Complete payment</Link>
                      </Button>
                    ) : (
                      <Link href={`/trips/tracking?tripId=${o.tripId}`} className="text-[var(--brand-700)] underline">
                        Track delivery
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
