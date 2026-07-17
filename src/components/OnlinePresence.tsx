"use client";

import { useEffect } from "react";

const presenceIntervalMs = 60_000;

export function OnlinePresence() {
  useEffect(() => {
    const reportActivity = () => {
      void fetch("/api/me/activity", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true
      }).catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") reportActivity();
    };

    reportActivity();
    const intervalId = window.setInterval(reportActivity, presenceIntervalMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
