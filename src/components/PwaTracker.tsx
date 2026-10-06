"use client"

import { useEffect } from "react"
import { isStandalone } from "@/components/InstallPrompt"
import { PWA_TRACK_EVENT, type PwaEventType, type PwaPlatform } from "@/lib/pwa"

const DEVICE_KEY = "pwa-device-id"
const INSTALL_REPORTED_KEY = "pwa-install-reported"
const LAUNCH_SESSION_KEY = "pwa-launch-reported"

function platform(): PwaPlatform {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return "android"
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios"
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop"
  return "other"
}

// A random id kept on the device. It identifies a phone or browser, never a person.
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return ""
  }
}

function send(type: PwaEventType) {
  const id = deviceId()
  if (!id) return
  fetch("/api/pwa/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: id, type, platform: platform() }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never get in the user's way.
  })
}

// Anonymous install analytics: prompt shown/accepted/dismissed, installs, and
// launches from the home screen. Mounted once in the root layout.
export default function PwaTracker() {
  useEffect(() => {
    if (isStandalone()) {
      // Running as an installed app proves it's installed (iOS and desktop
      // never fire "appinstalled"), and counts as one launch per session.
      try {
        if (!localStorage.getItem(INSTALL_REPORTED_KEY)) {
          localStorage.setItem(INSTALL_REPORTED_KEY, "1")
          send("installed")
        }
        if (!sessionStorage.getItem(LAUNCH_SESSION_KEY)) {
          sessionStorage.setItem(LAUNCH_SESSION_KEY, "1")
          send("launch")
        }
      } catch {
        send("launch")
      }
    }

    const onInstalled = () => {
      try {
        localStorage.setItem(INSTALL_REPORTED_KEY, "1")
      } catch {
        // ignore
      }
      send("installed")
    }
    const onTrack = (e: Event) => send((e as CustomEvent<PwaEventType>).detail)

    window.addEventListener("appinstalled", onInstalled)
    window.addEventListener(PWA_TRACK_EVENT, onTrack)
    return () => {
      window.removeEventListener("appinstalled", onInstalled)
      window.removeEventListener(PWA_TRACK_EVENT, onTrack)
    }
  }, [])

  return null
}
