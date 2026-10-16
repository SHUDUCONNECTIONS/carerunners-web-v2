// src/utils/isAdminAccount.ts
"use client";
import type { User } from "firebase/auth";

// Whether to show admin screens to this person. Reads the "admin" flag on their login, and otherwise
// asks the server (which still accepts the old admin list for now). The server checks every admin
// action again, so this only decides what is shown.
// A login token only picks up a newly added admin flag when it is refreshed (hourly, or on sign-in), so the
// first check on each page load asks for a fresh token once.
let refreshedFor: string | null = null;

export async function isAdminAccount(user: User): Promise<boolean> {
  try {
    const forceRefresh = refreshedFor !== user.uid;
    refreshedFor = user.uid;
    const token = await user.getIdTokenResult(forceRefresh);
    if (token.claims.admin === true) return true;
    const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token.token}` } });
    return res.ok && (await res.json()).admin === true;
  } catch {
    return false;
  }
}
