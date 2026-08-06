// @ts-nocheck
"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { collection, doc, getDocs, updateDoc } from "firebase/firestore"
import { ref as dbRef, update as dbUpdate } from "firebase/database"
import { auth, db, rtdb } from "@/utils/firebase"
import { ADMIN_EMAILS } from "@/utils/adminEmails"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertCircle,
  Car,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
  Search,
  User,
  XCircle,
} from "lucide-react"
import LoadingComponent from "@/components/loader"
import { calculatePayout } from "@/lib/pricing"
import { getStatusBadgeClass, getStatusLabel } from "@/lib/tripStatus"

type DriverApplication = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  baseLocation: string
  vehicleType: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string
  numberPlate: string
  vehicleColor: string
  licenseNumber: string
  insuranceProvider: string
  insuranceNumber: string
  identificationDocUrl: string | null
  proofOfResidenceDocUrl: string | null
  isApproved: boolean
  applicationStatus?: "pending" | "approved" | "rejected"
}

type DriverTrip = {
  id: string
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  pickupTime: string
  status: string
  price: string
  distance: string
  requestType: string
}

function driverStatus(d: DriverApplication): "pending" | "approved" | "rejected" {
  if (d.applicationStatus === "rejected") return "rejected"
  if (d.isApproved) return "approved"
  return "pending"
}

