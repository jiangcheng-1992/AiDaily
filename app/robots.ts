import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth", "/me", "/saved"],
      },
      {
        userAgent: ["Googlebot", "Bingbot", "Baiduspider", "BaiduSpider"],
        allow: "/",
        disallow: ["/api/", "/auth", "/me", "/saved"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
