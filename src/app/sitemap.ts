import type { MetadataRoute } from "next";
import { dashboardTools } from "@/src/lib/dashboard";
import { SITE_URL } from "@/src/lib/site";

/** Public pages only; account, admin and project pages are private and left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" = "monthly") => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority
  });
  return [
    page("/", 1, "weekly"),
    page("/calculators", 0.9, "weekly"),
    page("/planner", 0.9, "weekly"),
    page("/catalog", 0.8, "weekly"),
    page("/contacts", 0.4),
    ...dashboardTools.map((tool) => page(`/calculators/${tool.slug}`, 0.8))
  ];
}
