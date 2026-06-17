// @ts-nocheck

"use client"

import React, { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Banknote, Clock, CheckCircle, XCircle, FileText, Calendar, Ban, Car } from "lucide-react";
import { db } from '@/utils/firebase';
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { auth } from '@/utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from "next/navigation";

type Trip = {
  id: string;
  pickupLocation: string;
  dropoffLocation: string;
  price: number;
  status: string;
  payment_status: string;
  pickupDate: string;
  pickupTime: string;
  documentDescription: string;
  requestType: string;
};

type GroupedTrips = {
  [date: string]: Trip[];
};

// Maps a trip status to the left-border color class
const statusBorderColor: Record<string, string> = {
  completed: "border-l-green-500",
  "in-progress": "border-l-yellow-400",
  cancelled: "border-l-gray-300",
  pending: "border-l-orange-400",
  "waiting for driver": "border-l-blue-400",
};

// Pill badge styles for trip status
const statusPillColors: Record<string, string> = {
  completed: "bg-green-100 text-green-700 border border-green-200",
  "in-progress": "bg-yellow-100 text-yellow-700 border border-yellow-200",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
  pending: "bg-orange-100 text-orange-700 border border-orange-200",
  "waiting for driver": "bg-blue-100 text-blue-700 border border-blue-200",
};

// Pill badge styles for payment status
const paymentPillColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border border-green-200",
  unpaid: "bg-orange-100 text-orange-700 border border-orange-200",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
  failed: "bg-red-100 text-red-700 border border-red-200",
};

