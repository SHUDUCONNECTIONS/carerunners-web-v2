// Imports the October 2026 toy catalogue ("new listings.pdf", 92 priced items) into MarketPortal as
// live listings owned by Care Runners Wholesale, listed by the admin. Customers pay the company's
// price plus the standard 30% Care Runners markup (same sum as src/lib/marketplaceMarkup.ts).
// Stock is one carton, like the rest of the wholesale catalogue.
//
//   node scripts/import-new-listings.mjs <photo-dir>            dry run, writes nothing
//   node scripts/import-new-listings.mjs <photo-dir> --all      import everything
//   node scripts/import-new-listings.mjs <photo-dir> --remove   delete only what this script created
//
// <photo-dir> holds one cleaned photo per item, named <photo>.jpg as in ITEMS below (the photos were
// taken from the PDF with the supplier's price labels cut off).
// Uses the Firebase service account from .env.local. Listing ids are fixed (wh-nl-*), so re-running
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
  console.error("Usage: node scripts/import-new-listings.mjs <photo-dir> [--all | --remove]");
  process.exit(1);
}

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

const COMPANY_ID = "carerunners-wholesale";
const ID_PREFIX = "wh-nl-";
const STORAGE_PREFIX = "marketplace/wholesale/wh-nl-";

// Same as src/lib/marketplaceMarkup.ts: company price + 30%, in cents.
const MARKUP_RATE = 0.3;
const cents = (n) => Math.round(n * 100) / 100;
const priceWithMarkup = (companyPrice) => {
  const markupAmount = cents(companyPrice * MARKUP_RATE);
  return { markupAmount, sellingPrice: cents(companyPrice + markupAmount) };
};

const TOYS = "toys_games";
const BABY = "baby_items";
const CRAFT = "stationery_craft";

