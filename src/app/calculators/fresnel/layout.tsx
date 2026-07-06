import type { ReactNode } from "react";
import { CalculatorAccessGate } from "@/src/components/calculators/CalculatorAccessGate";

export default function FresnelLayout({ children }: { children: ReactNode }) {
  return <CalculatorAccessGate slug="fresnel">{children}</CalculatorAccessGate>;
}
