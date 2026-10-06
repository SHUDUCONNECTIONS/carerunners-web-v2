// Product ratings. A listing keeps ratingSum and ratingCount (as driver ratings do), so the
// average is exact and an edited rating can be swapped without drift.
export const MAX_COMMENT = 500;

export const REVIEWS_COLLECTION = "marketplaceReviews";

export interface ReviewView {
  rating: number;
  comment: string;
  name: string;
  createdAt: number;
}

export function averageRating(sum: number | undefined, count: number | undefined): number | null {
  if (!count || count < 1) return null;
  return Math.round(((sum ?? 0) / count) * 10) / 10;
}

// New totals after someone rates (previous = null) or changes their earlier rating.
export function applyRating(sum: number, count: number, previous: number | null, next: number) {
  return previous === null
    ? { sum: sum + next, count: count + 1 }
    : { sum: sum - previous + next, count };
}

export function parseReview(b: any): { error: string } | { rating: number; comment: string } {
  const rating = Number(b?.rating);
  const comment = typeof b?.comment === "string" ? b.comment.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a rating from 1 to 5 stars." };
  if (comment.length > MAX_COMMENT) return { error: `Keep your comment under ${MAX_COMMENT} characters.` };
  return { rating, comment };
}

// "Thabo Mokoena" becomes "Thabo M." so reviews never show someone's full name.
export function publicName(name: unknown): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  const first = parts[0].replace(/[^A-Za-z0-9À-ɏ'-]/g, "") || "Customer";
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

// Taking a rating out of / putting it back into a product's totals (hiding, restoring or deleting a review).
export function withoutRating(sum: number, count: number, rating: number) {
  return { sum: Math.max(0, sum - rating), count: Math.max(0, count - 1) };
}

export function withRating(sum: number, count: number, rating: number) {
  return { sum: sum + rating, count: count + 1 };
}
