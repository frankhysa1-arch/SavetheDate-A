import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module: keep it out of the server bundle.
  // (Next already treats it as external by default; listed here to be explicit.)
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      // Tailwind v4 via the Turbopack loader (no postcss config needed).
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
