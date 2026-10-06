// Runs scenarios against firebase-rules/firestore.rules using Google's rules test service (a dry run: nothing is released).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const root = process.argv[2];
const rulesFile = process.argv[3];
const require = createRequire(path.join(root, "package.json"));
const { GoogleAuth } = require("google-auth-library");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}
const bs = String.fromCharCode(92);
const auth = new GoogleAuth({
  credentials: { client_email: process.env.FIREBASE_CLIENT_EMAIL, private_key: process.env.FIREBASE_PRIVATE_KEY.split(bs + "n").join("\n") },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const token = (await (await auth.getClient()).getAccessToken()).token;
const source = fs.readFileSync(rulesFile, "utf8");

const D = (p) => `/databases/(default)/documents/${p}`;
const user = (uid, email = `${uid}@example.com`, verified = true) => ({ uid, token: { email, email_verified: verified } });
const ADMIN = user("adm", "tshikovhitshedza9@gmail.com");
const U1 = user("u1"), U2 = user("u2");
const mockGet = (p, data) => ({ function: "get", args: [{ exact_value: D(p) }], result: { value: { data } } });
const mockExists = (p, value) => ({ function: "exists", args: [{ exact_value: D(p) }], result: { value } });

const cases = [];
// c(name, expectation, method, path, {as, existing, incoming, mocks})
const c = (name, expectation, method, p, o = {}) => cases.push({ name, tc: {
  expectation,
  request: { auth: o.as ?? null, path: D(p), method, ...(o.incoming ? { resource: { data: o.incoming } } : {}) },
  ...(o.existing ? { resource: { data: o.existing } } : {}),
  ...(o.mocks ? { functionMocks: o.mocks } : {}),
} });

// ── marketplace ──
c("anon cannot open a listing", "DENY", "get", "marketplaceListings/l1", { existing: { status: "active" } });
c("signed-in opens a listing", "ALLOW", "get", "marketplaceListings/l1", { as: U1, existing: { status: "active" } });
c("customer cannot list listings", "DENY", "list", "marketplaceListings/l1", { as: U1, existing: { companyId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
c("admin lists listings", "ALLOW", "list", "marketplaceListings/l1", { as: ADMIN, existing: { companyId: "c1" } });
c("company login lists own listings", "ALLOW", "list", "marketplaceListings/l1", { as: U1, existing: { companyId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: ["u1@example.com"] })] });
c("admin takes a listing down", "ALLOW", "update", "marketplaceListings/l1", { as: ADMIN, existing: { status: "active", stock: 5, ratingSum: 0, ratingCount: 0 }, incoming: { status: "inactive", stock: 5, ratingSum: 0, ratingCount: 0 } });
c("admin cannot change stock from the browser", "DENY", "update", "marketplaceListings/l1", { as: ADMIN, existing: { status: "active", stock: 5 }, incoming: { status: "active", stock: 500 } });
c("customer cannot change a price", "DENY", "update", "marketplaceListings/l1", { as: U1, existing: { sellingPrice: 100 }, incoming: { sellingPrice: 1 } });
c("customer cannot create a listing", "DENY", "create", "marketplaceListings/l9", { as: U1, incoming: { sellingPrice: 1 } });
c("admin cannot create a listing from the browser", "DENY", "create", "marketplaceListings/l9", { as: ADMIN, incoming: { sellingPrice: 1 } });
c("customer cannot delete a listing", "DENY", "delete", "marketplaceListings/l1", { as: U1, existing: {} });

c("customer cannot read a company (bank details)", "DENY", "get", "marketplaceCompanies/c1", { as: U1, existing: { loginEmails: [] }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
c("admin reads a company", "ALLOW", "get", "marketplaceCompanies/c1", { as: ADMIN, existing: {} });
c("company login reads own company", "ALLOW", "get", "marketplaceCompanies/c1", { as: U1, existing: {}, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: ["u1@example.com"] })] });
c("company login with unverified email is refused", "DENY", "get", "marketplaceCompanies/c1", { as: user("u1", "u1@example.com", false), existing: {}, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: ["u1@example.com"] })] });
c("nobody writes companies from the browser", "DENY", "update", "marketplaceCompanies/c1", { as: ADMIN, existing: {}, incoming: { name: "x" } });

