import type { ProjectBrief, ProjectZone, SurveillanceTask } from "@/src/domain/catalog/types";

const projectTypes = ["shop", "office", "factory", "parking", "residential"];
const budgets = ["economy", "balanced", "professional"];
const tasks: SurveillanceTask[] = ["monitor", "face-capture", "face-identify", "plate-capture", "anpr"];

const normalizeTask = (value: unknown): SurveillanceTask => {
  const task = String(value);
  if (task === "general") return "monitor";
  if (task === "face") return "face-identify";
  if (task === "plate") return "plate-capture";
  if (!tasks.includes(task as SurveillanceTask)) throw new Error("هدف نظارتی یکی از ناحیه‌ها معتبر نیست.");
  return task as SurveillanceTask;
};

export function parseProjectBrief(value: unknown): ProjectBrief {
  if (!value || typeof value !== "object") throw new Error("اطلاعات پروژه معتبر نیست.");
  const input = value as Record<string, unknown>;
  const zones = parseZones(input.zones);
  const cameraCount = zones.length ? zones.reduce((sum, zone) => sum + zone.cameraCount, 0) : Math.round(Number(input.cameraCount));
  const outdoorCount = zones.length ? zones.filter((zone) => zone.outdoor).reduce((sum, zone) => sum + zone.cameraCount, 0) : Math.round(Number(input.outdoorCount));
  const entrances = Math.round(Number(input.entrances));
  const archiveDays = Math.round(Number(input.archiveDays));
  if (!projectTypes.includes(String(input.projectType))) throw new Error("نوع پروژه معتبر نیست.");
  if (!budgets.includes(String(input.budget))) throw new Error("اولویت خرید معتبر نیست.");
  if (!Number.isFinite(cameraCount) || cameraCount < 2 || cameraCount > 64) throw new Error("تعداد دوربین باید بین ۲ تا ۶۴ باشد.");
  if (!Number.isFinite(outdoorCount) || outdoorCount < 0 || outdoorCount > cameraCount) throw new Error("تعداد دوربین بیرونی معتبر نیست.");
  if (!Number.isFinite(entrances) || entrances < 0 || entrances > 20) throw new Error("تعداد ورودی معتبر نیست.");
  if (!Number.isFinite(archiveDays) || archiveDays < 1 || archiveDays > 180) throw new Error("مدت آرشیو باید بین ۱ تا ۱۸۰ روز باشد.");

  const goal = String(input.goal) === "mixed" ? "mixed" : zones.length ? summarizeGoal(zones) : normalizeTask(input.goal);
  const siteAreaM2 = optionalNumber(input.siteAreaM2, 20, 100000);
  const floors = optionalNumber(input.floors, 1, 20);
  const maxCableRunM = optionalNumber(input.maxCableRunM, 10, 250);
  const remoteViewingUsers = optionalNumber(input.remoteViewingUsers, 1, 100);
  const upsRuntimeMinutes = optionalNumber(input.upsRuntimeMinutes, 5, 120);
  const budgetMinIrt = optionalNumber(input.budgetMinIrt, 0, 10_000_000_000);
  const budgetMaxIrt = optionalNumber(input.budgetMaxIrt, 1_000_000, 10_000_000_000);
  if (budgetMinIrt !== undefined && budgetMaxIrt !== undefined && budgetMinIrt > budgetMaxIrt) throw new Error("حداقل بودجه نمی‌تواند از حداکثر بودجه بیشتر باشد.");

  const recordingMode = input.recordingMode === "motion" ? "motion" : "continuous";
  const bitrateMode = input.bitrateMode === "CBR" ? "CBR" : "VBR";
  const motionActivityPercent = requiredNumber(input.motionActivityPercent ?? 35, 1, 100, "درصد فعالیت Motion");
  const audioBitrateKbps = requiredNumber(input.audioBitrateKbps ?? 64, 16, 320, "بیت‌ریت صدا");
  const filesystemOverheadPercent = requiredNumber(input.filesystemOverheadPercent ?? 5, 0, 50, "سربار فایل‌سیستم");
  const vbrSafetyMarginPercent = requiredNumber(input.vbrSafetyMarginPercent ?? 20, 0, 100, "حاشیه VBR");
  const reservePercent = requiredNumber(input.reservePercent ?? 10, 0, 50, "فضای رزرو");
  const recordAudio = Boolean(input.recordAudio);

  return {
    projectType: input.projectType as ProjectBrief["projectType"], cameraCount, outdoorCount, entrances,
    goal, archiveDays, budget: input.budget as ProjectBrief["budget"],
    preferredBrand: typeof input.preferredBrand === "string" ? input.preferredBrand.slice(0, 60) : undefined,
    siteAreaM2, floors, maxCableRunM, remoteViewingUsers, upsRuntimeMinutes, budgetMinIrt, budgetMaxIrt,
    recordingMode, motionActivityPercent, bitrateMode, recordAudio, audioBitrateKbps,
    filesystemOverheadPercent, vbrSafetyMarginPercent, reservePercent,
    lowLightPriority: Boolean(input.lowLightPriority), audioRequired: Boolean(input.audioRequired) || recordAudio,
    localRecordingFallback: Boolean(input.localRecordingFallback), redundancyRequired: Boolean(input.redundancyRequired), zones
  };
}

