"use client"

import { useEffect } from "react"
import { WifiOff } from "lucide-react"

// Shown by the service worker when a page is opened without a connection.
export default function OfflinePage() {
  useEffect(() => {
    // Come back to life as soon as the connection returns.
    const reload = () => window.location.reload()
    window.addEventListener("online", reload)
    return () => window.removeEventListener("online", reload)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 p-6 text-center">
      <img src="/icons/icon-192.png" alt="Care Runners" className="h-24 w-24 rounded-2xl border border-slate-100 bg-white shadow-sm" />
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        <WifiOff className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">You&apos;re offline</h1>
        <p className="max-w-sm text-slate-600">
          Care Runners needs an internet connection to book trips and show live updates. Check your connection and try
          again.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
      >
        Try again
      </button>
    </main>
  )
}
