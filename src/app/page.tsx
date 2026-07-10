import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Aperture, Camera, ChevronLeft, Clock, Database, Gauge, HardDrive, Network, Radio, Radar, Router, Wifi, Eye, Lock, type LucideIcon } from "lucide-react";
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

  const user = await getUserById(session.id);
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
    <section className={`category-section ${variant === "wide" ? "category-section-wide" : ""}`} aria-labelledby={`${category.id}-title`}>
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
            <ToolCard key={tool.slug} tool={tool} tone={toneByCategory[category.id]} locked={locked} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolCard({ tool, tone, locked = false }: { tool: DashboardTool; tone: string; locked?: boolean }) {
  const ToolIcon = iconMap[tool.icon];

  return (
    <Link className={`tool-card ${locked ? "tool-card-locked" : ""}`} href={locked ? "/profile?upgrade=1" : `/calculators/${tool.slug}`}>
      <div className="tool-card-head">
        {locked && (
          <span className="tool-lock-badge">
            <Lock size={12} aria-hidden="true" />
            <span>حرفه‌ای</span>
          </span>
        )}
        <div className="tool-icon-wrapper">
          <span className={`tool-icon tool-icon-${tone}`}>
            <ToolIcon size={20} aria-hidden="true" />
          </span>
          {locked && <Lock className="tool-icon-lock-overlay" size={16} aria-hidden="true" />}
        </div>
      </div>
      <div className="tool-card-body">
        <h3>{tool.title}</h3>
        <p>{tool.description}</p>
      </div>
      <div className="tool-card-foot">
        <span>{locked ? "ارتقا حساب" : "شروع محاسبه"}</span>
        <span className="tool-card-arrow">
          {locked ? (
            <Lock size={14} aria-hidden="true" />
          ) : (
            <ChevronLeft size={15} aria-hidden="true" />
          )}
        </span>
      </div>
    </Link>
  );
}
