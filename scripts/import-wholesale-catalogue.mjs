// Imports the wholesale catalogue (6 laptops + ~1,200 wholesale items) into MarketPortal
// as live listings owned by one company, listed by the admin. Customers pay the company's price
// plus the standard 30% Care Runners markup (same sum as src/lib/marketplaceMarkup.ts); delivery is
// charged per order at checkout.
//
//   node scripts/import-wholesale-catalogue.mjs <seed-dir>            dry run, writes nothing
//   node scripts/import-wholesale-catalogue.mjs <seed-dir> --sample   import the laptops + 10 items
//   node scripts/import-wholesale-catalogue.mjs <seed-dir> --all      import everything
//   node scripts/import-wholesale-catalogue.mjs <seed-dir> --remove   delete everything this script created
//
// <seed-dir> is the old app folder that holds scripts/marketplace-seed/{laptops,catalog}.json
// and public/marketplace/** (the product photos).
// Uses the Firebase service account from .env.local. Listing ids are fixed (wh-*), so
// re-running refreshes the same documents instead of duplicating them.
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
const seedDir = args.find((a) => !a.startsWith("--"));
const mode = args.includes("--remove") ? "remove" : args.includes("--all") ? "all" : args.includes("--sample") ? "sample" : "dry";
if (!seedDir) {
  console.error("Usage: node scripts/import-wholesale-catalogue.mjs <seed-dir> [--sample | --all | --remove]");
  process.exit(1);
}

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

const COMPANY_ID = "carerunners-wholesale";

// Same as src/lib/marketplaceMarkup.ts: company price + 30%, in cents.
const MARKUP_RATE = 0.3;
const cents = (n) => Math.round(n * 100) / 100;
const priceWithMarkup = (companyPrice) => {
  const markupAmount = cents(companyPrice * MARKUP_RATE);
  return { markupAmount, sellingPrice: cents(companyPrice + markupAmount) };
};
const ID_PREFIX = "wh-";
const STORAGE_PREFIX = "marketplace/wholesale/";

// Every pickup is made at 1 Mark Shuttleworth Street, Lynnwood (Google geocode, rooftop accuracy).
const company = {
  name: "Care Runners Wholesale",
  contactName: "Care Runners",
  contactEmail: "",
  phone: "",
  address: "1 Mark Shuttleworth Street, Lynnwood, Pretoria, 0087, South Africa",
  area: "Lynnwood, Pretoria",
  lat: -25.7484393,
  lng: 28.2671027,
  bank: { accountHolder: "", bankId: "", accountNumber: "", accountType: "cheque", branchCode: "" },
  loginEmails: [],
  active: true,
};

const CATEGORY = {
  "Computers & Phones": "computers_phones",
  "Home & Kitchen": "home_kitchen",
  "Toys & Games": "toys_games",
  "Stationery & Craft": "stationery_craft",
  Other: "other",
};
const CONDITION = { New: "new", "Used – Good": "used_good", "Used – Fair": "used_fair", "Used – Excellent": "used_excellent" };

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(seedDir, "scripts", "marketplace-seed", f), "utf8"));
const laptops = readJson("laptops.json").map((l, i) => ({ ...l, id: `laptop-${i}`, category: "Computers & Phones" }));
const catalog = readJson("catalog.json");

const products = [...laptops, ...catalog].map((p) => {
  const category = CATEGORY[p.category];
  const condition = CONDITION[p.condition];
  if (!category || !condition) throw new Error(`Unmapped category/condition on ${p.id}: ${p.category} / ${p.condition}`);
  return {
    id: ID_PREFIX + p.id,
    title: p.name,
    description: p.description,
    category,
    condition,
    defects: p.defects || "None",
    price: Number(p.costPrice),
    stock: Number(p.stock),
    photos: p.images.slice(0, 5).map((i) => path.join(seedDir, "public", i)),
  };
});

const bad = products.filter((p) => !(p.price > 0) || !(p.stock >= 0) || p.photos.some((f) => !fs.existsSync(f)));
if (bad.length) throw new Error(`Bad price/stock/photo on: ${bad.map((p) => p.id).join(", ")}`);

const selected = mode === "sample" ? [...products.slice(0, 6), ...products.slice(6, 16)] : products;

if (mode === "dry") {
  console.log(`Dry run: ${products.length} products would be imported under "${company.name}" (${COMPANY_ID}).`);
  const byCat = {};
  for (const p of products) byCat[p.category] = (byCat[p.category] ?? 0) + 1;
  console.log(byCat);
  console.log("Photos to upload:", products.reduce((n, p) => n + p.photos.length, 0));
  console.log("Re-run with --sample or --all to write to Firebase.");
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
  const snap = await db.collection("marketplaceListings").where("companyId", "==", COMPANY_ID).get();
  for (let i = 0; i < snap.docs.length; i += 200) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 200)) {
      batch.delete(d.ref);
      batch.delete(db.collection("marketplacePickup").doc(d.id));
    }
    await batch.commit();
  }
  await db.collection("marketplaceCompanies").doc(COMPANY_ID).delete();
  await bucket.deleteFiles({ prefix: STORAGE_PREFIX }).catch(() => {});
  console.log(`Removed ${snap.size} listings, the company and its photos.`);
}

async function upload(file, dest) {
  const token = crypto.randomUUID();
  const ext = path.extname(file).toLowerCase();
  await bucket.upload(file, {
    destination: dest,
    metadata: { contentType: ext === ".png" ? "image/png" : "image/jpeg", metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
}

// Runs fn over items with a few in flight at once.
async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

async function importProducts() {
  await db.collection("marketplaceCompanies").doc(COMPANY_ID).set(
    { ...company, termsVersion: "wholesale", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  let done = 0;
  await pool(selected, 8, async (p) => {
    const images = [];
    for (const [i, file] of p.photos.entries()) {
      images.push(await upload(file, `${STORAGE_PREFIX}${p.id}-${i + 1}${path.extname(file).toLowerCase()}`));
    }
    const batch = db.batch();
    batch.set(db.collection("marketplaceListings").doc(p.id), {
      sellerId: COMPANY_ID,
      companyId: COMPANY_ID,
      sellerName: company.name,
      title: p.title,
      description: p.description,
      category: p.category,
      condition: p.condition,
      defects: p.defects,
      knownIssues: [],
      specifications: "",
      additionalInfo: "",
      askingPrice: p.price,
      ...priceWithMarkup(p.price),
      stock: p.stock,
      location: company.area,
      images,
      status: p.stock > 0 ? "active" : "sold",
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
    if (++done % 50 === 0 || done === selected.length) console.log(`${done}/${selected.length}`);
  });
}

if (mode === "remove") await removeAll();
else await importProducts();
process.exit(0);
