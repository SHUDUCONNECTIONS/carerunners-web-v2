"use client"

import React, { useEffect, useState } from "react"
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import { storage } from "@/utils/firebase"
import { authedFetch } from "@/utils/authedFetch"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, X } from "lucide-react"
import {
  CONDITIONS,
  ItemCondition,
  KNOWN_ISSUES,
  MARKET_CATEGORIES,
  MAX_PHOTOS,
  MIN_PHOTOS,
  MarketCompany,
  MarketListing,
  formatRand,
} from "@/lib/marketplace"
import { MARKUP_RATE, priceWithMarkup } from "@/lib/marketplaceMarkup"

// The item form used by admins (listing for a company, goes live) and by
// company logins (submitting their own item for review).
export function ListingForm({
  mode,
  companies,
  uid,
  endpoint,
  onCreated,
  initial,
}: {
  mode: "admin" | "company"
  companies: MarketCompany[]
  uid: string
  endpoint: string
  onCreated: (id: string, customerPrice: number) => void
  /** An item being corrected: the form starts filled in, and saving sends it back for review (PUT). */
  initial?: MarketListing
}) {
  const isAdmin = mode === "admin"
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0].id : "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [category, setCategory] = useState<string>(initial?.category ?? "")
  const [condition, setCondition] = useState<ItemCondition>(initial?.condition ?? "used_good")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [specifications, setSpecifications] = useState(initial?.specifications ?? "")
  const [defects, setDefects] = useState(initial?.defects ?? "")
  const [knownIssues, setKnownIssues] = useState<string[]>(initial?.knownIssues ?? [])
  const [additionalInfo, setAdditionalInfo] = useState(initial?.additionalInfo ?? "")
  const [companyPrice, setCompanyPrice] = useState(initial ? String(initial.askingPrice) : "")
  const [stock, setStock] = useState("")
  // A photo already saved on the item has no file: its preview is its link.
  const [photos, setPhotos] = useState<{ file?: File; preview: string }[]>((initial?.images ?? []).map((url) => ({ preview: url })))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => () => photos.forEach((p) => p.file && URL.revokeObjectURL(p.preview)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ""
    const room = MAX_PHOTOS - photos.length
    setPhotos((prev) => [...prev, ...picked.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  const removePhoto = (i: number) =>
    setPhotos((prev) => {
      if (prev[i].file) URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, j) => j !== i)
    })

  const price = Number(companyPrice)
  // Customers pay the company price plus the standard markup; the server works it out the same way.
  const { markupAmount, sellingPrice: customerPrice } = Number.isFinite(price) && price > 0 ? priceWithMarkup(price) : { markupAmount: 0, sellingPrice: 0 }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!companyId) return setError("Choose the company this item belongs to.")
    if (!title.trim() || !category || !description.trim()) return setError("Item name, category and description are required.")
    if (!defects.trim()) return setError('Describe any defects or damage. Write "None" if there are none.')
    if (!Number.isFinite(price) || price <= 0) return setError(isAdmin ? "Enter the price the company wants to receive." : "Enter the price you want to receive.")
    if (isAdmin && stock.trim() && (!Number.isInteger(Number(stock)) || Number(stock) < 1))
      return setError("Quantity in stock must be a whole number (or leave it empty for a one-off item).")
    if (photos.length < MIN_PHOTOS) return setError(`Upload at least ${MIN_PHOTOS} photos (up to ${MAX_PHOTOS}).`)

    setSubmitting(true)
    try {
      const stamp = Date.now()
      const images = await Promise.all(
        photos.map(async ({ file, preview }, i) => {
          if (!file) return preview
          const r = storageRef(storage, `marketplace/${uid}/${stamp}_${i}_${file.name}`)
          await uploadBytes(r, file)
          return getDownloadURL(r)
        })
      )

      const res = await authedFetch(endpoint, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          title,
          category,
          condition,
          description,
          specifications,
          defects,
          knownIssues,
          additionalInfo,
          companyPrice: price,
          stock: isAdmin && stock.trim() ? Number(stock) : undefined,
          images,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Couldn't save the item.")
      onCreated(data.id, customerPrice)
    } catch (err: any) {
      console.error("Error creating listing:", err)
      setError(err?.message || "Couldn't save the item.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {companies.length > 1 || isAdmin ? (
        <div className="space-y-2">
          <Label>Company</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">Collected from the company&apos;s pickup address.</p>
        </div>
      ) : (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          Listing for <b>{companies[0]?.name}</b>{companies[0]?.name?.endsWith(".") ? "" : "."} We collect from the pickup address on file.
        </p>
      )}

      <div className="space-y-2">
        <Label>
          Photos ({photos.length}/{MAX_PHOTOS}, at least {MIN_PHOTOS})
        </Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative aspect-square rounded-lg overflow-hidden border">
              <img src={p.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-2 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 cursor-pointer hover:border-[var(--brand-500)]">
              <Camera className="h-5 w-5" />
              Add photos
              <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
            </label>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Item name</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Office Chair" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {MARKET_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Condition</Label>
          <Select value={condition} onValueChange={(v) => setCondition(v as ItemCondition)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="specs">Specifications</Label>
        <Textarea
          id="specs"
          rows={3}
          value={specifications}
          onChange={(e) => setSpecifications(e.target.value)}
          placeholder="One per line: brand, model, size, storage, power rating, etc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="defects">Defects or damage</Label>
        <Textarea
          id="defects"
          rows={3}
          value={defects}
          onChange={(e) => setDefects(e.target.value)}
          placeholder='Every known scratch, fault or issue. Write "None" if there are none.'
        />
        <p className="text-xs text-gray-500">Tick everything that applies:</p>
        <div className="grid sm:grid-cols-2 gap-1">
          {KNOWN_ISSUES.map((issue) => (
            <label key={issue} className="flex items-center gap-3 py-1.5 text-sm">
              <Checkbox
                checked={knownIssues.includes(issue)}
                onCheckedChange={(v) => setKnownIssues((prev) => (v === true ? [...prev, issue] : prev.filter((i) => i !== issue)))}
              />
              {issue}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="additional">Other information (optional)</Label>
        <Textarea id="additional" rows={2} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="font-semibold text-sm">Pricing</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cprice">{isAdmin ? "Company price (R)" : "Your price (R)"}</Label>
            <Input id="cprice" type="number" min="1" inputMode="decimal" value={companyPrice} onChange={(e) => setCompanyPrice(e.target.value)} />
            <p className="text-xs text-gray-500">{isAdmin ? "What the company receives." : "What you receive once the item is delivered."}</p>
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Care Runners markup ({MARKUP_RATE * 100}%)</p>
              <p className="pt-2">{formatRand(markupAmount)}</p>
            </div>
          )}
        </div>
        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="stock">Quantity in stock (optional)</Label>
            <Input id="stock" type="number" min="1" step="1" inputMode="numeric" className="sm:w-1/2" value={stock} onChange={(e) => setStock(e.target.value)} />
            <p className="text-xs text-gray-500">Leave empty for a one-off item. Otherwise customers can buy several, until it runs out.</p>
          </div>
        )}
        {isAdmin ? (
          <p className="text-sm">
            Customers pay: <b className="text-[var(--brand-700)]">{formatRand(customerPrice)}</b>{" "}
            <span className="text-gray-500">(plus delivery)</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Care Runners reviews every item and adds its markup before it goes live. You will see the final price once it is approved.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Saving…" : isAdmin ? "Publish item" : initial ? "Resubmit for review" : "Submit for review"}
      </Button>
    </form>
  )
}
