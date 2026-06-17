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
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Mail,
  Phone,
  Search,
  Users,
} from "lucide-react"
import LoadingComponent from "@/components/loader"

const ADMIN_EMAILS = ["dimakatso@shuduconnections.com", "tetelo@shuduconnections.com"]

type Trip = {
  id: string
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  price: string
  distance: string
  documentDescription: string
  requestType: string
}

type FirmAccount = {
  userId: string
  firmName: string
  adminName: string
  email: string
  phone: string
  trips: Trip[]
  total: number
}

export default function AdminUnpaidPage() {
  const [accounts, setAccounts] = useState<FirmAccount[]>([])
  const [filtered, setFiltered] = useState<FirmAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
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
        // Fetch all completed unpaid trips
        const tripsSnap = await getDocs(
          query(
            collection(db, "pickupRequests"),
            where("payment_status", "==", "unpaid"),
            where("status", "==", "completed")
          )
        )

        if (tripsSnap.empty) {
          setAccounts([])
          setFiltered([])
          setLoading(false)
          return
        }

        // Group trips by userId
        const byUser: Record<string, Trip[]> = {}
        tripsSnap.docs.forEach((d) => {
          const data = d.data()
          const uid = data.userId
          if (!byUser[uid]) byUser[uid] = []
          byUser[uid].push({ id: d.id, ...data } as Trip)
        })

        // Fetch firm + user info for each userId
        const [firmsSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "firms")),
          getDocs(collection(db, "users")),
        ])

        const firmsById: Record<string, any> = {}
        firmsSnap.docs.forEach((d) => { firmsById[d.id] = d.data() })

        const usersById: Record<string, any> = {}
        usersSnap.docs.forEach((d) => { usersById[d.id] = d.data() })

        const result: FirmAccount[] = Object.entries(byUser).map(([userId, trips]) => {
          const firm = firmsById[userId] || {}
          const user = usersById[userId] || {}
          const total = trips.reduce((sum, t) => sum + parseFloat(t.price || "0"), 0)
          return {
            userId,
            firmName: firm.companyName || firm.firmName || "Unknown Firm",
            adminName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
            email: user.email || firm.email || "",
            phone: user.phone || firm.phone || firm.contactNumber || "",
            trips,
            total,
          }
        })

        // Sort by largest balance first
        result.sort((a, b) => b.total - a.total)

        setAccounts(result)
        setFiltered(result)
      } catch (err) {
        console.error("Admin unpaid: fetch error", err)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    const q = search.toLowerCase()
    if (!q) {
      setFiltered(accounts)
      return
    }
    setFiltered(
      accounts.filter(
        (a) =>
          a.firmName.toLowerCase().includes(q) ||
          a.adminName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
      )
    )
  }, [search, accounts])

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

  const grandTotal = accounts.reduce((sum, a) => sum + a.total, 0)
  const totalTrips = accounts.reduce((n, a) => n + a.trips.length, 0)

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Unpaid Accounts</CardTitle>
          </CardHeader>
          <CardContent className="mt-5">
            {accounts.length === 0 ? (
              <p className="text-gray-500 text-center py-6">All accounts are settled — no outstanding balances.</p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Total Outstanding</p>
                    <p className="text-2xl font-bold text-teal-700">R{grandTotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Accounts</p>
                    <p className="text-2xl font-bold text-gray-800">{accounts.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Unpaid Trips</p>
                    <p className="text-2xl font-bold text-gray-800">{totalTrips}</p>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border border-amber-300 self-start sm:self-auto px-3 py-1 text-sm">
                  Outstanding
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        {accounts.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by firm name, contact, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Account cards */}
        {filtered.map((account) => {
          const isExpanded = expandedId === account.userId
          return (
            <Card key={account.userId} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Account header row */}
                <button
                  className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : account.userId)}
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">{account.firmName}</p>
                      <p className="text-sm text-gray-500">{account.adminName}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {account.email && (
                          <a
                            href={`mailto:${account.email}`}
                            className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3 w-3" />
                            {account.email}
                          </a>
                        )}
                        {account.phone && (
                          <a
                            href={`tel:${account.phone}`}
                            className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3 w-3" />
                            {account.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xl font-bold text-teal-700">R{account.total.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">
                        {account.trips.length} trip{account.trips.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded trip list */}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="p-5">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-gray-500">
                              <th className="pb-2 pr-4 font-medium">Date</th>
                              <th className="pb-2 pr-4 font-medium">Pickup</th>
                              <th className="pb-2 pr-4 font-medium">Dropoff</th>
                              <th className="pb-2 pr-4 font-medium">Type</th>
                              <th className="pb-2 pr-4 font-medium">Distance</th>
                              <th className="pb-2 text-right font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {account.trips.map((trip) => (
                              <tr key={trip.id} className="border-b last:border-0">
                                <td className="py-3 pr-4 whitespace-nowrap">{trip.pickupDate}</td>
                                <td className="py-3 pr-4 max-w-[160px] truncate">{trip.pickupLocation}</td>
                                <td className="py-3 pr-4 max-w-[160px] truncate">{trip.dropoffLocation}</td>
                                <td className="py-3 pr-4 capitalize whitespace-nowrap">
                                  {trip.requestType?.replace(/_/g, " ")}
                                </td>
                                <td className="py-3 pr-4 whitespace-nowrap">{trip.distance} km</td>
                                <td className="py-3 text-right font-medium whitespace-nowrap">
                                  R{parseFloat(trip.price).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={5} className="pt-3 font-bold text-gray-700">
                                Total Due
                              </td>
                              <td className="pt-3 text-right font-bold text-teal-700">
                                R{account.total.toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}

        {filtered.length === 0 && accounts.length > 0 && (
          <p className="text-center text-gray-500 py-6">No accounts match your search.</p>
        )}
      </div>
    </div>
  )
}
