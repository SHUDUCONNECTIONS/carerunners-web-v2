"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Star } from "lucide-react"
import { authedFetch } from "@/utils/authedFetch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Stars } from "@/components/marketplace/Stars"
import { MAX_COMMENT, averageRating, type ReviewView } from "@/lib/marketplaceReviews"

// Ratings and reviews for one product. Anyone can read them; only a buyer whose
// delivery has arrived sees the form (the server checks this again on save).
export function Reviews({
  listingId,
  ratingSum,
  ratingCount,
  onChanged,
}: {
  listingId: string
  ratingSum: number
  ratingCount: number
  onChanged?: () => void
}) {
  const [reviews, setReviews] = useState<ReviewView[]>([])
  const [canReview, setCanReview] = useState(false)
  const [mine, setMine] = useState<{ rating: number; comment: string; hidden?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await authedFetch(`/api/marketplace/reviews?listingId=${encodeURIComponent(listingId)}`)
      if (!res.ok) throw new Error("load failed")
      const data = await res.json()
      setReviews(data.reviews)
      setCanReview(data.canReview)
      setMine(data.mine)
      if (data.mine) {
        setRating(data.mine.rating)
        setComment(data.mine.comment)
      }
    } catch {
      // reviews are optional: the rest of the page still works
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    setError("")
    setMessage("")
    if (!rating) {
      setError("Choose a star rating first.")
      return
    }
    setSaving(true)
    try {
      const res = await authedFetch("/api/marketplace/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, rating, comment }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "We couldn't save your rating.")
      setMessage(mine ? "Your rating was updated." : "Thank you for rating this item.")
      await load()
      onChanged?.()
    } catch (err: any) {
      setError(err?.message || "We couldn't save your rating.")
    } finally {
      setSaving(false)
    }
  }

  const average = averageRating(ratingSum, ratingCount)

  return (
    <section id="reviews" className="space-y-4 rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-gray-900">Ratings and reviews</h2>
        {average !== null ? (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Stars value={average} />
            <span className="font-semibold text-gray-900">{average.toFixed(1)}</span>
            <span>
              from {ratingCount} rating{ratingCount === 1 ? "" : "s"}
            </span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">No ratings yet</p>
        )}
      </div>

      {canReview && (
        <div className="space-y-2 rounded-xl bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">{mine ? "Your rating" : "Rate this item"}</p>
          {mine?.hidden && <p className="text-xs text-amber-800">Care Runners has hidden your review, so it isn&apos;t shown or counted.</p>}
          <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                aria-pressed={rating === n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-600)]"
              >
                <Star className={`h-7 w-7 ${n <= (hovered || rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
              </button>
            ))}
          </div>
          <Textarea
            rows={3}
            maxLength={MAX_COMMENT}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell other buyers about the item (optional)"
            aria-label="Your review"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-green-700">
              {message}
            </p>
          )}
          <Button type="button" onClick={submit} disabled={saving} className="bg-[var(--mp-green)] text-white hover:bg-[var(--mp-green-dark)]">
            {saving ? "Saving…" : mine ? "Update rating" : "Submit rating"}
          </Button>
        </div>
      )}

      {loading ? null : reviews.length === 0 ? (
        <p className="text-sm text-gray-500">
          {canReview ? "Be the first to rate this item." : "Buyers can rate this item once their delivery has arrived."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {reviews.map((r, i) => (
            <li key={`${r.name}-${r.createdAt}-${i}`} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Stars value={r.rating} />
                <span className="font-medium text-gray-900">{r.name}</span>
                {r.createdAt > 0 && <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString("en-ZA")}</span>}
              </div>
              {r.comment && <p className="whitespace-pre-line text-sm text-gray-700">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
