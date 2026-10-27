import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The admin, the customer's own pages and the search results stay out of the index.
      disallow: ["/admin", "/crm", "/api", "/shop/cart", "/shop/checkout", "/shop/order", "/shop/orders", "/shop/search", "/shop/suggest", "/shop/my-prices"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