// [item no., id suffix, title, model, category, units per carton, company price (R)]
// The PDF reuses 52124 and 52137 for two products each; the second of each gets its own id.
const ITEMS = [
  // Die-cast and pull-back vehicles
  ["52091", "52091", "Free-Wheel Alloy Cars, 24 pcs Assorted", "KZ957-132", TOYS, 96, 48],
  ["52092", "52092", "Free-Wheel Alloy Cars, 36 pcs Assorted", "KZ957-133", TOYS, 72, 71],
  ["52093", "52093", "Pull-Back Alloy Cars, 48 pcs Assorted", "KZ957-134A", TOYS, 48, 98],
  ["52094", "52094", "Pull-Back Alloy Lamborghini Cars, 4 pcs", "KZ957-135", TOYS, 288, 13],
  ["52095", "52095", "Pull-Back Alloy Fire Trucks, 4 pcs Assorted", "KZ957-135C", TOYS, 288, 15],
  ["52096", "52096", "Pull-Back Alloy Police Cars, 4 pcs Assorted", "KZ957-135D", TOYS, 288, 15],
  ["52097", "52097", "Pull-Back Alloy Military Vehicles, 6 pcs Assorted", "KZ957-136F", TOYS, 216, 22],
  ["52098", "52098", "Pull-Back Alloy Fire Trucks and Police Cars, 12 pcs", "KZ957-138C", TOYS, 120, 42],
  ["52099", "52099", "Pull-Back Alloy Fighter Jets, 2 pcs", "KZ957-142A", TOYS, 288, 10],
  ["52100", "52100", "Pull-Back Alloy Fighter Jets, 3 pcs", "KZ957-143", TOYS, 216, 13],
  ["52101", "52101", "Pull-Back Alloy Fighter Jets, 4 pcs", "KZ957-144", TOYS, 144, 17],
  ["52102", "52102", "Pull-Back Alloy Fire, Police, Construction and Military Vehicles, 40 pcs", "KZ957-150B", TOYS, 24, 177],
  // Remote-control vehicles
  ["52135", "52135", "2-Channel Remote Control Fighter Jet with Lights and Music", "J031-L", TOYS, 36, 98],
  ["52136", "52136", "4-Channel Remote Control Fire Truck, Aerial Platform", "525-3A", TOYS, 54, 114],
  ["52137", "52137", "4-Channel Remote Control Fire Truck, Water Tanker", "525-2A", TOYS, 54, 114],
  ["52137", "52137-525-1a", "4-Channel Remote Control Fire Truck, Ladder", "525-1A", TOYS, 54, 114],
  ["52142", "52142", "Remote Control Off-Road Jeep 1:8 with Steering Wheel Controller", "388-22", TOYS, 4, 770],
  ["52181", "52181", "Remote Control Mustang Police Car 1:10, 4-Channel with Headlights", "789-208A-1", TOYS, 12, 230],
  ["52245", "52245", "Remote Control Alloy Rock Crawler 1:8, 6WD", "XP999-2", TOYS, 4, 895],
  // Building, take-apart and ride-on
  ["52026", "52026", "Take-Apart Dinosaur with Screwdriver, Assorted", "RC10", TOYS, 216, 20],
  ["52124", "52124", "Mecha Dinosaur Building Blocks, Triceratops, 383 pcs", "8806", TOYS, 60, 83],
  ["52124", "52124-8805", "Mecha Dinosaur Building Blocks, T-Rex, 405 pcs", "8805", TOYS, 60, 83],
  ["52126", "52126", "Mecha Dinosaur Building Blocks, Velociraptor, 388 pcs", "8808", TOYS, 60, 83],
  ["52148", "52148", "Take-Apart Farm Vehicles: Bulldozer, Grass Loader and Road Roller", "05103-4", TOYS, 96, 37],
  ["52149", "52149", "Take-Apart Construction Trucks, 3 Styles Assorted", "05102-1", TOYS, 144, 27],
  ["52150", "52150", "Take-Apart Fire and Sanitation Trucks, 3 Styles Assorted", "05102-3", TOYS, 144, 27],
  ["52131", "52131", "Bouncy Ride-On Animal, Painted, with Music", "NB-1832", TOYS, 30, 105],
  ["52132", "52132", "Bouncy Ride-On Horse, Large, Classic", "NB-1866", TOYS, 30, 105],
  // Pretend play: toy appliances and shop
  ["52151", "52151", "Toy Cash Register with Conveyor Belt, Basket, Calculator and Microphone", "813-98", TOYS, 30, 159],
  ["52152", "52152", "Toy Cash Register and Card Machine with Calculator and Microphone, Red", "813-102", TOYS, 30, 159],
  ["52185", "52185", "Toy Electric Talking Cash Register", "LS820A2", TOYS, 96, 67],
  ["52201", "52201", "Toy Cash Register with Lights and Sound", "LS820A65", TOYS, 144, 39],
  ["52186", "52186", "Toy Washing Machine with Lights and Music", "LS820Q6", TOYS, 60, 95],
  ["52187", "52187", "Toy Microwave with Lights and Turntable", "LS820Q7", TOYS, 48, 100],
  ["52188", "52188", "Toy Vacuum Cleaner, Electric with Lights", "LS820Q52", TOYS, 54, 91],
  ["52189", "52189", "Toy Juicer and Mixer Set, Electric", "LS8230Q", TOYS, 30, 150],
  ["52190", "52190", "Toy Microwave Oven, Electric", "LS820Q34", TOYS, 72, 65],
  ["52191", "52191", "Toy Oven and Mixer Set, Electric", "LS8348Q", TOYS, 30, 145],
  ["52192", "52192", "Toy Juicer and Coffee Machine Set with Lights", "LS8350Q", TOYS, 30, 145],
  ["52193", "52193", "Toy Toaster and Juicer Set with Lights and Sound", "LS8349Q", TOYS, 30, 145],
  ["52194", "52194", "Toy Washing Machine and Vacuum Cleaner Set, Electric", "LS8344Q", TOYS, 30, 145],
  ["52195", "52195", "Toy Coffee Machine with Water Pump, Lights and Sound", "LS820Q39-7", TOYS, 96, 54],
  ["52196", "52196", "Toy Oven with Lights and Sound", "LS820Q37-7", TOYS, 96, 51],
  ["52197", "52197", "Toy Vacuum Cleaner with Lights, Small", "LS820Q30-7", TOYS, 120, 49],
  ["52198", "52198", "Toy Kitchen with Lights and Music", "LS820Q27-7", TOYS, 120, 45],
  ["52199", "52199", "Toy Fridge with Lights and Music", "LS820Q26-7", TOYS, 120, 45],
  ["52200", "52200", "Toy Washing Machine and Ironing Board Set, Electric", "LS8297Q", TOYS, 36, 102],
  // Dolls, dress-up and kids' makeup
  ["52133", "52133", "11.5 Inch Fashion Doll with Accessories, Assorted", "HS686B4", TOYS, 144, 36],
  ["52134", "52134", "11.5 Inch Fashion Doll with Accessories, Assorted", "HS686B1", TOYS, 144, 36],
  ["52153", "52153", "Light-Up Bat Wings with Music", "813-72", TOYS, 24, 176],
  ["52154", "52154", "Light-Up Flower Fairy Wings with Music", "813-79", TOYS, 24, 214],
  ["52155", "52155", "Light-Up Dream Wings, Iridescent", "813-94", TOYS, 48, 150],
  ["52177", "52177", "Kids Makeup Set", "ZR-44D", TOYS, 96, 64],
  ["52178", "52178", "Kids Lipstick and Nail Set in Zip Bag", "ZR-64D", TOYS, 288, 34],
  ["52179", "52179", "Kids Nail Polish Set in Zip Bag", "ZR-64A", TOYS, 288, 33],
  ["52180", "52180", "Kids Nail Art Set with Stickers and Press-On Nails", "ZR-65A", TOYS, 108, 67],
  ["52202", "52202", "Kids Makeup and Bead Craft Box", "MNY-10061A", TOYS, 72, 49],
  ["52203", "52203", "Kids Makeup and Bead Craft Box, Winter", "MNY-10061D", TOYS, 72, 49],
  ["52204", "52204", "Kids Makeup and Bead Craft Box, Large", "MNY-10062A", TOYS, 48, 64],
  ["52205", "52205", "Kids Makeup and Bead Craft Box, Large, Winter", "MNY-10062D", TOYS, 48, 64],
  ["52206", "52206", "Girls Makeup Set in Carry Case", "", TOYS, 24, 127],
  // Musical toys
  ["52218", "52218", "Rainbow Roll-Up Piano, 49 Keys", "666-33A", TOYS, 24, 285],
  ["52219", "52219", "Rainbow Roll-Up Piano, 37 Keys", "666-32", TOYS, 24, 240],
  ["52220", "52220", "Rainbow Roll-Up Piano, 25 Keys", "666-31", TOYS, 24, 196],
  ["52221", "52221", "Jazz Drum Kit with Keyboard, Microphone and Stool", "6611D", TOYS, 6, 665],
  // Outdoor, beach and water
  ["52139", "52139", "Beach Toy Set in Mesh Backpack, 10 pcs", "666-157TB", TOYS, 216, 56],
  ["52156", "52156", "Beach Boat Toy Set, 7 pcs", "8295-15F", TOYS, 36, 62],
  ["52165", "52165", "Beach Toy Set with Folding Bucket, 5 pcs", "2301XW", TOYS, 48, 76],
  ["52166", "52166", "Beach Toy Set in Mesh Bag, 8 pcs", "B2401-5", TOYS, 48, 68],
  ["52167", "52167", "Beach Truck", "307-309MH", TOYS, 108, 22],
  ["52168", "52168", "Beach Toy Set, 8 pcs", "222-2Y", TOYS, 108, 28],
  ["52173", "52173", "Soft Foam Dart Blaster Set with Target", "YL-6187", TOYS, 60, 64],
  ["52250", "52250", "Foam Water Shooter, 30cm", "BX-0730P", TOYS, 120, 20],
  ["52251", "52251", "Foam Water Shooter, 38cm", "BX-0438", TOYS, 360, 11],
  ["52084", "52084", "Magnetic Fishing Game with Rod and Net", "", TOYS, 144, 29],
  ["52085", "52085", "Magnetic Fishing Game with Rod", "", TOYS, 240, 21],
  // Baby items
  ["52105", "52105", "Puzzle Busy Box Activity Cube", "BY207", BABY, 64, 61],
  ["52106", "52106", "Baby Rattles, 8 Styles Assorted", "BY108", BABY, 240, 17],
  ["52107", "52107", "Baby Dinosaur Piano and Xylophone", "BY301", BABY, 36, 80],
  ["52108", "52108", "Peacock Pop-It Sensory Toy", "BY227", BABY, 60, 53],
  ["52109", "52109", "Unicorn Suction Spinner Toys, 3 Styles Assorted", "BY247", BABY, 48, 71],
  ["52120", "52120", "Baby Musical Piano with Lights, Cow", "2867-4", BABY, 72, 63],
  ["52121", "52121", "Baby Musical Piano with Lights, Bear", "2867-3", BABY, 72, 63],
  ["52122", "52122", "Baby Musical Piano with Lights, Deer", "2867-2", BABY, 72, 63],
  ["52123", "52123", "Baby Musical Piano with Lights, Elephant", "2867-1", BABY, 72, 63],
  ["52143", "52143", "Baby Rattle with Lights and Sound, Microphone", "2866-5", BABY, 96, 40],
  ["52144", "52144", "Baby Rattle with Lights and Sound, Guitar", "2866-4", BABY, 96, 40],
  ["52145", "52145", "Baby Rattle with Lights and Sound, Crocodile", "2866-3", BABY, 96, 40],
  ["52146", "52146", "Soft Baby Grip Ball, Small", "2801", BABY, 240, 15],
  ["52147", "52147", "Soft Baby Hand Rattle, Assorted", "2862-7", BABY, 180, 18],
  // Stationery and craft
  ["52140", "52140", "DIY Glue Painting Kit, Zodiac Set B", "7612", CRAFT, 72, 67],
  ["52141", "52141", "DIY Glue Painting Kit, Zodiac Set A", "7611", CRAFT, 72, 67],
];

