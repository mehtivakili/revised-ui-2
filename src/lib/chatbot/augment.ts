import { mulberry32 } from "@/src/lib/chatbot/nn";

/**
 * Deterministic corpus augmentation.
 *
 * Hand-writing enough Persian to cover how differently people phrase the same question
 * is not practical, and a few hundred samples across 42 intents is what caused the model
 * to memorise instead of generalise. These transformations expand each utterance into a
 * family of paraphrases that preserve the intent while varying the surface form.
 *
 * Everything is driven by a seeded PRNG so the generated corpus — and therefore the
 * cached weight fingerprint — is identical on every machine and every run.
 */

/** Interchangeable surface forms. Swapping within a group never changes the intent. */
const synonymGroups: string[][] = [
  ["چقدر", "چقدره", "چه قدر", "چند تا", "چند"],
  ["میخوام", "میخام", "می خواهم", "نیاز دارم", "لازم دارم"],
  ["بگیرم", "بخرم", "تهیه کنم", "انتخاب کنم"],
  ["چیه", "چیست", "یعنی چی", "یعنی چه"],
  ["بهتره", "بهتر است", "مناسب تره", "مناسب تر است"],
  ["لازمه", "لازم است", "نیاز است", "میخواد"],
  ["محاسبه", "حساب", "برآورد"],
  ["کدوم", "کدام", "کدومش"],
  ["فرق", "تفاوت", "فرقش", "چه تفاوتی"],
  ["دوربین", "دوربین مداربسته", "دوربینا"],
  ["دستگاه", "دستگاه ضبط", "رکوردر"],
  ["قیمت", "قیمتش", "هزینه", "چنده"],
  ["پیشنهاد میدی", "پیشنهاد میکنی", "توصیه میکنی", "چی خوبه"],
  ["نصب", "نصب کردن", "راه اندازی"],
  ["مناسب", "خوب", "درست"],
  ["روز", "روزه", "روز آرشیو"],
  ["برای", "جهت", "واسه"]
];

/** Plausible replacement values, bucketed so a count never becomes a distance. */
const numberPools: [number, number[]][] = [
  [10, [2, 3, 4, 5, 6, 8, 9, 12]],
  [100, [12, 16, 18, 20, 24, 25, 30, 32, 45, 60, 64, 90]],
  [1_000, [100, 120, 128, 150, 180, 200, 250, 300, 500]],
  [Number.MAX_SAFE_INTEGER, [1_000, 2_000, 4_096, 5_120, 8_000]]
];

/**
 * Deliberately excludes "سلام" and "مرسی": those words *are* the greeting and thanks
 * intents, and sprinkling them across every other intent taught the model to ignore
 * them. It cost both intents outright in held-out testing.
 */
const politePrefixes = ["", "", "", "ببخشید ", "لطفا ", "میشه بگید "];
const politeSuffixes = ["", "", "", "", " لطفا", "؟"];

function pick<T>(values: T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

function swapSynonym(text: string, random: () => number): string {
  const applicable = synonymGroups.filter((group) => group.some((form) => text.includes(form)));
  if (!applicable.length) return text;
  const group = pick(applicable, random);
  const present = group.filter((form) => text.includes(form)).sort((a, b) => b.length - a.length)[0];
  const replacement = pick(group.filter((form) => form !== present), random);
  return replacement ? text.replace(present, replacement) : text;
}

function swapNumber(text: string, random: () => number): string {
  const matches = [...text.matchAll(/\d+/g)];
  if (!matches.length) return text;
  const target = pick(matches, random);
  const value = Number(target[0]);
  const pool = numberPools.find(([ceiling]) => value < ceiling)?.[1] ?? numberPools[0][1];
  const replacement = pick(pool.filter((candidate) => candidate !== value), random);
  if (replacement === undefined) return text;
  return `${text.slice(0, target.index)}${replacement}${text.slice(target.index! + target[0].length)}`;
}

/** Persian inserts counting particles freely; the model has to see both forms. */
function toggleParticle(text: string, random: () => number): string {
  if (/\d+\s+(?:تا|عدد|دستگاه)\s/.test(text)) return text.replace(/(\d+)\s+(?:تا|عدد|دستگاه)\s/, "$1 ");
  const particle = pick(["تا", "عدد", "دستگاه"], random);
  return text.replace(/(\d+)\s+(?=[؀-ۿ])/, `$1 ${particle} `);
}

/** Single-character noise, mirroring the typos that actually reach a chat box. */
function injectTypo(text: string, random: () => number): string {
  const words = text.split(" ").filter((word) => word.length > 4 && !/\d/.test(word));
  if (!words.length) return text;
  const word = pick(words, random);
  const position = 1 + Math.floor(random() * (word.length - 2));
  const mutated = random() < 0.5
    ? word.slice(0, position) + word.slice(position + 1)
    : word.slice(0, position) + word[position] + word.slice(position);
  return text.replace(word, mutated);
}

function addPoliteness(text: string, random: () => number): string {
  return `${pick(politePrefixes, random)}${text}${pick(politeSuffixes, random)}`.trim();
}

const transforms = [swapSynonym, swapNumber, toggleParticle, addPoliteness, injectTypo];

/**
 * Produces up to `variants` distinct paraphrases of one utterance.
 * The original is always included as the first element.
 */
export function augmentUtterance(text: string, variants: number, seed: number): string[] {
  const random = mulberry32(seed);
  const produced = new Set<string>([text]);
  // Bounded attempts: transformations can collide, and a fixed budget keeps this
  // deterministic rather than looping until the set happens to fill.
  for (let attempt = 0; attempt < variants * 6 && produced.size <= variants; attempt += 1) {
    let candidate = text;
    const passes = 1 + Math.floor(random() * 2);
    for (let pass = 0; pass < passes; pass += 1) {
      candidate = pick(transforms, random)(candidate, random);
    }
    candidate = candidate.replace(/\s+/g, " ").trim();
    if (candidate && candidate !== text) produced.add(candidate);
  }
  return [...produced];
}

/** Stable per-utterance seed so ordering changes in the corpus do not reshuffle output. */
export function utteranceSeed(text: string, label: number): number {
  let hash = 0x811c9dc5 ^ label;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
