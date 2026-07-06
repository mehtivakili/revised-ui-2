"use client";

import { useMemo, useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
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

function calculateIpDetails(octets: number[], prefix: number) {
  const clean = octets.map((value) => Math.max(0, Math.min(255, Math.floor(value || 0))));
  const p = Math.max(0, Math.min(32, Math.floor(prefix)));
  const maskOctets = [0, 0, 0, 0].map((_, index) => {
    const bits = Math.max(0, Math.min(8, p - index * 8));
    return bits === 0 ? 0 : (0xff << (8 - bits)) & 0xff;
  });
  const toNum = ([a, b, c, d]: number[]) => (((a << 24) >>> 0) + (b << 16) + (c << 8) + d) >>> 0;
  const toIp = (num: number) => [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join(".");
  const ip = toNum(clean);
  const mask = toNum(maskOctets);
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const hostBits = 32 - p;
  const hosts = hostBits > 1 ? 2 ** hostBits - 2 : 0;
  const firstHost = hosts > 0 ? network + 1 : network;
  const lastHost = hosts > 0 ? broadcast - 1 : network;
  const bin = (n: number) => n.toString(2).padStart(8, "0");
  return {
    ip: clean.join("."),
    prefix: p,
    mask: maskOctets.join("."),
    wildcard: toIp(wildcard),
    network: toIp(network),
    broadcast: toIp(broadcast),
    firstHost: toIp(firstHost >>> 0),
    lastHost: toIp(lastHost >>> 0),
    hosts,
    binaryIp: clean.map(bin).join("."),
    binaryMask: maskOctets.map(bin).join(".")
  };
}

export default function IpPage() {
  const [octets, setOctets] = useState([192, 168, 0, 1]);
  const [prefix, setPrefix] = useState(24);
  const result = useMemo(() => calculateIpDetails(octets, prefix), [octets, prefix]);
  const setOctet = (index: number, value: number) => setOctets((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        {octets.map((octet, index) => (
          <NumberInput key={index} label={`اکتت IPv4 ${index + 1}`} value={octet} onChange={(value) => setOctet(index, value)} min={0} max={255} />
        ))}
        <NumberInput label="پیشوند CIDR" value={prefix} onChange={setPrefix} min={0} max={32} />
      </div>
      <ResultGrid results={[
        { label: "آدرس IP", value: `${result.ip}/${result.prefix}` },
        { label: "ماسک ساب‌نت", value: result.mask },
        { label: "وایلدکارت", value: result.wildcard },
        { label: "شبکه", value: result.network },
        { label: "اولین هاست", value: result.firstHost },
        { label: "آخرین هاست", value: result.lastHost },
        { label: "برادکست", value: result.broadcast },
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
    </CalculatorShell>
  );
}


