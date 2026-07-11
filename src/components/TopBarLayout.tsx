"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function TopBarLayout({
  children,
  minimalChildren,
  minimalOnContacts = false
}: {
  children: ReactNode;
  minimalChildren: ReactNode;
  minimalOnContacts?: boolean;
}) {
  const pathname = usePathname();
  const isMinimal = pathname === "/login" || pathname === "/register" || (minimalOnContacts && pathname === "/contacts");

  return (
    <div className={`site-topbar-shell ${isMinimal ? "minimal-topbar" : ""}`}>
      {isMinimal ? minimalChildren : children}
    </div>
  );
}
