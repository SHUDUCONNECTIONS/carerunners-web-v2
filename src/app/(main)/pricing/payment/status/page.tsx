"use client"

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/utils/firebase';
import LoadingComponent from '@/components/loader'

const INITIAL_DELAY = 2000; // 2 seconds

export default function PaymentStatusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [paymentData, setPaymentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiCalledRef = useRef(false);

  const updateFirestore = async (status: string) => {
    const firmId = searchParams.get('firmId');
    const planName = searchParams.get('plan');
    if (!firmId || !planName) {
      console.error('No firm ID or plan name provided');
      return;
    }

    try {
      const docRef = doc(db, 'firms', firmId);
      await updateDoc(docRef, {
        planName: planName,
        paymentStatus: status,
        lastPaymentDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating Firestore document: ', error);
    }
  };

  const sendEmail = async (email: string, amount: number, date: string, brand: string, planName: string) => {
    try {
      const res = await fetch('/api/send-plan-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount, date, brand, planName })
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      await res.json();
    } catch (error) {
      console.error('Error sending plan confirmation email:', error);
    }
  };

  const checkPayment = useCallback(async (id) => {
    if (apiCalledRef.current) return;
    apiCalledRef.current = true;

    try {
      const res = await fetch(`/api/check-payment-status?id=${id}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setPaymentData(data);
      
      // Update Firestore based on payment status
      if (data.result && data.result.code.startsWith("000.")) {
        await updateFirestore('paid');

        // Get the authenticated user's email and firm details
        const user = auth.currentUser;
        if (user) {
          const firmId = searchParams.get('firmId');
          const firmDoc = await getDoc(doc(db, 'firms', firmId));
          const firmData = firmDoc.data();
          await sendEmail(user.email, data.amount, data.timestamp, data.paymentBrand, firmData.planName);
        }
      } else if (data.result && (data.result.code.startsWith("100.") || data.result.code.startsWith("200."))) {
        await updateFirestore('pending');
      } else {
        await updateFirestore('failed');
      }
    } catch (error) {
      console.error('Error fetching payment status:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const paymentId = searchParams.get('id');
    if (paymentId && !apiCalledRef.current) {
      const timer = setTimeout(() => checkPayment(paymentId), INITIAL_DELAY);
      return () => {
        clearTimeout(timer);
        apiCalledRef.current = false;
      };
    }
  }, [searchParams, checkPayment]);

  const getStatusContent = (resultCode) => {
    if (resultCode.startsWith("000.")) {
      return {
        icon: <CheckCircle className="h-16 w-16 text-green-500" />,
        title: "Payment Successful",
        description: "Your plan payment has been processed successfully.",
        buttonText: "Go to Dashboard",
        buttonVariant: "default",
        onButtonClick: () => router.push('/dashboard'),
      };
    } else if (resultCode.startsWith("100.") || resultCode.startsWith("200.")) {
      return {
        icon: <Clock className="h-16 w-16 text-yellow-500" />,
        title: "Payment Pending",
        description: "Your plan payment is being processed. This may take a few moments.",
        buttonText: "Check Status",
        buttonVariant: "outline",
      };
    } else {
      return {
        icon: <XCircle className="h-16 w-16 text-red-500" />,
        title: "Payment Failed",
        description: "We're sorry, but your plan payment could not be processed.",
        buttonText: "Try Again",
        buttonVariant: "destructive",
      };
    }
  };

  const statusContent = paymentData && paymentData.result && paymentData.result.code
    ? getStatusContent(paymentData.result.code)
    : {
        icon: <AlertTriangle className="h-16 w-16 text-yellow-500" />,
        title: "Unknown Status",
        description: "We're unable to determine the status of your plan payment.",
        buttonText: "Contact Support",
        buttonVariant: "outline",
      };

  const formatAmount = (amount, currency) => {
    if (!amount || !currency) return "N/A";
    return `${currency} ${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) return <LoadingComponent/>
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold text-center">Plan Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="flex flex-col items-center space-y-4">
              {statusContent.icon}
              <h2 className="text-2xl font-semibold text-gray-800">{statusContent.title}</h2>
              <p className="text-center text-gray-600">{statusContent.description}</p>
            </div>
            
            <div className="mt-8 space-y-4">
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Plan:</span>
                <span className="text-gray-800">{searchParams.get('plan') || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Amount:</span>
                <span className="text-gray-800">{formatAmount(paymentData?.amount, paymentData?.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Date:</span>
                <span className="text-gray-800">{formatDate(paymentData?.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Payment Method:</span>
                <span className="text-gray-800">{paymentData?.paymentBrand || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Card:</span>
                <span className="text-gray-800">
                  {paymentData?.card?.last4Digits 
                    ? `**** **** **** ${paymentData.card.last4Digits}` 
                    : "N/A"}
                </span>
              </div>
            </div>
            
            <div className="mt-8">
              <Button
                className="w-full"
                variant={statusContent.buttonVariant}
                onClick={statusContent.onButtonClick}
              >
                {statusContent.buttonText}
              </Button>
            </div>
            
            {statusContent.title === "Payment Failed" && (
              <div className="mt-4 text-center">
                <Button variant="link" className="text-teal-600">
                  Contact Support
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}