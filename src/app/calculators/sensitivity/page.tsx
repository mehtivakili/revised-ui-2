"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "sensitivity",
  title: "مقایسه حساسیت",
  subtitle: "مقایسه نور کم",
  description: "مقایسه دو تنظیمات دوربین بر اساس عرض سنسور و عدد F.",
  status: "ready",
  metric: "نسبت / استاپ",
  icon: "gauge"
};

const sensorWidths = [
  { label: '1/4" (3.2 mm)', value: 3.2 },
  { label: '1/3" (4.8 mm)', value: 4.8 },
  { label: '1/2" (6.4 mm)', value: 6.4 },
  { label: '1/1.8" (7.2 mm)', value: 7.2 },
  { label: '2/3" (8.8 mm)', value: 8.8 },
  { label: '1" (12.8 mm)', value: 12.8 }
];

function calculateSensitivity(f1: number, sensor1: number, f2: number, sensor2: number) {
  const v1 = f1 > 0 ? sensor1 / (f1 * f1) : 0;
  const v2 = f2 > 0 ? sensor2 / (f2 * f2) : 0;
  const ratio = v2 > 0 ? v1 / v2 : 0;
  return { ratio, stops: ratio > 0 ? Math.log2(ratio) : 0 };
}

export default function SensitivityPage() {
  const [f1, setF1] = useState(1.4);
  const [s1, setS1] = useState(4.8);
  const [f2, setF2] = useState(2);
  const [s2, setS2] = useState(4.8);
  const result = calculateSensitivity(f1, s1, f2, s2);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid sensitivity-form-grid">
        <NumberInput label="عدد F دوربین اول" value={f1} onChange={setF1} step={0.1} />
        <SelectInput label="سنسور دوربین اول" value={s1} onChange={(value) => setS1(Number(value))} options={sensorWidths.map((item) => ({ label: item.label, value: item.value }))} />
        <NumberInput label="عدد F دوربین دوم" value={f2} onChange={setF2} step={0.1} />
        <SelectInput label="سنسور دوربین دوم" value={s2} onChange={(value) => setS2(Number(value))} options={sensorWidths.map((item) => ({ label: item.label, value: item.value }))} />
      </div>
      <ResultGrid results={[
        { label: "نسبت روشنایی", value: formatNumber(result.ratio, 2) },
        { label: "تفاوت", value: formatNumber(result.stops, 2), unit: "استاپ" }
      ]} />
    </CalculatorShell>
  );
}


