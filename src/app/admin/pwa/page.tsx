"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { authedFetch } from "@/utils/authedFetch"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, Download, Smartphone } from "lucide-react"
import LoadingComponent from "@/components/loader"

interface Stats {
  devicesSeen: number
  installed: number
  active7: number
  active30: number
  launches: number
  promptShown: number
  promptAccepted: number
  promptDismissed: number
  byPlatform: Record<string, number>
}

const PLATFORM_LABELS: Record<string, string> = { android: "Android", ios: "iPhone / iPad", desktop: "Desktop", other: "Other" }

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminPwaPage() {
  const { loading: authLoading, denied } = useAdminGuard()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading || denied) return
    authedFetch("/api/admin/pwa-stats")
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || "Couldn't load install stats.")
        setStats(data)
      })
      .catch((err) => setError(err.message))
  }, [authLoading, denied])

  if (authLoading || (!stats && !error && !denied)) return <LoadingComponent />

  if (denied) {
    return (
      <div className="mx-auto max-w-xl space-y-2 py-12 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <p>You don&apos;t have access to this page.</p>
      </div>
    )
  }

  const rate = stats && stats.promptShown > 0 ? Math.round((stats.promptAccepted / stats.promptShown) * 100) : null

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <Link href="/admin" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" /> Admin
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Smartphone className="h-6 w-6" /> App installs
        </h1>
        <p className="text-sm text-gray-600">
          Anonymous counts of devices that installed Care Runners to their home screen. No names or accounts are stored.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Installed devices" value={stats.installed} hint="Opened from the home screen at least once" />
            <Stat label="Active, last 7 days" value={stats.active7} />
            <Stat label="Active, last 30 days" value={stats.active30} />
            <Stat label="Home-screen launches" value={stats.launches} hint="Once per visit" />
          </div>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <Download className="h-4 w-4" /> Install prompt
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-gray-500">Shown to</p>
                  <p className="text-xl font-bold">{stats.promptShown}</p>
                </div>
                <div>
                  <p className="text-gray-500">Installed from it</p>
                  <p className="text-xl font-bold">{stats.promptAccepted}</p>
                </div>
                <div>
                  <p className="text-gray-500">Dismissed</p>
                  <p className="text-xl font-bold">{stats.promptDismissed}</p>
                </div>
                <div>
                  <p className="text-gray-500">Acceptance rate</p>
                  <p className="text-xl font-bold">{rate === null ? "N/A" : `${rate}%`}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Devices seen in total: {stats.devicesSeen}. People can also install from the browser menu or the footer link without
                using the prompt, so installs can be higher than "installed from it".
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-bold">Installed devices by platform</h2>
              {Object.entries(stats.byPlatform).map(([key, n]) => (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-gray-700">{PLATFORM_LABELS[key] ?? key}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[var(--brand-600)]"
                      style={{ width: `${stats.installed ? (n / stats.installed) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-semibold">{n}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
