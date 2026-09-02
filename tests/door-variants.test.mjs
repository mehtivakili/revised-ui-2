import assert from "node:assert/strict";
import test, { describe } from "node:test";
import * as THREE from "three";
import {
  buildCameraMarker,
  buildDoorMesh,
  buildDoorResizeHandles,
  buildPolygonVertexHandles,
  buildWallWithDoors
} from "@/src/lib/planner/scene-builders";

const wall = {
  id: "wall",
  a: { x: 0, z: 0 },
  b: { x: 5, z: 0 },
  heightM: 3,
  thicknessM: 0.2,
  blocksView: true
};

const door = (variant) => ({
  id: variant,
  wallId: wall.id,
  type: "door",
  variant,
  offset: 0.5,
  widthM: variant.startsWith("double") ? 1.8 : 0.9,
  heightM: 2.1,
  hinge: "start",
  openAngleDeg: 45,
  blocksView: !variant.endsWith("glass")
});

const lines = (group) => group.children.filter((child) => child.isLine);
const transparentMeshes = (group) => group.children.filter(
  (child) => child.isMesh && child.material?.transparent
);

describe("door variants", () => {
  test("single solid door renders one swing leaf", () => {
    const group = buildDoorMesh(THREE, door("single-solid"), wall, false);
    assert.equal(lines(group).length, 1);
    assert.equal(transparentMeshes(group).length, 0);
  });

  test("double solid door renders two independently hinged leaves", () => {
    const group = buildDoorMesh(THREE, door("double-solid"), wall, false);
    assert.equal(lines(group).length, 2);
  });

  test("double glass door renders two transparent leaves", () => {
    const group = buildDoorMesh(THREE, door("double-glass"), wall, false);
    assert.equal(lines(group).length, 2);
    assert.equal(transparentMeshes(group).length, 2);
  });

  test("old saved doors default to a single solid leaf", () => {
    const legacy = door("single-solid");
    delete legacy.variant;
    const group = buildDoorMesh(THREE, legacy, wall, false);
    assert.equal(lines(group).length, 1);
    assert.equal(transparentMeshes(group).length, 0);
  });

  test("inside/outside choice flips the leaf across the wall", () => {
    const room = {
      id: "inside",
      polygon: [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 4 }, { x: 0, z: 4 }],
      boundarySource: "drawn"
    };
    const inward = buildDoorMesh(THREE, { ...door("single-solid"), swingDirection: "inward" }, wall, false, [room]);
    const outward = buildDoorMesh(THREE, { ...door("single-solid"), swingDirection: "outward" }, wall, false, [room]);
    assert.ok(inward.getObjectByName("door-leaf").position.z > 0);
    assert.ok(outward.getObjectByName("door-leaf").position.z < 0);
  });

  test("a selected door exposes an on-element swing toggle", () => {
    const handles = buildDoorResizeHandles(THREE, door("single-solid"), wall);
    assert.ok(handles.children.some((child) => child.userData.kind === "door-swing-toggle"));
  });
});

test("a window cuts the wall, renders glass, and marks the opening with a dashed line", () => {
  const window = {
    ...door("single-glass"),
    id: "window",
    type: "window",
    variant: undefined,
    sillHeightM: 0.9,
    heightM: 1.2,
    openAngleDeg: 0
  };
  const cutWall = buildWallWithDoors(THREE, wall, [window], false);
  const planWall = buildWallWithDoors(THREE, wall, [window], false, true);
  const rendered = buildDoorMesh(THREE, window, wall, false);
  assert.ok(cutWall.children.length >= 4, "masonry should be split around the window opening");
  assert.equal(planWall.children.length, 2, "top view must leave the whole window span empty");
  assert.ok(rendered.getObjectByName("window-opening-dash")?.isLine);
  assert.ok(transparentMeshes(rendered).length >= 1, "the 3D pane should remain visible and transparent");
});

test("editable polygons expose one direct-manipulation handle per vertex", () => {
  const polygon = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
  const handles = buildPolygonVertexHandles(THREE, polygon, "room", "room-1");
  assert.equal(handles.children.length, 4);
  assert.deepEqual(handles.children.map((child) => child.userData.kind), [
    "room-vertex-0", "room-vertex-1", "room-vertex-2", "room-vertex-3"
  ]);
});

describe("camera mounting support", () => {
  const marker = (mountKind) => buildCameraMarker(
    THREE,
    `camera-${mountKind}`,
    { x: 0, z: 0 },
    2.75,
    0,
    false,
    "bullet",
    mountKind
  );

  test("wall-mounted cameras do not grow a pole down to the floor", () => {
    assert.equal(marker("wall-edge").getObjectByName("camera-pole-support"), undefined);
    assert.equal(marker("corner").getObjectByName("camera-pole-support"), undefined);
  });

  test("a wall-mounted bullet stays below a three metre wall", () => {
    const bounds = new THREE.Box3().setFromObject(marker("wall-edge"));
    assert.ok(bounds.max.y < 3, `camera top ${bounds.max.y}m must stay below the wall top`);
  });

  test("an explicit outdoor pole is only a 45 centimetre riser", () => {
    const support = marker("pole").getObjectByName("camera-pole-support");
    assert.ok(support?.isMesh);
    assert.equal(support.geometry.parameters.height, 0.45);
    assert.equal(support.position.y, 2.75 - 0.45 / 2);
  });
});
