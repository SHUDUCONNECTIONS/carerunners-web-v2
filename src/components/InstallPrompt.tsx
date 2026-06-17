"use client"

import { useEffect, useState } from "react"
import { X, Download, Share } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    if (localStorage.getItem("install-dismissed")) return

    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as any).standalone

    if (isIOS) {
      setShowIOS(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroid(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShowAndroid(false)
    }
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    localStorage.setItem("install-dismissed", "1")
    setShowAndroid(false)
    setShowIOS(false)
  }

  if (!showAndroid && !showIOS) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <img src="/carerunnerlogo.png" alt="Carerunners" className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Install Carerunners</p>
            {showIOS ? (
              <p className="text-xs text-gray-500 mt-0.5">
                Tap <Share className="inline h-3.5 w-3.5 mx-0.5 text-blue-500" /> then{" "}
                <strong>Add to Home Screen</strong> to install.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                Add to your home screen for quick access.
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showAndroid && (
          <Button
            onClick={handleInstall}
            className="mt-3 w-full bg-teal-600 hover:bg-teal-700 text-white h-9 text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
        )}
      </div>
    </div>
  )
}
