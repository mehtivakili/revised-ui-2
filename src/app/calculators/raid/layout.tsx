import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export const metadata: Metadata = {
  title: "محاسبه ظرفیت RAID برای دوربین مداربسته",
  description: "محاسبه آنلاین ظرفیت خام و قابل استفاده RAID 0، RAID 1، RAID 5، RAID 6 و RAID 10 بر اساس تعداد و حجم دیسک‌ها.",
  keywords: [
    "محاسبه ظرفیت RAID",
    "ظرفیت قابل استفاده RAID 5",
    "RAID برای دوربین مداربسته",
    "محاسبه ظرفیت هارد NVR"
  ],
  alternates: { canonical: "/calculators/raid" }
};

export default function RaidLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="raid">{children}</CalculatorAccessGate>;
}
