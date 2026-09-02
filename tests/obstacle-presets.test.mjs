import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as THREE from "three";

import { applyObstaclePreset, obstacleGroupLabels, obstaclePresets } from "@/src/lib/planner/obstacle-presets.ts";
import { sectionsForVenue, venueTypes } from "@/src/domain/planner/venues.ts";
import { createSamplePlan, sampleSectionIsRepresented, sampleVenueTypeIds } from "@/src/lib/planner/sample-plans.ts";
import { pointInPolygon } from "@/src/lib/planner/geometry.ts";
import { isCardinalAngle, snapRotationAngle } from "@/src/lib/planner/rotation.ts";
import {
  buildFloorFootprintGuide,
  buildFloorSlab,
  buildOverallDimensionGuide,
  buildObstacleMesh,
  buildObstacleRotateHandle,
  buildYawHandle,
  collectDimensionLabels,
  disposeGroup
} from "@/src/lib/planner/scene-builders.ts";

test("all 39 venue types have a compact editable sample", () => {
  const allVenueIds = [
    "residential", "shop", "supermarket", "jewellery", "office",
    "industrial", "parking", "restaurant", "school", "hospital",
    "hotel", "fuel", "apartment", "farm", "urban-road",
    "highway", "construction", "conference", "car-showroom", "bus-station",
    "transit-fleet", "control-room", "substation", "warehouse", "mall",
    "pipeline", "transmission-line", "onshore-oil", "offshore-oil", "solar-farm",
    "hydro-plant", "safe-city", "sports-complex", "data-centre", "airport",
    "port", "railway", "mine", "water-plant"
  ];
  assert.equal(venueTypes.length, 39);
  assert.deepEqual(venueTypes.map((venue) => venue.id), allVenueIds);
  const sampledVenues = new Set(Object.values(sampleVenueTypeIds));
  assert.ok(allVenueIds.every((venueId) => sampledVenues.has(venueId)));
});

test("every preset belongs to a labelled group and has real dimensions", () => {
  const known = new Set(Object.keys(obstacleGroupLabels));
  const ids = new Set();
  for (const preset of obstaclePresets) {
    assert.ok(known.has(preset.group), `${preset.id} is in unlabelled group "${preset.group}"`);
    assert.ok(!ids.has(preset.id), `duplicate preset id ${preset.id}`);
    ids.add(preset.id);
    assert.ok(preset.widthM > 0 && preset.depthM > 0 && preset.heightM > 0, `${preset.id} needs real dimensions`);
    assert.ok(preset.label.trim().length > 0 && preset.description.trim().length > 0);
  }
});

test("each room category offers a usable set of furniture", () => {
  for (const group of ["living", "bedroom", "kitchen", "office", "retail"]) {
    const items = obstaclePresets.filter((preset) => preset.group === group);
    assert.ok(items.length >= 5, `${group} should offer at least five items, got ${items.length}`);
  }
});

test("common CCTV environments expose practical object sets", () => {
  for (const group of ["industrial", "warehouse", "parking", "hospitality"]) {
    const items = obstaclePresets.filter((preset) => preset.group === group);
    assert.ok(items.length >= 5, `${group} should offer at least five items, got ${items.length}`);
  }
});

test("server-room tools expose recognisable rack, recording, power and monitoring equipment", () => {
  const variants = ["equipment-rack", "nvr-cabinet", "ups-unit", "network-switch", "monitoring-console"];
  const presets = obstaclePresets.filter((preset) => preset.group === "server-room");
  assert.deepEqual(presets.map((preset) => preset.id), variants);

  const expectedParts = {
    "equipment-rack": "server-rack-frame",
    "nvr-cabinet": "nvr-body",
    "ups-unit": "ups-body",
    "network-switch": "poe-switch-body",
    "monitoring-console": "monitoring-screen"
  };
  for (const preset of presets) {
    const obstacle = applyObstaclePreset({
      id: `server-room-${preset.id}`,
      label: "",
      kind: "block",
      center: { x: 2, z: 3 },
      widthM: 1,
      depthM: 1,
      heightM: 1,
      rotationDeg: 0,
      blocksView: false
    }, preset);
    const mesh = buildObstacleMesh(THREE, obstacle, false);
    assert.ok(mesh.getObjectByName(expectedParts[preset.id]), `${preset.id} needs a recognisable 3D model`);
  }
});

test("sample collection showcases every designer preset without duplicate object ids", () => {
  const plan = createSamplePlan("luxury-villa");
  const objects = plan.floors.flatMap((floor) => floor.obstacles);
  const sampleIds = [
    "luxury-villa", "modern-office", "retail-gallery", "factory-campus", "residential-parking", "kourosh-mall",
    "mega-mall", "general-hospital", "police-station", "barracks-campus", "school-campus", "boutique-hotel",
    "compact-data-centre"
  ];
  const represented = new Set(sampleIds.flatMap((id) => createSamplePlan(id).floors.flatMap((floor) => floor.obstacles)).map((item) => item.variant).filter(Boolean));
  const missing = obstaclePresets.map((item) => item.id).filter((id) => !represented.has(id));

  assert.deepEqual(missing, [], `villa is missing presets: ${missing.join(", ")}`);
  assert.equal(new Set(objects.map((item) => item.id)).size, objects.length, "villa object ids must be unique");
  assert.equal(plan.floors.length, 5);
  assert.equal(plan.activeFloorId, "villa-ground");
  assert.ok(plan.floors.some((floor) => floor.elevationM < 0), "villa should include a real service basement");
});

test("all non-mall sample spaces start with a programme type", () => {
  const readySamples = [
    "family-villa", "corner-retail-shop", "luxury-villa", "modern-office", "retail-gallery",
    "neighbourhood-supermarket", "secure-jewellery-branch",
    "compact-industrial-workshop", "urban-public-parking", "neighbourhood-restaurant",
    "primary-school", "outpatient-clinic",
    "boutique-hotel", "neighbourhood-fuel-station", "courtyard-apartment", "orchard-farm", "urban-roundabout",
    "highway-interchange", "active-construction-site", "conference-centre", "car-showroom", "bus-terminal",
    "city-bus-fleet", "security-control-room", "urban-substation", "regional-warehouse", "neighbourhood-mall",
    "pipeline-monitoring-station", "transmission-corridor", "onshore-oil-field", "offshore-platform", "solar-generation-farm",
    "hydroelectric-power-station", "safe-city-district", "urban-sports-complex", "compact-data-centre",
    "regional-airport-terminal", "container-port", "railway-interchange-station", "open-pit-mine", "water-treatment-plant",
    "factory-campus", "residential-parking",
    "general-hospital", "police-station", "barracks-campus", "school-campus"
  ];

  for (const sampleId of readySamples) {
    const plan = createSamplePlan(sampleId);
    const rooms = plan.floors.flatMap((floor) => floor.rooms ?? []);
    assert.ok(rooms.length > 0, `${sampleId} should ship with detected spaces`);
    assert.ok(rooms.every((room) => room.sectionTypeId), `${sampleId} contains an unprogrammed space`);
    assert.ok(rooms.every((room) => room.name?.trim()), `${sampleId} contains an unnamed space`);
    assert.ok(rooms.every((room) => room.sectionTypeId !== "generic.room"), `${sampleId} still uses an unspecified generic room`);
    const expected = sectionsForVenue(sampleVenueTypeIds[sampleId]).filter(
      (section) => section.priority === "critical" || section.priority === "important"
    );
    assert.ok(
      expected.every((section) => sampleSectionIsRepresented(plan, section.id)),
      `${sampleId} is missing a critical or important checklist item`
    );
  }

  for (const sampleId of ["kourosh-mall", "mega-mall"]) {
    assert.ok(
      createSamplePlan(sampleId).floors.every((floor) => floor.rooms === undefined),
      `${sampleId} should stay on the heavy-project room workflow`
    );
  }
});

