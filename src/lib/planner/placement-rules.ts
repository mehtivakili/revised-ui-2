import type { CameraHousing, SurveillanceTask } from "@/src/domain/catalog/types";
import type { CoverageRequirement, FloorPlan, PlanObstacle, PlanRoom, Vec2 } from "@/src/domain/planner/types";
import type { CameraFeature, SectionEnvironment, SectionType } from "@/src/domain/planner/venues";
import { focalForTask } from "@/src/lib/planner/coverage";
import { pointInPolygon } from "@/src/lib/planner/geometry";
import { roomAreaM2, roomCentroid } from "@/src/lib/planner/rooms";

/**
 * From "what this space is" to "what camera goes here".
 *
 * The rules below are the installer heuristics written down: turrets indoors, bullets
 * outside, three metres as the indoor ceiling for mount height, corners before wall
 * middles, and 2.8 mm before 4 mm. They are deliberately explicit and ordered rather
 * than scored, because an installer reading the output has to be able to agree or
 * disagree with a specific sentence — every recipe carries the reasons that produced it.
 *
 * Nothing here places a camera; it decides what a camera at this section should be.
 * `smart-placement` does the geometry.
 */

export type MountKind = "corner" | "wall-edge" | "ceiling" | "pole";

export const mountKindLabels: Record<MountKind, string> = {
  corner: "گوشه دیوار",
  "wall-edge": "میانه دیوار",
  ceiling: "سقف",
  pole: "پایه یا دکل"
};

export type PlacementRecipe = {
  sectionTypeId: string;
  housing: CameraHousing;
  /** Second acceptable body, offered in the inspector as a one-click swap. */
  housingAlternative?: CameraHousing;
  mountKind: MountKind;
  /** Tried in order when the primary mount cannot reach the required coverage. */
  mountFallbacks: MountKind[];
  mountHeightM: number;
  megapixel: number;
  focalMm: number;
  goal: SurveillanceTask;
  requiredFeatures: CameraFeature[];
  /** Entrances and vehicle lanes need two cameras: the detail shot and the overview. */
  cameraCount: number;
  reasons: string[];
};

export type RoomContext = {
  ceilingHeightM: number;
  areaM2: number;
  /** Longest run the lens has to cover. */
  spanM: number;
  /** Short dimension. A corridor is a space where this stays small. */
  widthM: number;
  openAbove: boolean;
  megapixel: number;
  sensorWidthMm: number;
};

const DEFAULT_MEGAPIXEL = 4;
const DEFAULT_SENSOR_WIDTH_MM = 5.12;

/** Above this ceiling height the camera stops following the ceiling and stays at 3 m. */
const INDOOR_HEIGHT_CAP_M = 3;
/** Wall-mounted cameras stay visibly below the top edge instead of sitting on it. */
const WALL_TOP_CLEARANCE_M = 0.25;
/** A pole mount is a short outdoor riser above the wall/parapet, not a floor stand. */
export const OUTDOOR_POLE_EXTENSION_M = 0.45;
/** Face work needs the lens low enough to see under a cap brim. */
const FACE_HEIGHT_CAP_M = 2.8;
export function wallSafeMountHeight(wallHeightM: number): number {
  const safeWallHeight = Math.max(0.5, wallHeightM);
  const height = safeWallHeight <= INDOOR_HEIGHT_CAP_M
    ? Math.max(0.5, safeWallHeight - WALL_TOP_CLEARANCE_M)
    : INDOOR_HEIGHT_CAP_M;
  return Math.round(height * 100) / 100;
}

function pointToWallDistance(point: Vec2, wall: FloorPlan["walls"][number]): number {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 1e-9) return Math.hypot(point.x - wall.a.x, point.z - wall.a.z);
  const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (wall.a.x + dx * t), point.z - (wall.a.z + dz * t));
}

