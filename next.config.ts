import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
