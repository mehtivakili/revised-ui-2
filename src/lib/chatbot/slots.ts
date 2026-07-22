import { digitizeNumberWords, normalizePersian } from "@/src/lib/chatbot/persian";

/**
 * Slot filling for the assistant.
 *
 * The intent network decides which calculation to run; this module pulls the operands
 * out of free Persian text so the user never has to fill a form. Every slot is
 * optional — the skills fall back to documented defaults and say which default they used.
 */

export type Slots = {
  text: string;
  numbers: number[];
  cameraCount?: number;
  channels?: number;
  megapixel?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  distanceM?: number;
  distanceKm?: number;
  sceneWidthM?: number;
  focalMm?: number;
  sensorInch?: number;
  heightM?: number;
  bitrateKbps?: number;
  bandwidthMbps?: number;
  terabytes?: number;
  gigabytes?: number;
  diskCount?: number;
  raidLevel?: string;
  hotSpare?: number;
  watts?: number;
  percent?: number;
  fps?: number;
  prefix?: number;
  ipAddress?: string;
  frequencyGhz?: number;
  milliwatts?: number;
  dbm?: number;
  dbi?: number;
  budgetToman?: number;
  codec?: "H.264" | "H.265";
  outdoor?: boolean;
  goal?: "detect" | "observe" | "recognize" | "identify" | "anpr";
  projectType?: "shop" | "office" | "factory" | "parking" | "residential";
};

/**
 * Number immediately followed by one of the unit spellings.
 *
 * The optional trailing group absorbs the adjectival forms Persian attaches to units
 * — "۸ ترابایتی", "۱۲ واتی", "۳۰ روزه" — which would otherwise fail the word boundary.
 */
