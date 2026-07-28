/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // Supabase Storage public bucket URLs
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  },

  experimental: {
    serverActions: { bodySizeLimit: "10mb" }
  }
};

module.exports = nextConfig;
