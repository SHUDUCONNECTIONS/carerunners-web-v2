import {
  Armchair,
  Baby,
  Car,
  Dumbbell,
  Gamepad2,
  Pencil,
  UtensilsCrossed,
  Laptop,
  Lamp,
  MoreHorizontal,
  Shirt,
  Smartphone,
  WashingMachine,
  Wrench,
} from "lucide-react"
import type { DeliveryZone } from "@/lib/marketplaceDeliveryDay"

export type MarketCategoryId =
  | "furniture"
  | "appliances"
  | "electronics"
  | "clothing"
  | "baby_items"
  | "tools"
  | "computers_phones"
  | "cars_accessories"
  | "home_decor"
  | "sports_equipment"
  | "home_kitchen"
  | "toys_games"
  | "stationery_craft"
  | "other"

export const MARKET_CATEGORIES: {
  id: MarketCategoryId
  label: string
  icon: typeof Armchair
}[] = [
  { id: "furniture", label: "Furniture", icon: Armchair },
  { id: "appliances", label: "Appliances", icon: WashingMachine },
  { id: "electronics", label: "Electronics", icon: Laptop },
  { id: "clothing", label: "Clothing", icon: Shirt },
  { id: "baby_items", label: "Baby Items", icon: Baby },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "computers_phones", label: "Computers & Phones", icon: Smartphone },
  { id: "cars_accessories", label: "Cars & Accessories", icon: Car },
  { id: "home_decor", label: "Home Décor", icon: Lamp },
  { id: "sports_equipment", label: "Sports Equipment", icon: Dumbbell },
  { id: "home_kitchen", label: "Home & Kitchen", icon: UtensilsCrossed },
  { id: "toys_games", label: "Toys & Games", icon: Gamepad2 },
  { id: "stationery_craft", label: "Stationery & Craft", icon: Pencil },
  { id: "other", label: "Other", icon: MoreHorizontal },
]

// The order categories are shown in when browsing "All items": tech and the things buyers
// want most come first, everyday and low-interest items last. Lower number = nearer the top.
const CATEGORY_ORDER: MarketCategoryId[] = [
  "computers_phones",
  "electronics",
  "appliances",
  "cars_accessories",
  "tools",
  "sports_equipment",
  "furniture",
  "home_decor",
  "baby_items",
  "clothing",
  "toys_games",
  "home_kitchen",
  "stationery_craft",
  "other",
]

export function categoryRank(id: string): number {
  const i = CATEGORY_ORDER.indexOf(id as MarketCategoryId)
  return i === -1 ? CATEGORY_ORDER.length : i
}

export function categoryLabel(id: string): string {
  return MARKET_CATEGORIES.find((c) => c.id === id)?.label ?? "Other"
}

export type ListingStatus = "pending" | "active" | "reserved" | "sold" | "rejected" | "inactive"
export type ItemCondition = "new" | "used_excellent" | "used_good" | "used_fair" | "for_parts"

export const CONDITIONS: { id: ItemCondition; label: string }[] = [
  { id: "new", label: "Brand new" },
  { id: "used_excellent", label: "Used (Excellent)" },
  { id: "used_good", label: "Used (Good)" },
  { id: "used_fair", label: "Used (Fair)" },
  { id: "for_parts", label: "For Parts/Repair" },
]

export function conditionLabel(id: string): string {
  // Listings created before the grades existed stored plain "used".
  return CONDITIONS.find((c) => c.id === id)?.label ?? (id === "used" ? "Used" : id)
}

// MarketPortal keeps brand-new and pre-owned items apart: every condition except "new" counts as used
// (including "for parts" and older listings that stored plain "used").
export type ItemKind = "new" | "used"
export const itemKind = (condition: string): ItemKind => (condition === "new" ? "new" : "used")

// A brand-new item whose seller disclosed no defects ("None" or blank) and no known issues: the product
// page shows a calm "Brand new" note instead of the defects warning.
export function brandNewNothingToDisclose(l: Pick<MarketListing, "condition" | "defects" | "knownIssues">): boolean {
  return itemKind(l.condition) === "new" && /^\s*(none\.?)?\s*$/i.test(l.defects ?? "") && (l.knownIssues ?? []).length === 0
}

// The coloured condition pill on cards and the product page: green for brand new, amber for used.
export function conditionBadgeClass(condition: string): string {
  return itemKind(condition) === "new" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
}

// Issues a seller must disclose if known (listing terms: "Item Condition").
export const KNOWN_ISSUES = [
  "Damage",
  "Faults",
  "Missing parts",
  "Repairs",
  "Modifications",
  "Defects",
  "Battery problems",
  "Water damage",
  "Software / activation locks",
]
export type OrderStatus = "awaiting-payment" | "paid" | "cancelled"

