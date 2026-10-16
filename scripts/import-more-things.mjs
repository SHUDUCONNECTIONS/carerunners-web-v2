// Imports the "more things.pdf" kitchen and braai catalogue (63 priced items, October 2026) into
// MarketPortal as live listings owned by Care Runners Wholesale, listed by the admin. Customers pay
// the company's price plus the standard 30% Care Runners markup (same sum as src/lib/marketplaceMarkup.ts).
// Stock is one carton, like the rest of the wholesale catalogue.
//
// 11 of the items were already listed by the wholesale catalogue import (ALREADY_LISTED below). They are
// left alone, except that their price is brought in line with this PDF.
//
//   node scripts/import-more-things.mjs <photo-dir>            dry run, writes nothing
//   node scripts/import-more-things.mjs <photo-dir> --all      import everything
//   node scripts/import-more-things.mjs <photo-dir> --remove   delete only what this script created
//
// <photo-dir> holds one cleaned photo per item, named <item no.>.jpg (the product panel from the PDF,
// with the supplier's price label painted out).
// Uses the Firebase service account from .env.local. Listing ids are fixed (wh-mt-*), so re-running
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
  console.error("Usage: node scripts/import-more-things.mjs <photo-dir> [--all | --remove]");
  process.exit(1);
}

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

const COMPANY_ID = "carerunners-wholesale";
const ID_PREFIX = "wh-mt-";
const STORAGE_PREFIX = "marketplace/wholesale/wh-mt-";

// Same as src/lib/marketplaceMarkup.ts: company price + 30%, in cents.
const MARKUP_RATE = 0.3;
const cents = (n) => Math.round(n * 100) / 100;
const priceWithMarkup = (companyPrice) => {
  const markupAmount = cents(companyPrice * MARKUP_RATE);
  return { markupAmount, sellingPrice: cents(companyPrice + markupAmount) };
};

const KITCHEN = "home_kitchen";

// Item no. -> existing listing id, for items the wholesale catalogue import already listed.
const ALREADY_LISTED = {
  101283: "wh-cat-w_025_1",
  101284: "wh-cat-w_023_1",
  101360: "wh-cat-w_025_2",
  101362: "wh-cat-w_016_0",
  101363: "wh-cat-w_018_2",
  102133: "wh-cat-w_016_1",
  102137: "wh-cat-w_019_1",
  102493: "wh-cat-w_016_2",
  102754: "wh-cat-w_017_0",
  102755: "wh-cat-w_022_2",
  102756: "wh-cat-w_023_0",
};

