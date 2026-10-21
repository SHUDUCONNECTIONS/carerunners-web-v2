// src/utils/email.ts
// Server-only. Every email the app sends lives here and is called directly by the server code that
// needs it. There are no public email endpoints: an open "send an email" URL can be used by anyone
// to send mail from our domain.
import { Resend } from "resend";
import { LEGACY_ADMIN_EMAILS } from "@/utils/adminEmails";
import { adminDb } from "@/utils/firebaseAdmin";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/contact";

// Who gets the admin alerts: everyone made an admin with scripts/set-admin.mjs (the adminUsers
// collection), or the old list until that script has been run. Re-read at most every 5 minutes.
const ADMIN_LIST_TTL_MS = 5 * 60 * 1000;
let adminList: { at: number; emails: string[] } | null = null;
async function adminRecipients(): Promise<string[]> {
  if (adminList && Date.now() - adminList.at < ADMIN_LIST_TTL_MS) return adminList.emails;
  let emails: string[] = [];
  try {
    const snap = await adminDb().collection("adminUsers").get();
    emails = snap.docs.map((d) => String(d.data().email ?? "")).filter(Boolean);
  } catch (err) {
    console.warn("Couldn't read adminUsers, using the old admin list:", err);
  }
  if (emails.length === 0) emails = LEGACY_ADMIN_EMAILS;
  adminList = { at: Date.now(), emails };
  return emails;
}

// Constructing this at module scope with a missing key throws immediately, which fails
// `next build`'s page-data collection. Defer construction until an email is actually sent.
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = "Carerunners <no-reply@carerunners.app>";

// Anything that came from a user (addresses, names, messages) is escaped before it goes into HTML.
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function send(to: string[], subject: string, html: string): Promise<boolean> {
  try {
    // Resend reports a refused email (bad key, unverified sender) in the result rather than by throwing.
    const { error } = await getResend().emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error(`Failed to send "${subject}" email:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send "${subject}" email:`, err);
    return false;
  }
}

export function sendPaymentReceipt(p: { email: string; amount: unknown; date: unknown; brand: unknown; message?: string }) {
  return send(
    [p.email],
    "Payment Successful",
    `
      <p>Dear Customer,</p>
      <p>Thank you for your payment. Here is the proof of your recent transaction.</p>
      <p><strong>Amount:</strong> R${escapeHtml(p.amount)}</p>
      <p><strong>Date:</strong> ${escapeHtml(p.date)}</p>
      <p><strong>Brand:</strong> ${escapeHtml(p.brand)}</p>
      ${p.message ? `<p>${escapeHtml(p.message)}</p>` : ""}
      <p>If you have any questions, feel free to contact us.</p>
      <p>Best regards,<br/>The Carerunners Team</p>
    `
  );
}

export function sendPlanConfirmation(p: { email: string; amount: unknown; date: unknown; brand: unknown; planName: unknown }) {
  const plan = escapeHtml(p.planName);
  return send(
    [p.email],
    "Plan Subscription Confirmed",
    `
      <p>Dear Customer,</p>
      <p>Thank you for subscribing to our ${plan} plan. Your payment has been successfully processed.</p>
      <p>Here are the details of your subscription:</p>
      <ul>
        <li><strong>Plan:</strong> ${plan}</li>
        <li><strong>Amount:</strong> R${escapeHtml(p.amount)}</li>
        <li><strong>Date:</strong> ${escapeHtml(p.date)}</li>
        <li><strong>Payment Method:</strong> ${escapeHtml(p.brand)}</li>
      </ul>
      <p>Your subscription is now active, and you can start enjoying all the benefits of the ${plan} plan.</p>
      <p>If you have any questions about your subscription or need assistance, please don't hesitate to contact our support team.</p>
      <p>Thank you for choosing Carerunners!</p>
      <p>Best regards,<br/>The Carerunners Team</p>
    `
  );
}

