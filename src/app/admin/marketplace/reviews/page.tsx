"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { authedFetch } from "@/utils/authedFetch"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, ArrowLeft } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { Stars } from "@/components/marketplace/Stars"

interface AdminReview {
  id: string
  listingId: string
  title: string
  rating: number
  comment: string
  name: string
  hidden: boolean
  createdAt: number
}

export default function AdminReviewsPage() {
  const { loading: authLoading, denied } = useAdminGuard()
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"all" | "hidden" | "low">("all")

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/admin/marketplace/reviews")
      if (!res.ok) throw new Error()
      setReviews((await res.json()).reviews)
    } catch {
      setError("Couldn't load the reviews.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || denied) return
    load()
  }, [authLoading, denied, load])

  const act = async (r: AdminReview, action: "hide" | "show" | "delete") => {
    if (action === "delete" && !window.confirm("Delete this review for good? Its rating is removed from the product's average.")) return
    setBusyId(r.id)
    setError("")
    try {
      const res = await authedFetch("/api/admin/marketplace/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: r.id, action }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Couldn't update that review.")
      setReviews((prev) =>
        action === "delete" ? prev.filter((x) => x.id !== r.id) : prev.map((x) => (x.id === r.id ? { ...x, hidden: action === "hide" } : x))
      )
    } catch (err: any) {
      setError(err?.message || "Couldn't update that review.")
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

  const shown = reviews.filter((r) => (filter === "hidden" ? r.hidden : filter === "low" ? r.rating <= 2 : true))

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4">
      <Link href="/admin/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal admin
      </Link>
      <h1 className="text-2xl font-bold">Product reviews</h1>
      <p className="text-sm text-gray-600">
        Hiding or deleting a review takes its rating out of the product&apos;s average. A hidden review can be restored.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["all", `All (${reviews.length})`],
            ["low", `1 to 2 stars (${reviews.filter((r) => r.rating <= 2).length})`],
            ["hidden", `Hidden (${reviews.filter((r) => r.hidden).length})`],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={filter === id ? "default" : "outline"} className="shrink-0" onClick={() => setFilter(id)}>
            {label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">{reviews.length === 0 ? "No reviews yet." : "No reviews match this filter."}</CardContent>
        </Card>
      ) : (
        shown.map((r) => (
          <Card key={r.id} className={r.hidden ? "opacity-70" : ""}>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/marketplace/${r.listingId}#reviews`} className="font-semibold underline">
                  {r.title}
                </Link>
                {r.hidden && <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">Hidden</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} />
                <span className="font-medium">{r.name}</span>
                {r.createdAt > 0 && <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString("en-ZA")}</span>}
              </div>
              {r.comment && <p className="whitespace-pre-line text-gray-700">{r.comment}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r, r.hidden ? "show" : "hide")}>
                  {r.hidden ? "Restore" : "Hide"}
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r, "delete")}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
