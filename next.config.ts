import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  output: 'standalone',
};

export default nextConfig;
