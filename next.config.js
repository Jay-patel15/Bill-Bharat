/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Emits .next/standalone with a self-contained server.js + a traced
  // node_modules, which is what the packaged Electron app runs.
  output: "standalone",

  // Uploaded logos and PDFs are served from /api/files, so no remote hosts.
  images: { remotePatterns: [] },

  experimental: {
    serverActions: { bodySizeLimit: "10mb" },

    // Keep the SQLite driver out of the webpack bundle: it loads its .wasm
    // binary from disk relative to its own module path, which bundling breaks.
    serverComponentsExternalPackages: ["node-sqlite3-wasm"],

    // File tracing follows require() calls, not the runtime fs.readFileSync
    // the driver uses to load the .wasm — include it explicitly or the
    // packaged app starts and then fails on first query.
    outputFileTracingIncludes: {
      "**": ["./node_modules/node-sqlite3-wasm/dist/*.wasm"]
    }
  }
};

module.exports = nextConfig;
