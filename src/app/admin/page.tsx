"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore"
import { db } from "@/utils/firebase"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { saDay, SA_TIME_ZONE } from "@/lib/saDate"
import { MARKET_ORDERS } from "@/lib/marketplace"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowRight, Car, CheckCircle2, ClipboardList, Clock, FileText, RefreshCw, Smartphone, Store, type LucideIcon } from "lucide-react"
import { RandIcon } from "@/components/RandIcon"
import LoadingComponent from "@/components/loader"

// Same-day delivery is only offered for bookings made before 10:00 SA time.
const SAME_DAY_CUTOFF_HOUR = 10
const ON_THE_ROAD = ["assigned", "picked-up", "in-transit"]
const DONE = ["delivered", "completed"]
const REFRESH_MS = 60_000

type Stats = {
  today: { waiting: number; onTheRoad: number; delivered: number } | null
  waitingAll: number | null
  driverApplications: number | null
  unpaid: { trips: number; total: number } | null
  marketOrders: number | null
}

const NO_STATS: Stats = { today: null, waitingAll: null, driverApplications: null, unpaid: null, marketOrders: null }

// Each number is fetched on its own, so one failing query (a missing index, say) only blanks that number.
async function loadStats(): Promise<Stats> {
  const trips = collection(db, "pickupRequests")
  const today = saDay()
  const safe = <T,>(p: Promise<T>) => p.catch((err) => { console.error("Admin home:", err); return null })

  const [todaySnap, waitingAll, driversSnap, unpaidSnap, marketOrders] = await Promise.all([
    safe(getDocs(query(trips, where("pickupDate", "==", today)))),
    // Trips dated before today can't be delivered any more, so only today's and later ones count (as on Requested Trips).
    safe(getDocs(query(trips, where("status", "==", "pending"))).then((s) => s.docs.filter((d) => !(d.data().pickupDate < today)).length)),
    safe(getDocs(collection(db, "drivers"))),
    safe(getDocs(query(trips, where("payment_status", "==", "unpaid"), where("status", "==", "completed")))),
    safe(getCountFromServer(query(collection(db, MARKET_ORDERS), where("status", "==", "paid"))).then((s) => s.data().count)),
  ])

  const todays = todaySnap?.docs.map((d) => d.data().status as string)
  return {
    today: todays
      ? {
          waiting: todays.filter((s) => s === "pending").length,
          onTheRoad: todays.filter((s) => ON_THE_ROAD.includes(s)).length,
          delivered: todays.filter((s) => DONE.includes(s)).length,
        }
      : null,
    waitingAll,
    // Same rule as Driver Management: not rejected and not yet approved.
    driverApplications: driversSnap ? driversSnap.docs.filter((d) => !d.data().isApproved && d.data().applicationStatus !== "rejected").length : null,
    unpaid: unpaidSnap
      ? { trips: unpaidSnap.size, total: unpaidSnap.docs.reduce((sum, d) => sum + (parseFloat(d.data().price) || 0), 0) }
      : null,
    marketOrders,
  }
}

const rand = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA")

// Colours per area: trips teal, drivers amber, money rose, MarketPortal violet.
const TONES = {
  teal: { tile: "bg-teal-50 text-teal-700", ring: "hover:border-teal-300" },
  amber: { tile: "bg-amber-50 text-amber-600", ring: "hover:border-amber-300" },
  rose: { tile: "bg-rose-50 text-rose-600", ring: "hover:border-rose-300" },
  violet: { tile: "bg-violet-50 text-violet-600", ring: "hover:border-violet-300" },
  slate: { tile: "bg-gray-100 text-gray-600", ring: "hover:border-gray-300" },
}
type Tone = keyof typeof TONES

type Tool = {
  icon: LucideIcon | typeof RandIcon
  title: string
  description: string
  href: string
  tone: Tone
  // The live figure on the card: what it counts, and how many are waiting on someone (0 = all clear).
  figure?: (s: Stats) => { value: string; label: string; pending: number } | null
}

const DAILY: Tool[] = [
  {
    icon: ClipboardList, title: "Requested Trips", href: "/admin/requests", tone: "teal",
    description: "Paid trips still waiting for a driver.",
    figure: (s) => (s.waitingAll === null ? null : { value: String(s.waitingAll), label: "waiting for a driver", pending: s.waitingAll }),
  },
  {
    icon: Car, title: "Driver Management", href: "/admin/drivers", tone: "amber",
    description: "Approve new drivers and see driver payouts.",
    figure: (s) => (s.driverApplications === null ? null : { value: String(s.driverApplications), label: s.driverApplications === 1 ? "application to review" : "applications to review", pending: s.driverApplications }),
  },
  {
    icon: RandIcon, title: "Unpaid Accounts", href: "/admin/unpaid", tone: "rose",
    description: "Customers and firms with money owing.",
    figure: (s) => (s.unpaid === null ? null : { value: rand(s.unpaid.total), label: `owing on ${s.unpaid.trips} ${s.unpaid.trips === 1 ? "trip" : "trips"}`, pending: s.unpaid.trips }),
  },
]

