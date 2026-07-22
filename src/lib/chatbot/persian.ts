import { normalizeDigits } from "@/src/lib/format";

/**
 * Persian text pipeline for the offline assistant.
 * Everything here runs locally: no tokenizer download, no remote service.
 */

const zeroWidth = /[​-‏‪-‮⁦-⁩﻿]/g;
const tashkeel = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const tatweel = /ـ/g;
const zwnj = /‌/g;

const letterFolding: [RegExp, string][] = [
  [/[يیۍێ]/g, "ی"],
  [/[كڪڭ]/g, "ک"],
  [/[أإآاٱٲٳ]/g, "ا"],
  [/[ؤۇۈۉۊ]/g, "و"],
  [/[ۀهة]/g, "ه"],
  [/[ٹټ]/g, "ت"],
  [/[ږڑ]/g, "ر"],
  [/[ښ]/g, "ش"],
  [/[ڤۋ]/g, "و"],
  [/[گګ]/g, "گ"],
  [/[ژ]/g, "ژ"]
];

/** Latin words that Persian CCTV chat mixes in constantly, mapped to one canonical spelling. */
const lexicalSynonyms: Record<string, string> = {
  "دوربینها": "دوربین",
  "دوربینهای": "دوربین",
  "کمرا": "دوربین",
  "camera": "دوربین",
  "cam": "دوربین",
  "cctv": "مداربسته",
  "مدار": "مداربسته",
  "بسته": "مداربسته",
  "nvr": "ان‌وی‌ار",
  "دی‌وی‌ار": "دستگاه",
  "dvr": "دستگاه",
  "xvr": "دستگاه",
  "رکوردر": "دستگاه",
  "ضبطکننده": "دستگاه",
  "هارد": "هارد",
  "hdd": "هارد",
  "hard": "هارد",
  "disk": "هارد",
  "دیسک": "هارد",
  "storage": "ذخیره",
  "استوریج": "ذخیره",
  "lens": "لنز",
  "فوکال": "کانونی",
  "focal": "کانونی",
  "fov": "زاویه‌دید",
  "angle": "زاویه",
  "resolution": "رزولوشن",
  "رزولیشن": "رزولوشن",
  "کیفیت": "رزولوشن",
  "mp": "مگاپیکسل",
  "megapixel": "مگاپیکسل",
  "poe": "پی‌او‌ای",
  "سوییچ": "سوئیچ",
  "switch": "سوئیچ",
  "ups": "یوپی‌اس",
  "یو‌پی‌اس": "یوپی‌اس",
  "bitrate": "بیت‌ریت",
  "بیتریت": "بیت‌ریت",
  "bandwidth": "پهنای‌باند",
  "پهنا": "پهنای‌باند",
  "باند": "پهنای‌باند",
  "raid": "رید",
  "ریید": "رید",
  "subnet": "ساب‌نت",
  "سابنت": "ساب‌نت",
  "ip": "آی‌پی",
  "آیپی": "آی‌پی",
  "price": "قیمت",
  "قیمتش": "قیمت",
  "هزینه": "قیمت",
  "تومن": "تومان",
  "برند": "برند",
  "brand": "برند",
  "مارک": "برند",
  "wdr": "دبلیو‌دی‌آر",
  "onvif": "انویف",
  "انویف": "انویف",
  "ptz": "پی‌تی‌زد",
  "پیتیزد": "پی‌تی‌زد",
  "dori": "دوری",
  "ppm": "پیکسل‌بر‌متر",
  "ir": "دیدرنگ",
  "مادون": "مادون‌قرمز",
  "قرمز": "مادون‌قرمز",
  "شب": "دیدرشب",
  "نصب": "نصب",
  "install": "نصب",
  "fresnel": "فرنل",
  "ack": "ای‌سی‌کی",
  "dbm": "دی‌بی‌ام",
  "mbps": "مگابیت",
  "kbps": "کیلوبیت",
  "tb": "ترابایت",
  "gb": "گیگابایت"
};

/** Suffixes stripped by the light stemmer, longest first. */
const suffixes = [
  "هایی",
  "هایم",
  "هایت",
  "هایش",
  "هامون",
  "هاتون",
  "هاشون",
  "ترین",
  "های",
  "شان",
  "تان",
  "مان",
  "است",
  "ها",
  "تر",
  "ام",
  "ات",
  "اش",
  "یم",
  "ید",
  "ند"
];

export function normalizePersian(input: string): string {
  let text = normalizeDigits(String(input || ""))
    .replace(zeroWidth, (char) => (char === "‌" ? "‌" : " "))
    .replace(tashkeel, "")
    .replace(tatweel, "")
    .replace(zwnj, " ");

  for (const [pattern, replacement] of letterFolding) text = text.replace(pattern, replacement);

  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.\/\-+%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stem(token: string): string {
  if (token.length <= 3) return token;
  for (const suffix of suffixes) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

export function tokenize(input: string): string[] {
  const normalized = normalizePersian(input);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => lexicalSynonyms[token] ?? token)
    .map((token) => normalizePersian(token))
    .filter(Boolean);
}

export function tokenizeStemmed(input: string): string[] {
  return tokenize(input).map(stem).filter(Boolean);
}

export function charNgrams(input: string, size = 3): string[] {
  const padded = ` ${normalizePersian(input).replace(/\s+/g, " ")} `;
  const grams: string[] = [];
  for (let index = 0; index + size <= padded.length; index += 1) {
    grams.push(padded.slice(index, index + size));
  }
  return grams;
}

const numberWords: Record<string, number> = {
  صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9,
  ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16,
  هفده: 17, هجده: 18, نوزده: 19, بیست: 20, "سی": 30, چهل: 40, پنجاه: 50, شصت: 60,
  هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500,
  ششصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900, هزار: 1_000, میلیون: 1_000_000, میلیارد: 1_000_000_000
};

const multiplierWords = new Set(["هزار", "میلیون", "میلیارد", "صد"]);

/** Converts inline Persian number words ("بیست و چهار دوربین") into digits before slot parsing. */
export function digitizeNumberWords(input: string): string {
  const tokens = normalizePersian(input).split(" ");
  const output: string[] = [];
  let accumulator = 0;
  let current = 0;
  let active = false;

  const flush = () => {
    if (!active) return;
    output.push(String(accumulator + current));
    accumulator = 0;
    current = 0;
    active = false;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "و" && active) continue;

    // Digit runs join the accumulator too, so "۵۰ میلیون" collapses to a single number.
    if (/^\d+$/.test(token)) {
      flush();
      current = Number(token);
      active = true;
      continue;
    }

    const value = numberWords[token];
    if (value === undefined) {
      flush();
      output.push(token);
      continue;
    }

    active = true;
    if (multiplierWords.has(token) && (current > 0 || accumulator > 0)) {
      const base = current || 1;
      if (token === "صد") {
        current = base * 100;
      } else {
        accumulator = (accumulator + current) * value;
        current = 0;
      }
    } else {
      current += value;
    }
  }

  flush();
  return output.join(" ");
}

export function formatFa(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0
  }).format(value);
}

export function formatToman(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "قیمت ثبت‌نشده";
  return `${formatFa(Math.round(value))} تومان`;
}
