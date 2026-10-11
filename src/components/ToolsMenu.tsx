"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Aperture,
  Camera,
  ChevronDown,
  ChevronLeft,
  Clock,
  Database,
  Eye,
  Gauge,
  HardDrive,
  House,
  LayoutDashboard,
  Menu,
  Network,
  PackageSearch,
  Radio,
  Radar,
  Router,
  Sparkles,
  Wifi,
  X,
  type LucideIcon
} from "lucide-react";
import { dashboardCategories, type DashboardCategory, type DashboardTool } from "@/src/lib/dashboard";

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

export function ToolsMenu({ lockedToolSlugs = [], isAdmin = false }: { lockedToolSlugs?: string[]; isAdmin?: boolean }) {
  const pathname = usePathname();
  return <ToolsMenuInner key={pathname} pathname={pathname} lockedToolSlugs={lockedToolSlugs} isAdmin={isAdmin} />;
}

function ToolsMenuInner({ pathname, lockedToolSlugs, isAdmin }: { pathname: string; lockedToolSlugs: string[]; isAdmin: boolean }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const lockedTools = useMemo(() => new Set(lockedToolSlugs), [lockedToolSlugs]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setIsOpen(true);
  }, [clearCloseTimer]);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
  }, [clearCloseTimer]);

  const toggleMenu = useCallback(() => {
    clearCloseTimer();
    setIsOpen((current) => !current);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(closeMenu, 180);
  }, [clearCloseTimer, closeMenu]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  // Removed fragile document event listeners for outside clicks
  // We will rely on a transparent backdrop element instead.

  return (
    <div
      ref={rootRef}
      className="tools-menu"
      data-open={isOpen ? "" : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") openMenu();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") scheduleClose();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeMenu();
        }
      }}
    >
      <Link
        href="/calculators"
        className="tools-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="tools-menu-panel"
        aria-current={pathname === "/calculators" ? "page" : undefined}
        onClick={(event) => {
          const opensAsMenu = window.matchMedia("(max-width: 760px), (hover: none), (pointer: coarse)").matches;
          if (opensAsMenu) {
            event.preventDefault();
            toggleMenu();
            return;
          }
          closeMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeMenu();
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu();
            rootRef.current?.querySelector<HTMLAnchorElement>(".tools-menu-links a")?.focus();
          }
        }}
      >
        <Menu className="tools-menu-mobile-icon" size={18} aria-hidden="true" />
        <span className="tools-menu-label">ابزارها</span>
        <ChevronDown className="tools-menu-chevron" size={16} aria-hidden="true" />
      </Link>
      <div className="tools-menu-backdrop" onClick={closeMenu} aria-hidden="true" />
      <div
        id="tools-menu-panel"
        className="tools-menu-panel"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") openMenu();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") scheduleClose();
        }}
      >
        <div className="tools-menu-mobile-head">
          <div>
            <strong>منوی اصلی</strong>
            <small>دسترسی سریع به بخش‌های سایت</small>
          </div>
          <button type="button" onClick={closeMenu} aria-label="بستن منو">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="tools-menu-mobile-nav" aria-label="مسیرهای اصلی موبایل">
          <Link href="/" onClick={closeMenu}>
            <House size={18} aria-hidden="true" />
            <span>خانه</span>
          </Link>
          <Link href="/planner" onClick={closeMenu}>
            <Sparkles size={18} aria-hidden="true" />
            <span>طراحی هوشمند</span>
          </Link>
          <Link href="/catalog" onClick={closeMenu}>
            <PackageSearch size={18} aria-hidden="true" />
            <span>محصولات</span>
          </Link>
          <Link href="/calculators" onClick={closeMenu}>
            <LayoutDashboard size={18} aria-hidden="true" />
            <span>همه ابزارها</span>
          </Link>
          {isAdmin ? (
            <Link href="/admin" onClick={closeMenu}>
              <LayoutDashboard size={18} aria-hidden="true" />
              <span>مدیریت</span>
            </Link>
          ) : null}
        </nav>
        {dashboardCategories.map((category) => {
          const visibleTools = category.tools.filter((tool) => !lockedTools.has(tool.slug));
          if (!visibleTools.length) return null;
          const CategoryIcon = iconMap[category.icon];
          return (
            <section className="tools-menu-category" key={category.id}>
              <div className="tools-menu-title">
                <span className="category-icon">
                  <CategoryIcon size={18} aria-hidden="true" />
                </span>
                <div>
                  <strong>{category.title}</strong>
                </div>
              </div>
              <div className="tools-menu-links">
                {visibleTools.map((tool) => {
                  const ToolIcon = iconMap[tool.icon];
                  return (
                    <Link key={tool.slug} href={`/calculators/${tool.slug}`} onClick={closeMenu}>
                      <span className="tools-menu-link-icon">
                        <ToolIcon size={15} aria-hidden="true" />
                      </span>
                      <span>{tool.title}</span>
                      <ChevronLeft size={14} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
