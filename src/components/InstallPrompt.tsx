"use client"

import { useEffect, useState } from "react"
import { X, Download, Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PWA_TRACK_EVENT, type PwaEventType } from "@/lib/pwa"

const DISMISSED_KEY = "install-dismissed-at"
const SNOOZE_DAYS = 14

// Shared with the footer's "Install app" button (see InstallButton).
export const INSTALL_AVAILABLE_EVENT = "carerunners:install-available"
export const INSTALL_REQUEST_EVENT = "carerunners:install"

declare global {
  interface Window {
    __installPrompt?: any
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  // iPadOS 13+ reports a desktop Safari/Mac user agent by default (no "iPad"
  // substring), so also catch the touch-capable + MacIntel combo real Macs don't have.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function track(type: PwaEventType) {
  window.dispatchEvent(new CustomEvent(PWA_TRACK_EVENT, { detail: type }))
}

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return Boolean(at) && Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  const install = async (prompt: any) => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") {
      track("prompt_accepted")
      setShowAndroid(false)
    }
    window.__installPrompt = undefined
    setDeferredPrompt(null)
  }

  useEffect(() => {
    if (isStandalone()) return // already installed and running as an app

    // iOS never fires beforeinstallprompt; it needs manual instructions.
    if (isIOS() && !snoozed()) setShowIOS(true)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      window.__installPrompt = e
      setDeferredPrompt(e)
      window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT))
      if (!snoozed()) setShowAndroid(true)
    }
    const onInstalled = () => {
      window.__installPrompt = undefined
      setDeferredPrompt(null)
      setShowAndroid(false)
      setShowIOS(false)
    }
    // The footer's "Install app" button asks for the prompt (or the iOS steps).
    const onRequest = () => {
      if (window.__installPrompt) {
        install(window.__installPrompt)
      } else if (isIOS()) {
        setShowIOS(true)
      }
    }

    if (window.__installPrompt) setDeferredPrompt(window.__installPrompt)
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    window.addEventListener(INSTALL_REQUEST_EVENT, onRequest)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
      window.removeEventListener(INSTALL_REQUEST_EVENT, onRequest)
    }
  }, [])

  const dismiss = () => {
    track("prompt_dismissed")
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // Private mode etc.: the prompt just reappears next visit.
    }
    setShowAndroid(false)
    setShowIOS(false)
  }

  // Count each device once when the banner is first shown to it.
  const visible = showAndroid || showIOS
  useEffect(() => {
    if (visible) track("prompt_shown")
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <img src="/icons/icon-192.png" alt="Care Runners" className="h-10 w-10 shrink-0 rounded-lg border border-gray-100" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Install Care Runners</p>
            {showIOS ? (
              <p className="mt-0.5 text-xs text-gray-500">
                Tap <Share className="mx-0.5 inline h-3.5 w-3.5 text-blue-500" /> then <strong>Add to Home Screen</strong> to
                install.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">Add it to your home screen for quick access, even faster than the browser.</p>
            )}
          </div>
          <button onClick={dismiss} className="shrink-0 text-gray-400 hover:text-gray-600" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
        {showAndroid && deferredPrompt && (
          <Button onClick={() => install(deferredPrompt)} size="sm" className="mt-3 w-full">
            <Download className="mr-1.5 h-4 w-4" /> Install
          </Button>
        )}
      </div>
    </div>
  )
}
