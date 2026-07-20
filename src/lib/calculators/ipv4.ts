export type Ipv4SubnetMode = "lan" | "point-to-point" | "host-route";

export function usableIpv4Addresses(prefix: number, mode: Ipv4SubnetMode) {
  const cleanPrefix = Math.max(0, Math.min(32, Math.floor(prefix)));
  const total = 2 ** (32 - cleanPrefix);
  if (cleanPrefix === 31) return mode === "point-to-point" ? 2 : 0;
  if (cleanPrefix === 32) return mode === "host-route" ? 1 : 0;
  return Math.max(0, total - 2);
}

export function calculateIpv4Prefix(prefix: number, mode: Ipv4SubnetMode) {
  const cleanPrefix = Math.max(0, Math.min(32, Math.floor(prefix)));
  return {
    prefix: cleanPrefix,
    total: 2 ** (32 - cleanPrefix),
    hosts: usableIpv4Addresses(cleanPrefix, mode)
  };
}

export function calculateIpv4Details(octets: number[], prefix: number, mode: Ipv4SubnetMode) {
  const clean = [0, 1, 2, 3].map((index) => Math.max(0, Math.min(255, Math.floor(octets[index] || 0))));
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
  const traditionalBroadcast = (network | wildcard) >>> 0;
  const hosts = usableIpv4Addresses(p, mode);
  const specialP2p = p === 31 && mode === "point-to-point";
  const hostRoute = p === 32 && mode === "host-route";
  const firstHost = specialP2p ? network : hostRoute ? ip : hosts > 0 ? network + 1 : network;
  const lastHost = specialP2p ? network + 1 : hostRoute ? ip : hosts > 0 ? traditionalBroadcast - 1 : network;
  const bin = (n: number) => n.toString(2).padStart(8, "0");

  return {
    ip: clean.join("."), prefix: p, mask: maskOctets.join("."), wildcard: toIp(wildcard),
    network: toIp(network), broadcast: specialP2p || hostRoute ? null : toIp(traditionalBroadcast),
    firstHost: toIp(firstHost >>> 0), lastHost: toIp(lastHost >>> 0), hosts,
    binaryIp: clean.map(bin).join("."), binaryMask: maskOctets.map(bin).join(".")
  };
}

