// Makes a person a Care Runners admin, or removes them. Admin access is an "admin" flag on their
// Firebase login (a custom claim) that the app, the server and the Firestore rules all check, so
// adding or removing an admin needs no code change. The adminUsers collection mirrors the list so
// the server knows who to email about new trips, low stock and reported problems.
//
//   node scripts/set-admin.mjs --list                 who is an admin
//   node scripts/set-admin.mjs someone@example.com    make them an admin (they must have signed up)
//   node scripts/set-admin.mjs someone@example.com --remove
//
// The person sees the change after signing out and in again (or within the hour).
// Uses the Firebase service account from .env.local. Safe to run more than once.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app);
const db = getFirestore(app);
const admins = db.collection("adminUsers");

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const emails = args.filter((a) => !a.startsWith("--")).map((e) => e.trim().toLowerCase());

if (args.includes("--list") || emails.length === 0) {
  const snap = await admins.get();
  if (snap.empty) console.log("No admins yet.");
  for (const d of snap.docs) {
    const user = await auth.getUser(d.id).catch(() => null);
    const flag = user?.customClaims?.admin === true ? "" : "  (flag missing: run this script for them again)";
    console.log(`${d.data().email}${flag}`);
  }
  process.exit(0);
}

for (const email of emails) {
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.log(`${email}: no account with this email. They need to sign up first.`);
    continue;
  }
  const claims = { ...(user.customClaims ?? {}) };
  if (remove) delete claims.admin;
  else claims.admin = true;
  await auth.setCustomUserClaims(user.uid, claims);
  if (remove) await admins.doc(user.uid).delete();
  else await admins.doc(user.uid).set({ email, addedAt: FieldValue.serverTimestamp() });
  console.log(`${email}: ${remove ? "no longer an admin" : "is now an admin"}`);
}
