export function milliwattsToDbm(milliwatts: number) {
  if (!Number.isFinite(milliwatts) || milliwatts <= 0) return null;
  return 10 * Math.log10(milliwatts);
}

export function dbmToMilliwatts(dbm: number) {
  return 10 ** (dbm / 10);
}
