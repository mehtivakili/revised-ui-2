"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "ipv4",
  title: "پیشوند IPv4",
  subtitle: "اندازه پیشوند",
  description: "محاسبه تعداد کل آدرس‌ها و هاست‌های قابل استفاده برای یک پیشوند IPv4.",
  status: "ready",
  metric: "/CIDR",
  icon: "network"
};

function calculateIpv4Prefix(prefix: number) {
  const clamped = Math.max(1, Math.min(31, Math.floor(prefix)));
  const total = 2 ** (32 - clamped);
  const hosts = clamped <= 30 ? Math.max(0, total - 2) : 0;
  return { prefix: clamped, total, hosts };
}

export default function Ipv4Page() {
  const [prefix, setPrefix] = useState(24);
  const result = calculateIpv4Prefix(prefix);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="پیشوند CIDR" value={prefix} onChange={setPrefix} min={1} max={31} />
      </div>
      <ResultGrid results={[
        { label: "پیشوند", value: `/${result.prefix}` },
        { label: "کل آدرس‌ها", value: formatNumber(result.total) },
        { label: "هاست قابل استفاده", value: formatNumber(result.hosts) }
      ]} />
    </CalculatorShell>
  );
}


