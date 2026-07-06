import { dashboardCategories } from "@/src/lib/dashboard";
import { normalizeDigits } from "@/src/lib/format";

export const minimumSearchLength = 4;

export const searchIndex = dashboardCategories.flatMap((category) =>
  category.tools.map((tool) => ({
    ...tool,
    categoryTitle: category.title,
    haystack: normalizeText([
      tool.title,
      tool.subtitle,
      tool.description,
      tool.metric,
      tool.slug,
      category.title,
      category.subtitle
    ].join(" "))
  }))
);

export function normalizeText(value: string) {
  return normalizeDigits(value)
    .toLowerCase()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[‌ـ]/g, " ")
    .replace(/[^\p{L}\p{N}.\/\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSearchTerms(query: string) {
  return normalizeText(query).split(" ").filter(Boolean);
}

export function searchTools(query: string, lockedToolSlugs: string[] = [], limit = 7) {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < minimumSearchLength) return [];

  const lockedTools = new Set(lockedToolSlugs);
  const terms = getSearchTerms(query);

  return searchIndex
    .filter((item) => !lockedTools.has(item.slug))
    .map((item) => {
      const normalizedTitle = normalizeText(item.title);
      const normalizedCategory = normalizeText(item.categoryTitle);
      const score = terms.reduce((sum, term) => {
        if (normalizedTitle === normalizedQuery) return sum + 10;
        if (normalizedTitle.includes(term)) return sum + 5;
        if (normalizedCategory.includes(term)) return sum + 3;
        if (item.slug.includes(term)) return sum + 3;
        if (item.haystack.includes(term)) return sum + 1;
        return sum;
      }, 0);

      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "fa"))
    .slice(0, limit);
}
