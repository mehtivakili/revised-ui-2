import { createSamplePlan, sampleVenueTypeIds } from "@/src/lib/planner/sample-plans";
import { pointInPolygon } from "@/src/lib/planner/geometry";

const ids = Object.keys(sampleVenueTypeIds);
const ignored = new Set(["surface", "road", "grass", "rug", "speed-bump", "wheel-stop", "loading-platform"]);

function bounds(item) {
  const turn = Math.abs(item.rotationDeg % 180) === 90;
  const width = turn ? item.depthM : item.widthM;
  const depth = turn ? item.widthM : item.depthM;
  return { left: item.center.x - width / 2, right: item.center.x + width / 2, top: item.center.z - depth / 2, bottom: item.center.z + depth / 2 };
}

function pointSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq)) : 0;
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

const findings = [];
for (const id of ids) {
  const plan = createSamplePlan(id);
  for (const floor of plan.floors) {
    const rooms = floor.rooms ?? [];
    for (const item of floor.obstacles) {
      if (ignored.has(item.kind) || ignored.has(item.variant)) continue;
      const box = bounds(item);
      const corners = [
        { x: box.left, z: box.top }, { x: box.right, z: box.top },
        { x: box.right, z: box.bottom }, { x: box.left, z: box.bottom }
      ];
      const containing = rooms.filter((room) => pointInPolygon(item.center, room.polygon));
      if (containing.length && !corners.every((point) => containing.some((room) => pointInPolygon(point, room.polygon)))) {
        findings.push([id, floor.id, "PARTLY_OUTSIDE_ROOM", item.id, item.variant, item.center]);
      }
      if (!containing.length && !["vehicle", "landscape", "site", "tree"].includes(item.kind)) {
        findings.push([id, floor.id, "OUTSIDE_ALL_ROOMS", item.id, item.variant, item.center]);
      }
      for (const wall of floor.walls) {
        const clearance = Math.min(item.widthM, item.depthM) / 2 + wall.thicknessM / 2 - 0.08;
        if (pointSegmentDistance(item.center, wall.a, wall.b) < clearance) {
          findings.push([id, floor.id, "CROSSES_WALL", item.id, item.variant, wall.id]);
          break;
        }
      }
    }
    for (const opening of floor.doors.filter((door) => door.type !== "window")) {
      const wall = floor.walls.find((item) => item.id === opening.wallId);
      if (!wall) continue;
      const x = wall.a.x + (wall.b.x - wall.a.x) * opening.offset;
      const z = wall.a.z + (wall.b.z - wall.a.z) * opening.offset;
      const dx = wall.b.x - wall.a.x;
      const dz = wall.b.z - wall.a.z;
      const length = Math.hypot(dx, dz);
      const tx = dx / length;
      const tz = dz / length;
      const nx = -tz;
      const nz = tx;
      for (const item of floor.obstacles) {
        if (ignored.has(item.kind) || ignored.has(item.variant) || ["landscape", "site", "tree"].includes(item.kind)) continue;
        const along = Math.abs((item.center.x - x) * tx + (item.center.z - z) * tz);
        const normal = Math.abs((item.center.x - x) * nx + (item.center.z - z) * nz);
        const box = bounds(item);
        const radius = Math.max(box.right - box.left, box.bottom - box.top) / 2;
        if (along < opening.widthM / 2 + radius * 0.55 && normal < 1.15 + radius * 0.55) {
          findings.push([id, floor.id, "BLOCKS_DOOR", opening.id, item.id, item.variant]);
        }
      }
    }
  }
}

const focused = findings.filter((finding) => {
  return finding[0] !== "kourosh-mall" && finding[0] !== "mega-mall"
    && finding[2] === "CROSSES_WALL";
});
for (const finding of focused) console.log(JSON.stringify(finding));
console.log(`FOCUSED ${focused.length} / TOTAL ${findings.length}`);
