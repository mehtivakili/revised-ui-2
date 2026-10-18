import type { Metadata } from "next";
import { getToolBySlug } from "@/src/lib/dashboard";

/**
 * Page titles and descriptions for search results.
 *
 * Calculator metadata is built from the same tool list the toolbox shows, so a tool's
 * title in Google always matches its card. The root layout adds "| همیار دوربین".
 */

export function toolMetadata(slug: string, extraKeywords: string[] = []): Metadata {
  const tool = getToolBySlug(slug);
  if (!tool) return {};
  const title = `${tool.title} — ${tool.subtitle}`;
  const description = `${tool.description} ابزار آنلاین و رایگان همیار دوربین برای طراحان و نصابان دوربین مداربسته و شبکه.`;
  return {
    title,
    description,
    keywords: [tool.title, tool.subtitle, ...extraKeywords],
    alternates: { canonical: `/calculators/${slug}` },
    openGraph: { title, description, url: `/calculators/${slug}`, type: "website", locale: "fa_IR" }
  };
}

export function pageMetadata(
  path: string,
  title: string,
  description: string,
  options: { index?: boolean; absoluteTitle?: boolean } = {}
): Metadata {
  return {
    // The home page title already names the site, so it skips the "| همیار دوربین" suffix.
    title: options.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", locale: "fa_IR" },
    ...(options.index === false ? { robots: { index: false, follow: true } } : {})
  };
}
