"use client"

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Mail, MapPin, Phone, User, Briefcase, Calendar, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { db, auth } from "@/utils/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import LoadingComponent from "@/components/loader";

type FormData = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  jobTitle: string;
  bio: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyDescription: string;
};

export default function EditableProfilePage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormData>();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const firmDoc = await getDoc(doc(db, "firms", user.uid));

          if (userDoc.exists() && firmDoc.exists()) {
            const userData = userDoc.data();
            const firmData = firmDoc.data();

            setValue("fullName", `${userData.firstName} ${userData.lastName}`);
            setValue("email", userData.email);
            setValue("phone", userData.contactNumber);
            setValue("dateOfBirth", userData.dateOfBirth || "");
            setValue("jobTitle", userData.jobTitle || "");
            setValue("bio", userData.bio || "");

            setValue("companyName", firmData.companyName);
            setValue("companyEmail", firmData.companyEmail);
            setValue("companyPhone", firmData.telephone);
            setValue("companyAddress", firmData.address);
            setValue("companyDescription", firmData.companyDescription || "");
          }
        } catch (error) {
          console.error("Error fetching user or firm data:", error);
        } finally {
          setInitialLoading(false);
        }
      } else {
        console.error("No authenticated user found.");
        setInitialLoading(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [setValue]);

  const onSubmit = async (data: FormData) => {
    setSubmitLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        // Update user information
        await updateDoc(doc(db, "users", user.uid), {
          firstName: data.fullName.split(" ")[0],
          lastName: data.fullName.split(" ").slice(1).join(" "),
          contactNumber: data.phone,
          email: data.email,
          dateOfBirth: data.dateOfBirth,
          jobTitle: data.jobTitle,
          bio: data.bio,
        });

        // Update firm information
        await updateDoc(doc(db, "firms", user.uid), {
          companyName: data.companyName,
          companyEmail: data.companyEmail,
          telephone: data.companyPhone,
          address: data.companyAddress,
          companyDescription: data.companyDescription,
        });

        setSubmitSuccess(true);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setSubmitLoading(false);
      setTimeout(() => setSubmitSuccess(false), 3000); // Reset success message after 3 seconds
    }
  };

  const InputField = ({
    icon,
    label,
    name,
    type = "text",
    required = true,
    pattern = undefined,
  }: {
    icon: React.ReactNode;
    label: string;
    name: keyof FormData;
    type?: string;
    required?: boolean;
    pattern?: {
      value: RegExp;
      message: string;
    };
  }) => (
    <div className="mb-4">
      <Label htmlFor={name} className="flex items-center space-x-2 mb-1">
        {icon}
        <span>{label}</span>
      </Label>
      <Input
        type={type}
        id={name}
        {...register(name, {
          required: required ? `${label} is required` : false,
          pattern,
        })}
        className={`w-full ${errors[name] ? "border-red-500" : ""}`}
      />
      {errors[name] && (
        <p className="text-red-500 text-sm mt-1">{errors[name]?.message}</p>
      )}
    </div>
  );

  if (authLoading || initialLoading) {
    return <div><LoadingComponent/></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-2xl font-bold">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent className="mt-6">
          {submitSuccess && (
            <Alert className="bg-green-100 border-green-500 text-green-700 mb-4">
              <AlertDescription>
                Profile updated successfully!
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="personal">Personal Details</TabsTrigger>
                <TabsTrigger value="company">Company Details</TabsTrigger>
              </TabsList>
              <TabsContent value="personal" className="mt-6">
                <InputField
                  icon={<User className="h-5 w-5 text-gray-500" />}
                  label="Full Name"
                  name="fullName"
                />
                <InputField
                  icon={<Mail className="h-5 w-5 text-gray-500" />}
                  label="Email"
                  name="email"
                  type="email"
                  pattern={{
                    value: /\S+@\S+\.\S+/,
                    message: "Please enter a valid email address",
                  }}
                />
                <InputField
                  icon={<Phone className="h-5 w-5 text-gray-500" />}
                  label="Phone"
                  name="phone"
                  type="tel"
                  pattern={{
                    value: /^[0-9]{10}$/,
                    message: "Please enter a valid 10-digit phone number",
                  }}
                />
                <InputField
                  icon={<Calendar className="h-5 w-5 text-gray-500" />}
                  label="Date of Birth"
                  name="dateOfBirth"
                  type="date"
                />
                <InputField
                  icon={<Briefcase className="h-5 w-5 text-gray-500" />}
                  label="Job Title"
                  name="jobTitle"
                />
                <div className="mb-4">
                  <Label htmlFor="bio" className="flex items-center space-x-2 mb-1">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <span>Bio</span>
                  </Label>
                  <Textarea
                    id="bio"
                    {...register("bio")}
                    className={`w-full ${errors.bio ? "border-red-500" : ""}`}
                    rows={4}
                  />
                  {errors.bio && (
                    <p className="text-red-500 text-sm mt-1">{errors.bio.message}</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="company" className="mt-6">
                <InputField
                  icon={<Building2 className="h-5 w-5 text-gray-500" />}
                  label="Company Name"
                  name="companyName"
                />
                <InputField
                  icon={<Mail className="h-5 w-5 text-gray-500" />}
                  label="Company Email"
                  name="companyEmail"
                  type="email"
                  pattern={{
                    value: /\S+@\S+\.\S+/,
                    message: "Please enter a valid email address",
                  }}
                />
                <InputField
                  icon={<Phone className="h-5 w-5 text-gray-500" />}
                  label="Company Phone"
                  name="companyPhone"
                  type="tel"
                  pattern={{
                    value: /^[0-9]{10}$/,
                    message: "Please enter a valid 10-digit phone number",
                  }}
                />
                <InputField
                  icon={<MapPin className="h-5 w-5 text-gray-500" />}
                  label="Company Address"
                  name="companyAddress"
                />
                <div className="mb-4">
                  <Label htmlFor="companyDescription" className="flex items-center space-x-2 mb-1">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <span>Company Description</span>
                  </Label>
                  <Textarea
                    id="companyDescription"
                    {...register("companyDescription")}
                    className={`w-full ${errors.companyDescription ? "border-red-500" : ""}`}
                    rows={4}
                  />
                  {errors.companyDescription && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.companyDescription.message}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            <Button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-700 text-white mt-6"
              disabled={submitLoading}
            >
              {submitLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}