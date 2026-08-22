import type { SurveillanceTask } from "@/src/domain/catalog/types";
import type {
  BuildingPlan,
  FloorPlan,
  PlanCamera,
  PlanCameraDefinition,
  PlanObstacle,
  PlanRoom,
  Vec2
} from "@/src/domain/planner/types";
import { defaultCameraOptics } from "@/src/domain/planner/types";
import { findSectionType, sectionsForVenue, type SectionType } from "@/src/domain/planner/venues";
import { computeCameraCoverage, ppmAtDistance } from "@/src/lib/planner/coverage";
import {
  constrainCameraMountHeight,
  recipeFor,
  roomContext,
  type MountKind
} from "@/src/lib/planner/placement-rules";
import {
  boundsOf,
  collectOccluders,
  convexHull,
  distance,
  largestClosedWallLoop,
  obstacleCorners,
  pointInPolygon,
  polygonArea
} from "@/src/lib/planner/geometry";

type SamplePoint = {
  point: Vec2;
  kind: "area" | "door" | "requirement";
  baseWeight: number;
  /** Set when the point falls inside a must-cover area, so it can be audited afterwards. */
  requirementId?: string;
};
type Candidate = {
  position: Vec2;
  yawDeg: number;
  facesDoor: boolean;
  mounting: "corner" | "wall" | "ceiling" | "central" | "pole";
};

type FloorContext = {
  floor: FloorPlan;
  boundary: Vec2[];
  samples: SamplePoint[];
  candidates: Candidate[];
  currentPpm: number[];
  initialPpm: number[];
  /** Outlines of privacy-protected spaces; nothing is sampled or sited inside them. */
  forbiddenAreas: Vec2[][];
};

export type SmartPlacementFloorReport = {
  floorId: string;
  floorName: string;
  placed: number;
  coverageBeforePercent: number;
  coverageAfterPercent: number;
};

export type SmartPlacementReport = {
  /** False means hard validation or must-cover constraints rejected the proposed layout. */
  accepted: boolean;
  placed: number;
  requested: number;
  coverageBeforePercent: number;
  coverageAfterPercent: number;
  floorReports: SmartPlacementFloorReport[];
  /** Must-cover areas the solution failed to satisfy, named so they can be found. */
  unmetRequirements: string[];
  validationErrors: string[];
  warnings: string[];
};

export type SmartPlacementResult = {
  plan: BuildingPlan;
  report: SmartPlacementReport;
};

/**
 * Starts camera placement over without touching the architectural/programme work.
 * Requirement verdicts are derived from cameras, so they must be cleared with them or
 * the checklist would keep showing stale green coverage after every device is gone.
 */
export function resetCameraPlacements(plan: BuildingPlan): BuildingPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => ({
      ...floor,
      cameras: [],
      coverageRequirements: (floor.coverageRequirements ?? []).map((requirement) => ({
        ...requirement,
        satisfied: undefined
      }))
    }))
  };
}

const taskPpm: Record<SurveillanceTask, number> = {
  monitor: 62,
  "face-capture": 125,
  "face-identify": 250,
  "plate-capture": 200,
  anpr: 200
};

const taskTargetHeightM: Record<SurveillanceTask, number> = {
  monitor: 1.5,
  "face-capture": 1.7,
  "face-identify": 1.7,
  "plate-capture": 0.8,
  anpr: 0.8
};

/**
 * How much harder the optimiser works for a space, by its declared priority.
 *
 * This is what makes the venue taxonomy change the answer rather than merely label it:
 * a till in a shop pulls cameras towards itself far more strongly than a stockroom of
 * the same size, because the section type says it matters more.
 */
const priorityWeight: Record<string, number> = {
  critical: 3,
  important: 1.8,
  optional: 1
};

/** A must-cover area outranks every priority — it is a constraint, not a preference. */
const REQUIREMENT_WEIGHT = 9;

type RoomZone = { roomId: string; polygon: Vec2[]; weight: number; forbidden: boolean; areaM2: number };

