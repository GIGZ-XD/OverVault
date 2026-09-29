/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const targetUrl = rawApi.trim().replace(/\/api\/?$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${targetUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

