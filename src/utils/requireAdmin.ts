// src/utils/requireAdmin.ts
import { NextRequest } from "next/server";
import { requireAuth, type AuthedUser } from "./requireAuth";
import { LEGACY_ADMIN_EMAILS } from "./adminEmails";

// An admin has the "admin" flag on their login (scripts/set-admin.mjs). Until that script has been run
// for everyone, a verified email on the old list counts too. Without the verified check, anyone could
// sign up with an admin address that has no account yet and be treated as an admin.
// Same rule as isAdmin() in firebase-rules/firestore.rules.
export function isAdminUser(user: AuthedUser | null): boolean {
  if (!user) return false;
  if (user.admin === true) return true;
  return !!user.email && user.emailVerified && LEGACY_ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// Enforced on the server so admin-only writes can't be reached by calling the API directly.
export async function requireAdmin(req: NextRequest): Promise<AuthedUser | null> {
  const user = await requireAuth(req);
  return isAdminUser(user) ? user : null;
}
