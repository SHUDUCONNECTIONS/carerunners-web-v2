"use client";
// Browser side of push alerts: asks permission, gets this device's Firebase Cloud Messaging token and
// hands it to the server (which stores it against the signed-in user).
import { getApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import "./firebase";
import { authedFetch } from "./authedFetch";

// The "Web Push certificate" key pair from Firebase Console > Project settings > Cloud Messaging.
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const pushConfigured = Boolean(VAPID_KEY);

export async function pushSupported(): Promise<boolean> {
  if (!VAPID_KEY || typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  return isSupported().catch(() => false);
}

async function currentToken(): Promise<string | null> {
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  return token || null;
}

async function send(method: "POST" | "DELETE", token: string) {
  const res = await authedFetch("/api/push/register", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("Could not save your notification settings.");
}

// Must be called from a tap: browsers block permission prompts that appear on their own.
export async function enablePush(): Promise<"enabled" | "denied"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const token = await currentToken();
  if (!token) throw new Error("This device could not be registered for notifications.");
  await send("POST", token);
  return "enabled";
}

// Keeps the server's copy fresh: tokens can rotate, and the same device may now belong to a different account.
export async function refreshPush(): Promise<boolean> {
  if (Notification.permission !== "granted") return false;
  const token = await currentToken();
  if (!token) return false;
  await send("POST", token);
  return true;
}

export async function disablePush() {
  const token = await currentToken().catch(() => null);
  if (token) await send("DELETE", token).catch(() => {});
  await deleteToken(getMessaging(getApp())).catch(() => {});
}
