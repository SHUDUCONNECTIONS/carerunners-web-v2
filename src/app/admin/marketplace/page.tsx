// @ts-nocheck
"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { collection, doc, documentId, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { db } from "@/utils/firebase"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { authedFetch } from "@/utils/authedFetch"
import { MARKUP_RATE, priceWithMarkup } from "@/lib/marketplaceMarkup"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, Building2, Download, ImageOff, Plus } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { AdminSettings } from "@/components/marketplace/AdminSettings"
import { zoneLabel } from "@/lib/marketplaceDeliveryDay"
import {
  LISTING_STATUS_STYLES,
  MARKET_COMPANIES,
  MARKET_LISTINGS,
  MARKET_ORDERS,
  SA_BANKS,
  categoryLabel,
  companyFromDoc,
  conditionLabel,
  formatRand,
  listingFromDoc,
  orderFromDoc,
  orderLines,
} from "@/lib/marketplace"

// Sales are reported on item prices only: the delivery fee is Care Runners' trip
// income, not a product sale, so it is left out of every sales figure here.
const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
]
const LOW_STOCK = 10

const isDelivered = (o) => o.tripStatus === "delivered" || o.tripStatus === "completed"

function rangeStart(id) {
  const now = new Date()
  if (id === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (id === "7d") return Date.now() - 7 * 24 * 60 * 60 * 1000
  if (id === "30d") return Date.now() - 30 * 24 * 60 * 60 * 1000
  if (id === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return 0
}

function downloadSalesCsv(rows) {
  const q = (v) => '"' + String(v ?? "").split('"').join('""') + '"'
  const head = ["Date", "Order", "Item", "Quantity", "Item sales (R)", "Company price (R)", "Markup (R)", "Delivery to", "Delivery status", "Company paid"]
  // one row per product, so a cart order with three items gives three rows
  const lines = rows.flatMap((o) =>
    orderLines(o).map((l) =>
      [
        new Date(o.createdAt).toISOString().slice(0, 10),
        o.id,
        l.title,
        l.quantity,
        l.unitPrice * l.quantity,
        l.sellerUnitPrice * l.quantity,
        l.markupUnit * l.quantity,
        o.deliveryAddress,
        o.tripStatus,
        o.sellerPaidOut ? "Yes" : "No",
      ]
        .map(q)
        .join(",")
    )
  )
  const blob = new Blob([[head.map(q).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `marketportal-sales-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// With a big catalogue the listing table is searched and shown a page at a time.
const LISTINGS_PAGE = 50

export default function AdminMarketplacePage() {
  const { loading: authLoading, denied } = useAdminGuard()
  const [listings, setListings] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [range, setRange] = useState("30d")
  const [orderFilter, setOrderFilter] = useState("all")
  const [companyList, setCompanyList] = useState([])
  const [shown, setShown] = useState(LISTINGS_PAGE)

  useEffect(() => {
    if (authLoading || denied) return
    const load = async () => {
      try {
        const companySnap = await getDocs(collection(db, MARKET_COMPANIES))
        const companies = companySnap.docs.map((d) => companyFromDoc(d.id, d.data()))
        setCompanyList(companies)
        const companyById = new Map(companies.map((c) => [c.id, c]))
        const listingSnap = await getDocs(collection(db, MARKET_LISTINGS))
        const all = listingSnap.docs.map((d) => listingFromDoc(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
        setListings(all)

        // Paid orders, with the live status of their delivery trip and the company's payout details.
        // Trips are read 30 at a time (Firestore's limit for "in") instead of one read per order.
        const orderSnap = await getDocs(query(collection(db, MARKET_ORDERS), where("status", "==", "paid")))
        const tripIds = [...new Set(orderSnap.docs.map((d) => d.data().tripId).filter(Boolean))] as string[]
        const trips = new Map<string, any>()
        const chunks = Array.from({ length: Math.ceil(tripIds.length / 30) }, (_, i) => tripIds.slice(i * 30, i * 30 + 30))
        for (const snap of await Promise.all(chunks.map((ids) => getDocs(query(collection(db, "pickupRequests"), where(documentId(), "in", ids)))))) {
          snap.docs.forEach((t) => trips.set(t.id, t.data()))
        }
        const paid = orderSnap.docs.map((d) => {
          const o = orderFromDoc(d.id, d.data())
          const trip = trips.get(o.tripId)
          return {
            ...o,
            tripStatus: trip ? trip.status : "unknown",
            courierRef: trip?.courierRef ?? "",
            company: companyById.get(o.sellerId) ?? null,
            sellerPayoutRef: d.data().sellerPayoutRef ?? "",
          }
        })
        setOrders(paid.sort((a, b) => b.createdAt - a.createdAt))
      } catch (err) {
        console.error("Error loading MarketPortal admin data:", err)
        setError("Couldn't load MarketPortal data.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [authLoading, denied])

  const setListingStatus = async (l, status) => {
    setBusyId(l.id)
    setError("")
    try {
      await updateDoc(doc(db, MARKET_LISTINGS, l.id), { status, updatedAt: serverTimestamp() })
      setListings((prev) => prev.map((x) => (x.id === l.id ? { ...x, status } : x)))
    } catch (err) {
      console.error("Error updating listing:", err)
      setError("Couldn't update that listing.")
    } finally {
      setBusyId("")
    }
  }

  // The server prices the item (company price + the standard markup) as it goes live.
  const approve = async (l) => {
    setBusyId(l.id)
    setError("")
    try {
      const res = await authedFetch("/api/admin/marketplace/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: l.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't approve that item.")
      setListings((prev) =>
        prev.map((x) => (x.id === l.id ? { ...x, status: "active", markupAmount: data.markupAmount, sellingPrice: data.sellingPrice } : x))
      )
    } catch (err) {
      console.error("Error approving listing:", err)
      setError(err?.message || "Couldn't approve that item.")
    } finally {
      setBusyId("")
    }
  }

  const reject = async (l) => {
    const reason = window.prompt("Reason for rejecting this item? The company will see it.")
    if (reason === null) return
    setBusyId(l.id)
    setError("")
    try {
      await updateDoc(doc(db, MARKET_LISTINGS, l.id), {
        status: "rejected",
        rejectionReason: reason.trim(),
        updatedAt: serverTimestamp(),
      })
      setListings((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: "rejected", rejectionReason: reason.trim() } : x)))
    } catch (err) {
      console.error("Error rejecting listing:", err)
      setError("Couldn't reject that item.")
    } finally {
      setBusyId("")
    }
  }

  // Courier orders never reach a driver, so an admin moves them on: sent (with the courier's
  // tracking number), then delivered. The buyer is emailed at each step, like a driver delivery.
  const advanceCourier = async (o) => {
    const sending = o.tripStatus === "courier"
    let courierRef = o.courierRef
    if (sending) {
      courierRef = window.prompt("Courier and tracking number (e.g. The Courier Guy, waybill 123456):")
      if (!courierRef || !courierRef.trim()) return
      courierRef = courierRef.trim()
    } else if (!window.confirm("Mark this courier order as delivered?")) {
      return
    }
    const status = sending ? "in-transit" : "delivered"
    setBusyId(o.id)
    setError("")
    try {
      await updateDoc(doc(db, "pickupRequests", o.tripId), sending ? { status, courierRef } : { status })
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, tripStatus: status, courierRef } : x)))
      authedFetch("/api/marketplace/notify-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: o.tripId }),
      }).catch(() => {})
    } catch (err) {
      console.error("Error updating courier order:", err)
      setError("Couldn't update that order.")
    } finally {
      setBusyId("")
    }
  }

  const markPaidOut = async (o) => {
    const ref = window.prompt(`Enter the EFT reference / proof of payment for the ${formatRand(o.sellerPrice)} payout:`)
    if (!ref || !ref.trim()) return
    setBusyId(o.id)
    setError("")
    try {
      await updateDoc(doc(db, MARKET_ORDERS, o.id), {
        sellerPaidOut: true,
        sellerPaidOutAt: serverTimestamp(),
        sellerPayoutRef: ref.trim(),
        sellerPayoutMethod: "manual",
      })
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, sellerPaidOut: true, sellerPayoutRef: ref.trim() } : x)))
    } catch (err) {
      console.error("Error marking company paid:", err)
      setError("Couldn't update that order.")
    } finally {
      setBusyId("")
    }
  }

  if (authLoading || loading) return <LoadingComponent />

  if (denied) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-2">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
        <p>You don&apos;t have access to this page.</p>
      </div>
    )
  }

  const start = rangeStart(range)
  const sold = orders.filter((o) => o.createdAt >= start)
  const itemSales = sold.reduce((n, o) => n + (Number(o.itemPrice) || 0), 0)
  const unitsSold = sold.reduce((n, o) => n + orderLines(o).reduce((m, l) => m + l.quantity, 0), 0)
  const owedToCompanies = sold.filter((o) => !o.sellerPaidOut).reduce((n, o) => n + (Number(o.sellerPrice) || 0), 0)
  const markupEarned = sold.reduce((n, o) => n + (Number(o.markupAmount) || 0), 0)
  const topProducts = Object.values(
    sold.reduce((acc, o) => {
      for (const line of orderLines(o)) {
        const row = (acc[line.listingId] ??= { title: line.title, units: 0, sales: 0 })
        row.units += line.quantity
        row.sales += line.unitPrice * line.quantity
      }
      return acc
    }, {})
  )
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)
  const lowStock = listings
    .filter((l) => l.stock !== null && l.stock <= LOW_STOCK && (l.status === "active" || l.status === "sold" || l.status === "reserved"))
    .sort((a, b) => a.stock - b.stock)
  const term = search.trim().toLowerCase()
  const matching = term
    ? listings.filter((l) => `${l.title} ${l.sellerName} ${categoryLabel(l.category)}`.toLowerCase().includes(term))
    : listings

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">MarketPortal admin</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/marketplace/stock">Prices and stock</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/marketplace/issues">Problems</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/marketplace/reviews">Reviews</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/marketplace/searches">Searches</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/marketplace/companies">
              <Building2 className="h-4 w-4 mr-1" /> Companies
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/marketplace/new">
              <Plus className="h-4 w-4 mr-1" /> List an item
            </Link>
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {companyList
        .filter((c) => c.active)
        .map((c) => {
          const missing = [
            !c.phone.trim() && "pickup phone number",
            !(c.bank.accountNumber && c.bank.bankId && c.bank.accountHolder) && "bank details",
          ].filter(Boolean)
          return missing.length === 0 ? null : (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <span>
                <b>{c.name}</b> is missing its {missing.join(" and ")}. Drivers can&apos;t phone the pickup and you can&apos;t pay the company until this is filled in.
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/marketplace/companies">Edit company</Link>
              </Button>
            </div>
          )
        })}

      <AdminSettings />

      {listings.some((l) => l.status === "pending") && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Awaiting review ({listings.filter((l) => l.status === "pending").length})</h2>
          {listings
            .filter((l) => l.status === "pending")
            .map((l) => {
              const priced = priceWithMarkup(l.askingPrice)
              return (
                <Card key={l.id} className="border-amber-200">
                  <CardContent className="p-4 space-y-3 text-sm">
                    <div>
                      <p className="text-base font-semibold">{l.title}</p>
                      <p className="text-gray-500">
                        {l.sellerName} · {categoryLabel(l.category)} · {conditionLabel(l.condition)} · {l.location}
                      </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                      {l.images.map((src) => (
                        <a key={src} href={src} target="_blank" rel="noreferrer" className="shrink-0">
                          <img src={src} alt="" className="h-24 w-24 rounded-lg border object-cover" />
                        </a>
                      ))}
                    </div>
                    <p className="whitespace-pre-line">{l.description}</p>
                    {l.specifications && (
                      <p className="whitespace-pre-line">
                        <b>Specs:</b> {l.specifications}
                      </p>
                    )}
                    <p className="whitespace-pre-line">
                      <b>Defects:</b> {l.defects || "None given"}
                      {l.knownIssues.length > 0 ? ` (${l.knownIssues.join(", ")})` : ""}
                    </p>
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <p className="text-gray-500">Company price</p>
                        <p className="font-bold">{formatRand(l.askingPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Care Runners markup ({MARKUP_RATE * 100}%)</p>
                        <p className="font-bold">{formatRand(priced.markupAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Customers pay</p>
                        <p className="font-bold text-[var(--brand-700)]">{formatRand(priced.sellingPrice)}</p>
                      </div>
                      <div className="ml-auto flex gap-2">
                        <Button variant="outline" disabled={busyId === l.id} onClick={() => reject(l)}>
                          Reject
                        </Button>
                        <Button disabled={busyId === l.id} onClick={() => approve(l)}>
                          Approve &amp; go live
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Sales</h2>
          <Button size="sm" variant="outline" disabled={sold.length === 0} onClick={() => downloadSalesCsv(sold)}>
            <Download className="h-4 w-4 mr-1" /> Download CSV
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RANGES.map((r) => (
            <Button key={r.id} size="sm" variant={range === r.id ? "default" : "outline"} className="shrink-0" onClick={() => setRange(r.id)}>
              {r.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Sales (excl. delivery)</p>
              <p className="text-2xl font-bold text-[var(--brand-700)]">{formatRand(itemSales)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Orders</p>
              <p className="text-2xl font-bold">{sold.length}</p>
              <p className="text-xs text-gray-500">
                {unitsSold} unit{unitsSold === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Still owed to companies</p>
              <p className="text-2xl font-bold">{formatRand(owedToCompanies)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Markup earned</p>
              <p className="text-2xl font-bold">{formatRand(markupEarned)}</p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="font-semibold">Top products</p>
              {topProducts.length === 0 ? (
                <p className="text-gray-500">No sales in this period.</p>
              ) : (
                topProducts.map((p) => (
                  <div key={p.title} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{p.title}</span>
                    <span className="shrink-0 text-gray-600">
                      {p.units} sold · <b>{formatRand(p.sales)}</b>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="font-semibold">Low stock ({lowStock.length})</p>
              {lowStock.length === 0 ? (
                <p className="text-gray-500">Nothing is running low.</p>
              ) : (
                <>
                  {lowStock.slice(0, 8).map((l) => (
                    <div key={l.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{l.title}</span>
                      <span className={`shrink-0 font-semibold ${l.stock === 0 ? "text-red-600" : "text-amber-700"}`}>
                        {l.stock === 0 ? "Sold out" : `${l.stock} left`}
                      </span>
                    </div>
                  ))}
                  {lowStock.length > 8 && <p className="text-xs text-gray-500">+ {lowStock.length - 8} more (search in All listings)</p>}
                </>
              )}
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-gray-500">
          Paid orders only, counted from the day the order was placed. Delivery fees are left out. Cancelled and refunded orders don&apos;t count.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Paid orders &amp; company payouts</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ["all", `All (${orders.length})`],
            ["transit", `On the way (${orders.filter((o) => !isDelivered(o)).length})`],
            ["owed", `Delivered, company unpaid (${orders.filter((o) => isDelivered(o) && !o.sellerPaidOut).length})`],
          ].map(([id, label]) => (
            <Button key={id} size="sm" variant={orderFilter === id ? "default" : "outline"} className="shrink-0" onClick={() => setOrderFilter(id)}>
              {label}
            </Button>
          ))}
        </div>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">No paid orders yet.</CardContent>
          </Card>
        ) : (
          orders
            .filter((o) => (orderFilter === "transit" ? !isDelivered(o) : orderFilter === "owed" ? isDelivered(o) && !o.sellerPaidOut : true))
            .map((o) => {
            const delivered = isDelivered(o)
            return (
              <Card key={o.id}>
                <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex-1 min-w-[200px]">
                    {orderLines(o).map((line) => (
                      <p key={line.listingId} className="font-semibold">
                        {line.quantity} x {line.title}
                      </p>
                    ))}
                    <p className="text-gray-500 break-words">Deliver to {o.deliveryAddress}</p>
                    <p className="text-gray-500">
                      Delivery: {o.tripStatus}
                      {o.deliveryMethod === "courier" && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {zoneLabel(o.deliveryZone)}
                        </span>
                      )}
                    </p>
                    {o.courierRef && <p className="text-gray-500 break-words">Courier: {o.courierRef}</p>}
                    {o.deliveryMethod === "courier" && (o.tripStatus === "courier" || o.tripStatus === "in-transit") && (
                      <Button size="sm" variant="outline" className="mt-2" disabled={busyId === o.id} onClick={() => advanceCourier(o)}>
                        {o.tripStatus === "courier" ? "Mark sent with courier" : "Mark delivered"}
                      </Button>
                    )}
                    {o.company ? (
                      <p className="text-gray-600 break-words mt-1">
                        <b>Pay {o.company.name}:</b> {o.company.bank.accountHolder} ·{" "}
                        {SA_BANKS.find((b) => b.id === o.company.bank.bankId)?.label} · {o.company.bank.accountType} · acc{" "}
                        {o.company.bank.accountNumber} · branch {o.company.bank.branchCode}
                      </p>
                    ) : (
                      <p className="text-red-600 mt-1">Company record not found.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-500">Buyer paid</p>
                    <p className="font-bold">{formatRand(o.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Owe company</p>
                    <p className="font-bold text-[var(--brand-700)]">{formatRand(o.sellerPrice)}</p>
                  </div>
                  {o.sellerPaidOut ? (
                    <span className="text-green-700 font-semibold">Company paid · ref {o.sellerPayoutRef}</span>
                  ) : (
                    <Button
                      disabled={!delivered || busyId === o.id}
                      onClick={() => markPaidOut(o)}
                      title={delivered ? "" : "Available once the item is delivered"}
                    >
                      Mark company paid
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">All listings ({listings.length})</h2>
        <Input
          type="search"
          className="bg-white"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setShown(LISTINGS_PAGE)
          }}
          placeholder="Search listings…"
          aria-label="Search listings"
        />
        {matching.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              {listings.length === 0 ? "Nothing listed yet." : "No listings match your search."}
            </CardContent>
          </Card>
        ) : (
          matching.slice(0, shown).map((l) => {
            const status = LISTING_STATUS_STYLES[l.status] ?? LISTING_STATUS_STYLES.inactive
            return (
              <Card key={l.id}>
                <CardContent className="p-3 flex flex-wrap gap-x-3 gap-y-2 items-center">
                  <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    {l.images[0] ? (
                      <img src={l.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-[10rem] text-sm">
                    <p className="font-semibold line-clamp-2">{l.title}</p>
                    <p className="text-gray-500 break-words">
                      {l.sellerName} · company {formatRand(l.askingPrice)} · customers {formatRand(l.sellingPrice)}
                      {l.stock !== null ? ` · ${l.stock} in stock` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
                    {l.status === "active" && (
                      <Button size="sm" variant="outline" disabled={busyId === l.id} onClick={() => setListingStatus(l, "inactive")}>
                        Take down
                      </Button>
                    )}
                    {l.status === "inactive" && (
                      <Button size="sm" variant="outline" disabled={busyId === l.id} onClick={() => setListingStatus(l, "active")}>
                        Put live
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
        {matching.length > shown && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setShown((n) => n + LISTINGS_PAGE)}>
              Show more ({matching.length - shown} more)
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