/** Applies the height rule against the actual closest wall at a placed camera. */
export function constrainCameraMountHeight(
  floor: FloorPlan,
  position: Vec2,
  requestedHeightM: number,
  mountKind?: MountKind
): number {
  const nearestWall = floor.walls.reduce<FloorPlan["walls"][number] | null>((nearest, wall) => {
    if (!nearest) return wall;
    return pointToWallDistance(position, wall) < pointToWallDistance(position, nearest) ? wall : nearest;
  }, null);
  const structuralHeightM = nearestWall?.heightM ?? floor.heightM;
  if (mountKind === "pole") return Math.round((structuralHeightM + OUTDOOR_POLE_EXTENSION_M) * 100) / 100;
  return Math.min(requestedHeightM, wallSafeMountHeight(structuralHeightM));
}

/** The two lenses that cover the overwhelming majority of indoor positions. */
const INDOOR_LENSES = [2.8, 4];
/** Only reached when neither of the two can resolve the goal at that depth. */
const INDOOR_FALLBACK_LENSES = [6, 8];
const OUTDOOR_LENSES = [4, 6, 8, 12];
const PLATE_LENSES = [8, 12, 16];

/* ── Room measurement ──────────────────────────────────────────────── */

/**
 * Measures a room for the rule engine.
 *
 * `spanM` is the diagonal rather than the longer side: a corner-mounted camera looks
 * across the room, so the diagonal is the distance the lens actually has to resolve.
 */
/**
 * Whether a drawn checklist area is open to the sky.
 *
 * Outdoor and perimeter areas always are. Any other area is when it lies outside every
 * room on its floor: a parking yard or forecourt rather than a covered garage, or the
 * stands and pitch of an open stadium. It then gets the open-air recipe: a bullet on an
 * exterior wall or, failing that, a pole.
 */
export function requirementOpenAbove(environment: SectionEnvironment, polygon: Vec2[], floor: FloorPlan): boolean {
  if (environment === "outdoor" || environment === "perimeter") return true;
  if (polygon.length < 3) return false;
  const centre = roomCentroid(polygon);
  return !(floor.rooms ?? []).some((room) => pointInPolygon(centre, room.polygon));
}

export function roomContext(room: PlanRoom, floor: FloorPlan): RoomContext {
  const xs = room.polygon.map((point) => point.x);
  const zs = room.polygon.map((point) => point.z);
  const boxWidth = Math.max(...xs) - Math.min(...xs);
  const boxDepth = Math.max(...zs) - Math.min(...zs);

  const manualWidth = room.manual?.widthM;
  const manualDepth = room.manual?.depthM;
  const width = manualWidth && manualWidth > 0 ? manualWidth : boxWidth;
  const depth = manualDepth && manualDepth > 0 ? manualDepth : boxDepth;

  return {
    ceilingHeightM: room.ceilingHeightM ?? floor.heightM ?? INDOOR_HEIGHT_CAP_M,
    areaM2: roomAreaM2(room.polygon),
    spanM: Math.max(1, Math.hypot(width, depth)),
    widthM: Math.max(0.5, Math.min(width, depth)),
    openAbove: room.manual?.openAbove ?? false,
    megapixel: DEFAULT_MEGAPIXEL,
    sensorWidthMm: DEFAULT_SENSOR_WIDTH_MM
  };
}

/* ── Individual rules ──────────────────────────────────────────────── */

function chooseHousing(section: SectionType, context: RoomContext): {
  housing: CameraHousing;
  alternative?: CameraHousing;
  reason: string;
} {
  if (context.openAbove && (section.environment === "indoor-room" || section.environment === "indoor-corridor")) {
    return { housing: "bullet", alternative: "turret", reason: "فضای بدون سقف: بدنه بولت روی دیوار یا پایه" };
  }
  switch (section.environment) {
    case "indoor-room":
      return {
        housing: "turret",
        alternative: "dome",
        reason: "فضای داخلی: در حدود ۸۰٪ موارد تورت انتخاب می‌شود؛ دام جایگزین قابل قبول است"
      };
    case "indoor-corridor":
      return {
        housing: "turret",
        alternative: "bullet",
        reason: "راهرو: دوربین در انتهای راهرو و در راستای محور نصب می‌شود تا طول راهرو پوشش یابد"
      };
    case "parking":
      return context.openAbove
        ? { housing: "bullet", alternative: "turret", reason: "پارکینگ روباز: بدنه بولت روی دیوار یا پایه" }
        : { housing: "turret", alternative: "dome", reason: "پارکینگ سرپوشیده: تورت با دید افقی روی راهروی پارک" };
    case "perimeter":
      return {
        housing: "bullet",
        alternative: "ptz",
        reason: "پیرامون: بولت برای پوشش ثابت خط محیطی؛ اسپیددام برای گشت روی محیط‌های طولانی"
      };
    case "outdoor":
    default:
      return context.areaM2 > 600
        ? { housing: "bullet", alternative: "ptz", reason: "محوطه بزرگ: بولت ثابت به همراه امکان افزودن اسپیددام" }
        : { housing: "bullet", alternative: "turret", reason: "فضای باز: بدنه بولت با آفتاب‌گیر و مقاومت محیطی" };
  }
}

