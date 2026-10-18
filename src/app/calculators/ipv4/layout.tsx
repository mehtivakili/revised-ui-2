import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";
import type { Metadata } from "next";
import { toolMetadata } from "@/src/lib/seo";

export const metadata: Metadata = toolMetadata("ipv4");

export default function Ipv4Layout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="ipv4">{children}</CalculatorAccessGate>;
}
