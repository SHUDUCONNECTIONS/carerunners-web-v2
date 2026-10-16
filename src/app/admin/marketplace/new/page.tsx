"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/utils/firebase"
import { useAdminGuard } from "@/utils/useAdminGuard"
import { ListingForm } from "@/components/marketplace/ListingForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { MARKET_COMPANIES, MarketCompany, companyFromDoc, formatRand } from "@/lib/marketplace"

export default function AdminNewListingPage() {
  const { loading: authLoading, denied, user } = useAdminGuard()
  const [companies, setCompanies] = useState<MarketCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<{ id: string; price: number } | null>(null)
  const [formKey, setFormKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, MARKET_COMPANIES))
      setCompanies(
        snap.docs
          .map((d) => companyFromDoc(d.id, d.data()))
          .filter((c) => c.active)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
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

  if (authLoading || loading) return <LoadingComponent />

  if (denied || !user) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-2">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
        <p>You don&apos;t have access to this page.</p>
      </div>
    )
  }

  if (created) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-600" />
            <h2 className="text-2xl font-bold">Item is live</h2>
            <p className="text-gray-600">It&apos;s now on MarketPortal at {formatRand(created.price)}.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  setCreated(null)
                  setFormKey((k) => k + 1)
                }}
              >
                List another item
              </Button>
              <Button asChild variant="outline">
                <Link href={`/marketplace/${created.id}`}>View listing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/marketplace">Back to admin</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center space-y-3 py-12">
        <p className="text-gray-700">{error || "You need to add a company before you can list items."}</p>
        <Button asChild>
          <Link href="/admin/marketplace/companies">Add a company</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      <Link href="/admin/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal admin
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>List an item for a company</CardTitle>
          <p className="text-sm text-gray-600">The item goes live straight away at the price you set below.</p>
        </CardHeader>
        <CardContent>
          <ListingForm
            key={formKey}
            mode="admin"
            companies={companies}
            uid={user.uid}
            endpoint="/api/admin/marketplace/listings"
            onCreated={(id, price) => setCreated({ id, price })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
