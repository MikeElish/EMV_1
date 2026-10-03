import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Mail attachments go through a server action; Nginx caps requests at 20 MB.
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // Admin tabs prefetch full pages in the background; cap how long that
    // prefetched data is reused (default 5 min) so a tab switch never shows
    // stale orders/products for long.
    staleTimes: {
      dynamic: 30,
      static: 30,
    },
  },
};

export default nextConfig;
