"use client"

import { useEffect, useState } from "react"
import { authedFetch } from "@/utils/authedFetch"
import { DEFAULT_SETTINGS, type MarketSettings } from "@/lib/marketplaceSettings"

// The admin's minimum order and delivery discount, for showing buyers what applies to them.
export function useMarketSettings(): MarketSettings {
  const [settings, setSettings] = useState<MarketSettings>(DEFAULT_SETTINGS)
  useEffect(() => {
    authedFetch("/api/marketplace/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setSettings(s))
      .catch(() => {})
  }, [])
  return settings
}
