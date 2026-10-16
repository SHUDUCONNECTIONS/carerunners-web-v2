"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { authedFetch } from "@/utils/authedFetch"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, ArrowLeft } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { IssueView, reasonLabel } from "@/lib/marketplaceIssues"

export default function AdminIssuesPage() {
  const { loading: authLoading, denied } = useAdminGuard()
  const [issues, setIssues] = useState<IssueView[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"open" | "all">("open")

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/admin/marketplace/issues")
      if (!res.ok) throw new Error()
      const data = (await res.json()).issues as IssueView[]
      setIssues(data)
      setNotes(Object.fromEntries(data.map((i) => [i.id, i.adminNote])))
    } catch {
      setError("Couldn't load the reports.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || denied) return
    load()
  }, [authLoading, denied, load])

  const setStatus = async (i: IssueView, status: "open" | "resolved" | "rejected") => {
    setBusyId(i.id)
    setError("")
    try {
      const res = await authedFetch("/api/admin/marketplace/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: i.id, status, adminNote: notes[i.id] ?? "" }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Couldn't update that report.")
      setIssues((prev) => prev.map((x) => (x.id === i.id ? { ...x, status, adminNote: notes[i.id] ?? "" } : x)))
    } catch (err: any) {
      setError(err?.message || "Couldn't update that report.")
    } finally {
      setBusyId("")
    }
  }

  if (authLoading || loading) return <LoadingComponent />

  if (denied) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-2">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
        <p>You don&apos;t have access to this page.</p>
      </div>
    )
  }

  const shown = issues.filter((i) => filter === "all" || i.status === "open")

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4">
      <Link href="/admin/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal admin
      </Link>
      <h1 className="text-2xl font-bold">Reported problems</h1>
      <p className="text-sm text-gray-600">
        Buyers can report a problem within 14 days of an order. Record what you decided; the buyer sees your note. Refunds are paid by you
        outside this page.
      </p>

      <div className="flex gap-2">
        <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>
          Open ({issues.filter((i) => i.status === "open").length})
        </Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All ({issues.length})
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">{filter === "open" ? "No open reports." : "No reports yet."}</CardContent>
        </Card>
      ) : (
        shown.map((i) => (
          <Card key={i.id}>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{i.title}</p>
                <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700 capitalize">{i.status}</span>
              </div>
              <p className="text-gray-600">
                {reasonLabel(i.reason)} · {i.buyerEmail} · {i.createdAt ? new Date(i.createdAt).toLocaleDateString("en-ZA") : ""}
              </p>
              <p className="whitespace-pre-line text-gray-800">{i.description}</p>
              <Textarea
                rows={2}
                value={notes[i.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [i.id]: e.target.value }))}
                placeholder="Your note to the buyer (for example: refunded R120 on 7 Oct)"
                aria-label="Note to the buyer"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busyId === i.id} onClick={() => setStatus(i, "resolved")}>
                  Mark resolved
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === i.id} onClick={() => setStatus(i, "rejected")}>
                  Close without refund
                </Button>
                {i.status !== "open" && (
                  <Button size="sm" variant="outline" disabled={busyId === i.id} onClick={() => setStatus(i, "open")}>
                    Reopen
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
