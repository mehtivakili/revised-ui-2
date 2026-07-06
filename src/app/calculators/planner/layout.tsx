import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="planner">{children}</CalculatorAccessGate>;
}
