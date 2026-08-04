// src/utils/requireAuth.ts
import { NextRequest } from "next/server";
import { adminAuth } from "./firebaseAdmin";

export type AuthedUser = { uid: string; email: string | null };

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>" by
// the client. Returns the caller's uid/email, or null if the token is
// missing/invalid — callers must turn that into a 401.
export async function requireAuth(req: NextRequest): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const idToken = header.slice("Bearer ".length);
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (err) {
    console.error("requireAuth: invalid ID token", err);
    return null;
  }
}
