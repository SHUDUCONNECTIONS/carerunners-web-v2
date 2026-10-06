"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { INSTALL_AVAILABLE_EVENT, INSTALL_REQUEST_EVENT, isIOS, isStandalone } from "@/components/InstallPrompt"

// A permanent "Install app" link (used in the footer) for people who dismissed
// the banner. Only shown when installing is actually possible.
export default function InstallButton({ className }: { className?: string }) {
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    const check = () => setCanInstall(Boolean(window.__installPrompt) || isIOS())
    check()
    const onInstalled = () => setCanInstall(false)
    window.addEventListener(INSTALL_AVAILABLE_EVENT, check)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, check)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (!canInstall) return null
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(INSTALL_REQUEST_EVENT))} className={className}>
      <Download className="mr-1.5 inline h-3.5 w-3.5" />
      Install app
    </button>
  )
}
