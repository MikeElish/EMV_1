import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font data from its own folder at run time.
  serverExternalPackages: ["pdfkit"],
  // The old «Магазин запчастей» stub page: old links land in the shop.
  async redirects() {
    return [{ source: "/p", destination: "/shop", permanent: true }];
  },
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
