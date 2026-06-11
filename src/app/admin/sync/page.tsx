"use client"
import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, AlertCircle, RefreshCw, Lock } from "lucide-react"
import { db } from "@/utils/firebase"
import { collection, getDocs, doc, updateDoc } from "firebase/firestore"

const SYNC_PASSWORD = "shudu-sync-2024"

const calculatePrice = (distance: number) => {
  const basePrice = 32
  const ratePerKm = 10
  const price = distance <= 1 ? basePrice : basePrice + (distance - 1) * ratePerKm
  return price.toFixed(2)
}

export default function SyncPage() {
  const [password, setPassword] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ fixed: number; skipped: number; errors: number } | null>(null)
  const [error, setError] = useState("")

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === SYNC_PASSWORD) {
      setUnlocked(true)
    } else {
      setError("Incorrect password.")
    }
  }

  const handleSync = async () => {
    setLoading(true)
    setError("")
    setResult(null)

    try {
      const snapshot = await getDocs(collection(db, "pickupRequests"))

      if (snapshot.empty) {
        setResult({ fixed: 0, skipped: 0, errors: 0 })
        return
      }

      let fixed = 0
      let skipped = 0
      let errors = 0

      for (const docSnap of snapshot.docs) {
        try {
          const data = docSnap.data()
          const price = data.price

          if (!isNaN(Number(price)) && price !== null && price !== undefined) {
            skipped++
            continue
          }

          const distance = parseFloat(data.distance)
          if (isNaN(distance)) {
            skipped++
            continue
          }

          const correctedPrice = calculatePrice(distance)
          await updateDoc(doc(db, "pickupRequests", docSnap.id), { price: correctedPrice })
          fixed++
        } catch {
          errors++
        }
      }

      setResult({ fixed, skipped, errors })
    } catch (err: any) {
      setError(err.message || "Fix failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-xl font-bold text-center">Fix Trip Prices</CardTitle>
        </CardHeader>
        <CardContent className="mt-6 space-y-4">
          {!unlocked ? (
            <form onSubmit={handleUnlock} className="space-y-4">
              <p className="text-sm text-gray-600 text-center">Enter the sync password to continue.</p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                Unlock
              </Button>
            </form>
          ) : (
            <>
              <p className="text-gray-600 text-sm text-center">
                Scans all trip requests and recalculates prices for any that show NaN. Uses the stored distance with the current rate (R32 base + R10/km).
              </p>

              <Button
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleSync}
                disabled={loading || result !== null}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Fixing...
                  </>
                ) : result !== null ? (
                  "Done"
                ) : (
                  "Fix Prices"
                )}
              </Button>

              {result !== null && (
                <div className="flex items-start space-x-2 bg-green-50 border border-green-200 rounded p-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-green-700">
                    <p className="font-medium">Complete</p>
                    <p>{result.fixed} trip{result.fixed !== 1 ? "s" : ""} fixed.</p>
                    {result.skipped > 0 && <p>{result.skipped} already had valid prices.</p>}
                    {result.errors > 0 && <p className="text-red-600">{result.errors} failed.</p>}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded p-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
