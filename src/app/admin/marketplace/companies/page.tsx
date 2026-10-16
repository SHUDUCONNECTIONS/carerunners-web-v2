"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/utils/firebase"
import { authedFetch } from "@/utils/authedFetch"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { AddressAutocomplete, PickedPlace } from "@/components/AddressAutocomplete"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, ArrowLeft, Building2, Pencil } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { MARKET_COMPANIES, MarketCompany, SA_BANKS, SellerBank, companyFromDoc } from "@/lib/marketplace"

const EMPTY_BANK: SellerBank = { accountHolder: "", bankId: "", accountNumber: "", accountType: "savings", branchCode: "" }

export default function AdminCompaniesPage() {
  const { loading: authLoading, denied } = useAdminGuard()
  const [companies, setCompanies] = useState<MarketCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [name, setName] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [bank, setBank] = useState<SellerBank>(EMPTY_BANK)
  const [loginEmails, setLoginEmails] = useState("")
  const [active, setActive] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, MARKET_COMPANIES))
      setCompanies(snap.docs.map((d) => companyFromDoc(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error("Error loading companies:", err)
      setError("Couldn't load companies.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !denied) load()
  }, [authLoading, denied, load])

  const reset = () => {
    setEditingId(null)
    setName("")
    setContactName("")
    setContactEmail("")
    setPhone("")
    setAddress("")
    setPlace(null)
    setBank(EMPTY_BANK)
    setLoginEmails("")
    setActive(true)
    setTermsAccepted(false)
  }

  const edit = (c: MarketCompany) => {
    setEditingId(c.id)
    setName(c.name)
    setContactName(c.contactName)
    setContactEmail(c.contactEmail)
    setPhone(c.phone)
    setAddress(c.address)
    setPlace({ address: c.address, area: c.area, lat: c.lat, lng: c.lng })
    setBank(c.bank)
    setLoginEmails(c.loginEmails.join(", "))
    setActive(c.active)
    setError("")
    setNotice("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setNotice("")
    if (!place || place.address !== address) {
      setError("Choose the pickup address from the suggestions.")
      return
    }
    setSaving(true)
    try {
      const res = await authedFetch("/api/admin/marketplace/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name,
          contactName,
          contactEmail,
          phone,
          address: place.address,
          area: place.area,
          lat: place.lat,
          lng: place.lng,
          bank,
          loginEmails: loginEmails.split(/[,\s;]+/).filter(Boolean),
          active,
          termsAccepted,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't save the company.")
      setNotice(editingId ? "Company updated." : "Company created. You can now list items for it.")
      reset()
      await load()
    } catch (err: any) {
      setError(err?.message || "Couldn't save the company.")
    } finally {
      setSaving(false)
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <Link href="/admin/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal admin
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5" /> {editingId ? "Edit company" : "Add a company"}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Companies own the items you list. We collect from the company&apos;s pickup address and pay them after delivery.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact person</Label>
                <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cemail">Contact email</Label>
                <Input id="cemail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (shared with the collecting driver)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Pickup address</Label>
              <AddressAutocomplete
                id="address"
                value={address}
                onChange={(v) => {
                  setAddress(v)
                  if (place && v !== place.address) setPlace(null)
                }}
                onPick={setPlace}
                placeholder="Search the address where we collect items…"
              />
              <p className="text-xs text-gray-500">Buyers only see the suburb and city, never the full address.</p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="font-semibold text-sm">Bank details for payouts</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="holder">Account holder</Label>
                  <Input id="holder" value={bank.accountHolder} onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Bank</Label>
                  <Select
                    value={bank.bankId}
                    onValueChange={(id) =>
                      setBank({ ...bank, bankId: id, branchCode: SA_BANKS.find((b) => b.id === id)?.branchCode ?? "" })
                    }
                  >
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
                  <Label htmlFor="acc">Account number</Label>
                  <Input
                    id="acc"
                    inputMode="numeric"
                    value={bank.accountNumber}
                    onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, "") })}
                  />
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

            <div className="space-y-2">
              <Label htmlFor="logins">Company login emails (optional)</Label>
              <Input
                id="logins"
                value={loginEmails}
                onChange={(e) => setLoginEmails(e.target.value)}
                placeholder="person@company.co.za, another@company.co.za"
              />
              <p className="text-xs text-gray-500">
                People who sign in to Care Runners with one of these emails can see this company&apos;s items and sales
                (read only). Their email must be verified.
              </p>
            </div>

            <div className="space-y-2">
              {editingId ? (
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
                  Company is active (untick to stop new items being listed for it)
                </label>
              ) : (
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox className="mt-0.5" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} />
                  <span>
                    This company has agreed to the{" "}
                    <Link href="/marketplace/terms" target="_blank" className="underline">
                      Seller Terms and Conditions
                    </Link>
                    .
                  </span>
                </label>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            {notice && <p className="text-sm text-green-700">{notice}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create company"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">Companies ({companies.length})</h2>
        {companies.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">No companies yet.</CardContent>
          </Card>
        ) : (
          companies.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex flex-wrap items-start gap-4 text-sm">
                <div className="flex-1 min-w-[220px] space-y-0.5">
                  <p className="font-semibold text-base">
                    {c.name}
                    {!c.active && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">Inactive</span>}
                  </p>
                  <p className="text-gray-600">
                    {c.contactName} · {c.phone}
                  </p>
                  <p className="text-gray-500 break-words">{c.address}</p>
                  <p className="text-gray-500">
                    {SA_BANKS.find((b) => b.id === c.bank.bankId)?.label} · acc {c.bank.accountNumber}
                  </p>
                  {c.loginEmails.length > 0 && <p className="text-gray-500 break-words">Logins: {c.loginEmails.join(", ")}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => edit(c)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
