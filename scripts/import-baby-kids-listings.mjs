// Imports six baby and kids' items (WhatsApp photos, 22 October 2026) into MarketPortal as live
// listings owned by Care Runners Wholesale, listed by the admin. Customers pay the company's price
// plus the standard 30% Care Runners markup (same sum as src/lib/marketplaceMarkup.ts).
// Stock is one of each.
//
//   node scripts/import-baby-kids-listings.mjs <photo-dir>            dry run, writes nothing
//   node scripts/import-baby-kids-listings.mjs <photo-dir> --all      import everything
//   node scripts/import-baby-kids-listings.mjs <photo-dir> --remove   delete only what this script created
//
// <photo-dir> holds one cleaned photo per item, named <id suffix>.jpg as in ITEMS below (the supplier's
// price labels cropped off, and children's faces blurred).
// Uses the Firebase service account from .env.local. Listing ids are fixed (wh-bk-*), so re-running
// refreshes the same documents instead of duplicating them. The company itself is not touched.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const photoDir = args.find((a) => !a.startsWith("--"));
const mode = args.includes("--remove") ? "remove" : args.includes("--all") ? "all" : "dry";
if (!photoDir) {
  console.error("Usage: node scripts/import-baby-kids-listings.mjs <photo-dir> [--all | --remove]");
  process.exit(1);
}

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

const COMPANY_ID = "carerunners-wholesale";
const ID_PREFIX = "wh-bk-";
const STORAGE_PREFIX = "marketplace/wholesale/wh-bk-";

// Same as src/lib/marketplaceMarkup.ts: company price + 30%, in cents.
const MARKUP_RATE = 0.3;
const cents = (n) => Math.round(n * 100) / 100;
const priceWithMarkup = (companyPrice) => {
  const markupAmount = cents(companyPrice * MARKUP_RATE);
  return { markupAmount, sellingPrice: cents(companyPrice + markupAmount) };
};

const TOYS = "toys_games";
const BABY = "baby_items";

// [id suffix, title, category, company price (R), description]
const ITEMS = [
  [
    "bath-set",
    "Bear Family Baby Bath Set, 7 pcs",
    BABY,
    750,
    "Baby bath and potty set in cream and mocha with the Bear Family design. Includes a baby bathtub with " +
      "removable bath support, potty chair with lid, wash basin, lidded storage bucket, storage basket with " +
      "handles, water scoop and a small cotton-bud holder.",
  ],
  [
    "bedside-crib",
    "Bedside Baby Crib with Mosquito Net and Mobile",
    BABY,
    1600,
    "Wooden-look bedside crib with a giraffe design, breathable mesh sides, a mosquito net canopy, a hanging " +
      "mobile, a storage basket underneath and lockable wheels.",
  ],
  [
    "fleece-blanket",
    "Pink Star Plush Fleece Baby Blanket",
    BABY,
    250,
    "Thick, soft plush fleece blanket in pink with white stars and an embossed flower pattern. Warm for " +
      "the cot, pram or car seat.",
  ],
  [
    "chicco-carrier",
    "Chicco Baby Carrier",
    BABY,
    320,
    "Ergonomic front baby carrier from Chicco with adjustable straps and padded material. Available in " +
      "beige, blue or red; say which colour you want when you order.",
  ],
  [
    "trampoline",
    "Kids' Trampoline with Safety Net",
    TOYS,
    700,
    "Kids' trampoline with a full safety net enclosure, padded poles, a padded spring cover and steel legs. " +
      "For indoor or outdoor use. Only one available.",
  ],
  [
    "baby-lounger",
    "Baby Lounger Sleep Nest, Grey Clouds",
    BABY,
    350,
    "Soft, padded baby lounger in white and grey with a cloud print, raised sides and a carry handle. " +
      "Use only while baby is supervised.",
  ],
];

const products = ITEMS.map(([suffix, title, category, price, description]) => ({
  id: ID_PREFIX + suffix,
  title,
  description: `${description} Brand new.`,
  category,
  price,
  stock: 1,
  photo: path.join(photoDir, `${suffix}.jpg`),
}));

const ids = new Set(products.map((p) => p.id));
if (ids.size !== products.length) throw new Error("Duplicate listing ids");
const bad = products.filter((p) => !(p.price > 0) || !(p.stock > 0) || !fs.existsSync(p.photo));
if (bad.length) throw new Error(`Bad price/stock/photo on: ${bad.map((p) => p.id).join(", ")}`);

if (mode === "dry") {
  console.log(`Dry run: ${products.length} products would be imported under Care Runners Wholesale (${COMPANY_ID}).`);
  for (const p of products) console.log(`  ${p.id}  ${p.title}  R${p.price} -> R${priceWithMarkup(p.price).sellingPrice}  stock ${p.stock}`);
  console.log("Re-run with --all to write to Firebase.");
  process.exit(0);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
});
const db = getFirestore();
const bucket = getStorage().bucket();

async function removeAll() {
  const batch = db.batch();
  for (const p of products) {
    batch.delete(db.collection("marketplaceListings").doc(p.id));
    batch.delete(db.collection("marketplacePickup").doc(p.id));
  }
  await batch.commit();
  await bucket.deleteFiles({ prefix: STORAGE_PREFIX }).catch(() => {});
  console.log(`Removed ${products.length} listings and their photos.`);
}

async function upload(file, dest) {
  const token = crypto.randomUUID();
  await bucket.upload(file, {
    destination: dest,
    metadata: { contentType: "image/jpeg", metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
}

async function importProducts() {
  const company = (await db.collection("marketplaceCompanies").doc(COMPANY_ID).get()).data();
  if (!company || company.active === false) throw new Error(`Company ${COMPANY_ID} is missing or inactive.`);

  for (const p of products) {
    const image = await upload(p.photo, `${STORAGE_PREFIX}${p.id.slice(ID_PREFIX.length)}.jpg`);
    const batch = db.batch();
    batch.set(db.collection("marketplaceListings").doc(p.id), {
      sellerId: COMPANY_ID,
      companyId: COMPANY_ID,
      sellerName: company.name,
      title: p.title,
      description: p.description,
      category: p.category,
      condition: "new",
      defects: "None",
      knownIssues: [],
      specifications: "",
      additionalInfo: "",
      askingPrice: p.price,
      ...priceWithMarkup(p.price),
      stock: p.stock,
      location: company.area,
      images: [image],
      status: "active",
      createdBy: "admin",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("marketplacePickup").doc(p.id), {
      sellerId: COMPANY_ID,
      address: company.address,
      lat: company.lat,
      lng: company.lng,
      phone: company.phone,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    console.log(`${p.id}  R${priceWithMarkup(p.price).sellingPrice}`);
  }
}

if (mode === "remove") await removeAll();
else await importProducts();
process.exit(0);
