// app/api/peach-webhook/route.ts
// Peach's server-to-server payment notification. Without it a payment only
// completes if the buyer's browser returns to the status page; closing the tab
// after paying left the trip stuck on "awaiting-payment".
//
// The body is treated purely as a hint about WHICH checkout changed. We never
// read an amount or a result from it: finalizeCheckout asks Peach for the real
// result with our own credentials, so a forged request can at worst trigger a
// harmless re-check of a checkout that really exists.
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/utils/firebaseAdmin";
import { finalizeCheckout } from "@/utils/finalizeCheckout";

const ID_SHAPE = /^[A-Za-z0-9._-]{8,100}$/;
const MAX_CANDIDATES = 40;

function tokenOk(given: string | null): boolean {
  const expected = process.env.PEACH_WEBHOOK_TOKEN;
  if (!expected) return true; // not configured: the Peach re-check is the protection
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Every short string anywhere in the payload is a possible checkout id. The
// notification's `ndc` is "<checkoutId>_<suffix>", so that prefix is included.
function candidateIds(value: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (out.size >= MAX_CANDIDATES || depth > 4) return out;
  if (typeof value === "string") {
    for (const s of [value, value.split("_")[0]]) if (ID_SHAPE.test(s)) out.add(s);
  } else if (Array.isArray(value)) {
    for (const v of value) candidateIds(v, out, depth + 1);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) candidateIds(v, out, depth + 1);
  }
  return out;
}

async function readBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await readBody(req);
  const query = Object.fromEntries(req.nextUrl.searchParams);
  delete query.token;
  const ids = candidateIds([body, query]);

  const db = adminDb();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  let matched = 0;
  try {
    for (const id of ids) {
      const snap = await db.collection("checkouts").doc(id).get();
      if (!snap.exists) continue;
      matched++;
      await finalizeCheckout(db, id, { origin });
    }
  } catch (err) {
    // A non-2xx makes Peach retry the notification later.
    console.error("peach-webhook: could not finalize checkout", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }

  // 200 even when nothing matched, so an unknown or already-handled id isn't retried forever.
  if (matched === 0) console.warn("peach-webhook: no known checkout in notification");
  return NextResponse.json({ ok: true });
}
