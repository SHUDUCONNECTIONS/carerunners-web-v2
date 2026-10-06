"use client"

import React, { useEffect, useState } from "react"
import { authedFetch } from "@/utils/authedFetch"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Admin controls for the MarketPortal minimum order and delivery discount.
// Leave a box at 0 to switch that rule off.
export function AdminSettings() {
  const [minOrder, setMinOrder] = useState("0")
  const [over, setOver] = useState("0")
  const [amount, setAmount] = useState("0")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    authedFetch("/api/marketplace/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return
        setMinOrder(String(s.minOrderAmount))
        setOver(String(s.deliverySubsidyOver))
        setAmount(String(s.deliverySubsidyAmount))
      })
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const res = await authedFetch("/api/admin/marketplace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minOrderAmount: minOrder, deliverySubsidyOver: over, deliverySubsidyAmount: amount }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't save the settings.")
      setMessage("Saved. It applies to new orders straight away.")
    } catch (err: any) {
      setError(err?.message || "Couldn't save the settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3 text-sm">
        <div>
          <p className="text-base font-semibold">Order and delivery rules</p>
          <p className="text-gray-500">
            Delivery is priced by distance, which makes small orders hard to sell. These rules help. The driver is always paid the full
            delivery fee; a discount is paid by Care Runners. Leave a box at 0 to switch it off.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="min-order">Minimum order (R)</Label>
            <Input id="min-order" type="number" min="0" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            <p className="text-xs text-gray-500">Item total, not counting delivery.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-over">Delivery discount from (R)</Label>
            <Input id="sub-over" type="number" min="0" inputMode="decimal" value={over} onChange={(e) => setOver(e.target.value)} />
            <p className="text-xs text-gray-500">Orders at or above this get the discount.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-amount">Most you take off delivery (R)</Label>
            <Input id="sub-amount" type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-xs text-gray-500">Your cost per order, at most.</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-green-700">
            {message}
          </p>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save rules"}
        </Button>
      </CardContent>
    </Card>
  )
}
