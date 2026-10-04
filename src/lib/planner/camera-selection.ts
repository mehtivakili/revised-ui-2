import type { ProjectBrief, ProjectCameraTemplate, SurveillanceTask } from "@/src/domain/catalog/types";
import type { BuildingPlan, FloorPlan, PlanRoom } from "@/src/domain/planner/types";
import { findSectionType, type SectionEnvironment, type SectionType } from "@/src/domain/planner/venues";
import { createTemplate } from "@/src/lib/planner/camera-templates";
import { recipeFor, requirementOpenAbove, roomContext, type PlacementRecipe } from "@/src/lib/planner/placement-rules";
import { TASK_LABELS } from "@/src/lib/recommendation/camera-constraints";

export type CameraSelectionAnalysis = {
  templates: ProjectCameraTemplate[];
  plan: BuildingPlan;
  analysedSpaces: number;
  excludedSpaces: number;
  totalCameras: number;
  notes: string[];
};

type TemplateAccumulator = {
  template: ProjectCameraTemplate;
  roomLabels: Set<string>;
};

const isOutdoor = (environment: SectionEnvironment, room: PlanRoom) =>
  environment === "outdoor"
  || environment === "perimeter"
  || (environment === "parking" && Boolean(room.manual?.openAbove));

function coverageCount(section: SectionType, room: PlanRoom, floor: FloorPlan, recipe: PlacementRecipe): number {
  if (room.overrides?.cameraCount !== undefined) return Math.max(1, Math.round(room.overrides.cameraCount));
  const context = roomContext(room, floor);
  let capacityM2 = 85;
  if (section.environment === "indoor-corridor") capacityM2 = 65;
  if (section.environment === "parking") capacityM2 = 140;
  if (section.environment === "outdoor") capacityM2 = 180;
  if (section.environment === "perimeter") capacityM2 = 220;
  const byArea = Math.ceil(context.areaM2 / capacityM2);
  const byLength = section.environment === "indoor-corridor"
    ? Math.ceil(context.spanM / 18)
    : section.environment === "perimeter"
      ? Math.ceil(context.spanM / 25)
      : 1;
  return Math.min(24, Math.max(recipe.cameraCount, byArea, byLength, room.manual?.mustCover ? 1 : 0));
}

function templateKey(recipe: PlacementRecipe, outdoor: boolean, goal: SurveillanceTask, megapixel: number, focalMm: number) {
  return [recipe.housing, outdoor ? "out" : "in", goal, megapixel, focalMm].join(":");
}

function addTemplate(
  groups: Map<string, TemplateAccumulator>,
  recipe: PlacementRecipe,
  outdoor: boolean,
  goal: SurveillanceTask,
  quantity: number,
  label: string,
  lowLightPriority: boolean
) {
  const focalMm = goal === "monitor" ? Math.min(4, recipe.focalMm) : recipe.focalMm;
  const megapixel = goal === "monitor" ? Math.min(5, recipe.megapixel) : recipe.megapixel;
  const key = templateKey(recipe, outdoor, goal, megapixel, focalMm);
  const existing = groups.get(key);
  if (existing) {
    existing.template.quantity += quantity;
    existing.roomLabels.add(label);
    return;
  }
  const maxRangeM = Math.max(20, Math.min(120, Math.ceil((focalMm <= 4 ? 35 : 55) / 5) * 5));
  const template = createTemplate({
    id: `tpl-auto-${groups.size + 1}`,
    label: `${TASK_LABELS[goal]} ${outdoor ? "بیرونی" : "داخلی"} — لنز ${focalMm}`,
    housing: recipe.housing,
    goal,
    outdoor,
    quantity,
    megapixel,
    focalMm,
    sensorWidthMm: 5.12,
    irRangeM: outdoor || lowLightPriority ? Math.max(40, maxRangeM) : 30,
    maxRangeM,
    mountingHeightM: recipe.mountHeightM,
    cameraTiltDeg: goal === "face-capture" || goal === "face-identify" ? 15 : 12,
    microphone: recipe.requiredFeatures.includes("audio"),
    colorNightVision: lowLightPriority || outdoor,
    weatherproof: outdoor
  });
  groups.set(key, { template, roomLabels: new Set([label]) });
}

