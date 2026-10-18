import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";
import type { Metadata } from "next";
import { toolMetadata } from "@/src/lib/seo";

export const metadata: Metadata = toolMetadata("view-angle");

export default function ViewAngleLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="view-angle">{children}</CalculatorAccessGate>;
}