/** Checks the semantic prerequisites that make a rule-based layout trustworthy. */
export function validateSmartPlacementPlan(plan: BuildingPlan): string[] {
  const errors: string[] = [];
  const custom = (plan.customSectionTypes ?? []) as unknown as SectionType[];
  const resolve = (id?: string) => findSectionType(id, custom);

  if (!plan.venueTypeId) errors.push("ابتدا کاربری پروژه را انتخاب کنید.");
  if (!plan.floors.some((floor) => largestClosedWallLoop(floor.walls) || (floor.rooms ?? []).some((room) => room.polygon.length >= 3))) {
    errors.push("هیچ فضای بسته یا ناحیه ترسیم‌شده‌ای برای تحلیل وجود ندارد.");
  }

  const unassigned = plan.floors.flatMap((floor) =>
    (floor.rooms ?? []).filter((room) => !room.sectionTypeId).map((room) => `${floor.name}: ${room.name || "فضای بدون نوع"}`)
  );
  if (unassigned.length) errors.push(`نوع این فضاها مشخص نشده است: ${unassigned.join("، ")}.`);

  if (plan.venueTypeId) {
    const dismissed = new Set(plan.dismissedSectionIds ?? []);
    const declared = new Set(plan.floors.flatMap((floor) => [
      ...(floor.rooms ?? []).map((room) => room.sectionTypeId),
      ...(floor.coverageRequirements ?? []).map((requirement) => requirement.sectionTypeId)
    ]));
    const missingCritical = sectionsForVenue(plan.venueTypeId, custom)
      .filter((section) => section.priority === "critical" && !dismissed.has(section.id) && !declared.has(section.id));
    if (missingCritical.length) {
      errors.push(`بخش‌های حیاتی زیر نه تعریف شده‌اند و نه «در این پروژه ندارم» خورده‌اند: ${missingCritical.map((item) => item.label).join("، ")}.`);
    }
  }

  for (const floor of plan.floors) {
    const forbidden = (floor.rooms ?? []).filter((room) => resolve(room.sectionTypeId)?.forbidden);
    for (const camera of floor.cameras) {
      const room = forbidden.find((item) => pointInPolygon(camera.position, item.polygon));
      if (room) errors.push(`دوربین «${camera.name}» داخل فضای ممنوع «${room.name || resolve(room.sectionTypeId)?.label || room.id}» قرار دارد.`);
    }
  }
  return errors;
}

function effectiveRoomRecipe(room: PlanRoom, floor: FloorPlan, section: SectionType) {
  const base = recipeFor(section, roomContext(room, floor));
  if (!base) return null;
  return {
    ...base,
    housing: room.overrides?.housing ?? base.housing,
    mountKind: room.overrides?.mountKind ?? base.mountKind,
    mountHeightM: room.overrides?.mountHeightM ?? base.mountHeightM,
    focalMm: room.overrides?.focalMm ?? base.focalMm,
    goal: room.overrides?.goal ?? base.goal,
    cameraCount: Math.max(1, Math.round(room.overrides?.cameraCount ?? base.cameraCount))
  };
}

/** Turns every declared space into concrete camera requests consumed by the optimiser. */
export function definitionsFromRooms(plan: BuildingPlan): PlanCameraDefinition[] {
  const custom = (plan.customSectionTypes ?? []) as unknown as SectionType[];
  const definitions: PlanCameraDefinition[] = [];
  for (const floor of plan.floors) {
    for (const room of floor.rooms ?? []) {
      const section = findSectionType(room.sectionTypeId, custom);
      if (!section) continue;
      const recipe = effectiveRoomRecipe(room, floor, section);
      if (!recipe) continue;
      const existing = floor.cameras.filter((camera) =>
        camera.roomId === room.id || (!camera.roomId && pointInPolygon(camera.position, room.polygon))
      ).length;
      for (let index = existing; index < recipe.cameraCount; index += 1) {
        const overview = recipe.cameraCount > 1 && index === recipe.cameraCount - 1;
        const goal = overview ? "monitor" : recipe.goal;
        const focalMm = overview ? Math.min(4, recipe.focalMm) : recipe.focalMm;
        definitions.push({
          id: `rule:${floor.id}:${room.id}:${index}`,
          zoneId: room.id,
          groupName: room.name || section.label,
          name: `${room.name || section.label} — ${overview ? "دید کلی" : "نمای هدف"}`,
          housing: recipe.housing,
          outdoor: section.environment === "outdoor" || section.environment === "perimeter" || (section.environment === "parking" && room.manual?.openAbove),
          goal,
          optics: {
            ...defaultCameraOptics,
            focalMm,
            mountHeightM: recipe.mountHeightM,
            maxRangeM: Math.max(12, Math.min(60, roomContext(room, floor).spanM * 1.35))
          },
          features: {
            microphone: false,
            colorNightVision: false,
            weatherproof: section.environment === "outdoor" || section.environment === "perimeter"
          },
          roomId: room.id,
          sectionTypeId: section.id,
          mountKind: recipe.mountKind,
          mountFallbacks: recipe.mountFallbacks,
          placementReasons: [
            ...recipe.reasons,
            ...(overview ? ["این دوربین عضو دوم جفت ورودی/گیت و برای دید کلی صحنه است."] : [])
          ],
          requiredFeatures: recipe.requiredFeatures
        });
      }
    }

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
        manual: {
          openAbove: section.environment === "outdoor" || section.environment === "perimeter"
        }
      };
      const recipe = recipeFor(section, roomContext(zone, floor));
      if (!recipe) continue;
      const existing = floor.cameras.filter((camera) => camera.requirementId === requirement.id).length;
      for (let index = existing; index < recipe.cameraCount; index += 1) {
        const overview = recipe.cameraCount > 1 && index === recipe.cameraCount - 1;
        definitions.push({
          id: `rule:${floor.id}:requirement:${requirement.id}:${index}`,
          zoneId: requirement.id,
          groupName: requirement.label || section.label,
          name: `${requirement.label || section.label} — ${overview ? "دید کلی" : "نمای هدف"}`,
          housing: recipe.housing,
          outdoor: section.environment === "outdoor" || section.environment === "perimeter",
          goal: overview ? "monitor" : recipe.goal,
          optics: {
            ...defaultCameraOptics,
            focalMm: overview ? Math.min(4, recipe.focalMm) : recipe.focalMm,
            mountHeightM: recipe.mountHeightM,
            maxRangeM: Math.max(12, Math.min(60, roomContext(zone, floor).spanM * 1.35))
          },
          features: {
            microphone: false,
            colorNightVision: false,
            weatherproof: section.environment === "outdoor" || section.environment === "perimeter"
          },
          requirementId: requirement.id,
          sectionTypeId: section.id,
          mountKind: recipe.mountKind,
          mountFallbacks: recipe.mountFallbacks,
          placementReasons: [
            ...recipe.reasons,
            `این دوربین برای ناحیه اجباری «${requirement.label}» تعریف شده است.`
          ],
          requiredFeatures: recipe.requiredFeatures
        });
      }
    }
  }
  return definitions;
}

