"use client"
import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
  Banknote,
  Car,
  User,
  LogOut,
  Package,
  CheckCircle,
  Truck,
  ClipboardList,
  Menu,
} from "lucide-react"
import { auth, db } from "@/utils/firebase"
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore"
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

const statusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800",
  accepted: "bg-blue-100 text-blue-800",
  "picked-up": "bg-purple-100 text-purple-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
}

const nextStatus: Record<string, { label: string; value: string }> = {
  accepted: { label: "Mark as Picked Up", value: "picked-up" },
  "picked-up": { label: "Mark as In Transit", value: "in-progress" },
  "in-progress": { label: "Mark as Completed", value: "completed" },
}

export default function DriverDashboard() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([])
  const [myTrips, setMyTrips] = useState<Trip[]>([])
  const [pastTrips, setPastTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const router = useRouter()

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
              future.sort((a, b) => (b.createdAt as any) - (a.createdAt as any))
              setAvailableTrips(future)
            }
          )

          // My trips: split into active and past
          unsubscribeMyTrips = onSnapshot(
            query(collection(db, "pickupRequests"), where("driverId", "==", user.uid)),
            (snap) => {
              const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))
              trips.sort((a, b) => (b.createdAt as any) - (a.createdAt as any))
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-teal-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/carerunnerlogo.png" alt="Logo" className="h-9 w-9 bg-white rounded-lg shrink-0" />
            <h1 className="text-xl font-bold">Carerunners</h1>
          </div>
          <nav className="hidden md:flex items-center space-x-1">
            <span className="text-teal-100 text-sm px-3">
              {driver.firstName} {driver.lastName}
            </span>
            <Button variant="ghost" className="text-white hover:bg-teal-700 px-2 py-1 h-auto text-xs" onClick={handleSignOut}>
              <LogOut className="mr-1 h-3.5 w-3.5 shrink-0" />
              SIGN OUT
            </Button>
          </nav>
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{driver.firstName} {driver.lastName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  SIGN OUT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 mt-4 max-w-3xl">
        {/* Profile Card */}
        <Card className="mb-6">
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-xl font-bold">Driver Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-teal-100 rounded-full p-3">
                  <User className="h-7 w-7 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{driver.firstName} {driver.lastName}</p>
                  <p className="text-gray-500 text-sm flex items-center">
                    <Car className="h-4 w-4 mr-1" />
                    {driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleYear}) · {driver.numberPlate}
                  </p>
                </div>
              </div>
              <Badge className={driver.isApproved ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                {driver.isApproved ? "Approved" : "Pending Approval"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Pending approval */}
        {!driver.isApproved && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              <Clock className="h-12 w-12 text-orange-400 mx-auto" />
              <h2 className="text-xl font-semibold text-gray-700">Application Under Review</h2>
              <p className="text-gray-500 max-w-sm mx-auto">
                Your application is being reviewed by the Care Runners team. You will be notified by email within 3–5 business days.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Trips for approved drivers */}
        {driver.isApproved && (
          <Tabs defaultValue="available">
            <TabsList className="w-full">
              <TabsTrigger value="available" className="flex-1">
                Available ({availableTrips.length})
              </TabsTrigger>
              <TabsTrigger value="my-trips" className="flex-1">
                My Trips ({myTrips.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="flex-1">
                Past ({pastTrips.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-4 mt-4">
              {availableTrips.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center text-gray-500">
                    <ClipboardList className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    No available trips at the moment.
                  </CardContent>
                </Card>
              ) : (
                availableTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    action={
                      <Button
                        className="bg-teal-600 hover:bg-teal-700 text-white w-full mt-3"
                        onClick={() => handleAcceptTrip(trip.id)}
                        disabled={updatingId === trip.id}
                      >
                        {updatingId === trip.id ? "Accepting..." : "Accept Trip"}
                      </Button>
                    }
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="my-trips" className="space-y-4 mt-4">
              {myTrips.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center text-gray-500">
                    <Truck className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    You haven&apos;t accepted any trips yet.
                  </CardContent>
                </Card>
              ) : (
                myTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    showStatus
                    action={
                      nextStatus[trip.status] ? (
                        <Button
                          className="bg-teal-600 hover:bg-teal-700 text-white w-full mt-3"
                          onClick={() => handleUpdateStatus(trip.id, nextStatus[trip.status].value)}
                          disabled={updatingId === trip.id}
                        >
                          {updatingId === trip.id ? "Updating..." : nextStatus[trip.status].label}
                        </Button>
                      ) : trip.status === "completed" ? (
                        <div className="flex items-center justify-center text-green-600 mt-3 font-medium">
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Completed · Your payout: {isNaN(Number(trip.price)) ? "R—" : `R${(Number(trip.price) * 0.7).toFixed(2)}`}
                        </div>
                      ) : null
                    }
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4 mt-4">
              {pastTrips.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center text-gray-500">
                    <ClipboardList className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    No past trips yet.
                  </CardContent>
                </Card>
              ) : (
                pastTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    showStatus
                    action={
                      trip.status === "completed" ? (
                        <div className="flex items-center justify-center text-green-600 mt-3 font-medium">
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Completed · Your payout: {isNaN(Number(trip.price)) ? "R—" : `R${(Number(trip.price) * 0.7).toFixed(2)}`}
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

      {/* Footer */}
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

function TripCard({ trip, action, showStatus }: { trip: Trip; action?: React.ReactNode; showStatus?: boolean }) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              {trip.pickupDate}{trip.pickupTime ? ` · ${trip.pickupTime}` : ""}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {showStatus && (
              <Badge className={statusColors[trip.status] || "bg-gray-100 text-gray-600"}>
                {trip.status}
              </Badge>
            )}
            <div className="flex items-center font-bold text-teal-700">
              <Banknote className="h-4 w-4 mr-1" />
              {isNaN(Number(trip.price)) ? "R—" : `R${trip.price}`}
            </div>
          </div>
        </div>

        <Separator className="mb-3" />

        <div className="space-y-2 text-sm">
          <div className="flex items-start space-x-2">
            <MapPin className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium">Pickup: </span>
              <span className="text-gray-600">{trip.pickupLocation}</span>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium">Dropoff: </span>
              <span className="text-gray-600">{trip.dropoffLocation}</span>
            </div>
          </div>
          {trip.distance && (
            <div className="flex items-center space-x-2 text-gray-500">
              <Package className="h-4 w-4" />
              <span>{trip.distance} km · {trip.requestType?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
            </div>
          )}
          {trip.firmName && (
            <div className="flex items-center space-x-2 text-gray-500">
              <User className="h-4 w-4" />
              <span>{trip.firmName}</span>
            </div>
          )}
        </div>

        {(trip.senderName || trip.receiverName) && (
          <>
            <Separator className="my-3" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {trip.senderName && (
                <div className="bg-gray-50 rounded p-2">
                  <p className="font-medium text-gray-700 mb-1">Sender</p>
                  <p className="text-gray-600">{trip.senderName}</p>
                  {trip.senderNumber && <p className="text-gray-500 text-xs">{trip.senderNumber}</p>}
                </div>
              )}
              {trip.receiverName && (
                <div className="bg-gray-50 rounded p-2">
                  <p className="font-medium text-gray-700 mb-1">Receiver</p>
                  <p className="text-gray-600">{trip.receiverName}</p>
                  {trip.receiverNumber && <p className="text-gray-500 text-xs">{trip.receiverNumber}</p>}
                </div>
              )}
            </div>
          </>
        )}

        {action}
      </CardContent>
    </Card>
  )
}
