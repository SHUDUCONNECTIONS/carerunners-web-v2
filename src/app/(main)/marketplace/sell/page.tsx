"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { sendEmailVerification } from "firebase/auth"
import { auth } from "@/utils/firebase"
import { authedFetch } from "@/utils/authedFetch"
import BackLink from "@/components/BackLink"
import LoadingComponent from "@/components/loader"
import { ListingForm } from "@/components/marketplace/ListingForm"
import { AddressAutocomplete, PickedPlace } from "@/components/AddressAutocomplete"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, MailCheck, Store } from "lucide-react"
import { MarketCompany, SA_BANKS, SellerBank } from "@/lib/marketplace"
import { MARKUP_RATE } from "@/lib/marketplaceMarkup"

type Seller = { id: string; name: string; contactName: string; phone: string; address: string; area: string; active: boolean; bank: string }

const EMPTY_BANK: SellerBank = { accountHolder: "", bankId: "", accountNumber: "", accountType: "savings", branchCode: "" }

// A customer selling their own items: verify their email, set up their seller details once, then submit items.
// Every item waits for an admin to approve it before buyers can see it.
export default function SellPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [seller, setSeller] = useState<Seller | null>(null)
  const [editing, setEditing] = useState(false)
  const [uid, setUid] = useState("")
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await authedFetch("/api/marketplace/sell")
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't load your seller details.")
      setVerified(data.emailVerified)
      setSeller(data.seller)
    } catch (err: any) {
      setError(err?.message || "Couldn't load your seller details.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await auth.authStateReady()
      const user = auth.currentUser
      if (!user) return router.push("/auth/login")
      setUid(user.uid)
      load()
    })()
  }, [load, router])

  if (loading) return <LoadingComponent />

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/marketplace" label="MarketPortal" smart />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Store className="h-6 w-6" /> Sell an item
        </h1>
        <p className="text-sm text-gray-600">
          List something you own on MarketPortal. Care Runners checks every item before it goes live, adds a{" "}
          {MARKUP_RATE * 100}% service fee to your price, collects it from you when it sells, delivers it to the buyer,
          and pays you by EFT.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {!verified ? (
        <VerifyEmail onVerified={load} />
      ) : !seller || editing ? (
        <SellerSetup
          existing={seller}
          onSaved={() => {
            setEditing(false)
            load()
          }}
          onCancel={seller ? () => setEditing(false) : undefined}
        />
      ) : !seller.active ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-700">
            Your seller account is paused. Please contact Care Runners support.
          </CardContent>
        </Card>
      ) : submitted ? (
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
            <p className="text-lg font-semibold">Item sent for review</p>
            <p className="text-sm text-gray-600">
              Care Runners will check it, usually within one working day. Once it&apos;s approved it goes live, and you can
              follow it under <b>My MarketPortal</b>. If it isn&apos;t approved, you&apos;ll see the reason there.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href="/marketplace/my-listings">My MarketPortal</Link>
              </Button>
              <Button
                onClick={() => {
                  setSubmitted(false)
                  setFormKey((k) => k + 1)
                }}
              >
                Sell another item
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold">Selling as {seller.name}</p>
                <p className="text-gray-600 [overflow-wrap:anywhere]">Collection: {seller.address}</p>
                <p className="text-gray-600">Payouts to {seller.bank}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit details
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your item</CardTitle>
            </CardHeader>
            <CardContent>
              <ListingForm
                key={formKey}
                mode="company"
                companies={[{ id: seller.id, name: seller.name } as MarketCompany]}
                uid={uid}
                endpoint="/api/marketplace/sell/listings"
                onCreated={() => setSubmitted(true)}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function VerifyEmail({ onVerified }: { onVerified: () => void }) {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const email = auth.currentUser?.email

  const send = async () => {
    const user = auth.currentUser
    if (!user) return
    setBusy(true)
    setMessage("")
    try {
      await sendEmailVerification(user)
      setSent(true)
    } catch (err: any) {
      setMessage(err?.code === "auth/too-many-requests" ? "Too many emails sent. Please wait a few minutes." : "Couldn't send the email. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    const user = auth.currentUser
    if (!user) return
    setBusy(true)
    setMessage("")
    await user.reload()
    if (auth.currentUser?.emailVerified) {
      await auth.currentUser.getIdToken(true) // the server reads "verified" from a fresh login token
      onVerified()
    } else {
      setMessage("Not verified yet. Open the link in the email we sent, then try again.")
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <p className="flex items-center gap-2 font-semibold">
          <MailCheck className="h-5 w-5 text-[var(--brand-600)]" /> First, confirm your email address
        </p>
        <p className="text-sm text-gray-600">
          Sellers need a confirmed email so we can reach you about your items and sales.
          {email ? <> We&apos;ll send a link to <b className="[overflow-wrap:anywhere]">{email}</b>.</> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={send} disabled={busy}>
            {sent ? "Send the email again" : "Send confirmation email"}
          </Button>
          {sent && (
            <Button variant="outline" onClick={check} disabled={busy}>
              I&apos;ve confirmed it
            </Button>
          )}
        </div>
        {sent && <p className="text-sm text-green-700">Email sent. Check your inbox (and spam folder) and open the link.</p>}
        {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
      </CardContent>
    </Card>
  )
}

function SellerSetup({ existing, onSaved, onCancel }: { existing: Seller | null; onSaved: () => void; onCancel?: () => void }) {
  const [name, setName] = useState(existing?.name ?? "")
  const [contactName, setContactName] = useState(existing?.contactName ?? "")
  const [phone, setPhone] = useState(existing?.phone ?? "")
  const [address, setAddress] = useState(existing?.address ?? "")
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [bank, setBank] = useState<SellerBank>(EMPTY_BANK)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!place) return setError("Choose your pickup address from the suggestions.")
    if (!existing && !termsAccepted) return setError("Accept the Seller Terms and Conditions to continue.")
    setSaving(true)
    try {
      const res = await authedFetch("/api/marketplace/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactName, phone, address: place.address, area: place.area, lat: place.lat, lng: place.lng, bank, termsAccepted }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't save your details.")
      onSaved()
    } catch (err: any) {
      setError(err?.message || "Couldn't save your details.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existing ? "Edit your seller details" : "Your seller details"}</CardTitle>
        <p className="text-sm text-gray-600">
          {existing
            ? "Re-enter your pickup address and bank details to save changes."
            : "You only do this once. We use these details to collect your items and pay you."}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sname">Seller name shown to buyers</Label>
              <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thabo M." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scontact">Your full name</Label>
              <Input id="scontact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sphone">Phone (shared with the driver who collects)</Label>
              <Input id="sphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="saddress">Pickup address</Label>
            <AddressAutocomplete
              id="saddress"
              value={address}
              onChange={(v) => {
                setAddress(v)
                if (place && v !== place.address) setPlace(null)
              }}
              onPick={setPlace}
              placeholder="Search the address where we collect your items…"
            />
            <p className="text-xs text-gray-500">Buyers only see your suburb and city, never your full address.</p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-semibold">Bank account for your payouts</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sholder">Account holder</Label>
                <Input id="sholder" value={bank.accountHolder} onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bank</Label>
                <Select value={bank.bankId} onValueChange={(id) => setBank({ ...bank, bankId: id, branchCode: SA_BANKS.find((b) => b.id === id)?.branchCode ?? "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {SA_BANKS.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sacc">Account number</Label>
                <Input id="sacc" inputMode="numeric" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="space-y-2">
                <Label>Account type</Label>
                <Select value={bank.accountType} onValueChange={(v) => setBank({ ...bank, accountType: v as SellerBank["accountType"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="cheque">Cheque / Current</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {!existing && (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox className="mt-0.5" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} />
              <span>
                I accept the{" "}
                <Link href="/marketplace/terms" target="_blank" className="underline">
                  Seller Terms and Conditions
                </Link>{" "}
                and the{" "}
                <Link href="/marketplace/returns" target="_blank" className="underline">
                  Returns &amp; Refunds policy
                </Link>
                .
              </span>
            </label>
          )}

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : existing ? "Save details" : "Continue"}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