export interface MarketListing {
  id: string
  sellerId: string
  sellerName: string
  title: string
  description: string
  category: MarketCategoryId
  condition: ItemCondition
  defects: string
  knownIssues: string[]
  specifications: string
  additionalInfo: string
  askingPrice: number
  markupAmount: number | null
  sellingPrice: number | null
  /** Units left. null = a one-off item (reserved, then sold). */
  stock: number | null
  /** Product ratings: the average is ratingSum / ratingCount. */
  ratingSum?: number
  ratingCount?: number
  location: string
  images: string[]
  /** Number of photos. The browse list only carries the first photo, so this is the real count. */
  imageCount?: number
  reservedAt: number
  status: ListingStatus
  rejectionReason?: string
  /** The seller withdrew or took down the item themselves (they can put it back up, after review). */
  sellerRemoved?: boolean
  createdAt: number
}

/** One product on an order. A cart order has several; older orders have one (see orderLines). */
export interface MarketOrderLine {
  listingId: string
  title: string
  image: string | null
  quantity: number
  unitPrice: number
  /** What the company receives per unit. */
  sellerUnitPrice: number
  markupUnit: number
}

export interface MarketOrder {
  id: string
  listingId: string
  listingTitle: string
  listingImage: string | null
  buyerId: string
  buyerName: string
  buyerPhone: string
  sellerId: string
  deliveryOption: "delivery"
  /** Missing on orders placed before courier delivery existed (= "driver"). */
  deliveryMethod?: "driver" | "courier"
  deliveryZone?: DeliveryZone
  deliveryAddress: string
  /** Units bought in total. Missing on orders placed before stock existed (= 1). */
  quantity?: number
  /** The products on the order. Missing on orders placed before carts existed (see orderLines). */
  items?: MarketOrderLine[]
  /** Total for all units (unit price x quantity). */
  itemPrice: number
  sellerPrice: number
  markupAmount: number
  deliveryFee: number
  /** What Care Runners took off the delivery fee, and what the buyer actually paid for delivery. */
  deliverySubsidy?: number
  deliveryCharged?: number
  totalAmount: number
  status: OrderStatus
  sellerPaidOut: boolean
  tripId: string
  createdAt: number
}

export const MARKET_LISTINGS = "marketplaceListings"
export const MARKET_ORDERS = "marketplaceOrders"

// Seller's private pickup details (exact address, coordinates, phone). Buyers
// only ever see the public `location` area on the listing itself.
export const MARKET_PICKUP = "marketplacePickup"

// Companies are created by admins. They own the listings (a listing's
// sellerId is the company id) and are paid out after delivery.
export const MARKET_COMPANIES = "marketplaceCompanies"

// Universal branch codes, so sellers don't have to look up their own.
export const SA_BANKS: { id: string; label: string; branchCode: string }[] = [
  { id: "absa", label: "Absa", branchCode: "632005" },
  { id: "african_bank", label: "African Bank", branchCode: "430000" },
  { id: "capitec", label: "Capitec", branchCode: "470010" },
  { id: "discovery", label: "Discovery Bank", branchCode: "679000" },
  { id: "fnb", label: "FNB", branchCode: "250655" },
  { id: "investec", label: "Investec", branchCode: "580105" },
  { id: "nedbank", label: "Nedbank", branchCode: "198765" },
  { id: "standard_bank", label: "Standard Bank", branchCode: "051001" },
  { id: "tymebank", label: "TymeBank", branchCode: "678910" },
]

export interface MarketCompany {
  id: string
  name: string
  contactName: string
  contactEmail: string
  phone: string
  address: string
  area: string
  lat: number
  lng: number
  bank: SellerBank
  /** Emails allowed to see this company's items and sales after logging in. */
  loginEmails: string[]
  termsVersion: string
  active: boolean
  createdAt: number
}

export function companyFromDoc(id: string, data: any): MarketCompany {
  return {
    id,
    name: data.name ?? "",
    contactName: data.contactName ?? "",
    contactEmail: data.contactEmail ?? "",
    phone: data.phone ?? "",
    address: data.address ?? "",
    area: data.area ?? "",
    lat: Number(data.lat) || 0,
    lng: Number(data.lng) || 0,
    bank: data.bank ?? { accountHolder: "", bankId: "", accountNumber: "", accountType: "savings", branchCode: "" },
    loginEmails: data.loginEmails ?? [],
    termsVersion: data.termsVersion ?? "",
    active: data.active !== false,
    createdAt: toMillis(data.createdAt),
  }
}

export interface SellerBank {
  accountHolder: string
  bankId: string
  accountNumber: string
  accountType: "cheque" | "savings"
  branchCode: string
}

