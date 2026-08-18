import type { SurveillanceTask } from "@/src/domain/catalog/types";
import type {
  BuildingPlan,
  FloorPlan,
  PlanCamera,
  PlanCameraDefinition,
  PlanObstacle,
  Vec2
} from "@/src/domain/planner/types";
import { findSectionType, type SectionType } from "@/src/domain/planner/venues";
import { computeCameraCoverage, ppmAtDistance } from "@/src/lib/planner/coverage";
import {
  boundsOf,
  collectOccluders,
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
  mounting: "wall" | "ceiling" | "central";
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
  placed: number;
  requested: number;
  coverageBeforePercent: number;
  coverageAfterPercent: number;
  floorReports: SmartPlacementFloorReport[];
  /** Must-cover areas the solution failed to satisfy, named so they can be found. */
  unmetRequirements: string[];
  warnings: string[];
};

export type SmartPlacementResult = {
  plan: BuildingPlan;
  report: SmartPlacementReport;
};

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

type RoomZone = { polygon: Vec2[]; weight: number; forbidden: boolean; areaM2: number };

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

function buildCandidates(floor: FloorPlan, boundary: Vec2[], forbiddenAreas: Vec2[][]): Candidate[] {
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
    ...takeEvenly(candidates.filter((candidate) => candidate.mounting === "wall"), 90),
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
    name: definition.name,
    housing: definition.housing,
    features: { ...definition.features },
    position: { ...candidate.position },
    yawDeg: candidate.yawDeg,
    goal: definition.goal,
    optics: { ...definition.optics }
  };
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
  const boundary = largestClosedWallLoop(floor.walls);
  if (!boundary) return null;
  const zones = roomZones(floor, resolve);
  const forbiddenAreas = zones.filter((zone) => zone.forbidden).map((zone) => zone.polygon);
  const samples = buildSamples(floor, boundary, zones);
  const candidates = buildCandidates(floor, boundary, forbiddenAreas);
  if (!samples.length || !candidates.length) return null;
  const occluders = collectOccluders(floor.walls, floor.obstacles, floor.doors);
  const existingCoverages = floor.cameras.map((camera) => ({
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
  return { floor, boundary, samples, candidates, currentPpm, initialPpm: [...currentPpm], forbiddenAreas };
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
  definitions: PlanCameraDefinition[]
): SmartPlacementResult {
  const placedIds = new Set(
    plan.floors.flatMap((floor) =>
      floor.cameras.map((camera) => camera.definitionId).filter((id): id is string => Boolean(id))
    )
  );
  const unplaced = definitions
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
      for (const candidate of context.candidates) {
        const compatibleMount = definition.housing === "bullet"
          ? candidate.mounting === "wall"
          : definition.housing === "dome"
            ? candidate.mounting === "ceiling"
            : definition.housing === "ptz"
              ? candidate.mounting === "central"
              : candidate.mounting !== "central";
        if (!compatibleMount) continue;
        const camera = cameraFromDefinition(definition, context.floor.id, candidate);
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
          const quality = Math.min(1.4, ppm[index] / threshold);
          const isBlindAtTaskLevel = context.currentPpm[index] < threshold;
          const novelty = isBlindAtTaskLevel ? 1 : 0.09;
          const verticalFit = verticalGeometryFactor(camera, sample.point);
          score += sampleWeight(sample, definition.goal) * quality * novelty * verticalFit;
        }
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

  const nextFloors = plan.floors.map((floor) => ({
    ...floor,
    cameras: [...floor.cameras, ...(additions.get(floor.id) ?? [])],
    coverageRequirements: (floor.coverageRequirements ?? []).map((requirement) => {
      const satisfied = requirementVerdicts.get(requirement.id);
      if (satisfied === false) unmetRequirements.push(requirement.label);
      return satisfied === undefined ? requirement : { ...requirement, satisfied };
    })
  }));
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
  const placed = [...additions.values()].reduce((sum, cameras) => sum + cameras.length, 0);
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
  if (placed > 0 && after < 70) {
    warnings.push(`پوشش برآوردی ${Math.round(after)}٪ است؛ نقاط کور باقی‌مانده را در لایه DORI بازبینی کنید.`);
  }
  if ([...additions.values()].some((cameras) => cameras.some((camera) => camera.housing === "ptz"))) {
    warnings.push("پوشش PTZ بالقوه و مبتنی بر گشت است؛ برای نقاط حیاتی از دوربین ثابت پشتیبان استفاده کنید.");
  }
  return {
    plan: { ...plan, floors: nextFloors },
    report: {
      placed,
      requested: unplaced.length,
      coverageBeforePercent: before,
      coverageAfterPercent: after,
      floorReports,
      unmetRequirements,
      warnings
    }
  };
}
