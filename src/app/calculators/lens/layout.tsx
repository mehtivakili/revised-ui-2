import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function LensLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="lens">{children}</CalculatorAccessGate>;
}
