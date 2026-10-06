import * as React from "react"
import { Star } from "lucide-react"

// Read-only stars for a rating from 0 to 5 (halves are rounded to the nearest star).
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  const filled = Math.round(value)
  return (
    <span className="inline-flex" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" className={`${className} ${n <= filled ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
      ))}
    </span>
  )
}

// "4.5 (12)" next to the stars, or nothing when the item has no ratings yet.
export function RatingSummary({ average, count }: { average: number | null; count: number }) {
  if (average === null || count < 1) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
      <Stars value={average} className="h-3.5 w-3.5" />
      <span className="font-medium">{average.toFixed(1)}</span>
      <span>({count})</span>
    </span>
  )
}
