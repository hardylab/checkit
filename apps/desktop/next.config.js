/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We run as a local server inside Electron (renderer loads from
  // http://localhost:3000), NOT a static export. We need server routes
  // (/api/*) to read the rule catalog and run the checkit CLI.
  output: undefined,
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  // Allow large rule bodies in API responses
  experimental: {
    largePageDataBytes: 128 * 1024,
  },
};

module.exports = nextConfig;