"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { INSTALL_REQUEST_EVENT, isStandalone } from "@/components/InstallPrompt"

// A permanent "Install app" button (footer, login and sign-up pages) for people who dismissed the banner or
// never saw it. Shown on every browser until the app is running installed: it opens the browser's own install
// prompt where there is one, and otherwise the steps for that browser (see InstallPrompt).
export default function InstallButton({ className }: { className?: string }) {
  const [installed, setInstalled] = useState(true)

  useEffect(() => {
    setInstalled(isStandalone())
    const onInstalled = () => setInstalled(true)
    window.addEventListener("appinstalled", onInstalled)
    return () => window.removeEventListener("appinstalled", onInstalled)
  }, [])

  if (installed) return null
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(INSTALL_REQUEST_EVENT))} className={className}>
      <Download className="mr-1.5 inline h-3.5 w-3.5" />
      Install app
    </button>
  )
}
