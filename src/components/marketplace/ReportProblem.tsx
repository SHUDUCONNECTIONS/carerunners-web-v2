"use client"

import React, { useState } from "react"
import { authedFetch } from "@/utils/authedFetch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MAX_ISSUE_TEXT, ISSUE_REASONS, reasonLabel } from "@/lib/marketplaceIssues"

export interface MyIssue {
  id: string
  orderId: string
  reason: string
  status: "open" | "resolved" | "rejected"
  adminNote: string
}

const STATUS_TEXT: Record<MyIssue["status"], string> = {
  open: "We are looking into it",
  resolved: "Resolved",
  rejected: "Closed without a refund",
}

// A buyer reports a problem with a paid order, and sees what happened to earlier reports.
export function ReportProblem({ orderId, issues, onSent }: { orderId: string; issues: MyIssue[]; onSent: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const mine = issues.filter((i) => i.orderId === orderId)
  const hasOpen = mine.some((i) => i.status === "open")

  const send = async () => {
    setError("")
    setSending(true)
    try {
      const res = await authedFetch("/api/marketplace/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason, description }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "We couldn't send your report.")
      setOpen(false)
      setReason("")
      setDescription("")
      onSent()
    } catch (err: any) {
      setError(err?.message || "We couldn't send your report.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-1 space-y-1">
      {mine.map((i) => (
        <p key={i.id} className="text-xs text-gray-600">
          Reported: {reasonLabel(i.reason)}. <span className="font-medium">{STATUS_TEXT[i.status]}.</span>
          {i.adminNote ? ` ${i.adminNote}` : ""}
        </p>
      ))}
      {!hasOpen && !open && (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Report a problem
        </Button>
      )}
      {open && (
        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <label className="block text-sm font-medium text-gray-900" htmlFor={`reason-${orderId}`}>
            What went wrong?
          </label>
          <select
            id={`reason-${orderId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Choose one</option>
            {ISSUE_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <Textarea
            rows={3}
            maxLength={MAX_ISSUE_TEXT}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us what happened"
            aria-label="Describe the problem"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={send} disabled={sending}>
              {sending ? "Sending…" : "Send report"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
