/** @type {import('next').NextConfig} */
const apiRewriteTarget =
  process.env.API_REWRITE_TARGET || "https://api.interviewbrain.xyz";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiRewriteTarget.replace(/\/$/, "")}/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
