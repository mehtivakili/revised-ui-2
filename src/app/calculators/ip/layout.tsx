import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function IpLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="ip">{children}</CalculatorAccessGate>;
}
