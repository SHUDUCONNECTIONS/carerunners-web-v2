// @ts-nocheck




"use client";


import React, { useState, useEffect } from "react";
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
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  FileText,
  Truck,
  User,
  Briefcase,
  Scale,
} from "lucide-react";
import {
  GoogleMap,
  LoadScript,
  Autocomplete,
  Marker,
  DirectionsService,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { db, auth } from "@/utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import LoadingComponent from "@/components/loader";


type FormData = {
  attorneyName: string;
  firmName: string;
  barNumber: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  documentType: string;
  documentDescription: string;
  urgency: string;
  specialInstructions: string;
  agreeToTerms: boolean;
};


const mapContainerStyle = {
  width: "100%",
  height: "300px",
};


const defaultCenter = {
  lat: -26.2041, // Johannesburg Latitude
  lng: 28.0473, // Johannesburg Longitude
};


// Assuming this is stored in an environment variable
const PRICE_PER_KM = 28;


export default function AttorneyDocumentPickup() {
  const [pickupCoords, setPickupCoords] = useState(defaultCenter);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [directions, setDirections] = useState(null);
  const [distance, setDistance] = useState(null);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();


  const {
    register,
    handleSubmit,
    control,
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


            setValue(
              "attorneyName",
              `${userData.firstName} ${userData.lastName}`
            );
            setValue("firmName", firmData.companyName);
            setValue("barNumber", userData.barNumber || "");
            setValue("pickupLocation", firmData.address || "");
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
  }, [setValue]);


  const calculatePrice = (distance, urgency) => {
    let price;
    if (urgency === "urgent") {
      if (distance <= 2) {
        price = 60;
      } else {
        price = 60 + (distance - 2) * 7.5;
      }
    } else {
      if (distance <= 2) {
        price = 28;
      } else {
        price = 28 + (distance - 2) * 6;
      }
    }
    return price.toFixed(2);
  };


 
  const onSubmit = async (data: FormData) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const calculatedPrice = calculatePrice(parseFloat(distance), data.urgency);
        setPrice(calculatedPrice);


        // Save pickup request data
        const pickupRequestRef = doc(
          db,
          "pickupRequests",
          `${user.uid}_${Date.now()}`
        );
        await setDoc(pickupRequestRef, {
          ...data,
          userId: user.uid,
          distance: distance,
          price: calculatedPrice,
          status: "pending",
          createdAt: new Date(),
        });


        // Redirect to payment page
        router.push(
          `/payment?requestId=${pickupRequestRef.id}&amount=${calculatedPrice}`
        );
      } catch (error) {
        console.error("Error saving pickup request:", error);
      }
    }
  };
  const handleDirectionsResponse = (response) => {
    if (response.status === "OK") {
      setDirections(response);
      const route = response.routes[0];
      const distanceInKm = route.legs[0].distance.value / 1000;
      setDistance(distanceInKm.toFixed(2));
      setPrice((distanceInKm * PRICE_PER_KM).toFixed(2));
    } else {
      console.error(`Error fetching directions ${response}`);
    }
  };


  const InputField = ({
    icon,
    label,
    name,
    type = "text",
    required = true,
    pattern = undefined,
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
        <p className="text-red-500 text-sm mt-1">{errors[name].message}</p>
      )}
    </div>
  );


  if (loading) {
    return <LoadingComponent/>
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
              />
              <InputField
                icon={<Briefcase className="h-5 w-5 text-gray-500" />}
                label="Firm Name"
                name="firmName"
               
              />


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
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      autocomplete.setComponentRestrictions({ country: "za" });
                      autocomplete.addListener("place_changed", () => {
                        const place = autocomplete.getPlace();
                        if (place.geometry) {
                          const location = {
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                          };
                          setPickupCoords(location);
                        }
                      });
                    }}
                  >
                    <Input
                      type="text"
                      id="pickupLocation"
                      {...register("pickupLocation", {
                        required: "Pickup location is required",
                      })}
                      className={`w-full ${
                        errors.pickupLocation ? "border-red-500" : ""
                      }`}
                    />
                  </Autocomplete>
                  {errors.pickupLocation && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.pickupLocation.message}
                    </p>
                  )}
                </div>


                <div className="mb-4">
                  <Label
                    htmlFor="dropoffLocation"
                    className="flex items-center space-x-2 mb-1"
                  >
                    <MapPin className="h-5 w-5 text-gray-500" />
                    <span>Dropoff Location</span>
                  </Label>
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      autocomplete.setComponentRestrictions({ country: "za" });
                      autocomplete.addListener("place_changed", () => {
                        const place = autocomplete.getPlace();
                        if (place.geometry) {
                          const location = {
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                          };
                          setDropoffCoords(location);
                        }
                      });
                    }}
                  >
                    <Input
                      type="text"
                      id="dropoffLocation"
                      {...register("dropoffLocation", {
                        required: "Dropoff location is required",
                      })}
                      className={`w-full ${
                        errors.dropoffLocation ? "border-red-500" : ""
                      }`}
                    />
                  </Autocomplete>
                  {errors.dropoffLocation && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.dropoffLocation.message}
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


                  {pickupCoords && dropoffCoords && (
                    <DirectionsService
                      options={{
                        origin: pickupCoords,
                        destination: dropoffCoords,
                        travelMode: "DRIVING",
                      }}
                      callback={handleDirectionsResponse}
                    />
                  )}


                  {directions && <DirectionsRenderer directions={directions} />}
                </GoogleMap>
              </LoadScript>


              {distance && price && (
                <div className="mt-4 p-4 bg-blue-100 rounded-md">
                  <p>Estimated Distance: {distance} km</p>
                  <p>Estimated Price: R{price}</p>
                </div>
              )}


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  icon={<CalendarIcon className="h-5 w-5 text-gray-500" />}
                  label="Pickup Date"
                  name="pickupDate"
                  type="date"
                />


              </div>
              <InputField
                  icon={<Clock className="h-5 w-5 text-gray-500" />}
                  label="Pickup Time"
                  name="pickupTime"
                  type="time"
                />


              <div className="mb-4">
                <Label
                  htmlFor="documentType"
                  className="flex items-center space-x-2 mb-1"
                >
                  <FileText className="h-5 w-5 text-gray-500" />
                  <span>Document Type</span>
                </Label>
                <Controller
                  name="documentType"
                  control={control}
                  rules={{ required: "Document type is required" }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legal_brief">Legal Brief</SelectItem>
                        <SelectItem value="court_filing">
                          Court Filing
                        </SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="evidence">Evidence</SelectItem>
                        <SelectItem value="affidavit">Affidavit</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.documentType && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.documentType.message}
                  </p>
                )}
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
                  htmlFor="urgency"
                  className="flex items-center space-x-2 mb-1"
                >
                  <Clock className="h-5 w-5 text-gray-500" />
                  <span>Urgency</span>
                </Label>
                <Controller
                  name="urgency"
                  control={control}
                  rules={{ required: "Urgency level is required" }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select urgency level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="same_day">Same Day</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.urgency && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.urgency.message}
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





