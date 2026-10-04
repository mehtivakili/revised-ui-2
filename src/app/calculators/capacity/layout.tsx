import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export const metadata: Metadata = {
  title: "محاسبه ظرفیت ذخیره‌سازی دوربین مداربسته",
  description: "محاسبه آنلاین فضای هارد، مدت نگهداری تصاویر و پهنای‌باند دوربین‌های مداربسته بر اساس تعداد کانال، بیت‌ریت، رزولوشن و ساعات ضبط.",
  keywords: [
    "محاسبه ظرفیت ذخیره سازی دوربین مداربسته",
    "محاسبه هارد دوربین مداربسته",
    "مدت نگهداری تصاویر دوربین",
    "محاسبه پهنای باند دوربین"
  ],
  alternates: { canonical: "/calculators/capacity" }
};

export default function CapacityLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="capacity">{children}</CalculatorAccessGate>;
}