const MARKET: Tool = {
  icon: Store, title: "MarketPortal", href: "/admin/marketplace", tone: "violet",
  description: "Add companies, list items for them, and manage orders and company payouts.",
  figure: (s) => (s.marketOrders === null ? null : { value: String(s.marketOrders), label: s.marketOrders === 1 ? "paid order to send" : "paid orders to send", pending: s.marketOrders }),
}

const OTHER: Tool[] = [
  { icon: RefreshCw, title: "Fix Trip Prices", href: "/admin/sync", tone: "slate", description: "Recalculate and repair trip prices." },
  { icon: FileText, title: "Monthly Trip Reports", href: "/admin/reports", tone: "slate", description: "Each driver's trips for a month." },
  { icon: Smartphone, title: "App installs", href: "/admin/pwa", tone: "slate", description: "Home-screen installs and opens." },
]

function Status({ pending }: { pending: number }) {
  return pending > 0 ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Needs attention
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
      <CheckCircle2 className="h-3.5 w-3.5" />
      All clear
    </span>
  )
}

function ToolCard({ tool, stats, wide = false }: { tool: Tool; stats: Stats; wide?: boolean }) {
  const Icon = tool.icon
  const tone = TONES[tool.tone]
  const figure = tool.figure?.(stats)
  const urgent = (figure?.pending ?? 0) > 0
  return (
    <Link
      href={tool.href}
      className={`group flex h-full flex-col rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${tone.ring} ${
        urgent ? "border-amber-200" : "border-gray-200"
      } ${wide ? "sm:flex-row sm:items-center sm:gap-6" : ""}`}
    >
      <div className={`flex items-start justify-between gap-3 ${wide ? "sm:flex-1" : ""}`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.tile}`}>
            <Icon className="h-5 w-5" />
          </span>
          {wide && (
            <div>
              <p className="font-semibold text-gray-900">{tool.title}</p>
              <p className="text-sm text-gray-500">{tool.description}</p>
            </div>
          )}
        </div>
        {!wide && <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-600" />}
      </div>

      {!wide && (
        <div className="mt-4">
          <p className="font-semibold text-gray-900">{tool.title}</p>
          <p className="text-sm text-gray-500">{tool.description}</p>
        </div>
      )}

      <div className={`mt-5 flex items-end justify-between gap-3 ${wide ? "sm:mt-0 sm:shrink-0 sm:gap-6" : "mt-auto pt-5"}`}>
        <div>
          <p className="text-2xl font-bold tabular-nums text-gray-900">{figure ? figure.value : "—"}</p>
          <p className="text-xs text-gray-500">{figure ? figure.label : "Loading…"}</p>
        </div>
        <div className="flex items-center gap-3">
          {figure && <Status pending={figure.pending} />}
          {wide && <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-600" />}
        </div>
      </div>
    </Link>
  )
}

export default function AdminHomePage() {
  const { loading, denied, user } = useAdminGuard()
  const router = useRouter()
  const [stats, setStats] = useState<Stats>(NO_STATS)
  const [fetching, setFetching] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  // Set after mounting (and every minute), so the server and browser render the same thing.
  const [now, setNow] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setFetching(true)
    setStats(await loadStats())
    setUpdatedAt(new Date())
    setFetching(false)
  }, [])

  useEffect(() => {
    if (loading || denied) return
    refresh()
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [loading, denied, refresh])

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingComponent />

  if (denied) {
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

  // Hours and minutes in SA time, for the greeting and the same-day cutoff.
  const [hour, minute] = now
    ? new Intl.DateTimeFormat("en-GB", { timeZone: SA_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":").map(Number)
    : [12, 0]
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const name = (user?.displayName || user?.email?.split("@")[0] || "").split(" ")[0]
  const dateLabel = now ? new Intl.DateTimeFormat("en-ZA", { timeZone: SA_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(now) : ""
  const minutesLeft = SAME_DAY_CUTOFF_HOUR * 60 - (hour * 60 + minute)

  const today = stats.today
  const summary = [
    { label: "Waiting for a driver", value: today?.waiting },
    { label: "On the road", value: today?.onTheRoad },
    { label: "Delivered", value: today?.delivered },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Today at a glance */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white shadow-md sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5" aria-hidden="true" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-teal-100">{dateLabel}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {greeting}{name ? `, ${name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-teal-100">Here&apos;s how today is going.</p>
          </div>
          {now && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              <Clock className="h-3.5 w-3.5" />
              {minutesLeft > 0
                ? `Same-day bookings close in ${Math.floor(minutesLeft / 60) ? `${Math.floor(minutesLeft / 60)}h ` : ""}${minutesLeft % 60}m`
                : "Same-day bookings closed at 10:00"}
            </span>
          )}
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {summary.map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-2xl font-bold tabular-nums sm:text-3xl">{s.value ?? "—"}</p>
              <p className="text-xs text-teal-100">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Daily work */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Daily work</h2>
          <button
            onClick={refresh}
            disabled={fetching}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}` : "Loading"}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {DAILY.map((tool) => (
            <ToolCard key={tool.href} tool={tool} stats={stats} />
          ))}
        </div>
        <ToolCard tool={MARKET} stats={stats} wide />
      </section>

      {/* Occasional tools */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Other tools</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {OTHER.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-md"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[tool.tone].tile}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{tool.title}</span>
                  <span className="block truncate text-xs text-gray-500">{tool.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-600" />
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
