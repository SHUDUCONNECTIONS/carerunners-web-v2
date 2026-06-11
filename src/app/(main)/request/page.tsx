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
  } = useForm({
    defaultValues,
  });

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

        // Write to Firestore (web portal)
        await setDoc(doc(db, "pickupRequests", requestId), requestData);

        // Write to Realtime Database (driver mobile app)
        await set(ref(rtdb, `requests/${requestId}`), {
          ...requestData,
          createdAt: Date.now(),
        });

        router.push("/trips");
      } catch (error) {
        console.error("Error saving pickup request:", error);
      }
    }
  };
  const InputField = ({
    icon,
    label,
    name,
    type = "text",
    required = true,
    pattern = undefined,
    placeholder = "",
  }) => (
    <div className="mb-4">
      <Label htmlFor={name} className="flex items-center space-x-2 mb-1">
        {icon}
        <span>{label}</span>
      </Label>
      <Controller
        name={name}
        control={control}
        rules={{
          required: required ? `${label} is required` : false,
          pattern,
        }}
        render={({ field }) => (
          <Input
            type={type}
            id={name}
            placeholder={placeholder}
            {...field}
            className={`w-full ${errors[name] ? "border-red-500" : ""}`}
          />
        )}
      />
      {errors[name] && (
        <p className="text-red-500 text-sm mt-1">{errors[name].message}</p>
      )}
    </div>
  );

  if (loading) {
    return <LoadingComponent />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">
              Request Document Pick-up
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <InputField
                icon={<User className="h-5 w-5 text-gray-500" />}
                label="Attorney Name"
                name="attorneyName"
                placeholder="Enter attorney name"
              />
              <InputField
                icon={<Briefcase className="h-5 w-5 text-gray-500" />}
                label="Firm Name"
                name="firmName"
                placeholder="Enter firm name"
              />

              <>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <InputField
                      icon={<User className="h-5 w-5 text-gray-500" />}
                      label="Sender's Name"
                      name="senderName"
                      placeholder="Enter sender's name"
                      required={true}
                    />
                  </div>
                  <div className="flex-1">
                    <InputField
                      icon={<Phone className="h-5 w-5 text-gray-500" />}
                      label="Sender's Number"
                      name="senderNumber"
                      placeholder="Enter sender's phone number"
                      required={true}
                      type="tel"
                    />
                  </div>
                </div>
                <div className="flex space-x-4 mt-4">
                  <div className="flex-1">
                    <InputField
                      icon={<User className="h-5 w-5 text-gray-500" />}
                      label="Receiver's Name"
                      name="receiverName"
                      placeholder="Enter receiver's name"
                      required={false}
                    />
                  </div>
                  <div className="flex-1">
                    <InputField
                      icon={<Phone className="h-5 w-5 text-gray-500" />}
                      label="Receiver's Number"
                      name="receiverNumber"
                      placeholder="Enter receiver's phone number"
                      type="tel"
                      required={false}
                    />
                  </div>
                </div>
              </>

              <LoadScript
                googleMapsApiKey="AIzaSyAuzjtvfjuDgxVfuCmpeeoOyOy53eadqcc"
                libraries={["places"]}
              >
                <div className="mb-4">
                  <Label
                    htmlFor="pickupLocation"
                    className="flex items-center space-x-2 mb-1"
                  >
                    <MapPin className="h-5 w-5 text-gray-500" />
                    <span>Pickup Location</span>
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
                          className={`w-full ${
                            errors.pickupLocation ? "border-red-500" : ""
                          }`}
                        />
                      </Autocomplete>
                    )}
                  />
                </div>

                <div className="mb-4">
                  <Label
                    htmlFor="dropoffLocation"
                    className="flex items-center space-x-2 mb-1"
                  >
                    <MapPin className="h-5 w-5 text-gray-500" />
                    <span>Dropoff Location</span>
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
                          className={`w-full ${
                            errors.dropoffLocation ? "border-red-500" : ""
                          }`}
                        />
                      </Autocomplete>
                    )}
                  />
                </div>
                <div className="mb-4">
                  <Label
                    htmlFor="requestType"
                    className="flex items-center space-x-2 mb-1"
                  >
                    <FileText className="h-5 w-5 text-gray-500" />
                    <span>Request Type</span>
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
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select request type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="magistrate_court">
                            Magistrate Court
                          </SelectItem>
                          <SelectItem value="high_court">High Court</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.requestType && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.requestType.message}
                    </p>
                  )}
                </div>

                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={pickupCoords || defaultCenter}
                  zoom={10}
                >
                  {pickupCoords && <Marker position={pickupCoords} />}
                  {dropoffCoords && <Marker position={dropoffCoords} />}
                </GoogleMap>
              </LoadScript>

              {distance && price && (
                <div className="mt-4 p-4 bg-blue-100 rounded-md">
                  <p>Estimated Distance: {distance} km</p>
                  <p>Estimated Price: R{price}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <Label
                    htmlFor="pickupDate"
                    className="flex items-center space-x-2 mb-1"
                  >
                    <CalendarIcon className="h-5 w-5 text-gray-500" />
                    <span>Pickup Date</span>
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
                        className={`w-full ${
                          errors.pickupDate ? "border-red-500" : ""
                        }`}
                      />
                    )}
                  />
                  {errors.pickupDate && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.pickupDate.message}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <Label
                    htmlFor="pickupTime"
                    className="flex items-center space-x-2 mb-1"
                  >
                    <Clock className="h-5 w-5 text-gray-500" />
                    <span>Pickup Time</span>
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
                        className={`w-full ${
                          errors.pickupTime ? "border-red-500" : ""
                        }`}
                      />
                    )}
                  />
                  {errors.pickupTime && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.pickupTime.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <Label
                  htmlFor="documentDescription"
                  className="flex items-center space-x-2 mb-1"
                >
                  <FileText className="h-5 w-5 text-gray-500" />
                  <span>Document Description</span>
                </Label>
                <Textarea
                  id="documentDescription"
                  {...register("documentDescription", {
                    required: "Document description is required",
                  })}
                  className={`w-full ${
                    errors.documentDescription ? "border-red-500" : ""
                  }`}
                  rows={3}
                />
                {errors.documentDescription && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.documentDescription.message}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <Label
                  htmlFor="specialInstructions"
                  className="flex items-center space-x-2 mb-1"
                >
                  <Truck className="h-5 w-5 text-gray-500" />
                  <span>Special Instructions</span>
                </Label>
                <Textarea
                  id="specialInstructions"
                  {...register("specialInstructions")}
                  className="w-full"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="agreeToTerms"
                  {...register("agreeToTerms", {
                    required: "You must agree to the terms and conditions",
                  })}
                />
                <Label htmlFor="agreeToTerms">
                  I agree to the terms and conditions
                </Label>
              </div>
              {errors.agreeToTerms && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.agreeToTerms.message}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
