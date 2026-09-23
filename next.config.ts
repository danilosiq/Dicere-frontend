import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The private browser pilot proxies dicere.cloud to the local candidate.
  // This is read only by Next dev; production origin policy is unchanged.
  allowedDevOrigins: ["dicere.cloud"],
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/favicon.svg", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), on-device-speech-recognition=(self)",
          },
        ],
      },
    ];
  },
  images: {
    qualities: [75, 100],
  },
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.svg": {
        loaders: [
          {
            loader: "@svgr/webpack",
            options: {
              expandProps: "end",
            },
          },
        ],
        as: "*.js",
      },
    },
  },
  output: "standalone",
};

export default nextConfig;