// [item no., title, model, category, units per carton, company price (R)]
const ITEMS = [
  // Storage and sink
  ["100224", "Bag Sealing Clips, Large, 4 pcs, 16cm", "5810", KITCHEN, 240, 9],
  ["100225", "Bag Sealing Clips, Medium, 5 pcs, 11cm", "5811", KITCHEN, 240, 8],
  ["100226", "Bag Sealing Clips, Small, 5 pcs, 7.2cm", "5812", KITCHEN, 240, 6],
  ["100275", "Stainless Steel Sink Strainer 11.5cm", "", KITCHEN, 288, 10],
  ["100276", "Stainless Steel Sink Strainer 9cm", "", KITCHEN, 288, 9],
  ["100278", "Stainless Steel Perforated Sink Strainer 7.2cm", "", KITCHEN, 288, 7],
  ["101534", "Starfish Silicone Sink Strainer 14cm", "C-326", KITCHEN, 144, 12],
  ["150001", "Diamond-Pattern Non-Slip Shelf Liner 30 x 50cm", "", KITCHEN, 240, 7],
  ["150002", "Diamond-Pattern Non-Slip Shelf Liner 30 x 90cm", "", KITCHEN, 120, 12],
  ["150003", "Diamond-Pattern Non-Slip Shelf Liner 45 x 90cm", "", KITCHEN, 120, 18],
  ["150004", "Diamond-Pattern Non-Slip Shelf Liner 45 x 125cm", "", KITCHEN, 120, 22],
  // Baking, prep and serving
  ["100395", "Silicone Rolling Pin with Wooden Handles 18cm", "1014-38", KITCHEN, 72, 33],
  ["100396", "Silicone Rolling Pin with Wooden Handles 20cm", "1014-37", KITCHEN, 36, 49],
  ["101208", "Maple Wood Cooking Spoons, 3-Piece Set", "", KITCHEN, 144, 18],
  ["101283", "Stainless Steel Fruit Basket 26 x 26 x 10cm", "", KITCHEN, 72, 25],
  ["101284", "Stainless Steel Fruit Basket 32 x 32 x 8cm", "", KITCHEN, 66, 25],
  ["101441", "Slate Serving Board 15 x 10cm", "", KITCHEN, 72, 9],
  ["101444", "Slate Serving Board 32 x 17cm", "", KITCHEN, 24, 21],
  ["102754", "Coloured PP Chopping Board 33 x 20 x 0.8cm", "", KITCHEN, 36, 24],
  ["102755", "Coloured PP Chopping Board 37 x 23 x 0.8cm", "", KITCHEN, 24, 31],
  ["102756", "Coloured PP Chopping Board 40 x 25 x 0.8cm", "", KITCHEN, 24, 33],
  ["104696", "Chopping Board Set with Stand, 4 pcs, 27 x 18.5cm", "9098", KITCHEN, 12, 135],
  ["103765", "Bamboo Serving Tray 22.5 x 32.5cm", "", KITCHEN, 24, 65],
  ["103767", "Bamboo Serving Tray, Ribbed, 24 x 36cm", "", KITCHEN, 24, 71],
  ["104922", "Silicone Pinch Oven Mitt, Small", "W037", KITCHEN, 144, 9],
  // Frying and air fryer
  ["101360", "Stainless Steel Round Basket 9cm", "", KITCHEN, 100, 39],
  ["101362", "Stainless Steel Frying Basket 20cm", "", KITCHEN, 100, 16],
  ["101363", "Stainless Steel Frying Basket 22cm", "", KITCHEN, 100, 16],
  ["105357", "Collapsible Silicone Air Fryer Liner, Round, 20cm", "", KITCHEN, 72, 32],
  ["105358", "Collapsible Silicone Air Fryer Liner, Square, 20cm", "", KITCHEN, 72, 36],
  // Braai
  ["101668", "BBQ Skewers, Iron, 6 pcs, 20cm", "SQ-20", KITCHEN, 48, 22],
  ["101669", "BBQ Skewers, Iron, 6 pcs, 30cm", "SQ-30", KITCHEN, 48, 24],
  ["101675", "BBQ Skewers with Wooden Handles, 6 pcs, 38cm", "S101-38", KITCHEN, 24, 29],
  ["101676", "BBQ Skewers with Wooden Handles, 6 pcs, 45cm", "S101-45", KITCHEN, 24, 32],
  ["102133", "Bamboo Skewers, 3mm x 25cm, 60 pcs", "", KITCHEN, 144, 5],
  ["102137", "Bamboo Skewers, 5mm x 40cm, 20 pcs", "", KITCHEN, 144, 4],
  ["101683", "BBQ Tongs with Wooden Handle, 38cm", "TW-317T", KITCHEN, 48, 40],
  ["101686", "Stainless Steel Scissor Tongs 35.5cm", "TO-06LPP", KITCHEN, 72, 17],
  ["101687", "Stainless Steel Scissor Tongs 29cm", "TO-06S", KITCHEN, 72, 16],
  ["102493", "Bamboo Tongs 30cm", "", KITCHEN, 120, 13],
  ["101689", "3-in-1 Grill Cleaning Brush", "BP-05S", KITCHEN, 96, 24],
  ["101690", "Stainless Steel Coil Grill Brush 30.5cm", "BP-307S", KITCHEN, 72, 27],
  ["101692", "BBQ Grill Basket with Wooden Handle 64 x 40cm", "G5-02C", KITCHEN, 24, 64],
  ["101693", "BBQ Grill Basket with Wooden Handle 57 x 35cm", "G5-23C", KITCHEN, 28, 54],
  ["101694", "BBQ Grill Basket with Wooden Handle 53 x 23cm", "G5-05C", KITCHEN, 28, 49],
  ["102729", "Folding Charcoal BBQ Grill 48 x 31 x 39cm", "", KITCHEN, 6, 249],
  // Placemats
  ["101350", "Round Woven Placemat 38cm", "", KITCHEN, 144, 12],
  ["101351", "Rectangular Woven Placemat 30 x 45cm", "", KITCHEN, 144, 12],
  ["102446", "Woven Placemat, Beige, 30 x 45cm", "16377-1", KITCHEN, 240, 9],
  ["102457", "Woven Placemat, Navy Stripe, 30 x 45cm", "16377-5", KITCHEN, 240, 9],
  ["102463", "Woven Placemat, Wine Glass Pattern, 30 x 45cm", "16377-8", KITCHEN, 240, 9],
  ["102470", "Woven Placemat, Charcoal, 30 x 45cm", "16377-9", KITCHEN, 240, 9],
  ["102903", "Plastic Placemat, City Landmarks, 43 x 28cm", "", KITCHEN, 240, 5],
  ["102908", "Plastic Placemat, Feathers, 43 x 28cm", "", KITCHEN, 240, 5],
  ["102910", "Plastic Placemat, Teacups, 43 x 28cm", "", KITCHEN, 240, 5],
  ["102912", "Plastic Placemat, Restaurant Lettering, 43 x 28cm", "", KITCHEN, 240, 5],
  ["102918", "Plastic Placemat, Wildflowers, 43 x 28cm", "", KITCHEN, 240, 5],
  ["102919", "Plastic Placemat, Leaf Sprigs, 43 x 28cm", "", KITCHEN, 240, 5],
  ["102927", "Plastic Placemat, Iced Coffee, 43 x 28cm", "", KITCHEN, 240, 5],
  ["102933", "Woven Straw Placemat, Round, 20cm", "", KITCHEN, 144, 16],
  ["102934", "Woven Straw Placemat, Round, 25cm", "", KITCHEN, 60, 23],
  ["102935", "Woven Straw Placemat, Round, 30cm", "", KITCHEN, 60, 28],
  ["102936", "Woven Straw Placemat, Round, 35cm", "", KITCHEN, 60, 40],
];

