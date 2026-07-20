"use client";

import { useMemo, useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { calculateIpv4Details, type Ipv4SubnetMode } from "@/src/lib/calculators/ipv4";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "ip",
  title: "محاسبه‌گر ساب‌نت IP",
  subtitle: "جزئیات ساب‌نت",
  description: "نمایش شبکه، برادکست، وایلدکارت، نمایش باینری و نمونه ساب‌نت‌ها.",
  status: "ready",
  metric: "ماسک / هاست",
  icon: "router"
};

const subnetModes = [
  { label: "شبکه LAN معمولی", value: "lan" },
  { label: "لینک Point-to-Point", value: "point-to-point" },
  { label: "Host Route", value: "host-route" }
] as const;

export default function IpPage() {
  const [octets, setOctets] = useState([192, 168, 0, 1]);
  const [prefix, setPrefix] = useState(24);
  const [mode, setMode] = useState<Ipv4SubnetMode>("lan");
  const result = useMemo(() => calculateIpv4Details(octets, prefix, mode), [octets, prefix, mode]);
  const setOctet = (index: number, value: number) => setOctets((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        {octets.map((octet, index) => (
          <NumberInput key={index} label={`اکتت IPv4 ${index + 1}`} value={octet} onChange={(value) => setOctet(index, value)} min={0} max={255} />
        ))}
        <NumberInput label="پیشوند CIDR" value={prefix} onChange={setPrefix} min={0} max={32} />
        <SelectInput label="نوع Subnet" value={mode} onChange={setMode} options={[...subnetModes]} />
      </div>
      <ResultGrid results={[
        { label: "آدرس IP", value: `${result.ip}/${result.prefix}` },
        { label: "ماسک ساب‌نت", value: result.mask },
        { label: "وایلدکارت", value: result.wildcard },
        { label: "شبکه", value: result.network },
        { label: "اولین هاست", value: result.firstHost },
        { label: "آخرین هاست", value: result.lastHost },
        { label: "برادکست", value: result.broadcast || "ندارد" },
        { label: "هاست‌ها", value: formatNumber(result.hosts) }
      ]} />
      <div className="calc-table-wrap">
        <table className="calc-table">
          <tbody>
            <tr><th>IP باینری</th><td>{result.binaryIp}</td></tr>
            <tr><th>ماسک باینری</th><td>{result.binaryMask}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="calc-note">برای /31 نوع Point-to-Point و برای /32 نوع Host Route را انتخاب کنید؛ در این دو حالت آدرس Broadcast تعریف نمی‌شود.</p>
    </CalculatorShell>
  );
}


