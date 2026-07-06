"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "fresnel",
  title: "ناحیه فرنل",
  subtitle: "شعاع پاک‌سازی",
  description: "محاسبه شعاع ناحیه فرنل اول در نقطه میانی لینک بی‌سیم.",
  status: "ready",
  metric: "متر",
  icon: "radio"
};

function calculateFresnel(distanceKm: number, frequencyGHz: number) {
  return distanceKm > 0 && frequencyGHz > 0 ? 17.32 * Math.sqrt(distanceKm / (4 * frequencyGHz)) : 0;
}

export default function FresnelPage() {
  const [distance, setDistance] = useState(10);
  const [frequency, setFrequency] = useState(2.4);
  const result = calculateFresnel(distance, frequency);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="فاصله لینک" value={distance} onChange={setDistance} step={0.1} unit="km" />
        <NumberInput label="فرکانس" value={frequency} onChange={setFrequency} step={0.1} unit="GHz" />
      </div>
      <ResultGrid results={[{ label: "شعاع ناحیه فرنل اول", value: formatNumber(result, 2), unit: "m" }]} />
    </CalculatorShell>
  );
}


