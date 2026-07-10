import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { getUserById } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";
import { getSubscriptionAccess } from "@/src/lib/subscription";
import { minimumSearchLength, normalizeText, searchTools } from "@/src/lib/toolSearch";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.id);
  const access = getSubscriptionAccess(user);
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q ?? "";
  const normalizedQuery = normalizeText(query);
  const results = searchTools(query, access.lockedToolSlugs, 12);

  return (
    <main className="app-shell search-page">
      <section className="page-hero compact-hero">
        <p className="eyebrow">جستجو</p>
        <h1>نتایج جستجوی ابزارها</h1>
        <p>{query ? `نتایج برای «${query}»` : "نام ابزار، دسته یا عبارت فنی را وارد کنید."}</p>
      </section>

      <section className="search-results-card">
        <form className="search-page-form" action="/search" method="get">
          <Search size={18} aria-hidden="true" />
          <input name="q" type="search" defaultValue={query} placeholder="مثلا RAID، IP، لنز..." autoFocus />
          <button type="submit">جستجو</button>
        </form>

        {normalizedQuery.length > 0 && normalizedQuery.length < minimumSearchLength ? (
          <p className="search-empty">برای جستجوی دقیق حداقل ۴ کاراکتر وارد کنید.</p>
        ) : results.length > 0 ? (
          <div className="search-result-list">
            {results.map(({ item }) => (
              <Link key={item.slug} href={`/calculators/${item.slug}`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.categoryTitle} · {item.subtitle}</small>
                </span>
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : query ? (
          <p className="search-empty">ابزاری با این عبارت پیدا نشد.</p>
        ) : null}
      </section>
    </main>
  );
}
