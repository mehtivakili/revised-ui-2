import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageMetadata } from "@/src/lib/seo";

export const metadata: Metadata = pageMetadata("/assistant", "دستیار هوشمند", "پرسش و پاسخ درباره انتخاب دوربین، لنز، ذخیره‌سازی و طراحی سیستم نظارت تصویری.");

export default function AssistantPage() {
  redirect("/");
}
