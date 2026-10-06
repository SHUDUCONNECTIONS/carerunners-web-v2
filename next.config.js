/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
      return [
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