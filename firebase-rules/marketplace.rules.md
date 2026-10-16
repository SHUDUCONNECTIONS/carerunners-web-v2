# MarketPortal security rules (merge into your existing rules)

There are no rules files in this repo, so your current rules live in the Firebase
console. These blocks are **additions**: don't replace your whole ruleset with them.

How MarketPortal works now: **admins create companies and are the only people who list
items** (an item goes live straight away, with the admin's markup). Customers only browse
and buy, one order can hold several products from one store. Company logins (emails set
by an admin) can see their own items and sales, but cannot list.

Companies, listings and their private pickup details are created by the server
(Admin SDK, admin-only API routes), which bypasses rules. Orders, trips, reservations
and payment status are also written by the server. So clients mostly get read access;
the only client-side writes left are admin status changes (take down / put live) and
marking a company paid.

## Firestore (`Firestore Database > Rules`)

Helpers (add at the top of the `match /databases/{database}/documents { ... }` block if
you don't already have them):

```
function signedIn() { return request.auth != null; }
function isAdmin() {
  return signedIn()
    && request.auth.token.email_verified == true
    && request.auth.token.email in [
      "dimakatso@shuduconnections.com",
      "tetelo@shuduconnections.com",
      "tshikovhitshedza9@gmail.com",
      "tshedza@gmail.com",
      "lucky@shuduconnections.com"
    ];
}
// True when the signed-in (verified) email is one of the company's login emails.
function isCompanyLogin(companyId) {
  return signedIn()
    && request.auth.token.email_verified == true
    && request.auth.token.email.lower() in
       get(/databases/$(database)/documents/marketplaceCompanies/$(companyId)).data.loginEmails;
}
```

Then add:

```
// Companies: created/edited only by the server (admin API). Admins and the
// company's own login emails can read. Contains bank details, so no broad reads.
match /marketplaceCompanies/{companyId} {
  allow get: if isAdmin() || isCompanyLogin(companyId);
  allow list: if isAdmin()
    || (signedIn() && request.auth.token.email_verified == true
        && request.auth.token.email.lower() in resource.data.loginEmails);
  allow create, update, delete: if false;
}

match /marketplaceListings/{listingId} {
  // Holds the company's price and the markup: admins and the owning company only.
  // Buyers read listings through /api/marketplace/listings and /api/marketplace/listings/{id}.
  allow get, list: if isAdmin() || isCompanyLogin(resource.data.companyId);

  // Created by the server only. Admins can take down / put live from the browser.
  allow create, delete: if false;
  allow update: if isAdmin();
}

// Exact pickup address, coordinates and phone for each listing. Admin only;
// buyers get a distance quote from the server instead.
match /marketplacePickup/{listingId} {
  allow get, list: if isAdmin();
  allow create, update, delete: if false;
}

match /marketplaceOrders/{orderId} {
  // Buyers read their own orders through /api/marketplace/orders (no company price or markup).
  allow get, list: if isAdmin() || isCompanyLogin(resource.data.sellerId);
  // Created and moved to paid/cancelled by the server only.
  // Admin can record that the company was paid out.
  allow update: if isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(["sellerPaidOut", "sellerPaidOutAt", "sellerPayoutRef", "sellerPayoutMethod"]);
  allow create, delete: if false;
}
```

You can delete the old `marketplaceSellerBank` block if you added it earlier. That
collection is no longer used (bank details now live on the company).

## Storage (`Storage > Rules`)

Admins and company logins upload item photos, each into their own folder. Storage rules
can't check company membership, so any verified user may upload an image to their own
folder; the **server** only creates a listing (and accepts those image links) for admins
and linked company logins, and an admin reviews every company submission before it is live.

```
match /marketplace/{uid}/{fileName} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.auth.uid == uid
    && request.auth.token.email_verified == true
    && request.resource.contentType.matches("image/.*")
    && request.resource.size < 5 * 1024 * 1024;
}
```

## Things to check before publishing

- **`email_verified`**: both the admin check and company logins require a verified
  email. If admin or company accounts never verified their email, they'll get
  "permission denied". Verify them first (or remove those lines, accepting the
  spoofing risk).
- **Admin list is duplicated** in these rules and in `src/utils/adminEmails.ts`. Keep
  them in sync when admins change.
- **Queries must match the rules.** The app only queries listings by `status == "active"`
  (customers) or all listings (admin), and by `companyId in [...]` (company logins).
- **Login emails are stored lower-case** by the API; the rule lower-cases the token email
  before comparing.
- Test in the Rules Playground before publishing: a normal customer must NOT be able
  to read `marketplaceCompanies`, `marketplacePickup`, or someone else's order, or
  write to any marketplace collection.
