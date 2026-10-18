import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or per-account pages, and the API, have nothing for a search engine.
        disallow: ["/admin", "/api/", "/profile", "/projects/", "/search", "/llm-lab.html"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
