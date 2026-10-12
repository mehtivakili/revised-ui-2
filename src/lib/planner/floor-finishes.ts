/**
 * Floor finishes for spaces enclosed by walls.
 *
 * Each finish has a base colour and a simple pattern (tiles, planks, speckle) so a floor
 * reads as a material in 2D and 3D, not just a tint. A space without its own finish uses
 * the plan's default, which the user can change.
 */

export type FloorFinishId =
  | "tile-white"
  | "stone-gray"
  | "concrete"
  | "wood-oak"
  | "wood-walnut"
  | "marble-cream"
  | "terrazzo"
  | "carpet-blue"
  | "epoxy-gray"
  | "sport-green";

export type FloorFinish = {
  id: FloorFinishId;
  label: string;
  color: number;
  /** Joint or grain colour drawn over the base. */
  accent: number;
  pattern: "tiles" | "planks" | "speckle" | "plain";
  /** Size of one tile or plank run, in metres. */
  moduleM: number;
};

export const floorFinishes: FloorFinish[] = [
  { id: "stone-gray", label: "سنگ طوسی روشن", color: 0xc5cad1, accent: 0xa9b0b9, pattern: "tiles", moduleM: 0.8 },
  { id: "tile-white", label: "سرامیک سفید", color: 0xf1f3f5, accent: 0xd3d8de, pattern: "tiles", moduleM: 0.6 },
  { id: "concrete", label: "بتن صیقلی", color: 0xa8adb3, accent: 0x8f959c, pattern: "speckle", moduleM: 1.2 },
  { id: "wood-oak", label: "پارکت بلوط روشن", color: 0xc99a68, accent: 0xa87a4c, pattern: "planks", moduleM: 1.2 },
  { id: "wood-walnut", label: "پارکت گردویی", color: 0x8b5a3c, accent: 0x6e432a, pattern: "planks", moduleM: 1.2 },
  { id: "marble-cream", label: "مرمر کرم", color: 0xe9dfcc, accent: 0xd2c4a8, pattern: "tiles", moduleM: 1 },
  { id: "terrazzo", label: "موزاییک", color: 0xd8d2c6, accent: 0x9d978b, pattern: "speckle", moduleM: 0.4 },
  { id: "carpet-blue", label: "موکت آبی‌طوسی", color: 0x6f8199, accent: 0x63748b, pattern: "plain", moduleM: 1 },
  { id: "epoxy-gray", label: "اپوکسی صنعتی", color: 0x7f8a96, accent: 0x6c7682, pattern: "plain", moduleM: 1 },
  { id: "sport-green", label: "کفپوش ورزشی", color: 0x4f8a5b, accent: 0xe8efe9, pattern: "plain", moduleM: 1 }
];

export const DEFAULT_FLOOR_FINISH: FloorFinishId = "stone-gray";

export function floorFinish(id: string | undefined): FloorFinish {
  return floorFinishes.find((item) => item.id === id) ?? floorFinishes.find((item) => item.id === DEFAULT_FLOOR_FINISH)!;
}

export const floorFinishCss = (finish: FloorFinish) => `#${finish.color.toString(16).padStart(6, "0")}`;

/**
 * A sensible finish for a kind of space: tiles where there is water, parquet where people
 * live and work, marble at the front door, epoxy where there are vehicles or machines.
 */
export function finishForSpace(sectionTypeId: string | undefined, label = ""): FloorFinishId | undefined {
  if (!sectionTypeId) return undefined;
  const text = `${sectionTypeId} ${label}`.toLowerCase();
  const has = (...words: string[]) => words.some((word) => text.includes(word));
  if (has("sport", "gym", "court", "ورزش", "زمین بازی", "سالن ورزش")) return "sport-green";
  if (has("kitchen", "آشپز", "wc", "toilet", "bath", "سرویس", "بهداشت", "wash", "lab", "آزمایش", "exam", "operat", "اتاق عمل", "nurse", "پرستار", "ward", "بستری", "clinic", "درمان", "pharm", "دارو", "cold", "سردخانه")) return "tile-white";
  if (has("parking", "پارکینگ", "garage", "warehouse", "انبار", "loading", "بارانداز", "workshop", "کارگاه", "factory", "production", "تولید", "plant", "generator", "ژنراتور", "pump", "پمپ", "transformer", "ترانس", "dock", "fleet", "bus", "depot")) return "epoxy-gray";
  if (has("server", "سرور", "data", "rack", "ups", "nvr", "electrical", "برق", "telecom")) return "concrete";
  if (has("lobby", "لابی", "reception", "پذیرش", "entrance", "ورودی", "foyer", "showroom", "نمایش", "gallery", "jewel", "طلا", "vault", "bank")) return "marble-cream";
  if (has("corridor", "راهرو", "stair", "پله", "lift", "آسانسور", "elevator", "landing", "پاگرد", "concourse", "platform", "سکو")) return "terrazzo";
  if (has("bed", "خواب", "living", "نشیمن", "پذیرایی", "family", "child", "کودک", "class", "کلاس", "library", "کتاب")) return "wood-oak";
  if (has("manager", "مدیر", "meeting", "جلسه", "conference", "کنفرانس", "boardroom", "vip", "suite", "سوئیت")) return "wood-walnut";
  if (has("office", "اداری", "admin", "control", "کنترل", "monitor", "مانیتور", "operator", "اپراتور", "work")) return "carpet-blue";
  if (has("shop", "فروش", "sales", "retail", "store", "market", "mart", "cash", "صندوق", "checkout", "restaurant", "رستوران", "dining", "سالن غذا", "cafe", "کافه", "food")) return "terrazzo";
  // Anything else: a calm, varied choice that stays the same for the same kind of space.
  const fallback: FloorFinishId[] = ["stone-gray", "tile-white", "wood-oak", "terrazzo"];
  let hash = 0;
  for (let index = 0; index < sectionTypeId.length; index += 1) hash = (hash * 31 + sectionTypeId.charCodeAt(index)) >>> 0;
  return fallback[hash % fallback.length];
}