function unit(text: string, pattern: string): number | undefined {
  const match = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*${countParticles}\\s*(?:${pattern})(?:ای|ی|ه)?(?![\\p{L}\\d])`,
    "u"
  ).exec(text);
  return match ? Number(match[1]) : undefined;
}

/**
 * Counting particles Persian inserts between a number and its noun — "۲۴ تا دوربین",
 * "۸ عدد هارد". Without this the number and the unit never met and the skill silently
 * fell back to its default, which is how "۲۴ دوربین" produced an answer for 8.
 */
const countParticles = "(?:تا|تای|عدد|عددی|دستگاه|دونه|دانه)?";

/** Unit spelled before the number, e.g. "فاصله ۲۵ متر" handled by callers via `unit`. */
function prefixed(text: string, pattern: string): number | undefined {
  const match = new RegExp(`(?:${pattern})\\s*(\\d+(?:\\.\\d+)?)`, "u").exec(text);
  return match ? Number(match[1]) : undefined;
}

const sensorWidths: Record<string, number> = {
  "1/4": 3.6,
  "1/3": 4.8,
  "1/2.9": 4.96,
  "1/2.8": 5.12,
  "1/2.7": 5.37,
  "1/2.5": 5.76,
  "1/2": 6.4,
  "1/1.8": 7.18,
  "1/1.2": 10.67,
  "1": 12.8
};

export const sensorOptions = sensorWidths;

export function sensorWidthMm(inch?: number, raw?: string): number {
  if (raw && sensorWidths[raw] !== undefined) return sensorWidths[raw];
  if (inch && Number.isFinite(inch)) {
    // Convention: "1/3 inch" sensors are ~4.8mm wide, roughly 1/3 of the 16mm legacy tube.
    return Math.max(1, inch * 16 * 0.3);
  }
  return sensorWidths["1/2.8"];
}

export function extractSlots(input: string): Slots {
  const text = digitizeNumberWords(normalizePersian(input));
  const slots: Slots = { text, numbers: [] };

  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) slots.numbers.push(Number(match[0]));

  // Longer unit names are tested first so "میلیمتر" never matches the "متر" branch.
  slots.focalMm = unit(text, "میلیمتر|میلی متر|mm|میلی");
  slots.distanceKm = unit(text, "کیلومتر|کیلو متر|km");
  slots.distanceM = unit(text, "متری|متر|m") ?? prefixed(text, "فاصله ی|فاصله");
  slots.sceneWidthM = prefixed(text, "عرض|پهنای صحنه|عرض صحنه");
  slots.heightM = prefixed(text, "ارتفاع");

  slots.megapixel = unit(text, "مگاپیکسل|مگاپیکسلی|mp|مگا پیکسل");
  if (slots.megapixel === undefined && /\b4k\b|فورکی/.test(text)) slots.megapixel = 8;
  if (slots.megapixel === undefined && /\b(?:full ?hd|1080p?)\b/.test(text)) slots.megapixel = 2;

  const bareMeg = unit(text, "مگ");

  slots.cameraCount = unit(text, "دوربین|دوربینی|cam");
  slots.channels = unit(text, "کانال|کاناله|ch");
  slots.days = unit(text, "روز|روزه|شبانه روز");
  const weeks = unit(text, "هفته|هفته ای");
  const months = unit(text, "ماه|ماهه");
  if (slots.days === undefined && weeks !== undefined) slots.days = weeks * 7;
  if (slots.days === undefined && months !== undefined) slots.days = months * 30;
  slots.hours = unit(text, "ساعت|ساعته");
  slots.minutes = unit(text, "دقیقه|دقیقه ای");

  slots.bitrateKbps = unit(text, "کیلوبیت|kbps|kb");
  slots.bandwidthMbps = unit(text, "مگابیت|mbps|mb");
  // Resolved after the explicit bitrate/bandwidth units, which would otherwise overwrite
  // it with undefined. "۵ مگ" is megapixels on a camera but megabits on a link, so the
  // surrounding words decide rather than a fixed guess.
  if (bareMeg !== undefined) {
    if (/[آا]پلود|دانلود|اینترنت|سرعت|پهنای|باند|لینک/.test(text)) slots.bandwidthMbps ??= bareMeg;
    else slots.megapixel ??= bareMeg;
  }

  slots.terabytes = unit(text, "ترابایت|ترا بایت|tb|ترا");
  slots.gigabytes = unit(text, "گیگابایت|گیگا بایت|gb|گیگ");
  slots.diskCount = unit(text, "دیسک|هارد|درایو|disk|hdd");
  slots.watts = unit(text, "وات|w(?:att)?");
  slots.percent = unit(text, "درصد|%");
  slots.fps = unit(text, "فریم|fps");
  slots.frequencyGhz = unit(text, "گیگاهرتز|گیگا هرتز|ghz");
  const megahertz = unit(text, "مگاهرتز|مگا هرتز|mhz");
  if (slots.frequencyGhz === undefined && megahertz !== undefined) slots.frequencyGhz = megahertz / 1000;
  slots.milliwatts = unit(text, "میلی وات|میلیوات|mw");
  slots.dbm = unit(text, "dbm|دسی بل میلی وات|دی بی ام|دسیبل میلی وات");
  // Checked after dBm so "۲۴ دی بی ام" is never read as antenna gain.
  slots.dbi = unit(text, "dbi|دی بی ای|گین آنتن|دی بی|دسی بل");
  slots.hotSpare = prefixed(text, "hot spare|هات اسپر|اسپر");

  const raid = /(?:raid|رید|رید)\s*(0|1|5|6|10)/.exec(text);
  if (raid) slots.raidLevel = raid[1];

  // Sensor formats are resolved first and then blanked out, because "۱/۲.۸ اینچ" and a
  // "/24" network prefix are the same characters. Previously the CIDR pattern won and a
  // sensor question came back carrying prefix=2.
  let networkText = text;
  const sensorFraction = /(?:^|\s)(1\/(?:1\.2|1\.8|2\.5|2\.7|2\.8|2\.9|2|3|4))(?=\s|$|اینچ)/.exec(text);
  if (sensorFraction) {
    slots.sensorInch = sensorWidths[sensorFraction[1]];
    networkText = networkText.replace(sensorFraction[1], " ");
  }

  const ip = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/.exec(networkText);
  if (ip) slots.ipAddress = ip[1];
  // The negative lookahead rejects "/2.8"; a real prefix is never followed by a dot.
  const prefix = /\/(\d{1,2})(?![\d.])/.exec(networkText);
  if (prefix) {
    const value = Number(prefix[1]);
    if (value >= 0 && value <= 32) slots.prefix = value;
  }

  const budget = /(\d{6,})\s*(?:تومان|تومن|ریال)?/.exec(text);
  if (budget && Number(budget[1]) >= 1_000_000) slots.budgetToman = Number(budget[1]);

  if (/h\.?265|hevc/.test(text)) slots.codec = "H.265";
  else if (/h\.?264|avc/.test(text)) slots.codec = "H.264";

  if (/بیرون|فضای باز|محوطه|حیاط|بیرونی|خارجی/.test(text)) slots.outdoor = true;
  else if (/داخل|داخلی|اتاق|سالن|فضای بسته/.test(text)) slots.outdoor = false;

  if (/پلاک|anpr|lpr/.test(text)) slots.goal = "anpr";
  else if (/شناسایی|هویت|چهره|identify/.test(text)) slots.goal = "identify";
  else if (/بازشناسی|recognize/.test(text)) slots.goal = "recognize";
  else if (/مشاهده|رفتار|observe/.test(text)) slots.goal = "observe";
  else if (/کشف|حضور|detect/.test(text)) slots.goal = "detect";

  if (/مغازه|فروشگاه|سوپر|بوتیک/.test(text)) slots.projectType = "shop";
  else if (/دفتر|اداره|شرکت|اداری/.test(text)) slots.projectType = "office";
  else if (/کارخانه|انبار|صنعتی|کارگاه/.test(text)) slots.projectType = "factory";
  else if (/پارکینگ|پارکینگی/.test(text)) slots.projectType = "parking";
  else if (/خانه|منزل|ویلا|آپارتمان|مسکونی/.test(text)) slots.projectType = "residential";

  // A bare count question ("برای ۱۸ تا چند کانال") still needs a camera count.
  if (slots.cameraCount === undefined && slots.channels !== undefined) slots.cameraCount = slots.channels;
  if (slots.cameraCount === undefined) {
    const bare = /(\d+)\s*(?:تا|عدد)\b/.exec(text);
    if (bare) slots.cameraCount = Number(bare[1]);
  }

  return slots;
}

/** Bitrate reference used when the user gives a resolution but no explicit bitrate. */
export function referenceBitrateKbps(megapixel: number, codec: "H.264" | "H.265" = "H.265"): number {
  const table: [number, number][] = [
    [2, 2_000],
    [3, 3_000],
    [4, 4_000],
    [5, 5_120],
    [6, 6_100],
    [8, 8_000],
    [12, 12_000]
  ];
  const clamped = Math.max(0.3, megapixel);
  let base = clamped * 1_000;
  for (let index = 0; index < table.length; index += 1) {
    if (clamped <= table[index][0]) {
      if (index === 0) { base = table[0][1] * (clamped / table[0][0]); break; }
      const [lowMp, lowKbps] = table[index - 1];
      const [highMp, highKbps] = table[index];
      base = lowKbps + ((clamped - lowMp) / (highMp - lowMp)) * (highKbps - lowKbps);
      break;
    }
  }
  return Math.round(codec === "H.264" ? base * 2 : base);
}

export const doriPixelsPerMeter = {
  detect: 25,
  observe: 62.5,
  recognize: 125,
  identify: 250,
  anpr: 200
} as const;
