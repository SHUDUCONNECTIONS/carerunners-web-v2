// Re-prices every MarketPortal listing to the company price plus the standard Care Runners markup
// (30%, same sum as src/lib/marketplaceMarkup.ts). Items waiting for review are left alone: they get
// their price when an admin approves them. Orders already placed keep the price they were placed at.
//
//   node scripts/apply-marketplace-markup.mjs           dry run, writes nothing
//   node scripts/apply-marketplace-markup.mjs --apply   change the prices
//
// Uses the Firebase service account from .env.local. Safe to run more than once.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const apply = process.argv.includes("--apply");

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

const MARKUP_RATE = 0.3;
const cents = (n) => Math.round(n * 100) / 100;
const priceWithMarkup = (companyPrice) => {
  const markupAmount = cents(companyPrice * MARKUP_RATE);
  return { markupAmount, sellingPrice: cents(companyPrice + markupAmount) };
};

const db = getFirestore(
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
);

const snap = await db.collection("marketplaceListings").get();
const changes = [];
let pending = 0;
let noPrice = 0;
for (const d of snap.docs) {
  const l = d.data();
  if (l.status === "pending") {
    pending++;
    continue;
  }
  const companyPrice = Number(l.askingPrice);
  if (!Number.isFinite(companyPrice) || companyPrice <= 0) {
    noPrice++;
    continue;
  }
  const next = priceWithMarkup(companyPrice);
  if (l.sellingPrice === next.sellingPrice && l.markupAmount === next.markupAmount) continue;
  changes.push({ ref: d.ref, title: l.title ?? d.id, companyPrice, before: l.sellingPrice ?? null, ...next });
}

const rand = (n) => (n === null ? "none" : `R${Number(n).toFixed(2)}`);
for (const c of changes.slice(0, 15)) {
  console.log(`${c.title.slice(0, 50).padEnd(50)}  company ${rand(c.companyPrice)}  customer ${rand(c.before)} -> ${rand(c.sellingPrice)}`);
}
if (changes.length > 15) console.log(`... and ${changes.length - 15} more`);

if (apply) {
  for (let i = 0; i < changes.length; i += 400) {
    const batch = db.batch();
    for (const c of changes.slice(i, i + 400)) {
      batch.update(c.ref, { markupAmount: c.markupAmount, sellingPrice: c.sellingPrice, updatedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }
}

console.log(
  `\n${snap.size} listings: ${changes.length} ${apply ? "re-priced" : "to re-price (dry run, nothing written; add --apply)"}, ` +
    `${snap.size - changes.length - pending - noPrice} already right, ${pending} waiting for review, ${noPrice} without a company price.`
);
process.exit(0);
