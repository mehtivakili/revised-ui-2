/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  // Keep the DWG WebAssembly reader as a Node dependency so its adjacent .wasm asset
  // remains discoverable by the conversion route after deployment.
  serverExternalPackages: ["@mlightcad/libredwg-web"],
  // CI/local verification can use NEXT_DIST_DIR=.next-build without colliding
  // with a running development server's .next cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lock Turbopack to this project when other package manifests exist nearby.
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ddcpersia.com" },
      { protocol: "https", hostname: "www.ddcpersia.com" },
    ],
  },
  allowedDevOrigins: [
    "192.168.1.5",
    "192.168.1.3",
    "172.18.0.1",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
