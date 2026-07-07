/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "192.168.1.5",
    "192.168.1.3",
    "172.18.0.1",
    "localhost",
  ],
};

export default nextConfig;
