// Allow/deny scenarios for firebase-rules/firestore.rules, shared by two runners:
//  - scenarios.reference.mjs: Google's online rules test service (needs the "Firebase Rules Admin" role)
//  - emulator.mjs: the local Firestore emulator (needs Java; see README.md)
// Each case is in the test service's format: who is asking, the document as it is now (`existing`), what is
// being written (`incoming`) and the other documents the rules look up (`mocks`: get, exists, getAfter).
const D = (p) => `/databases/(default)/documents/${p}`;
const user = (uid, email = `${uid}@example.com`, verified = true) => ({ uid, token: { email, email_verified: verified } });
const ADMIN = user("adm", "tshikovhitshedza9@gmail.com");
const U1 = user("u1"), U2 = user("u2");
const mockGet = (p, data) => ({ function: "get", args: [{ exact_value: D(p) }], result: { value: { data } } });
const mockExists = (p, value) => ({ function: "exists", args: [{ exact_value: D(p) }], result: { value } });
const mockGetAfter = (p, data) => ({ function: "getAfter", args: [{ exact_value: D(p) }], result: { value: { data } } });
const approved = (uid) => mockGet(`drivers/${uid}`, { isApproved: true });

export const cases = [];
// c(name, expectation, method, path, {as, existing, incoming, mocks})
const c = (name, expectation, method, p, o = {}) => cases.push({ name, tc: {
  expectation,
  request: { auth: o.as ?? null, path: D(p), method, ...(o.incoming ? { resource: { data: o.incoming } } : {}) },
  ...(o.existing ? { resource: { data: o.existing } } : {}),
  ...(o.mocks ? { functionMocks: o.mocks } : {}),
} });

