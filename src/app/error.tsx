"use client";

import Link from "next/link";
import { useEffect } from "react";
import { House, RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Shown when a page fails while rendering, instead of Next's English error screen.
 * "Try again" re-renders the page; the error itself goes to the console for debugging.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-shell status-page" dir="rtl">
      <section className="status-card is-error" role="alert">
        <span className="status-icon"><TriangleAlert size={26} aria-hidden="true" /></span>
        <h1>مشکلی پیش آمد</h1>
        <p>نمایش این صفحه با خطا روبه‌رو شد. دوباره تلاش کنید؛ اگر مشکل ادامه داشت، چند دقیقه بعد سر بزنید یا با ما تماس بگیرید.</p>
        {error.digest ? <small className="status-digest">کد پیگیری: <span dir="ltr">{error.digest}</span></small> : null}
        <div className="status-actions">
          <button type="button" className="primary-action" onClick={reset}><RotateCcw size={17} aria-hidden="true" />تلاش دوباره</button>
          <Link href="/" className="secondary-action"><House size={17} aria-hidden="true" />صفحه اصلی</Link>
        </div>
      </section>
    </main>
  );
}