/**
 * Reads the floor's rooms into weighting zones.
 *
 * Sorted smallest-first so a room inside a hall wins the lookup: the inner space is the
 * more specific statement about that point.
 */
function roomZones(floor: FloorPlan, resolve: (id?: string) => SectionType | null): RoomZone[] {
  return (floor.rooms ?? [])
    .map((room) => {
      const section = resolve(room.sectionTypeId);
      return {
        roomId: room.id,
        polygon: room.polygon,
        // An unassigned room is not yet a statement about anything, so it stays neutral
        // rather than being treated as low priority and quietly starved of cameras.
        weight: section ? priorityWeight[section.priority] ?? 1 : 1,
        forbidden: Boolean(section?.forbidden),
        areaM2: Math.abs(polygonArea(room.polygon))
      };
    })
    .sort((a, b) => a.areaM2 - b.areaM2);
}

function zoneAt(zones: RoomZone[], point: Vec2): RoomZone | null {
  return zones.find((zone) => pointInPolygon(point, zone.polygon)) ?? null;
}

function withRoomRequirements(floor: FloorPlan): FloorPlan {
  const existing = floor.coverageRequirements ?? [];
  const rooms = floor.rooms ?? [];
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const syncedExisting = existing
    .filter((requirement) => !requirement.sourceRoomId || roomsById.get(requirement.sourceRoomId)?.manual?.mustCover)
    .map((requirement) => {
      const source = requirement.sourceRoomId ? roomsById.get(requirement.sourceRoomId) : null;
      return source
        ? {
          ...requirement,
          polygon: source.polygon.map((point) => ({ ...point })),
          sectionTypeId: source.sectionTypeId
        }
        : requirement;
    });
  const known = new Set(syncedExisting.map((item) => item.id));
  const roomAreas = rooms
    .filter((room) => room.manual?.mustCover && !known.has(`cover-room-${room.id}`))
    .map((room) => ({
      id: `cover-room-${room.id}`,
      polygon: room.polygon.map((point) => ({ ...point })),
      label: `پوشش کامل ${room.name || "فضای انتخاب‌شده"}`,
      origin: "user" as const,
      sectionTypeId: room.sectionTypeId,
      sourceRoomId: room.id
    }));
  return { ...floor, coverageRequirements: [...syncedExisting, ...roomAreas] };
}

function pointInsideObstacle(point: Vec2, obstacle: PlanObstacle, clearanceM = 0.3) {
  const corners = obstacleCorners({
    ...obstacle,
    widthM: obstacle.widthM + clearanceM * 2,
    depthM: obstacle.depthM + clearanceM * 2
  });
  return pointInPolygon(point, corners);
}

function usablePoint(point: Vec2, boundary: Vec2[], floor: FloorPlan) {
  return pointInPolygon(point, boundary)
    && !floor.obstacles.some((obstacle) => pointInsideObstacle(point, obstacle));
}

function doorPoint(floor: FloorPlan, wallId: string, offset: number): Vec2 | null {
  const wall = floor.walls.find((item) => item.id === wallId);
  if (!wall) return null;
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * offset,
    z: wall.a.z + (wall.b.z - wall.a.z) * offset
  };
}

