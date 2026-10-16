// app/api/admin/marketplace/searches/route.ts
// Admin-only: the most searched terms. Returns term-level totals only; there is nothing about
// individual buyers to return because none is stored.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { MIN_SEARCHES_SHOWN, SEARCHES_COLLECTION, summarize, type SearchStatRow } from "@/lib/marketplaceSearchStats";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ message: "Admins only" }, { status: 403 });
  const requested = Number(req.nextUrl.searchParams.get("days"));
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  try {
    const snap = await adminDb().collection(SEARCHES_COLLECTION).orderBy("count", "desc").limit(500).get();
    const rows: SearchStatRow[] = snap.docs.map((d) => {
      const x = d.data();
      return { term: x.term ?? "", count: x.count ?? 0, zeroResults: x.zeroResults ?? 0, daily: x.daily ?? {}, lastAt: x.lastAt ?? 0 };
    });
    return NextResponse.json({ days, minSearches: MIN_SEARCHES_SHOWN, searches: summarize(rows, days).slice(0, 100) });
  } catch (err) {
    console.error("Error loading searches for admin:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
