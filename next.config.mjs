/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
