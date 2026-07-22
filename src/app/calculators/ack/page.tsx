"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { ackRoundTripMicroseconds } from "@/src/lib/calculators/rf";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "ack",
  title: "زمان ACK",
  subtitle: "زمان‌بندی فاصله",
  description: "برآورد زمان رفت و برگشت تاییدیه بر اساس فاصله لینک.",
  status: "ready",
  metric: "میکروثانیه",
  icon: "clock"
};

export default function AckPage() {
  const [distance, setDistance] = useState(10);
  const result = ackRoundTripMicroseconds(distance);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="فاصله لینک" value={distance} onChange={setDistance} step={0.1} unit="km" />
      </div>
      <ResultGrid results={[{ label: "زمان رفت و برگشت ACK", value: formatNumber(result, 2), unit: "میکروثانیه" }]} />
    </CalculatorShell>
  );
}


