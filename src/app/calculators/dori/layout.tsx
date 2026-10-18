import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";
import type { Metadata } from "next";
import { toolMetadata } from "@/src/lib/seo";

export const metadata: Metadata = toolMetadata("dori");

export default function DoriLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="dori">{children}</CalculatorAccessGate>;
}