// ── admins ──
const FLAGGED = { uid: "adm2", token: { email: "someone@example.com", email_verified: true, admin: true } };
c("an account with the admin flag is an admin", "ALLOW", "list", "marketplaceListings/l1", { as: FLAGGED, existing: { companyId: "c1" } });
c("an admin email that isn't verified is not an admin", "DENY", "list", "marketplaceListings/l1", { as: user("x", "tshikovhitshedza9@gmail.com", false), existing: { companyId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
c("nobody reads the admin list from the browser", "DENY", "get", "adminUsers/adm", { as: ADMIN, existing: { email: "a@example.com" } });
c("a team invitation can't arrive pre-counted", "DENY", "create", "userInvitations/i9", { as: U1, incoming: { firmId: "f1", email: "x@example.com", sentCount: -100 }, mocks: [mockExists("users/u1", true), mockGet("users/u1", { firmId: "f1" })] });

// ── marketplace ──
c("anon cannot open a listing", "DENY", "get", "marketplaceListings/l1", { existing: { status: "active" } });
c("customer cannot open a listing directly (it holds the company price; the server API strips it)", "DENY", "get", "marketplaceListings/l1", { as: U1, existing: { status: "active", companyId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
c("company login opens its own listing", "ALLOW", "get", "marketplaceListings/l1", { as: U1, existing: { status: "active", companyId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: ["u1@example.com"] })] });
c("admin opens a listing", "ALLOW", "get", "marketplaceListings/l1", { as: ADMIN, existing: { status: "active", companyId: "c1" } });
c("customer cannot list listings", "DENY", "list", "marketplaceListings/l1", { as: U1, existing: { companyId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
c("admin lists listings", "ALLOW", "list", "marketplaceListings/l1", { as: ADMIN, existing: { companyId: "c1" } });
c("company login lists own listings", "ALLOW", "list", "marketplaceListings/l1", { as: U1, existing: { companyId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: ["u1@example.com"] })] });
c("admin takes a listing down", "ALLOW", "update", "marketplaceListings/l1", { as: ADMIN, existing: { status: "active", stock: 5, ratingSum: 0, ratingCount: 0 }, incoming: { status: "inactive", stock: 5, ratingSum: 0, ratingCount: 0 } });
c("admin cannot change a price from the browser (server applies the 30% markup)", "DENY", "update", "marketplaceListings/l1", { as: ADMIN, existing: { status: "pending", askingPrice: 100, sellingPrice: null }, incoming: { status: "active", askingPrice: 100, sellingPrice: 101 } });
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

c("buyer cannot read their order directly (it holds the company price; the server API strips it)", "DENY", "get", "marketplaceOrders/o1", { as: U1, existing: { buyerId: "u1", sellerId: "c1" }, mocks: [mockGet("marketplaceCompanies/c1", { loginEmails: [] })] });
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
c("customer cannot give themselves a delivery discount", "DENY", "create", "pickupRequests/t1", { as: U1, incoming: { ...trip, marketDeliveryDiscount: 99 } });
c("customer cannot create a trip with a driver already on it", "DENY", "create", "pickupRequests/t1", { as: U1, incoming: { ...trip, driverId: "d1" } });
c("owner cannot mark their trip paid", "DENY", "update", "pickupRequests/t1", { as: U1, existing: trip, incoming: { ...trip, payment_status: "paid" } });
c("owner cannot cut the price", "DENY", "update", "pickupRequests/t1", { as: U1, existing: trip, incoming: { ...trip, price: 1 } });
c("owner cannot push an unpaid trip to drivers", "DENY", "update", "pickupRequests/t1", { as: U1, existing: trip, incoming: { ...trip, status: "pending" } });
c("driver cannot pick up an unpaid trip", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: trip, incoming: { ...trip, status: "assigned", driverId: "d1" }, mocks: [approved("d1")] });
const paid = { userId: "u1", status: "pending", payment_status: "paid", price: 100 };
const mine = { ...paid, status: "assigned", driverId: "d1" };
c("approved driver accepts a paid trip", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: paid, incoming: { ...paid, status: "assigned", driverId: "d1" }, mocks: [approved("d1")] });
c("unapproved driver cannot accept a trip", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: paid, incoming: { ...paid, status: "assigned", driverId: "d1" }, mocks: [mockGet("drivers/d1", { isApproved: false })] });
c("customer cannot make themselves the driver", "DENY", "update", "pickupRequests/t1", { as: U2, existing: paid, incoming: { ...paid, status: "assigned", driverId: "u2" }, mocks: [mockGet("drivers/u2", {})] });
c("driver cannot take a trip another driver has", "DENY", "update", "pickupRequests/t1", { as: user("d2"), existing: mine, incoming: { ...mine, driverId: "d2" }, mocks: [approved("d2")] });
// Photos: parcels, laundry and removals need one at collection and one at delivery; legal runs need none.
const proof = (trip, kind) => `https://firebasestorage.googleapis.com/v0/b/x/o/tripProofs%2F${trip}%2F${kind}.jpg?alt=media`;
const parcel = { ...mine, serviceType: "parcel_delivery" };
const collected = { ...parcel, status: "in-transit", pickupProofUrl: proof("t1", "pickup"), pickupProofAt: 1 };
c("parcel: driver collects with a photo", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: parcel, incoming: collected });
c("parcel: driver cannot collect without a photo", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: parcel, incoming: { ...parcel, status: "in-transit" } });
c("parcel: driver delivers with a photo", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: collected, incoming: { ...collected, status: "delivered", deliveryProofUrl: proof("t1", "delivery"), deliveryProofAt: 1 } });
c("parcel: driver cannot deliver without a photo", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: collected, incoming: { ...collected, status: "delivered" } });
c("parcel: driver cannot finish as completed without a photo", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: collected, incoming: { ...collected, status: "completed" } });
c("parcel: driver cannot use another trip's photo", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: collected, incoming: { ...collected, status: "delivered", deliveryProofUrl: proof("t9", "delivery"), deliveryProofAt: 1 } });
c("laundry: driver cannot collect without a photo", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...mine, serviceType: "laundry" }, incoming: { ...mine, serviceType: "laundry", status: "picked-up" } });
c("removal: driver cannot deliver without a photo", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...mine, serviceType: "home_office_removal", status: "in-transit", pickupProofUrl: proof("t1", "pickup") }, incoming: { ...mine, serviceType: "home_office_removal", status: "delivered", pickupProofUrl: proof("t1", "pickup") } });
c("legal run: driver collects and delivers without photos", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...mine, serviceType: "legal_logistics", status: "in-transit" }, incoming: { ...mine, serviceType: "legal_logistics", status: "delivered" } });
c("older booking with no service: driver delivers without a photo", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...mine, status: "in-transit" }, incoming: { ...mine, status: "delivered" } });
c("another driver cannot move someone else's trip", "DENY", "update", "pickupRequests/t1", { as: user("d2"), existing: mine, incoming: { ...mine, status: "delivered" } });
c("assigned driver cannot change the dropoff", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: mine, incoming: { ...mine, dropoffLocation: "elsewhere" } });
c("driver cannot reopen a finished trip", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...mine, status: "completed" }, incoming: { ...mine, status: "assigned" } });
c("driver cannot accept for someone else", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: paid, incoming: { ...paid, status: "accepted", driverId: "d2", acceptedAt: 1 }, mocks: [approved("d1")] });
c("driver cannot cancel a trip", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: mine, incoming: { ...mine, status: "cancelled" } });
c("driver cannot change the price", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: mine, incoming: { ...mine, price: 9999 } });