c("buyer reads their order", "ALLOW", "get", "marketplaceOrders/o1", { as: U1, existing: { buyerId: "u1", sellerId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
c("another customer cannot read the order", "DENY", "get", "marketplaceOrders/o1", { as: U2, existing: { buyerId: "u1", sellerId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
c("admin reads an order", "ALLOW", "get", "marketplaceOrders/o1", { as: ADMIN, existing: { buyerId: "u1", sellerId: "c1" } });
c("buyer cannot mark their order paid", "DENY", "update", "marketplaceOrders/o1", { as: U1, existing: { buyerId: "u1", status: "awaiting-payment" }, incoming: { buyerId: "u1", status: "paid" } });
c("admin records a company payout", "ALLOW", "update", "marketplaceOrders/o1", { as: ADMIN, existing: { sellerPaidOut: false }, incoming: { sellerPaidOut: true, sellerPayoutRef: "EFT1" } });
c("admin cannot change an order's status", "DENY", "update", "marketplaceOrders/o1", { as: ADMIN, existing: { status: "awaiting-payment" }, incoming: { status: "paid" } });
c("nobody creates orders from the browser", "DENY", "create", "marketplaceOrders/o9", { as: U1, incoming: { buyerId: "u1" } });

for (const col of ["marketplacePickup", "marketplaceReviews", "marketplaceIssues", "marketplaceSettings", "rateLimits", "checkouts", "pwaDevices"]) {
  c(`${col}: customer cannot read`, "DENY", "get", `${col}/x`, { as: U1, existing: {} });
  c(`${col}: customer cannot write`, "DENY", "create", `${col}/x`, { as: U1, incoming: { a: 1 } });
}
c("checkouts: admin cannot read from the browser either", "DENY", "get", "checkouts/x", { as: ADMIN, existing: {} });

// ── trips ──
const trip = { userId: "u1", status: "awaiting-payment", payment_status: "unpaid", price: 100 };
c("customer creates their own unpaid trip", "ALLOW", "create", "pickupRequests/t1", { as: U1, incoming: trip });
c("customer cannot create a trip already paid", "DENY", "create", "pickupRequests/t1", { as: U1, incoming: { ...trip, payment_status: "paid" } });
c("customer cannot create a trip as 'pending' (skip payment)", "DENY", "create", "pickupRequests/t1", { as: U1, incoming: { ...trip, status: "pending" } });
c("customer cannot create a trip for someone else", "DENY", "create", "pickupRequests/t1", { as: U1, incoming: { ...trip, userId: "u2" } });
c("customer cannot fake a marketplace order trip", "DENY", "create", "pickupRequests/t1", { as: U1, incoming: { ...trip, marketItemAmount: 0, marketOrderId: "o1" } });
c("owner cannot mark their trip paid", "DENY", "update", "pickupRequests/t1", { as: U1, existing: trip, incoming: { ...trip, payment_status: "paid" } });
c("owner cannot cut the price", "DENY", "update", "pickupRequests/t1", { as: U1, existing: trip, incoming: { ...trip, price: 1 } });
c("owner cannot push an unpaid trip to drivers", "DENY", "update", "pickupRequests/t1", { as: U1, existing: trip, incoming: { ...trip, status: "pending" } });
c("driver cannot pick up an unpaid trip", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: trip, incoming: { ...trip, status: "assigned", driverId: "d1" } });
const paid = { userId: "u1", status: "pending", payment_status: "paid", price: 100 };
c("driver accepts a paid trip", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: paid, incoming: { ...paid, status: "assigned", driverId: "d1" } });
c("driver adds delivery photo and moves status", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...paid, status: "assigned" }, incoming: { ...paid, status: "delivered", deliveryPhotoUrl: "x" } });
c("driver cannot change the price", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: paid, incoming: { ...paid, price: 9999 } });
c("customer rates a delivered trip", "ALLOW", "update", "pickupRequests/t1", { as: U1, existing: { ...paid, status: "delivered" }, incoming: { ...paid, status: "completed", rating: 5, ratingComment: "ok" } });
c("admin corrects a trip price", "ALLOW", "update", "pickupRequests/t1", { as: ADMIN, existing: paid, incoming: { ...paid, price: 120 } });
c("customer cannot delete a trip", "DENY", "delete", "pickupRequests/t1", { as: U1, existing: paid });
c("admin can delete a trip", "ALLOW", "delete", "pickupRequests/t1", { as: ADMIN, existing: paid });
c("signed-in reads trips (driver and firm queries)", "ALLOW", "list", "pickupRequests/t1", { as: U1, existing: paid });
c("anonymous cannot read trips", "DENY", "get", "pickupRequests/t1", { existing: paid });

// ── drivers ──
const drv = { isApproved: false, applicationStatus: "pending", ratingSum: 10, ratingCount: 2, name: "D" };
c("driver cannot approve themselves", "DENY", "update", "drivers/d1", { as: user("d1"), existing: drv, incoming: { ...drv, isApproved: true } });
c("driver updates their own profile", "ALLOW", "update", "drivers/d1", { as: user("d1"), existing: drv, incoming: { ...drv, name: "New" } });
c("driver cannot edit their rating", "DENY", "update", "drivers/d1", { as: user("d1"), existing: drv, incoming: { ...drv, ratingSum: 50 } });
c("customer adds one rating", "ALLOW", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 14, ratingCount: 3 } });
c("customer cannot add a huge rating", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 500, ratingCount: 3 } });
c("customer cannot add two ratings at once", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 20, ratingCount: 4 } });
c("customer cannot edit another driver's profile", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, name: "Hacked" } });
c("admin approves a driver", "ALLOW", "update", "drivers/d1", { as: ADMIN, existing: drv, incoming: { ...drv, isApproved: true, applicationStatus: "approved" } });
c("driver signs up (not approved)", "ALLOW", "create", "drivers/d1", { as: user("d1"), incoming: { isApproved: false, applicationStatus: "pending" } });
c("driver cannot sign up pre-approved", "DENY", "create", "drivers/d1", { as: user("d1"), incoming: { isApproved: true } });
c("driver cannot sign up as approved status", "DENY", "create", "drivers/d1", { as: user("d1"), incoming: { applicationStatus: "approved" } });

