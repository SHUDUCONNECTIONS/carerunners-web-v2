/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Next 15 streams page metadata into <body> for normal browsers. Browsers only read the manifest link,
    // icons and theme colour from <head>, so streamed metadata made the app impossible to install. Matching
    // every visitor here puts metadata in <head> for everyone (it is all static, so nothing is slower).
    htmlLimitedBots: /.*/,
    async headers() {
      return [
        {
          // Security headers on every response. No other site may show our pages in a frame
          // (clickjacking on login/payment); browsers must not guess content types; only send the
          // origin to other sites; HTTPS only. Camera (proof photos) and location (driver map) are
          // allowed for our own pages only.
          source: '/:path*',
          headers: [
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
            { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
          ],
        },
        {
          // The service worker must never be cached, or devices would keep running an old copy.
          source: '/sw.js',
          headers: [
            { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
            { key: 'Service-Worker-Allowed', value: '/' },
          ],
        },
        {
          source: '/manifest.json',
          headers: [
            { key: 'Content-Type', value: 'application/manifest+json' },
            { key: 'Cache-Control', value: 'public, max-age=3600' },
          ],
        },
      ];
    },
    async redirects() {
      return [
        {
          source: '/',
          destination: '/dashboard',
          permanent: true, // Set to false if this is a temporary redirect
        },
      ];
    },
  };
  
  module.exports = nextConfig;