export function sendInvitation(p: { email: string; firmName: string; link: string }) {
  const link = escapeHtml(p.link);
  return send(
    [p.email],
    "Invitation to Join Carerunners",
    `
      <p>Dear User,</p>
      <p>You have been invited to join ${escapeHtml(p.firmName)} on Carerunners.</p>
      <p>To accept this invitation and create your account, please click on the following link:</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      <p>Welcome to Carerunners!</p>
      <p>Best regards,<br/>The Carerunners Team</p>
    `
  );
}

export async function sendAdminTripNotification(trip: {
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  price?: number | string;
  customerEmail?: string | null;
  origin?: string;
}) {
  const link = escapeHtml(`${trip.origin ?? ""}/admin/requests`);
  return send(
    await adminRecipients(),
    "New Pickup Request Awaiting a Driver",
    `
      <p>A new trip has been booked and paid for, and is now waiting for a driver.</p>
      <p><strong>Customer:</strong> ${escapeHtml(trip.customerEmail || "Unknown")}</p>
      <p><strong>Pickup:</strong> ${escapeHtml(trip.pickupLocation || "N/A")}</p>
      <p><strong>Dropoff:</strong> ${escapeHtml(trip.dropoffLocation || "N/A")}</p>
      <p><strong>Scheduled:</strong> ${escapeHtml(trip.pickupDate || "N/A")} ${escapeHtml(trip.pickupTime || "")}</p>
      <p><strong>Price:</strong> R${escapeHtml(trip.price ?? "N/A")}</p>
      <p><a href="${link}">View requested trips</a></p>
    `
  );
}

// ── MarketPortal ─────────────────────────────────────────────────────────────────────────
// A MarketPortal order has been paid: the admins arrange collection from the seller (a driver picks it up
// from the open trips, or an admin books the courier).
export async function sendAdminOrderNotification(p: {
  summary: string;
  amount: unknown;
  buyerEmail: string | null;
  deliveryAddress?: string;
  courier: boolean;
  origin: string;
}) {
  const link = escapeHtml(`${p.origin}/admin/marketplace`);
  return send(
    await adminRecipients(),
    `New MarketPortal order: ${p.summary}`.slice(0, 120),
    `
      <p>A MarketPortal order has been paid.</p>
      <p><strong>Items:</strong> ${escapeHtml(p.summary)}</p>
      <p><strong>Paid:</strong> R${escapeHtml(p.amount)} (items and delivery)</p>
      <p><strong>Buyer:</strong> ${escapeHtml(p.buyerEmail || "Unknown")}</p>
      ${p.deliveryAddress ? `<p><strong>Deliver to:</strong> ${escapeHtml(p.deliveryAddress)}</p>` : ""}
      <p><strong>Delivery:</strong> ${p.courier ? "by courier: book the courier in the admin page" : "by a Care Runners driver: it is now in the drivers' open trips"}</p>
      <p><a href="${link}">View paid orders</a></p>
    `
  );
}

// The seller's item has been bought and paid for: get it ready for collection. Says what they will be paid,
// but nothing about the buyer (the driver handles the hand-over).
export async function sendSellerSaleEmail(p: {
  to: string[];
  sellerName: string;
  lines: { title: string; quantity: number }[];
  sellerAmount: number;
  pickupAddress: string;
  courier: boolean;
  link: string;
}) {
  if (p.to.length === 0) return false;
  const items = p.lines.map((l) => `<li>${escapeHtml(l.quantity)} x ${escapeHtml(l.title)}</li>`).join("");
  const first = p.lines[0]?.title ?? "your item";
  const subject = p.lines.length === 1 && p.lines[0].quantity === 1 ? `Your item sold: ${first}` : `You made a sale on MarketPortal`;
  return send(
    p.to,
    subject.slice(0, 120),
    `
      <p>Hi ${escapeHtml(p.sellerName)},</p>
      <p>Good news: a buyer has bought and paid for the following on Care Runners MarketPortal:</p>
      <ul>${items}</ul>
      <p><strong>Please get it ready for collection.</strong> ${
        p.courier
          ? "Care Runners will book a courier to collect it from"
          : "A Care Runners driver will collect it from"
      } <strong>${escapeHtml(p.pickupAddress)}</strong>. Only hand it to the ${p.courier ? "courier" : "Care Runners driver"}, and make sure it matches your listing.</p>
      <p><strong>You will receive:</strong> R${escapeHtml(p.sellerAmount.toFixed(2))}, paid by EFT into your bank account on file after the buyer receives the item.</p>
      <p>If the item is no longer available, contact Care Runners straight away on ${escapeHtml(SUPPORT_PHONE)} or ${escapeHtml(SUPPORT_EMAIL)}.</p>
      <p><a href="${escapeHtml(p.link)}">View your sales in My MarketPortal</a></p>
    `
  );
}

