// app/api/admin/me/route.ts
// Tells the browser whether the signed-in person is an admin, so the admin list never has to be
// shipped to the browser. Only for showing or hiding admin screens: every admin API checks again.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { isAdminUser } from "@/utils/requireAdmin";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ admin: isAdminUser(user) }, { headers: { "Cache-Control": "private, no-store" } });
}
