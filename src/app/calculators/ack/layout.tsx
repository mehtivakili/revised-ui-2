import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function AckLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="ack">{children}</CalculatorAccessGate>;
}
