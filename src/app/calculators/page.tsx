import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Aperture, Camera, ChevronLeft, Clock, Database, Eye, Gauge, HardDrive, Lock, Network, Radio, Radar, Router, Wifi, type LucideIcon } from "lucide-react";
import { dashboardCategories, type DashboardCategory, type DashboardTool } from "@/src/lib/dashboard";
import { getUserById } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";
import { getSubscriptionAccess, isCategoryLocked } from "@/src/lib/subscription";

const iconMap: Record<DashboardTool["icon"] | DashboardCategory["icon"], LucideIcon> = { activity: Activity, aperture: Aperture, camera: Camera, clock: Clock, database: Database, gauge: Gauge, "hard-drive": HardDrive, network: Network, radio: Radio, radar: Radar, router: Router, wifi: Wifi, eye: Eye };
const tones: Record<DashboardCategory["id"], string> = { storage: "orange", network: "blue", wireless: "teal", lens: "violet" };

export default async function CalculatorsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const access = getSubscriptionAccess(await getUserById(session.id));
  return <main className="dashboard-page"><section className="page-intro compact-intro"><div><p className="eyebrow">جعبه‌ابزار مهندسی</p><h1>محاسبه‌گرها</h1><p>محاسبات فنی همچنان مستقل در دسترس‌اند و خروجی آن‌ها در نسخه بعدی مستقیماً به پیشنهاد محصول متصل می‌شود.</p></div><Link className="primary-action" href="/planner">طراحی راهکار<ChevronLeft size={17} /></Link></section><section className="dashboard-layout dashboard-layout-full" id="calculator-sections"><div className="category-stack">{dashboardCategories.map((category) => <CategorySection key={category.id} category={category} locked={isCategoryLocked(access, category.id)} />)}</div></section></main>;
}

function CategorySection({ category, locked }: { category: DashboardCategory; locked: boolean }) {
  const CategoryIcon = iconMap[category.icon];
  return <section className="category-section category-section-wide"><div className="category-section-content"><div className="category-heading"><div className="category-title"><span className="category-icon"><CategoryIcon size={20} /></span><div><h2>{category.title}</h2><p>{category.subtitle}</p></div></div></div><div className="tool-card-grid">{category.tools.map((tool) => <ToolCard key={tool.slug} tool={tool} tone={tones[category.id]} locked={locked} />)}</div></div></section>;
}

function ToolCard({ tool, tone, locked }: { tool: DashboardTool; tone: string; locked: boolean }) {
  const Icon = iconMap[tool.icon];
  return <Link className={`tool-card ${locked ? "tool-card-locked" : ""}`} href={locked ? "/profile?upgrade=1" : `/calculators/${tool.slug}`}><div className="tool-card-head"><div className="tool-icon-wrapper"><span className={`tool-icon tool-icon-${tone}`}><Icon size={20} /></span>{locked && <Lock className="tool-icon-lock-overlay" size={16} />}</div></div><div className="tool-card-body"><h3>{tool.title}</h3><p>{tool.description}</p></div><div className="tool-card-foot"><span>{locked ? "ارتقای حساب" : "شروع محاسبه"}</span><span className="tool-card-arrow">{locked ? <Lock size={14} /> : <ChevronLeft size={15} />}</span></div></Link>;
}
