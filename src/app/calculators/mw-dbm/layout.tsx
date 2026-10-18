import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";
import type { Metadata } from "next";
import { toolMetadata } from "@/src/lib/seo";

export const metadata: Metadata = toolMetadata("mw-dbm");

export default function MwDbmLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="mw-dbm">{children}</CalculatorAccessGate>;
}
