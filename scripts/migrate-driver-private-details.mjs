// Moves drivers' identity documents and licence/insurance numbers off their public profile.
//
// Driver profiles (Firestore drivers/{uid} and Realtime Database drivers/{uid}) are readable by every
// signed-in user, because customers see their runner's name, vehicle and rating. Older drivers also
// have their ID document and proof-of-residence links, licence number and insurance details on that
// record. This copies those fields to drivers/{uid}/private/details (driver and admins only) and
// removes them from both public records.
//
//   node scripts/migrate-driver-private-details.mjs           dry run, writes nothing
//   node scripts/migrate-driver-private-details.mjs --apply   make the changes
//
// Uses the Firebase service account from .env.local. Safe to run more than once.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const apply = process.argv.includes("--apply");

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

const PRIVATE_FIELDS = ["licenseNumber", "insuranceProvider", "insuranceNumber", "identificationDocUrl", "proofOfResidenceDocUrl"];

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  databaseURL: process.env.NEXT_PUBLIC_DATABASE_URL,
});
const db = getFirestore(app);
const rtdb = getDatabase(app);

const drivers = await db.collection("drivers").get();
let moved = 0;
for (const d of drivers.docs) {
  const data = d.data();
  const present = PRIVATE_FIELDS.filter((f) => f in data);
  if (present.length === 0) continue;
  moved++;
  console.log(`${apply ? "Moving" : "Would move"} ${present.join(", ")} for driver ${d.id}`);
  if (!apply) continue;

  const details = Object.fromEntries(present.map((f) => [f, data[f] ?? null]));
  await db.doc(`drivers/${d.id}/private/details`).set(details, { merge: true });
  await d.ref.update(Object.fromEntries(present.map((f) => [f, FieldValue.delete()])));
}

// The Realtime Database copy (driver mobile app) never needs these: drop them for every driver.
const rtdbDrivers = (await rtdb.ref("drivers").get()).val() ?? {};
let cleaned = 0;
for (const [uid, record] of Object.entries(rtdbDrivers)) {
  const present = PRIVATE_FIELDS.filter((f) => record && f in record);
  if (present.length === 0) continue;
  cleaned++;
  console.log(`${apply ? "Removing" : "Would remove"} ${present.join(", ")} from Realtime Database drivers/${uid}`);
  if (apply) await rtdb.ref(`drivers/${uid}`).update(Object.fromEntries(present.map((f) => [f, null])));
}

console.log(`\n${moved} Firestore driver record(s) and ${cleaned} Realtime Database record(s) ${apply ? "updated" : "to update (dry run, nothing written; add --apply)"}.`);
process.exit(0);
