import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppTopBar } from "@/src/components/AppTopBar";
import { ChatAssistant } from "@/src/components/chat/ChatAssistant";
import { PwaInstallPrompt } from "@/src/components/PwaInstallPrompt";
import { ScrollReset } from "@/src/components/ScrollReset";
import { SiteFooter } from "@/src/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hamyardoorbin.ir"),
  title: {
    default: "همیار دوربین",
    template: "%s | همیار دوربین"
  },
  description: "ابزارهای تخصصی محاسبات دوربین مداربسته و شبکه",
  applicationName: "همیار دوربین",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "همیار دوربین",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#00143d"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body suppressHydrationWarning>
        <ScrollReset />
        <PwaInstallPrompt />
        <AppTopBar />
        {children}
        <ChatAssistant />
        <SiteFooter />
      </body>
    </html>
  );
}
