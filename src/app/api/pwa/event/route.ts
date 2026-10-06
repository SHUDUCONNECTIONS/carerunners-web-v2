// app/api/pwa/event/route.ts
// Anonymous install analytics. The browser sends a random device id and what
// happened (prompt shown/accepted/dismissed, installed, launched from the home
// screen). Nothing here identifies a person.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/utils/firebaseAdmin";
import { PWA_DEVICES, PWA_EVENT_TYPES, PWA_PLATFORMS, type PwaEventType } from "@/lib/pwa";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Best-effort limit per IP, so this open endpoint can't be used to flood the database.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const type = body?.type as PwaEventType;
  const platform = (PWA_PLATFORMS as readonly string[]).includes(body?.platform) ? body.platform : "other";
  if (!UUID.test(deviceId) || !(PWA_EVENT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const ref = adminDb().collection(PWA_DEVICES).doc(deviceId.toLowerCase());
    const existing = (await ref.get()).data();
    const now = Date.now();

    const update: Record<string, unknown> = { platform, lastSeenAt: now };
    if (!existing) update.firstSeenAt = now;

    // First time each milestone happens is what we count.
    const first = (field: string) => {
      if (!existing?.[field]) update[field] = now;
    };
    if (type === "prompt_shown") first("promptShownAt");
    if (type === "prompt_accepted") first("promptAcceptedAt");
    if (type === "prompt_dismissed") first("promptDismissedAt");
    if (type === "installed") first("installedAt");
    if (type === "launch") {
      update.lastStandaloneAt = now;
      update.standaloneLaunches = FieldValue.increment(1);
      first("installedAt"); // launching from the home screen proves it's installed
    }

    await ref.set(update, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("pwa event failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