const all = ITEMS.map(([itemNo, name, model, category, carton, price]) => ({
  itemNo,
  id: ALREADY_LISTED[itemNo] ?? ID_PREFIX + itemNo,
  existing: !!ALREADY_LISTED[itemNo],
  title: model ? `${name} (${model})` : name,
  description: `Item no. ${itemNo}. Brand new, sold per piece. Supplied in cartons of ${carton}.`,
  category,
  price,
  stock: carton,
  photo: path.join(photoDir, `${itemNo}.jpg`),
}));
const products = all.filter((p) => !p.existing);
const existing = all.filter((p) => p.existing);

if (new Set(all.map((p) => p.itemNo)).size !== all.length) throw new Error("Duplicate item numbers");
if (all.length !== 63) throw new Error(`Expected 63 items, found ${all.length}`);
const bad = all.filter((p) => !(p.price > 0) || !(p.stock > 0) || (!p.existing && !fs.existsSync(p.photo)));
if (bad.length) throw new Error(`Bad price/stock/photo on: ${bad.map((p) => p.itemNo).join(", ")}`);

if (mode === "dry") {
  console.log(`Dry run: ${products.length} new products under Care Runners Wholesale (${COMPANY_ID}); ${existing.length} already listed (prices checked).`);
  for (const p of products.slice(0, 5)) console.log(`  ${p.id}  ${p.title}  R${p.price} -> R${priceWithMarkup(p.price).sellingPrice}  stock ${p.stock}`);
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
  console.log(`Removed ${products.length} listings and their photos. The ${existing.length} older listings were not touched.`);
}

async function upload(file, dest) {
  const token = crypto.randomUUID();
  await bucket.upload(file, {
    destination: dest,
    metadata: { contentType: "image/jpeg", metadata: { firebaseStorageDownloadTokens: token } },
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

// Older listings keep everything (photos, stock, sales) except a price that differs from this PDF.
async function syncExistingPrices() {
  const snaps = await db.getAll(...existing.map((p) => db.collection("marketplaceListings").doc(p.id)));
  for (const [i, s] of snaps.entries()) {
    const p = existing[i];
    if (!s.exists) throw new Error(`${p.id} (item ${p.itemNo}) no longer exists`);
    const was = Number(s.data().askingPrice);
    if (was === p.price) continue;
    await s.ref.update({ askingPrice: p.price, ...priceWithMarkup(p.price), updatedAt: FieldValue.serverTimestamp() });
    console.log(`Price updated: ${p.id} (item ${p.itemNo}) R${was} -> R${p.price} (customers pay R${priceWithMarkup(p.price).sellingPrice})`);
  }
}

async function importProducts() {
  const company = (await db.collection("marketplaceCompanies").doc(COMPANY_ID).get()).data();
  if (!company || company.active === false) throw new Error(`Company ${COMPANY_ID} is missing or inactive.`);

  await syncExistingPrices();

  let done = 0;
  await pool(products, 8, async (p) => {
    const image = await upload(p.photo, `${STORAGE_PREFIX}${p.itemNo}.jpg`);
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
    if (++done % 20 === 0 || done === products.length) console.log(`${done}/${products.length}`);
  });
}

if (mode === "remove") await removeAll();
else await importProducts();
process.exit(0);
