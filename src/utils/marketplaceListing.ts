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
  /** Only admins set a markup. Company submissions leave it null for review. */
  markup: number | null;
  /** Admin only. null = a one-off item. */
  stock: number | null;
  images: string[];
}

export function parseListingInput(b: any, opts: { admin: boolean }): { error: string } | { data: ListingInput } {
  const companyPrice = Number(b?.companyPrice);
  const markup = opts.admin ? Number(b?.markup) : null;
  const stockRaw = opts.admin && b?.stock !== undefined && b?.stock !== null && b?.stock !== "" ? Number(b.stock) : null;
  const images: string[] = Array.isArray(b?.images) ? b.images.filter((u: unknown) => typeof u === "string") : [];

  const error =
    !str(b?.title) || !str(b?.description) ? "Item name and description are required."
    : !MARKET_CATEGORIES.some((c) => c.id === b?.category) ? "Choose a category."
    : !CONDITIONS.some((c) => c.id === b?.condition) ? "Choose a condition."
    : !str(b?.defects) ? 'Describe any defects or damage (write "None" if there are none).'
    : !Number.isFinite(companyPrice) || companyPrice <= 0 ? "Enter the company's price."
    : opts.admin && (!Number.isFinite(markup as number) || (markup as number) < 0) ? "Enter a valid markup."
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
      markup,
      stock: stockRaw,
      images,
    },
  };
}

// Creates the listing and its private pickup record from the company's own
// details (never from the request). `status: "active"` needs a markup.
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
  const live = status === "active" && input.markup !== null;
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
    markupAmount: live ? input.markup : null,
    sellingPrice: live ? input.companyPrice + (input.markup as number) : null,
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
