import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function MwDbmLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="mw-dbm">{children}</CalculatorAccessGate>;
}
