// @ts-nocheck

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarIcon,
  Clock,
  MapPin,
  FileText,
  Truck,
  User,
  Briefcase,
  Phone,
} from "lucide-react";
import {
  GoogleMap,
  LoadScript,
  Autocomplete,
  Marker,
} from "@react-google-maps/api";
import { db, auth, rtdb } from "@/utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import LoadingComponent from "@/components/loader";
import { StepIndicator, StepNav } from "@/components/Stepper";

// Cache object for storing distance calculations
const distanceCache = new Map();

const mapContainerStyle = {
  width: "100%",
  height: "300px",
};

const defaultCenter = {
  lat: -26.2041,
  lng: 0.0473,
};

export default function AttorneyDocumentPickup() {
  const [pickupCoords, setPickupCoords] = useState(defaultCenter);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const [pickupAutocomplete, setPickupAutocomplete] = useState(null);
  const [dropoffAutocomplete, setDropoffAutocomplete] = useState(null);

  // Wizard state
  const steps = ["Trip Details", "Sender & Receiver", "Locations", "Schedule", "Document Info", "Terms"];
  const [currentStep, setCurrentStep] = useState(0);
  const [locationHint, setLocationHint] = useState("");

  // Function to calculate distance using Distance Matrix API
  const calculateDistance = useCallback(async (origin, destination) => {
    // Create cache key
    const cacheKey = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`;

    // Check cache first
    if (distanceCache.has(cacheKey)) {
      return distanceCache.get(cacheKey);
    }

    const service = new google.maps.DistanceMatrixService();

    try {
      const response = await service.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      });

      if (response.rows[0]?.elements[0]?.distance) {
        const distanceInKm = response.rows[0].elements[0].distance.value / 1000;
        // Cache the result
        distanceCache.set(cacheKey, distanceInKm);
        return distanceInKm;
      }
      return null;
    } catch (error) {
      console.error("Error calculating distance:", error);
      return null;
    }
  }, []);

  // Update distance when both coordinates are available
  useEffect(() => {
    const updateDistance = async () => {
      if (pickupCoords && dropoffCoords) {
        const calculatedDistance = await calculateDistance(
          pickupCoords,
          dropoffCoords
        );
        if (calculatedDistance !== null) {
          setDistance(calculatedDistance.toFixed(2));
          const calculatedPrice = calculatePrice(calculatedDistance);
          setPrice(calculatedPrice);
        }
      }
    };

    updateDistance();
  }, [pickupCoords, dropoffCoords, calculateDistance]);

  // Form setup and validation
  const defaultValues = {
    attorneyName: "",
    firmName: "",
    barNumber: "",
    pickupLocation: "",
    dropoffLocation: "",
    pickupDate: today,
    pickupTime: "",
    specialInstructions: "",
    senderName: "",
    senderNumber: "",
    receiverName: "",
    receiverNumber: "",
    documentDescription: "",
    requestType: "",
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    getValues,
    reset,
    trigger,
  } = useForm({
    defaultValues,
  });

  // Fields belonging to each wizard step, used for per-step validation
  const stepFields = [
    ["attorneyName", "firmName"],
    ["senderName", "senderNumber", "receiverName", "receiverNumber"],
    ["pickupLocation", "dropoffLocation"],
    ["pickupDate", "pickupTime"],
    ["requestType", "documentDescription", "specialInstructions"],
    ["agreeToTerms"],
  ];

  const handleNext = async () => {
    const fieldsToValidate = stepFields[currentStep];
    const valid = await trigger(fieldsToValidate);
    if (!valid) return;

    if (currentStep === 2) {
      if (!distance || !price) {
        setLocationHint("Please select a pickup and dropoff location to calculate the distance and price before continuing.");
        return;
      }
    }

    setLocationHint("");
    setCurrentStep((s) => s + 1);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const firmDoc = await getDoc(doc(db, "firms", user.uid));

          if (userDoc.exists() && firmDoc.exists()) {
            const userData = userDoc.data();
            const firmData = firmDoc.data();

            // Update form values
            reset({
              ...defaultValues,
              attorneyName: `${userData.firstName} ${userData.lastName}`,
              firmName: firmData.companyName,
              barNumber: userData.barNumber || "",
              pickupLocation: firmData.address || "",
            });
          }
        } catch (error) {
          console.error("Error fetching user or firm data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        console.error("No authenticated user found.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [reset]);

  const validateTime = (time: string, date: string) => {
    if (date === today) {
      const now = new Date();
      const [hours, minutes] = time.split(":").map(Number);
      const selectedTime = new Date();
      selectedTime.setHours(hours, minutes);

      return selectedTime > now || "Pickup time must be in the future";
    }
    return true;
  };

  const calculatePrice = (distance) => {
    const distanceInKm = parseFloat(distance);
    const basePrice = 32;
    const ratePerKm = 10;
    const price = distanceInKm <= 1 ? basePrice : basePrice + (distanceInKm - 1) * ratePerKm;
    return price.toFixed(2);
  };

  const onSubmit = async (data: FormData) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const calculatedPrice = calculatePrice(parseFloat(distance));
        setPrice(calculatedPrice);

        // Save pickup request data
        const requestId = `${user.uid}_${Date.now()}`;
        const requestData = {
          ...data,
          userId: user.uid,
          distance: distance,
          price: calculatedPrice,
          status: "pending",
          payment_status: "unpaid",
          createdAt: new Date(),
        };

        await setDoc(doc(db, "pickupRequests", requestId), requestData);
        await set(ref(rtdb, `trips/${requestId}`), {
          ...requestData,
          createdAt: Date.now(),
        });

        router.push("/trips");
      } catch (error) {
        console.error("Error saving pickup request:", error);
      }
    }
  };

  if (loading) {
    return <LoadingComponent />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 max-w-2xl">

        {/* Page header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900">Request Document Pick-up</h1>
          <p className="text-sm text-gray-500 mt-1">Fill in the details below to schedule a courier pickup.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          <StepIndicator steps={steps} currentStep={currentStep} />

          {/* ── Section: Trip Details ── */}
          {currentStep === 0 && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Trip Details
              </h2>
              <div className="h-px bg-gray-100 mb-5" />

              <div className="space-y-4">
                {/* Attorney Name */}
                <div>
                  <Label htmlFor="attorneyName" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    Attorney Name
                  </Label>
                  <Controller
                    name="attorneyName"
                    control={control}
                    rules={{ required: "Attorney Name is required" }}
                    render={({ field }) => (
                      <Input
                        id="attorneyName"
                        placeholder="Enter attorney name"
                        {...field}
                        className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.attorneyName ? "border-red-400" : ""}`}
                      />
                    )}
                  />
                  {errors.attorneyName && (
                    <p className="text-xs text-red-500 mt-1">{errors.attorneyName.message}</p>
                  )}
                </div>

                {/* Firm Name */}
                <div>
                  <Label htmlFor="firmName" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    Firm Name
                  </Label>
                  <Controller
                    name="firmName"
                    control={control}
                    rules={{ required: "Firm Name is required" }}
                    render={({ field }) => (
                      <Input
                        id="firmName"
                        placeholder="Enter firm name"
                        {...field}
                        className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.firmName ? "border-red-400" : ""}`}
                      />
                    )}
                  />
                  {errors.firmName && (
                    <p className="text-xs text-red-500 mt-1">{errors.firmName.message}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Section: Sender & Receiver ── */}
          {currentStep === 1 && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Sender &amp; Receiver
              </h2>
              <div className="h-px bg-gray-100 mb-5" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sender Name */}
                <div>
                  <Label htmlFor="senderName" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    Sender&apos;s Name
                  </Label>
                  <Controller
                    name="senderName"
                    control={control}
                    rules={{ required: "Sender's Name is required" }}
                    render={({ field }) => (
                      <Input
                        id="senderName"
                        placeholder="Enter sender's name"
                        {...field}
                        className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.senderName ? "border-red-400" : ""}`}
                      />
                    )}
                  />
                  {errors.senderName && (
                    <p className="text-xs text-red-500 mt-1">{errors.senderName.message}</p>
                  )}
                </div>

                {/* Sender Number */}
                <div>
                  <Label htmlFor="senderNumber" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    Sender&apos;s Number
                  </Label>
                  <Controller
                    name="senderNumber"
                    control={control}
                    rules={{ required: "Sender's Number is required" }}
                    render={({ field }) => (
                      <Input
                        id="senderNumber"
                        type="tel"
                        placeholder="Enter sender's phone"
                        {...field}
                        className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.senderNumber ? "border-red-400" : ""}`}
                      />
                    )}
                  />
                  {errors.senderNumber && (
                    <p className="text-xs text-red-500 mt-1">{errors.senderNumber.message}</p>
                  )}
                </div>

                {/* Receiver Name */}
                <div>
                  <Label htmlFor="receiverName" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    Receiver&apos;s Name
                  </Label>
                  <Controller
                    name="receiverName"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="receiverName"
                        placeholder="Enter receiver's name"
                        {...field}
                        className="h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500"
                      />
                    )}
                  />
                </div>

                {/* Receiver Number */}
                <div>
                  <Label htmlFor="receiverNumber" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    Receiver&apos;s Number
                  </Label>
                  <Controller
                    name="receiverNumber"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="receiverNumber"
                        type="tel"
                        placeholder="Enter receiver's phone"
                        {...field}
                        className="h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500"
                      />
                    )}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── Section: Locations (contains LoadScript + Map) ── */}
          {currentStep === 2 && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Locations
              </h2>
              <div className="h-px bg-gray-100 mb-5" />

              <LoadScript
                googleMapsApiKey="AIzaSyAuzjtvfjuDgxVfuCmpeeoOyOy53eadqcc"
                libraries={["places"]}
              >
                <div className="space-y-4">
                  {/* Pickup Location */}
                  <div>
                    <Label htmlFor="pickupLocation" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-teal-500" />
                      Pickup Location
                    </Label>
                    <Controller
                      name="pickupLocation"
                      control={control}
                      rules={{ required: "Pickup location is required" }}
                      render={({ field }) => (
                        <Autocomplete
                          onLoad={(autocomplete) => {
                            setPickupAutocomplete(autocomplete);
                            autocomplete.setComponentRestrictions({
                              country: "za",
                            });
                          }}
                          onPlaceChanged={() => {
                            if (pickupAutocomplete) {
                              const place = pickupAutocomplete.getPlace();
                              if (place.geometry) {
                                const location = {
                                  lat: place.geometry.location.lat(),
                                  lng: place.geometry.location.lng(),
                                };
                                setPickupCoords(location);
                                field.onChange(place.formatted_address);
                              }
                            }
                          }}
                        >
                          <Input
                            type="text"
                            id="pickupLocation"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder="Search pickup address…"
                            className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.pickupLocation ? "border-red-400" : ""}`}
                          />
                        </Autocomplete>
                      )}
                    />
                    {errors.pickupLocation && (
                      <p className="text-xs text-red-500 mt-1">{errors.pickupLocation.message}</p>
                    )}
                  </div>

                  {/* Dropoff Location */}
                  <div>
                    <Label htmlFor="dropoffLocation" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      Dropoff Location
                    </Label>
                    <Controller
                      name="dropoffLocation"
                      control={control}
                      rules={{ required: "Dropoff location is required" }}
                      render={({ field }) => (
                        <Autocomplete
                          onLoad={(autocomplete) => {
                            setDropoffAutocomplete(autocomplete);
                            autocomplete.setComponentRestrictions({
                              country: "za",
                            });
                          }}
                          onPlaceChanged={() => {
                            if (dropoffAutocomplete) {
                              const place = dropoffAutocomplete.getPlace();
                              if (place.geometry) {
                                const location = {
                                  lat: place.geometry.location.lat(),
                                  lng: place.geometry.location.lng(),
                                };
                                setDropoffCoords(location);
                                field.onChange(place.formatted_address);
                              }
                            }
                          }}
                        >
                          <Input
                            type="text"
                            id="dropoffLocation"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder="Search dropoff address…"
                            className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.dropoffLocation ? "border-red-400" : ""}`}
                          />
                        </Autocomplete>
                      )}
                    />
                    {errors.dropoffLocation && (
                      <p className="text-xs text-red-500 mt-1">{errors.dropoffLocation.message}</p>
                    )}
                  </div>

                  {/* Google Map */}
                  <div className="rounded-xl overflow-hidden mt-2">
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={pickupCoords || defaultCenter}
                      zoom={10}
                    >
                      {pickupCoords && <Marker position={pickupCoords} />}
                      {dropoffCoords && <Marker position={dropoffCoords} />}
                    </GoogleMap>
                  </div>

                  {/* Distance & Price result card */}
                  {distance && price && (
                    <div className="flex items-center gap-6 mt-1 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                      <div className="flex-1 text-center">
                        <p className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-0.5">Distance</p>
                        <p className="text-2xl font-bold text-teal-700">{distance} <span className="text-base font-semibold">km</span></p>
                      </div>
                      <div className="w-px h-10 bg-teal-200" />
                      <div className="flex-1 text-center">
                        <p className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-0.5">Estimated Price</p>
                        <p className="text-2xl font-bold text-teal-700">R<span>{price}</span></p>
                      </div>
                    </div>
                  )}

                  {!distance && locationHint && (
                    <p className="text-xs text-amber-600 mt-1">{locationHint}</p>
                  )}
                </div>
              </LoadScript>
            </section>
          )}

          {/* ── Section: Schedule ── */}
          {currentStep === 3 && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Schedule
              </h2>
              <div className="h-px bg-gray-100 mb-5" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pickup Date */}
                <div>
                  <Label htmlFor="pickupDate" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-gray-400" />
                    Pickup Date
                  </Label>
                  <Controller
                    name="pickupDate"
                    control={control}
                    rules={{ required: "Pickup date is required" }}
                    render={({ field }) => (
                      <Input
                        type="date"
                        id="pickupDate"
                        min={today}
                        {...field}
                        className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.pickupDate ? "border-red-400" : ""}`}
                      />
                    )}
                  />
                  {errors.pickupDate && (
                    <p className="text-xs text-red-500 mt-1">{errors.pickupDate.message}</p>
                  )}
                </div>

                {/* Pickup Time */}
                <div>
                  <Label htmlFor="pickupTime" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    Pickup Time
                  </Label>
                  <Controller
                    name="pickupTime"
                    control={control}
                    rules={{
                      required: "Pickup time is required",
                      validate: (value) =>
                        validateTime(value, getValues("pickupDate")),
                    }}
                    render={({ field }) => (
                      <Input
                        type="time"
                        id="pickupTime"
                        {...field}
                        className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.pickupTime ? "border-red-400" : ""}`}
                      />
                    )}
                  />
                  {errors.pickupTime && (
                    <p className="text-xs text-red-500 mt-1">{errors.pickupTime.message}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Section: Document Info ── */}
          {currentStep === 4 && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Document Info
              </h2>
              <div className="h-px bg-gray-100 mb-5" />

              <div className="space-y-4">
                {/* Request Type */}
                <div>
                  <Label htmlFor="requestType" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    Request Type
                  </Label>
                  <Controller
                    name="requestType"
                    control={control}
                    rules={{ required: "Request type is required" }}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 w-full">
                          <SelectValue placeholder="Select request type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="magistrate_court">Magistrate Court</SelectItem>
                          <SelectItem value="high_court">High Court</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.requestType && (
                    <p className="text-xs text-red-500 mt-1">{errors.requestType.message}</p>
                  )}
                </div>

                {/* Document Description */}
                <div>
                  <Label htmlFor="documentDescription" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    Document Description
                  </Label>
                  <Textarea
                    id="documentDescription"
                    {...register("documentDescription", {
                      required: "Document description is required",
                    })}
                    placeholder="Describe the document(s) being transported…"
                    className={`rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 resize-none ${errors.documentDescription ? "border-red-400" : ""}`}
                    rows={3}
                  />
                  {errors.documentDescription && (
                    <p className="text-xs text-red-500 mt-1">{errors.documentDescription.message}</p>
                  )}
                </div>

                {/* Special Instructions */}
                <div>
                  <Label htmlFor="specialInstructions" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-gray-400" />
                    Special Instructions
                    <span className="ml-auto text-xs font-normal text-gray-400">Optional</span>
                  </Label>
                  <Textarea
                    id="specialInstructions"
                    {...register("specialInstructions")}
                    placeholder="Any special handling or delivery notes…"
                    className="rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── Section: Terms ── */}
          {currentStep === 5 && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Terms
              </h2>
              <div className="h-px bg-gray-100 mb-5" />

              <div className="flex items-start gap-3">
                <Checkbox
                  id="agreeToTerms"
                  {...register("agreeToTerms", {
                    required: "You must agree to the terms and conditions",
                  })}
                  className="mt-0.5 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                />
                <div>
                  <Label htmlFor="agreeToTerms" className="text-sm font-medium text-gray-700 cursor-pointer">
                    I agree to the{" "}
                    <span className="text-teal-600 underline underline-offset-2">terms and conditions</span>
                  </Label>
                  {errors.agreeToTerms && (
                    <p className="text-xs text-red-500 mt-1">{errors.agreeToTerms.message}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          <StepNav
            currentStep={currentStep}
            totalSteps={steps.length}
            onBack={() => setCurrentStep((s) => s - 1)}
            onNext={handleNext}
            isLastStep={currentStep === steps.length - 1}
            submitLabel={!distance ? "Calculating distance…" : "Submit Request"}
            nextDisabled={currentStep === steps.length - 1 && (!distance || !price)}
          />

        </form>
      </main>
    </div>
  );
}
