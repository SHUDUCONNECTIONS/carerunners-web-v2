"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Building2, User, DollarSign, Calendar, CheckCircle } from "lucide-react";
import LoadingComponent from '@/components/loader';

function formatCurrency(value: number, locale = 'en-US', currency = 'ZAR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type PlanSummaryData = {
  companyName: string;
  adminName: string;
  planName: string;
  planPrice: number;
  planFeatures: string[];
  billingCycle: string;
};

export default function PlanPaymentSummary() {
  const [planData, setPlanData] = useState<PlanSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [shopperResultUrl, setShopperResultUrl] = useState<string>("");

  const searchParams = useSearchParams();
  const firmId = searchParams.get('firmId');
  const planName = searchParams.get('plan');
  const planPrice = searchParams.get('price');

  useEffect(() => {
    const fetchFirmData = async () => {
      if (!firmId || !planName || !planPrice) {
        setError('Missing required parameters');
        setLoading(false);
        return;
      }

      try {
        const firmDocRef = doc(db, 'firms', firmId);
        const firmDocSnap = await getDoc(firmDocRef);

        if (firmDocSnap.exists()) {
          const firmData = firmDocSnap.data();
          
          // Check if companyName exists, otherwise use a placeholder
          const companyName = firmData.companyName || 'Company Name Not Available';
          
          // Check for adminId and fetch admin details if available
          let adminName = 'Admin Name Not Available';
          if (firmData.adminId) {
            const adminDocRef = doc(db, 'users', firmData.adminId);
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) {
              const adminData = adminDocSnap.data();
              adminName = `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim() || adminName;
            }
          }

          setPlanData({
            companyName,
            adminName,
            planName: planName,
            planPrice: parseFloat(planPrice),
            planFeatures: getPlanFeatures(planName),
            billingCycle: 'Monthly', // Assuming monthly by default
          });
        } else {
          setError('Firm not found');
        }
      } catch (err) {
        setError('Error fetching data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirmData();
  }, [firmId, planName, planPrice]);

  // Helper function to get plan features based on plan name
  const getPlanFeatures = (plan: string): string[] => {
    switch (plan.toLowerCase()) {
      case 'bronze':
        return ["Basic features", "Email support", "1 user"];
      case 'silver':
        return ["All Bronze features", "Priority support", "5 users", "Advanced analytics"];
      case 'gold':
        return ["All Silver features", "24/7 phone support", "10 users", "Custom integrations"];
      case 'platinum':
        return ["All Gold features", "Dedicated account manager", "Unlimited users", "Advanced security"];
      case 'palladium':
        return ["All Platinum features", "On-site training", "Custom development", "Executive dashboard"];
      default:
        return ["Features not available"];
    }
  };

  useEffect(() => {
    const callApi = async () => {
      if (!planData) return;

      try {
        const response = await fetch("/api/prepare-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price: planData.planPrice.toFixed(2),
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setCheckoutId(data.id);
        setShopperResultUrl(`/pricing/payment/status?firmId=${firmId}&plan=${planName}`);
      } catch (error) {
        console.error("Error calling API:", error);
        setError('Error preparing payment checkout');
      }
    };

    if (planData?.planPrice) {
      callApi();
    }
  }, [planData, firmId, planName]);

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
    return <LoadingComponent />;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!planData) {
    return <div>No plan data available</div>;
  }

  const formattedPrice = formatCurrency(planData.planPrice);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Plan Summary</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Company:</span>
                </div>
                <span>{planData.companyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Admin:</span>
                </div>
                <span>{planData.adminName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Selected Plan:</span>
                </div>
                <span>{planData.planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-teal-600" />
                  <span className="font-semibold">Billing Cycle:</span>
                </div>
                <span>{planData.billingCycle}</span>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Plan Features:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {planData.planFeatures.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
              <Separator />
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