test("every sample plan is richly furnished and uses architectural openings", () => {
  const expectations = {
    "family-villa": { floors: 2, obstacles: 35 },
    "corner-retail-shop": { floors: 1, obstacles: 15 },
    "luxury-villa": { floors: 5, obstacles: 60 },
    "modern-office": { floors: 3, obstacles: 35 },
    "retail-gallery": { floors: 2, obstacles: 25 },
    "neighbourhood-supermarket": { floors: 1, obstacles: 45 },
    "secure-jewellery-branch": { floors: 1, obstacles: 25 },
    "compact-industrial-workshop": { floors: 1, obstacles: 30 },
    "urban-public-parking": { floors: 1, obstacles: 40 },
    "neighbourhood-restaurant": { floors: 1, obstacles: 40 },
    "primary-school": { floors: 1, obstacles: 45 },
    "outpatient-clinic": { floors: 1, obstacles: 25 },
    "boutique-hotel": { floors: 2, obstacles: 40 },
    "neighbourhood-fuel-station": { floors: 1, obstacles: 25 },
    "courtyard-apartment": { floors: 2, obstacles: 30 },
    "orchard-farm": { floors: 1, obstacles: 30 },
    "urban-roundabout": { floors: 1, obstacles: 25 },
    "highway-interchange": { floors: 1, obstacles: 30 },
    "active-construction-site": { floors: 1, obstacles: 30 },
    "conference-centre": { floors: 1, obstacles: 20 },
    "car-showroom": { floors: 1, obstacles: 25 },
    "bus-terminal": { floors: 1, obstacles: 25 },
    "city-bus-fleet": { floors: 1, obstacles: 20 },
    "security-control-room": { floors: 1, obstacles: 18 },
    "urban-substation": { floors: 1, obstacles: 25 },
    "regional-warehouse": { floors: 1, obstacles: 30 },
    "neighbourhood-mall": { floors: 3, obstacles: 45 },
    "pipeline-monitoring-station": { floors: 1, obstacles: 25 },
    "transmission-corridor": { floors: 1, obstacles: 25 },
    "onshore-oil-field": { floors: 1, obstacles: 20 },
    "offshore-platform": { floors: 1, obstacles: 18 },
    "solar-generation-farm": { floors: 1, obstacles: 35 },
    "hydroelectric-power-station": { floors: 1, obstacles: 18 },
    "safe-city-district": { floors: 1, obstacles: 24 },
    "urban-sports-complex": { floors: 1, obstacles: 28 },
    "compact-data-centre": { floors: 1, obstacles: 28 },
    "regional-airport-terminal": { floors: 1, obstacles: 24 },
    "container-port": { floors: 1, obstacles: 30 },
    "railway-interchange-station": { floors: 1, obstacles: 26 },
    "open-pit-mine": { floors: 1, obstacles: 15 },
    "water-treatment-plant": { floors: 1, obstacles: 22 },
    "factory-campus": { floors: 2, obstacles: 45 },
    "residential-parking": { floors: 4, obstacles: 75 },
    "kourosh-mall": { floors: 17, obstacles: 750 }
  };

  for (const [sampleId, expected] of Object.entries(expectations)) {
    const plan = createSamplePlan(sampleId);
    const obstacles = plan.floors.flatMap((floor) => floor.obstacles);
    const openings = plan.floors.flatMap((floor) => floor.doors ?? []);
    assert.equal(plan.floors.length, expected.floors, `${sampleId} floor count`);
    assert.ok(obstacles.length >= expected.obstacles, `${sampleId} needs richer furnishing`);
    if (sampleId !== "open-pit-mine") {
      assert.ok(openings.some((item) => item.type === "window"), `${sampleId} needs windows`);
    }
    assert.ok(openings.some((item) => item.type !== "window"), `${sampleId} needs doors`);
    assert.equal(new Set(obstacles.map((item) => item.id)).size, obstacles.length, `${sampleId} object ids must be unique`);
    for (const floor of plan.floors) {
      const wallIds = new Set(floor.walls.map((wall) => wall.id));
      if (floor.elevationM >= 0 && sampleId !== "open-pit-mine") {
        assert.ok((floor.doors ?? []).some((item) => item.type === "window"), `${sampleId}/${floor.id} needs a window`);
      }
      assert.ok((floor.doors ?? []).some((item) => item.type !== "window"), `${sampleId}/${floor.id} needs a door`);
      assert.ok((floor.doors ?? []).every((item) => wallIds.has(item.wallId)), `${sampleId}/${floor.id} has a detached opening`);
      assert.ok(floor.obstacles.length >= 4, `${sampleId}/${floor.id} is too sparse`);
    }
  }
});

test("sample buildings have a coherent vertical circulation core", () => {
  const elevatorCounts = {
    "luxury-villa": 1, "modern-office": 1, "retail-gallery": 1, "boutique-hotel": 1,
    "courtyard-apartment": 1, "neighbourhood-mall": 1, "factory-campus": 1, "residential-parking": 1,
    "kourosh-mall": 8, "mega-mall": 6, "general-hospital": 2, "police-station": 2,
    "barracks-campus": 2, "school-campus": 2
  };
  for (const [sampleId, elevatorCount] of Object.entries(elevatorCounts)) {
    const floors = createSamplePlan(sampleId).floors.toSorted((a, b) => a.elevationM - b.elevationM);
    const topFloor = floors.at(-1);

    assert.ok(topFloor, `${sampleId} needs a top floor`);
    assert.equal(
      topFloor.obstacles.some((item) => item.variant === "stairs-straight"),
      false,
      `${sampleId} must not place an upward stair on its top floor`
    );
    assert.ok(
      topFloor.obstacles.some((item) => item.label.includes("پاگرد نهایی")),
      `${sampleId} top floor needs a final landing instead of another stair`
    );
    const elevatorCenters = floors.map((floor) => {
      const elevators = floor.obstacles.filter((item) => item.variant === "elevator");
      assert.equal(elevators.length, elevatorCount, `${sampleId}/${floor.id} elevator bank count`);
      return elevators.map((item) => `${item.center.x}:${item.center.z}`).toSorted().join("|");
    });
    assert.equal(
      new Set(elevatorCenters).size,
      1,
      `${sampleId} elevator shaft must align through every floor`
    );
    for (const floor of floors.slice(0, -1)) {
      const stairs = floor.obstacles.find((item) => item.variant === "stairs-straight");
      const elevators = floor.obstacles.filter((item) => item.variant === "elevator");
      const maximumCoreWalkM = sampleId === "mega-mall" ? 26 : 12;
      assert.ok(stairs, `${sampleId}/${floor.id} needs a stair to the floor above`);
      assert.ok(
        elevators.some((elevator) => Math.hypot(stairs.center.x - elevator.center.x, stairs.center.z - elevator.center.z) <= maximumCoreWalkM),
        `${sampleId}/${floor.id} elevator must sit beside its stair`
      );
    }
  }
});

test("upper floors never use an exterior shell door as their main entry", () => {
  for (const sampleId of [
    "luxury-villa", "modern-office", "retail-gallery", "boutique-hotel", "neighbourhood-mall", "factory-campus", "residential-parking", "kourosh-mall",
    "mega-mall", "general-hospital", "police-station", "barracks-campus", "school-campus"
  ]) {
    for (const floor of createSamplePlan(sampleId).floors.filter((item) => item.elevationM > 0)) {
      const exteriorEntries = (floor.doors ?? []).filter((item) =>
        item.type !== "window" && item.id.includes("entry") && item.wallId.includes("shell")
      );
      assert.deepEqual(exteriorEntries, [], `${sampleId}/${floor.id} has an impossible exterior entry door`);
    }
  }
});

const firstTenSampleIds = [
  "family-villa", "corner-retail-shop", "neighbourhood-supermarket", "secure-jewellery-branch", "modern-office",
  "compact-industrial-workshop", "urban-public-parking", "neighbourhood-restaurant", "primary-school", "outpatient-clinic"
];

const secondTenSampleIds = [
  "boutique-hotel", "neighbourhood-fuel-station", "courtyard-apartment", "orchard-farm", "urban-roundabout",
  "highway-interchange", "active-construction-site", "conference-centre", "car-showroom", "bus-terminal"
];

const thirdTenSampleIds = [
  "city-bus-fleet", "security-control-room", "urban-substation", "regional-warehouse", "neighbourhood-mall",
  "pipeline-monitoring-station", "transmission-corridor", "onshore-oil-field", "offshore-platform", "solar-generation-farm"
];

const finalNineSampleIds = [
  "hydroelectric-power-station", "safe-city-district", "urban-sports-complex", "compact-data-centre",
  "regional-airport-terminal", "container-port", "railway-interchange-station", "open-pit-mine", "water-treatment-plant"
];

const auditedSampleIds = [...firstTenSampleIds, ...secondTenSampleIds, ...thirdTenSampleIds, ...finalNineSampleIds];
const everySampleId = Object.keys(sampleVenueTypeIds);

function roomsBesideOpening(floor, opening) {
  const wall = floor.walls.find((item) => item.id === opening.wallId);
  if (!wall) return [];
  const x = wall.a.x + (wall.b.x - wall.a.x) * opening.offset;
  const z = wall.a.z + (wall.b.z - wall.a.z) * opening.offset;
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
  const normal = { x: -(wall.b.z - wall.a.z) / length, z: (wall.b.x - wall.a.x) / length };
  const hits = new Set();
  for (const side of [-1, 1]) {
    const point = { x: x + normal.x * side * 0.35, z: z + normal.z * side * 0.35 };
    (floor.rooms ?? []).forEach((room, index) => {
      if (pointInPolygon(point, room.polygon)) hits.add(index);
    });
  }
  return [...hits];
}

