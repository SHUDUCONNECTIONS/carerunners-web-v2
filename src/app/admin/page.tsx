// @ts-nocheck
"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/utils/firebase"
import { ADMIN_EMAILS } from "@/utils/adminEmails"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Car, ClipboardList, DollarSign, FileText, RefreshCw, type LucideIcon } from "lucide-react"
import LoadingComponent from "@/components/loader"

type AdminTool = {
  icon: LucideIcon
  title: string
  description: string
  href: string
}

const adminTools: AdminTool[] = [
  {
    icon: ClipboardList,
    title: "Requested Trips",
    description: "View trips customers have booked and paid for that are still waiting on a driver.",
    href: "/admin/requests",
  },
  {
    icon: Car,
    title: "Driver Management",
    description: "Review, approve, or reject driver applications and view driver payouts.",
    href: "/admin/drivers",
  },
  {
    icon: DollarSign,
    title: "Unpaid Accounts",
    description: "View customer and firm accounts with outstanding balances.",
    href: "/admin/unpaid",
  },
  {
    icon: RefreshCw,
    title: "Fix Trip Prices",
    description: "Recalculate and repair trip prices across the platform.",
    href: "/admin/sync",
  },
  {
    icon: FileText,
    title: "Monthly Trip Reports",
    description: "Download each driver's trip history for a given month.",
    href: "/admin/reports",
  },
]

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/auth/login")
        return
      }

      if (!ADMIN_EMAILS.includes(user.email ?? "")) {
        setAccessDenied(true)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return <LoadingComponent />
  }

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
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin</h1>
          <p className="text-sm text-gray-500">Tools available to platform administrators.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {adminTools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link key={tool.href} href={tool.href}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500">{tool.description}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
