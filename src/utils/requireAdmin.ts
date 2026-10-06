// src/utils/requireAdmin.ts
import { NextRequest } from "next/server";
import { requireAuth, type AuthedUser } from "./requireAuth";
import { ADMIN_EMAILS } from "./adminEmails";

// Same admin list the admin pages use client-side, but enforced on the server
// so admin-only writes can't be reached by calling the API directly.
export async function requireAdmin(req: NextRequest): Promise<AuthedUser | null> {
  const user = await requireAuth(req);
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) return null;
  return user;
}
