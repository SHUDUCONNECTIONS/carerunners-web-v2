"use client";

import React, { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { db } from "@/utils/firebase";
import { doc, updateDoc, increment } from "firebase/firestore";

interface RatingPromptProps {
  tripId: string;
  driverId: string;
  onRated: () => void;
}

// Shown once a trip is "delivered" — the final step of the 6-step flow is the
// customer confirming completion by rating their runner. Submitting here is
// what actually flips the trip's status to "completed".
export function RatingPrompt({ tripId, driverId, onRated }: RatingPromptProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await updateDoc(doc(db, "pickupRequests", tripId), {
        status: "completed",
        rating,
        ratingComment: comment.trim(),
        ratedAt: new Date(),
      });
      await updateDoc(doc(db, "drivers", driverId), {
        ratingSum: increment(rating),
        ratingCount: increment(1),
      });
      onRated();
    } catch (err) {
      console.error("Error submitting rating:", err);
      setError("Couldn't submit your rating. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Trip Delivered</p>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Rate your runner</h3>

      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${value} star${value > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                value <= (hovered || rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)…"
        rows={3}
        className="w-full rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500 resize-none text-sm p-3 mb-3"
      />

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          "Submit Rating"
        )}
      </button>
    </div>
  );
}