// Straight-line distance padded for real roads, priced like a parcel delivery.
const ROAD_FACTOR = 1.3

export interface LatLng {
  lat: number
  lng: number
}

export function estimateDeliveryKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  const km = 2 * 6371 * Math.asin(Math.sqrt(h)) * ROAD_FACTOR
  return Math.round(km * 10) / 10
}

export const MIN_PHOTOS = 1
export const MAX_PHOTOS = 5

// An unpaid reservation is released for other buyers after this long.
export const RESERVATION_MINUTES = 30

export function reservationActive(l: Pick<MarketListing, "status" | "reservedAt">, now = Date.now()): boolean {
  return l.status === "reserved" && now - l.reservedAt < RESERVATION_MINUTES * 60 * 1000
}

// Buyable right now: live, or reserved by someone who never finished paying.
export function isListingAvailable(
  l: Pick<MarketListing, "status" | "reservedAt" | "sellingPrice" | "stock">,
  now = Date.now()
): boolean {
  if (l.sellingPrice === null) return false
  // Stock-tracked items sell until the stock runs out; an expired reservation
  // is released by the next checkout attempt.
  if (l.stock !== null && l.status === "active") return l.stock > 0
  return l.status === "active" || (l.status === "reserved" && !reservationActive(l, now))
}

// Whole amounts show no cents ("R24"); anything else always shows two decimals ("R62,40", not "R62,4").
export function formatRand(amount: number | null | undefined): string {
  const value = Math.round((Number(amount) || 0) * 100) / 100
  const digits = Number.isInteger(value) ? 0 : 2
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function toMillis(value: any): number {
  if (!value) return 0
  if (typeof value === "number") return value
  if (value.toMillis) return value.toMillis()
  return 0
}

export function listingFromDoc(id: string, data: any): MarketListing {
  return {
    id,
    sellerId: data.sellerId,
    sellerName: data.sellerName ?? "",
    title: data.title ?? "",
    description: data.description ?? "",
    category: data.category ?? "other",
    condition: data.condition ?? "used_good",
    defects: data.defects ?? "",
    knownIssues: data.knownIssues ?? [],
    specifications: data.specifications ?? "",
    additionalInfo: data.additionalInfo ?? "",
    askingPrice: Number(data.askingPrice) || 0,
    markupAmount: data.markupAmount ?? null,
    sellingPrice: data.sellingPrice ?? null,
    stock: typeof data.stock === "number" ? data.stock : null,
    ratingSum: Number(data.ratingSum) || 0,
    ratingCount: Number(data.ratingCount) || 0,
    location: data.location ?? "",
    images: data.images ?? [],
    reservedAt: toMillis(data.reservedAt),
    status: data.status ?? "pending",
    rejectionReason: data.rejectionReason,
    sellerRemoved: data.sellerRemoved === true,
    createdAt: toMillis(data.createdAt),
  }
}

// The products on an order, whether it was placed with a cart (items) or
// as a single purchase before carts existed (top-level fields).
export function orderLines(
  o: Pick<MarketOrder, "items" | "listingId" | "listingTitle" | "listingImage" | "quantity" | "itemPrice" | "sellerPrice" | "markupAmount">
): MarketOrderLine[] {
  if (o.items && o.items.length > 0) return o.items
  const qty = Number(o.quantity) || 1
  return [
    {
      listingId: o.listingId,
      title: o.listingTitle,
      image: o.listingImage,
      quantity: qty,
      unitPrice: (Number(o.itemPrice) || 0) / qty,
      sellerUnitPrice: (Number(o.sellerPrice) || 0) / qty,
      markupUnit: (Number(o.markupAmount) || 0) / qty,
    },
  ]
}

// "3 x Aluminium Foil, 2 x Whisk" (used on trips, receipts and the admin list).
export function orderSummaryText(lines: Pick<MarketOrderLine, "title" | "quantity">[], max = 160): string {
  const text = lines.map((l) => `${l.quantity} x ${l.title}`).join(", ")
  return text.length > max ? text.slice(0, max - 3).trimEnd() + "..." : text
}

export function orderFromDoc(id: string, data: any): MarketOrder {
  return { ...data, id, createdAt: toMillis(data.createdAt) } as MarketOrder
}

export const LISTING_STATUS_STYLES: Record<ListingStatus, { label: string; className: string }> = {
  pending: { label: "Awaiting review", className: "bg-amber-100 text-amber-800" },
  active: { label: "Live", className: "bg-green-100 text-green-800" },
  reserved: { label: "Reserved", className: "bg-purple-100 text-purple-800" },
  sold: { label: "Sold", className: "bg-blue-100 text-blue-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-700" },
}