const isFaceGoal = (goal: SurveillanceTask) => goal === "face-capture" || goal === "face-identify";
const isPlateGoal = (goal: SurveillanceTask) => goal === "plate-capture" || goal === "anpr";

/** Chooses the lowest useful resolution before lens selection is evaluated. */
function chooseMegapixel(section: SectionType, context: RoomContext): number {
  if (isPlateGoal(section.goal)) return 8;
  if (section.goal === "face-identify") return context.spanM > 12 ? 8 : 5;
  if (section.goal === "face-capture") return context.spanM > 10 ? 5 : 4;
  if (context.areaM2 > 600 || context.spanM > 30) return 8;
  if (context.spanM > 18) return 5;
  return 4;
}

/**
 * Mount height.
 *
 * Indoors the camera follows the ceiling until three metres and then stops: past that
 * the view angle gets too steep and faces disappear under the top of the head. Face
 * work pulls it lower still.
 */
function chooseMountHeight(
  section: SectionType,
  context: RoomContext,
  mountKind: MountKind
): { heightM: number; reasons: string[] } {
  const reasons: string[] = [];
  const indoor = !context.openAbove && (section.environment === "indoor-room"
    || section.environment === "indoor-corridor"
    || section.environment === "parking");

  let height: number;
  if (mountKind === "pole") {
    height = context.ceilingHeightM + OUTDOOR_POLE_EXTENSION_M;
    reasons.push("پایه فقط در فضای باز و به‌صورت رایزر ۴۵ سانتی‌متری بالاتر از تراز دیوار استفاده می‌شود");
  } else {
    height = wallSafeMountHeight(context.ceilingHeightM);
    if (context.ceilingHeightM <= INDOOR_HEIGHT_CAP_M) {
      reasons.push(`ارتفاع دیوار ${context.ceilingHeightM.toFixed(1)} متر است، پس دوربین ۲۵ سانت پایین‌تر نصب می‌شود`);
    } else {
      reasons.push("دیوار بلندتر از ۳ متر است؛ ارتفاع نصب روی ۳ متر محدود می‌شود");
    }
  }

  if (indoor && isFaceGoal(section.goal) && height > FACE_HEIGHT_CAP_M) {
    height = FACE_HEIGHT_CAP_M;
    reasons.push("هدف این فضا ثبت چهره است، پس ارتفاع به ۲٫۸ متر کاهش می‌یابد");
  }

  return { heightM: Math.round(height * 100) / 100, reasons };
}

/**
 * Where on the structure the camera goes.
 *
 * A corner is the default indoors because one camera in a corner sees more of a
 * rectangular room than the same camera anywhere else. The fallbacks exist for the case
 * the user described: when the corner cannot reach the coverage that was asked for, the
 * engine steps out to the middle of a wall and only then to the ceiling.
 */
