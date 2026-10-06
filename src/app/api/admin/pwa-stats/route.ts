// app/api/admin/pwa-stats/route.ts
// Admin-only install numbers, tallied from the anonymous pwaDevices records.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { PWA_DEVICES, PWA_PLATFORMS } from "@/lib/pwa";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ message: "Admins only" }, { status: 403 });

  try {
    const col = adminDb().collection(PWA_DEVICES);
    const count = async (field: string) => (await col.where(field, ">", 0).count().get()).data().count;

    const [seen, promptShown, promptAccepted, promptDismissed, installedSnap] = await Promise.all([
      col.count().get().then((s) => s.data().count),
      count("promptShownAt"),
      count("promptAcceptedAt"),
      count("promptDismissedAt"),
      col.where("installedAt", ">", 0).limit(5000).get(),
    ]);

    const now = Date.now();
    const byPlatform: Record<string, number> = Object.fromEntries(PWA_PLATFORMS.map((p) => [p, 0]));
    let active7 = 0;
    let active30 = 0;
    let launches = 0;
    for (const d of installedSnap.docs) {
      const x = d.data();
      byPlatform[x.platform] = (byPlatform[x.platform] ?? 0) + 1;
      launches += Number(x.standaloneLaunches) || 0;
      if (x.lastStandaloneAt > now - 7 * DAY) active7++;
      if (x.lastStandaloneAt > now - 30 * DAY) active30++;
    }

    return NextResponse.json({
      devicesSeen: seen,
      installed: installedSnap.size,
      active7,
      active30,
      launches,
      promptShown,
      promptAccepted,
      promptDismissed,
      byPlatform,
    });
  } catch (err) {
    console.error("pwa stats failed:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
