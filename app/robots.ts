import type { MetadataRoute } from "next";

import { canonicalUrl, getCanonicalSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth",
          "/me",
          "/saved",
          "/_next/",
          "/*.json$",
        ],
      },
      {
        userAgent: ["Googlebot", "Bingbot", "Baiduspider", "BaiduSpider"],
        allow: "/",
        disallow: ["/api/", "/auth", "/me", "/saved", "/_next/"],
      },
    ],
    sitemap: canonicalUrl("/sitemap.xml"),
    host: getCanonicalSiteUrl(),
  };
}
