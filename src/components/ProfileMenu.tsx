"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleUserRound, LogOut, UserRound } from "lucide-react";
import type { UserPlan } from "@/src/lib/authStore";

export function ProfileMenu({ username, plan }: { username: string; plan: UserPlan }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="avatar-button"
        aria-label="پروفایل کاربر"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CircleUserRound size={22} aria-hidden="true" />
      </button>
      {open ? (
        <div className="profile-popover">
          <p>
            <strong>{username}</strong>
            <span>خوش آمدید</span>
            <small>{plan === "pro" ? "اشتراک حرفه‌ای" : "اشتراک رایگان"}</small>
          </p>
          <Link className="profile-popover-link" href="/profile" onClick={() => setOpen(false)}>
            <UserRound size={16} aria-hidden="true" />
            پروفایل من
          </Link>
          <button type="button" className="signout-button" onClick={signOut} disabled={pending}>
            <LogOut size={16} aria-hidden="true" />
            {pending ? "در حال خروج..." : "خروج"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
