// Checks firebase-rules/database.rules.json (who can read the Realtime Database trip copies) in the local
// Database emulator. Nothing touches the live project.
//   npx firebase-tools emulators:exec --config firebase-rules/firebase.app-emulators.json --only database --project demo-carerunners "node firebase-rules/tests/database-emulator.mjs"
const NS = "demo-carerunners-default-rtdb";
const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";

// The emulator accepts an unsigned token; "owner" skips the rules (for setting up).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (claims) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ iat: 0, exp: 9999999999, aud: "demo-carerunners", sub: claims.uid, user_id: claims.uid, ...claims })}.`;
const url = (p, auth, extra = "") => `http://${HOST}/${p}.json?ns=${NS}${extra}${auth ? `&auth=${auth}` : ""}`;
const call = async (method, p, auth, body, extra) =>
  (await fetch(url(p, auth === "owner" ? null : auth, extra), { method, body: body && JSON.stringify(body), headers: auth === "owner" ? { Authorization: "Bearer owner" } : {} })).status;

const users = {
  customer: token({ uid: "u1", email: "u1@example.com", email_verified: true }),
  other: token({ uid: "u2", email: "u2@example.com", email_verified: true }),
  driver: token({ uid: "d1", email: "d1@example.com", email_verified: true }),
  newDriver: token({ uid: "d9", email: "d9@example.com", email_verified: true }),
  admin: token({ uid: "a1", email: "tshikovhitshedza9@gmail.com", email_verified: true }),
  flagged: token({ uid: "a2", email: "x@example.com", email_verified: true, admin: true }),
};

await call("PUT", "", "owner", {
  trips: {
    t1: { userId: "u1", driverId: "d1", status: "assigned", senderNumber: "0820000000" },
    t2: { userId: "u2", status: "pending", senderNumber: "0830000000" },
  },
  drivers: { d1: { isApproved: true }, d9: { isApproved: false } },
});

const byUser = '&orderBy="userId"&equalTo="u1"';
const cases = [
  ["anonymous cannot read trips", "GET", "trips", null, 401],
  ["customer cannot read every trip", "GET", "trips", users.customer, 401],
  ["customer reads their own trip", "GET", "trips/t1", users.customer, 200],
  ["customer cannot read someone else's trip", "GET", "trips/t2", users.customer, 401],
  ["customer lists their own trips", "GET", "trips", users.customer, 200, byUser],
  ["customer cannot list another customer's trips", "GET", "trips", users.other, 401, byUser],
  ["assigned driver reads the trip", "GET", "trips/t1", users.driver, 200],
  ["approved driver reads the trip list", "GET", "trips", users.driver, 200],
  ["driver not yet approved cannot read the trip list", "GET", "trips", users.newDriver, 401],
  ["admin (email) reads the trip list", "GET", "trips", users.admin, 200],
  ["admin (flag) reads the trip list", "GET", "trips", users.flagged, 200],
  ["customer still saves a new trip copy", "PUT", "trips/t3", users.customer, 200, "", { userId: "u1", status: "awaiting-payment" }],
];

let fail = 0;
for (const [name, method, p, auth, want, extra = "", body] of cases) {
  const got = await call(method, p, auth, body, extra);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   -> expected ${want}, got ${got}`}`);
}
console.log(`\n${cases.length} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
