import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";
import type { Metadata } from "next";
import { pageMetadata } from "@/src/lib/seo";

export const metadata: Metadata = pageMetadata("/calculators/planner", "طراح نقشه و جانمایی دوربین", "ترسیم نقشه، جانمایی دوربین‌ها و بررسی پوشش تصویر روی نقشه.", { index: false });

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="planner">{children}</CalculatorAccessGate>;
}
