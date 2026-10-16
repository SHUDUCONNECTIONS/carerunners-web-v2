"use client"

import { useEffect, useState } from "react"
import { X, Download, Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PWA_TRACK_EVENT, type PwaEventType } from "@/lib/pwa"
import { INSTALL_STEPS, SHOW_STEPS_UNASKED, installHelpFor, type InstallHelp } from "@/lib/installHelp"

const DISMISSED_KEY = "install-dismissed-at"
const SNOOZE_DAYS = 14

// Sent by the "Install app" buttons (see InstallButton).
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
  // The browser's own install prompt is ready (Chrome, Edge, Samsung Internet...): the banner shows an Install button.
  const [showNative, setShowNative] = useState(false)
  // Otherwise the banner shows the steps for this browser (see src/lib/installHelp.ts).
  const [steps, setSteps] = useState<InstallHelp | null>(null)

  const install = async (prompt: any) => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") {
      track("prompt_accepted")
      setShowNative(false)
    }
    window.__installPrompt = undefined
    setDeferredPrompt(null)
  }

  useEffect(() => {
    if (isStandalone()) return // already installed and running as an app

    const help = installHelpFor(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
    // Phones that never offer an install prompt get the steps straight away.
    if (SHOW_STEPS_UNASKED.includes(help) && !snoozed()) setSteps(help)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      window.__installPrompt = e
      setDeferredPrompt(e)
      setSteps(null)
      if (!snoozed()) setShowNative(true)
    }
    const onInstalled = () => {
      window.__installPrompt = undefined
      setDeferredPrompt(null)
      setShowNative(false)
      setSteps(null)
    }
    // An "Install app" button asks: the browser's prompt if it has one, otherwise the steps.
    const onRequest = () => {
      if (window.__installPrompt) install(window.__installPrompt)
      else setSteps(installHelpFor(navigator.userAgent, navigator.platform, navigator.maxTouchPoints))
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
    setShowNative(false)
    setSteps(null)
  }

  // Count each device once when the banner is first shown to it.
  const visible = showNative || steps !== null
  useEffect(() => {
    if (visible) track("prompt_shown")
  }, [visible])

  if (!visible) return null

  return (
    // Sits above the round theme button in the bottom-right corner (bottom-4, 44px tall) so neither covers the other.
    <div className="fixed left-4 right-4 z-50 mx-auto max-w-sm" style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}>
      <div role="dialog" aria-label="Install Care Runners" className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <img src="/icons/icon-192.png" alt="Care Runners" className="h-10 w-10 shrink-0 rounded-lg border border-gray-100" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Install Care Runners</p>
            {steps ? (
              <p className="mt-0.5 text-xs text-gray-600">
                {steps === "ios" && <Share className="mr-1 inline h-3.5 w-3.5 text-blue-500" aria-hidden="true" />}
                {INSTALL_STEPS[steps]}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">Add it to your home screen for quick access, even faster than the browser.</p>
            )}
          </div>
          <button onClick={dismiss} className="shrink-0 text-gray-400 hover:text-gray-600" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
        {showNative && deferredPrompt && !steps && (
          <Button onClick={() => install(deferredPrompt)} size="sm" className="mt-3 w-full">
            <Download className="mr-1.5 h-4 w-4" /> Install
          </Button>
        )}
      </div>
    </div>
  )
}
