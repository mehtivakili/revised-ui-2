import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function ViewAngleLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="view-angle">{children}</CalculatorAccessGate>;
}
