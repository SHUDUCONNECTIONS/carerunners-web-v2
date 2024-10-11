"use client";

import { Suspense, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Mail, MapPin, Phone, Hash } from "lucide-react";
import { db } from "@/utils/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import LoadingComponent from "@/components/loader";  // Custom loading component

type FormData = {
  companyName: string;
  companyEmail: string;
  address: string;
  postalCode: string;
  telephone: string;
  registrationNumber: string;
};

function FirmRegistrationContent() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const firmId = searchParams.get("firmId");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormData>();

  useEffect(() => {
    const fetchFirmData = async () => {
      if (firmId) {
        const firmDoc = await getDoc(doc(db, "firms", firmId));
        if (firmDoc.exists()) {
          const data = firmDoc.data();
          setValue("companyName", data.companyName || "");
          setValue("companyEmail", data.companyEmail || "");
          setValue("address", data.address || "");
          setValue("postalCode", data.postalCode || "");
          setValue("telephone", data.telephone || "");
          setValue("registrationNumber", data.registrationNumber || "");
        }
      }
    };
    fetchFirmData();
  }, [firmId, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!firmId) {
      console.error("No firmId provided");
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, "firms", firmId), {
        ...data,
        updatedAt: new Date(),
      });

      setIsSubmitted(true);
      setTimeout(() => {
        router.push(`/auth/login`);
        // router.push(`/pricing?firmId=${firmId}`)[This will direct the user to the payment page];
      }, 2000);
    } catch (error) {
      console.error("Error during firm registration:", error);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Suspense fallback={<LoadingComponent />}>
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-2xl font-bold text-center">Firm Registration</CardTitle>
        </CardHeader>
        <div className="mx-auto w-32 h-32">
          <img
            src="/carerunnerlogo.png"
            alt="Care Runners Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <CardContent className="space-y-4">
          {isSubmitted && (
            <Alert className="bg-green-100 border-green-500 text-green-700">
              <AlertDescription>
                Company registration successful! Redirecting you to Login...
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="company-name"
                  placeholder="Enter your company name"
                  className={`pl-10 ${errors.companyName ? "border-red-500" : ""}`}
                  {...register("companyName", { required: "Company name is required" })}
                />
              </div>
              {errors.companyName && (
                <p className="text-red-500 text-sm">{errors.companyName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-email">Company Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="company-email"
                  type="email"
                  placeholder="Enter company's email address"
                  className={`pl-10 ${errors.companyEmail ? "border-red-500" : ""}`}
                  {...register("companyEmail", {
                    required: "Company email is required",
                    pattern: {
                      value: /\S+@\S+\.\S+/,
                      message: "Please enter a valid email address",
                    },
                  })}
                />
              </div>
              {errors.companyEmail && (
                <p className="text-red-500 text-sm">{errors.companyEmail.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  placeholder="Enter company's physical address"
                  className={`pl-10 ${errors.address ? "border-red-500" : ""}`}
                  {...register("address", { required: "Address is required" })}
                />
              </div>
              {errors.address && (
                <p className="text-red-500 text-sm">{errors.address.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal-code">Postal Code</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="postal-code"
                  placeholder="Enter company's postal code"
                  className={`pl-10 ${errors.postalCode ? "border-red-500" : ""}`}
                  {...register("postalCode", {
                    required: "Postal code is required",
                    pattern: {
                      value: /^[0-9]{4,5}$/,
                      message: "Please enter a valid postal code",
                    },
                  })}
                />
              </div>
              {errors.postalCode && (
                <p className="text-red-500 text-sm">{errors.postalCode.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone">Telephone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="telephone"
                  type="tel"
                  placeholder="Enter company's telephone number"
                  className={`pl-10 ${errors.telephone ? "border-red-500" : ""}`}
                  {...register("telephone", {
                    required: "Telephone number is required",
                    pattern: {
                      value: /^[0-9]{10}$/,
                      message: "Please enter a valid 10-digit telephone number",
                    },
                  })}
                />
              </div>
              {errors.telephone && (
                <p className="text-red-500 text-sm">{errors.telephone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration-number">Company Registration Number</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="registration-number"
                  placeholder="Enter company's registration number"
                  className={`pl-10 ${errors.registrationNumber ? "border-red-500" : ""}`}
                  {...register("registrationNumber", {
                    required: "Company registration number is required",
                    pattern: {
                      value: /^[0-9]{10,14}$/,
                      message: "Please enter a valid company registration number",
                    },
                  })}
                />
              </div>
              {errors.registrationNumber && (
                <p className="text-red-500 text-sm">{errors.registrationNumber.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-700 text-white" 
              disabled={loading}
            >
              {loading ? "Registering..." : "Complete Registration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </Suspense>
  );
}
export default function FirmRegistrationComponent() {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <FirmRegistrationContent />
    </Suspense>
  )
}