import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The backend is a small Node.js provider proxy. Do not enable Cloudflare,
  // Vite, Vinext, or an alternate output mode for the Vercel deployment.
  serverExternalPackages: ['sharp', 'playwright'],
};

export default nextConfig;