function fallbackFromBrief(brief: ProjectBrief): ProjectCameraTemplate[] {
  const area = Math.max(20, brief.siteAreaM2 ?? 80);
  const indoorCount = Math.max(1, Math.ceil(area / 80));
  const templates = [createTemplate({
    id: "tpl-auto-general",
    label: "پوشش عمومی داخلی — لنز ۲.۸",
    quantity: indoorCount,
    megapixel: area > 1000 ? 5 : 4,
    focalMm: 2.8,
    goal: "monitor",
    outdoor: false,
    housing: "turret"
  })];
  if (brief.entrances > 0) templates.push(createTemplate({
    id: "tpl-auto-entrance",
    label: "ثبت چهره ورودی — لنز ۴",
    quantity: brief.entrances,
    megapixel: 5,
    focalMm: 4,
    goal: "face-identify",
    housing: "bullet",
    microphone: Boolean(brief.audioRequired),
    colorNightVision: Boolean(brief.lowLightPriority)
  }));
  if (brief.outdoorCount > 0) templates.push(createTemplate({
    id: "tpl-auto-outdoor",
    label: "پوشش محوطه بیرونی — لنز ۴",
    quantity: brief.outdoorCount,
    megapixel: 4,
    focalMm: 4,
    goal: "monitor",
    housing: "bullet",
    outdoor: true,
    weatherproof: true,
    colorNightVision: true,
    irRangeM: 50,
    maxRangeM: 45
  }));
  return templates;
}

/** Builds editable device types from the semantic rooms and writes the same choices back to placement overrides. */
export function recommendCameraSelection(plan: BuildingPlan, brief: ProjectBrief): CameraSelectionAnalysis {
  const custom = (plan.customSectionTypes ?? []) as unknown as SectionType[];
  const groups = new Map<string, TemplateAccumulator>();
  let analysedSpaces = 0;
  let excludedSpaces = 0;

  const floors = plan.floors.map((floor) => {
    const rooms = (floor.rooms ?? []).map((room) => {
      const section = findSectionType(room.sectionTypeId, custom);
      if (!section) return room;
      const recipe = recipeFor(section, roomContext(room, floor));
      if (!recipe) {
        excludedSpaces += 1;
        return room;
      }
      analysedSpaces += 1;
      const count = coverageCount(section, room, floor, recipe);
      const outdoor = isOutdoor(section.environment, room);
      const overviewCount = recipe.cameraCount > 1 ? 1 : 0;
      addTemplate(groups, recipe, outdoor, recipe.goal, Math.max(1, count - overviewCount), room.name || section.label, Boolean(brief.lowLightPriority));
      if (overviewCount) addTemplate(groups, recipe, outdoor, "monitor", 1, room.name || section.label, Boolean(brief.lowLightPriority));
      return {
        ...room,
        overrides: {
          ...room.overrides,
          housing: recipe.housing,
          mountKind: recipe.mountKind,
          mountHeightM: recipe.mountHeightM,
          megapixel: recipe.megapixel,
          focalMm: recipe.focalMm,
          goal: recipe.goal,
          cameraCount: count
        }
      };
    });

    for (const requirement of floor.coverageRequirements ?? []) {
      if (!requirement.sectionTypeId || requirement.sourceRoomId) continue;
      const section = findSectionType(requirement.sectionTypeId, custom);
      if (!section) continue;
      const zone: PlanRoom = {
        id: requirement.id,
        polygon: requirement.polygon,
        sectionTypeId: section.id,
        name: requirement.label,
        ceilingHeightM: floor.heightM,
        boundarySource: "drawn",
        manual: { openAbove: requirementOpenAbove(section.environment, requirement.polygon, floor) }
      };
      const recipe = recipeFor(section, roomContext(zone, floor));
      if (!recipe) {
        excludedSpaces += 1;
        continue;
      }
      analysedSpaces += 1;
      const outdoor = isOutdoor(section.environment, zone);
      const overviewCount = recipe.cameraCount > 1 ? 1 : 0;
      addTemplate(groups, recipe, outdoor, recipe.goal, recipe.cameraCount - overviewCount, requirement.label, Boolean(brief.lowLightPriority));
      if (overviewCount) addTemplate(groups, recipe, outdoor, "monitor", 1, requirement.label, Boolean(brief.lowLightPriority));
    }

    return { ...floor, rooms };
  });

  let templates = Array.from(groups.values(), ({ template }) => template);
  const notes: string[] = [];
  if (!templates.length) {
    templates = fallbackFromBrief(brief);
    notes.push("فضای نوع‌گذاری‌شده‌ای روی نقشه پیدا نشد؛ پیشنهاد از متراژ، ورودی‌ها و تعداد بیرونی برآورد شد.");
  } else {
    notes.push("تعداد دوربین‌ها از مساحت، طول فضا و اهمیت کاربری محاسبه شده است.");
    notes.push("برای فضاهای داخلی ابتدا لنز ۲.۸ و سپس ۴ میلی‌متر بررسی شده و فقط در صورت نیاز اپتیکی لنز بلندتر انتخاب شده است.");
  }
  if (excludedSpaces) notes.push(`${excludedSpaces} فضای دارای محدودیت حریم خصوصی از پیشنهاد دوربین حذف شد.`);

  return {
    templates,
    plan: { ...plan, floors },
    analysedSpaces,
    excludedSpaces,
    totalCameras: templates.reduce((sum, template) => sum + template.quantity, 0),
    notes
  };
}
