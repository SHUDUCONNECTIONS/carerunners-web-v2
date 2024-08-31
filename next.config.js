/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
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