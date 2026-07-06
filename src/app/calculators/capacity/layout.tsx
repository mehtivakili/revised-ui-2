import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function CapacityLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="capacity">{children}</CalculatorAccessGate>;
}
