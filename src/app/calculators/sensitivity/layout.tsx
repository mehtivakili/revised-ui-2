import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";
import type { Metadata } from "next";
import { toolMetadata } from "@/src/lib/seo";

export const metadata: Metadata = toolMetadata("sensitivity");

export default function SensitivityLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="sensitivity">{children}</CalculatorAccessGate>;
}