// The driver mobile app (not in this repo). What it writes was read off the live trips on 2026-10-16: it saves
// acceptedAt when accepting, uses an "arrived" step, and finishes trips as "completed" with no photo or rating.
// That works for legal runs (no photos needed) but not for parcels, laundry or removals until the app sends photos.
c("mobile app: driver accepts and records the time", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: paid, incoming: { ...paid, status: "assigned", driverId: "d1", acceptedAt: 1 }, mocks: [approved("d1")] });
c("mobile app: driver accepts as \"accepted\"", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: paid, incoming: { ...paid, status: "accepted", driverId: "d1", acceptedAt: 1 }, mocks: [approved("d1")] });
c("mobile app: driver accepts a parcel trip", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...paid, serviceType: "parcel_delivery" }, incoming: { ...paid, serviceType: "parcel_delivery", status: "accepted", driverId: "d1", acceptedAt: 1 }, mocks: [approved("d1")] });
c("mobile app: legal run collected", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: mine, incoming: { ...mine, status: "picked-up" } });
c("mobile app: legal run arrives at the dropoff", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...mine, status: "picked-up" }, incoming: { ...mine, status: "arrived" } });
c("mobile app: legal run finished", "ALLOW", "update", "pickupRequests/t1", { as: user("d1"), existing: { ...mine, status: "arrived" }, incoming: { ...mine, status: "completed" } });
c("mobile app: parcel collected without a photo is refused", "DENY", "update", "pickupRequests/t1", { as: user("d1"), existing: parcel, incoming: { ...parcel, status: "picked-up" } });
c("customer rates a delivered trip", "ALLOW", "update", "pickupRequests/t1", { as: U1, existing: { ...mine, status: "delivered" }, incoming: { ...mine, status: "completed", rating: 5, ratingComment: "ok", ratedAt: 1 } });
c("customer cannot rate twice", "DENY", "update", "pickupRequests/t1", { as: U1, existing: { ...mine, status: "completed", rating: 5, ratingComment: "" }, incoming: { ...mine, status: "completed", rating: 1, ratingComment: "" } });
c("customer cannot rate 50 stars", "DENY", "update", "pickupRequests/t1", { as: U1, existing: { ...mine, status: "delivered" }, incoming: { ...mine, status: "completed", rating: 50, ratingComment: "" } });
c("customer cannot re-open a cancelled trip for a free ride", "DENY", "update", "pickupRequests/t1", { as: U1, existing: { ...trip, status: "cancelled", payment_status: "cancelled" }, incoming: { ...trip, status: "pending", payment_status: "cancelled" } });
c("another customer cannot redirect someone's delivery", "DENY", "update", "pickupRequests/t1", { as: U2, existing: paid, incoming: { ...paid, dropoffLocation: "my house" } });
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
const delivered = { userId: "u1", driverId: "d1", status: "delivered" };
// What RatingPrompt saves with a rating (comment and time), so the trip half of the batch is a real rating.
const rated = { ...delivered, status: "completed", rating: 4, ratingComment: "", ratedAt: 1 };
const rateMocks = [mockGet("pickupRequests/t1", delivered), mockGetAfter("pickupRequests/t1", rated)];
c("customer rates their own delivery", "ALLOW", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 14, ratingCount: 3, lastRatedTripId: "t1" }, mocks: rateMocks });
c("customer cannot add a rating different from the trip's", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 15, ratingCount: 3, lastRatedTripId: "t1" }, mocks: rateMocks });
c("customer cannot add two ratings at once", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 18, ratingCount: 4, lastRatedTripId: "t1" }, mocks: rateMocks });
c("cannot rate a driver for someone else's trip", "DENY", "update", "drivers/d1", { as: U2, existing: drv, incoming: { ...drv, ratingSum: 14, ratingCount: 3, lastRatedTripId: "t1" }, mocks: rateMocks });
c("cannot rate a trip that was already rated", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 14, ratingCount: 3, lastRatedTripId: "t1" }, mocks: [mockGet("pickupRequests/t1", rated), mockGetAfter("pickupRequests/t1", rated)] });
c("cannot rate without a trip", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, ratingSum: 14, ratingCount: 3 } });
c("driver ID documents: driver reads their own", "ALLOW", "get", "drivers/d1/private/details", { as: user("d1"), existing: { identificationDocUrl: "x" } });
c("driver ID documents: admin reads them", "ALLOW", "get", "drivers/d1/private/details", { as: ADMIN, existing: { identificationDocUrl: "x" } });
c("driver ID documents: customers cannot read them", "DENY", "get", "drivers/d1/private/details", { as: U1, existing: { identificationDocUrl: "x" } });
c("customer cannot edit another driver's profile", "DENY", "update", "drivers/d1", { as: U1, existing: drv, incoming: { ...drv, name: "Hacked" } });
c("admin approves a driver", "ALLOW", "update", "drivers/d1", { as: ADMIN, existing: drv, incoming: { ...drv, isApproved: true, applicationStatus: "approved" } });
c("driver signs up (not approved)", "ALLOW", "create", "drivers/d1", { as: user("d1"), incoming: { isApproved: false, applicationStatus: "pending" } });
c("driver cannot sign up pre-approved", "DENY", "create", "drivers/d1", { as: user("d1"), incoming: { isApproved: true } });
c("driver cannot sign up as approved status", "DENY", "create", "drivers/d1", { as: user("d1"), incoming: { applicationStatus: "approved" } });

