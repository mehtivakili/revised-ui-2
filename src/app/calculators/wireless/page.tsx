"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
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

function calculateWireless(params: { txPower: number; txGain: number; txLoss: number; rxGain: number; rxLoss: number; frequencyMHz: number; distanceKm: number }) {
  const fspl = params.frequencyMHz > 0 && params.distanceKm > 0
    ? 32.44 + 20 * Math.log10(params.distanceKm) + 20 * Math.log10(params.frequencyMHz)
    : 0;
  const rxPower = params.txPower + params.txGain - params.txLoss + params.rxGain - params.rxLoss - fspl;
  return { fspl, rxPower };
}

export default function WirelessPage() {
  const [txPower, setTxPower] = useState(20);
  const [txGain, setTxGain] = useState(15);
  const [txLoss, setTxLoss] = useState(1);
  const [rxGain, setRxGain] = useState(15);
  const [rxLoss, setRxLoss] = useState(1);
  const [frequencyMHz, setFrequencyMHz] = useState(2400);
  const [distanceKm, setDistanceKm] = useState(10);
  const result = calculateWireless({ txPower, txGain, txLoss, rxGain, rxLoss, frequencyMHz, distanceKm });

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


