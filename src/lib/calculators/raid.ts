export type RaidLevel = "none" | "0" | "1" | "5" | "6" | "10";

export type RaidCapacity = {
  valid: boolean;
  rawTb: number;
  usableTb: number;
  activeDriveCount: number;
  hotSpareCount: number;
  reason?: string;
};

const invalid = (rawTb: number, hotSpareCount: number, reason: string): RaidCapacity => ({
  valid: false,
  rawTb,
  usableTb: 0,
  activeDriveCount: 0,
  hotSpareCount,
  reason
});

export function calculateRaidUsable(
  diskSizesTb: number[],
  level: RaidLevel,
  hotSpareCount = 0
): RaidCapacity {
  const cleanSizes = diskSizesTb.filter((size) => Number.isFinite(size) && size > 0);
  const rawTb = cleanSizes.reduce((sum, size) => sum + size, 0);
  const spares = Math.max(0, Math.floor(hotSpareCount));
  if (cleanSizes.length !== diskSizesTb.length || cleanSizes.length === 0) {
    return invalid(rawTb, spares, "ظرفیت همه دیسک‌ها باید بیشتر از صفر باشد.");
  }
  if (spares >= cleanSizes.length) return invalid(rawTb, spares, "حداقل یک دیسک باید در آرایه RAID فعال باشد.");

  const activeSizes = [...cleanSizes].sort((a, b) => a - b).slice(0, cleanSizes.length - spares);
  const count = activeSizes.length;
  const smallest = activeSizes[0];
  let usableTb = 0;

  if (level === "none" || level === "0") usableTb = count * smallest;
  else if (level === "1") {
    if (count < 2) return invalid(rawTb, spares, "RAID 1 به حداقل دو دیسک نیاز دارد.");
    usableTb = smallest;
  } else if (level === "5") {
    if (count < 3) return invalid(rawTb, spares, "RAID 5 به حداقل سه دیسک فعال نیاز دارد.");
    usableTb = (count - 1) * smallest;
  } else if (level === "6") {
    if (count < 4) return invalid(rawTb, spares, "RAID 6 به حداقل چهار دیسک فعال نیاز دارد.");
    usableTb = (count - 2) * smallest;
  } else {
    if (count < 4 || count % 2 !== 0) return invalid(rawTb, spares, "RAID 10 به حداقل چهار دیسک فعال و تعداد زوج نیاز دارد.");
    usableTb = (count / 2) * smallest;
  }

  return { valid: true, rawTb, usableTb, activeDriveCount: count, hotSpareCount: spares };
}

