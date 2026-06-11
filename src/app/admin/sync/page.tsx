"use client"
import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, AlertCircle, RefreshCw, Lock } from "lucide-react"
import { db, rtdb } from "@/utils/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"
import { ref, set } from "firebase/database"

const SYNC_PASSWORD = "shudu-sync-2024"

export default function SyncPage() {
  const [password, setPassword] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ synced: number; skipped: number } | null>(null)
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
      const today = new Date().toISOString().split("T")[0]

      const snapshot = await getDocs(
        query(
          collection(db, "pickupRequests"),
          where("status", "==", "pending")
        )
      )

      if (snapshot.empty) {
        setResult({ synced: 0, skipped: 0 })
        return
      }

      let synced = 0
      let skipped = 0

      for (const docSnap of snapshot.docs) {
        try {
          const data = docSnap.data()
          // Only sync trips with a future or today pickup date
          if (data.pickupDate && data.pickupDate < today) {
            skipped++
            continue
          }
          await set(ref(rtdb, `trips/${docSnap.id}`), {
            ...data,
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
          })
          synced++
        } catch {
          skipped++
        }
      }

      setResult({ synced, skipped })
    } catch (err: any) {
      setError(err.message || "Sync failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-xl font-bold text-center">Sync Trips to Driver App</CardTitle>
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
                This will copy all pending trips with future pickup dates from Firestore to the Realtime Database so the driver app can see them. Run once only.
              </p>

              <Button
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleSync}
                disabled={loading || result?.synced !== undefined}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : result !== null ? (
                  "Done"
                ) : (
                  "Run Sync"
                )}
              </Button>

              {result !== null && (
                <div className="flex items-start space-x-2 bg-green-50 border border-green-200 rounded p-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-green-700">
                    <p className="font-medium">Sync complete</p>
                    <p>{result.synced} trip{result.synced !== 1 ? "s" : ""} synced to driver app.</p>
                    {result.skipped > 0 && <p>{result.skipped} skipped due to errors.</p>}
                    {result.synced === 0 && <p>No pending trips with future dates found.</p>}
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
