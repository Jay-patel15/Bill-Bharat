/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the multi-stage Docker standalone build
  output: "standalone",

  reactStrictMode: true,

  images: {
    remotePatterns: [
      // Google Drive (legacy cloud storage backend)
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // MinIO (self-hosted storage) — pre-signed URLs use the MINIO_ENDPOINT hostname
      // Add your MinIO public domain here if using a reverse-proxied MinIO endpoint
      { protocol: "http",  hostname: process.env.MINIO_ENDPOINT || "minio" },
      { protocol: "https", hostname: process.env.MINIO_PUBLIC_DOMAIN || "minio" }
    ]
  },

  experimental: {
    serverActions: { bodySizeLimit: "10mb" }
  }
};

module.exports = nextConfig;
