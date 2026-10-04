import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { applyObstaclePreset, obstaclePresets } from "@/src/lib/planner/obstacle-presets.ts";
import { buildObstacleMesh, buildWallMesh, buildWallWithDoors } from "@/src/lib/planner/scene-builders.ts";
import { collectOccluders } from "@/src/lib/planner/geometry.ts";
import { drawsSingleWall, fenceWallStyles, isFenceMode, wallTypeLabel } from "@/src/lib/planner/wall-styles.ts";

const blank = (id) => ({
  id,
  label: "",
  kind: "block",
  center: { x: 1, z: 2 },
  widthM: 1,
  depthM: 1,
  heightM: 1,
  rotationDeg: 0,
  blocksView: true
});

test("utility, freight, transport and landing presets have recognisable models", () => {
  const expectedParts = {
    transformer: "transformer-tank",
    "storage-tank": "storage-tank-shell",
    "chemical-tank": "chemical-tank-shell",
    "generator-unit": "generator-housing",
    "pump-unit": "pump-casing",
    pipeline: "pipeline-pipe",
    "pipe-valve": "valve-body",
    "solar-panel": "solar-panel-surface",
    "shipping-container": "container-box",
    "stair-landing": "landing-slab",
    bus: "bus-body",
    ambulance: "ambulance-stripe"
  };
  for (const [variant, part] of Object.entries(expectedParts)) {
    const preset = obstaclePresets.find((item) => item.id === variant);
    assert.ok(preset, `${variant} must be in the object library`);
    const mesh = buildObstacleMesh(THREE, applyObstaclePreset(blank(`test-${variant}`), preset), false);
    assert.ok(mesh.getObjectByName(part), `${variant} needs a recognisable 3D model`);
  }
  for (const group of ["utility", "transport"]) {
    assert.ok(obstaclePresets.some((item) => item.group === group), `${group} group must offer items`);
  }
  // The landing keeps the label that marks a top floor's final landing.
  assert.ok(obstaclePresets.find((item) => item.id === "stair-landing").label.includes("پاگرد نهایی"));
});

test("the wall tool draws site fences matching the fence objects", () => {
  for (const mode of ["fence-mesh", "fence-wall"]) {
    assert.ok(isFenceMode(mode) && drawsSingleWall(mode), `${mode} is drawn wall by wall`);
    const preset = obstaclePresets.find((item) => item.id === mode);
    const style = fenceWallStyles[mode];
    assert.equal(style.heightM, preset.heightM, `${mode} height matches the fence object`);
    assert.equal(style.thicknessM, preset.depthM, `${mode} thickness matches the fence object`);
    assert.equal(style.blocksView, preset.blocksView, `${mode} sight line matches the fence object`);
  }
  assert.equal(drawsSingleWall("rectangle"), false);
  assert.equal(isFenceMode("glass"), false);
});

test("fence walls render as fences, leave gates open and only a boundary wall blocks the view", () => {
  const fence = (variant) => ({
    id: `wall-${variant}`,
    a: { x: 0, z: 0 },
    b: { x: 10, z: 0 },
    ...fenceWallStyles[variant],
    variant
  });
  const mesh = fence("fence-mesh");
  const rendered = buildWallMesh(THREE, mesh, false);
  assert.ok(rendered.children.length >= 3, "a fence has a panel and posts, not a single slab");
  rendered.traverse((child) => assert.equal(child.userData.kind, "wall", "every fence part selects the wall"));
  assert.equal(wallTypeLabel(mesh), "حصار توری");

  // A gate in the fence leaves no lintel above the opening.
  const gate = { id: "gate", wallId: mesh.id, type: "door", offset: 0.5, widthM: 4, heightM: 2 };
  const withGate = buildWallWithDoors(THREE, mesh, [gate], false);
  const box = new THREE.Box3();
  withGate.traverse((child) => {
    if (!child.isMesh) return;
    box.setFromObject(child);
    const overGate = box.min.x < 6.9 && box.max.x > 3.1;
    assert.equal(overGate, false, "nothing is built across the gate opening");
  });

  const occluders = (wall) => collectOccluders([wall], [], []);
  assert.equal(occluders(fence("fence-mesh")).length, 0, "a mesh fence does not hide anything");
  assert.ok(occluders(fence("fence-wall")).length > 0, "a boundary wall hides what is behind it");
});