const isCancellable = (trip: Trip): boolean => {
  const cancellableStatuses = ['pending', 'waiting for driver'];
  const today = new Date().toISOString().split('T')[0];
  return cancellableStatuses.includes(trip.status) && trip.pickupDate >= today;
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function TripSkeleton() {
  return (
    <div className="bg-white rounded-xl border-l-4 border-l-gray-200 shadow-sm p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-6 bg-gray-200 rounded w-16" />
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onRequest }: { onRequest: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-teal-50 rounded-full p-6 mb-5">
        <Car className="h-12 w-12 text-teal-500" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">No trips yet</h2>
      <p className="text-gray-500 mb-6 max-w-xs">
        You haven&apos;t made any trip requests yet. Book your first pickup and we&apos;ll handle the rest.
      </p>
      <Button
        onClick={onRequest}
        className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-medium"
      >
        Request your first pickup
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserTrips() {
  const [groupedTrips, setGroupedTrips] = useState<GroupedTrips>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

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
          const q = query(
            collection(db, 'pickupRequests'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          const fetchedTrips: Trip[] = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as Omit<Trip, 'id'>
          }));

          const grouped = fetchedTrips.reduce((acc, trip) => {
            const date = new Date(trip.pickupDate).toDateString();
            if (!acc[date]) acc[date] = [];
            acc[date].push(trip);
            return acc;
          }, {} as GroupedTrips);

          setGroupedTrips(grouped);
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

  const handleCancel = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to cancel this trip?')) return;

    setCancellingId(tripId);
    try {
      await updateDoc(doc(db, 'pickupRequests', tripId), {
        status: 'cancelled',
        payment_status: 'cancelled',
      });

      // Update local state so UI reflects immediately
      setGroupedTrips(prev => {
        const updated = { ...prev };
        for (const date in updated) {
          updated[date] = updated[date].map(t =>
            t.id === tripId ? { ...t, status: 'cancelled', payment_status: 'cancelled' } : t
          );
        }
        return updated;
      });
    } catch (err) {
      console.error('Error cancelling trip:', err);
      alert('Failed to cancel trip. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-36 mb-8 animate-pulse" />
          <div className="space-y-4">
            <TripSkeleton />
            <TripSkeleton />
            <TripSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const hasTrips = Object.keys(groupedTrips).length > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">

        {/* ── Page heading ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Trips</h1>
          <p className="text-sm text-gray-500 mt-1">All your past and upcoming pickup requests</p>
        </div>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!hasTrips && (
          <EmptyState onRequest={() => router.push('/request')} />
        )}

        {/* ── Trip groups ────────────────────────────────────────────────── */}
        {hasTrips && (
          <div className="space-y-10">
            {Object.entries(groupedTrips).map(([date, trips]) => (
              <div key={date}>

                {/* Date group header */}
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-4 w-4 text-teal-600 flex-shrink-0" />
                  <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
                    {date}
                  </span>
                  <hr className="flex-1 border-gray-200" />
                </div>

                {/* Trip cards */}
                <div className="space-y-4">
                  {trips.map((trip) => {
                    const borderColor = statusBorderColor[trip.status] ?? "border-l-gray-300";
                    const isClickable = trip.status !== 'cancelled';

                    return (
                      <div
                        key={trip.id}
                        className={[
                          "bg-white rounded-xl border-l-4 shadow-sm overflow-hidden transition-shadow duration-200",
                          borderColor,
                          isClickable ? "cursor-pointer hover:shadow-md" : "opacity-60",
                        ].join(" ")}
                        onClick={() => isClickable && handleTripClick(trip.id)}
                      >
                        <div className="p-5">

                          {/* ── Card header: time + price ──────────────────── */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                              <Clock className="h-4 w-4" />
                              <span>{trip.pickupTime || new Date(trip.pickupDate).toLocaleTimeString()}</span>
                            </div>
                            <span className="text-xl font-bold text-teal-600">
                              R{trip.price}
                            </span>
                          </div>

                          {/* ── Route: pickup → dropoff with connector ─────── */}
                          <div className="flex gap-3 mb-4">
                            {/* Visual connector column */}
                            <div className="flex flex-col items-center pt-1 flex-shrink-0">
                              <span className="h-2.5 w-2.5 rounded-full bg-teal-500 ring-2 ring-teal-100" />
                              <span className="w-px flex-1 bg-gray-200 my-1" style={{ minHeight: '1.5rem' }} />
                              <span className="h-2.5 w-2.5 rounded-full bg-gray-400 ring-2 ring-gray-100" />
                            </div>

                            {/* Address column */}
                            <div className="flex flex-col justify-between gap-3 flex-1 min-w-0">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Pickup</p>
                                <p className="text-sm text-gray-800 leading-snug truncate">{trip.pickupLocation}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Dropoff</p>
                                <p className="text-sm text-gray-800 leading-snug truncate">{trip.dropoffLocation}</p>
                              </div>
                            </div>
                          </div>

                          {/* ── Meta row: request type + description ──────── */}
                          {(trip.requestType || trip.documentDescription) && (
                            <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-4 space-y-1.5">
                              {trip.requestType && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <FileText className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
                                  <span className="font-medium text-gray-700">
                                    {trip.requestType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                  </span>
                                </div>
                              )}
                              {trip.documentDescription && (
                                <p className="text-xs text-gray-500 pl-5 leading-relaxed line-clamp-2">
                                  {trip.documentDescription}
                                </p>
                              )}
                            </div>
                          )}

                          {/* ── Footer: badges + action buttons ───────────── */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            {/* Status / payment badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusPillColors[trip.status] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                                {trip.status || 'pending'}
                              </span>
                              {trip.payment_status !== 'cancelled' && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${paymentPillColors[trip.payment_status] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                                  {trip.payment_status || 'unpaid'}
                                </span>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              {/* Cancel button */}
                              {isCancellable(trip) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs px-3 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                                  onClick={(e) => handleCancel(e, trip.id)}
                                  disabled={cancellingId === trip.id}
                                >
                                  <Ban className="h-3.5 w-3.5 mr-1" />
                                  {cancellingId === trip.id ? 'Cancelling…' : 'Cancel'}
                                </Button>
                              )}

                              {/* Payment action / status indicator */}
                              {trip.status === 'cancelled' ? (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <Ban className="h-3.5 w-3.5" />
                                  Cancelled
                                </span>
                              ) : trip.payment_status === 'paid' ? (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Paid
                                </span>
                              ) : trip.payment_status === 'failed' ? (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs px-3 bg-teal-600 hover:bg-teal-700 text-white"
                                  onClick={(e) => { e.stopPropagation(); router.push('/billing'); }}
                                >
                                  <Banknote className="h-3.5 w-3.5 mr-1" />
                                  Retry Payment
                                </Button>
                              ) : trip.status === 'completed' ? (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs px-3 bg-teal-600 hover:bg-teal-700 text-white"
                                  onClick={(e) => { e.stopPropagation(); router.push('/billing'); }}
                                >
                                  <Banknote className="h-3.5 w-3.5 mr-1" />
                                  Pay Now
                                </Button>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-blue-500">
                                  <Clock className="h-3.5 w-3.5" />
                                  In progress
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
