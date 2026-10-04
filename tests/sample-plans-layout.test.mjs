import assert from "node:assert/strict";
import test from "node:test";

import { sectionsForVenue } from "@/src/domain/planner/venues.ts";
import { createSamplePlan, sampleVenueTypeIds } from "@/src/lib/planner/sample-plans.ts";

/*
 * Every sample plan (apart from the two very large malls, which are generated in bulk)
 * must open as a plan a designer would accept: the venue checklist ticked by real rooms or
 * hand-placed areas, and furniture standing against walls, facing into its room and out of
 * walls, of each other and of doorways.
 */
const samples = Object.keys(sampleVenueTypeIds).filter((id) => id !== "kourosh-mall" && id !== "mega-mall");

/** Multi-part models that are drawn as overlapping pieces of one object. */
const assemblies = [
  /^construction-crane-/, /^airport-aircraft-/, /^mine-pit-/, /^transmission-tower-(?:mast|arm)-(\d+)$/
];
function sameAssembly(first, second) {
  return assemblies.some((pattern) => {
    const a = first.id.match(pattern);
    const b = second.id.match(pattern);
    return Boolean(a && b && (a[1] ?? "") === (b[1] ?? ""));
  });
}

const rad = (deg) => (deg * Math.PI) / 180;
/** Presets face +z at 0° and turn clockwise in plan. */
const front = (o) => ({ x: -Math.sin(rad(o.rotationDeg)), z: Math.cos(rad(o.rotationDeg)) });

function corners(o, shrink = 0) {
  const c = Math.cos(rad(o.rotationDeg));
  const s = Math.sin(rad(o.rotationDeg));
  const hw = Math.max(0.01, o.widthM / 2 - shrink);
  const hd = Math.max(0.01, o.depthM / 2 - shrink);
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => ({
    x: o.center.x + lx * c - lz * s,
    z: o.center.z + lx * s + lz * c
  }));
}

function band(a, b, thickness) {
  const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const nx = (-(b.z - a.z) / length) * (thickness / 2);
  const nz = ((b.x - a.x) / length) * (thickness / 2);
  return [{ x: a.x + nx, z: a.z + nz }, { x: b.x + nx, z: b.z + nz }, { x: b.x - nx, z: b.z - nz }, { x: a.x - nx, z: a.z - nz }];
}

function overlaps(first, second) {
  for (const polygon of [first, second]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const p = polygon[index];
      const q = polygon[(index + 1) % polygon.length];
      const axis = { x: -(q.z - p.z), z: q.x - p.x };
      const project = (points) => points.map((point) => point.x * axis.x + point.z * axis.z);
      const a = project(first);
      const b = project(second);
      if (Math.max(...a) <= Math.min(...b) + 1e-6 || Math.max(...b) <= Math.min(...a) + 1e-6) return false;
    }
  }
  return true;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

function crosses(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.z - p3.z) - (p2.z - p1.z) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-12) return false;
  const u = ((p3.x - p1.x) * (p4.z - p3.z) - (p3.z - p1.z) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.z - p1.z) - (p3.z - p1.z) * (p2.x - p1.x)) / d;
  return u > 1e-6 && u < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6;
}

/** Each wall minus its openings; windows still count as wall below the sill. */
function solidSegments(floor) {
  const segments = [];
  for (const wall of floor.walls) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
    const at = (t) => ({ x: wall.a.x + (wall.b.x - wall.a.x) * t, z: wall.a.z + (wall.b.z - wall.a.z) * t });
    const gaps = floor.doors
      .filter((opening) => opening.wallId === wall.id)
      .map((opening) => [opening.offset - opening.widthM / 2 / length, opening.offset + opening.widthM / 2 / length, opening.type === "window"])
      .sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    for (const [start, end, isWindow] of gaps) {
      if (start > cursor) segments.push({ wall, a: at(cursor), b: at(start), opening: false });
      if (isWindow) segments.push({ wall, a: at(start), b: at(end), opening: true });
      cursor = Math.max(cursor, end);
    }
    if (cursor < 1) segments.push({ wall, a: at(cursor), b: at(1), opening: false });
  }
  return segments;
}

const wallBacked = new Set([
  "wardrobe", "bookshelf", "filing-cabinet", "dresser", "fridge", "stove", "dishwasher", "display-fridge",
  "kitchen-counter", "sink-unit", "tv-unit", "tool-cabinet", "locker-row", "vending-machine", "bed-double",
  "bed-single", "nightstand", "monitoring-console", "whiteboard", "library-shelf"
]);
const isFlat = (o) => o.kind === "surface";
const thicknessOf = (wall) => wall.thicknessM ?? 0.2;

