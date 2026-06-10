// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { db, auth } from "@/utils/firebase";
import { doc, writeBatch } from "firebase/firestore";
import LoadingComponent from "@/components/loader";

const INITIAL_DELAY = 2000;

export default function BillingStatusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [paymentData, setPaymentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiCalledRef = useRef(false);

  const markAllPaid = useCallback(
    async (data) => {
      const raw = searchParams.get("requestIds") ?? "";
      const requestIds = raw.split(",").filter(Boolean);
      if (requestIds.length === 0) return;

      const batch = writeBatch(db);
      requestIds.forEach((id) => {
        batch.update(doc(db, "pickupRequests", id), {
          payment_status: "paid",
          status: "waiting for driver",
        });
      });
      await batch.commit();

      const user = auth.currentUser;
      if (user) {
        await fetch("/api/send-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            amount: data.amount,
            date: data.timestamp,
            brand: data.paymentBrand,
            customMessage: `This payment covers ${requestIds.length} trip${
              requestIds.length !== 1 ? "s" : ""
            }.`,
          }),
        });
      }
    },
    [searchParams]
  );

  const checkPayment = useCallback(
    async (id: string) => {
      if (apiCalledRef.current) return;
      apiCalledRef.current = true;
      try {
        const res = await fetch(`/api/check-payment-status?id=${id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setPaymentData(data);

        if (data.result?.code?.startsWith("000.")) {
          await markAllPaid(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [markAllPaid]
  );

  useEffect(() => {
    const paymentId = searchParams.get("id");
    if (paymentId && !apiCalledRef.current) {
      const timer = setTimeout(() => checkPayment(paymentId), INITIAL_DELAY);
      return () => {
        clearTimeout(timer);
        apiCalledRef.current = false;
      };
    }
  }, [searchParams, checkPayment]);

  const formatAmount = (amount, currency) => {
    if (!amount || !currency) return "N/A";
    return `${currency} ${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) return <LoadingComponent />;
  if (error) return <p className="p-8 text-red-600">Error: {error}</p>;

  const code = paymentData?.result?.code ?? "";
  const isSuccess = code.startsWith("000.");
  const isPending = code.startsWith("100.") || code.startsWith("200.");

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold text-center">
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="flex flex-col items-center space-y-4">
              {isSuccess ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : isPending ? (
                <Clock className="h-16 w-16 text-yellow-500" />
              ) : code ? (
                <XCircle className="h-16 w-16 text-red-500" />
              ) : (
                <AlertTriangle className="h-16 w-16 text-yellow-500" />
              )}

              <h2 className="text-2xl font-semibold text-gray-800">
                {isSuccess
                  ? "Payment Successful"
                  : isPending
                  ? "Payment Pending"
                  : code
                  ? "Payment Failed"
                  : "Unknown Status"}
              </h2>
              <p className="text-center text-gray-600">
                {isSuccess
                  ? "All trips have been marked as paid. A confirmation email is on its way."
                  : isPending
                  ? "Your payment is being processed. This may take a few moments."
                  : code
                  ? "Your payment could not be processed. Please try again."
                  : "We could not determine the payment status."}
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-600">Amount</span>
                <span>{formatAmount(paymentData?.amount, paymentData?.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-600">Date</span>
                <span>{formatDate(paymentData?.timestamp)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-600">Payment Method</span>
                <span>{paymentData?.paymentBrand || "N/A"}</span>
              </div>
              {paymentData?.card?.last4Digits && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-600">Card</span>
                  <span>**** **** **** {paymentData.card.last4Digits}</span>
                </div>
              )}
            </div>

            <div className="mt-8 space-y-3">
              {isSuccess && (
                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => router.push("/dashboard")}
                >
                  Back to Dashboard
                </Button>
              )}
              {isPending && (
                <Button variant="outline" className="w-full" onClick={() => router.push("/billing")}>
                  Back to Billing
                </Button>
              )}
              {!isSuccess && !isPending && code && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => router.push("/billing")}
                >
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
