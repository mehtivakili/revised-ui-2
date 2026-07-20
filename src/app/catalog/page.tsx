import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { CatalogExplorer } from "@/src/components/smart/CatalogExplorer";
import { getCatalogSnapshot } from "@/src/lib/catalog/repository";
import { getSourceCatalogPage } from "@/src/lib/catalog/source-repository";
import { getCurrentSession } from "@/src/lib/session";

export default async function CatalogPage() {
  if (!(await getCurrentSession())) redirect("/login");
  const [catalog, sourceCatalog] = await Promise.all([getCatalogSnapshot(), getSourceCatalogPage({ page: 1, limit: 24, inStockOnly: true })]);
  return <main className="app-shell catalog-page">
    <section className="page-intro"><div><p className="eyebrow">آینه فقط‌خواندنی پرشیا سیستم</p><h1>همه محصولات و ویژگی‌های واقعی</h1><p>فهرست WooCommerce، تصاویر و ویژگی‌ها در دیتابیس داخلی اپ نگهداری و برای محاسبات استاندارد می‌شوند.</p></div><div className="sync-status"><span className="live-dot" /><div><strong>{catalog.dataMode === "woocommerce-live" ? "کاتالوگ واقعی متصل است" : catalog.dataMode === "database-mock" ? "متصل به PostgreSQL" : "داده نمایشی آماده"}</strong><small>آخرین داده: {new Intl.DateTimeFormat("fa-IR").format(new Date(catalog.updatedAt))}</small></div></div></section>
    {catalog.dataMode !== "woocommerce-live" ? <div className="data-notice"><Database size={19} /><p><strong>هنوز Snapshot واقعی دریافت نشده است.</strong> از پنل مدیریت «دریافت محصولات» را اجرا کنید؛ تا آن زمان داده نمایشی نشان داده می‌شود.</p></div> : null}
    <CatalogExplorer initialPage={sourceCatalog} />
  </main>;
}
