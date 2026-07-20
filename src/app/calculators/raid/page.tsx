"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { calculateRaidUsable, type RaidLevel } from "@/src/lib/calculators/raid";
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

const raidNotes: Record<Exclude<RaidLevel, "none">, string> = {
  "0": "RAID 0 افزونگی ندارد و خرابی یک دیسک باعث از دست رفتن داده می‌شود.",
  "1": "RAID 1 یک Mirror است و ظرفیت قابل استفاده آن، مستقل از تعداد اعضای Mirror، برابر کوچک‌ترین دیسک است.",
  "5": "RAID 5 ظرفیت یک دیسک را برای Parity مصرف می‌کند و حداقل سه دیسک لازم دارد.",
  "6": "RAID 6 ظرفیت دو دیسک را برای Parity مصرف می‌کند و حداقل چهار دیسک لازم دارد.",
  "10": "RAID 10 به حداقل چهار دیسک و تعداد زوج نیاز دارد و نیمی از ظرفیت قابل استفاده است."
};

export default function RaidPage() {
  const [disks, setDisks] = useState(4);
  const [size, setSize] = useState(4);
  const [level, setLevel] = useState<Exclude<RaidLevel, "none">>("5");
  const result = calculateRaidUsable(Array.from({ length: Math.max(0, Math.floor(disks)) }, () => size), level);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="تعداد دیسک" value={disks} onChange={setDisks} min={1} />
        <NumberInput label="حجم هر دیسک" value={size} onChange={setSize} min={0.1} step={0.1} unit="TB" />
        <SelectInput label="سطح RAID" value={level} onChange={setLevel} options={["0", "1", "5", "6", "10"].map((value) => ({ label: `RAID ${value}`, value: value as Exclude<RaidLevel, "none"> }))} />
      </div>
      <ResultGrid results={[
        { label: "ظرفیت خام", value: formatNumber(result.rawTb, 2), unit: "TB" },
        { label: "ظرفیت قابل استفاده", value: formatNumber(result.usableTb, 2), unit: "TB" }
      ]} />
      <p className="calc-note">{result.reason || raidNotes[level]} محاسبه براساس کوچک‌ترین دیسک انجام می‌شود.</p>
    </CalculatorShell>
  );
}


