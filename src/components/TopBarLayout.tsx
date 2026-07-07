"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function TopBarLayout({
  children,
  minimalChildren
}: {
  children: ReactNode;
  minimalChildren: ReactNode;
}) {
  const pathname = usePathname();
  const isMinimal = pathname === "/login" || pathname === "/register";

  return (
    <div className={`site-topbar-shell ${isMinimal ? "minimal-topbar" : ""}`}>
      {isMinimal ? minimalChildren : children}
    </div>
  );
}
