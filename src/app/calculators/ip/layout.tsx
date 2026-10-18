import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";
import type { Metadata } from "next";
import { toolMetadata } from "@/src/lib/seo";

export const metadata: Metadata = toolMetadata("ip");

export default function IpLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="ip">{children}</CalculatorAccessGate>;
}
