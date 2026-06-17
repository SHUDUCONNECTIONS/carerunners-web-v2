"use client";

import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, rtdb } from "@/utils/firebase";
import { ref, onValue, off } from "firebase/database";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Banknote,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  User,
  Car,
  FileText,
  Phone,
  CreditCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import LoadingComponent from "@/components/loader";
import Image from "next/image";

// Updated interfaces
interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string;
  phone: String;
  profilePicture?: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  numberPlate: string;
}

interface DropoffLocation {
  address: string;
  documentType: string;
  documentDescription: string;
  status?: "pending" | "completed";
  completedAt?: string;
}

interface Trip {
  id: string;
  driverId?: string;
  status:
    | "pending"
    | "accepted"
    | "picked-up"
    | "in-progress"
    | "out-for-delivery"
    | "arrived"
    | "completed"
    | "cancelled";
  payment_status: "paid" | "pending" | "failed";
  pickupDate: string;
  pickupLocation: string;
  dropoffLocations: DropoffLocation[];
  price: number;
}

const deliverySteps = [
  { icon: Clock, label: "Awaiting driver", time: "Scheduled pickup time" },
  { icon: User, label: "Driver on the way", time: "Driver has accepted your request" },
  { icon: Truck, label: "Documents collected", time: "Driver has picked up your documents" },
  { icon: CheckCircle, label: "Delivered", time: "Trip completed" },
];

const statusToStep = {
  pending: 0,
  accepted: 1,
  "picked-up": 2,
  "in-progress": 2,
  "out-for-delivery": 2,
  arrived: 2,
  completed: 3,
  cancelled: 0,
};

const statusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800",
  accepted: "bg-purple-100 text-purple-800",
  "picked-up": "bg-indigo-100 text-indigo-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  "out-for-delivery": "bg-orange-100 text-orange-800",
  arrived: "bg-pink-100 text-pink-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

