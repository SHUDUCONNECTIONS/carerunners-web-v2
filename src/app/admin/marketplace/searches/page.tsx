"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { authedFetch } from "@/utils/authedFetch"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, ArrowLeft } from "lucide-react"
import LoadingComponent from "@/components/loader"
import type { SearchSummary } from "@/lib/marketplaceSearchStats"

const WINDOWS = [7, 30, 90]

export default function AdminSearchesPage() {
  const { loading: authLoading, denied } = useAdminGuard()
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<SearchSummary[]>([])
  const [minSearches, setMinSearches] = useState(3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading || denied) return
    setLoading(true)
    setError("")
    authedFetch(`/api/admin/marketplace/searches?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data = await res.json()
        setRows(data.searches)
        setMinSearches(data.minSearches)
      })
      .catch(() => setError("Couldn't load the searches."))
      .finally(() => setLoading(false))
  }, [authLoading, denied, days])

  if (authLoading) return <LoadingComponent />

  if (denied) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-2">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
        <p>You don&apos;t have access to this page.</p>
      </div>
    )
  }

  const noResults = rows.filter((r) => r.zeroResults > 0 && r.zeroResults >= r.searches / 2)

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4">
      <Link href="/admin/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal admin
      </Link>
      <h1 className="text-2xl font-bold">What buyers search for</h1>
      <p className="text-sm text-gray-600">
        Totals per search word, so you can see what to stock. Nothing about who searched is saved, and a word only appears once it has
        been searched at least {minSearches} times.
      </p>

      <div className="flex gap-2">
        {WINDOWS.map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
            Last {d} days
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <LoadingComponent />}

      {!loading && !error && (
        <>
          {noResults.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-1 text-sm">
                <p className="font-semibold">Buyers want these but mostly find nothing</p>
                <p className="text-gray-700">{noResults.map((r) => `${r.term} (${r.searches})`).join(", ")}</p>
              </CardContent>
            </Card>
          )}

          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">No search has reached {minSearches} yet in this period.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-600">
                      <th className="p-3 font-medium">Search</th>
                      <th className="p-3 font-medium text-right">Searches</th>
                      <th className="p-3 font-medium text-right">Found nothing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.term} className="border-b last:border-0">
                        <td className="p-3">{r.term}</td>
                        <td className="p-3 text-right">{r.searches}</td>
                        <td className="p-3 text-right">{r.zeroResults}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