function chooseMount(section: SectionType, context: RoomContext): {
  mountKind: MountKind;
  fallbacks: MountKind[];
  reason: string;
} {
  if (section.environment === "perimeter") {
    return {
      mountKind: "pole",
      fallbacks: ["wall-edge"],
      reason: "روی خط پیرامونی معمولاً دکل یا پایه در دسترس است"
    };
  }
  // An area without a roof (an open yard, car park or stadium stand) has no ceiling to use.
  if (section.environment === "outdoor" || context.openAbove) {
    return {
      mountKind: "wall-edge",
      fallbacks: ["pole"],
      reason: "نصب روی دیوار بیرونی؛ در نبود دیوار مناسب، پایه"
    };
  }
  if (section.environment === "indoor-corridor") {
    return {
      mountKind: "wall-edge",
      fallbacks: ["corner"],
      reason: "در راهرو دوربین روی دیوار انتهایی و در راستای محور راهرو می‌نشیند"
    };
  }
  const fallbacks: MountKind[] = ["wall-edge"];
  return {
    mountKind: "corner",
    fallbacks,
    reason: "گوشه اتاق پیش‌فرض است چون یک دوربین از گوشه بیشترین مساحت را می‌بیند؛ اگر پوشش لازم تأمین نشد به میانه دیوار و سپس سقف عقب‌نشینی می‌شود"
  };
}

/** Smallest lens in the list that resolves the goal at that distance. */
function pickLens(candidates: number[], required: number): number | null {
  return candidates.find((lens) => lens >= required - 1e-6) ?? null;
}

/**
 * Lens choice, with the 2.8/4 preference enforced rather than merely hoped for.
 *
 * Indoors the engine only leaves that pair when the required pixel density genuinely
 * cannot be met at the room's depth, and when it does it says so in the reasons — an
 * unexplained 6 mm indoors is exactly the kind of thing an installer should challenge.
 */
function chooseLens(section: SectionType, context: RoomContext): { focalMm: number; reasons: string[] } {
  const reasons: string[] = [];
  const required = focalForTask(section.goal, context.spanM, context.megapixel, context.sensorWidthMm);

  if (isPlateGoal(section.goal)) {
    const lens = pickLens(PLATE_LENSES, required) ?? PLATE_LENSES[PLATE_LENSES.length - 1];
    reasons.push("پلاک باید خوانا باشد، پس لنز بلند با زاویه افقی زیر ۳۰ درجه نسبت به مسیر حرکت انتخاب می‌شود");
    return { focalMm: lens, reasons };
  }

  const indoor = !context.openAbove && (section.environment === "indoor-room"
    || section.environment === "indoor-corridor"
    || section.environment === "parking");

  if (indoor) {
    const preferred = pickLens(INDOOR_LENSES, required);
    if (preferred) {
      reasons.push(
        preferred === 2.8
          ? "۲٫۸ میلی‌متر: انتخاب پیش‌فرض فضای داخلی و در این عمق پاسخگوست"
          : "عمق فضا برای ۲٫۸ زیاد است، پس ۴ میلی‌متر انتخاب می‌شود"
      );
      return { focalMm: preferred, reasons };
    }
    const fallback = pickLens(INDOOR_FALLBACK_LENSES, required) ?? INDOOR_FALLBACK_LENSES[INDOOR_FALLBACK_LENSES.length - 1];
    reasons.push(
      `در عمق ${context.spanM.toFixed(1)} متر نه ۲٫۸ و نه ۴ تراکم پیکسل لازم را نمی‌دهد، پس ${fallback} میلی‌متر انتخاب شد`
    );
    return { focalMm: fallback, reasons };
  }

  const lens = pickLens(OUTDOOR_LENSES, required) ?? OUTDOOR_LENSES[OUTDOOR_LENSES.length - 1];
  reasons.push(`فضای باز با عمق ${context.spanM.toFixed(1)} متر؛ لنز ${lens} میلی‌متر`);
  return { focalMm: lens, reasons };
}

/**
 * Sections that need two cameras rather than one.
 *
 * A doorway is the classic case: one camera framed for the face and one for the scene,
 * because a lens tight enough to identify someone is too tight to show what they did.
 * Vehicle lanes are the same argument with a plate instead of a face.
 */
function cameraCountFor(section: SectionType): { count: number; reason?: string } {
  if (isPlateGoal(section.goal)) {
    return { count: 2, reason: "مسیر خودرو دو دوربین می‌خواهد: یکی برای پلاک و یکی برای دید کلی صحنه" };
  }
  if (/entrance|gate|access|lobby|reception/.test(section.id) && section.priority === "critical") {
    return { count: 2, reason: "ورودی دو دوربین می‌خواهد: یکی برای چهره و یکی برای دید کلی" };
  }
  return { count: 1 };
}

