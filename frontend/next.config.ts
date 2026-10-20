import type { NextConfig } from "next";

// The API lives on its own origin (Render). Proxying /api/* through Vercel
// makes every browser call SAME-ORIGIN, so the auth cookie is an ordinary
// first-party cookie. Without this, iOS Safari's "Prevent Cross-Site
// Tracking" silently drops the Set-Cookie from the login response and the
// app bounces straight back to /login.
//
// API_PROXY_TARGET is a build-time server-side value (not NEXT_PUBLIC_*) —
// set it in Vercel if the API ever moves.
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? "https://scheduleai-zflz.onrender.com";

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
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
