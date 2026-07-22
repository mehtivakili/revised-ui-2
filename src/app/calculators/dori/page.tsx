"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { doriDistances } from "@/src/lib/calculators/optics";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "dori",
  title: "فاصله DORI",
  subtitle: "تشخیص / شناسایی",
  description: "محاسبه فاصله‌های تشخیص، مشاهده، تشخیص جزئی و شناسایی.",
  status: "ready",
  metric: "متر",
  icon: "radar"
};

const resolutions = [
  { label: "12MP (4000×3000)", width: 4000 },
  { label: "12MP (4000×3072)", width: 4000 },
  { label: "9MP (3072×3072)", width: 3072 },
  { label: "9MP (4096×2160)", width: 4096 },
  { label: "8MP (3840×2160)", width: 3840 },
  { label: "6MP (3072×2048)", width: 3072 },
  { label: "6MP (2560×2560)", width: 2560 },
  { label: "5MP (3072×1728)", width: 3072 },
  { label: "5MP (2880×1620)", width: 2880 },
  { label: "5MP (2592×1944)", width: 2592 },
  { label: "4MP (2688×1520)", width: 2688 },
  { label: "4MP (2560×1440)", width: 2560 },
  { label: "3MP (2304×1296)", width: 2304 },
  { label: "3MP (2048×1536)", width: 2048 },
  { label: "1080p (1920×1080)", width: 1920 },
  { label: "960p (1280×960)", width: 1280 },
  { label: "720p (1280×720)", width: 1280 },
  { label: "960H (960×576)", width: 960 },
  { label: "960H (960×480)", width: 960 },
  { label: "4CIF (704×576)", width: 704 },
  { label: "2CIF (704×288)", width: 704 },
  { label: "D1 (720×576)", width: 720 },
  { label: "CIF (352×288)", width: 352 },
  { label: "QCIF (176×144)", width: 176 }
];

export default function DoriPage() {
  const [resolutionWidth, setResolutionWidth] = useState(1920);
  const [fov, setFov] = useState(90);
  const result = doriDistances(resolutionWidth, fov);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <SelectInput label="رزولوشن" value={resolutionWidth} onChange={(value) => setResolutionWidth(Number(value))} options={resolutions.map((item) => ({ label: item.label, value: item.width }))} />
        <NumberInput label="زاویه دید افقی" value={fov} onChange={setFov} min={1} max={180} unit="درجه" />
      </div>
      <ResultGrid results={[
        { label: "تشخیص", value: formatNumber(result.detection, 1), unit: "m" },
        { label: "مشاهده", value: formatNumber(result.observation, 1), unit: "m" },
        { label: "تشخیص جزئی", value: formatNumber(result.recognition, 1), unit: "m" },
        { label: "شناسایی", value: formatNumber(result.identification, 1), unit: "m" }
      ]} />
    </CalculatorShell>
  );
}


