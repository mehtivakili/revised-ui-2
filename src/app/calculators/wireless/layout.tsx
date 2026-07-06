import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function WirelessLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="wireless">{children}</CalculatorAccessGate>;
}
