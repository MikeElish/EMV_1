import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "exceljs"],
  async redirects() {
    return [{ source: "/p", destination: "/shop", permanent: true }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
    staleTimes: {
      dynamic: 30,
      static: 30,
    },
  },
};

export default nextConfig;
