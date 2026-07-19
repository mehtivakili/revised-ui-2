import type { ProjectBrief, ProjectZone } from "@/src/domain/catalog/types";

const projectTypes = ["shop", "office", "factory", "parking", "residential"];
const goals = ["general", "face", "plate", "mixed"];
const budgets = ["economy", "balanced", "professional"];

export function parseProjectBrief(value: unknown): ProjectBrief {
  if (!value || typeof value !== "object") throw new Error("اطلاعات پروژه معتبر نیست.");
  const input = value as Record<string, unknown>;
  const zones = parseZones(input.zones);
  const cameraCount = zones.length ? zones.reduce((sum, zone) => sum + zone.cameraCount, 0) : Math.round(Number(input.cameraCount));
  const outdoorCount = zones.length ? zones.filter((zone) => zone.outdoor).reduce((sum, zone) => sum + zone.cameraCount, 0) : Math.round(Number(input.outdoorCount));
  const entrances = Math.round(Number(input.entrances));
  const archiveDays = Math.round(Number(input.archiveDays));
  if (!projectTypes.includes(String(input.projectType))) throw new Error("نوع پروژه معتبر نیست.");
  if (!goals.includes(String(input.goal))) throw new Error("هدف نظارت معتبر نیست.");
  if (!budgets.includes(String(input.budget))) throw new Error("اولویت خرید معتبر نیست.");
  if (!Number.isFinite(cameraCount) || cameraCount < 2 || cameraCount > 64) throw new Error("تعداد دوربین باید بین ۲ تا ۶۴ باشد.");
  if (!Number.isFinite(outdoorCount) || outdoorCount < 0 || outdoorCount > cameraCount) throw new Error("تعداد دوربین بیرونی معتبر نیست.");
  if (!Number.isFinite(entrances) || entrances < 0 || entrances > 20) throw new Error("تعداد ورودی معتبر نیست.");
  if (!Number.isFinite(archiveDays) || archiveDays < 1 || archiveDays > 180) throw new Error("مدت آرشیو باید بین ۱ تا ۱۸۰ روز باشد.");
  const siteAreaM2 = optionalNumber(input.siteAreaM2, 20, 100000);
  const floors = optionalNumber(input.floors, 1, 20);
  const maxCableRunM = optionalNumber(input.maxCableRunM, 10, 250);
  const remoteViewingUsers = optionalNumber(input.remoteViewingUsers, 1, 100);
  return {
    projectType: input.projectType as ProjectBrief["projectType"], cameraCount, outdoorCount, entrances,
    goal: input.goal as ProjectBrief["goal"], archiveDays, budget: input.budget as ProjectBrief["budget"],
    preferredBrand: typeof input.preferredBrand === "string" ? input.preferredBrand.slice(0, 60) : undefined,
    siteAreaM2, floors, maxCableRunM, remoteViewingUsers,
    lowLightPriority: Boolean(input.lowLightPriority), audioRequired: Boolean(input.audioRequired),
    localRecordingFallback: Boolean(input.localRecordingFallback), redundancyRequired: Boolean(input.redundancyRequired), zones
  };
}

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error("یکی از مقادیر عددی پروژه خارج از محدوده مجاز است.");
  return parsed;
}

function parseZones(value: unknown): ProjectZone[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 8) throw new Error("حداکثر ۸ ناحیه برای هر پروژه قابل تعریف است.");
  return value.map((zone, index) => {
    if (!zone || typeof zone !== "object") throw new Error("اطلاعات یکی از ناحیه‌ها معتبر نیست.");
    const item = zone as Record<string, unknown>;
    const cameraCount = Math.round(Number(item.cameraCount));
    const goal = String(item.goal);
    if (!Number.isFinite(cameraCount) || cameraCount < 1 || cameraCount > 32) throw new Error("تعداد دوربین هر ناحیه باید بین ۱ تا ۳۲ باشد.");
    if (!["general", "face", "plate"].includes(goal)) throw new Error("هدف نظارتی یکی از ناحیه‌ها معتبر نیست.");
    return { id: typeof item.id === "string" ? item.id.slice(0, 80) : `zone-${index}`, name: typeof item.name === "string" ? item.name.slice(0, 80) : `ناحیه ${index + 1}`, cameraCount, outdoor: Boolean(item.outdoor), goal: goal as ProjectZone["goal"] };
  });
}
