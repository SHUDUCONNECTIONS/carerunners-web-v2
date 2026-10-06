# Firebase security rules

## Why this folder matters
The rules that were live (saved here as `previous-live-firestore.rules`) said **any signed-in user can read
and write everything**, and the Realtime Database had a `requests` node open to the whole internet. These files
close that. NOTHING here is released by itself: publishing is a separate, deliberate step.

## Files
- `firestore.rules`: phase 1 Firestore rules (closes prices, payments, bank details, reviews, payment records).
- `database.rules.json`: Realtime Database rules (closes `requests`, stops people writing other drivers' data).
- `previous-live-firestore.rules`: what was live before, for rolling back.
- `tests/scenarios.reference.mjs`: about 70 allow/deny scenarios written against `firestore.rules`.
  Run them with the Firebase emulator (needs Java) before publishing.

## Publishing (when the scenarios pass)
Firebase console > Firestore Database > Rules: paste `firestore.rules`, Publish.
Firebase console > Realtime Database > Rules: paste `database.rules.json`, Publish.
Then open the web app and the driver app and try: sign in, request a trip, pay, driver accepts, rate.

## Rolling back
Paste `previous-live-firestore.rules` back into the same place and Publish (the console also keeps a history).

## Still open after phase 1 (phase 2)
Who may READ trips, users and drivers. They are still readable by any signed-in user.
