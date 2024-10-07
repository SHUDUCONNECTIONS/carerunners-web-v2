"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, Clock, FileText, DollarSign, Truck, Briefcase, User } from "lucide-react";
import LoadingComponent from '@/components/loader';

function formatCurrency(value, locale = 'en-US', currency = 'ZAR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type DropoffLocation = {
  address: string;
  documentType: string;
  documentDescription: string;
};

type TripSummaryData = {
  attorneyName: string;
  firmName: string;
  pickupLocation: string;
  dropoffLocations: DropoffLocation[];
  pickupDate: string;
  pickupTime: string;
  urgency: string;
  specialInstructions?: string;
  distance: string;
  price: string;
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
        // Format the price to always have two decimal places
        const formattedPrice = parseFloat(tripData.price).toFixed(2);

        const response = await fetch("/api/prepare-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price: formattedPrice,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setCheckoutId(data.id);
        setShopperResultUrl(`/payment/status?requestId=${requestId}`);
      } catch (error) {
        console.error("Error calling API:", error);
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
        document.body.removeChild(script);
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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Trip Summary</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Attorney:</span>
                </div>
                <span>{tripData.attorneyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Briefcase className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Firm:</span>
                </div>
                <span>{tripData.firmName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Pickup:</span>
                </div>
                <span>{tripData.pickupLocation}</span>
              </div>
              <div className="space-y-4">
                {tripData.dropoffLocations.map((location, index) => (
                  <div key={index} className="bg-gray-200 p-4 rounded-lg text-black">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Dropoff {index + 1}:</span>
                      </div>
                      <span>{location.address}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Document Type:</span>
                      </div>
                      <span>{location.documentType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Description:</span>
                      </div>
                      <span>{location.documentDescription}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              
              
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