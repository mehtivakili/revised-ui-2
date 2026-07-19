import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { CatalogExplorer } from "@/src/components/smart/CatalogExplorer";
import { getCatalogSnapshot } from "@/src/lib/catalog/repository";
import { getCurrentSession } from "@/src/lib/session";

export default async function CatalogPage() {
  if (!(await getCurrentSession())) redirect("/login");
  const catalog = await getCatalogSnapshot();
  return <main className="app-shell catalog-page">
    <section className="page-intro"><div><p className="eyebrow">آینه کاتالوگ پرشیا سیستم</p><h1>محصولات با مشخصات قابل تصمیم‌گیری</h1><p>ویژگی‌های فنی از متن آزاد جدا شده‌اند تا فیلتر، مقایسه و پیشنهاد هوشمند قابل‌اعتماد باشد.</p></div><div className="sync-status"><span className="live-dot" /><div><strong>{catalog.dataMode === "database-mock" ? "متصل به PostgreSQL" : "داده نمایشی آماده"}</strong><small>به‌روزرسانی نمونه: {new Intl.DateTimeFormat("fa-IR").format(new Date(catalog.updatedAt))}</small></div></div></section>
    <div className="data-notice"><Database size={19} /><p><strong>حالت Mock فعال است.</strong> مدل و دسته‌بندی‌ها با الگوی محصولات ddcpersia.com ساخته شده‌اند، اما قیمت و موجودی واقعی نیستند.</p></div>
    <CatalogExplorer products={catalog.products} />
  </main>;
}
