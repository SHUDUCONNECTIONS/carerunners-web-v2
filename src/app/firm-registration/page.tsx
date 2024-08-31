"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Mail, MapPin, Phone, Hash } from "lucide-react";
import { db, auth } from "@/utils/firebase";
import { doc, setDoc } from "firebase/firestore";

type FormData = {
  companyName: string;
  companyEmail: string;
  address: string;
  postalCode: string;
  telephone: string;
  registrationNumber: string;
};

export default function FirmRegistrationComponent() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const user = auth.currentUser;

      if (user) {
        await setDoc(doc(db, "firms", user.uid), {
          companyName: data.companyName,
          companyEmail: data.companyEmail,
          address: data.address,
          postalCode: data.postalCode,
          telephone: data.telephone,
          registrationNumber: data.registrationNumber,
          adminId: user.uid,
        });

        setIsSubmitted(true);
        setTimeout(() => {
          router.push("/dashboard"); // Redirect to a dashboard or another relevant page
        }, 2000);
      } else {
        throw new Error("User not authenticated.");
      }
    } catch (error) {
      console.error("Error during firm registration:", error);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
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
                Company registration successful! Redirecting you shortly...
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
                  className={`pl-10 ${
                    errors.companyName ? "border-red-500" : ""
                  }`}
                  {...register("companyName", {
                    required: "Company name is required",
                  })}
                />
              </div>
              {errors.companyName && (
                <p className="text-red-500 text-sm">
                  {errors.companyName.message}
                </p>
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
                  className={`pl-10 ${
                    errors.companyEmail ? "border-red-500" : ""
                  }`}
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
                <p className="text-red-500 text-sm">
                  {errors.companyEmail.message}
                </p>
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
                  {...register("address", {
                    required: "Address is required",
                  })}
                />
              </div>
              {errors.address && (
                <p className="text-red-500 text-sm">
                  {errors.address.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal-code">Postal Code</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="postal-code"
                  placeholder="Enter company's postal code"
                  className={`pl-10 ${
                    errors.postalCode ? "border-red-500" : ""
                  }`}
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
                <p className="text-red-500 text-sm">
                  {errors.postalCode.message}
                </p>
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
                  className={`pl-10 ${
                    errors.telephone ? "border-red-500" : ""
                  }`}
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
                <p className="text-red-500 text-sm">
                  {errors.telephone.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-number">Company Registration</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="registration-number"
                  placeholder="Enter company's registration number"
                  className={`pl-10 ${
                    errors.registrationNumber ? "border-red-500" : ""
                  }`}
                  {...register("registrationNumber", {
                    required: "Company registration number is required",
                    pattern: {
                      value: /^[0-9]{10,14}$/,
                      message:
                        "Please enter a valid company registration number",
                    },
                  })}
                />
              </div>
              {errors.registrationNumber && (
                <p className="text-red-500 text-sm">
                  {errors.registrationNumber.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" disabled={loading}>
              {loading ? "Registering..." : "Register Firm"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}