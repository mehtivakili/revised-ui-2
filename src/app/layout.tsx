import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppTopBar } from "@/src/components/AppTopBar";
import { ScrollReset } from "@/src/components/ScrollReset";
import { SiteFooter } from "@/src/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hamyar Doorbin",
  description: "Revised camera calculator and admin application"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body suppressHydrationWarning>
        <ScrollReset />
        <AppTopBar />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
