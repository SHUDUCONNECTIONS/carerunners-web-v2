// src/utils/marketplaceSettings.ts
// Server-only. Reads the admin's MarketPortal settings (cached for a minute).
import type { Firestore } from "firebase-admin/firestore";
import { DEFAULT_SETTINGS, SETTINGS_COLLECTION, SETTINGS_DOC, parseSettings, type MarketSettings } from "@/lib/marketplaceSettings";

let cache: { at: number; value: MarketSettings } | null = null;

export async function getMarketSettings(db: Firestore): Promise<MarketSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const snap = await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get();
  const value = snap.exists ? parseSettings(snap.data()) : DEFAULT_SETTINGS;
  cache = { at: Date.now(), value };
  return value;
}

export function clearSettingsCache() {
  cache = null;
}
