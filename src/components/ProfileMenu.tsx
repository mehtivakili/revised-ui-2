"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CircleUserRound, LogOut, UserRound, Settings } from "lucide-react";
import type { UserPlan } from "@/src/lib/authStore";

export function ProfileMenu({ username, plan, isAdmin }: { username: string; plan: UserPlan; isAdmin?: boolean }) {
  const rootRef = useRef<HTMLDetailsElement | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout fetch failed:", e);
    }
    closeMenu();
    router.push("/login");
    router.refresh();
  }

  const closeMenu = useCallback(() => {
    rootRef.current?.removeAttribute("open");
  }, []);

  // Removed fragile document event listeners for outside clicks
  // We will rely on a transparent backdrop element instead.

  return (
    <details ref={rootRef} className="profile-menu">
      <summary
        className="avatar-button"
        aria-label="پروفایل کاربر"
      >
        <CircleUserRound size={22} aria-hidden="true" />
      </summary>
      <div className="profile-popover-backdrop" onClick={closeMenu} aria-hidden="true" />
      <div className="profile-popover">
        <p>
          <strong>{username}</strong>
          <span>خوش آمدید</span>
          <small>{plan === "pro" ? "اشتراک حرفه‌ای" : "اشتراک رایگان"}</small>
        </p>
        <Link className="profile-popover-link" href="/profile" onClick={closeMenu}>
          <UserRound size={16} aria-hidden="true" />
          پروفایل من
        </Link>
        {isAdmin ? (
          <Link className="profile-popover-link admin-only-link" href="/admin" onClick={closeMenu}>
            <Settings size={16} aria-hidden="true" />
            مدیریت
          </Link>
        ) : null}
        <a 
          href="#"
          className="signout-button" 
          onClick={(e) => {
            e.preventDefault();
            if (!pending) signOut();
          }}
          style={{ 
            opacity: pending ? 0.72 : 1, 
            cursor: pending ? "wait" : "pointer",
            pointerEvents: pending ? "none" : "auto" 
          }}
        >
          <LogOut size={16} aria-hidden="true" />
          {pending ? "در حال خروج..." : "خروج"}
        </a>
      </div>
    </details>
  );
}
