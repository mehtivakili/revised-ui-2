import { redirect } from "next/navigation";
import { ProjectWizard } from "@/src/components/smart/ProjectWizard";
import { getCurrentSession } from "@/src/lib/session";
import type { Metadata } from "next";
import { pageMetadata } from "@/src/lib/seo";

export const metadata: Metadata = pageMetadata("/planner", "طراحی هوشمند پروژه دوربین مداربسته", "نقشه محل را بکشید، دوربین‌ها را روی آن بچینید و پوشش DORI، فهرست تجهیزات و گزارش مهندسی پروژه را بگیرید.");

export default async function PlannerPage() {
  if (!(await getCurrentSession())) redirect("/login?next=%2Fplanner");
  return <main className="app-shell smart-page"><ProjectWizard /></main>;
}
