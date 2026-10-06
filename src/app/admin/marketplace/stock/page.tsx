"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/utils/firebase"
import { authedFetch } from "@/utils/authedFetch"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AlertCircle, ArrowLeft } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { MARKET_LISTINGS, MarketListing, formatRand, listingFromDoc } from "@/lib/marketplace"

const PAGE = 40

interface Edit {
  companyPrice?: string
  markup?: string
  stock?: string
}

// Prices and stock for many items at once. Change the boxes, then save: only items you changed are sent.
export default function AdminStockPage() {
  const { loading: authLoading, denied } = useAdminGuard()
  const [listings, setListings] = useState<MarketListing[]>([])
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [lowOnly, setLowOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading || denied) return
    getDocs(collection(db, MARKET_LISTINGS))
      .then((snap) => setListings(snap.docs.map((d) => listingFromDoc(d.id, d.data())).sort((a, b) => a.title.localeCompare(b.title))))
      .catch(() => setError("Couldn't load the listings."))
      .finally(() => setLoading(false))
  }, [authLoading, denied])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return listings.filter(
      (l) => (!term || l.title.toLowerCase().includes(term)) && (!lowOnly || (l.stock !== null && l.stock <= 10))
    )
  }, [listings, search, lowOnly])

  const setEdit = (id: string, field: keyof Edit, value: string) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  // Only boxes that differ from what is saved count as changes.
  const changes = useMemo(() => {
    const out: { id: string; companyPrice?: number; markup?: number; stock?: number }[] = []
    for (const l of listings) {
      const e = edits[l.id]
      if (!e) continue
      const c: { id: string; companyPrice?: number; markup?: number; stock?: number } = { id: l.id }
      if (e.companyPrice !== undefined && e.companyPrice !== "" && Number(e.companyPrice) !== l.askingPrice) c.companyPrice = Number(e.companyPrice)
      if (e.markup !== undefined && e.markup !== "" && Number(e.markup) !== (l.markupAmount ?? 0)) c.markup = Number(e.markup)
      if (e.stock !== undefined && e.stock !== "" && l.stock !== null && Number(e.stock) !== l.stock) c.stock = Number(e.stock)
      if (Object.keys(c).length > 1) out.push(c)
    }
    return out
  }, [edits, listings])

  const save = async () => {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      for (let i = 0; i < changes.length; i += 400) {
        const res = await authedFetch("/api/admin/marketplace/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes: changes.slice(i, i + 400) }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || "Couldn't save the changes.")
      }
      // Apply the saved values to the table so it shows what is now live.
      setListings((prev) =>
        prev.map((l) => {
          const c = changes.find((x) => x.id === l.id)
          if (!c) return l
          const asking = c.companyPrice ?? l.askingPrice
          const markup = c.markup ?? (l.markupAmount ?? 0)
          return {
            ...l,
            askingPrice: asking,
            markupAmount: markup,
            sellingPrice: Math.round((asking + markup) * 100) / 100,
            stock: c.stock ?? l.stock,
            status: c.stock !== undefined && c.stock > 0 && l.status === "sold" ? "active" : l.status,
          }
        })
      )
      setEdits({})
      setMessage(`Saved ${changes.length} item${changes.length === 1 ? "" : "s"}. The shop grid shows the new prices within a minute.`)
    } catch (err: any) {
      setError(err?.message || "Couldn't save the changes.")
    } finally {
      setSaving(false)
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

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-4">
      <Link href="/admin/marketplace" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal admin
      </Link>
      <h1 className="text-2xl font-bold">Prices and stock</h1>
      <p className="text-sm text-gray-600">
        The customer price is the company price plus your markup. Stock only applies to items sold by quantity. Adding stock to a sold-out item puts it back on sale.
      </p>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-[var(--background)] py-2">
        <Input
          type="search"
          className="max-w-xs bg-white"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setShown(PAGE)
          }}
          placeholder="Search items…"
          aria-label="Search items"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only (10 or fewer)
        </label>
        <Button className="ml-auto" onClick={save} disabled={saving || changes.length === 0}>
          {saving ? "Saving…" : `Save ${changes.length} change${changes.length === 1 ? "" : "s"}`}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">No items match.</CardContent>
        </Card>
      ) : (
        rows.slice(0, shown).map((l) => {
          const e = edits[l.id] ?? {}
          return (
            <Card key={l.id}>
              <CardContent className="p-3 grid gap-3 sm:grid-cols-[1fr_auto] items-center text-sm">
                <div className="min-w-0">
                  <p className="font-semibold line-clamp-2">{l.title}</p>
                  <p className="text-gray-500">
                    Customers pay {formatRand(l.sellingPrice)} · {l.status}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:w-96">
                  <label className="space-y-1">
                    <span className="text-xs text-gray-500">Company price</span>
                    <Input type="number" min="0" inputMode="decimal" value={e.companyPrice ?? String(l.askingPrice)} onChange={(ev) => setEdit(l.id, "companyPrice", ev.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-500">Markup</span>
                    <Input type="number" min="0" inputMode="decimal" value={e.markup ?? String(l.markupAmount ?? 0)} onChange={(ev) => setEdit(l.id, "markup", ev.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-500">Stock</span>
                    {l.stock === null ? (
                      <p className="pt-2 text-gray-500">One-off</p>
                    ) : (
                      <Input type="number" min="0" step="1" inputMode="numeric" value={e.stock ?? String(l.stock)} onChange={(ev) => setEdit(l.id, "stock", ev.target.value)} />
                    )}
                  </label>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {rows.length > shown && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({rows.length - shown} more)
          </Button>
        </div>
      )}
    </div>
  )
}
