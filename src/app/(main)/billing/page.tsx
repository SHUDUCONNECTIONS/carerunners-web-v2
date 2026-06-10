// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/utils/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin } from "lucide-react";
import LoadingComponent from "@/components/loader";

type UnpaidTrip = {
  id: string;
  pickupDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  distance: string;
  price: string;
  urgency: string;
  documentDescription: string;
};

type MonthGroup = {
  key: string;
  label: string;
  trips: UnpaidTrip[];
  total: number;
};

function groupByMonth(trips: UnpaidTrip[]): MonthGroup[] {
  const map = new Map<string, UnpaidTrip[]>();

  for (const trip of trips) {
    const d = new Date(trip.pickupDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trip);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, trips]) => {
      const [year, month] = key.split("-").map(Number);
      const label = new Date(year, month - 1).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      const total = trips.reduce(
        (sum, t) => sum + parseFloat(t.price || "0"),
        0
      );
      return { key, label, trips, total };
    });
}

export default function BillingPage() {
  const [groups, setGroups] = useState<MonthGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingGroupKey, setPayingGroupKey] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [shopperResultUrl, setShopperResultUrl] = useState("");
  const [preparingPayment, setPreparingPayment] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth/login");
        return;
      }
      try {
        const q = query(
          collection(db, "pickupRequests"),
          where("userId", "==", user.uid),
          where("payment_status", "==", "unpaid")
        );
        const snapshot = await getDocs(q);
        const trips: UnpaidTrip[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<UnpaidTrip, "id">),
        }));
        setGroups(groupByMonth(trips));
      } catch (err) {
        console.error("Billing: error fetching unpaid trips", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Inject / remove Peach Payments script whenever checkoutId changes
  useEffect(() => {
    if (!checkoutId) return;
    const script = document.createElement("script");
    script.src = `https://card.peachpayments.com/v1/paymentWidgets.js?checkoutId=${checkoutId}`;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [checkoutId]);

  const handlePayNow = async (group: MonthGroup) => {
    setPreparingPayment(true);
    try {
      const response = await fetch("/api/prepare-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: group.total.toFixed(2) }),
      });
      if (!response.ok) throw new Error("Failed to prepare checkout");
      const data = await response.json();

      const requestIds = group.trips.map((t) => t.id).join(",");
      setShopperResultUrl(`/billing/status?requestIds=${requestIds}`);
      setPayingGroupKey(group.key);
      setCheckoutId(data.id);
    } catch (err) {
      console.error("Billing: checkout preparation failed", err);
    } finally {
      setPreparingPayment(false);
    }
  };

  const cancelPayment = () => {
    setCheckoutId(null);
    setPayingGroupKey(null);
    setShopperResultUrl("");
  };

  if (loading) return <LoadingComponent />;

  const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);
  const totalTrips = groups.reduce((n, g) => n + g.trips.length, 0);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header summary */}
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Billing Statement</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            {groups.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-gray-500 text-lg">No outstanding balance — you're all caught up!</p>
                <Button
                  className="mt-6 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => router.push("/dashboard")}
                >
                  Back to Dashboard
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-teal-700">R{grandTotal.toFixed(2)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {totalTrips} unpaid trip{totalTrips !== 1 ? "s" : ""} across{" "}
                    {groups.length} month{groups.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  Outstanding
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-month breakdown */}
        {groups.map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-teal-600" />
                  {group.label}
                </CardTitle>
                <span className="text-lg font-bold text-teal-700">R{group.total.toFixed(2)}</span>
              </div>
            </CardHeader>
            <CardContent>
              {/* Itemised table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Route</th>
                      <th className="pb-2 pr-4 font-medium">Distance</th>
                      <th className="pb-2 pr-4 font-medium">Urgency</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.trips.map((trip) => (
                      <tr key={trip.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 whitespace-nowrap">{trip.pickupDate}</td>
                        <td className="py-3 pr-4 max-w-[200px]">
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3.5 w-3.5 text-teal-600 mt-0.5 shrink-0" />
                            <span className="truncate">{trip.pickupLocation}</span>
                          </div>
                          <div className="flex items-start gap-1 mt-1 text-gray-400">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="truncate">{trip.dropoffLocation}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">{trip.distance} km</td>
                        <td className="py-3 pr-4 capitalize">{trip.urgency}</td>
                        <td className="py-3 text-right font-medium">
                          R{parseFloat(trip.price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="pt-3 font-bold text-gray-700">
                        Subtotal
                      </td>
                      <td className="pt-3 text-right font-bold text-teal-700">
                        R{group.total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <Separator className="my-5" />

              {/* Payment widget or action buttons */}
              {payingGroupKey === group.key && checkoutId ? (
                <div>
                  <h3 className="text-base font-semibold mb-4">Complete Payment — R{group.total.toFixed(2)}</h3>
                  <form
                    action={shopperResultUrl}
                    className="paymentWidgets"
                    data-brands="VISA MASTER AMEX"
                  />
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={cancelPayment}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => handlePayNow(group)}
                    disabled={preparingPayment || payingGroupKey !== null}
                  >
                    {preparingPayment && payingGroupKey === null
                      ? "Preparing..."
                      : `Pay R${group.total.toFixed(2)} Now`}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push("/dashboard")}
                  >
                    Pay Later
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