const products = ITEMS.map(([itemNo, suffix, name, model, category, carton, price]) => ({
  id: ID_PREFIX + suffix,
  title: model ? `${name} (${model})` : name,
  description: `Item no. ${itemNo}. Brand new, sold per piece. Supplied in cartons of ${carton}.`,
  category,
  price,
  stock: carton,
  photo: path.join(photoDir, `${suffix}.jpg`),
}));

const ids = new Set(products.map((p) => p.id));
if (ids.size !== products.length) throw new Error("Duplicate listing ids");
const bad = products.filter((p) => !(p.price > 0) || !(p.stock > 0) || !fs.existsSync(p.photo));
if (bad.length) throw new Error(`Bad price/stock/photo on: ${bad.map((p) => p.id).join(", ")}`);

if (mode === "dry") {
  console.log(`Dry run: ${products.length} products would be imported under Care Runners Wholesale (${COMPANY_ID}).`);
  const byCat = {};
  for (const p of products) byCat[p.category] = (byCat[p.category] ?? 0) + 1;
  console.log(byCat);
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
  const company = (await db.collection("marketplaceCompanies").doc(COMPANY_ID).get()).data();
  if (!company || company.active === false) throw new Error(`Company ${COMPANY_ID} is missing or inactive.`);

  let done = 0;
  await pool(products, 8, async (p) => {
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
    if (++done % 20 === 0 || done === products.length) console.log(`${done}/${products.length}`);
  });
}

if (mode === "remove") await removeAll();
else await importProducts();
process.exit(0);
