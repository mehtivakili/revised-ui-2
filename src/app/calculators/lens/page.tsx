"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { focalLengthMm } from "@/src/lib/calculators/optics";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "lens",
  title: "فاصله کانونی لنز",
  subtitle: "انتخاب لنز",
  description: "برآورد فاصله کانونی بر اساس عرض صحنه، فاصله دوربین و اندازه سنسور.",
  status: "ready",
  metric: "میلی‌متر",
  icon: "aperture"
};

const sensorWidths = [
  { label: '1/4" (3.2 mm)', value: 3.2 },
  { label: '1/3" (4.8 mm)', value: 4.8 },
  { label: '1/2" (6.4 mm)', value: 6.4 },
  { label: '1/1.8" (7.2 mm)', value: 7.2 },
  { label: '2/3" (8.8 mm)', value: 8.8 },
  { label: '1" (12.8 mm)', value: 12.8 }
];

export default function LensPage() {
  const [width, setWidth] = useState(10);
  const [distance, setDistance] = useState(10);
  const [sensor, setSensor] = useState(4.8);
  const result = focalLengthMm(width, distance, sensor);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="عرض صحنه" value={width} onChange={setWidth} min={0.1} step={0.1} unit="m" />
        <NumberInput label="فاصله تا دوربین" value={distance} onChange={setDistance} min={0.1} step={0.1} unit="m" />
        <SelectInput label="عرض سنسور" value={sensor} onChange={(value) => setSensor(Number(value))} options={sensorWidths.map((item) => ({ label: item.label, value: item.value }))} />
      </div>
      <ResultGrid results={[{ label: "فاصله کانونی پیشنهادی", value: formatNumber(result, 2), unit: "mm" }]} />
    </CalculatorShell>
  );
}


