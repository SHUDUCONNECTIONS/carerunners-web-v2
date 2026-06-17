"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Package,
  Upload,
  Briefcase,
  CreditCard,
  Users,
  User,
  AlertCircle,
  Wallet,
  Clock,
  CalendarCheck,
} from "lucide-react"
import Link from "next/link"
import { auth, db } from "@/utils/firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore"

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardItem {
  icon: React.ReactNode
  label: string
  description: string
  link: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [outstandingAmount, setOutstandingAmount] = useState<number | null>(null)
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [tripsThisMonth, setTripsThisMonth] = useState(0)
  const [firstName, setFirstName] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return

      // Fetch user's first name from the `users` collection
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          setFirstName(data?.firstName ?? null)
        }
      } catch (err) {
        console.error("Dashboard: failed to fetch user profile", err)
      }

      // Fetch outstanding balance (unpaid + completed trips)
      try {
        const q = query(
          collection(db, "pickupRequests"),
          where("userId", "==", user.uid),
          where("payment_status", "==", "unpaid")
        )
        const snapshot = await getDocs(q)
        const completedUnpaid = snapshot.docs.filter(
          (d) => d.data().status === "completed"
        )
        const total = completedUnpaid.reduce(
          (sum, d) => sum + parseFloat(d.data().price || "0"),
          0
        )
        setOutstandingAmount(total)
        setUnpaidCount(completedUnpaid.length)
      } catch (err) {
        console.error("Dashboard: failed to fetch outstanding balance", err)
      }

      // Fetch trip count for the current month
      try {
        const startOfMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        )
          .toISOString()
          .split("T")[0]

        const monthQ = query(
          collection(db, "pickupRequests"),
          where("userId", "==", user.uid),
          where("pickupDate", ">=", startOfMonth)
        )
        const monthSnapshot = await getDocs(monthQ)
        setTripsThisMonth(monthSnapshot.size)
      } catch (err) {
        console.error("Dashboard: failed to fetch monthly trip count", err)
      }
    })
    return () => unsubscribe()
  }, [])

  const dashboardItems: DashboardItem[] = [
    {
      icon: <Package className="h-6 w-6 text-teal-600" />,
      label: "Request Pickup",
      description: "Schedule a new medical transport pickup.",
      link: "/request",
    },
    {
      icon: <Upload className="h-6 w-6 text-teal-600" />,
      label: "Upload Case File",
      description: "Attach documents to an existing case.",
      link: "/upload",
    },
    {
      icon: <Briefcase className="h-6 w-6 text-teal-600" />,
      label: "Firm Records",
      description: "View and manage your firm's records.",
      link: "/records",
    },
    {
      icon: <User className="h-6 w-6 text-teal-600" />,
      label: "Account Profile",
      description: "Update your personal account details.",
      link: "/profile",
    },
    {
      icon: <Users className="h-6 w-6 text-teal-600" />,
      label: "Membership Access",
      description: "Explore plans and upgrade your membership.",
      link: "/pricing",
    },
    {
      icon: <CreditCard className="h-6 w-6 text-teal-600" />,
      label: "Trips Information",
      description: "Review your trip history and details.",
      link: "/trips",
    },
  ]

  const hasOutstanding = outstandingAmount !== null && outstandingAmount > 0
  const displayName = firstName ?? "there"

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* ── Greeting section ─────────────────────────────────────────── */}
        <div className="mb-8 mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {getGreeting()},{" "}
            <span className="text-teal-600">{displayName}</span>
          </h1>
          <p className="mt-1 text-gray-500 text-sm sm:text-base">
            Here&apos;s an overview of your Carerunners account.
          </p>
        </div>

        {/* ── Quick stats row ──────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-teal-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Outstanding Balance</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(outstandingAmount ?? 0)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-teal-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Awaiting Payment</p>
              <p className="text-xl font-bold text-gray-900">
                {unpaidCount} trip{unpaidCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <CalendarCheck className="h-5 w-5 text-teal-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Trips This Month</p>
              <p className="text-xl font-bold text-gray-900">{tripsThisMonth}</p>
            </div>
          </div>
        </div>

        {/* ── Outstanding balance alert ─────────────────────────────────── */}
        {hasOutstanding && (
          <div
            role="alert"
            className="mb-8 rounded-xl border border-amber-200 bg-amber-50 border-l-4 border-l-teal-600 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-0.5">
                    Outstanding Balance
                  </p>
                  <p className="text-3xl font-extrabold text-amber-800 leading-none">
                    {formatCurrency(outstandingAmount!)}
                  </p>
                  <p className="text-sm text-amber-700 mt-1.5">
                    You have{" "}
                    <span className="font-semibold">{unpaidCount}</span>{" "}
                    completed trip{unpaidCount !== 1 ? "s" : ""} awaiting
                    payment.
                  </p>
                </div>
              </div>
              <Link href="/billing" className="shrink-0 w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2">
                  Pay Now
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Action cards grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {dashboardItems.map((item, index) => (
            <Link
              key={index}
              href={item.link}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <div
                className="
                  h-full bg-white rounded-2xl border border-gray-100 shadow-sm
                  p-6 flex flex-col gap-4
                  hover:-translate-y-0.5 hover:shadow-md hover:border-teal-100 transition-all duration-200
                "
              >
                {/* Icon box */}
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <p className="text-base font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* CTA */}
                <span className="text-sm font-semibold text-teal-600 group-hover:underline">
                  Open &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
