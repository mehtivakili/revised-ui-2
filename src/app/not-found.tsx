import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Compass, House, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "صفحه پیدا نشد",
  robots: { index: false, follow: true }
};

/** Shown for any address that does not exist, instead of Next's English default. */
export default function NotFound() {
  return (
    <main className="app-shell status-page" dir="rtl">
      <section className="status-card">
        <span className="status-code" aria-hidden="true">۴۰۴</span>
        <span className="status-icon"><Compass size={26} aria-hidden="true" /></span>
        <h1>این صفحه پیدا نشد</h1>
        <p>نشانی را درست وارد کرده‌اید؟ ممکن است صفحه جابه‌جا یا حذف شده باشد. از یکی از مسیرهای زیر ادامه دهید.</p>
        <div className="status-actions">
          <Link href="/" className="primary-action"><House size={17} aria-hidden="true" />صفحه اصلی</Link>
          <Link href="/planner" className="secondary-action"><Sparkles size={17} aria-hidden="true" />طراحی هوشمند</Link>
          <Link href="/calculators" className="secondary-action"><Calculator size={17} aria-hidden="true" />ابزارهای محاسباتی</Link>
        </div>
      </section>
    </main>
  );
}