test("the audited samples have a continuous route from every room to an entrance or vertical core", () => {
  for (const sampleId of auditedSampleIds) {
    for (const floor of createSamplePlan(sampleId).floors) {
      const rooms = floor.rooms ?? [];
      const adjacent = rooms.map(() => new Set());
      const reachable = new Set();
      for (const opening of floor.doors.filter((item) => item.type !== "window")) {
        const hits = roomsBesideOpening(floor, opening);
        if (hits.length === 1 && floor.elevationM === 0) reachable.add(hits[0]);
        if (hits.length === 2) {
          adjacent[hits[0]].add(hits[1]);
          adjacent[hits[1]].add(hits[0]);
        }
      }
      rooms.forEach((room, index) => {
        const hasCore = floor.obstacles.some((item) =>
          (item.variant === "stairs-straight" || item.variant === "elevator" || item.label.includes("پاگرد"))
          && pointInPolygon(item.center, room.polygon)
        );
        if (hasCore) reachable.add(index);
      });
      const queue = [...reachable];
      while (queue.length) {
        for (const neighbour of adjacent[queue.shift()]) {
          if (reachable.has(neighbour)) continue;
          reachable.add(neighbour);
          queue.push(neighbour);
        }
      }
      assert.equal(reachable.size, rooms.length, `${sampleId}/${floor.id} contains a room with no usable route`);
    }
  }
});

function obstacleBounds(item) {
  const quarterTurn = Math.abs(item.rotationDeg % 180) === 90;
  const width = quarterTurn ? item.depthM : item.widthM;
  const depth = quarterTurn ? item.widthM : item.depthM;
  return {
    left: item.center.x - width / 2, right: item.center.x + width / 2,
    top: item.center.z - depth / 2, bottom: item.center.z + depth / 2
  };
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function wallCutsObstacle(wall, item) {
  const bounds = obstacleBounds(item);
  const inset = Math.min(0.08, (bounds.right - bounds.left) / 4, (bounds.bottom - bounds.top) / 4);
  const box = {
    left: bounds.left + inset, right: bounds.right - inset,
    top: bounds.top + inset, bottom: bounds.bottom - inset
  };
  const inside = (point) => point.x > box.left && point.x < box.right && point.z > box.top && point.z < box.bottom;
  if (inside(wall.a) || inside(wall.b)) return true;
  const corners = [
    { x: box.left, z: box.top }, { x: box.right, z: box.top },
    { x: box.right, z: box.bottom }, { x: box.left, z: box.bottom }
  ];
  return corners.some((corner, index) => segmentsIntersect(wall.a, wall.b, corner, corners[(index + 1) % corners.length]));
}

test("stairs, elevators and escalators in every sample stay clear of walls, furniture and vehicles", () => {
  const nonSolid = new Set(["surface", "road", "grass", "rug", "speed-bump", "wheel-stop", "loading-platform"]);
  for (const sampleId of everySampleId) {
    for (const floor of createSamplePlan(sampleId).floors) {
      const cores = floor.obstacles.filter((item) =>
        item.variant === "stairs-straight" || item.variant === "elevator" || item.variant === "escalator"
      );
      for (const core of cores) {
        assert.equal(
          floor.walls.some((wall) => wallCutsObstacle(wall, core)),
          false,
          `${sampleId}/${floor.id}: ${core.id} cuts through a wall`
        );
        const coreBounds = obstacleBounds(core);
        for (const item of floor.obstacles) {
          if (item === core || cores.includes(item) || nonSolid.has(item.kind) || nonSolid.has(item.variant)) continue;
          const itemBounds = obstacleBounds(item);
          const overlapX = Math.min(coreBounds.right, itemBounds.right) - Math.max(coreBounds.left, itemBounds.left);
          const overlapZ = Math.min(coreBounds.bottom, itemBounds.bottom) - Math.max(coreBounds.top, itemBounds.top);
          assert.ok(overlapX <= 0.1 || overlapZ <= 0.1, `${sampleId}/${floor.id}: ${core.id} overlaps ${item.id}`);
        }
      }
    }
  }
});

test("usable door approaches in every sample are not blocked by furniture", () => {
  const ignored = new Set(["gate-sliding", "parking-barrier", "road", "speed-bump", "wheel-stop", "loading-platform"]);
  for (const sampleId of everySampleId) {
    for (const floor of createSamplePlan(sampleId).floors) {
      for (const opening of floor.doors.filter((item) => item.type !== "window")) {
        const wall = floor.walls.find((item) => item.id === opening.wallId);
        assert.ok(wall, `${sampleId}/${floor.id}: ${opening.id} has no host wall`);
        const dx = wall.b.x - wall.a.x;
        const dz = wall.b.z - wall.a.z;
        const length = Math.hypot(dx, dz);
        const tangent = { x: dx / length, z: dz / length };
        const normal = { x: -tangent.z, z: tangent.x };
        const point = {
          x: wall.a.x + dx * opening.offset,
          z: wall.a.z + dz * opening.offset
        };
        for (const item of floor.obstacles) {
          if (item.kind === "surface" || ignored.has(item.variant)) continue;
          const bounds = obstacleBounds(item);
          const halfWidth = (bounds.right - bounds.left) / 2;
          const halfDepth = (bounds.bottom - bounds.top) / 2;
          const tangentHalf = Math.abs(tangent.x) * halfWidth + Math.abs(tangent.z) * halfDepth;
          const normalHalf = Math.abs(normal.x) * halfWidth + Math.abs(normal.z) * halfDepth;
          const along = Math.abs((item.center.x - point.x) * tangent.x + (item.center.z - point.z) * tangent.z);
          const away = Math.abs((item.center.x - point.x) * normal.x + (item.center.z - point.z) * normal.z);
          assert.ok(
            along >= opening.widthM / 2 + tangentHalf + 0.15 || away >= 0.9 + normalHalf,
            `${sampleId}/${floor.id}: ${item.id} blocks ${opening.id}`
          );
        }
      }
    }
  }
});

test("vertical circulation never inherits a private room programme or a checklist overlay", () => {
  const invalidTypes = new Set([
    "residential.bedroom", "sample.apartment.private-unit", "hospital.patient-room", "shared.storeroom"
  ]);
  for (const sampleId of everySampleId) {
    for (const floor of createSamplePlan(sampleId).floors) {
      const cores = floor.obstacles.filter((item) =>
        item.variant === "stairs-straight" || item.variant === "elevator" || item.label.includes("پاگرد نهایی")
      );
      for (const core of cores) {
        const room = (floor.rooms ?? []).find((item) => pointInPolygon(core.center, item.polygon));
        if (room) assert.equal(invalidTypes.has(room.sectionTypeId), false, `${sampleId}/${floor.id}: ${core.id} is inside ${room.name}`);
        assert.equal(
          (floor.coverageRequirements ?? []).some((requirement) => pointInPolygon(core.center, requirement.polygon)),
          false,
          `${sampleId}/${floor.id}: checklist overlay covers ${core.id}`
        );
      }
    }
  }
});

test("the audited samples do not stack furniture, vehicles, stairs or elevators on each other", () => {
  const nonSolid = new Set(["rug", "grass", "road", "speed-bump", "wheel-stop", "loading-platform"]);
  for (const sampleId of auditedSampleIds) {
    for (const floor of createSamplePlan(sampleId).floors) {
      for (let leftIndex = 0; leftIndex < floor.obstacles.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < floor.obstacles.length; rightIndex += 1) {
          const left = floor.obstacles[leftIndex];
          const right = floor.obstacles[rightIndex];
          const craneAssembly = left.id.startsWith("construction-crane-") && right.id.startsWith("construction-crane-");
          const leftTower = left.id.match(/^transmission-tower-(?:mast|arm)-(\d+)$/)?.[1];
          const rightTower = right.id.match(/^transmission-tower-(?:mast|arm)-(\d+)$/)?.[1];
          const towerAssembly = leftTower && leftTower === rightTower;
          const aircraftAssembly = left.id.startsWith("airport-aircraft-") && right.id.startsWith("airport-aircraft-");
          const leftPortCrane = left.id.match(/^port-crane-(?:leg-[ab]|beam)-(\d+)$/)?.[1];
          const rightPortCrane = right.id.match(/^port-crane-(?:leg-[ab]|beam)-(\d+)$/)?.[1];
          const portCraneAssembly = leftPortCrane && leftPortCrane === rightPortCrane;
          const minePitLayers = left.id.startsWith("mine-pit-") && right.id.startsWith("mine-pit-");
          if (left.kind === "surface" || right.kind === "surface" || nonSolid.has(left.variant) || nonSolid.has(right.variant)
            || craneAssembly || towerAssembly || aircraftAssembly || portCraneAssembly || minePitLayers) continue;
          const a = obstacleBounds(left);
          const b = obstacleBounds(right);
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapZ = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          assert.ok(
            overlapX <= 0.15 || overlapZ <= 0.15 || overlapX * overlapZ <= 0.15,
            `${sampleId}/${floor.id}: ${left.id} overlaps ${right.id}`
          );
        }
      }
    }
  }
});

