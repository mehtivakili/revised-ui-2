import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSamplePlan, sampleVenueTypeIds } from "@/src/lib/planner/sample-plans.ts";
import { DEFAULT_FLOOR_FINISH, finishForSpace, floorFinish, floorFinishes } from "@/src/lib/planner/floor-finishes.ts";
import { buildRoomFloor, roomHasFloor } from "@/src/lib/planner/scene-builders.ts";

const ids = new Set(floorFinishes.map((finish) => finish.id));

test("every enclosed space in every sample has a floor finish, and the samples use many", () => {
  const used = new Set();
  for (const sample of Object.keys(sampleVenueTypeIds)) {
    for (const floor of createSamplePlan(sample).floors) {
      for (const room of floor.rooms ?? []) {
        if (room.boundarySource === "drawn" || !room.sectionTypeId) continue;
        assert.ok(ids.has(room.floorFinish), `${sample} ${room.id} has finish ${room.floorFinish}`);
        used.add(room.floorFinish);
      }
    }
  }
  assert.ok(used.size >= 7, `only ${used.size} different floors across the samples`);
});

test("a finish suits the space", () => {
  assert.equal(finishForSpace("residential.kitchen", "آشپزخانه"), "tile-white");
  assert.equal(finishForSpace("residential.bedroom", "اتاق خواب"), "wood-oak");
  assert.equal(finishForSpace("office.lobby", "لابی و پذیرش"), "marble-cream");
  assert.equal(finishForSpace("warehouse.storage", "انبار"), "epoxy-gray");
  assert.equal(finishForSpace("x.corridor", "راهرو"), "terrazzo");
  assert.equal(finishForSpace(undefined), undefined);
  assert.equal(floorFinish(undefined).id, DEFAULT_FLOOR_FINISH, "no finish falls back to the default");
});

test("an enclosed space gets a lit floor in its finish; an open drawn area only if one is chosen", () => {
  const square = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
  const room = { id: "r1", polygon: square, boundarySource: "detected", floorFinish: "wood-walnut" };
  const mesh = buildRoomFloor(THREE, room, room.floorFinish);
  assert.ok(mesh);
  assert.equal(mesh.userData.kind, "room", "clicking the floor selects the space");
  assert.equal(mesh.userData.floorFinish, "wood-walnut");
  assert.ok(mesh.receiveShadow, "furniture casts shadows on the floor");
  const box = new THREE.Box3().setFromObject(mesh);
  assert.ok(box.min.y > 0.008 && box.max.y < 0.02, "the floor sits just above the ground grid");
  assert.ok(Math.abs(box.max.x - box.min.x - 4) < 1e-6 && Math.abs(box.max.z - box.min.z - 3) < 1e-6, "and covers the space");
  assert.equal(mesh.material.color.getHex(), floorFinish("wood-walnut").color, "without a canvas the finish colour is used");

  assert.equal(roomHasFloor({ ...room, floorFinish: undefined }), true);
  assert.equal(roomHasFloor({ ...room, boundarySource: "drawn", floorFinish: undefined }), false);
  assert.equal(roomHasFloor({ ...room, boundarySource: "drawn" }), true);
});
