# Firebase security rules

## Why this folder matters
The rules that were live (saved here as `previous-live-firestore.rules`) said **any signed-in user can read
and write everything**, and the Realtime Database had a `requests` node open to the whole internet. These files
close that. NOTHING here is released by itself: publishing is a separate, deliberate step.

## Files
- `firestore.rules`: Firestore rules. Closes prices, payments, bank details, reviews and payment records. Only an
  approved driver can take a trip, only its driver can move it along, only its customer can rate it (once), and a
  driver's rating can only change together with that rating. Nobody can put themselves into another company, and
  drivers' ID documents and licence/insurance numbers live in `drivers/{uid}/private/details` (driver and admins only).
- `database.rules.json`: Realtime Database rules. Closes `requests`, stops people writing other drivers' data or
  approving themselves, and limits each trip to its customer, its driver and admins.
- `storage.rules`: Cloud Storage rules for every folder in use: the web app's, plus `profile_pictures/` and
  `audio-messages/`, which the driver mobile app uses (found in the live bucket on 2026-10-16).
- `previous-live-firestore.rules`, `previous-live-storage.rules`: what was live before, for rolling back.
- `tests/storage-emulator.mjs`: 19 upload/download checks for `storage.rules` on the local emulators:
  `npx firebase-tools emulators:exec --config firebase-rules/firebase.storage-test.json --only auth,firestore,storage --project demo-carerunners "node firebase-rules/tests/storage-emulator.mjs"`
  Last run (2026-10-16): all 19 pass.
- `tests/scenarios.mjs`: 136 allow/deny scenarios for `firestore.rules`, run by either of:
  - `tests/emulator.mjs` (the one in use): the local Firestore emulator, on a `demo-` project that only exists on
    this computer. Needs Java 21+ (a portable Eclipse Temurin JRE is enough: put its `bin` folder on PATH) and the
    Firebase CLI. From the project folder:
    `npx firebase-tools emulators:exec --config firebase-rules/firebase.json --only firestore --project demo-carerunners "node firebase-rules/tests/emulator.mjs"`
    Add `ONLY=<words>` to run just the scenarios whose name contains them.
  - `tests/scenarios.reference.mjs`: Google's online rules test service (a dry run). Needs the "Firebase Rules
    Admin" role on the service account, which it does not have:
    `node firebase-rules/tests/scenarios.reference.mjs . firebase-rules/firestore.rules`
  Last emulator run (2026-10-16): all 136 pass against `firestore.rules`, including five that replay what the driver
  mobile app writes (read off the live trips: it saves `acceptedAt`, uses an "arrived" step and finishes trips as
  "completed" without a photo). The first version of these rules refused four of those five.
  Proof photos (one at collection, one at delivery) are required for parcels, laundry and removals only; legal
  runs need none. The mobile app sends no photos, so until it does, its drivers can only progress legal runs.
  As a check that the runner catches bad
  rules, the same scenarios against `previous-live-firestore.rules` fail 86 times (everything that should be refused
  is allowed). `database.rules.json` is not covered by tests yet (the mobile app doesn't write trips there).

## Publishing (when the scenarios pass)
The service account in `.env.local` can read the live rules but not publish them (no "Firebase Rules Admin" role),
so publishing is done in the Firebase console by someone who owns the project.

0. Tell the drivers first: once the rules are live, parcel, laundry and removal trips need a photo at collection and
   at delivery, which only the web driver portal (/driver/dashboard) asks for. The mobile app can still be used for
   legal runs, and for accepting any trip, until it is updated to upload photos to `tripProofs/<trip id>/` and save
   the links as `pickupProofUrl` and `deliveryProofUrl`.
1. Deploy the web app first. The rules expect the new server routes (`/api/accept-invitation`, server-side trip
   pricing) and the new rating and driver sign-up code.
2. Move existing drivers' private details: `node scripts/migrate-driver-private-details.mjs` (dry run), then
   `node scripts/migrate-driver-private-details.mjs --apply`.
3. Firebase console > Firestore Database > Rules: paste `firestore.rules`, Publish.
4. Firebase console > Realtime Database > Rules: paste `database.rules.json`, Publish.
5. Firebase console > Storage > Rules: paste `storage.rules`, Publish.
6. Open the web app and the driver mobile app and try: sign up (individual and company), request a trip, pay, driver
   accepts, pickup and delivery photos, rate, invite a team member and accept, upload a record, admin approves a driver.
   The driver mobile app is not in this repo: if it writes other trip fields or statuses, the trip rule will refuse
   them and needs those fields added.

## Rolling back
Paste `previous-live-firestore.rules` (Firestore) or `previous-live-storage.rules` (Storage) back into the same
place and Publish. The console also keeps a history of every published version.

## Still open (phase 2)
Who may READ trips and users. They are still readable by any signed-in user (addresses, phone numbers), because
the driver app and company accounts rely on broad queries. Driver profiles are readable too, but no longer hold
ID documents or licence/insurance numbers.