// ── users and firms ──
c("person updates their own profile", "ALLOW", "update", "users/u1", { as: U1, existing: { firmId: "f1" }, incoming: { firmId: "f1", contact: "1" } });
c("person cannot edit someone else's profile", "DENY", "update", "users/u1", { as: U2, existing: { firmId: "f1" }, incoming: { contact: "1" } });
c("person creates their own profile", "ALLOW", "create", "users/u1", { as: U1, incoming: { email: "u1@example.com" } });
c("person creates their profile with the firm they just made", "ALLOW", "create", "users/u1", { as: U1, incoming: { email: "u1@example.com", firmId: "f1" }, mocks: [mockGet("firms/f1", { adminId: "u1" })] });
c("person cannot sign up into someone else's firm", "DENY", "create", "users/u1", { as: U1, incoming: { email: "u1@example.com", firmId: "f9" }, mocks: [mockGet("firms/f9", { adminId: "u9" })] });
c("person cannot move themselves into someone else's firm", "DENY", "update", "users/u1", { as: U1, existing: { firmId: "f1" }, incoming: { firmId: "f9" }, mocks: [mockGet("firms/f9", { adminId: "u9" })] });
c("person cannot create a profile for someone else", "DENY", "create", "users/u2", { as: U1, incoming: { email: "x" } });
c("firm admin removes a team member", "ALLOW", "delete", "users/u2", { as: U1, existing: { firmId: "f1" }, mocks: [mockExists("firms/f1", true), mockGet("firms/f1", { adminId: "u1" })] });
c("random user cannot remove a team member", "DENY", "delete", "users/u2", { as: U2, existing: { firmId: "f1" }, mocks: [mockExists("firms/f1", true), mockGet("firms/f1", { adminId: "u1" })] });
c("firm admin cannot mark their own plan as paid", "DENY", "update", "firms/f1", { as: U1, existing: { adminId: "u1", selectedPlan: "Bronze", paidPlan: "Bronze" }, incoming: { adminId: "u1", selectedPlan: "Platinum", paidPlan: "Platinum" } });
c("firm admin cannot extend their own paid time", "DENY", "update", "firms/f1", { as: U1, existing: { adminId: "u1", paidUntil: "2026-11-01T00:00:00.000Z" }, incoming: { adminId: "u1", paidUntil: "2099-01-01T00:00:00.000Z" } });
c("firm admin can pick a plan before paying", "ALLOW", "update", "firms/f1", { as: U1, existing: { adminId: "u1", selectedPlan: "Bronze" }, incoming: { adminId: "u1", selectedPlan: "Gold" } });
c("person creates their firm", "ALLOW", "create", "firms/f1", { as: U1, incoming: { adminId: "u1", accountType: "firm" } });
c("person cannot create a firm that is already paid", "DENY", "create", "firms/f1", { as: U1, incoming: { adminId: "u1", paymentStatus: "paid" } });
c("person cannot create a firm owned by someone else", "DENY", "create", "firms/f1", { as: U1, incoming: { adminId: "u2" } });
c("firm admin changes the plan", "ALLOW", "update", "firms/f1", { as: U1, existing: { adminId: "u1", selectedPlan: "a" }, incoming: { adminId: "u1", selectedPlan: "b" } });
c("firm admin cannot mark the firm paid", "DENY", "update", "firms/f1", { as: U1, existing: { adminId: "u1" }, incoming: { adminId: "u1", paymentStatus: "paid" } });
c("firm admin cannot hand the firm to someone else", "DENY", "update", "firms/f1", { as: U1, existing: { adminId: "u1" }, incoming: { adminId: "u2" } });
c("another user cannot edit the firm", "DENY", "update", "firms/f1", { as: U2, existing: { adminId: "u1" }, incoming: { adminId: "u1", selectedPlan: "b" } });
c("firm member adds a record", "ALLOW", "create", "firms/f1/documents/d1", { as: U2, incoming: { fileName: "a" }, mocks: [mockGet("firms/f1", { adminId: "u1" }), mockExists("users/u2", true), mockGet("users/u2", { firmId: "f1" })] });
c("outsider cannot add a record", "DENY", "create", "firms/f1/documents/d1", { as: user("u3"), incoming: { fileName: "a" }, mocks: [mockGet("firms/f1", { adminId: "u1" }), mockExists("users/u3", true), mockGet("users/u3", { firmId: "f9" })] });
c("invitations are accepted on the server, not in the browser", "DENY", "update", "userInvitations/i1", { as: user("u5", "new@example.com"), existing: { email: "new@example.com", firmId: "f1" }, incoming: { status: "accepted" } });
c("someone else cannot accept it", "DENY", "update", "userInvitations/i1", { as: U1, existing: { email: "new@example.com", firmId: "f1" }, incoming: { status: "accepted" } });
c("firm member invites a colleague", "ALLOW", "create", "userInvitations/i1", { as: U1, incoming: { email: "x@example.com", firmId: "f1" }, mocks: [mockExists("users/u1", true), mockGet("users/u1", { firmId: "f1" })] });
c("cannot invite into another firm", "DENY", "create", "userInvitations/i1", { as: U1, incoming: { email: "x@example.com", firmId: "f9" }, mocks: [mockExists("users/u1", true), mockGet("users/u1", { firmId: "f1" })] });

c("any other collection is closed", "DENY", "get", "secrets/x", { as: U1, existing: {} });
