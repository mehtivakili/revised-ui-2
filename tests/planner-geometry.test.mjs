import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { castRay, convexHull, floorAreaM2, polygonArea, pointInPolygon, traceWallLoop } from "@/src/lib/planner/geometry";
import { cameraFovDeg, computeCameraCoverage, ppmAtDistance } from "@/src/lib/planner/coverage";
import { defaultCameraOptics, duplicateFloor, createFloor } from "@/src/domain/planner/types";

const wall = (id, ax, az, bx, bz, heightM = 3) => ({
  id, a: { x: ax, z: az }, b: { x: bx, z: bz }, heightM, thicknessM: 0.2, blocksView: true
});

/** 10 × 6 metre room. */
const room = [wall("w1", 0, 0, 10, 0), wall("w2", 10, 0, 10, 6), wall("w3", 10, 6, 0, 6), wall("w4", 0, 6, 0, 0)];

describe("plan geometry", () => {
  test("polygon area uses the shoelace formula", () => {
    assert.equal(polygonArea([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }]), 12);
  });

  test("a closed wall ring is traced and measured", () => {
    const loop = traceWallLoop(room);
    assert.ok(loop, "walls should close into a loop");
    assert.equal(polygonArea(loop), 60);
    assert.equal(floorAreaM2(room), 60);
  });

  test("open walls fall back to the hull instead of reporting zero", () => {
    const open = room.slice(0, 3);
    assert.ok(floorAreaM2(open) > 0, "a partial drawing should still report an area");
  });

  test("convex hull drops interior points", () => {
    const hull = convexHull([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }, { x: 2, z: 2 }]);
    assert.equal(hull.length, 4);
  });

  test("point in polygon respects the boundary", () => {
    const square = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }];
    assert.equal(pointInPolygon({ x: 2, z: 2 }, square), true);
    assert.equal(pointInPolygon({ x: 5, z: 2 }, square), false);
  });
});

describe("ray casting", () => {
  const segments = [{ a: { x: 5, z: -5 }, b: { x: 5, z: 5 }, heightM: 3 }];

  test("a wall stops the ray at its true distance", () => {
    const reach = castRay({ x: 0, z: 0 }, 0, 20, segments);
    assert.ok(Math.abs(reach - 5) < 1e-6, `expected 5 m, got ${reach}`);
  });

  test("a ray pointing away is unobstructed", () => {
    assert.equal(castRay({ x: 0, z: 0 }, Math.PI, 20, segments), 20);
  });

  test("low obstacles are seen over, not treated as walls", () => {
    const counter = [{ a: { x: 5, z: -5 }, b: { x: 5, z: 5 }, heightM: 0.9 }];
    // Lens at 3 m looking down to 1.7 m at 20 m: the sight line is well above 0.9 m at 5 m.
    const sightHeightAt = (d) => 3 + (1.7 - 3) * Math.min(1, d / 20);
    assert.equal(castRay({ x: 0, z: 0 }, 0, 20, counter, sightHeightAt), 20);
  });

  test("tall obstacles still block", () => {
    const pillar = [{ a: { x: 5, z: -5 }, b: { x: 5, z: 5 }, heightM: 2.9 }];
    const sightHeightAt = (d) => 3 + (1.7 - 3) * Math.min(1, d / 20);
    assert.ok(castRay({ x: 0, z: 0 }, 0, 20, pillar, sightHeightAt) < 6);
  });
});

describe("camera coverage", () => {
  const camera = {
    id: "c1",
    name: "test",
    position: { x: 1, z: 3 },
    yawDeg: 0,
    goal: "monitor",
    optics: { ...defaultCameraOptics, focalMm: 4, sensorWidthMm: 5.12, megapixel: 4, maxRangeM: 30 }
  };

  test("field of view matches the lens formula", () => {
    // 2 * atan(5.12 / (2*4)) = 65.5 degrees
    assert.ok(Math.abs(cameraFovDeg(camera) - 65.5) < 0.6, `got ${cameraFovDeg(camera)}`);
  });

  test("DORI distances are correctly ordered", () => {
    const coverage = computeCameraCoverage(camera, [], 32);
    const { detect, observe, recognize, identify } = coverage.doriDistances;
    assert.ok(detect > observe && observe > recognize && recognize > identify,
      `expected descending DORI distances, got ${JSON.stringify(coverage.doriDistances)}`);
  });

  test("pixel density falls with distance", () => {
    const near = ppmAtDistance(2560, 65.5, 5);
    const far = ppmAtDistance(2560, 65.5, 20);
    assert.ok(near > far);
    assert.ok(Math.abs(near / far - 4) < 0.05, "density should be inversely proportional to distance");
  });

  test("walls clip the coverage polygon", () => {
    const occluders = room.map((item) => ({ a: item.a, b: item.b, heightM: item.heightM }));
    const clipped = computeCameraCoverage(camera, occluders, 48);
    const open = computeCameraCoverage(camera, [], 48);
    const reach = (coverage) => Math.max(...coverage.polygon.map((p) => Math.hypot(p.x - camera.position.x, p.z - camera.position.z)));
    assert.ok(reach(clipped) < reach(open), "the room should cut the fan short");
  });
});

describe("floor duplication", () => {
  test("a duplicated floor shares no ids or object references", () => {
    const source = createFloor("همکف", 0);
    source.walls.push(wall("w1", 0, 0, 5, 0));
    source.cameras.push({ id: "cam-1", name: "دوربین ۱", position: { x: 2, z: 2 }, yawDeg: 0, goal: "monitor", optics: { ...defaultCameraOptics } });

    const copy = duplicateFloor(source, "طبقه اول", 1);

    assert.notEqual(copy.id, source.id);
    assert.notEqual(copy.walls[0].id, source.walls[0].id);
    assert.notEqual(copy.cameras[0].id, source.cameras[0].id);

    // Moving the copy's camera must not disturb the original.
    copy.cameras[0].position.x = 9;
    assert.equal(source.cameras[0].position.x, 2);

    copy.optics = undefined;
    assert.equal(source.cameras[0].optics.focalMm, defaultCameraOptics.focalMm);
  });
});
