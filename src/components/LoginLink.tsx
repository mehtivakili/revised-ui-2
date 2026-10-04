"use client";

import type { MouseEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";

export function LoginLink({ className, children }: { className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const href = `/login?next=${encodeURIComponent(pathname)}`;

  function preserveCurrentLocation(event: MouseEvent<HTMLAnchorElement>) {
    const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    event.currentTarget.href = `/login?next=${encodeURIComponent(destination)}`;
  }

  return (
    <a className={className} href={href} onClick={preserveCurrentLocation}>
      {children}
    </a>
  );
}