test("elevators in the audited samples never open into bedrooms or clinical rooms", () => {
  const privateTypes = new Set(["residential.bedroom", "hospital.patient-room", "shared.storeroom"]);
  for (const sampleId of auditedSampleIds) {
    for (const floor of createSamplePlan(sampleId).floors) {
      for (const elevator of floor.obstacles.filter((item) => item.variant === "elevator")) {
        const room = (floor.rooms ?? []).find((item) => pointInPolygon(elevator.center, item.polygon));
        assert.ok(room, `${sampleId}/${floor.id} elevator is outside the architecture`);
        assert.equal(privateTypes.has(room.sectionTypeId), false, `${sampleId}/${floor.id} elevator opens into ${room.name}`);
      }
    }
  }
});

test("doors and windows in the audited samples fit their host wall without overlapping", () => {
  for (const sampleId of auditedSampleIds) {
    for (const floor of createSamplePlan(sampleId).floors) {
      for (const wall of floor.walls) {
        const openings = floor.doors.filter((item) => item.wallId === wall.id);
        const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
        openings.forEach((opening) => {
          const half = opening.widthM / (2 * length);
          assert.ok(opening.offset - half >= 0 && opening.offset + half <= 1, `${sampleId}/${opening.id} exceeds its wall`);
        });
        for (let left = 0; left < openings.length; left += 1) {
          for (let right = left + 1; right < openings.length; right += 1) {
            const clearance = Math.abs(openings[left].offset - openings[right].offset) * length;
            assert.ok(
              clearance >= (openings[left].widthM + openings[right].widthM) / 2,
              `${sampleId}: ${openings[left].id} overlaps ${openings[right].id}`
            );
          }
        }
      }
    }
  }
});

test("indoor furniture in the audited samples stays inside an architectural room", () => {
  const outdoorGroups = new Set(["landscape", "site", "vehicle", "tree"]);
  const outdoorFixtures = new Set(["loading-platform", "waiting-bench", "bollard", "guard-booth"]);
  const presetGroups = new Map(obstaclePresets.map((item) => [item.id, item.group]));
  const exteriorPrefixes = new Map([
    ["neighbourhood-fuel-station", ["fuel-station-pump-", "fuel-station-canopy-", "fuel-station-traffic-", "fuel-station-tank-", "fuel-station-gate-", "fuel-station-service-"]],
    ["courtyard-apartment", ["courtyard-apartment-landscape-"]],
    ["orchard-farm", ["orchard-farm-access-", "orchard-farm-tree-", "orchard-farm-water-"]],
    ["urban-roundabout", ["urban-roundabout-central-", "urban-roundabout-ring-", "urban-roundabout-roads-", "urban-roundabout-signals-", "urban-roundabout-traffic-"]],
    ["highway-interchange", ["highway-mainline-", "highway-ramp-", "highway-traffic-", "highway-monitoring-", "highway-vms-", "highway-emergency-"]],
    ["active-construction-site", ["construction-material-", "construction-vehicle-", "construction-site-", "construction-crane-", "construction-foundation"]],
    ["car-showroom", ["car-showroom-yard-", "car-showroom-delivery-"]],
    ["bus-terminal", ["bus-terminal-bus-", "bus-terminal-platform-", "bus-terminal-security-", "bus-terminal-shelter"]],
    ["city-bus-fleet", ["city-bus-depot-", "city-bus-wash-"]],
    ["urban-substation", ["urban-substation-transformer-", "urban-substation-yard-", "urban-substation-bus-"]],
    ["regional-warehouse", ["regional-warehouse-yard-"]],
    ["pipeline-monitoring-station", ["pipeline-route-", "pipeline-valve-", "pipeline-site-", "pipeline-leak-"]],
    ["transmission-corridor", ["transmission-tower-", "transmission-access-", "transmission-security-", "transmission-transformer"]],
    ["onshore-oil-field", ["onshore-tank-", "onshore-wellhead-", "onshore-flare-", "onshore-access-", "onshore-perimeter-"]],
    ["offshore-platform", ["offshore-main-", "offshore-helipad", "offshore-lifeboat-", "offshore-riser-", "offshore-deck-"]],
    ["solar-generation-farm", ["solar-panel-", "solar-transformer-", "solar-farm-"]],
    ["hydroelectric-power-station", ["hydro-dam-", "hydro-spillway", "hydro-upstream-", "hydro-tailrace", "hydro-security-"]],
    ["safe-city-district", ["safe-city-plaza", "safe-city-main-", "safe-city-cross-", "safe-city-park-", "safe-city-transit-", "safe-city-plaza-light-"]],
    ["urban-sports-complex", ["sports-playing-", "sports-running-", "sports-north-", "sports-south-", "sports-east-", "sports-gates-", "sports-parking-"]],
    ["compact-data-centre", ["data-centre-access-"]],
    ["regional-airport-terminal", ["airport-apron", "airport-aircraft-", "airport-apron-assets-"]],
    ["container-port", ["port-quay", "port-water", "port-crane-", "port-container-", "port-gate-"]],
    ["railway-interchange-station", ["railway-platform-", "railway-track-", "railway-tunnel-", "railway-security-"]],
    ["open-pit-mine", ["mine-pit-", "mine-haul-", "mine-weighbridge", "mine-crusher", "mine-conveyor", "mine-vehicles-"]],
    ["water-treatment-plant", ["water-basin-", "water-channel-", "water-site-"]]
  ]);
  for (const sampleId of auditedSampleIds) {
    for (const floor of createSamplePlan(sampleId).floors) {
      for (const item of floor.obstacles) {
        const group = item.variant ? presetGroups.get(item.variant) : null;
        const explicitlyExterior = (exteriorPrefixes.get(sampleId) ?? []).some((prefix) => item.id.startsWith(prefix));
        if ((group && outdoorGroups.has(group)) || outdoorFixtures.has(item.variant) || explicitlyExterior) continue;
        assert.ok(
          (floor.rooms ?? []).some((room) => pointInPolygon(item.center, room.polygon)),
          `${sampleId}/${floor.id}: indoor item ${item.id} is outside the building`
        );
      }
    }
  }
});

test("corrected public and service entrances remain on their logical façades", () => {
  const shop = createSamplePlan("corner-retail-shop").floors[0];
  assert.equal(shop.doors.find((item) => item.id === "corner-shop-entry")?.wallId, "corner-shop-shell-north");
  assert.equal(shop.doors.find((item) => item.id === "corner-shop-back-exit")?.wallId, "corner-shop-shell-south");

  const market = createSamplePlan("neighbourhood-supermarket").floors[0];
  assert.equal(market.doors.find((item) => item.id === "market-loading-door")?.wallId, "market-shell-north");
  assert.equal(market.walls.find((item) => item.id === "market-back-spine")?.a.z, -7);

  const restaurant = createSamplePlan("neighbourhood-restaurant").floors[0];
  assert.equal(restaurant.doors.find((item) => item.id === "restaurant-customer-entry")?.wallId, "restaurant-shell-south");
  assert.equal(restaurant.doors.find((item) => item.id === "restaurant-backdoor")?.wallId, "restaurant-shell-north");
  assert.equal(restaurant.walls.find((item) => item.id === "restaurant-service-spine")?.a.z, -3);

  const clinic = createSamplePlan("outpatient-clinic").floors[0];
  const emergencyDoor = clinic.doors.find((item) => item.id === "clinic-emergency-entry");
  const emergencyWall = clinic.walls.find((item) => item.id === emergencyDoor?.wallId);
  const emergencyX = emergencyWall.a.x + (emergencyWall.b.x - emergencyWall.a.x) * emergencyDoor.offset;
  const ambulance = clinic.obstacles.find((item) => item.id.startsWith("clinic-ambulance-van"));
  assert.ok(emergencyX < 0 && ambulance.center.x < 0, "ambulance and emergency entrance must share the west approach");
});

