import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getUserById } from "@/src/lib/authStore";
import { getToolBySlug } from "@/src/lib/dashboard";
import { getCurrentSession } from "@/src/lib/session";
import { getSubscriptionAccess, isToolLocked } from "@/src/lib/subscription";

export async function CalculatorAccessGate({ slug, children }: { slug: string; children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.id);
  const access = getSubscriptionAccess(user);

  if (getToolBySlug(slug) && isToolLocked(access, slug)) {
    return (
      <main className="app-shell">
        <section className="trial-expired-page">
          <div className="trial-expired-card">
            <p className="eyebrow">پایان مهلت تست</p>
            <h1>مهلت تست شما به پایان رسیده است</h1>
            <p>برای خرید اشتراک روی خرید اشتراک کلیک کنید.</p>
            <Link className="subscription-buy-button" href="/profile?upgrade=1">
              خرید اشتراک
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return children;
}
