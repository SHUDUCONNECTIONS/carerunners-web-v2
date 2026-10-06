// app/api/admin/marketplace/listings/route.ts
// Admin-only: list an item on behalf of a company. The item goes live
// immediately with both prices set by the admin; the pickup address and phone
// come from the company, never from the request.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { createListing, parseListingInput } from "@/utils/marketplaceListing";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ message: "Admins only" }, { status: 403 });

  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = parseListingInput(b, { admin: true });
  if ("error" in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });
  if (!parsed.data.companyId) return NextResponse.json({ message: "Choose a company." }, { status: 400 });

  try {
    const result = await createListing(adminDb(), parsed.data, admin.uid, "active");
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status });
    return NextResponse.json({ id: result.id });
  } catch (err) {
    console.error("Error creating marketplace listing:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
