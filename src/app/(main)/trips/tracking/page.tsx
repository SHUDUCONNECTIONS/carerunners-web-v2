

"use client";

import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Banknote,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Truck,
  User,
  Home,
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
  { icon: Clock, label: "Waiting for pickup", time: "Scheduled pickup time" },
  { icon: User, label: "Driver accepted", time: "Driver is on the way" },
  { icon: Package, label: "Picked up", time: "Package is with the driver" },
  { icon: Truck, label: "In transit", time: "Packages are being delivered" },
  { icon: MapPin, label: "Out for delivery", time: "Almost there!" },
  {
    icon: Home,
    label: "All destinations reached",
    time: "Deliveries complete",
  },
  {
    icon: CheckCircle,
    label: "All packages delivered",
    time: "Trip completed",
  },
];

const statusToStep = {
  pending: 0,
  accepted: 1,
  "picked-up": 2,
  "in-progress": 3,
  "out-for-delivery": 4,
  arrived: 5,
  completed: 6,
  cancelled: 0,
};

const statusColors = {
  pending: "bg-blue-100 text-blue-800",
  accepted: "bg-purple-100 text-purple-800",
  "picked-up": "bg-indigo-100 text-indigo-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  "out-for-delivery": "bg-orange-100 text-orange-800",
  arrived: "bg-pink-100 text-pink-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const paymentStatusColors = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

export default function TripDetailsPage() {
    const searchParams = useSearchParams();
    const tripId = searchParams.get("tripId");
    const [loading, setLoading] = useState(true);
    const [trip, setTrip] = useState<Trip | null>(null);
    const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
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
          const tripData = { id: tripDoc.id, ...tripDoc.data() } as Trip;
          setTrip(tripData);
  
          // Only fetch driver info if it's not already loaded or if the driver has changed
          if (tripData.driverId && 
              (!driverInfo || driverInfo.id !== tripData.driverId)) {
            const driverRef = doc(db, "drivers", tripData.driverId);
            const driverDoc = await getDoc(driverRef);
            if (driverDoc.exists()) {
              setDriverInfo({ id: driverDoc.id, ...driverDoc.data() } as unknown as DriverInfo);
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
    
        // Set up auto-refresh interval
        // Refresh every 3 seconds
        const intervalId = setInterval(() => {
          fetchTripDetails();
        }, 3000); 
    
        // Cleanup interval on component unmount
        return () => clearInterval(intervalId);
      }, [tripId]);

  if (loading) return <LoadingComponent />;
  if (error) return <p>Error: {error}</p>;
  if (!trip) return <p>Trip not found</p>;

  const currentStep = statusToStep[trip.status] || 0;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Main Trip Details Card */}
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Trip Details</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="space-y-6">
              {/* Date and Status */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">
                    {trip.pickupDate}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Badge className={statusColors[trip.status]}>
                    {trip.status}
                  </Badge>
                  <Badge className={paymentStatusColors[trip.payment_status]}>
                    {trip.payment_status || "unpaid"}
                  </Badge>
                </div>
              </div>

              {/* Locations */}
              <div className="space-y-4">
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-teal-600 mr-2 mt-1" />
                  <div>
                    <span className="font-medium">Pickup:</span>
                    <p className="ml-2">{trip.pickupLocation}</p>
                  </div>
                </div>

                <Separator />

                {trip.dropoffLocations.map((location, index) => (
                  <div key={index} className="bg-gray-200 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">
                          Dropoff {index + 1}:
                        </span>
                      </div>
                      <span>{location.address}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Document Type:</span>
                      </div>
                      <span>{location.documentType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <span className="font-semibold">Description:</span>
                      </div>
                      <span>{location.documentDescription}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Banknote className="h-5 w-5 text-teal-600 mr-1" />
                  <span className="text-lg font-bold">R{trip.price}</span>
                </div>
                {trip.payment_status === "paid" ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-1" />
                    <span>Paid</span>
                  </div>
                ) : trip.payment_status === "failed" ? (
                  <div className="flex items-center text-red-600">
                    <XCircle className="h-5 w-5 mr-1" />
                    <span>Payment Failed</span>
                  </div>
                ) : (
                  <div className="flex items-center text-yellow-600">
                    <Clock className="h-5 w-5 mr-1" />
                    <span>Payment Pending</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Information Card - Unchanged */}
        {driverInfo && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Your Driver</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                  {driverInfo.profilePicture ? (
                    <Image
                      src={driverInfo.profilePicture}
                      alt="Driver"
                      layout="fill"
                      objectFit="cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {driverInfo.firstName} {driverInfo.lastName}
                  </h3>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center">
                      <Car className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {driverInfo.vehicleColor} {driverInfo.vehicleModel} (
                        {driverInfo.vehicleYear})
                      </span>
                    </div>
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Number Plate: {driverInfo.numberPlate}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Phone: {driverInfo.phone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Tracking Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Delivery Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-8">
              <div className="h-2 bg-teal-200 rounded-full">
                <motion.div
                  className="h-full bg-teal-600 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{
                    width: `${
                      (currentStep / (deliverySteps.length - 1)) * 100
                    }%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>
            </div>
            <div className="space-y-6">
              {deliverySteps.map((step, index) => (
                <div key={index} className="flex items-center">
                  <div className="flex-shrink-0 mr-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: index <= currentStep ? 1 : 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        index < currentStep
                          ? "bg-teal-600 text-white"
                          : index === currentStep
                          ? "bg-teal-500 text-white"
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      <step.icon size={20} />
                    </motion.div>
                  </div>
                  <div className="flex-grow">
                    <AnimatePresence>
                      {index <= currentStep && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <p
                            className={`font-semibold ${
                              index === currentStep
                                ? "text-teal-600"
                                : "text-gray-700"
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-sm text-gray-500">{step.time}</p>
                          {index === 4 && trip.dropoffLocations.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {trip.dropoffLocations.map((location, dIndex) => (
                                <p
                                  key={dIndex}
                                  className="text-sm text-gray-500"
                                >
                                  {location.status === "completed"
                                    ? "✓ "
                                    : "○ "}
                                  {location.address}
                                  {location.completedAt &&
                                    ` - ${location.completedAt}`}
                                </p>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}