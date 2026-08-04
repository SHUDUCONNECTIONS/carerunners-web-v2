"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
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
  ArrowRight,
} from "lucide-react";
import {
  GoogleMap,
  Autocomplete,
  Marker,
} from "@react-google-maps/api";
import { db, auth, rtdb } from "@/utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import LoadingComponent from "@/components/loader";
import { StepIndicator, StepNav } from "@/components/Stepper";
import PartsRequestFlow from "./PartsRequestFlow";
import { useServiceBrand } from "@/components/ServiceBrandProvider";
import { useGoogleMapsLoader } from "@/components/GoogleMapsLoaderProvider";

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
  const searchParams = useSearchParams();
  // Lets promo links (e.g. the dashboard's Auto Parts Delivery banner) jump
  // straight into that flow instead of stopping at the category picker.
  const [serviceCategory, setServiceCategory] = useState<"document" | "parts" | null>(
    searchParams.get("service") === "parts" ? "parts" : null
  );
  const { setBrand } = useServiceBrand();
  const { isLoaded: mapsReady } = useGoogleMapsLoader();

  // Reskins the whole app (sidebar, footer, etc. — see ServiceBrandProvider)
  // to PartRunner's red while the customer is in the Auto Parts flow. Resets
  // to Carerunners teal on category change AND on unmount, so navigating
  // away from /request entirely (dashboard, trips, etc.) never leaves the
  // rest of the app stuck in PartRunner branding.
  useEffect(() => {
    setBrand(serviceCategory === "parts" ? "partrunner" : "carerunners");
    return () => setBrand("carerunners");
  }, [serviceCategory, setBrand]);

  const [pickupCoords, setPickupCoords] = useState(defaultCenter);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const [pickupAutocomplete, setPickupAutocomplete] = useState(null);
  const [dropoffAutocomplete, setDropoffAutocomplete] = useState(null);
  // Individuals pay upfront before a trip is scheduled (no unpaid-balance
  // deferral); firm accounts keep the existing pay-after-completion flow.
  const [isIndividual, setIsIndividual] = useState(false);

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
    agreeToTerms: false,
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
  const stepFields: (keyof typeof defaultValues)[][] = [
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
          // Resolve via users/{uid}.firmId, not firms/{uid} — firm docs get
          // an auto-generated id at signup, never the admin's own uid.
          const firmId = userDoc.exists() ? userDoc.data().firmId : null;
          const firmDoc = firmId ? await getDoc(doc(db, "firms", firmId)) : null;

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const firmData = firmDoc?.exists() ? firmDoc.data() : null;
            setIsIndividual(userData.accountType === "individual");

            // Update form values — company/firm name and address only
            // prefill when there's real company data (firm accounts);
            // individuals just get their own name filled in.
            reset({
              ...defaultValues,
              attorneyName: `${userData.firstName} ${userData.lastName}`,
              firmName: firmData?.companyName || "",
              barNumber: userData.barNumber || "",
              pickupLocation: firmData?.address || "",
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

  const onSubmit = async (data: typeof defaultValues) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const calculatedPrice = calculatePrice(parseFloat(distance));
        setPrice(calculatedPrice);

        // Save pickup request data. Individuals aren't driver-visible
        // ("pending") until they've paid — check-payment-status flips this
        // to "pending" once the upfront payment clears. Firm accounts keep
        // the existing behavior: visible immediately, billed later.
        const requestId = `${user.uid}_${Date.now()}`;
        const requestData = {
          ...data,
          userId: user.uid,
          distance: distance,
          price: calculatedPrice,
          status: isIndividual ? "awaiting-payment" : "pending",
          payment_status: "unpaid",
          createdAt: new Date(),
        };

        await setDoc(doc(db, "pickupRequests", requestId), requestData);
        await set(ref(rtdb, `trips/${requestId}`), {
          ...requestData,
          createdAt: Date.now(),
        });

        router.push(isIndividual ? `/payment?requestId=${requestId}` : "/trips");
      } catch (error) {
        console.error("Error saving pickup request:", error);
      }
    }
  };

  if (loading) {
    return <LoadingComponent />;
  }

  // ── Category picker — the "what do you need?" screen, same relationship
  // Auto Parts Delivery has to Legal Document Pickup that Pick n Pay has to
  // Uber Eats: one platform, one login, pick a service and go. ──
  if (!serviceCategory) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900">What do you need picked up?</h1>
            <p className="text-sm text-gray-500 mt-1">Choose a service to get started.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => setServiceCategory("document")}
              className="text-left h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-md hover:border-teal-100 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/carerunnerlogo.png" alt="Carerunners" className="h-8 w-8 object-contain" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">Legal Document Pickup</p>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                  Schedule a courier pickup for legal or important documents — between offices, courts, and individuals.
                </p>
              </div>
              <span className="text-sm font-semibold text-teal-600 flex items-center gap-1">
                Get started <ArrowRight className="h-4 w-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setServiceCategory("parts")}
              className="text-left h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-md hover:border-teal-100 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/partrunnerlogo.png" alt="PartRunner" className="h-8 w-8 object-contain" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">Auto Parts Delivery</p>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                  Need a car or truck part? We&apos;ll find it at a nearby store and deliver it to you.
                </p>
              </div>
              <span className="text-sm font-semibold text-teal-600 flex items-center gap-1">
                Get started <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (serviceCategory === "parts") {
    return <PartsRequestFlow onBack={() => setServiceCategory(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 max-w-2xl">

        {/* Page header */}
        <button
          type="button"
          onClick={() => setServiceCategory(null)}
          className="text-sm font-medium text-gray-500 hover:text-teal-700 mb-3"
        >
          ← Change service
        </button>
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
                {/* Requester Name */}
                <div>
                  <Label htmlFor="attorneyName" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    Your Name
                  </Label>
                  <Controller
                    name="attorneyName"
                    control={control}
                    rules={{ required: "Your name is required" }}
                    render={({ field }) => (
                      <Input
                        id="attorneyName"
                        placeholder="Enter your name"
                        {...field}
                        className={`h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500 ${errors.attorneyName ? "border-red-400" : ""}`}
                      />
                    )}
                  />
                  {errors.attorneyName && (
                    <p className="text-xs text-red-500 mt-1">{errors.attorneyName.message}</p>
                  )}
                </div>

                {/* Company / Firm (optional — individuals can leave this blank) */}
                <div>
                  <Label htmlFor="firmName" className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    Company / Firm
                    <span className="ml-auto text-xs font-normal text-gray-400">Optional</span>
                  </Label>
                  <Controller
                    name="firmName"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="firmName"
                        placeholder="If applicable"
                        {...field}
                        className="h-11 rounded-xl border-gray-200 focus:ring-teal-500 focus:border-teal-500"
                      />
                    )}
                  />
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

          {/* ── Section: Locations (Autocomplete + Map — script loaded once via GoogleMapsLoaderProvider) ── */}
          {currentStep === 2 && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Locations
              </h2>
              <div className="h-px bg-gray-100 mb-5" />

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
                      render={({ field }) =>
                        mapsReady ? (
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
                        ) : (
                          <Input
                            type="text"
                            id="pickupLocation"
                            value={field.value}
                            disabled
                            placeholder="Loading maps…"
                            className="h-11 rounded-xl border-gray-200"
                          />
                        )
                      }
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
                      render={({ field }) =>
                        mapsReady ? (
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
                        ) : (
                          <Input
                            type="text"
                            id="dropoffLocation"
                            value={field.value}
                            disabled
                            placeholder="Loading maps…"
                            className="h-11 rounded-xl border-gray-200"
                          />
                        )
                      }
                    />
                    {errors.dropoffLocation && (
                      <p className="text-xs text-red-500 mt-1">{errors.dropoffLocation.message}</p>
                    )}
                  </div>

                  {/* Google Map */}
                  {mapsReady && (
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
                  )}

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
                <Controller
                  name="agreeToTerms"
                  control={control}
                  rules={{ required: "You must agree to the terms and conditions" }}
                  render={({ field }) => (
                    <Checkbox
                      id="agreeToTerms"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                    />
                  )}
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
