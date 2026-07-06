"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
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

function calculateAck(distanceKm: number) {
  return distanceKm > 0 ? ((2 * distanceKm * 1000) / 299792.458) * 1e6 : 0;
}

export default function AckPage() {
  const [distance, setDistance] = useState(10);
  const result = calculateAck(distance);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="فاصله لینک" value={distance} onChange={setDistance} step={0.1} unit="km" />
      </div>
      <ResultGrid results={[{ label: "زمان رفت و برگشت ACK", value: formatNumber(result, 2), unit: "میکروثانیه" }]} />
    </CalculatorShell>
  );
}


