"use client";

import { useSyncExternalStore } from "react";

/**
 * "سلام <name>" with a greeting for the time of day, beside the contact button.
 *
 * The hour is read from the visitor's own clock rather than the server's, so the greeting
 * fits where they are. The server renders the name alone and the greeting appears once the
 * page is live, which keeps hydration consistent; it is re-checked every minute.
 */

export function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "صبح بخیر";
  if (hour >= 12 && hour < 15) return "ظهر بخیر";
  if (hour >= 15 && hour < 19) return "عصر بخیر";
  return "شب بخیر";
}

const subscribe = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
const currentHour = () => new Date().getHours();
const serverHour = () => null;

export function TopGreeting({ name }: { name: string }) {
  const hour = useSyncExternalStore(subscribe, currentHour, serverHour);
  const greeting = hour === null ? "" : greetingForHour(hour);
  return (
    <span className="top-greeting" title={greeting ? `سلام ${name}، ${greeting}` : `سلام ${name}`}>
      <strong>سلام {name}</strong>
      <small>{greeting || " "}</small>
    </span>
  );
}