test("multi-tile approach roads in the first ten samples have no broken segment", () => {
  for (const sampleId of ["compact-industrial-workshop", "urban-public-parking"]) {
    const roads = createSamplePlan(sampleId).floors[0].obstacles
      .filter((item) => item.variant === "road")
      .toSorted((a, b) => a.center.x - b.center.x);
    assert.ok(roads.length >= 3, `${sampleId} needs a complete approach road`);
    for (let index = 1; index < roads.length; index += 1) {
      const previous = obstacleBounds(roads[index - 1]);
      const current = obstacleBounds(roads[index]);
      assert.ok(current.left <= previous.right + 0.01, `${sampleId} road has a gap before tile ${index + 1}`);
    }
  }
});

test("the second ten samples preserve their corrected architectural circulation", () => {
  const hotel = createSamplePlan("boutique-hotel");
  const hotelFirst = hotel.floors.find((floor) => floor.id === "boutique-hotel-first");
  for (const core of hotelFirst.obstacles.filter((item) => item.variant === "elevator" || item.label.includes("پاگرد"))) {
    const room = hotelFirst.rooms.find((item) => pointInPolygon(core.center, item.polygon));
    assert.ok(
      room?.sectionTypeId === "shared.stairwell" || room?.sectionTypeId === "hotel.floor-corridor",
      `hotel core must open to circulation, not ${room?.name}`
    );
  }
  assert.ok(hotel.floors[0].doors.some((item) => item.id === "boutique-hotel-kitchen-service-exit" && item.swingDirection === "outward"));

  const apartment = createSamplePlan("courtyard-apartment");
  const basement = apartment.floors.find((floor) => floor.id === "courtyard-apartment-basement");
  assert.equal(basement.doors.some((item) => item.type === "window"), false, "a fully buried parking floor must not have façade windows");
  assert.ok(basement.doors.some((item) => item.id === "courtyard-apartment-parking-access"));

  const farm = createSamplePlan("orchard-farm").floors[0];
  const storeEntry = farm.doors.find((item) => item.id === "orchard-farm-store-entry");
  const livestockEntry = farm.doors.find((item) => item.id === "orchard-farm-livestock-entry");
  assert.equal(farm.rooms[roomsBesideOpening(farm, storeEntry)[0]].sectionTypeId, "farm.store");
  assert.equal(farm.rooms[roomsBesideOpening(farm, livestockEntry)[0]].sectionTypeId, "farm.livestock");

  const conference = createSamplePlan("conference-centre").floors[0];
  const emergencyExits = conference.doors.filter((item) => item.id.startsWith("conference-emergency-exit-"));
  assert.equal(emergencyExits.length, 2);
  assert.ok(emergencyExits.every((item) => item.swingDirection === "outward"));

  const showroom = createSamplePlan("car-showroom").floors[0];
  const partsExit = showroom.doors.find((item) => item.id === "car-showroom-parts-service-exit");
  assert.equal(showroom.rooms[roomsBesideOpening(showroom, partsExit)[0]].sectionTypeId, "car-showroom.parts");
});

test("vehicle routes in the second ten samples are continuous and correctly oriented", () => {
  const fuelRoads = createSamplePlan("neighbourhood-fuel-station").floors[0].obstacles.filter((item) => item.variant === "road");
  const fuelStreet = fuelRoads.filter((item) => item.rotationDeg % 180 === 0).toSorted((a, b) => a.center.x - b.center.x);
  assert.deepEqual(fuelStreet.map((item) => item.center.x), [-24, -12, 0, 12, 24]);
  assert.equal(fuelRoads.filter((item) => Math.abs(item.rotationDeg % 180) === 90).length, 2, "fuel station needs two connected driveways");

  const roundabout = createSamplePlan("urban-roundabout").floors[0].obstacles;
  assert.equal(roundabout.filter((item) => item.id.startsWith("urban-roundabout-ring-")).length, 8);
  for (const item of roundabout.filter((entry) => entry.id.startsWith("urban-roundabout-roads-road-"))) {
    const northSouth = item.center.x === 0;
    assert.equal(Math.abs(item.rotationDeg % 180) === 90, northSouth, `${item.id} points across its approach instead of along it`);
  }

  const highway = createSamplePlan("highway-interchange").floors[0].obstacles;
  assert.equal(highway.filter((item) => item.id.startsWith("highway-ramp-segment-")).length, 7);
  for (const z of [-8, 8]) {
    assert.deepEqual(highway.filter((item) => item.id.startsWith("highway-mainline-") && item.center.z === z).map((item) => item.center.x).toSorted((a, b) => a - b), [-18, -6, 6, 18]);
  }

  const constructionRoads = createSamplePlan("active-construction-site").floors[0].obstacles.filter((item) => item.id.startsWith("construction-vehicle-route-"));
  assert.equal(constructionRoads.length, 3, "construction gate needs a route to the loading yard");

  const busRoads = createSamplePlan("bus-terminal").floors[0].obstacles.filter((item) => item.variant === "road").toSorted((a, b) => a.center.z - b.center.z);
  assert.deepEqual(busRoads.map((item) => item.center.z), [-24, -12, 0, 12, 24]);
  assert.ok(busRoads.every((item) => Math.abs(item.rotationDeg % 180) === 90), "bus lane tiles must follow the buses, not cross them");
});

test("the third ten samples preserve realistic service access and safety layout", () => {
  const bus = createSamplePlan("city-bus-fleet").floors[0];
  assert.ok(bus.doors.some((item) => item.id === "city-bus-passenger-door"));
  assert.ok(bus.doors.some((item) => item.id === "city-bus-rear-door"));

  const control = createSamplePlan("security-control-room").floors[0];
  assert.deepEqual(new Set(control.rooms.map((room) => room.sectionTypeId)), new Set([
    "control-room.video-wall", "control-room.power", "control-room.entrance", "control-room.operator"
  ]));

  const warehouse = createSamplePlan("regional-warehouse").floors[0];
  const dockXs = warehouse.doors.filter((item) => item.id.startsWith("regional-warehouse-dock-door-")).map((opening) => {
    const wall = warehouse.walls.find((item) => item.id === opening.wallId);
    return wall.a.x + (wall.b.x - wall.a.x) * opening.offset;
  });
  const truckXs = warehouse.obstacles.filter((item) => item.variant === "truck").map((item) => item.center.x);
  assert.ok(dockXs.every((x) => truckXs.some((truckX) => Math.abs(truckX - x) <= 2.5)), "loading trucks must line up with dock doors");
  assert.ok(warehouse.obstacles.filter((item) => item.variant === "truck").every((item) => item.center.z < -16), "dock vehicles belong outside the dock façade");

  const mall = createSamplePlan("neighbourhood-mall");
  const mallBasement = mall.floors.find((floor) => floor.id === "neighbourhood-mall-basement");
  assert.deepEqual(mallBasement.doors.filter((item) => item.type !== "window").map((item) => item.id), ["neighbourhood-mall-parking-gate"]);
  assert.equal(mallBasement.doors.some((item) => item.type === "window"), false, "buried mall parking must not use façade windows");

  const offshore = createSamplePlan("offshore-platform").floors[0];
  const lifeboatXs = offshore.obstacles.filter((item) => item.id.startsWith("offshore-lifeboat-")).map((item) => item.center.x);
  assert.ok(Math.min(...lifeboatXs) < 0 && Math.max(...lifeboatXs) > 0, "redundant lifeboats must be available on opposite sides of the deck");

  const solar = createSamplePlan("solar-generation-farm").floors[0];
  const inverterRoom = solar.rooms.find((room) => room.sectionTypeId === "solar-farm.inverter");
  assert.ok(solar.obstacles.filter((item) => item.id.startsWith("solar-panel-")).every((item) => !pointInPolygon(item.center, inverterRoom.polygon)), "solar rows must stay outside the inverter building");
});

