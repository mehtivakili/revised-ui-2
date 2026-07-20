"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { dbmToMilliwatts, milliwattsToDbm } from "@/src/lib/calculators/wireless";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "mw-dbm",
  title: "تبدیل mW و dBm",
  subtitle: "تبدیل توان",
  description: "تبدیل توان RF بین میلی‌وات و dBm.",
  status: "ready",
  metric: "mW / dBm",
  icon: "activity"
};

export default function PowerPage() {
  const [mw, setMw] = useState(1);
  const [dbm, setDbm] = useState(0);

  const updateFromMw = (value: number) => {
    setMw(value);
    const converted = milliwattsToDbm(value);
    if (converted !== null) setDbm(Number(converted.toFixed(2)));
  };

  const updateFromDbm = (value: number) => {
    setDbm(value);
    setMw(Number(dbmToMilliwatts(value).toFixed(4)));
  };

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="توان" value={mw} onChange={updateFromMw} min={0.001} step={0.001} unit="mW" />
        <NumberInput label="توان" value={dbm} onChange={updateFromDbm} step={0.01} unit="dBm" />
      </div>
      <ResultGrid results={[
        { label: "توان به dBm", value: formatNumber(dbm, 2), unit: "dBm" },
        { label: "توان به mW", value: formatNumber(mw, 4), unit: "mW" }
      ]} />
    </CalculatorShell>
  );
}


