"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { calculateLinkBudget } from "@/src/lib/calculators/rf";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "wireless",
  title: "بودجه لینک بی‌سیم",
  subtitle: "بودجه لینک",
  description: "محاسبه افت مسیر فضای آزاد و توان دریافتی.",
  status: "ready",
  metric: "dBm / dB",
  icon: "wifi"
};

export default function WirelessPage() {
  const [txPower, setTxPower] = useState(20);
  const [txGain, setTxGain] = useState(15);
  const [txLoss, setTxLoss] = useState(1);
  const [rxGain, setRxGain] = useState(15);
  const [rxLoss, setRxLoss] = useState(1);
  const [frequencyMHz, setFrequencyMHz] = useState(2400);
  const [distanceKm, setDistanceKm] = useState(10);
  const result = calculateLinkBudget({ txPower, txGain, txLoss, rxGain, rxLoss, frequencyMHz, distanceKm });

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="توان ارسال" value={txPower} onChange={setTxPower} unit="dBm" />
        <NumberInput label="گین آنتن ارسال" value={txGain} onChange={setTxGain} unit="dBi" />
        <NumberInput label="افت کابل ارسال" value={txLoss} onChange={setTxLoss} unit="dB" />
        <NumberInput label="گین آنتن دریافت" value={rxGain} onChange={setRxGain} unit="dBi" />
        <NumberInput label="افت کابل دریافت" value={rxLoss} onChange={setRxLoss} unit="dB" />
        <NumberInput label="فرکانس" value={frequencyMHz} onChange={setFrequencyMHz} unit="MHz" />
        <NumberInput label="فاصله" value={distanceKm} onChange={setDistanceKm} unit="km" />
      </div>
      <ResultGrid results={[
        { label: "توان دریافتی", value: formatNumber(result.rxPower, 2), unit: "dBm" },
        { label: "افت مسیر فضای آزاد", value: formatNumber(result.fspl, 2), unit: "dB" }
      ]} />
    </CalculatorShell>
  );
}