test("linear infrastructure in the third ten samples has no broken route", () => {
  const roadXs = (sampleId, prefix) => createSamplePlan(sampleId).floors[0].obstacles
    .filter((item) => item.id.startsWith(prefix) && item.variant === "road" && item.rotationDeg % 180 === 0)
    .map((item) => item.center.x)
    .toSorted((a, b) => a - b);

  assert.deepEqual(roadXs("city-bus-fleet", "city-bus-depot-assets-"), [-24, -12, 0, 12, 24]);
  assert.deepEqual(roadXs("urban-substation", "urban-substation-yard-"), [-2, 10, 22]);
  assert.deepEqual(roadXs("transmission-corridor", "transmission-access-road-"), [-30, -18, -6, 6, 18, 30]);
  assert.deepEqual(roadXs("onshore-oil-field", "onshore-access-"), [0, 12, 24]);
  assert.deepEqual(roadXs("solar-generation-farm", "solar-farm-security-"), [0, 12, 24]);
  for (const [sampleId, prefix] of [
    ["urban-substation", "urban-substation-yard-"],
    ["onshore-oil-field", "onshore-access-"],
    ["solar-generation-farm", "solar-farm-security-"]
  ]) {
    const driveway = createSamplePlan(sampleId).floors[0].obstacles.find((item) =>
      item.id.startsWith(prefix) && item.variant === "road" && Math.abs(item.rotationDeg % 180) === 90
    );
    assert.ok(driveway, `${sampleId} needs a driveway from its transverse road to the gate`);
  }

  const pipeline = createSamplePlan("pipeline-monitoring-station").floors[0];
  const pipe = pipeline.obstacles.filter((item) => item.id.startsWith("pipeline-route-segment-")).toSorted((a, b) => a.center.x - b.center.x);
  for (let index = 1; index < pipe.length; index += 1) {
    assert.ok(obstacleBounds(pipe[index]).left <= obstacleBounds(pipe[index - 1]).right, `pipeline gap before segment ${index + 1}`);
  }
  assert.deepEqual(roadXs("pipeline-monitoring-station", "pipeline-site-access-"), [8, 20, 32]);
  assert.equal(pipeline.obstacles.filter((item) => item.id.startsWith("pipeline-site-access-") && item.variant === "road" && Math.abs(item.rotationDeg % 180) === 90).length, 2);

  const oil = createSamplePlan("onshore-oil-field").floors[0];
  const gate = oil.obstacles.find((item) => item.variant === "gate-sliding");
  const gateBounds = obstacleBounds(gate);
  const fences = oil.obstacles.filter((item) => item.variant === "fence-mesh" || item.variant === "fence-wall").map(obstacleBounds);
  assert.ok(fences.every((fence) => fence.right <= gateBounds.left + 0.5 || fence.left >= gateBounds.right), "the perimeter fence must leave the vehicle gate clear");
});

test("the final nine samples preserve corrected public, secure and industrial circulation", () => {
  const adjacentType = (floor, openingId) => {
    const opening = floor.doors.find((item) => item.id === openingId);
    return floor.rooms[roomsBesideOpening(floor, opening)[0]]?.sectionTypeId;
  };

  const hydro = createSamplePlan("hydroelectric-power-station").floors[0];
  assert.equal(adjacentType(hydro, "hydro-turbine-entry"), "hydro-plant.turbine-hall");
  assert.ok(hydro.obstacles.filter((item) => item.id.startsWith("hydro-generator-")).every((item) =>
    hydro.rooms.some((room) => room.sectionTypeId === "hydro-plant.turbine-hall" && pointInPolygon(item.center, room.polygon))
  ));

  const safeCity = createSamplePlan("safe-city-district").floors[0];
  assert.equal(safeCity.rooms.length, 2);
  assert.ok(safeCity.doors.some((item) => item.id === "safe-city-operations-door"));

  const sports = createSamplePlan("urban-sports-complex").floors[0];
  assert.equal(sports.doors.find((item) => item.id === "sports-main-gate")?.wallId, "sports-ticket-building-north");
  assert.equal(sports.doors.find((item) => item.id === "sports-venue-entry")?.wallId, "sports-ticket-building-south");

  const dataCentre = createSamplePlan("compact-data-centre").floors[0];
  assert.equal(adjacentType(dataCentre, "data-centre-secure-entry"), "data-centre.entrance");
  assert.equal(adjacentType(dataCentre, "data-centre-loading-door"), "data-centre.loading");
  assert.equal(dataCentre.doors.find((item) => item.id === "data-centre-secure-entry")?.wallId, "data-centre-shell-north");
  assert.equal(dataCentre.doors.find((item) => item.id === "data-centre-loading-door")?.wallId, "data-centre-shell-south");

  const airport = createSamplePlan("regional-airport-terminal").floors[0];
  assert.deepEqual(new Set(airport.rooms.map((room) => room.sectionTypeId)), new Set([
    "airport.security-gate", "airport.check-in", "airport.transit-hall", "airport.baggage"
  ]));
  assert.equal(adjacentType(airport, "airport-main-entry"), "airport.check-in");
  assert.equal(adjacentType(airport, "airport-apron-exit"), "airport.security-gate");
  assert.ok(airport.obstacles.find((item) => item.id === "airport-apron").center.z < -14, "airside apron must stay opposite the public entrance");

  const mine = createSamplePlan("open-pit-mine").floors[0];
  assert.equal(mine.doors.some((item) => item.type === "window"), false, "explosives storage must not have an ordinary window");
  const pit = obstacleBounds(mine.obstacles.find((item) => item.id === "mine-pit-outer"));
  const conveyor = obstacleBounds(mine.obstacles.find((item) => item.id === "mine-conveyor"));
  const crusher = obstacleBounds(mine.obstacles.find((item) => item.id === "mine-crusher"));
  assert.equal(conveyor.left, pit.right);
  assert.equal(conveyor.right, crusher.left);

  const water = createSamplePlan("water-treatment-plant").floors[0];
  assert.equal(adjacentType(water, "water-control-main-entry"), "water-plant.control");
  assert.ok(water.doors.some((item) => item.id === "water-pump-chemical-door"));
  assert.ok(water.doors.some((item) => item.id === "water-chemical-control-door"));
});

test("transport routes in the final nine samples are continuous and aligned", () => {
  const horizontalRoadXs = (sampleId, prefix) => createSamplePlan(sampleId).floors[0].obstacles
    .filter((item) => item.id.startsWith(prefix) && item.variant === "road" && item.rotationDeg % 180 === 0)
    .map((item) => item.center.x)
    .toSorted((a, b) => a - b);
  assert.deepEqual(horizontalRoadXs("hydroelectric-power-station", "hydro-security-"), [-30, -18]);
  assert.deepEqual(horizontalRoadXs("container-port", "port-gate-assets-"), [-30, -18, -6, 6, 18]);
  assert.deepEqual(horizontalRoadXs("water-treatment-plant", "water-site-security-"), [17, 29]);

  const railway = createSamplePlan("railway-interchange-station").floors[0];
  assert.equal(railway.doors.find((item) => item.id === "railway-main-entry")?.wallId, "railway-ticket-hall-north");
  assert.equal(railway.doors.find((item) => item.id === "railway-platform-door")?.wallId, "railway-ticket-hall-south");
  const rails = railway.obstacles.filter((item) => item.id.startsWith("railway-track-"));
  assert.deepEqual(rails.map((item) => item.center.z), [15, 16.5, 25, 26.5]);
  assert.ok(rails.every((item) => item.widthM > item.depthM), "rail lines must run east-west between the tunnel mouths");
  assert.deepEqual(railway.obstacles.filter((item) => item.id.startsWith("railway-platform-") && item.kind === "surface").map((item) => item.center.z), [11, 21]);
});

test("Kourosh Mall keeps an escalator beside the stair and elevator on every level", () => {
  const plan = createSamplePlan("kourosh-mall");
  assert.equal(plan.floors.length, 17);
  assert.equal(plan.floors.filter((floor) => floor.id.startsWith("kourosh-parking-b")).length, 7);
  const commercialUnitDoors = plan.floors.flatMap((floor) => floor.doors ?? []).filter((item) => item.id.includes("-shop-") && item.id.endsWith("-door"));
  assert.equal(commercialUnitDoors.length, 542, "Kourosh commercial levels should match the published unit breakdown");
  const ground = plan.floors.find((floor) => floor.id === "kourosh-commercial-ground");
  assert.ok(ground);
  assert.equal(ground.walls.filter((wall) => wall.id.includes("-envelope-")).length, 8, "the mall envelope should use chamfered corners");
  assert.equal(ground.walls.filter((wall) => wall.id.includes("-atrium-")).length, 8, "the central atrium should be an octagonal void");
  const envelopePoints = ground.walls.filter((wall) => wall.id.includes("-envelope-")).flatMap((wall) => [wall.a, wall.b]);
  assert.equal(Math.max(...envelopePoints.map((point) => point.x)) - Math.min(...envelopePoints.map((point) => point.x)), 116);
  assert.equal(Math.max(...envelopePoints.map((point) => point.z)) - Math.min(...envelopePoints.map((point) => point.z)), 82);
  const b1 = plan.floors.find((floor) => floor.id === "kourosh-commercial-b1");
  const b1Frontages = b1.walls
    .filter((wall) => wall.id.includes("-shop-") && wall.id.endsWith("-front"))
    .map((wall) => Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z));
  assert.equal(b1Frontages.length, 195);
  assert.ok(Math.min(...b1Frontages) >= 2.8, "shops need realistic frontage instead of folder-like slivers");
  for (const floor of plan.floors) {
    const elevators = floor.obstacles.filter((item) => item.variant === "elevator");
    const escalators = floor.obstacles.filter((item) => item.variant === "escalator");
    const stairsOrLandings = floor.obstacles.filter((item) => item.variant === "stairs-straight" || item.label.includes("پاگرد نهایی"));
    assert.equal(elevators.length, 8, `${floor.id} needs the passenger and service elevator banks`);
    assert.equal(stairsOrLandings.length, 4, `${floor.id} needs four emergency circulation cores`);
    const expectsEscalators = !floor.id.startsWith("kourosh-parking-b") && floor.id !== "kourosh-roof-7";
    assert.equal(escalators.length, expectsEscalators ? 4 : 0, `${floor.id} escalator count must match its public circulation role`);
  }
});

