// A plain-language reason a "Continue with Google" attempt failed, shared by login, sign-up and invitations.
// Firebase reports the cause as an error code; without this every failure read as "An error occurred".
const MESSAGES: Record<string, string> = {
  "auth/unauthorized-domain":
    "Google sign-in isn't allowed on this web address. Open Care Runners at www.carerunners.app, or sign in with your email and password.",
  "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before you finished. Please try again.",
  "auth/cancelled-popup-request": "The Google sign-in window was closed before you finished. Please try again.",
  "auth/operation-not-supported-in-this-environment":
    "Google sign-in doesn't work inside this app's built-in browser. Open the link in Safari or Chrome, or sign in with your email and password.",
  "auth/web-storage-unsupported":
    "This browser is blocking the storage Google sign-in needs (often private browsing). Try a normal window, or sign in with your email and password.",
  "auth/account-exists-with-different-credential": "An account already exists with this email. Sign in with your email and password instead.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/network-request-failed": "Network error. Please check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
}

export function googleSignInError(error: unknown, fallback = "Google sign-in didn't work. Please try again."): string {
  const code = (error as { code?: string } | null)?.code
  return (code && MESSAGES[code]) || (code ? `${fallback} (${code})` : fallback)
}
