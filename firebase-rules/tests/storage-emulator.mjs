// Upload/download checks for firebase-rules/storage.rules against the local Storage, Firestore and Auth emulators,
// on a demo- project that only exists on this computer. Run from the project folder (Java 21+ on PATH):
//   npx firebase-tools emulators:exec --config firebase-rules/firebase.storage-test.json --only auth,firestore,storage --project demo-carerunners "node firebase-rules/tests/storage-emulator.mjs"
import { initializeApp as adminApp } from "firebase-admin/app";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";

const PROJECT = "demo-carerunners";
const BUCKET = `${PROJECT}.appspot.com`;
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

// Each person gets their own signed-in app.
async function as(name) {
  const app = initializeApp({ apiKey: "demo", projectId: PROJECT, storageBucket: BUCKET }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, `${name}@example.com`, "Test1234!");
  const storage = getStorage(app);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  return { uid: user.uid, storage, app };
}

const customer = await as("customer");
const driver = await as("driver");
const stranger = await as("stranger");

// Documents the rules look up, written past the rules with the admin SDK.
const db = adminDb(adminApp({ projectId: PROJECT }));
const tripId = `${customer.uid}_1`;
await db.doc(`pickupRequests/${tripId}`).set({ userId: customer.uid, driverId: driver.uid, status: "assigned" });
await db.doc(`users/${customer.uid}`).set({ firmId: "f1" });

const png = new Uint8Array([137, 80, 78, 71]);
const wav = new Uint8Array([82, 73, 70, 70]);
const img = { contentType: "image/png" };
const audio = { contentType: "audio/wav" };

const checks = [
  ["driver uploads their own profile photo", "ALLOW", () => uploadBytes(ref(driver.storage, `profile_pictures/${driver.uid}/current_profile_picture.jpg`), png, img)],
  ["customer views the driver's profile photo", "ALLOW", () => getBytes(ref(customer.storage, `profile_pictures/${driver.uid}/current_profile_picture.jpg`))],
  ["someone else cannot replace a driver's profile photo", "DENY", () => uploadBytes(ref(stranger.storage, `profile_pictures/${driver.uid}/current_profile_picture.jpg`), png, img)],
  ["customer records a voice note on their trip", "ALLOW", () => uploadBytes(ref(customer.storage, `audio-messages/${tripId}/1.wav`), wav, audio)],
  ["driver records a voice note on their trip", "ALLOW", () => uploadBytes(ref(driver.storage, `audio-messages/${tripId}/2.wav`), wav, audio)],
  ["driver plays the customer's voice note", "ALLOW", () => getBytes(ref(driver.storage, `audio-messages/${tripId}/1.wav`))],
  ["stranger cannot listen to a trip's voice notes", "DENY", () => getBytes(ref(stranger.storage, `audio-messages/${tripId}/1.wav`))],
  ["stranger cannot leave a voice note on a trip", "DENY", () => uploadBytes(ref(stranger.storage, `audio-messages/${tripId}/3.wav`), wav, audio)],
  ["voice-note folder only takes audio", "DENY", () => uploadBytes(ref(customer.storage, `audio-messages/${tripId}/x.png`), png, img)],
  ["customer deletes their voice note", "ALLOW", () => deleteObject(ref(customer.storage, `audio-messages/${tripId}/1.wav`))],
  ["assigned driver uploads a delivery photo", "ALLOW", () => uploadBytes(ref(driver.storage, `tripProofs/${tripId}/delivery.jpg`), png, img)],
  ["someone else cannot upload a trip's proof photo", "DENY", () => uploadBytes(ref(stranger.storage, `tripProofs/${tripId}/delivery.jpg`), png, img)],
  ["customer adds an item photo to their booking", "ALLOW", () => uploadBytes(ref(customer.storage, `pickupRequests/${tripId}/itemPhoto.jpg`), png, img)],
  ["nobody adds photos to someone else's booking", "DENY", () => uploadBytes(ref(stranger.storage, `pickupRequests/${tripId}/itemPhoto.jpg`), png, img)],
  ["company member uploads a record", "ALLOW", () => uploadBytes(ref(customer.storage, `firms/f1/record.pdf`), png, { contentType: "application/pdf" })],
  ["outsider cannot read a company's records", "DENY", () => getBytes(ref(stranger.storage, `firms/f1/record.pdf`))],
  ["driver uploads their ID document", "ALLOW", () => uploadBytes(ref(driver.storage, `drivers/${driver.uid}/id.pdf`), png, { contentType: "application/pdf" })],
  ["others cannot open a driver's ID document", "DENY", () => getBytes(ref(stranger.storage, `drivers/${driver.uid}/id.pdf`))],
  ["anything outside these folders is closed", "DENY", () => uploadBytes(ref(customer.storage, `random/${customer.uid}.png`), png, img)],
];

let failed = 0;
for (const [name, want, run] of checks) {
  let got;
  try {
    await run();
    got = "ALLOW";
  } catch (e) {
    got = e.code === "storage/unauthorized" ? "DENY" : `ERROR ${e.code ?? e.message}`;
  }
  if (got === want) console.log(`PASS  ${name}`);
  else {
    failed++;
    console.log(`FAIL  ${name}   -> expected ${want}, got ${got}`);
  }
}
console.log(`\n${checks.length} storage checks, ${failed} failed`);
await Promise.all([customer, driver, stranger].map((p) => deleteApp(p.app)));
process.exit(failed ? 1 : 0);
