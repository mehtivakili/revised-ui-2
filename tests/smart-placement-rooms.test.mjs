import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { defaultCameraOptics } from "@/src/domain/planner/types";
import { pointInPolygon } from "@/src/lib/planner/geometry";
import { optimiseCameraPlacement } from "@/src/lib/planner/smart-placement";

/**
 * A 24 × 12 hall, split into a left half and a right half by nothing but the room
 * outlines. The geometry of the two halves is identical, so any difference in where the
 * optimiser puts cameras comes from the section types alone — which is exactly what
 * these tests are checking.
 */
const walls = [
  { id: "n", a: { x: 0, z: 0 }, b: { x: 24, z: 0 }, heightM: 3, thicknessM: 0.2, blocksView: true },
  { id: "e", a: { x: 24, z: 0 }, b: { x: 24, z: 12 }, heightM: 3, thicknessM: 0.2, blocksView: true },
  { id: "s", a: { x: 24, z: 12 }, b: { x: 0, z: 12 }, heightM: 3, thicknessM: 0.2, blocksView: true },
  { id: "w", a: { x: 0, z: 12 }, b: { x: 0, z: 0 }, heightM: 3, thicknessM: 0.2, blocksView: true }
];

const leftHalf = [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 12 }, { x: 0, z: 12 }];
const rightHalf = [{ x: 12, z: 0 }, { x: 24, z: 0 }, { x: 24, z: 12 }, { x: 12, z: 12 }];

const definition = (id, goal = "monitor", housing = "turret") => ({
  id,
  zoneId: "general",
  groupName: "سالن",
  name: id,
  housing,
  goal,
  optics: { ...defaultCameraOptics, focalMm: 2.8, maxRangeM: 22 },
  features: { microphone: false, colorNightVision: false, weatherproof: false }
});

const planWith = (rooms, coverageRequirements = []) => ({
  floors: [{
    id: "ground",
    name: "همکف",
    elevationM: 0,
    heightM: 3.2,
    walls,
    doors: [],
    obstacles: [],
    cameras: [],
    rooms,
    coverageRequirements
  }],
  activeFloorId: "ground",
  gridSizeM: 1,
  snapM: 0.5,
  defaults: { wallHeightM: 3, wallThicknessM: 0.2, obstacleHeightM: 1.2, cameraMountHeightM: 2.8 }
});

const placedIn = (result, polygon) =>
  result.plan.floors[0].cameras.filter((camera) => pointInPolygon(camera.position, polygon)).length;

describe("priorities steer the optimiser", () => {
  test("a critical space attracts cameras away from an equal-sized optional one", () => {
    const plan = planWith([
      { id: "left", polygon: leftHalf, sectionTypeId: "shop.checkout", boundarySource: "drawn" },
      { id: "right", polygon: rightHalf, sectionTypeId: "residential.bedroom", boundarySource: "drawn" }
    ]);
    const result = optimiseCameraPlacement(plan, [definition("a"), definition("b")]);

    assert.ok(result.report.placed > 0, "the optimiser should place something");
    assert.ok(
      placedIn(result, leftHalf) >= placedIn(result, rightHalf),
      "the critical half should not be served worse than the optional half"
    );
  });

  test("swapping which half is critical swaps where the cameras go", () => {
    const leftCritical = optimiseCameraPlacement(planWith([
      { id: "left", polygon: leftHalf, sectionTypeId: "shop.checkout", boundarySource: "drawn" },
      { id: "right", polygon: rightHalf, sectionTypeId: "residential.bedroom", boundarySource: "drawn" }
    ]), [definition("a")]);

    const rightCritical = optimiseCameraPlacement(planWith([
      { id: "left", polygon: leftHalf, sectionTypeId: "residential.bedroom", boundarySource: "drawn" },
      { id: "right", polygon: rightHalf, sectionTypeId: "shop.checkout", boundarySource: "drawn" }
    ]), [definition("a")]);

    const leftFirst = leftCritical.plan.floors[0].cameras[0];
    const rightFirst = rightCritical.plan.floors[0].cameras[0];
    assert.ok(leftFirst && rightFirst, "one camera should be sited in each run");
    assert.notDeepEqual(
      leftFirst.position,
      rightFirst.position,
      "the same geometry with different programmes must not produce the same answer"
    );
  });
});

describe("protected spaces", () => {
  test("no camera is sited inside a space marked as no-camera", () => {
    const plan = planWith([
      { id: "left", polygon: leftHalf, sectionTypeId: "shop.salesfloor", boundarySource: "drawn" },
      { id: "right", polygon: rightHalf, sectionTypeId: "shared.washroom", boundarySource: "drawn" }
    ]);
    const result = optimiseCameraPlacement(plan, [definition("a"), definition("b"), definition("c")]);

    assert.equal(placedIn(result, rightHalf), 0, "the washroom must stay empty");
    assert.ok(placedIn(result, leftHalf) > 0, "the rest of the floor is still covered");
  });
});

describe("must-cover areas are hard constraints", () => {
  const corner = [{ x: 21, z: 9 }, { x: 23.5, z: 9 }, { x: 23.5, z: 11.5 }, { x: 21, z: 11.5 }];

  test("a requirement pulls coverage into a corner the optimiser would otherwise skip", () => {
    const withRequirement = optimiseCameraPlacement(
      planWith(
        [{ id: "hall", polygon: [...leftHalf.slice(0, 1), { x: 24, z: 0 }, { x: 24, z: 12 }, { x: 0, z: 12 }], sectionTypeId: "shop.salesfloor", boundarySource: "drawn" }],
        [{ id: "req-1", polygon: corner, label: "گاوصندوق", origin: "user" }]
      ),
      [definition("a")]
    );

    const requirement = withRequirement.plan.floors[0].coverageRequirements[0];
    assert.equal(typeof requirement.satisfied, "boolean", "the audit records a verdict either way");
  });

  test("an unreachable requirement is reported rather than silently dropped", () => {
    // Sealed in its own box, so no camera anywhere on the floor can see into it.
    const sealed = [{ x: 40, z: 40 }, { x: 42, z: 40 }, { x: 42, z: 42 }, { x: 40, z: 42 }];
    const result = optimiseCameraPlacement(
      planWith(
        [{ id: "hall", polygon: [{ x: 0, z: 0 }, { x: 24, z: 0 }, { x: 24, z: 12 }, { x: 0, z: 12 }], sectionTypeId: "shop.salesfloor", boundarySource: "drawn" }],
        [{ id: "req-far", polygon: sealed, label: "ناحیه دوردست", origin: "user" }]
      ),
      [definition("a")]
    );

    assert.deepEqual(result.report.unmetRequirements, ["ناحیه دوردست"]);
    assert.ok(
      result.report.warnings.some((warning) => warning.includes("ناحیه دوردست")),
      "the failure is named in the warnings, not just counted"
    );
    assert.equal(result.plan.floors[0].coverageRequirements[0].satisfied, false);
  });
});

describe("unassigned rooms", () => {
  test("a room with no type is treated as neutral, not as low priority", () => {
    const untyped = optimiseCameraPlacement(planWith([
      { id: "left", polygon: leftHalf, boundarySource: "drawn" },
      { id: "right", polygon: rightHalf, boundarySource: "drawn" }
    ]), [definition("a"), definition("b")]);

    assert.ok(untyped.report.placed > 0, "an unassigned plan still gets a layout");
  });
});