function csvEscape(value: string | number) {
  const s = String(value ?? "")
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const content = rows.map((row) => row.map(csvEscape).join(",")).join("\n")
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverApplication[]>([])
  const [tripsByDriver, setTripsByDriver] = useState<Record<string, DriverTrip[]>>({})
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [actionId, setActionId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth/login")
        return
      }

      if (!ADMIN_EMAILS.includes(user.email ?? "")) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      try {
        const [driversSnap, tripsSnap] = await Promise.all([
          getDocs(collection(db, "drivers")),
          getDocs(collection(db, "pickupRequests")),
        ])

        setDrivers(driversSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DriverApplication)))

        const byDriver: Record<string, DriverTrip[]> = {}
        tripsSnap.docs.forEach((d) => {
          const data = d.data()
          if (!data.driverId) return
          if (!byDriver[data.driverId]) byDriver[data.driverId] = []
          byDriver[data.driverId].push({ id: d.id, ...data } as DriverTrip)
        })
        setTripsByDriver(byDriver)
      } catch (err) {
        console.error("Admin drivers: fetch error", err)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const setDriverApproval = async (driverId: string, next: "approved" | "rejected") => {
    setActionId(driverId)
    try {
      const patch = {
        isApproved: next === "approved",
        applicationStatus: next,
      }
      await updateDoc(doc(db, "drivers", driverId), patch)
      await dbUpdate(dbRef(rtdb, `drivers/${driverId}`), patch)
      setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, ...patch } : d)))
    } catch (err) {
      console.error("Admin drivers: update error", err)
    } finally {
      setActionId(null)
    }
  }

  const handleApprove = (driverId: string) => setDriverApproval(driverId, "approved")

  const handleReject = (driverId: string) => {
    if (window.confirm("Reject this driver application?")) {
      setDriverApproval(driverId, "rejected")
    }
  }

  const payoutFor = (trips: DriverTrip[]) =>
    trips
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + calculatePayout(t.price || 0), 0)

  const handleDownloadTrips = (driver: DriverApplication) => {
    const trips = tripsByDriver[driver.id] || []
    const rows: (string | number)[][] = [
      ["Date", "Time", "Pickup", "Dropoff", "Type", "Distance (km)", "Status", "Trip Price (R)", "Driver Payout (R)"],
      ...trips.map((t) => [
        t.pickupDate || "",
        t.pickupTime || "",
        t.pickupLocation || "",
        t.dropoffLocation || "",
        t.requestType?.replace(/_/g, " ") || "",
        t.distance || "",
        t.status || "",
        t.price ? Number(t.price).toFixed(2) : "",
        t.status === "completed" && t.price ? calculatePayout(t.price).toFixed(2) : "",
      ]),
    ]
    downloadCSV(`${driver.firstName}-${driver.lastName}-trips.csv`, rows)
  }

  if (loading) return <LoadingComponent />

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
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

  const q = search.toLowerCase()
  const matches = (d: DriverApplication) =>
    !q ||
    `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
    d.email?.toLowerCase().includes(q) ||
    d.phone?.toLowerCase().includes(q)

  const pending = drivers.filter((d) => driverStatus(d) === "pending" && matches(d))
  const approved = drivers.filter((d) => driverStatus(d) === "approved" && matches(d))
  const rejected = drivers.filter((d) => driverStatus(d) === "rejected" && matches(d))

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Driver Management</CardTitle>
          </CardHeader>
          <CardContent className="mt-5">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-sm text-gray-500">Pending Applications</p>
                <p className="text-2xl font-bold text-orange-600">{drivers.filter((d) => driverStatus(d) === "pending").length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved Drivers</p>
                <p className="text-2xl font-bold text-teal-700">{drivers.filter((d) => driverStatus(d) === "approved").length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rejected</p>
                <p className="text-2xl font-bold text-gray-500">{drivers.filter((d) => driverStatus(d) === "rejected").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9 bg-white"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="w-full bg-white border">
            <TabsTrigger value="pending" className="flex-1">
              Applications {pending.length > 0 && <Badge className="ml-2 bg-orange-100 text-orange-700 border border-orange-200">{pending.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex-1">
              Approved {approved.length > 0 && <Badge className="ml-2 bg-teal-100 text-teal-700 border border-teal-200">{approved.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1">
              Rejected {rejected.length > 0 && <Badge className="ml-2 bg-gray-100 text-gray-600 border border-gray-200">{rejected.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── Pending applications ── */}
          <TabsContent value="pending" className="space-y-4 mt-4">
            {pending.length === 0 && (
              <p className="text-center text-gray-500 py-10">No pending applications.</p>
            )}
            {pending.map((driver) => (
              <Card key={driver.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {driver.firstName} {driver.lastName}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {driver.email && (
                            <a href={`mailto:${driver.email}`} className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
                              <Mail className="h-3 w-3" />
                              {driver.email}
                            </a>
                          )}
                          {driver.phone && (
                            <a href={`tel:${driver.phone}`} className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
                              <Phone className="h-3 w-3" />
                              {driver.phone}
                            </a>
                          )}
                          {driver.baseLocation && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="h-3 w-3" />
                              {driver.baseLocation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                        disabled={actionId === driver.id}
                        onClick={() => handleApprove(driver.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        disabled={actionId === driver.id}
                        onClick={() => handleReject(driver.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Reject
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Car className="h-4 w-4 text-teal-600 shrink-0" />
                      {driver.vehicleYear} {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleType}) — {driver.numberPlate}
                    </div>
                    <div className="text-gray-600">License #: {driver.licenseNumber}</div>
                    <div className="text-gray-600">Insurance: {driver.insuranceProvider} ({driver.insuranceNumber})</div>
                    <div className="flex flex-wrap gap-3">
                      {driver.identificationDocUrl && (
                        <a
                          href={driver.identificationDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          ID Document
                        </a>
                      )}
                      {driver.proofOfResidenceDocUrl && (
                        <a
                          href={driver.proofOfResidenceDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Proof of Residence
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Approved drivers ── */}
          <TabsContent value="approved" className="space-y-4 mt-4">
            {approved.length === 0 && (
              <p className="text-center text-gray-500 py-10">No approved drivers yet.</p>
            )}
            {approved.map((driver) => {
              const trips = tripsByDriver[driver.id] || []
              const payout = payoutFor(trips)
              const isExpanded = expandedId === driver.id
              return (
                <Card key={driver.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <button
                      className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : driver.id)}
                    >
                      <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {driver.firstName} {driver.lastName}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {driver.email && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Mail className="h-3 w-3" />
                                {driver.email}
                              </span>
                            )}
                            {driver.phone && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Phone className="h-3 w-3" />
                                {driver.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xl font-bold text-teal-700">R{payout.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">
                            {trips.length} trip{trips.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <>
                        <Separator />
                        <div className="p-5 space-y-4">
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={trips.length === 0}
                              onClick={() => handleDownloadTrips(driver)}
                            >
                              <Download className="h-4 w-4 mr-1.5" />
                              Download Trips CSV
                            </Button>
                          </div>
                          {trips.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No trips yet.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b text-left text-gray-500">
                                    <th className="pb-2 pr-4 font-medium">Date</th>
                                    <th className="pb-2 pr-4 font-medium">Pickup</th>
                                    <th className="pb-2 pr-4 font-medium">Dropoff</th>
                                    <th className="pb-2 pr-4 font-medium">Status</th>
                                    <th className="pb-2 pr-4 text-right font-medium">Price</th>
                                    <th className="pb-2 text-right font-medium">Payout</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {trips.map((trip) => (
                                    <tr key={trip.id} className="border-b last:border-0">
                                      <td className="py-3 pr-4 whitespace-nowrap">{trip.pickupDate}</td>
                                      <td className="py-3 pr-4 max-w-[160px] truncate">{trip.pickupLocation}</td>
                                      <td className="py-3 pr-4 max-w-[160px] truncate">{trip.dropoffLocation}</td>
                                      <td className="py-3 pr-4 whitespace-nowrap">
                                        <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${getStatusBadgeClass(trip.status)}`}>
                                          {getStatusLabel(trip.status)}
                                        </span>
                                      </td>
                                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                                        {isNaN(Number(trip.price)) ? "R—" : `R${Number(trip.price).toFixed(2)}`}
                                      </td>
                                      <td className="py-3 text-right font-medium whitespace-nowrap">
                                        {trip.status === "completed" && !isNaN(Number(trip.price))
                                          ? `R${calculatePayout(trip.price).toFixed(2)}`
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={5} className="pt-3 font-bold text-gray-700">
                                      Total Payout Owed
                                    </td>
                                    <td className="pt-3 text-right font-bold text-teal-700">R{payout.toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          {/* ── Rejected drivers ── */}
          <TabsContent value="rejected" className="space-y-4 mt-4">
            {rejected.length === 0 && (
              <p className="text-center text-gray-500 py-10">No rejected applications.</p>
            )}
            {rejected.map((driver) => (
              <Card key={driver.id}>
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {driver.firstName} {driver.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{driver.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={actionId === driver.id}
                    onClick={() => handleApprove(driver.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Re-approve
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
