"use client"
import React, { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MapPin,
  Clock,
  Car,
  User,
  LogOut,
  Package,
  CheckCircle,
  Truck,
  ClipboardList,
  Menu,
  Circle,
} from "lucide-react"
import { auth, db, rtdb } from "@/utils/firebase"
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore"
import { ref, set, remove } from "firebase/database"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import LoadingComponent from "@/components/loader"

interface Driver {
  firstName: string
  lastName: string
  email: string
  phone: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string
  numberPlate: string
  vehicleColor: string
  isApproved: boolean
}

interface Trip {
  id: string
  pickupLocation: string
  dropoffLocation: string
  price: number
  distance: string
  status: string
  payment_status: string
  pickupDate: string
  pickupTime: string
  documentDescription: string
  requestType: string
  firmName: string
  senderName: string
  senderNumber: string
  receiverName: string
  receiverNumber: string
  driverId?: string
  createdAt?: any
}

// Left accent strip color per status
const statusAccent: Record<string, string> = {
  pending: "border-orange-400",
  accepted: "border-blue-500",
  "picked-up": "border-purple-500",
  "in-progress": "border-yellow-400",
  completed: "border-green-500",
  cancelled: "border-gray-300",
}

// Badge styling per status
const statusBadge: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700 border border-orange-200",
  accepted: "bg-blue-100 text-blue-700 border border-blue-200",
  "picked-up": "bg-purple-100 text-purple-700 border border-purple-200",
  "in-progress": "bg-yellow-100 text-yellow-700 border border-yellow-200",
  completed: "bg-green-100 text-green-700 border border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
}

const nextStatus: Record<string, { label: string; value: string }> = {
  accepted: { label: "Mark as Collected", value: "in-progress" },
  "in-progress": { label: "Mark as Delivered", value: "completed" },
}

