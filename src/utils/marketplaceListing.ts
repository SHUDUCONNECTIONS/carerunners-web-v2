// src/utils/marketplaceListing.ts
// Server-only helpers shared by the admin route (lists on behalf of a company,
// goes live immediately) and the company route (company lists its own item,
// waits for admin review).
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  CONDITIONS,
  KNOWN_ISSUES,
  MARKET_CATEGORIES,
  MARKET_COMPANIES,
  MARKET_LISTINGS,
  MARKET_PICKUP,
  MAX_PHOTOS,
  MIN_PHOTOS,
} from "@/lib/marketplace";
import { priceWithMarkup } from "@/lib/marketplaceMarkup";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export interface ListingInput {
  companyId: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  defects: string;
  knownIssues: string[];
  specifications: string;
  additionalInfo: string;
  companyPrice: number;
  /** Admin only. null = a one-off item. */
  stock: number | null;
  images: string[];
}

// A photo must be one this login uploaded (Storage folder marketplace/<uid>/), so an item can't point at
// someone else's pictures or another website.
export function isOwnPhoto(url: string, uid: string): boolean {
  return /^https?:\/\//.test(url) && url.includes(`/o/marketplace%2F${encodeURIComponent(uid)}%2F`);
}

export function parseListingInput(b: any, opts: { admin: boolean }): { error: string } | { data: ListingInput } {
  const companyPrice = Number(b?.companyPrice);
  const stockRaw = opts.admin && b?.stock !== undefined && b?.stock !== null && b?.stock !== "" ? Number(b.stock) : null;
  const images: string[] = Array.isArray(b?.images) ? b.images.filter((u: unknown) => typeof u === "string") : [];

  const error =
    !str(b?.title) || !str(b?.description) ? "Item name and description are required."
    : !MARKET_CATEGORIES.some((c) => c.id === b?.category) ? "Choose a category."
    : !CONDITIONS.some((c) => c.id === b?.condition) ? "Choose a condition."
    : !str(b?.defects) ? 'Describe any defects or damage (write "None" if there are none).'
    : !Number.isFinite(companyPrice) || companyPrice <= 0 ? "Enter the company's price."
    : stockRaw !== null && (!Number.isInteger(stockRaw) || stockRaw < 1 || stockRaw > 100000) ? "Enter a valid quantity in stock."
    : images.length < MIN_PHOTOS || images.length > MAX_PHOTOS ? `Upload ${MIN_PHOTOS} to ${MAX_PHOTOS} photos.`
    : "";
  if (error) return { error };

  return {
    data: {
      companyId: str(b?.companyId),
      title: str(b.title),
      description: str(b.description),
      category: b.category,
      condition: b.condition,
      defects: str(b.defects),
      knownIssues: (Array.isArray(b.knownIssues) ? b.knownIssues : []).filter((i: string) => KNOWN_ISSUES.includes(i)),
      specifications: str(b.specifications),
      additionalInfo: str(b.additionalInfo),
      companyPrice,
      stock: stockRaw,
      images,
    },
  };
}

// Creates the listing and its private pickup record from the company's own
// details (never from the request). A live listing is priced at the company price plus the
// standard markup (src/lib/marketplaceMarkup.ts); a pending one gets its price when approved.
export async function createListing(
  db: Firestore,
  input: ListingInput,
  createdBy: string,
  status: "active" | "pending"
): Promise<{ id: string } | { error: string; status: number }> {
  const companySnap = await db.collection(MARKET_COMPANIES).doc(input.companyId).get();
  const company = companySnap.data();
  if (!companySnap.exists || !company || company.active === false) {
    return { error: "That company is not available.", status: 404 };
  }

  const listingRef = db.collection(MARKET_LISTINGS).doc();
  const live = status === "active";
  const priced = priceWithMarkup(input.companyPrice);
  const batch = db.batch();
  batch.set(listingRef, {
    sellerId: companySnap.id,
    companyId: companySnap.id,
    sellerName: company.name,
    title: input.title,
    description: input.description,
    category: input.category,
    condition: input.condition,
    defects: input.defects,
    knownIssues: input.knownIssues,
    specifications: input.specifications,
    additionalInfo: input.additionalInfo,
    askingPrice: input.companyPrice,
    markupAmount: live ? priced.markupAmount : null,
    sellingPrice: live ? priced.sellingPrice : null,
    ...(input.stock !== null ? { stock: input.stock } : {}),
    location: company.area,
    images: input.images,
    status: live ? "active" : "pending",
    submittedByCompany: createdBy !== "admin" && status === "pending",
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection(MARKET_PICKUP).doc(listingRef.id), {
    sellerId: companySnap.id,
    address: company.address,
    lat: company.lat,
    lng: company.lng,
    phone: company.phone,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { id: listingRef.id };
}
