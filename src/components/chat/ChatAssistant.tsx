"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Headset, MessageCircle, X } from "lucide-react";
import { ChatPanel } from "@/src/components/chat/ChatPanel";

/** Routes where a floating widget would get in the way. */
const hiddenOn = ["/login", "/register", "/assistant"];

export function ChatAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (hiddenOn.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;

  return (
    <>
      <button
        type="button"
        className={open ? "chat-launcher is-open" : "chat-launcher"}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "بستن دستیار" : "دستیار هوشمند"}
      >
        {open ? <X size={22} aria-hidden="true" /> : <MessageCircle size={22} aria-hidden="true" />}
      </button>

      {open ? (
        <div className="chat-dock" role="dialog" aria-label="دستیار فنی همیار دوربین">
          <header className="chat-dock-head">
            <span className="chat-dock-avatar">
              <Headset size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>دستیار فنی</strong>
              <small>پاسخ به سوالات دوربین و شبکه</small>
            </div>
            <div className="chat-dock-actions">
              <Link href="/assistant" className="chat-dock-expand" aria-label="گفت‌وگوی کامل" title="گفت‌وگوی کامل">
                <span>گفت‌وگوی کامل</span>
              </Link>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن">
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </header>
          <ChatPanel variant="floating" />
        </div>
      ) : null}
    </>
  );
}
