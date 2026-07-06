import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Aperture, Camera, ChevronLeft, Clock, Database, Gauge, HardDrive, Network, Radio, Radar, Router, Wifi, Eye, type LucideIcon } from "lucide-react";
import { dashboardCategories, type DashboardCategory, type DashboardTool } from "@/src/lib/dashboard";
import { getUserById } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";
import { getSubscriptionAccess, isCategoryLocked } from "@/src/lib/subscription";

const iconMap: Record<DashboardTool["icon"] | DashboardCategory["icon"], LucideIcon> = {
  activity: Activity,
  aperture: Aperture,
  camera: Camera,
  clock: Clock,
  database: Database,
  gauge: Gauge,
  "hard-drive": HardDrive,
  network: Network,
  radio: Radio,
  radar: Radar,
  router: Router,
  wifi: Wifi,
  eye: Eye
};

const toneByCategory: Record<DashboardCategory["id"], string> = {
  storage: "orange",
  network: "blue",
  wireless: "teal",
  lens: "violet"
};

function categoryById(id: string) {
  return dashboardCategories.find((category) => category.id === id);
}

const storageCategory = categoryById("storage");
const networkCategory = categoryById("network");
const wirelessCategory = categoryById("wireless");
const lensCategory = categoryById("lens");

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = getUserById(session.id);
  const access = getSubscriptionAccess(user);

  return (
    <main className="dashboard-page">
      <section className="dashboard-layout dashboard-layout-full" id="calculator-sections">
        <div className="category-stack">
          <div className="category-row category-row-paired">
            {storageCategory ? <CategorySection category={storageCategory} locked={isCategoryLocked(access, storageCategory.id)} /> : null}
            {networkCategory ? <CategorySection category={networkCategory} locked={isCategoryLocked(access, networkCategory.id)} /> : null}
          </div>
          {wirelessCategory ? <CategorySection category={wirelessCategory} variant="wide" locked={isCategoryLocked(access, wirelessCategory.id)} /> : null}
          {lensCategory ? <CategorySection category={lensCategory} variant="wide" locked={isCategoryLocked(access, lensCategory.id)} /> : null}
        </div>
      </section>
    </main>
  );
}

function CategorySection({ category, variant, locked = false }: { category: DashboardCategory; variant?: "wide"; locked?: boolean }) {
  const CategoryIcon = iconMap[category.icon];

  return (
    <section className={`category-section ${variant === "wide" ? "category-section-wide" : ""} ${locked ? "category-section-locked" : ""}`} aria-labelledby={`${category.id}-title`}>
      <div className="category-section-content">
        <div className="category-heading">
          <div className="category-title">
            <span className="category-icon">
              <CategoryIcon size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 id={`${category.id}-title`}>{category.title}</h2>
              <p>{category.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="tool-card-grid">
          {category.tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} tone={toneByCategory[category.id]} />
          ))}
        </div>
      </div>

      {locked ? <SubscriptionLockOverlay /> : null}
    </section>
  );
}

function SubscriptionLockOverlay() {
  return (
    <div className="subscription-lock-overlay">
      <p>مهلت تست شما به پایان رسیده است برای خرید اشتراک روی خرید اشتراک کلیک کنید</p>
      <Link className="subscription-buy-button" href="/profile?upgrade=1">
        خرید اشتراک
      </Link>
    </div>
  );
}

function ToolCard({ tool, tone }: { tool: DashboardTool; tone: string }) {
  const ToolIcon = iconMap[tool.icon];

  return (
    <Link className="tool-card" href={`/calculators/${tool.slug}`}>
      <div className="tool-card-head">
        <span className={`tool-icon tool-icon-${tone}`}>
          <ToolIcon size={20} aria-hidden="true" />
        </span>
      </div>
      <div className="tool-card-body">
        <h3>{tool.title}</h3>
        <p>{tool.description}</p>
      </div>
      <div className="tool-card-foot">
        <span>شروع محاسبه</span>
        <span className="tool-card-arrow">
          <ChevronLeft size={15} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
