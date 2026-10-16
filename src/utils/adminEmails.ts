// src/utils/adminEmails.ts
// Server-only. Admins are marked with an "admin" flag on their login (scripts/set-admin.mjs), which
// the app, the server and the Firestore rules check. This list is the OLD way, kept only until that
// script has been run for these people; then empty it here and in firebase-rules/firestore.rules.
// It used to be shipped to every browser; the browser now asks the server (/api/admin/me) instead,
// so don't import this from client code.

export const LEGACY_ADMIN_EMAILS = ["dimakatso@shuduconnections.com", "tetelo@shuduconnections.com", "tshikovhitshedza9@gmail.com", "tshedza@gmail.com", "lucky@shuduconnections.com"];