function formatCurrency(amount: number): string {
  const value = Number(amount) || 0;
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TripDetailsPage() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchTripDetails = async () => {
    if (!tripId) {
      setError("No trip ID provided");
      setLoading(false);
      return;
    }

    try {
      const tripRef = doc(db, "pickupRequests", tripId);
      const tripDoc = await getDoc(tripRef);

      if (tripDoc.exists()) {
        const tripData = tripDoc.data();
        // Ensure dropoffLocations is always an array
        const normalizedTripData = {
          id: tripDoc.id,
          ...tripData,
          dropoffLocations: Array.isArray(tripData.dropoffLocations)
            ? tripData.dropoffLocations
            : [{
                address: tripData.dropoffLocation || '',
                documentType: tripData.requestType || '',
                documentDescription: tripData.documentDescription || ''
              }]
        } as Trip;

        setTrip(normalizedTripData);

        if (
          normalizedTripData.driverId &&
          (!driverInfo || driverInfo.id !== normalizedTripData.driverId)
        ) {
          const driverRef = doc(db, "drivers", normalizedTripData.driverId);
          const driverDoc = await getDoc(driverRef);
          if (driverDoc.exists()) {
            setDriverInfo({
              id: driverDoc.id,
              ...driverDoc.data(),
            } as unknown as DriverInfo);
          }
        }
      } else {
        setError("Trip not found");
      }
    } catch (err) {
      console.error("Error fetching trip details:", err);
      setError("Failed to load trip details. Please try again later.");
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    fetchTripDetails();

    const intervalId = setInterval(() => {
      fetchTripDetails();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [tripId]);

  // Listen to driver live location from RTDB
  useEffect(() => {
    if (!trip?.driverId) return;
    const activeStatuses = ["accepted", "in-progress", "picked-up"];
    if (!activeStatuses.includes(trip.status)) {
      setDriverLocation(null);
      return;
    }

    const locationRef = ref(rtdb, `driverLocations/${trip.driverId}`);
    onValue(locationRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.lat && data?.lng) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      } else {
        setDriverLocation(null);
      }
    });

    return () => off(locationRef);
  }, [trip?.driverId, trip?.status]);

  if (loading) return <LoadingComponent />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div role="alert" className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" aria-hidden="true" />
          <p className="text-red-600 font-medium text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div role="alert" className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" aria-hidden="true" />
          <p className="text-red-600 font-medium text-lg">Trip not found</p>
        </div>
      </div>
    );
  }

  const currentStep = statusToStep[trip.status] || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">

        {/* Trip Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          {/* Status + Payment badges */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusColors[trip.status] || "bg-gray-100 text-gray-700"}`}
              >
                {trip.status.replace(/-/g, " ")}
              </span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${paymentStatusColors[trip.payment_status] || "bg-gray-100 text-gray-700"}`}
              >
                <CreditCard className="h-3 w-3 mr-1" aria-hidden="true" />
                {trip.payment_status || "unpaid"}
              </span>
            </div>
            <span className="text-2xl font-bold text-teal-700">{formatCurrency(trip.price)}</span>
          </div>

          {/* Pickup date */}
          <div className="flex items-center gap-1.5 mb-5">
            <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-500">{trip.pickupDate}</span>
          </div>

          {/* Route connector */}
          <div className="flex gap-3">
            {/* Vertical connector */}
            <div className="flex flex-col items-center pt-1">
              <span className="w-3 h-3 rounded-full bg-teal-600 flex-shrink-0" />
              <span className="w-0.5 flex-1 bg-gray-200 my-1" />
              <span className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
            </div>

            {/* Addresses */}
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              {/* Pickup */}
              <div>
                <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-0.5">Pickup</p>
                <p className="text-sm text-gray-800 leading-snug">{trip.pickupLocation}</p>
              </div>

              {/* Dropoff locations */}
              {(trip.dropoffLocations || []).map((location, index) => (
                <div key={index}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Dropoff {trip.dropoffLocations.length > 1 ? index + 1 : ""}
                  </p>
                  <p className="text-sm text-gray-800 leading-snug mb-1">{location.address}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {location.documentType && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        {location.documentType}
                      </span>
                    )}
                    {location.documentDescription && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {location.documentDescription}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Driver Info Card */}
        {driverInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Your Driver</p>
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative w-14 h-14 rounded-full overflow-hidden bg-teal-50 border-2 border-teal-100 flex-shrink-0">
                {driverInfo.profilePicture ? (
                  <Image
                    src={driverInfo.profilePicture}
                    alt="Driver"
                    layout="fill"
                    objectFit="cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-teal-100">
                    <span className="text-teal-700 font-bold text-lg">
                      {driverInfo.firstName?.[0] ?? ""}{driverInfo.lastName?.[0] ?? ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {driverInfo.firstName} {driverInfo.lastName}
                </h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    <Car className="h-3 w-3" aria-hidden="true" />
                    {driverInfo.vehicleColor} {driverInfo.vehicleModel} ({driverInfo.vehicleYear})
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    <CreditCard className="h-3 w-3" aria-hidden="true" />
                    {driverInfo.numberPlate}
                  </span>
                </div>
                <a
                  href={`tel:${driverInfo.phone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {driverInfo.phone}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Live Map Card */}
        {driverLocation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-gray-800">Live Location</span>
            </div>
            <div className="rounded-b-2xl overflow-hidden">
              <LoadScript googleMapsApiKey="AIzaSyAuzjtvfjuDgxVfuCmpeeoOyOy53eadqcc">
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "280px" }}
                  center={driverLocation}
                  zoom={15}
                >
                  <Marker
                    position={driverLocation}
                    title="Driver"
                    icon={{
                      url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                    }}
                  />
                </GoogleMap>
              </LoadScript>
            </div>
          </div>
        )}

        {/* Delivery Tracking Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">Delivery Progress</p>

          {/* Progress bar */}
          <div className="mb-7">
            <div className="h-2 bg-teal-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-teal-600 rounded-full"
                initial={{ width: "0%" }}
                animate={{
                  width: `${(currentStep / (deliverySteps.length - 1)) * 100}%`,
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-5">
            {deliverySteps.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isFuture = index > currentStep;

              return (
                <div key={index} className="flex items-start gap-4">
                  {/* Step icon circle */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center"
                      >
                        <step.icon size={18} className="text-white" aria-hidden="true" />
                      </motion.div>
                    )}
                    {isCurrent && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="w-9 h-9 rounded-full ring-2 ring-teal-400 ring-offset-2 bg-teal-500 flex items-center justify-center animate-pulse"
                      >
                        <step.icon size={18} className="text-white" aria-hidden="true" />
                      </motion.div>
                    )}
                    {isFuture && (
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <step.icon size={18} className="text-gray-400" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Step text */}
                  <div className="flex-1 min-w-0">
                    <AnimatePresence>
                      {(isCompleted || isCurrent) ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                        >
                          <p
                            className={`text-sm font-semibold ${
                              isCurrent ? "text-teal-600" : "text-gray-800"
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{step.time}</p>
                        </motion.div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-gray-400">{step.label}</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
