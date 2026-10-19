"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share2, X } from "lucide-react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const subscribeNothing = () => () => {};

/** iOS has no install event, so it gets written instructions instead — unless already installed or dismissed. */
function offersIosHelp() {
  if (isStandalone() || sessionStorage.getItem("pwa-install-dismissed") === "1") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const iosEligible = useSyncExternalStore(subscribeNothing, offersIosHelp, () => false);
  const [iosHelpClosed, setIosHelpClosed] = useState(false);
  const showIosHelp = iosEligible && !iosHelpClosed;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    if (isStandalone() || sessionStorage.getItem("pwa-install-dismissed") === "1") return;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIosHelpClosed(true);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function dismiss() {
    sessionStorage.setItem("pwa-install-dismissed", "1");
    setDismissed(true);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  if (dismissed || (!installPrompt && !showIosHelp)) return null;

  return (
    <aside className="pwa-install-prompt" role="status" aria-label="نصب همیار دوربین">
      <button className="pwa-install-close" type="button" onClick={dismiss} aria-label="بستن">
        <X size={17} aria-hidden="true" />
      </button>
      <Image src="/icons/icon-192.png" alt="" width={48} height={48} />
      <div>
        <strong>نصب اپلیکیشن همیار دوربین</strong>
        {showIosHelp ? (
          <p>
            در Safari دکمه <Share2 size={15} aria-hidden="true" /> اشتراک‌گذاری را بزنید و سپس
            <b> Add to Home Screen </b> را انتخاب کنید.
          </p>
        ) : (
          <p>برای دسترسی سریع‌تر، همیار دوربین را روی دستگاه خود نصب کنید.</p>
        )}
      </div>
      {installPrompt ? (
        <button className="pwa-install-action" type="button" onClick={install}>
          <Download size={16} aria-hidden="true" />
          نصب
        </button>
      ) : null}
    </aside>
  );
}