function buildSamples(floor: FloorPlan, boundary: Vec2[], zones: RoomZone[]): SamplePoint[] {
  const bounds = boundsOf(boundary);
  if (!bounds) return [];
  const area = Math.max(1, polygonArea(boundary));
  const step = Math.max(0.8, Math.min(2.5, Math.sqrt(area / 180)));
  const samples: SamplePoint[] = [];
  for (let x = bounds.minX + step / 2; x < bounds.maxX; x += step) {
    for (let z = bounds.minZ + step / 2; z < bounds.maxZ; z += step) {
      const point = { x, z };
      if (!usablePoint(point, boundary, floor)) continue;
      const zone = zoneAt(zones, point);
      // A protected space contributes nothing to the score, so covering it can never be
      // what makes a placement win.
      if (zone?.forbidden) continue;
      samples.push({ point, kind: "area", baseWeight: zone?.weight ?? 1 });
    }
  }

  for (const door of floor.doors) {
    const center = doorPoint(floor, door.wallId, door.offset);
    if (!center) continue;
    const wall = floor.walls.find((item) => item.id === door.wallId)!;
    const span = Math.max(0.01, distance(wall.a, wall.b));
    const normal = { x: -(wall.b.z - wall.a.z) / span, z: (wall.b.x - wall.a.x) / span };
    for (const sign of [-1, 1]) {
      for (const inset of [0.7, 1.5]) {
        const point = { x: center.x + normal.x * inset * sign, z: center.z + normal.z * inset * sign };
        if (usablePoint(point, boundary, floor)) {
          samples.push({ point, kind: "door", baseWeight: 3 + Math.min(2, door.widthM / 2) });
        }
      }
    }
  }
  // Bound runtime for very large sites while keeping deterministic spatial distribution.
  // Requirement samples are added after the cap so a hard constraint can never be
  // thinned out just because the floor is large.
  const capped = samples.length <= 260
    ? samples
    : Array.from({ length: 260 }, (_, index) => samples[Math.floor(index * (samples.length / 260))]);

  return [...capped, ...requirementSamples(floor)];
}

/** A small grid inside each must-cover area, weighted far above ordinary ground. */
function requirementSamples(floor: FloorPlan): SamplePoint[] {
  const samples: SamplePoint[] = [];
  for (const requirement of floor.coverageRequirements ?? []) {
    const bounds = boundsOf(requirement.polygon);
    if (!bounds) continue;
    const steps = 3;
    for (let ix = 0; ix < steps; ix += 1) {
      for (let iz = 0; iz < steps; iz += 1) {
        const point = {
          x: bounds.minX + ((ix + 0.5) / steps) * (bounds.maxX - bounds.minX),
          z: bounds.minZ + ((iz + 0.5) / steps) * (bounds.maxZ - bounds.minZ)
        };
        if (!pointInPolygon(point, requirement.polygon)) continue;
        // A requirement may sit outside the traced perimeter — a rack in the yard, say —
        // so it is checked against solid obstacles but not against the boundary.
        if (floor.obstacles.some((obstacle) => obstacle.blocksView && pointInsideObstacle(point, obstacle))) continue;
        samples.push({
          point,
          kind: "requirement",
          baseWeight: REQUIREMENT_WEIGHT,
          requirementId: requirement.id
        });
      }
    }
  }
  return samples;
}

