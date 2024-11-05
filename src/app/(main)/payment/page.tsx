'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MapPin, Calendar, Clock, FileText, DollarSign, Truck, Briefcase, User } from 'lucide-react';
import LoadingComponent from '@/components/loader';

interface DropoffLocation {
  address: string;
  documentType: string;
  documentDescription: string;
}

interface TripSummaryData {
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
}

const PaymentPage: React.FC = () => {
  const [tripData, setTripData] = useState<TripSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [shopperResultUrl, setShopperResultUrl] = useState<string>('');

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
          const data = docSnap.data() as TripSummaryData;
          // Ensure dropoffLocations exists and is an array
          setTripData({
            ...data,
            dropoffLocations: Array.isArray(data.dropoffLocations) ? data.dropoffLocations : []
          });
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
      if (!tripData?.price) return;

      try {
        const formattedPrice = parseFloat(tripData.price).toFixed(2);

        const response = await fetch('/api/prepare-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
        console.error('Error calling API:', error);
        setError('Failed to initialize payment. Please try again.');
      }
    };

    callApi();
  }, [tripData, requestId]);

  useEffect(() => {
    if (checkoutId) {
      const script = document.createElement('script');
      script.src = `https://card.peachpayments.com/v1/paymentWidgets.js?checkoutId=${checkoutId}`;
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [checkoutId]);

  if (loading) {
    return <LoadingComponent />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tripData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
              <p>Trip information could not be loaded.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formattedPrice = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(parseFloat(tripData.price || '0'));

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
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Pickup:</span>
                </div>
                <span>{tripData.pickupLocation}</span>
              </div>
              <div className="space-y-4">
                {(tripData.dropoffLocations || []).map((location, index) => (
                  <div key={index} className="bg-gray-200 p-4 rounded-lg text-black">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Dropoff {index + 1}:</span>
                      </div>
                      <span>{location.address}</span>
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
};

export default PaymentPage;