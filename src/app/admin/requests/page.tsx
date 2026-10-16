// @ts-nocheck
"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { collection, getDocs, query, where } from "firebase/firestore"
import { auth, db } from "@/utils/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertCircle,
  Clock,
  Mail,
  MapPin,
  Phone,
  Search,
  User,
} from "lucide-react"
import LoadingComponent from "@/components/loader"
import { isAdminAccount } from "@/utils/isAdminAccount"
import { SERVICE_TYPES, ServiceType } from "@/lib/services"
import { saDay } from "@/lib/saDate"

type RequestedTrip = {
  id: string
  userId: string
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  pickupTime: string
  price: number
  distance: string
  serviceType?: string
  requestType?: string
  documentDescription?: string
  customerName: string
  customerEmail: string
  customerPhone: string
  createdAt: number
}

function formatCurrency(amount: number): string {
  const value = Number(amount) || 0
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Doc IDs are `${userId}_${Date.now()}`, so the timestamp suffix is a
// reliable fallback for docs where the createdAt Timestamp is missing.
function requestCreatedAt(id: string, data: any): number {
  if (data.createdAt?.toMillis) return data.createdAt.toMillis()
  const suffix = id.split("_").pop()
  const parsed = Number(suffix)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function AdminRequestedTripsPage() {
  const [trips, setTrips] = useState<RequestedTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [search, setSearch] = useState("")
  const [showPast, setShowPast] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth/login")
        return
      }

      if (!(await isAdminAccount(user))) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      try {
        // "pending" = paid and booked, waiting for a driver to accept —
        // the same set the driver dashboard shows as open requests.
        const tripsSnap = await getDocs(
          query(collection(db, "pickupRequests"), where("status", "==", "pending"))
        )

        if (tripsSnap.empty) {
          setTrips([])
          setLoading(false)
          return
        }

        const [usersSnap, firmsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "firms")),
        ])

        const usersById: Record<string, any> = {}
        usersSnap.docs.forEach((d) => { usersById[d.id] = d.data() })

        const firmsById: Record<string, any> = {}
        firmsSnap.docs.forEach((d) => { firmsById[d.id] = d.data() })

        const result: RequestedTrip[] = tripsSnap.docs.map((d) => {
          const data = d.data()
          const customer = usersById[data.userId] || {}
          const firm = firmsById[customer.firmId] || {}
          return {
            id: d.id,
            userId: data.userId,
            pickupLocation: data.pickupLocation,
            dropoffLocation: data.dropoffLocation,
            pickupDate: data.pickupDate,
            pickupTime: data.pickupTime,
            price: data.price,
            distance: data.distance,
            serviceType: data.serviceType,
            requestType: data.requestType,
            documentDescription: data.documentDescription,
            customerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Unknown",
            customerEmail: customer.email || firm.email || "",
            customerPhone: customer.phone || firm.phone || firm.contactNumber || "",
            createdAt: requestCreatedAt(d.id, data),
          }
        })

        // Most recently requested first.
        result.sort((a, b) => b.createdAt - a.createdAt)

        setTrips(result)
      } catch (err) {
        console.error("Admin requested trips: fetch error", err)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Trips dated before today (SA time) can't be delivered any more, so they're kept apart from the open
  // requests instead of counting as waiting for a driver.
  const today = saDay()
  const isPast = (t: RequestedTrip) => Boolean(t.pickupDate) && t.pickupDate < today
  const past = trips.filter(isPast)
  const upcoming = trips.filter((t) => !isPast(t))
  const shown = showPast ? past : upcoming
  const q = search.toLowerCase()
  const filtered = !q
    ? shown
    : shown.filter(
        (t) =>
          t.customerName.toLowerCase().includes(q) ||
          t.customerEmail.toLowerCase().includes(q) ||
          t.pickupLocation?.toLowerCase().includes(q) ||
          t.dropoffLocation?.toLowerCase().includes(q)
      )

  if (loading) return <LoadingComponent />

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-lg font-semibold text-gray-800">Access Denied</p>
            <p className="text-sm text-gray-500">You do not have permission to view this page.</p>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Requested Trips</CardTitle>
          </CardHeader>
          <CardContent className="mt-5">
            {shown.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                {showPast ? "No past requests." : "No open requests. Every booked trip has a driver."}
              </p>
            ) : (
              <div className="flex gap-6">
                <div>
                  <p className="text-sm text-gray-500">{showPast ? "Past, never taken" : "Awaiting a Driver"}</p>
                  <p className="text-2xl font-bold text-gray-800">{shown.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold text-teal-700">
                    {formatCurrency(shown.reduce((sum, t) => sum + (Number(t.price) || 0), 0))}
                  </p>
                </div>
              </div>
            )}
            {past.length > 0 && (
              <button
                onClick={() => setShowPast((v) => !v)}
                className="mt-4 text-sm font-medium text-teal-700 hover:underline"
              >
                {showPast
                  ? `Back to open requests (${upcoming.length})`
                  : `Show ${past.length} past ${past.length === 1 ? "request" : "requests"} that never got a driver`}
              </button>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        {shown.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by customer, email, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Trip cards */}
        <div className="space-y-4">
          {filtered.map((trip) => {
            const service = trip.serviceType ? SERVICE_TYPES[trip.serviceType as ServiceType] : undefined
            return (
              <Card key={trip.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">{trip.customerName}</p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {trip.customerEmail && (
                            <a href={`mailto:${trip.customerEmail}`} className="flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50">
                              <Mail className="h-3 w-3" />
                              {trip.customerEmail}
                            </a>
                          )}
                          {trip.customerPhone && (
                            <a href={`tel:${trip.customerPhone}`} className="flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50">
                              <Phone className="h-3 w-3" />
                              {trip.customerPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {isPast(trip) ? (
                        <Badge className="bg-gray-100 text-gray-600 border border-gray-200">Date passed</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 border border-orange-200">Pending</Badge>
                      )}
                      <p className="text-xl font-bold text-teal-700">{formatCurrency(trip.price)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Pickup</p>
                        <p className="text-sm text-gray-800">{trip.pickupLocation}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Dropoff</p>
                        <p className="text-sm text-gray-800">{trip.dropoffLocation}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {trip.pickupDate} {trip.pickupTime}
                    </div>
                    {service && (
                      <div className="flex items-center gap-1.5">
                        <service.icon className="h-4 w-4 text-teal-500" />
                        {service.label}
                      </div>
                    )}
                    {trip.distance && <span>{trip.distance} km</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {filtered.length === 0 && shown.length > 0 && (
          <p className="text-center text-gray-500 py-6">No requests match your search.</p>
        )}
      </div>
    </div>
  )
}
