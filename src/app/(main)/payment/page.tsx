"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, Clock, FileText, DollarSign, Truck, Briefcase, User, Package, Store } from "lucide-react";
import LoadingComponent from '@/components/loader';
import { authedFetch } from '@/utils/authedFetch';


function formatCurrency(value, locale = 'en-US', currency = 'ZAR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
  serviceCategory?: "document" | "parts";
  itemName?: string;
  quantity?: number;
  store?: { name: string; address: string };
};


export default function TripSummary() {
  const [tripData, setTripData] = useState<TripSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [shopperResultUrl, setShopperResultUrl] = useState<string>("");


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


  useEffect(() => {
    const callApi = async () => {
      if (!tripData) return;


      try {
        const response = await authedFetch("/api/prepare-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "trip",
            requestId,
          }),
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

        setCheckoutId(data.id);
        setShopperResultUrl(`/payment/status?requestId=${requestId}`);
      } catch (error: any) {
        console.error("Error calling API:", error);
        setError(error?.message || 'Error preparing payment checkout');
      }
    };


    if (tripData?.price) {
      callApi();
    }
  }, [tripData]);


  useEffect(() => {
    if (checkoutId) {
      const script = document.createElement("script");
      script.src = `https://card.peachpayments.com/v1/paymentWidgets.js?checkoutId=${checkoutId}`;
      script.async = true;
      document.body.appendChild(script);
      return () => {
        // The Peach Payments widget can mutate/move the DOM around this
        // script tag once it initializes, so it may no longer be a direct
        // child of <body> by the time this cleanup runs — removeChild would
        // throw NotFoundError in that case.
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, [checkoutId]);


  if (loading) {
    return <LoadingComponent/>
  }


  if (error) {
    return <div>Error: {error}</div>;
  }


  if (!tripData) {
    return <div>No trip data available</div>;
  }


  const formattedPrice = formatCurrency(parseFloat(tripData.price));
  const isParts = tripData.serviceCategory === "parts";


  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">
              {isParts ? "Order Summary" : "Trip Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="space-y-6">
              {isParts ? (
                <>
                  {tripData.itemName && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Item:</span>
                      </div>
                      <span>
                        {tripData.itemName}
                        {tripData.quantity ? ` × ${tripData.quantity}` : ""}
                      </span>
                    </div>
                  )}
                  {tripData.store?.name && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Store className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Store:</span>
                      </div>
                      <span>{tripData.store.name}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <User className="h-5 w-5 text-teal-600" />
                      <span className="font-semibold">Requested by:</span>
                    </div>
                    <span>{tripData.attorneyName}</span>
                  </div>
                  {tripData.firmName && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Briefcase className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Company:</span>
                      </div>
                      <span>{tripData.firmName}</span>
                    </div>
                  )}
                </>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Pickup:</span>
                </div>
                <span>{tripData.pickupLocation}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Dropoff:</span>
                </div>
                <span>{tripData.dropoffLocation}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Date:</span>
                </div>
                <span>{tripData.pickupDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Time:</span>
                </div>
                <span>{tripData.pickupTime}</span>
              </div>
              {!isParts && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-teal-600" />
                      <span className="font-semibold">Description:</span>
                    </div>
                    <span>{tripData.documentDescription}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-5 w-5 text-teal-600" />
                      <span className="font-semibold">Urgency:</span>
                    </div>
                    <span className="capitalize">{tripData.urgency}</span>
                  </div>
                  {tripData.specialInstructions && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Special Instructions:</span>
                      </div>
                      <span>{tripData.specialInstructions}</span>
                    </div>
                  )}
                </>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Estimated Distance:</span>
                </div>
                <span>{tripData.distance} km</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-teal-600" />
                  <span>Total Cost:</span>
                </div>
                <span>{formattedPrice}</span>
              </div>
            </div>
           
            {checkoutId && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Payment</h3>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <form
                    action={shopperResultUrl}
                    className="paymentWidgets"
                    data-brands="VISA MASTER AMEX"
                  ></form>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

