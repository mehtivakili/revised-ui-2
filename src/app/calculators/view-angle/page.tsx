"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "view-angle",
  title: "زاویه دید",
  subtitle: "FOV افقی",
  description: "محاسبه زاویه دید افقی از روی فاصله کانونی و عرض سنسور.",
  status: "ready",
  metric: "درجه",
  icon: "eye"
};

const sensorWidths = [
  { label: '1/4" (3.2 mm)', value: 3.2 },
  { label: '1/3" (4.8 mm)', value: 4.8 },
  { label: '1/2" (6.4 mm)', value: 6.4 },
  { label: '1/1.8" (7.2 mm)', value: 7.2 },
  { label: '2/3" (8.8 mm)', value: 8.8 },
  { label: '1" (12.8 mm)', value: 12.8 }
];

function calculateViewAngle(focalMm: number, sensorWidthMm: number) {
  return focalMm > 0 ? (2 * Math.atan(sensorWidthMm / (2 * focalMm)) * 180) / Math.PI : 0;
}

export default function ViewAnglePage() {
  const [focal, setFocal] = useState(4);
  const [sensor, setSensor] = useState(4.8);
  const result = calculateViewAngle(focal, sensor);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="فاصله کانونی" value={focal} onChange={setFocal} min={0.1} step={0.1} unit="mm" />
        <SelectInput label="عرض سنسور" value={sensor} onChange={(value) => setSensor(Number(value))} options={sensorWidths.map((item) => ({ label: item.label, value: item.value }))} />
      </div>
      <ResultGrid results={[{ label: "زاویه دید افقی", value: formatNumber(result, 1), unit: "درجه" }]} />
    </CalculatorShell>
  );
}


