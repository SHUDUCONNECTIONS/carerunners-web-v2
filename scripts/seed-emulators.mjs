// Fills the local Firebase emulators with a test driver, a test customer and a paid trip waiting for a driver,
// so the driver portal can be tried end to end without touching the live project.
//
// Refuses to run unless every Firebase service it writes to is pointed at an emulator on this computer.
// Run it inside the emulators, from the project folder:
//   npx firebase-tools emulators:exec --config firebase-rules/firebase.app-emulators.json --project <project id> "node scripts/seed-emulators.mjs"
// or, with the emulators already running, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080,
// FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 and FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 first.
//
// Test logins (password for both: Test1234!):
//   driver@carerunners.test    an approved driver
//   customer@carerunners.test  the customer who booked the trip
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";

const LOCAL = /^(127\.0\.0\.1|localhost):\d+$/;
for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_DATABASE_EMULATOR_HOST"]) {
  if (!LOCAL.test(process.env[v] ?? "")) {
    console.error(`${v} is not set to a local emulator. This script only writes to the emulators.`);
    process.exit(1);
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*(NEXT_PUBLIC_PROJECT_ID|NEXT_PUBLIC_DATABASE_URL)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")])
);
const projectId = env.NEXT_PUBLIC_PROJECT_ID;
const app = initializeApp({ projectId, databaseURL: env.NEXT_PUBLIC_DATABASE_URL });
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

const PASSWORD = "Test1234!";
async function account(uid, email, displayName) {
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser({ uid, email, password: PASSWORD, displayName, emailVerified: true });
}

// Today's date in South African time (trip dates are SA dates).
const saToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());

await account("test-driver", "driver@carerunners.test", "Test Driver");
await account("test-customer", "customer@carerunners.test", "Test Customer");

const driver = {
  firstName: "Test", lastName: "Driver", email: "driver@carerunners.test", phone: "0820000001",
  baseLocation: "Lynnwood, Pretoria", vehicleType: "small", vehicleMake: "Toyota", vehicleModel: "Corolla",
  vehicleYear: "2019", numberPlate: "TEST 001 GP", vehicleColor: "White", isApproved: true, applicationStatus: "approved",
};
await db.doc("drivers/test-driver").set({ ...driver, createdAt: FieldValue.serverTimestamp() });
await db.doc("drivers/test-driver/private/details").set({ licenseNumber: "TEST-LICENCE" });
await rtdb.ref("drivers/test-driver").set({ ...driver, createdAt: Date.now() });

await db.doc("users/test-customer").set({ email: "customer@carerunners.test", name: "Test Customer", accountType: "individual" });

const tripId = `test-customer_${Date.now()}`;
await db.doc(`pickupRequests/${tripId}`).set({
  userId: "test-customer",
  attorneyName: "Test Customer",
  serviceType: "parcel_delivery",
  requestType: "delivery",
  documentDescription: "Test parcel (emulator)",
  pickupLocation: "Menlyn Maine, Pretoria",
  dropoffLocation: "Hatfield Plaza, Pretoria",
  pickupDate: saToday,
  pickupTime: "14:00",
  senderName: "Test Sender", senderNumber: "0820000002",
  receiverName: "Test Receiver", receiverNumber: "0820000003",
  specialInstructions: "",
  distance: "7.40",
  price: 99,
  status: "pending",
  payment_status: "paid",
  createdAt: FieldValue.serverTimestamp(),
});

console.log(`Seeded project ${projectId} (emulators only): driver@carerunners.test, customer@carerunners.test (password ${PASSWORD}), trip ${tripId} for ${saToday}.`);
process.exit(0);
