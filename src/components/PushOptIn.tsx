"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/utils/firebase"
import { disablePush, enablePush, pushConfigured, pushSupported, refreshPush } from "@/utils/pushClient"
import { isIOS, isStandalone } from "@/components/InstallPrompt"

type State = "hidden" | "off" | "on" | "blocked" | "install" | "working"

const COPY = {
  rider: {
    off: "Get notified when your runner is assigned, picks up and delivers.",
    on: "On. We'll notify you when your runner is assigned, picks up and delivers.",
  },
  driver: {
    off: "Get an alert on this phone if a trip you've accepted is cancelled, even when the app is closed.",
    on: "On. You'll get an alert if a trip you've accepted is cancelled.",
  },
}

// "Turn on trip alerts" card. Hidden on browsers that can't do push and until the Firebase web push key is set.
export default function PushOptIn({ audience = "rider", className = "mb-8" }: { audience?: "rider" | "driver"; className?: string }) {
  const [state, setState] = useState<State>("hidden")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !pushConfigured) return
      // iPhones only allow push for an app that has been added to the home screen.
      if (isIOS() && !isStandalone()) return setState("install")
      if (!(await pushSupported()) || cancelled) return
      if (Notification.permission === "denied") return setState("blocked")
      if (Notification.permission === "default") return setState("off")
      try {
        setState((await refreshPush()) ? "on" : "off")
      } catch {
        setState("off")
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  if (state === "hidden") return null

  const turnOn = async () => {
    setError("")
    setState("working")
    try {
      setState((await enablePush()) === "enabled" ? "on" : "blocked")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setState("off")
    }
  }

  const turnOff = async () => {
    setState("working")
    await disablePush()
    setState("off")
  }

  const copy = COPY[audience]
  const showButton = state === "off" || state === "on" || state === "working"

  return (
    <div className={`${className} flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex items-start gap-3">
        {state === "blocked" ? (
          <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        ) : (
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900">Trip alerts</p>
          <p className="text-sm text-gray-500">
            {state === "on" && copy.on}
            {(state === "off" || state === "working") && copy.off}
            {state === "blocked" && "Notifications are blocked for this site. Turn them on in your browser's site settings."}
            {state === "install" &&
              "To get alerts on iPhone, add Care Runners to your Home Screen first: tap the Share button, then “Add to Home Screen”, and open the app from there."}
          </p>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      </div>
      {showButton && (
        <button
          type="button"
          onClick={state === "on" ? turnOff : turnOn}
          disabled={state === "working"}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
            state === "on" ? "border border-gray-200 text-gray-700 hover:bg-gray-50" : "bg-teal-600 text-white hover:bg-teal-700"
          }`}
        >
          {state === "on" ? "Turn off" : state === "working" ? "Working…" : "Turn on alerts"}
        </button>
      )}
    </div>
  )
}
