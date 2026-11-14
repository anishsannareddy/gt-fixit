import type { NextConfig } from "next";

// We deliberately leave `cacheComponents` OFF (the Next 16 default template turns it on).
// Every page here shows live maintenance data and reads the demo-role cookie,
// so the classic "dynamic by default when you read cookies" model is simpler
// for the team to work with. See node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md
const nextConfig: NextConfig = {
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
