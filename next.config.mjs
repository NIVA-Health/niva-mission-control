/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone with a self-contained server.js — smallest Cloud Run image.
  output: "standalone",
};
export default nextConfig;
