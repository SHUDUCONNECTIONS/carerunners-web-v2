# CareRunners web

Next.js 14 (App Router) + Firebase (Auth, Firestore, Realtime Database, Storage) + Resend (email) +
Google Maps + a Hyperpay-style payment gateway. Covers parcel delivery, laundry, legal logistics, home & office
removals, a marketplace, and a driver dashboard. Installable as a PWA.

## Setup
1. `npm ci`
2. Create `.env.local` with (Firebase web config, Maps key, Resend key, payment
   `ENTITY_ID` / `BEARER_TOKEN`, Firebase Admin service-account vars). There is no `.env.example` yet.
3. `npm run dev` (http://localhost:3000)

## Checks
| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright smoke tests: public pages only, no form submits. Set `E2E_BASE_URL` to use a server you already run; otherwise one starts on port 3100. |
| `npm run build` | Production build. Do not run it while `npm run dev` is running: both write to `.next` and the dev server will break. |

CI (`.github/workflows/ci.yml`) runs lint, type check, unit tests and build on every push.

## Security rules and rollout
Firestore, Realtime Database and Storage rules live in `firebase-rules/`. They are not published by deploying the
app. Read `firebase-rules/README.md` for the rollout order (deploy app, migrate driver private details, then
publish rules) and for how to test them.

## Layout
- `src/app`: routes (`(main)` customer area, `admin`, `driver`, `auth`, `api`)
- `src/lib`: pricing, plans, trip status, marketplace logic (unit tested)
- `src/utils`: Firebase client/admin setup
- `scripts`: one-off data migrations and imports
