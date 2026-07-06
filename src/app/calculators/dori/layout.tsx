import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function DoriLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="dori">{children}</CalculatorAccessGate>;
}
