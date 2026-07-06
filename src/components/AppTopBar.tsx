import Link from "next/link";
import { Bell, LogIn, Settings } from "lucide-react";
import { ProfileMenu } from "@/src/components/ProfileMenu";
import { ToolsMenu } from "@/src/components/ToolsMenu";
import { TopSearch } from "@/src/components/TopSearch";
import { getUserById } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";
import { getSubscriptionAccess } from "@/src/lib/subscription";

export async function AppTopBar() {
  const session = await getCurrentSession();
  const user = session ? getUserById(session.id) : null;
  const access = getSubscriptionAccess(user);

  return (
    <div className="site-topbar-shell">
      <header className="top-bar">
        <Link className="brand-mark" href="/" aria-label="همیار دوربین">
          <span>
            <strong>همیار دوربین</strong>
            <small>ابزارهای محاسباتی دوربین و شبکه</small>
          </span>
        </Link>

        <Link className="topbar-title" href="/" aria-label="همیار دوربین">
          همیار دوربین
        </Link>

        <TopSearch lockedToolSlugs={access.lockedToolSlugs} />

        <nav className="top-nav" aria-label="ناوبری اصلی">
          <ToolsMenu lockedToolSlugs={access.lockedToolSlugs} />
          <Link href="/#calculator-sections">داشبورد</Link>
          {session?.role === "admin" ? <Link href="/admin">مدیریت</Link> : null}
        </nav>

        <div className="top-actions">
          <button type="button" className="icon-button top-utility" aria-label="اعلان‌ها">
            <Bell size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button top-utility" aria-label="تنظیمات">
            <Settings size={18} aria-hidden="true" />
          </button>
          {session ? (
            <ProfileMenu username={session.username} plan={access.plan} />
          ) : (
            <Link className="profile-button" href="/login">
              <LogIn size={18} aria-hidden="true" />
              <span>ورود</span>
            </Link>
          )}
        </div>
      </header>
    </div>
  );
}