// ── users and firms ──
c("person updates their own profile", "ALLOW", "update", "users/u1", { as: U1, existing: { firmId: "f1" }, incoming: { firmId: "f1", contact: "1" } });
c("person cannot edit someone else's profile", "DENY", "update", "users/u1", { as: U2, existing: { firmId: "f1" }, incoming: { contact: "1" } });
c("person creates their own profile", "ALLOW", "create", "users/u1", { as: U1, incoming: { email: "u1@example.com" } });
c("person cannot create a profile for someone else", "DENY", "create", "users/u2", { as: U1, incoming: { email: "x" } });
c("firm admin removes a team member", "ALLOW", "delete", "users/u2", { as: U1, existing: { firmId: "f1" }, mocks: [mockExists("firms/f1", true), mockGet("firms/f1", { adminId: "u1" })] });
c("random user cannot remove a team member", "DENY", "delete", "users/u2", { as: U2, existing: { firmId: "f1" }, mocks: [mockExists("firms/f1", true), mockGet("firms/f1", { adminId: "u1" })] });
c("person creates their firm", "ALLOW", "create", "firms/f1", { as: U1, incoming: { adminId: "u1", accountType: "firm" } });
c("person cannot create a firm owned by someone else", "DENY", "create", "firms/f1", { as: U1, incoming: { adminId: "u2" } });
c("firm admin changes the plan", "ALLOW", "update", "firms/f1", { as: U1, existing: { adminId: "u1", selectedPlan: "a" }, incoming: { adminId: "u1", selectedPlan: "b" } });
c("firm admin cannot mark the firm paid", "DENY", "update", "firms/f1", { as: U1, existing: { adminId: "u1" }, incoming: { adminId: "u1", paymentStatus: "paid" } });
c("firm admin cannot hand the firm to someone else", "DENY", "update", "firms/f1", { as: U1, existing: { adminId: "u1" }, incoming: { adminId: "u2" } });
c("another user cannot edit the firm", "DENY", "update", "firms/f1", { as: U2, existing: { adminId: "u1" }, incoming: { adminId: "u1", selectedPlan: "b" } });
c("firm member adds a record", "ALLOW", "create", "firms/f1/documents/d1", { as: U2, incoming: { fileName: "a" }, mocks: [mockGet("firms/f1", { adminId: "u1" }), mockExists("users/u2", true), mockGet("users/u2", { firmId: "f1" })] });
c("outsider cannot add a record", "DENY", "create", "firms/f1/documents/d1", { as: user("u3"), incoming: { fileName: "a" }, mocks: [mockGet("firms/f1", { adminId: "u1" }), mockExists("users/u3", true), mockGet("users/u3", { firmId: "f9" })] });
c("invitee accepts their invitation", "ALLOW", "update", "userInvitations/i1", { as: user("u5", "new@example.com"), existing: { email: "new@example.com", firmId: "f1" }, incoming: { status: "accepted" } });
c("someone else cannot accept it", "DENY", "update", "userInvitations/i1", { as: U1, existing: { email: "new@example.com", firmId: "f1" }, incoming: { status: "accepted" } });
c("firm member invites a colleague", "ALLOW", "create", "userInvitations/i1", { as: U1, incoming: { email: "x@example.com", firmId: "f1" }, mocks: [mockExists("users/u1", true), mockGet("users/u1", { firmId: "f1" })] });
c("cannot invite into another firm", "DENY", "create", "userInvitations/i1", { as: U1, incoming: { email: "x@example.com", firmId: "f9" }, mocks: [mockExists("users/u1", true), mockGet("users/u1", { firmId: "f1" })] });

c("any other collection is closed", "DENY", "get", "secrets/x", { as: U1, existing: {} });

const res = await fetch("https://firebaserules.googleapis.com/v1/projects/care-runners-fe5b8:test", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: source }] }, testSuite: { testCases: cases.map((x) => x.tc) } }),
});
const out = await res.json();
if (!res.ok) { console.log("TEST SERVICE ERROR", JSON.stringify(out).slice(0, 1500)); process.exit(2); }
const issues = out.issues ?? [];
if (issues.length) { console.log("RULES COMPILE ISSUES:"); for (const i of issues) console.log(" ", JSON.stringify(i)); }
let fail = 0;
(out.testResults ?? []).forEach((r, i) => {
  const ok = r.state === "SUCCESS";
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${cases[i].name}${ok ? "" : "   -> " + (r.debugMessages ?? []).join(" | ").slice(0, 160) + " " + (r.errorPosition ? JSON.stringify(r.errorPosition) : "")}`);
});
console.log(`\n${cases.length} scenarios, ${fail} failed`);
process.exit(fail ? 1 : 0);
