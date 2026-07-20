"use client";

import { useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { calculateIpv4Prefix, type Ipv4SubnetMode } from "@/src/lib/calculators/ipv4";
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

const subnetModes = [
  { label: "شبکه LAN معمولی", value: "lan" },
  { label: "لینک Point-to-Point", value: "point-to-point" },
  { label: "Host Route", value: "host-route" }
] as const;

export default function Ipv4Page() {
  const [prefix, setPrefix] = useState(24);
  const [mode, setMode] = useState<Ipv4SubnetMode>("lan");
  const result = calculateIpv4Prefix(prefix, mode);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="پیشوند CIDR" value={prefix} onChange={setPrefix} min={0} max={32} />
        <SelectInput label="نوع Subnet" value={mode} onChange={setMode} options={[...subnetModes]} />
      </div>
      <ResultGrid results={[
        { label: "پیشوند", value: `/${result.prefix}` },
        { label: "کل آدرس‌ها", value: formatNumber(result.total) },
        { label: "هاست قابل استفاده", value: formatNumber(result.hosts) }
      ]} />
      <p className="calc-note">در /31 فقط در حالت Point-to-Point هر دو آدرس قابل استفاده‌اند؛ /32 در حالت Host Route یک آدرس را نمایش می‌دهد.</p>
    </CalculatorShell>
  );
}


