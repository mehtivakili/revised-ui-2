import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function RaidLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="raid">{children}</CalculatorAccessGate>;
}
