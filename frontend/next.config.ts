import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't let the dev server drop an AGENTS.md into the project root.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;