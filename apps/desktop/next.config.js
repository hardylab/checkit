/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Electron loads from file:// in production; relative paths only.
  basePath: '',
  assetPrefix: '',
  output: 'export',         // static export for file:// loading in Electron prod
  images: { unoptimized: true },
  // We're a desktop app — don't try to detect telemetry or git info.
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;