/* ── Public entry point ────────────────────────────────────────────── */

/**
 * The full recipe for one section in one room.
 *
 * Returns null for privacy-protected spaces: a bathroom or a patient room does not get
 * a quieter recommendation, it gets none at all.
 */
export function recipeFor(section: SectionType, context: RoomContext): PlacementRecipe | null {
  if (section.forbidden) return null;

  const housing = chooseHousing(section, context);
  const mount = chooseMount(section, context);
  const height = chooseMountHeight(section, context, mount.mountKind);
  const megapixel = chooseMegapixel(section, context);
  const lens = chooseLens(section, { ...context, megapixel });
  const cameras = cameraCountFor(section);

  const reasons = [
    housing.reason,
    mount.reason,
    ...height.reasons,
    ...lens.reasons,
    ...(cameras.reason ? [cameras.reason] : []),
    ...(section.requiredFeatures.length === 0 && isFaceGoal(section.goal)
      ? ["کیفیت باید چهره را نشان دهد، اما قابلیت تشخیص چهره روی دوربین لازم نیست"]
      : []),
    ...(section.note ? [section.note] : [])
  ];

  return {
    sectionTypeId: section.id,
    housing: housing.housing,
    housingAlternative: housing.alternative,
    mountKind: mount.mountKind,
    mountFallbacks: mount.fallbacks,
    mountHeightM: height.heightM,
    megapixel,
    focalMm: lens.focalMm,
    goal: section.goal,
    requiredFeatures: section.requiredFeatures,
    cameraCount: cameras.count,
    reasons
  };
}

/* ── Equipment coverage ────────────────────────────────────────────── */

/** How far around a rack the requirement reaches, so an approach is caught too. */
const EQUIPMENT_MARGIN_M = 1.2;

function isRecorderRack(obstacle: PlanObstacle): boolean {
  return obstacle.variant === "equipment-rack" || obstacle.kind === "equipment";
}

function boxAround(centre: Vec2, halfWidth: number, halfDepth: number): Vec2[] {
  return [
    { x: centre.x - halfWidth, z: centre.z - halfDepth },
    { x: centre.x + halfWidth, z: centre.z - halfDepth },
    { x: centre.x + halfWidth, z: centre.z + halfDepth },
    { x: centre.x - halfWidth, z: centre.z + halfDepth }
  ];
}

/**
 * Coverage the recorder itself needs.
 *
 * A system whose NVR sits in shot of nothing loses its own evidence the moment someone
 * walks off with the box, so every equipment rack placed on the plan raises an automatic
 * requirement. It is generated rather than asked for, but it is an ordinary requirement
 * afterwards and the user can delete it.
 */
export function equipmentCoverageRequirements(floor: FloorPlan): CoverageRequirement[] {
  return floor.obstacles.filter(isRecorderRack).map((obstacle) => ({
    id: `cover-equipment-${obstacle.id}`,
    polygon: boxAround(
      obstacle.center,
      obstacle.widthM / 2 + EQUIPMENT_MARGIN_M,
      obstacle.depthM / 2 + EQUIPMENT_MARGIN_M
    ),
    label: `پوشش ${obstacle.label || "رک تجهیزات"}`,
    origin: "equipment" as const
  }));
}

/**
 * Merges the generated equipment requirements into a floor without disturbing the
 * user's own areas or re-adding ones they deleted for a rack that is still there.
 */
export function syncEquipmentRequirements(floor: FloorPlan): CoverageRequirement[] {
  const existing = floor.coverageRequirements ?? [];
  const userAreas = existing.filter((requirement) => requirement.origin === "user");
  const known = new Map(existing.filter((item) => item.origin === "equipment").map((item) => [item.id, item]));
  const generated = equipmentCoverageRequirements(floor).map((requirement) => ({
    ...requirement,
    satisfied: known.get(requirement.id)?.satisfied
  }));
  return [...userAreas, ...generated];
}

/** Centre of a requirement, for aiming a camera at it. */
export function requirementCentre(requirement: CoverageRequirement): Vec2 {
  return roomCentroid(requirement.polygon);
}
