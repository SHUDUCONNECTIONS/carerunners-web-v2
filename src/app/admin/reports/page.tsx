// @ts-nocheck
"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { collection, getDocs } from "firebase/firestore"
import { auth, db } from "@/utils/firebase"
import { ADMIN_EMAILS } from "@/utils/adminEmails"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Download, FileText } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { calculatePayout } from "@/lib/pricing"
import { getStatusLabel } from "@/lib/tripStatus"

type Driver = {
  id: string
  firstName: string
  lastName: string
  email: string
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

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function tripRow(driverName: string, t: DriverTrip): (string | number)[] {
  return [
    driverName,
    t.pickupDate || "",
    t.pickupTime || "",
    t.pickupLocation || "",
    t.dropoffLocation || "",
    t.requestType?.replace(/_/g, " ") || "",
    t.distance || "",
    getStatusLabel(t.status),
    t.price ? Number(t.price).toFixed(2) : "",
    t.status === "completed" && t.price ? calculatePayout(t.price).toFixed(2) : "",
  ]
}

const CSV_HEADER = [
  "Driver",
  "Date",
  "Time",
  "Pickup",
  "Dropoff",
  "Type",
  "Distance (km)",
  "Status",
  "Trip Price (R)",
  "Driver Payout (R)",
]

export default function AdminReportsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [tripsByDriver, setTripsByDriver] = useState<Record<string, DriverTrip[]>>({})
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [month, setMonth] = useState(currentMonth())
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

        setDrivers(driversSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Driver)))

        const byDriver: Record<string, DriverTrip[]> = {}
        tripsSnap.docs.forEach((d) => {
          const data = d.data()
          if (!data.driverId) return
          if (!byDriver[data.driverId]) byDriver[data.driverId] = []
          byDriver[data.driverId].push({ id: d.id, ...data } as DriverTrip)
        })
        setTripsByDriver(byDriver)
      } catch (err) {
        console.error("Admin reports: fetch error", err)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const monthlySummary = useMemo(() => {
    return drivers
      .map((driver) => {
        const trips = (tripsByDriver[driver.id] || []).filter((t) => t.pickupDate?.startsWith(month))
        const completed = trips.filter((t) => t.status === "completed")
        const payout = completed.reduce((sum, t) => sum + calculatePayout(t.price || 0), 0)
        return { driver, trips, payout }
      })
      .filter((row) => row.trips.length > 0)
      .sort((a, b) => `${a.driver.firstName} ${a.driver.lastName}`.localeCompare(`${b.driver.firstName} ${b.driver.lastName}`))
  }, [drivers, tripsByDriver, month])

  const handleDownloadDriver = (driver: Driver, trips: DriverTrip[]) => {
    const name = `${driver.firstName} ${driver.lastName}`.trim() || driver.id
    const rows = [CSV_HEADER, ...trips.map((t) => tripRow(name, t))]
    downloadCSV(`${name.replace(/\s+/g, "-")}-${month}-trips.csv`, rows)
  }

  const handleDownloadAll = () => {
    const rows = [CSV_HEADER]
    monthlySummary.forEach(({ driver, trips }) => {
      const name = `${driver.firstName} ${driver.lastName}`.trim() || driver.id
      trips.forEach((t) => rows.push(tripRow(name, t)))
    })
    downloadCSV(`all-drivers-${month}-trips.csv`, rows)
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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Monthly Trip Reports</CardTitle>
          </CardHeader>
          <CardContent className="mt-5 space-y-4">
            <p className="text-sm text-gray-500">
              Download each driver&apos;s trip history for a given month, or export every driver at once.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1">
                  Month
                </label>
                <Input
                  type="month"
                  className="bg-white w-48"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={monthlySummary.length === 0}
                onClick={handleDownloadAll}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Download All Drivers
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {monthlySummary.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                No driver trips found for this month.
              </CardContent>
            </Card>
          ) : (
            monthlySummary.map(({ driver, trips, payout }) => {
              const name = `${driver.firstName} ${driver.lastName}`.trim() || driver.id
              return (
                <Card key={driver.id}>
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">{driver.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {trips.length} trip{trips.length !== 1 ? "s" : ""} · Payout owed R{payout.toFixed(2)}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => handleDownloadDriver(driver, trips)}>
                      <Download className="h-4 w-4 mr-1.5" />
                      Download CSV
                    </Button>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
