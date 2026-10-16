// Brings the Realtime Database copies of trips (trips/{id}) up to date with the real records in Firestore
// (pickupRequests/{id}). Until src/utils/tripMirror.ts, the copy was written once at booking and never updated,
// so every copy still said "awaiting-payment" or "pending". Only status, payment_status and driverId are copied.
//
//   node scripts/sync-rtdb-trips.mjs           dry run, writes nothing
//   node scripts/sync-rtdb-trips.mjs --apply   make the changes
//
// Uses the Firebase service account from .env.local. Safe to run more than once.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const apply = process.argv.includes("--apply");

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  databaseURL: process.env.NEXT_PUBLIC_DATABASE_URL,
});
const db = getFirestore();
const rtdb = getDatabase();

// Same fields as MIRRORED_FIELDS in src/utils/tripMirror.ts.
const FIELDS = ["status", "payment_status", "driverId"];

const copies = (await rtdb.ref("trips").once("value")).val() ?? {};
let changed = 0;
let missing = 0;
for (const [id, copy] of Object.entries(copies)) {
  const trip = (await db.collection("pickupRequests").doc(id).get()).data();
  if (!trip) {
    missing++;
    console.log(`${id}: no Firestore trip, left as is`);
    continue;
  }
  const patch = {};
  for (const f of FIELDS) if ((copy?.[f] ?? null) !== (trip[f] ?? null)) patch[f] = trip[f] ?? null;
  if (!Object.keys(patch).length) continue;
  changed++;
  const was = FIELDS.filter((f) => f in patch).map((f) => `${f} ${copy?.[f] ?? "-"} -> ${trip[f] ?? "-"}`).join(", ");
  console.log(`${apply ? "Updated" : "Would update"} ${id}: ${was}`);
  if (apply) await rtdb.ref(`trips/${id}`).update(patch);
}
console.log(
  `\n${Object.keys(copies).length} copies checked, ${changed} ${apply ? "updated" : "to update"}, ${missing} with no Firestore trip` +
    (apply ? "." : " (dry run, nothing written; add --apply).")
);
process.exit(0);