test("Mega Mall reproduces its public programme as a dense eight-level complex", () => {
  const plan = createSamplePlan("mega-mall");
  const objects = plan.floors.flatMap((floor) => floor.obstacles);
  const shopDoors = plan.floors.flatMap((floor) => floor.doors ?? []).filter((item) => item.id.includes("-shop-") && item.id.endsWith("-door"));
  assert.equal(plan.floors.length, 8);
  assert.equal(plan.floors.filter((floor) => floor.id.startsWith("mega-parking-b")).length, 3);
  assert.equal(shopDoors.length, 210);
  assert.equal(objects.filter((item) => item.id.startsWith("mega-cinema-hall-")).length, 10);
  assert.ok(objects.length >= 450, "Mega Mall should be fully furnished rather than diagrammatic");
  for (const floor of plan.floors) {
    assert.equal(floor.obstacles.filter((item) => item.variant === "elevator").length, 6, `${floor.id} elevator banks`);
    const expectsEscalators = !floor.id.startsWith("mega-parking-b") && floor.id !== "mega-cinema-4";
    assert.equal(floor.obstacles.filter((item) => item.variant === "escalator").length, expectsEscalators ? 4 : 0, `${floor.id} escalators`);
  }
});

test("the five-floor hospital separates real clinical departments and equipment", () => {
  const plan = createSamplePlan("general-hospital");
  const objects = plan.floors.flatMap((floor) => floor.obstacles);
  const represented = new Set(objects.map((item) => item.variant));
  assert.equal(plan.floors.length, 5);
  assert.ok(plan.floors.some((floor) => floor.name.includes("اورژانس")));
  assert.ok(plan.floors.some((floor) => floor.name.includes("ICU")));
  assert.ok(plan.floors.some((floor) => floor.name.includes("زایمان")));
  for (const variant of ["hospital-bed", "stretcher", "exam-table", "nurse-station", "medical-cart", "privacy-screen"]) {
    assert.ok(represented.has(variant), `hospital needs ${variant}`);
  }
  assert.ok(objects.length >= 170);
});

test("public-safety and education samples stay detailed without copying a sensitive real site", () => {
  const expectations = {
    "police-station": { floors: 4, objects: 120 },
    "barracks-campus": { floors: 4, objects: 170 },
    "school-campus": { floors: 4, objects: 300 }
  };
  for (const [id, expected] of Object.entries(expectations)) {
    const plan = createSamplePlan(id);
    const objects = plan.floors.flatMap((floor) => floor.obstacles);
    assert.equal(plan.floors.length, expected.floors);
    assert.ok(objects.length >= expected.objects, `${id} is too sparse`);
    assert.equal(new Set(objects.map((item) => item.id)).size, objects.length, `${id} object ids must be unique`);
  }
});

test("the compact ribbon keeps essential assets visible and gates advanced categories", () => {
  const source = fs.readFileSync(path.resolve("src", "components", "planner", "FloorPlanDesigner.tsx"), "utf8");
  const essentials = source.slice(source.indexOf('className="plan-ribbon-section plan-ribbon-essentials"'), source.indexOf('className="plan-ribbon-section plan-ribbon-view"'));
  const advanced = source.slice(source.indexOf('className="plan-element-strip is-advanced"'), source.indexOf('className="plan-defaults-section"'));
  const ribbon = source.slice(source.indexOf('className="plan-toolbar plan-ribbon"'), source.indexOf('className="plan-element-strip is-advanced"'));

  for (const group of ["vehicle", "structure", "tree"]) assert.ok(essentials.includes(`group="${group}"`), `${group} must stay in the main ribbon`);
  for (const group of ["vehicle", "structure", "tree"]) assert.equal(advanced.includes(`group="${group}"`), false, `${group} must not be duplicated in advanced assets`);
  assert.ok(source.includes('useState(false);'));
  assert.ok(source.includes('mode === "environment" && showAdvancedElements'));
  assert.ok(source.includes('className="plan-history-actions"'));
  assert.ok(source.includes('"plan-advanced-switch is-active"'));
  assert.ok(source.includes('className="plan-advanced-switch-track"'));
  assert.equal(source.includes("plan-advanced-toggle"), false);
  assert.ok(source.includes('<span>ساختمان</span>'));
  assert.ok(essentials.includes('item.id === "structural-column"'));
  assert.ok(essentials.includes('<span>ستون</span>'));
  assert.equal(ribbon.includes("پوشش DORI"), false, "DORI must not consume main-ribbon space");
  assert.ok(source.includes('className={showCoverage ? "plan-coverage-toggle active" : "plan-coverage-toggle"}'));
});

test("work and dining chairs face their nearest table", () => {
  const tableVariants = new Set(["office-desk", "meeting-table", "dining-table"]);
  for (const sampleId of ["luxury-villa", "modern-office", "retail-gallery", "factory-campus", "residential-parking", "kourosh-mall"]) {
    for (const floor of createSamplePlan(sampleId).floors) {
      const tables = floor.obstacles.filter((item) => tableVariants.has(item.variant));
      for (const chair of floor.obstacles.filter((item) => item.variant === "office-chair" || item.variant === "dining-chair")) {
        const nearest = tables
          .map((table) => ({ table, distance: Math.hypot(table.center.x - chair.center.x, table.center.z - chair.center.z) }))
          .toSorted((a, b) => a.distance - b.distance)[0];
        assert.ok(nearest && nearest.distance < 2.5, `${sampleId}/${chair.id} is detached from a table`);

        const angle = (chair.rotationDeg ?? 0) * Math.PI / 180;
        const forward = { x: -Math.sin(angle), z: Math.cos(angle) };
        const toTable = {
          x: (nearest.table.center.x - chair.center.x) / nearest.distance,
          z: (nearest.table.center.z - chair.center.z) / nearest.distance
        };
        const alignment = forward.x * toTable.x + forward.z * toTable.z;
        assert.ok(alignment > 0.5, `${sampleId}/${chair.id} faces away from ${nearest.table.id}`);
      }
    }
  }
});

test("tall furniture blocks the view and low furniture does not", () => {
  const byId = (id) => obstaclePresets.find((preset) => preset.id === id);
  // A camera on the ceiling sees over a sofa but not over a wardrobe; the flags have to
  // agree with the heights or the coverage map lies.
  assert.equal(byId("sofa-three").blocksView, false);
  assert.equal(byId("coffee-table").blocksView, false);
  assert.equal(byId("wardrobe").blocksView, true);
  assert.equal(byId("bookshelf").blocksView, true);
  assert.equal(byId("fridge").blocksView, true);
  for (const preset of obstaclePresets.filter((item) => item.blocksView === true && item.group !== "site")) {
    assert.ok(preset.heightM >= 1.5, `${preset.id} blocks view at only ${preset.heightM} m`);
  }
});

test("obstacle library exposes five differently sized vehicle models", () => {
  const vehicles = obstaclePresets.filter((item) => item.group === "vehicle");
  assert.equal(vehicles.length, 5);
  assert.equal(new Set(vehicles.map((item) => `${item.widthM}:${item.depthM}:${item.heightM}`)).size, 5);
  assert.ok(vehicles.every((item) => item.kind === "vehicle"));
});

test("tree presets are configurable blocking obstacles", () => {
  const trees = obstaclePresets.filter((item) => item.group === "tree");
  assert.deepEqual(trees.map((item) => item.id), ["deciduous", "conifer", "palm"]);

  const source = {
    id: "obstacle-1",
    label: "custom",
    kind: "block",
    center: { x: 2, z: 3 },
    widthM: 1,
    depthM: 1,
    heightM: 1,
    rotationDeg: 25,
    blocksView: false
  };
  const result = applyObstaclePreset(source, trees[0]);
  assert.equal(result.kind, "tree");
  assert.equal(result.variant, "deciduous");
  assert.equal(result.blocksView, true);
  assert.deepEqual(result.center, source.center);
  assert.equal(result.rotationDeg, 25);
});

