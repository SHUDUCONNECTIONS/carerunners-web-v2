// src/utils/googleMapsServer.ts
// Server-only. The Google key for Distance Matrix and Geocoding calls made by the server.
//
// GOOGLE_MAPS_SERVER_API_KEY should be its own key, restricted in Google Cloud to those two APIs and
// with no website restriction (servers don't send a referrer). The public NEXT_PUBLIC_ key is shipped
// to every browser, so it must stay restricted to the app's websites, and then it can't be used here.
// Until the server key is set, the public key is used so deliveries keep pricing, with a warning.
let warned = false;

export function serverMapsKey(): string | undefined {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (key) return key;
  if (!warned) {
    warned = true;
    console.warn("GOOGLE_MAPS_SERVER_API_KEY is not set: using the public Maps key on the server. Create a server key (see src/utils/googleMapsServer.ts).");
  }
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}
