"use client"
import { useEffect } from "react"

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let registration: ServiceWorkerRegistration | undefined
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        registration = reg
      })
      .catch(() => {})

    // Pick up a new version of the app soon after the user returns to it.
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {})
    }
    document.addEventListener("visibilitychange", checkForUpdate)
    return () => document.removeEventListener("visibilitychange", checkForUpdate)
  }, [])
  return null
}
