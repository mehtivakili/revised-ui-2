"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { compareLowLightPerformance } from "@/src/lib/calculators/sensitivity";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "sensitivity",
  title: "مقایسه نظری عملکرد نور کم",
  subtitle: "مقایسه نور کم",
  description: "مقایسه اثر دیافراگم و مساحت پیکسل در دو دوربین، با فرض یکسان بودن شاتر، QE، انتقال لنز و پردازش تصویر.",
  status: "ready",
  metric: "نسبت / استاپ",
  icon: "gauge"
};

const sensorWidths = [
  { label: '1/4" (3.6 mm)', value: 3.6 },
  { label: '1/3" (4.8 mm)', value: 4.8 },
  { label: '1/2" (6.4 mm)', value: 6.4 },
  { label: '1/1.8" (7.2 mm)', value: 7.2 },
  { label: '2/3" (8.8 mm)', value: 8.8 },
  { label: '1" (12.8 mm)', value: 12.8 }
];

export default function SensitivityPage() {
  const [f1, setF1] = useState(1.4);
  const [s1, setS1] = useState(4.8);
  const [pixels1, setPixels1] = useState(2688);
  const [f2, setF2] = useState(2);
  const [s2, setS2] = useState(4.8);
  const [pixels2, setPixels2] = useState(1920);
  const result = compareLowLightPerformance(
    { fNumber: f1, sensorWidthMm: s1, horizontalPixels: pixels1 },
    { fNumber: f2, sensorWidthMm: s2, horizontalPixels: pixels2 }
  );

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid sensitivity-form-grid">
        <NumberInput label="عدد F دوربین اول" value={f1} onChange={setF1} min={0.1} step={0.1} />
        <SelectInput label="سنسور دوربین اول" value={s1} onChange={(value) => setS1(Number(value))} options={sensorWidths.map((item) => ({ label: item.label, value: item.value }))} />
        <NumberInput label="پیکسل افقی دوربین اول" value={pixels1} onChange={setPixels1} min={1} step={1} unit="px" />
        <NumberInput label="عدد F دوربین دوم" value={f2} onChange={setF2} min={0.1} step={0.1} />
        <SelectInput label="سنسور دوربین دوم" value={s2} onChange={(value) => setS2(Number(value))} options={sensorWidths.map((item) => ({ label: item.label, value: item.value }))} />
        <NumberInput label="پیکسل افقی دوربین دوم" value={pixels2} onChange={setPixels2} min={1} step={1} unit="px" />
      </div>
      <ResultGrid results={[
        { label: "برتری دیافراگم دوربین اول", value: formatNumber(result.lensRatio, 2), unit: "برابر" },
        { label: "تفاوت دیافراگم", value: formatNumber(result.lensStops, 2), unit: "استاپ" },
        { label: "برتری مساحت پیکسل دوربین اول", value: formatNumber(result.pixelAreaRatio, 2), unit: "برابر" },
        { label: "نسبت نظری کلی دوربین اول", value: formatNumber(result.combinedRatio, 2), unit: "برابر" },
        { label: "گام پیکسل دوربین اول", value: formatNumber(result.firstPitchUm, 2), unit: "µm" },
        { label: "گام پیکسل دوربین دوم", value: formatNumber(result.secondPitchUm, 2), unit: "µm" }
      ]} />
      <p className="calc-note">{result.valid ? "این نسبت فوتونی نظری است؛ شاتر، T-stop، بازده کوانتومی، نویز، Gain و پردازش تصویر در آن لحاظ نشده‌اند." : "عدد F، عرض سنسور و رزولوشن افقی باید بیشتر از صفر باشند."}</p>
    </CalculatorShell>
  );
}


