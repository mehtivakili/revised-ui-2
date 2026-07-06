import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function Ipv4Layout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="ipv4">{children}</CalculatorAccessGate>;
}
