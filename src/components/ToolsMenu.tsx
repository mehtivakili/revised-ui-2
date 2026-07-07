"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
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
  Menu,
  Network,
  Radio,
  Radar,
  Router,
  Wifi,
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

export function ToolsMenu({ lockedToolSlugs = [] }: { lockedToolSlugs?: string[] }) {
  const pathname = usePathname();
  return <ToolsMenuInner key={pathname} lockedToolSlugs={lockedToolSlugs} />;
}

function ToolsMenuInner({ lockedToolSlugs }: { lockedToolSlugs: string[] }) {
  const rootRef = useRef<HTMLDetailsElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedTools = useMemo(() => new Set(lockedToolSlugs), [lockedToolSlugs]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    rootRef.current?.setAttribute("open", "");
  }, [clearCloseTimer]);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    rootRef.current?.removeAttribute("open");
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(closeMenu, 180);
  }, [clearCloseTimer, closeMenu]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  // Removed fragile document event listeners for outside clicks
  // We will rely on a transparent backdrop element instead.

  return (
    <details
      ref={rootRef}
      className="tools-menu"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          scheduleClose();
        }
      }}
    >
      <summary
        className="tools-menu-trigger"
        onClick={clearCloseTimer}
        onFocus={openMenu}
        onKeyDown={(event) => event.key === "Escape" && closeMenu()}
      >
        <Menu className="tools-menu-mobile-icon" size={18} aria-hidden="true" />
        <span className="tools-menu-label">ابزارها</span>
        <ChevronDown className="tools-menu-chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="tools-menu-backdrop" onClick={closeMenu} aria-hidden="true" />
      <div
        className="tools-menu-panel"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
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
    </details>
  );
}