function requiredNumber(value: unknown, min: number, max: number, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`${label} خارج از محدوده مجاز است.`);
  return parsed;
}

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredNumber(value, min, max, "یکی از مقادیر عددی پروژه");
}

function summarizeGoal(zones: ProjectZone[]): ProjectBrief["goal"] {
  const distinct = new Set(zones.map((zone) => zone.goal));
  return distinct.size === 1 ? zones[0].goal : "mixed";
}

function parseZones(value: unknown): ProjectZone[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 8) throw new Error("حداکثر ۸ ناحیه برای هر پروژه قابل تعریف است.");
  return value.map((zone, index) => {
    if (!zone || typeof zone !== "object") throw new Error("اطلاعات یکی از ناحیه‌ها معتبر نیست.");
    const item = zone as Record<string, unknown>;
    const cameraCount = Math.round(Number(item.cameraCount));
    if (!Number.isFinite(cameraCount) || cameraCount < 1 || cameraCount > 32) throw new Error("تعداد دوربین هر ناحیه باید بین ۱ تا ۳۲ باشد.");
    const name = typeof item.name === "string" ? item.name.slice(0, 80).trim() : `ناحیه ${index + 1}`;
    if (!name) throw new Error("نام ناحیه نمی‌تواند خالی باشد.");
    const minimumPpm = optionalNumber(item.minimumPpm, 10, 1_000);
    const measuredBitrateKbps = optionalNumber(item.measuredBitrateKbps, 16, 100_000);
    return {
      id: typeof item.id === "string" ? item.id.slice(0, 80) : `zone-${index}`,
      name,
      cameraCount,
      outdoor: Boolean(item.outdoor),
      goal: normalizeTask(item.goal),
      targetDistanceM: requiredNumber(item.targetDistanceM, 0.5, 500, `فاصله هدف در ناحیه ${name}`),
      sceneWidthM: requiredNumber(item.sceneWidthM, 0.5, 200, `عرض صحنه در ناحیه ${name}`),
      mountingHeightM: requiredNumber(item.mountingHeightM, 1.5, 30, `ارتفاع نصب در ناحیه ${name}`),
      targetHeightM: requiredNumber(item.targetHeightM, 0, 5, `ارتفاع هدف در ناحیه ${name}`),
      cameraTiltDeg: requiredNumber(item.cameraTiltDeg, 0, 89, `زاویه Tilt در ناحیه ${name}`),
      minimumPpm,
      measuredBitrateKbps
    };
  });
}
