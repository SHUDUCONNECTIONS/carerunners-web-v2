// src/utils/authedFetch.ts
"use client";
import { auth } from "./firebase";

// Attaches the signed-in user's Firebase ID token so payment API routes can
// verify who's calling instead of trusting client-supplied ids/amounts.
export async function authedFetch(input: string, init: RequestInit = {}) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error("You must be signed in to do this.");
  }

  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  });
}