test("vehicle and tree visuals are detailed multi-mesh models", () => {
  const build = (variant) => {
    const preset = obstaclePresets.find((item) => item.id === variant);
    return buildObstacleMesh(THREE, {
      id: variant,
      label: preset.label,
      kind: preset.kind,
      variant: preset.id,
      center: { x: 0, z: 0 },
      widthM: preset.widthM,
      depthM: preset.depthM,
      heightM: preset.heightM,
      rotationDeg: 0,
      blocksView: true
    }, false);
  };

  const sedan = build("sedan");
  const deciduous = build("deciduous");
  const palm = build("palm");
  assert.ok(sedan.children.length >= 15, "car should include body, glazing, lights, wheels and hubs");
  assert.ok(deciduous.children.length >= 9, "tree should include trunk, branches and foliage clusters");
  assert.ok(palm.children.length >= 40, "palm should include a segmented trunk and curved fronds");
});

test("every vehicle and tree variant ships a valid binary glTF asset", () => {
  // Only these two groups are asset-backed. Landscape, site and structure elements are
  // built procedurally, so an exclusion list would silently demand models for them.
  for (const preset of obstaclePresets.filter((item) => item.group === "vehicle" || item.group === "tree")) {
    const assetPath = path.resolve("public", "models", "obstacles", `${preset.id}.glb`);
    const bytes = fs.readFileSync(assetPath);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF", `${preset.id} must be a GLB file`);
    assert.ok(bytes.length > 10_000, `${preset.id} model should not be an empty placeholder`);
    if (preset.group === "vehicle") {
      assert.equal(bytes.includes(Buffer.from('"uri":"Textures/colormap.png"')), false, `${preset.id} texture must be embedded`);
      assert.equal(bytes.includes(Buffer.from('"mimeType":"image/png"')), true, `${preset.id} must declare its embedded texture`);
    }
  }
  assert.ok(fs.statSync(path.resolve("public", "models", "obstacles", "Textures", "colormap.png")).size > 10_000);
});

test("stairs preset builds individual steps and handrails", () => {
  const preset = obstaclePresets.find((item) => item.id === "stairs-straight");
  assert.ok(preset);
  const stairs = buildObstacleMesh(THREE, {
    id: "stairs", label: preset.label, kind: preset.kind, variant: preset.id,
    center: { x: 0, z: 0 }, widthM: preset.widthM, depthM: preset.depthM,
    heightM: preset.heightM, rotationDeg: 0, blocksView: true
  }, false);
  assert.ok(stairs.children.length >= 20);
});

test("structural column is a round editable structure element", () => {
  const preset = obstaclePresets.find((item) => item.id === "structural-column");
  assert.ok(preset);
  assert.equal(preset.group, "structure");
  assert.equal(preset.kind, "pillar");
  const column = buildObstacleMesh(THREE, {
    id: "column", label: preset.label, kind: preset.kind, variant: preset.id,
    center: { x: 0, z: 0 }, widthM: 0.6, depthM: 0.6,
    heightM: 3.4, rotationDeg: 0, blocksView: true
  }, false);
  assert.equal(column.geometry.type, "CylinderGeometry");
  assert.equal(column.position.y, 1.7);
});

test("elevator preset builds a recognizable shaft and sliding doors", () => {
  const preset = obstaclePresets.find((item) => item.id === "elevator");
  assert.ok(preset);
  const elevator = buildObstacleMesh(THREE, {
    id: "elevator", label: preset.label, kind: preset.kind, variant: preset.id,
    center: { x: 0, z: 0 }, widthM: preset.widthM, depthM: preset.depthM,
    heightM: preset.heightM, rotationDeg: 0, blocksView: true
  }, false);
  assert.ok(elevator.children.length >= 9);
});

test("escalator preset builds moving-step geometry, glass sides and handrails", () => {
  const preset = obstaclePresets.find((item) => item.id === "escalator");
  assert.ok(preset);
  const escalator = buildObstacleMesh(THREE, {
    id: "escalator", label: preset.label, kind: preset.kind, variant: preset.id,
    center: { x: 0, z: 0 }, widthM: preset.widthM, depthM: preset.depthM,
    heightM: preset.heightM, rotationDeg: 0, blocksView: false
  }, false);
  assert.ok(escalator.children.length >= 40);
});

test("rotation begins only from the endpoint handle, never the item body or guide line", () => {
  const cameraHandle = buildYawHandle(THREE, "camera-1", { x: 0, z: 0 }, 3, 0);
  const cameraTargets = cameraHandle.children.filter((child) => child.userData.kind === "camera-yaw");
  assert.equal(cameraTargets.length, 1);
  assert.ok(cameraTargets[0].position.x > 1, "camera rotate target should sit away from its body");

  const obstacleHandle = buildObstacleRotateHandle(THREE, {
    id: "chair-1", label: "chair", kind: "seating", variant: "office-chair",
    center: { x: 0, z: 0 }, widthM: 0.6, depthM: 0.6, heightM: 1.1,
    rotationDeg: 0, blocksView: false
  });
  const obstacleTargets = obstacleHandle.children.filter((child) => child.userData.kind === "obstacle-rotate");
  assert.equal(obstacleTargets.length, 1);
  assert.ok(obstacleTargets[0].position.x > 1, "obstacle rotate target should be the arrow tip");
});

test("rotation magnetically locks to cardinal axes and leaves other angles free", () => {
  assert.equal(snapRotationAngle(2.8), 0);
  assert.equal(snapRotationAngle(87.2), 90);
  assert.equal(snapRotationAngle(181.5), 180);
  assert.equal(snapRotationAngle(357.4), 0);
  assert.equal(snapRotationAngle(44), 44);
  assert.equal(snapRotationAngle(44, true), 45);
  assert.equal(isCardinalAngle(270), true);
  assert.equal(isCardinalAngle(45), false);

  const cardinalHandle = buildYawHandle(THREE, "camera-cardinal", { x: 0, z: 0 }, 3, 90);
  const freeHandle = buildYawHandle(THREE, "camera-free", { x: 0, z: 0 }, 3, 45);
  assert.equal(cardinalHandle.children[1].material.color.getHex(), 0xef4444);
  assert.equal(freeHandle.children[1].material.color.getHex(), 0xf59e0b);
});

test("closed lower floors produce a red footprint guide and preview slab", () => {
  const floor = {
    id: "ground", name: "همکف", elevationM: 0, heightM: 3.2,
    walls: [
      { id: "a", a: { x: 0, z: 0 }, b: { x: 8, z: 0 }, heightM: 3, thicknessM: 0.2, blocksView: true },
      { id: "b", a: { x: 8, z: 0 }, b: { x: 8, z: 6 }, heightM: 3, thicknessM: 0.2, blocksView: true },
      { id: "c", a: { x: 8, z: 6 }, b: { x: 0, z: 6 }, heightM: 3, thicknessM: 0.2, blocksView: true },
      { id: "d", a: { x: 0, z: 6 }, b: { x: 0, z: 0 }, heightM: 3, thicknessM: 0.2, blocksView: true }
    ],
    doors: [], obstacles: [], cameras: []
  };
  assert.equal(buildFloorFootprintGuide(THREE, floor).children.length, 4);
  assert.equal(buildFloorSlab(THREE, floor, true).children.length, 1);
  assert.equal(buildOverallDimensionGuide(THREE, floor).children.length, 10);

  const overallLabels = collectDimensionLabels(floor);
  assert.deepEqual(overallLabels.map((item) => item.kind), ["overall-length", "overall-width"]);
  assert.ok(overallLabels[0].text.includes("8.0"));
  assert.ok(overallLabels[1].text.includes("6.0"));
  const selectedWallLabels = collectDimensionLabels(floor, "a");
  assert.equal(selectedWallLabels.length, 3);
  assert.equal(selectedWallLabels[2].kind, "selected-wall");
});

test("disposed floor scenes invalidate every obstacle render scope", () => {
  const sceneGroup = new THREE.Group();
  const obstacle = buildObstacleMesh(THREE, {
    id: "floor-a-obstacle",
    label: "مانع طبقه اول",
    kind: "stairs",
    variant: "stairs-straight",
    center: { x: 0, z: 0 },
    widthM: 4.2,
    depthM: 1.4,
    heightM: 3.2,
    rotationDeg: 0,
    blocksView: true
  }, false, { floorId: "floor-a", sceneGeneration: 7 });
  sceneGroup.add(obstacle);

  assert.equal(obstacle.userData.floorId, "floor-a");
  assert.ok(obstacle.children.every((child) => child.userData.floorId === "floor-a"));
  disposeGroup(sceneGroup);
  assert.equal(obstacle.userData.sceneDisposed, true);
  assert.equal(obstacle.parent, null);
});
