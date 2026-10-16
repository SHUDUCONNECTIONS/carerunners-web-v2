// src/utils/requireAuth.ts
import { NextRequest } from "next/server";
import { adminAuth } from "./firebaseAdmin";

/** `admin`: the "admin" flag on the login, set by scripts/set-admin.mjs. */
export type AuthedUser = { uid: string; email: string | null; emailVerified: boolean; admin?: boolean };

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>" by
// the client. Returns the caller's uid/email, or null if the token is
// missing/invalid — callers must turn that into a 401.
export async function requireAuth(req: NextRequest): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const idToken = header.slice("Bearer ".length);
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null, emailVerified: decoded.email_verified === true, admin: decoded.admin === true };
  } catch (err) {
    console.error("requireAuth: invalid ID token", err);
    return null;
  }
}
