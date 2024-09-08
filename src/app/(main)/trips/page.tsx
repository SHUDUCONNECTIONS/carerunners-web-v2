// @ts-nocheck


"use client"

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Banknote, Clock, CheckCircle, XCircle } from "lucide-react";
import { db } from '@/utils/firebase'; 
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { auth } from '@/utils/firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from "next/navigation";
type Trip = {
  id: string;
  from: string;
  to: string;
  price: number;
  status: string
  payment_status: string
  date: string;
};

const statusColors = {
  completed: "bg-green-100 text-green-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  "pending": "bg-red-100 text-red-800",
};

const paymentStatusColors = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

export default function UserTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  console.log(trips)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchTrips = async () => {
        try {
          const tripsCollection = collection(db, 'pickupRequests');
          const q = query(
            tripsCollection,
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc') // Order trips by creation date
          );
          const querySnapshot = await getDocs(q);

          const fetchedTrips: Trip[] = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as Omit<Trip, 'id'> // Adjust if needed based on your Firestore schema
          }));

          setTrips(fetchedTrips);
        } catch (err) {
          console.error('Error fetching trips:', err);
          setError('Failed to load trips. Please try again later.');
        } finally {
          setLoading(false);
        }
      };

      fetchTrips();
    }
  }, [user]);


  const handleTripClick = (tripId: string) => {
    router.push(`/trips/tracking?tripId=${tripId}`);
  };

  if (loading) return <p>Loading trips...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Your Trips</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="space-y-6">
              {trips.map((trip) => (
                <Card key={trip.id} className="overflow-hidden"      onClick={() => handleTripClick(trip.id)}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                      <div className="flex items-center mb-2 sm:mb-0">
                        <Clock className="h-5 w-5 text-gray-500 mr-2" />
                        <span className="text-sm text-gray-600">{trip.pickupDate}</span>
                      </div>
                      <div className="flex space-x-2">
                        <Badge className={statusColors[trip.status]}>
                          {trip.status}
                        </Badge>
                        <Badge className={paymentStatusColors[trip.payment_status]}>
                          {trip.payment_status || 'unpaid'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-teal-600 mr-2" />
                        <span className="font-medium">From:</span>
                        <span className="ml-2">{trip.pickupLocation}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-teal-600 mr-2" />
                        <span className="font-medium">To:</span>
                        <span className="ml-2">{trip.dropoffLocation}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between items-center">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}