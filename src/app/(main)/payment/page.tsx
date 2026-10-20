"use client";
import BackLink from "@/components/BackLink";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, Clock, FileText, Truck, Briefcase, User } from "lucide-react";
import { RandIcon } from "@/components/RandIcon";
import LoadingComponent from '@/components/loader';
import { authedFetch } from '@/utils/authedFetch';


function formatCurrency(value, locale = 'en-ZA', currency = 'ZAR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// One label/value line of the summary. The label keeps to one line; a long value (an email address, an
// address) wraps inside the card instead of running off a phone screen. Empty values are left out.
function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  const empty = children == null || children === "" || (React.isValidElement(children) && !(children.props as any)?.children);
  if (empty) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex shrink-0 items-center gap-2">
        <Icon className="h-5 w-5 text-teal-600" />
        <span className="whitespace-nowrap font-semibold">{label}</span>
      </div>
      <div className="min-w-0 text-right [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}


type TripSummaryData = {
  attorneyName?: string;
  firmName?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  documentType?: string;
  documentDescription?: string;
  urgency?: string;
  specialInstructions?: string;
  distance: string;
  price: string;
  status?: string;
  payment_status?: string;
  marketItemAmount?: number;
  marketDeliveryDiscount?: number;
  marketItems?: { title: string; quantity: number; unitPrice: number }[];
};


export default function TripSummary() {
  const [tripData, setTripData] = useState<TripSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [shopperResultUrl, setShopperResultUrl] = useState<string>("");
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);


  const searchParams = useSearchParams();
  const requestId = searchParams.get('requestId');


  useEffect(() => {
    const fetchTripData = async () => {
      if (!requestId) {
        setError('No request ID provided');
        setLoading(false);
        return;
      }


      try {
        const docRef = doc(db, 'pickupRequests', requestId);
        const docSnap = await getDoc(docRef);


        if (docSnap.exists()) {
          setTripData(docSnap.data() as TripSummaryData);
        } else {
          setError('No such document!');
        }
      } catch (err) {
        setError('Error fetching document');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };


    fetchTripData();
  }, [requestId]);


  // Creates the Peach checkout. Runs in parallel with the trip lookup (the
  // server validates the trip itself, so there's no need to wait for it) and
  // at most once per page visit: React Strict Mode double-runs effects in dev,
  // and a second checkout would swap the id under an already-initialised
  // widget, leaving a blank form until a manual refresh.
  const prepareStarted = useRef(false);
  // What the server is charging. It re-prices the trip, so this wins over the saved trip price.
  const [chargedAmount, setChargedAmount] = useState<number | null>(null);

  const prepareCheckout = useCallback(async () => {
    if (!requestId) return;
    setCheckoutId(null);
    setPrepareError(null);
    try {
      const response = await authedFetch("/api/prepare-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "trip", requestId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || `Failed to prepare checkout (HTTP ${response.status})`);
      }

      // Peach Payments returns a 200 with an error payload (no `id`)
      // rather than a non-2xx status when the request itself is rejected
      // — e.g. a missing/invalid ENTITY_ID or BEARER_TOKEN.
      if (!data?.id) {
        throw new Error(data?.message || "Payment gateway did not return a checkout session.");
      }

      setShopperResultUrl(`/payment/status?requestId=${requestId}`);
      if (Number.isFinite(data.amount)) setChargedAmount(data.amount);
      setCheckoutId(data.id);
    } catch (err: any) {
      console.error("Error calling API:", err);
      setPrepareError(err?.message || "Error preparing payment checkout");
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId || prepareStarted.current) return;
    prepareStarted.current = true;
    prepareCheckout();
  }, [requestId, prepareCheckout]);

  // Loads Peach's widget script for the current checkout. Any leftover widget
  // script/global from a previous attempt is cleared first, otherwise Peach
  // keeps the old checkout and the form never renders.
  useEffect(() => {
    if (!checkoutId) return;
    setWidgetReady(false);

    document
      .querySelectorAll('script[src*="paymentWidgets.js"]')
      .forEach((el) => el.parentNode?.removeChild(el));
    delete (window as any).wpwl;

    const script = document.createElement("script");
    script.src = `https://card.peachpayments.com/v1/paymentWidgets.js?checkoutId=${checkoutId}`;
    script.async = true;
    script.onerror = () => setPrepareError("Couldn't load the payment form. Check your connection and try again.");
    document.body.appendChild(script);

    // Peach builds its card form (wpwl-* elements) somewhere around the
    // placeholder <form>, not necessarily inside it, so look for it anywhere.
    const widgetPresent = () => document.querySelector('[class*="wpwl-"]') !== null;

    const watchdog = window.setInterval(() => {
      if (widgetPresent()) {
        setWidgetReady(true);
        window.clearInterval(watchdog);
      }
    }, 300);

    // Only offer a retry if the form genuinely never appeared. A form that is
    // on screen is never replaced by an error.
    const giveUp = window.setTimeout(() => {
      window.clearInterval(watchdog);
      if (widgetPresent()) {
        setWidgetReady(true);
      } else {
        setPrepareError("The payment form is taking too long to load.");
      }
    }, 20000);

    return () => {
      window.clearInterval(watchdog);
      window.clearTimeout(giveUp);
      // The Peach Payments widget can mutate/move the DOM around this
      // script tag once it initializes, so it may no longer be a direct
      // child of <body> by the time this cleanup runs — removeChild would
      // throw NotFoundError in that case.
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [checkoutId, widgetKey]);

  const handleRetry = () => {
    setWidgetKey((k) => k + 1);
    prepareCheckout();
  };


  if (loading) {
    return <LoadingComponent/>
  }


  if (error || !tripData) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <BackLink href="/trips" label="Back" smart />
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700">
          We couldn't find this trip. It may have been removed, or it belongs to a different account.
        </div>
      </div>
    );
  }


  const deliveryPrice = parseFloat(tripData.price);
  const itemAmount = Number(tripData.marketItemAmount || 0);
  const deliveryDiscount = Number(tripData.marketDeliveryDiscount || 0);
  const formattedPrice = formatCurrency(chargedAmount ?? deliveryPrice + itemAmount - deliveryDiscount);


  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <BackLink href="/trips" label="Back" smart className="mb-4" />
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Trip Summary</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="space-y-6">
              <Row icon={User} label="Requested by:">{tripData.attorneyName}</Row>
              <Row icon={Briefcase} label="Company:">{tripData.firmName}</Row>
              <Separator />
              <Row icon={MapPin} label="Pickup:">{tripData.pickupLocation}</Row>
              <Row icon={MapPin} label="Dropoff:">{tripData.dropoffLocation}</Row>
              <Separator />
              <Row icon={Calendar} label="Date:">{tripData.pickupDate}</Row>
              <Row icon={Clock} label="Time:">{tripData.pickupTime}</Row>
              <Separator />
              <Row icon={FileText} label="Description:">{tripData.documentDescription}</Row>
              <Row icon={Truck} label="Urgency:"><span className="capitalize">{tripData.urgency}</span></Row>
              <Row icon={FileText} label="Special Instructions:">{tripData.specialInstructions}</Row>
              <Separator />
              <Row icon={Truck} label="Estimated Distance:">{tripData.distance ? `${tripData.distance} km` : null}</Row>
              {itemAmount > 0 && (
                <>
                  {(tripData.marketItems ?? []).map((it) => (
                    <div key={it.title} className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        {it.quantity} x {it.title}
                      </span>
                      <span className="shrink-0">{formatCurrency(it.quantity * it.unitPrice)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Item price:</span>
                    <span>{formatCurrency(itemAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Care Runners delivery:</span>
                    <span>{formatCurrency(deliveryPrice)}</span>
                  </div>
                  {deliveryDiscount > 0 && (
                    <div className="flex items-center justify-between text-green-700">
                      <span className="font-semibold">Delivery discount:</span>
                      <span>{formatCurrency(deliveryDiscount)} off</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between text-lg font-bold">
                <div className="flex items-center space-x-2">
                  <RandIcon className="h-5 w-5 text-teal-600" />
                  <span>Total Cost:</span>
                </div>
                <span>{formattedPrice}</span>
              </div>
            </div>
           
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Payment</h3>
              {tripData.status === "cancelled" || tripData.payment_status === "cancelled" ? (
                <div role="status" className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  This trip was cancelled, so there is nothing to pay. You have not been charged.
                </div>
              ) : tripData.payment_status === "paid" ? (
                <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  This trip has already been paid.
                </div>
              ) : prepareError ? (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 space-y-3">
                  <p>{prepareError}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {!widgetReady && (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                      Preparing secure payment…
                    </div>
                  )}
                  {checkoutId && (
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <form
                        key={`${checkoutId}-${widgetKey}`}
                        action={shopperResultUrl}
                        className="paymentWidgets"
                        data-brands="VISA MASTER AMEX"
                      ></form>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