// createdAt comes back from Firestore as a Timestamp (with toMillis()), but can
// also be a plain Date or epoch-millis number depending on how it was written.
// Normalize to a millisecond number so sort comparisons behave correctly instead
// of subtracting Timestamp objects directly (which yields NaN).
function toMillis(value: any): number {
  if (!value) return 0
  if (typeof value === "number") return value
  if (typeof value.toMillis === "function") return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

export default function DriverDashboard() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([])
  const [myTrips, setMyTrips] = useState<Trip[]>([])
  const [pastTrips, setPastTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const router = useRouter()

  // Broadcast live location to RTDB while driver has an active trip
  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    const hasActiveTrip = myTrips.length > 0
    if (!hasActiveTrip) {
      remove(ref(rtdb, `driverLocations/${user.uid}`))
      return
    }

    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        set(ref(rtdb, `driverLocations/${user.uid}`), {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updatedAt: Date.now(),
        })
      },
      (err) => console.warn("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      remove(ref(rtdb, `driverLocations/${user.uid}`))
    }
  }, [myTrips])

  useEffect(() => {
    let unsubscribeAvailable: (() => void) | null = null
    let unsubscribeMyTrips: (() => void) | null = null

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth/driver/login")
        return
      }
      try {
        const driverDoc = await getDoc(doc(db, "drivers", user.uid))
        if (!driverDoc.exists()) {
          await signOut(auth)
          router.push("/auth/driver/login")
          return
        }
        const driverData = driverDoc.data() as Driver
        setDriver(driverData)

        if (driverData.isApproved) {
          const today = new Date().toISOString().split("T")[0]

          // Available: pending trips with today or future pickup date
          unsubscribeAvailable = onSnapshot(
            query(collection(db, "pickupRequests"), where("status", "==", "pending")),
            (snap) => {
              const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))
              const future = trips.filter((t) => !t.pickupDate || t.pickupDate >= today)
              future.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
              setAvailableTrips(future)
            }
          )

          // My trips: split into active and past
          unsubscribeMyTrips = onSnapshot(
            query(collection(db, "pickupRequests"), where("driverId", "==", user.uid)),
            (snap) => {
              const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))
              trips.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
              const active = trips.filter(
                (t) => t.status !== "completed" && t.status !== "cancelled" && (!t.pickupDate || t.pickupDate >= today)
              )
              const past = trips.filter(
                (t) => t.status === "completed" || t.status === "cancelled" || (t.pickupDate && t.pickupDate < today)
              )
              setMyTrips(active)
              setPastTrips(past)
            }
          )
        }
      } catch (error) {
        console.error("Error loading driver data:", error)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      unsubscribeAuth()
      unsubscribeAvailable?.()
      unsubscribeMyTrips?.()
    }
  }, [router])

  const handleAcceptTrip = async (tripId: string) => {
    const user = auth.currentUser
    if (!user) return
    setUpdatingId(tripId)
    try {
      await updateDoc(doc(db, "pickupRequests", tripId), { status: "accepted", driverId: user.uid })
      // onSnapshot listeners update the UI automatically
    } catch (error) {
      console.error("Error accepting trip:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleUpdateStatus = async (tripId: string, newStatus: string) => {
    setUpdatingId(tripId)
    try {
      await updateDoc(doc(db, "pickupRequests", tripId), { status: newStatus })
      // onSnapshot listeners update the UI automatically
    } catch (error) {
      console.error("Error updating status:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    router.push("/auth/driver/login")
  }

  if (loading) return <LoadingComponent />
  if (!driver) return null

  const initials =
    (driver.firstName?.[0] ?? "").toUpperCase() +
    (driver.lastName?.[0] ?? "").toUpperCase()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-teal-600 text-white shadow-lg">
        <div className="container mx-auto px-5 py-5 flex items-center justify-between max-w-3xl">
          <div className="flex items-center gap-3">
            <img
              src="/carerunnerlogo.png"
              alt="Logo"
              className="h-10 w-10 bg-white rounded-xl shrink-0 object-contain p-0.5"
            />
            <span className="text-xl font-bold tracking-tight">Carerunners</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-3">
            <span className="text-teal-100 text-sm font-medium">
              {driver.firstName} {driver.lastName}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition-colors rounded-lg px-3 py-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </nav>

          {/* Mobile menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Open menu" className="text-white p-1.5 rounded-lg hover:bg-teal-700 transition-colors">
                  <Menu className="h-6 w-6" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {driver.firstName} {driver.lastName}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6 max-w-3xl space-y-5">
        {/* ── Driver Profile Card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
          {/* subtle top-right decorative gradient blob */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-teal-50 opacity-60 pointer-events-none" />

          {/* Approval badge – top-right */}
          <div className="absolute top-4 right-4">
            {driver.isApproved ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-3 py-1">
                <Clock className="h-3 w-3" />
                Pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Avatar with initials */}
            <div className="h-14 w-14 rounded-full bg-teal-600 flex items-center justify-center shrink-0 shadow-md">
              <span className="text-white text-lg font-bold tracking-wide">{initials}</span>
            </div>

            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-lg leading-tight">
                {driver.firstName} {driver.lastName}
              </p>
              <p className="text-gray-500 text-sm mt-0.5">{driver.email}</p>

              {/* Vehicle info chips */}
              <div className="flex flex-wrap gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 font-medium">
                  <Car className="h-3 w-3 text-teal-600" />
                  {driver.vehicleYear} {driver.vehicleMake} {driver.vehicleModel}
                </span>
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 font-medium">
                  {driver.numberPlate}
                </span>
                {driver.vehicleColor && (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 font-medium">
                    {driver.vehicleColor}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Pending Approval State ── */}
        {!driver.isApproved && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center text-center gap-3">
            <div className="h-16 w-16 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock className="h-8 w-8 text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Application Under Review</h2>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
              Your application is being reviewed by the Care Runners team. You will be notified by email within 3–5 business days.
            </p>
          </div>
        )}

        {/* ── Trips Tabs (approved drivers only) ── */}
        {driver.isApproved && (
          <Tabs defaultValue="available">
            {/* Pill-style tab list */}
            <TabsList className="w-full bg-gray-100 rounded-xl p-1 h-auto gap-1">
              <TabsTrigger
                value="available"
                className="flex-1 rounded-lg text-sm font-medium py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 text-gray-500 transition-all"
              >
                <span className="flex items-center justify-center gap-1.5">
                  {/* Pulsing green dot for live updates */}
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Available
                  {availableTrips.length > 0 && (
                    <span className="ml-1 bg-teal-600 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none">
                      {availableTrips.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="my-trips"
                className="flex-1 rounded-lg text-sm font-medium py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 text-gray-500 transition-all"
              >
                <span className="flex items-center justify-center gap-1.5">
                  My Trips
                  {myTrips.length > 0 && (
                    <span className="ml-1 bg-teal-600 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none">
                      {myTrips.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="past"
                className="flex-1 rounded-lg text-sm font-medium py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 text-gray-500 transition-all"
              >
                <span className="flex items-center justify-center gap-1.5">
                  Past
                  {pastTrips.length > 0 && (
                    <span className="ml-1 bg-gray-400 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none">
                      {pastTrips.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* ── Available Trips ── */}
            <TabsContent value="available" className="space-y-3 mt-4">
              {availableTrips.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-10 w-10 text-gray-300" />} message="No available trips at the moment." />
              ) : (
                availableTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    action={
                      <button
                        className="w-full mt-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => handleAcceptTrip(trip.id)}
                        disabled={updatingId === trip.id}
                      >
                        {updatingId === trip.id ? "Accepting…" : "Accept Trip"}
                      </button>
                    }
                  />
                ))
              )}
            </TabsContent>

            {/* ── My Trips ── */}
            <TabsContent value="my-trips" className="space-y-3 mt-4">
              {myTrips.length === 0 ? (
                <EmptyState icon={<Truck className="h-10 w-10 text-gray-300" />} message="You haven't accepted any trips yet." />
              ) : (
                myTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    showStatus
                    action={
                      nextStatus[trip.status] ? (
                        <button
                          className="w-full mt-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => handleUpdateStatus(trip.id, nextStatus[trip.status].value)}
                          disabled={updatingId === trip.id}
                        >
                          {updatingId === trip.id ? "Updating…" : nextStatus[trip.status].label}
                        </button>
                      ) : trip.status === "completed" ? (
                        <div className="w-full mt-4 flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 font-semibold text-sm rounded-xl py-3">
                          <CheckCircle className="h-4 w-4" />
                          Completed · Payout:{" "}
                          {isNaN(Number(trip.price)) ? "R—" : `R${(Number(trip.price) * 0.7).toFixed(2)}`}
                        </div>
                      ) : null
                    }
                  />
                ))
              )}
            </TabsContent>

            {/* ── Past Trips ── */}
            <TabsContent value="past" className="space-y-3 mt-4">
              {pastTrips.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-10 w-10 text-gray-300" />} message="No past trips yet." />
              ) : (
                pastTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    showStatus
                    action={
                      trip.status === "completed" ? (
                        <div className="w-full mt-4 flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 font-semibold text-sm rounded-xl py-3">
                          <CheckCircle className="h-4 w-4" />
                          Completed · Payout:{" "}
                          {isNaN(Number(trip.price)) ? "R—" : `R${(Number(trip.price) * 0.7).toFixed(2)}`}
                        </div>
                      ) : null
                    }
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-teal-600 text-white mt-auto">
        <div className="container mx-auto flex justify-center items-center h-12">
          <div className="flex items-center">
            <span className="text-lg font-semibold mr-2">SHUDU</span>
            <img src="/shudu.png" alt="Connections Logo" className="h-10 w-20 mx-2" />
            <span className="text-lg font-semibold ml-2">CONNECTIONS</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Empty State Helper ──────────────────────────────────────────────────────
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 py-14 px-6">
      {icon}
      <p className="text-gray-400 text-sm font-medium text-center">{message}</p>
    </div>
  )
}

// ── Trip Card ───────────────────────────────────────────────────────────────
function TripCard({
  trip,
  action,
  showStatus,
}: {
  trip: Trip
  action?: React.ReactNode
  showStatus?: boolean
}) {
  const accentClass = statusAccent[trip.status] ?? "border-gray-200"

  const requestLabel = trip.requestType
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${accentClass} overflow-hidden hover:shadow-md transition-shadow duration-200`}
    >
      <div className="p-5">
        {/* ── Top row: date/time + price ── */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-1.5 text-gray-500 text-sm">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {trip.pickupDate}
              {trip.pickupTime ? ` · ${trip.pickupTime}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showStatus && trip.status && (
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${statusBadge[trip.status] ?? "bg-gray-100 text-gray-600"}`}>
                {trip.status.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            )}
            {/* Price – prominent teal */}
            <span className="text-teal-700 font-bold text-base">
              {isNaN(Number(trip.price)) ? "R—" : `R${trip.price}`}
            </span>
          </div>
        </div>

        {/* ── Route: pickup → dropoff with visual connector ── */}
        <div className="flex gap-3 mb-4">
          {/* Connector column */}
          <div className="flex flex-col items-center pt-0.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500 ring-2 ring-teal-100" />
            <span className="flex-1 w-px bg-gray-200 my-1" style={{ minHeight: "20px" }} />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-400 ring-2 ring-gray-100" />
          </div>
          {/* Addresses */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Pickup</p>
              <p className="text-gray-800 text-sm font-medium leading-snug">{trip.pickupLocation}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Dropoff</p>
              <p className="text-gray-800 text-sm font-medium leading-snug">{trip.dropoffLocation}</p>
            </div>
          </div>
        </div>

        {/* ── Meta chips row ── */}
        {(trip.distance || trip.requestType || trip.firmName) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {trip.distance && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 text-gray-500 rounded-full px-2.5 py-1">
                <MapPin className="h-3 w-3 text-teal-500" />
                {trip.distance} km
              </span>
            )}
            {trip.requestType && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 text-gray-500 rounded-full px-2.5 py-1">
                <Package className="h-3 w-3 text-teal-500" />
                {requestLabel}
              </span>
            )}
            {trip.firmName && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 text-gray-500 rounded-full px-2.5 py-1">
                <User className="h-3 w-3 text-teal-500" />
                {trip.firmName}
              </span>
            )}
          </div>
        )}

        {/* ── Sender / Receiver ── */}
        {(trip.senderName || trip.receiverName) && (
          <div className="grid grid-cols-2 gap-2 mb-1">
            {trip.senderName && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Sender</p>
                <p className="text-gray-800 text-sm font-medium leading-snug">{trip.senderName}</p>
                {trip.senderNumber && (
                  <p className="text-gray-400 text-xs mt-0.5">{trip.senderNumber}</p>
                )}
              </div>
            )}
            {trip.receiverName && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Receiver</p>
                <p className="text-gray-800 text-sm font-medium leading-snug">{trip.receiverName}</p>
                {trip.receiverNumber && (
                  <p className="text-gray-400 text-xs mt-0.5">{trip.receiverNumber}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Action button ── */}
        {action}
      </div>
    </div>
  )
}