test("every sample ticks each critical and important checklist item in place", () => {
  assert.ok(samples.length >= 47, `expected every sample except the two large malls, got ${samples.length}`);
  for (const id of samples) {
    const plan = createSamplePlan(id);
    assert.deepEqual(plan.dismissedSectionIds ?? [], [], `${id} should not dismiss programme items`);
    const required = sectionsForVenue(plan.venueTypeId).filter((section) => section.priority !== "optional");
    for (const section of required) {
      const room = plan.floors.some((floor) => (floor.rooms ?? []).some((item) => item.sectionTypeId === section.id));
      const area = plan.floors.some((floor) => (floor.coverageRequirements ?? []).some((item) => item.sectionTypeId === section.id));
      assert.ok(room || area, `${id}: "${section.label}" is not ticked by a room or an area`);
    }
    const synthetic = plan.floors.flatMap((floor) => floor.coverageRequirements ?? []).filter((item) => item.id.includes("-sample-checklist-"));
    assert.deepEqual(synthetic.map((item) => item.label), [], `${id} relies on auto-placed checklist squares`);
  }
});

test("every sample places wall furniture against a wall, facing the room", () => {
  for (const id of samples) {
    for (const floor of createSamplePlan(id).floors) {
      const solids = solidSegments(floor);
      const gap = (point) => Math.min(...solids.map((segment) => distanceToSegment(point, segment.a, segment.b) - thicknessOf(segment.wall) / 2));
      for (const item of floor.obstacles.filter((obstacle) => wallBacked.has(obstacle.variant))) {
        const direction = front(item);
        const half = item.depthM / 2;
        const back = { x: item.center.x - direction.x * half, z: item.center.z - direction.z * half };
        const face = { x: item.center.x + direction.x * half, z: item.center.z + direction.z * half };
        const label = `${id}/${floor.id}: ${item.id}`;
        assert.ok(gap(back) <= 0.3, `${label} should stand with its back on a wall`);
        const reach = { x: item.center.x + direction.x * (half + 0.45), z: item.center.z + direction.z * (half + 0.45) };
        assert.ok(!solids.some((segment) => !segment.opening && crosses(item.center, reach, segment.a, segment.b)), `${label} faces into a wall`);
        assert.ok(!(gap(face) < 1.2 && gap(back) > gap(face) + 0.2), `${label} is turned towards the nearest wall`);
      }
    }
  }
});

test("every sample keeps objects out of walls, each other and doorways", () => {
  for (const id of samples) {
    for (const floor of createSamplePlan(id).floors) {
      const solids = solidSegments(floor);
      const solid = floor.obstacles.filter((item) => !isFlat(item));
      for (const item of solid) {
        if (item.kind === "fence" || item.kind === "gate" || item.variant === "hedge") continue;
        const hit = solids.find((segment) => overlaps(corners(item, 0.03), band(segment.a, segment.b, thicknessOf(segment.wall))));
        assert.equal(hit, undefined, `${id}/${floor.id}: ${item.id} passes through ${hit?.wall.id}`);
      }
      for (let i = 0; i < solid.length; i += 1) {
        for (let j = i + 1; j < solid.length; j += 1) {
          if ((solid[i].kind === "fence" && solid[j].kind === "fence") || sameAssembly(solid[i], solid[j])) continue;
          assert.ok(!overlaps(corners(solid[i], 0.03), corners(solid[j], 0.03)), `${id}/${floor.id}: ${solid[i].id} overlaps ${solid[j].id}`);
        }
      }
      for (const opening of floor.doors.filter((item) => item.type !== "window")) {
        const wall = floor.walls.find((item) => item.id === opening.wallId);
        assert.ok(wall, `${id}: ${opening.id} has no wall`);
        const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
        const ux = (wall.b.x - wall.a.x) / length;
        const uz = (wall.b.z - wall.a.z) / length;
        const centre = { x: wall.a.x + (wall.b.x - wall.a.x) * opening.offset, z: wall.a.z + (wall.b.z - wall.a.z) * opening.offset };
        const hw = opening.widthM / 2;
        const depth = Math.min(1, opening.widthM);
        const swing = [
          { x: centre.x - ux * hw - uz * depth, z: centre.z - uz * hw + ux * depth },
          { x: centre.x + ux * hw - uz * depth, z: centre.z + uz * hw + ux * depth },
          { x: centre.x + ux * hw + uz * depth, z: centre.z + uz * hw - ux * depth },
          { x: centre.x - ux * hw + uz * depth, z: centre.z - uz * hw - ux * depth }
        ];
        const blocker = solid.find((item) => item.kind !== "gate" && item.variant !== "queue-barrier" && item.variant !== "loading-platform"
          && overlaps(swing, corners(item, 0.03)));
        assert.equal(blocker, undefined, `${id}/${floor.id}: ${blocker?.id} blocks ${opening.id}`);
      }
      for (const opening of floor.doors) {
        const wall = floor.walls.find((item) => item.id === opening.wallId);
        const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
        const half = opening.widthM / 2 / length;
        const a = { x: wall.a.x + (wall.b.x - wall.a.x) * (opening.offset - half), z: wall.a.z + (wall.b.z - wall.a.z) * (opening.offset - half) };
        const b = { x: wall.a.x + (wall.b.x - wall.a.x) * (opening.offset + half), z: wall.a.z + (wall.b.z - wall.a.z) * (opening.offset + half) };
        const junction = floor.walls.find((other) => other.id !== wall.id
          && [other.a, other.b].some((point) => distanceToSegment(point, a, b) < thicknessOf(wall) / 2 + 0.05));
        assert.equal(junction, undefined, `${id}/${floor.id}: ${opening.id} straddles ${junction?.id}`);
      }
    }
  }
});
