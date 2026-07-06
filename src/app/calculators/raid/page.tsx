"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "raid",
  title: "ظرفیت RAID",
  subtitle: "فضای قابل استفاده",
  description: "محاسبه ظرفیت قابل استفاده برای RAID 0، 1، 5، 6 و 10 با اعتبارسنجی تعداد دیسک.",
  status: "ready",
  metric: "TB قابل استفاده",
  icon: "hard-drive"
};

function calculateRaid(disks: number, diskSizeTb: number, level: "0" | "1" | "5" | "6" | "10") {
  if (diskSizeTb <= 0 || disks <= 0) return { usable: 0, note: "تعداد و ظرفیت دیسک باید بیشتر از صفر باشد." };
  if (level === "0") return { usable: disks * diskSizeTb, note: "RAID 0 افزونگی ندارد و خرابی یک دیسک باعث از دست رفتن داده می‌شود." };
  if (level === "1") return { usable: disks < 2 ? 0 : Math.floor(disks / 2) * diskSizeTb, note: "RAID 1 فقط به اندازه یک دیسک فضای قابل استفاده می‌دهد." };
  if (level === "5") return { usable: disks < 3 ? 0 : (disks - 1) * diskSizeTb, note: "RAID 5 به حداقل سه دیسک نیاز دارد و ظرفیت یک دیسک صرف افزونگی می‌شود." };
  if (level === "6") return { usable: disks < 4 ? 0 : (disks - 2) * diskSizeTb, note: "RAID 6 به حداقل چهار دیسک نیاز دارد و ظرفیت دو دیسک صرف افزونگی می‌شود." };
  return { usable: disks < 2 || disks % 2 !== 0 ? 0 : (disks / 2) * diskSizeTb, note: "RAID 10 به تعداد زوج دیسک نیاز دارد و نیمی از ظرفیت خام قابل استفاده است." };
}

export default function RaidPage() {
  const [disks, setDisks] = useState(4);
  const [size, setSize] = useState(4);
  const [level, setLevel] = useState<"0" | "1" | "5" | "6" | "10">("5");
  const result = calculateRaid(disks, size, level);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="تعداد دیسک" value={disks} onChange={setDisks} min={1} />
        <NumberInput label="حجم هر دیسک" value={size} onChange={setSize} min={0.1} step={0.1} unit="TB" />
        <SelectInput label="سطح RAID" value={level} onChange={setLevel} options={["0", "1", "5", "6", "10"].map((value) => ({ label: `RAID ${value}`, value: value as "0" | "1" | "5" | "6" | "10" }))} />
      </div>
      <ResultGrid results={[{ label: "ظرفیت قابل استفاده", value: formatNumber(result.usable, 2), unit: "TB" }]} />
      <p className="calc-note">{result.note}</p>
    </CalculatorShell>
  );
}