function buildCandidates(
  floor: FloorPlan,
  boundary: Vec2[],
  forbiddenAreas: Vec2[][],
  resolve: (id?: string) => SectionType | null
): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const push = (candidate: Candidate) => {
    if (!usablePoint(candidate.position, boundary, floor)) return;
    if (forbiddenAreas.some((area) => pointInPolygon(candidate.position, area))) return;
    const key = `${candidate.mounting}:${Math.round(candidate.position.x / 0.2)}:${Math.round(candidate.position.z / 0.2)}:${Math.round(candidate.yawDeg / 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  for (const wall of floor.walls) {
    const span = distance(wall.a, wall.b);
    if (span < 1) continue;
    const tangent = { x: (wall.b.x - wall.a.x) / span, z: (wall.b.z - wall.a.z) / span };
    const normal = { x: -tangent.z, z: tangent.x };
    const count = Math.max(2, Math.min(7, Math.ceil(span / 5)));
    for (let index = 0; index < count; index += 1) {
      const offset = (index + 1) / (count + 1);
      const anchor = {
        x: wall.a.x + (wall.b.x - wall.a.x) * offset,
        z: wall.a.z + (wall.b.z - wall.a.z) * offset
      };
      for (const sign of [-1, 1]) {
        const inward = { x: normal.x * sign, z: normal.z * sign };
        push({
          position: { x: anchor.x + inward.x * 0.42, z: anchor.z + inward.z * 0.42 },
          yawDeg: (Math.atan2(inward.z, inward.x) * 180) / Math.PI,
          facesDoor: false,
          mounting: "wall"
        });
      }
    }
  }

  // Room-aware candidates make the rule engine's corner/wall/ceiling/pole choice real,
  // rather than leaving it as a label in the inspector.
  for (const room of floor.rooms ?? []) {
    if (room.polygon.length < 3) continue;
    const section = resolve(room.sectionTypeId);
    const permitsPole = section?.environment === "outdoor"
      || section?.environment === "perimeter"
      || (section?.environment === "parking" && Boolean(room.manual?.openAbove));
    const centre = room.polygon.reduce(
      (sum, point) => ({ x: sum.x + point.x / room.polygon.length, z: sum.z + point.z / room.polygon.length }),
      { x: 0, z: 0 }
    );
    room.polygon.forEach((vertex, index) => {
      const dx = centre.x - vertex.x;
      const dz = centre.z - vertex.z;
      const span = Math.max(0.01, Math.hypot(dx, dz));
      const corner = { x: vertex.x + (dx / span) * 0.45, z: vertex.z + (dz / span) * 0.45 };
      push({
        position: corner,
        yawDeg: (Math.atan2(centre.z - corner.z, centre.x - corner.x) * 180) / Math.PI,
        facesDoor: false,
        mounting: "corner"
      });
      if (permitsPole) {
        push({
          position: corner,
          yawDeg: (Math.atan2(centre.z - corner.z, centre.x - corner.x) * 180) / Math.PI,
          facesDoor: false,
          mounting: "pole"
        });
      }

      const next = room.polygon[(index + 1) % room.polygon.length];
      const midpoint = { x: (vertex.x + next.x) / 2, z: (vertex.z + next.z) / 2 };
      const mx = centre.x - midpoint.x;
      const mz = centre.z - midpoint.z;
      const mspan = Math.max(0.01, Math.hypot(mx, mz));
      const wallPoint = { x: midpoint.x + (mx / mspan) * 0.42, z: midpoint.z + (mz / mspan) * 0.42 };
      push({
        position: wallPoint,
        yawDeg: (Math.atan2(centre.z - wallPoint.z, centre.x - wallPoint.x) * 180) / Math.PI,
        facesDoor: false,
        mounting: "wall"
      });
    });
    for (const yawDeg of [0, 45, 90, 135, 180, 225, 270, 315]) {
      push({ position: centre, yawDeg, facesDoor: false, mounting: "ceiling" });
    }
    push({ position: centre, yawDeg: 0, facesDoor: false, mounting: "central" });
  }

  // Purpose-built candidates look back at entrances from useful face/plate distances.
  for (const door of floor.doors) {
    const center = doorPoint(floor, door.wallId, door.offset);
    const wall = floor.walls.find((item) => item.id === door.wallId);
    if (!center || !wall) continue;
    const span = Math.max(0.01, distance(wall.a, wall.b));
    const normal = { x: -(wall.b.z - wall.a.z) / span, z: (wall.b.x - wall.a.x) / span };
    for (const sign of [-1, 1]) {
      for (const setback of [3, 5, 8]) {
        const position = {
          x: center.x + normal.x * sign * setback,
          z: center.z + normal.z * sign * setback
        };
        push({
          position,
          yawDeg: (Math.atan2(center.z - position.z, center.x - position.x) * 180) / Math.PI,
          facesDoor: true,
          mounting: "wall"
        });
      }
    }
  }

  const bounds = boundsOf(boundary);
  if (bounds) {
    for (const xRatio of [0.15, 0.325, 0.5, 0.675, 0.85]) {
      for (const zRatio of [0.15, 0.325, 0.5, 0.675, 0.85]) {
        const position = {
          x: bounds.minX + (bounds.maxX - bounds.minX) * xRatio,
          z: bounds.minZ + (bounds.maxZ - bounds.minZ) * zRatio
        };
        if (!usablePoint(position, boundary, floor)) continue;
        // Dome and turret units are normally ceiling-mounted and need directional
        // alternatives; PTZ units use the same central points with a 360° patrol.
        for (const yawDeg of [0, 45, 90, 135, 180, 225, 270, 315]) {
          push({ position, yawDeg, facesDoor: false, mounting: "ceiling" });
        }
        push({ position, yawDeg: 0, facesDoor: false, mounting: "central" });
      }
    }
  }

  if (candidates.length <= 180) return candidates;
  const takeEvenly = (items: Candidate[], limit: number) => {
    if (items.length <= limit) return items;
    const stride = items.length / limit;
    return Array.from({ length: limit }, (_, index) => items[Math.floor(index * stride)]);
  };
  return [
    ...takeEvenly(candidates.filter((candidate) => candidate.mounting === "wall" || candidate.mounting === "corner" || candidate.mounting === "pole"), 110),
    ...takeEvenly(candidates.filter((candidate) => candidate.mounting === "ceiling"), 72),
    ...candidates.filter((candidate) => candidate.mounting === "central")
  ];
}

function cameraFromDefinition(
  definition: PlanCameraDefinition,
  floorId: string,
  candidate: Candidate
): PlanCamera {
  return {
    id: `cam-smart-${definition.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${floorId}`,
    definitionId: definition.id,
    zoneId: definition.zoneId,
    groupName: definition.groupName,
    roomId: definition.roomId,
    requirementId: definition.requirementId,
    sectionTypeId: definition.sectionTypeId,
    mountKind: definition.mountKind,
    placementReasons: definition.placementReasons ? [...definition.placementReasons] : undefined,
    requiredFeatures: definition.requiredFeatures ? [...definition.requiredFeatures] : undefined,
    name: definition.name,
    housing: definition.housing,
    outdoor: definition.outdoor,
    features: { ...definition.features },
    position: { ...candidate.position },
    yawDeg: candidate.yawDeg,
    goal: definition.goal,
    optics: { ...definition.optics }
  };
}

/** Keeps the final device below its actual supporting wall, not merely the floor default. */
function constrainMountHeight(camera: PlanCamera, floor: FloorPlan): void {
  camera.optics.mountHeightM = constrainCameraMountHeight(
    floor,
    camera.position,
    camera.optics.mountHeightM,
    camera.mountKind
  );
}

function sampleWeight(sample: SamplePoint, goal: SurveillanceTask) {
  // A must-cover area is worth the same to every device type: the user asked for it to
  // be seen, not for it to be seen by a particular kind of camera.
  if (sample.kind === "requirement") return sample.baseWeight;
  if (sample.kind === "area") {
    return sample.baseWeight * (goal === "monitor" ? 1 : goal === "face-capture" ? 0.65 : 0.35);
  }
  if (goal === "anpr" || goal === "plate-capture") return sample.baseWeight * 4.5;
  if (goal === "face-identify") return sample.baseWeight * 4;
  if (goal === "face-capture") return sample.baseWeight * 3;
  return sample.baseWeight * 1.4;
}

function ppmForCoverage(camera: PlanCamera, polygon: Vec2[], horizontalPixels: number, fovDeg: number, point: Vec2) {
  if (polygon.length < 3 || !pointInPolygon(point, polygon)) return 0;
  return ppmAtDistance(horizontalPixels, fovDeg, Math.max(0.5, distance(camera.position, point)));
}

function verticalGeometryFactor(camera: PlanCamera, point: Vec2) {
  const horizontalDistanceM = Math.max(0.5, distance(camera.position, point));
  const heightDeltaM = Math.max(0, camera.optics.mountHeightM - taskTargetHeightM[camera.goal]);
  const idealTiltDeg = (Math.atan2(heightDeltaM, horizontalDistanceM) * 180) / Math.PI;
  const errorDeg = Math.abs(camera.optics.tiltDeg - idealTiltDeg);
  if (errorDeg <= 7) return 1;
  if (errorDeg <= 18) return 1 - ((errorDeg - 7) / 11) * 0.55;
  if (errorDeg <= 30) return 0.45 - ((errorDeg - 18) / 12) * 0.3;
  return 0.08;
}

function weightedCoveredPercent(contexts: FloorContext[], useInitial: boolean) {
  let coveredWeight = 0;
  let totalWeight = 0;
  for (const context of contexts) {
    const values = useInitial ? context.initialPpm : context.currentPpm;
    context.samples.forEach((sample, index) => {
      totalWeight += sample.baseWeight;
      if (values[index] >= 25) coveredWeight += sample.baseWeight;
    });
  }
  return totalWeight ? (coveredWeight / totalWeight) * 100 : 0;
}

function contextForFloor(
  floor: FloorPlan,
  resolve: (id?: string) => SectionType | null
): FloorContext | null {
  const normalisedFloor = withRoomRequirements(floor);
  const semanticPoints = (normalisedFloor.rooms ?? []).flatMap((room) => room.polygon);
  const closedBoundary = largestClosedWallLoop(normalisedFloor.walls);
  const boundaryPoints = [...(closedBoundary ?? []), ...semanticPoints];
  const boundary = boundaryPoints.length >= 3 ? convexHull(boundaryPoints) : null;
  if (!boundary || boundary.length < 3) return null;
  const zones = roomZones(normalisedFloor, resolve);
  const forbiddenAreas = zones.filter((zone) => zone.forbidden).map((zone) => zone.polygon);
  const samples = buildSamples(normalisedFloor, boundary, zones);
  const candidates = buildCandidates(normalisedFloor, boundary, forbiddenAreas, resolve);
  if (!samples.length || !candidates.length) return null;
  const occluders = collectOccluders(normalisedFloor.walls, normalisedFloor.obstacles, normalisedFloor.doors);
  const existingCoverages = normalisedFloor.cameras.map((camera) => ({
    camera,
    coverage: computeCameraCoverage(camera, occluders, 28)
  }));
  const currentPpm = samples.map((sample) => {
    let best = 0;
    for (const { camera, coverage } of existingCoverages) {
      best = Math.max(best, ppmForCoverage(camera, coverage.polygon, coverage.horizontalPixels, coverage.fovDeg, sample.point));
    }
    return best;
  });
  return { floor: normalisedFloor, boundary, samples, candidates, currentPpm, initialPpm: [...currentPpm], forbiddenAreas };
}

/**
 * Which must-cover areas the finished layout actually satisfies.
 *
 * An area counts as covered only when every sampled point inside it clears the detection
 * threshold — partial coverage of a constraint is not coverage, and reporting it as such
 * is exactly the failure the constraint exists to prevent.
 */
function auditRequirements(context: FloorContext): Map<string, boolean> {
  const results = new Map<string, boolean>();
  context.samples.forEach((sample, index) => {
    if (!sample.requirementId) return;
    const covered = context.currentPpm[index] >= 25;
    results.set(sample.requirementId, (results.get(sample.requirementId) ?? true) && covered);
  });
  return results;
}

/**
 * Greedy coverage optimiser over all valid floors.
 *
 * Specialist cameras are assigned first, then general monitoring cameras fill the
 * remaining blind cells. Every candidate is ray-cast against walls and blocking
 * obstacles and evaluated at the task's PPM threshold. Existing cameras are immutable.
 */
export function optimiseCameraPlacement(
  plan: BuildingPlan,
  definitions: PlanCameraDefinition[] = [],
  options: { enforceSemanticValidation?: boolean } = {}
): SmartPlacementResult {
  const validationErrors = options.enforceSemanticValidation ? validateSmartPlacementPlan(plan) : [];
  if (validationErrors.length) {
    return {
      plan,
      report: {
        accepted: false,
        placed: 0,
        requested: 0,
        coverageBeforePercent: 0,
        coverageAfterPercent: 0,
        floorReports: [],
        unmetRequirements: [],
        validationErrors,
        warnings: validationErrors
      }
    };
  }
  const placedIds = new Set(
    plan.floors.flatMap((floor) =>
      floor.cameras.map((camera) => camera.definitionId).filter((id): id is string => Boolean(id))
    )
  );
  const generated = definitionsFromRooms(plan);
  const generatedIds = new Set(generated.map((definition) => definition.id));
  const allDefinitions = [
    ...generated,
    ...definitions.filter((definition) => !generatedIds.has(definition.id))
  ];
  const unplaced = allDefinitions
    .filter((definition) => !placedIds.has(definition.id))
    .sort((first, second) => taskPpm[second.goal] - taskPpm[first.goal]);
  // Custom section types live on the project, so the resolver has to be built here
  // rather than imported: a user-defined "no camera" space must be honoured too.
  const custom = (plan.customSectionTypes ?? []) as unknown as SectionType[];
  const resolve = (id?: string) => findSectionType(id, custom);
  const contexts = plan.floors
    .map((floor) => contextForFloor(floor, resolve))
    .filter((context): context is FloorContext => Boolean(context));
  const before = weightedCoveredPercent(contexts, true);
  const additions = new Map<string, PlanCamera[]>();
  const warnings: string[] = [];

  for (const definition of unplaced) {
    let best: {
      context: FloorContext;
      candidate: Candidate;
      camera: PlanCamera;
      ppm: number[];
      score: number;
    } | null = null;

    for (const context of contexts) {
      const occluders = collectOccluders(context.floor.walls, context.floor.obstacles, context.floor.doors);
      const floorCameraCount = context.floor.cameras.length + (additions.get(context.floor.id)?.length ?? 0);
      const targetRoom = definition.roomId
        ? (context.floor.rooms ?? []).find((room) => room.id === definition.roomId)
        : null;
      const targetRequirement = definition.requirementId
        ? (context.floor.coverageRequirements ?? []).find((requirement) => requirement.id === definition.requirementId)
        : null;
      if (definition.roomId && !targetRoom) continue;
      if (definition.requirementId && !targetRequirement) continue;
      for (const candidate of context.candidates) {
        if (targetRoom && !pointInPolygon(candidate.position, targetRoom.polygon)) continue;
        const candidateMount: MountKind = candidate.mounting === "wall"
          ? "wall-edge"
          : candidate.mounting === "central"
            ? "ceiling"
            : candidate.mounting;
        const mountOrder = definition.mountKind
          ? [definition.mountKind, ...(definition.mountFallbacks ?? [])]
          : [];
        const mountIndex = mountOrder.indexOf(candidateMount);
        const compatibleMount = targetRoom || targetRequirement
          ? mountIndex >= 0
          : definition.housing === "bullet"
            ? candidate.mounting === "wall" || candidate.mounting === "corner" || candidate.mounting === "pole"
            : definition.housing === "dome"
              ? candidate.mounting === "ceiling"
              : definition.housing === "ptz"
                ? candidate.mounting === "central"
                : candidate.mounting !== "central" && candidate.mounting !== "pole";
        if (!compatibleMount) continue;
        const camera = cameraFromDefinition(definition, context.floor.id, candidate);
        camera.mountKind = candidateMount;
        constrainMountHeight(camera, context.floor);
        const tooClose = [
          ...context.floor.cameras,
          ...(additions.get(context.floor.id) ?? [])
        ].some((existing) => distance(existing.position, camera.position) < 1.5);
        if (tooClose) continue;

        const coverage = computeCameraCoverage(camera, occluders, 28);
        const ppm = context.samples.map((sample) =>
          ppmForCoverage(camera, coverage.polygon, coverage.horizontalPixels, coverage.fovDeg, sample.point)
        );
        const threshold = taskPpm[definition.goal];
        let score = 0;
        for (let index = 0; index < context.samples.length; index += 1) {
          if (ppm[index] < 25) continue;
          const sample = context.samples[index];
          if (targetRoom && sample.kind !== "requirement" && !pointInPolygon(sample.point, targetRoom.polygon)) continue;
          if (targetRequirement && sample.requirementId !== targetRequirement.id) continue;
          const quality = Math.min(1.4, ppm[index] / threshold);
          const isBlindAtTaskLevel = context.currentPpm[index] < threshold;
          const novelty = isBlindAtTaskLevel ? 1 : 0.09;
          const verticalFit = verticalGeometryFactor(camera, sample.point);
          score += sampleWeight(sample, definition.goal) * quality * novelty * verticalFit;
        }
        if (targetRoom || targetRequirement) score *= Math.max(0.55, 1 - mountIndex * 0.16);
        if (candidate.facesDoor && definition.goal !== "monitor") score *= 1.18;
        if (definition.housing === "dome" && candidate.mounting === "ceiling") score *= 1.08;
        if (definition.housing === "ptz" && candidate.mounting === "central") {
          // Patrol coverage is sequential, not simultaneous, so it must not crowd out
          // fixed cameras solely because its potential polygon is wider.
          score *= 0.62;
        }
        // A small fairness term prevents a large ground floor from starving every
        // upper storey when enough cameras exist to cover both.
        score *= 1 + 0.12 / (floorCameraCount + 1);
        if (!best || score > best.score) best = { context, candidate, camera, ppm, score };
      }
    }

    if (!best || best.score <= 0) {
      warnings.push(`برای «${definition.name}» نقطه‌ای با دید معتبر پیدا نشد.`);
      continue;
    }
    const selected = best;
    additions.set(selected.context.floor.id, [...(additions.get(selected.context.floor.id) ?? []), selected.camera]);
    selected.context.currentPpm = selected.context.currentPpm.map((value, index) => Math.max(value, selected.ppm[index]));
  }

  // Audit the hard constraints before reporting, and write the verdict back onto the
  // areas so the plan itself carries whether each one ended up satisfied.
  const requirementVerdicts = new Map<string, boolean>();
  for (const context of contexts) {
    for (const [id, satisfied] of auditRequirements(context)) requirementVerdicts.set(id, satisfied);
  }
  const unmetRequirements: string[] = [];

  const nextFloors = plan.floors.map((floor) => {
    const contextFloor = contexts.find((context) => context.floor.id === floor.id)?.floor ?? withRoomRequirements(floor);
    return {
      ...contextFloor,
      cameras: [...floor.cameras, ...(additions.get(floor.id) ?? [])],
      coverageRequirements: (contextFloor.coverageRequirements ?? []).map((requirement) => {
        const satisfied = requirementVerdicts.get(requirement.id);
        if (satisfied === false) unmetRequirements.push(requirement.label);
        return satisfied === undefined ? requirement : { ...requirement, satisfied };
      })
    };
  });
  const after = weightedCoveredPercent(contexts, false);
  const floorReports = contexts.map((context) => {
    const totalWeight = context.samples.reduce((sum, sample) => sum + sample.baseWeight, 0);
    const percent = (values: number[]) => totalWeight
      ? 100 * context.samples.reduce((sum, sample, index) => sum + (values[index] >= 25 ? sample.baseWeight : 0), 0) / totalWeight
      : 0;
    return {
      floorId: context.floor.id,
      floorName: context.floor.name,
      placed: additions.get(context.floor.id)?.length ?? 0,
      coverageBeforePercent: percent(context.initialPpm),
      coverageAfterPercent: percent(context.currentPpm)
    };
  });

  if (!contexts.length) warnings.push("هیچ طبقه‌ای با محیط بسته و قابل تحلیل پیدا نشد.");
  const proposedPlaced = [...additions.values()].reduce((sum, cameras) => sum + cameras.length, 0);
  const hasSpecialistCamera = unplaced.some((definition) =>
    definition.goal === "anpr"
    || definition.goal === "plate-capture"
    || definition.goal === "face-identify"
    || definition.goal === "face-capture"
  );
  const hasAnnotatedDoor = contexts.some((context) => context.floor.doors.length > 0);
  if (hasSpecialistCamera && !hasAnnotatedDoor) {
    warnings.push("برای دقت بیشتر دوربین‌های چهره یا پلاک، ابتدا ورودی‌ها و دروازه‌ها را روی نقشه تعریف کنید.");
  }
  if (unmetRequirements.length) {
    warnings.push(
      `این نواحی اجباری پوشش داده نشدند: ${unmetRequirements.join("، ")}. دوربین بیشتری اضافه کنید یا محل ناحیه را بازبینی کنید.`
    );
  }
  if (proposedPlaced > 0 && after < 70) {
    warnings.push(`پوشش برآوردی ${Math.round(after)}٪ است؛ نقاط کور باقی‌مانده را در لایه DORI بازبینی کنید.`);
  }
  if ([...additions.values()].some((cameras) => cameras.some((camera) => camera.housing === "ptz"))) {
    warnings.push("پوشش PTZ بالقوه و مبتنی بر گشت است؛ برای نقاط حیاتی از دوربین ثابت پشتیبان استفاده کنید.");
  }
  const accepted = contexts.length > 0 && unmetRequirements.length === 0;
  const rejectedFloors = nextFloors.map((nextFloor) => {
    const original = plan.floors.find((floor) => floor.id === nextFloor.id)!;
    return { ...nextFloor, cameras: original.cameras };
  });
  return {
    plan: { ...plan, floors: accepted ? nextFloors : rejectedFloors },
    report: {
      accepted,
      placed: accepted ? proposedPlaced : 0,
      requested: unplaced.length,
      coverageBeforePercent: before,
      coverageAfterPercent: accepted ? after : before,
      floorReports: accepted ? floorReports : floorReports.map((floor) => ({ ...floor, placed: 0, coverageAfterPercent: floor.coverageBeforePercent })),
      unmetRequirements,
      validationErrors,
      warnings
    }
  };
}