// A customer submitted (or corrected and resubmitted) an item: it waits for an admin to approve it.
// Goes to the admins and the support inbox.
export async function sendAdminItemSubmitted(p: {
  title: string;
  sellerName: string;
  sellerEmail: string | null;
  price: number;
  photos: number;
  resubmitted: boolean;
  origin: string;
}) {
  const link = escapeHtml(`${p.origin}/admin/marketplace`);
  const to = Array.from(new Set([...(await adminRecipients()), SUPPORT_EMAIL].map((e) => e.toLowerCase())));
  return send(
    to,
    `${p.resubmitted ? "Item resubmitted" : "New item"} to approve: ${p.title}`.slice(0, 120),
    `
      <p>A customer has ${p.resubmitted ? "corrected and resubmitted" : "submitted"} an item for MarketPortal. It is not visible to buyers until an admin approves it.</p>
      <p><strong>Item:</strong> ${escapeHtml(p.title)}</p>
      <p><strong>Seller:</strong> ${escapeHtml(p.sellerName)}${p.sellerEmail ? ` (${escapeHtml(p.sellerEmail)})` : ""}</p>
      <p><strong>Seller's price:</strong> R${escapeHtml(p.price)} &middot; ${escapeHtml(p.photos)} photo${p.photos === 1 ? "" : "s"}</p>
      <p><a href="${link}">Review it (Admin &gt; MarketPortal &gt; Awaiting review)</a></p>
    `
  );
}

export function sendOrderStatusEmail(p: { email: string; heading: string; lines: string[]; link: string }) {
  const items = p.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  return send(
    [p.email],
    p.heading,
    `
      <p>Hello,</p>
      <p>${escapeHtml(p.heading)}.</p>
      <ul>${items}</ul>
      <p><a href="${escapeHtml(p.link)}">View your order</a></p>
      <p>Best regards,<br/>The Carerunners Team</p>
    `
  );
}

export async function sendLowStockAlert(p: { items: { title: string; left: number }[]; link: string }) {
  const rows = p.items.map((i) => `<li>${escapeHtml(i.title)}: ${i.left === 0 ? "sold out" : `${i.left} left`}</li>`).join("");
  return send(
    await adminRecipients(),
    "MarketPortal stock is running low",
    `
      <p>These MarketPortal items have just run low:</p>
      <ul>${rows}</ul>
      <p><a href="${escapeHtml(p.link)}">Open the stock page</a></p>
    `
  );
}

export async function sendIssueAlert(p: { title: string; reason: string; description: string; buyerEmail: string | null; link: string }) {
  return send(
    await adminRecipients(),
    "MarketPortal: a buyer reported a problem",
    `
      <p>A buyer reported a problem with an order.</p>
      <p><strong>Item:</strong> ${escapeHtml(p.title)}</p>
      <p><strong>Buyer:</strong> ${escapeHtml(p.buyerEmail || "Unknown")}</p>
      <p><strong>Problem:</strong> ${escapeHtml(p.reason)}</p>
      <p>${escapeHtml(p.description)}</p>
      <p><a href="${escapeHtml(p.link)}">Review it</a></p>
    `
  );
}
