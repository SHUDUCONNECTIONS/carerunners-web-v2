"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { auth, db } from "@/utils/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { AlertCircle } from "lucide-react";

export default function BillingBanner() {
  const [totalOwed, setTotalOwed] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

        const q = query(
          collection(db, "pickupRequests"),
          where("userId", "==", user.uid),
          where("payment_status", "==", "unpaid")
        );
        const snapshot = await getDocs(q);

        const thisMonthTotal = snapshot.docs
          .filter((d) => {
            const data = d.data();
            return data.pickupDate >= startOfMonth && data.status === "completed";
          })
          .reduce((sum, d) => sum + parseFloat(d.data().price || "0"), 0);

        setTotalOwed(thisMonthTotal);
      } catch (err) {
        console.error("BillingBanner: error fetching balance", err);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!totalOwed || totalOwed === 0) return null;

  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
        <span className="text-sm text-amber-800">
          You have <strong>R{totalOwed.toFixed(2)}</strong> outstanding this month.
        </span>
      </div>
      <Link href="/billing" className="text-sm font-semibold text-teal-700 underline hover:text-teal-900">
        View Statement
      </Link>
    </div>
  );
}
