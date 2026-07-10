import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Crown, ShieldCheck, UserRound } from "lucide-react";
import { getUserById } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";
import { getSubscriptionAccess } from "@/src/lib/subscription";

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.id);
  if (!user) redirect("/login");

  const access = getSubscriptionAccess(user);

  return (
    <main className="app-shell">
      <section className="profile-page">
        <div className="calc-header">
          <div>
            <p className="eyebrow">پروفایل</p>
            <h1>پروفایل کاربر</h1>
            <p className="lead">اطلاعات حساب، نوع اشتراک و وضعیت مهلت تست اینجا نمایش داده می‌شود.</p>
          </div>
        </div>

        <section className="profile-grid">
          <article className="panel profile-card">
            <span className="profile-card-icon">
              <UserRound size={22} aria-hidden="true" />
            </span>
            <div>
              <span>نام کاربری</span>
              <strong>{user.username}</strong>
              <small>{user.displayName}</small>
            </div>
          </article>

          <article className="panel profile-card">
            <span className="profile-card-icon">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <div>
              <span>نقش</span>
              <strong>{user.role === "admin" ? "مدیر" : "کاربر"}</strong>
              <small>{user.role === "admin" ? "دسترسی کامل مدیریتی" : "دسترسی کاربری"}</small>
            </div>
          </article>

          <article className="panel profile-card">
            <span className="profile-card-icon">
              <Crown size={22} aria-hidden="true" />
            </span>
            <div>
              <span>نوع اشتراک</span>
              <strong>{access.plan === "pro" ? "حساب حرفه‌ای" : "حساب رایگان"}</strong>
              <small>{access.restricted ? "مهلت تست تمام شده است" : access.plan === "free" ? `${access.trialDaysRemaining} روز از تست باقی مانده` : "دسترسی کامل فعال است"}</small>
            </div>
          </article>

          <article className="panel profile-card">
            <span className="profile-card-icon">
              <CalendarClock size={22} aria-hidden="true" />
            </span>
            <div>
              <span>تاریخ ثبت‌نام</span>
              <strong>{new Date(access.signupAt).toLocaleDateString("fa-IR")}</strong>
              <small>پایان تست: {new Date(access.trialEndsAt).toLocaleDateString("fa-IR")}</small>
            </div>
          </article>
        </section>

        {access.restricted ? (
          <section className="panel profile-upgrade-panel">
            <h2>مهلت تست شما به پایان رسیده است</h2>
            <p>برای باز شدن همه ابزارها و دسته‌بندی‌ها، اشتراک حرفه‌ای را فعال کنید.</p>
            <Link className="subscription-buy-button" href="/profile?upgrade=1">
              خرید اشتراک
            </Link>
          </section>
        ) : null}
      </section>
    </main>
  );
}
