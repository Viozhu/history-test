import type { NextConfig } from "next";

// Fully static app: every exam round is prerendered from data/exams/*.json at build time.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        // CSS Modules must keep their default processing (scoped class names),
        // so the Tailwind loader only handles global stylesheets.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
