import assert from "node:assert/strict";
import test from "node:test";
import { defaultPlanDefaults } from "@/src/domain/planner/types";
import { recommendCameraSelection } from "@/src/lib/planner/camera-selection";

const rect = (x, z, width, depth) => [
  { x, z },
  { x: x + width, z },
  { x: x + width, z: z + depth },
  { x, z: z + depth }
];

const brief = {
  projectType: "shop",
  cameraCount: 0,
  outdoorCount: 0,
  entrances: 1,
  goal: "mixed",
  archiveDays: 30,
  budget: "balanced",
  recordingMode: "motion",
  motionActivityPercent: 40,
  bitrateMode: "VBR",
  recordAudio: false,
  audioBitrateKbps: 64,
  filesystemOverheadPercent: 5,
  vbrSafetyMarginPercent: 20,
  reservePercent: 10,
  lowLightPriority: true
};

function planWithRooms(rooms) {
  return {
    venueTypeId: "shop",
    activeFloorId: "floor-1",
    gridSizeM: 1,
    snapM: 0.2,
    defaults: defaultPlanDefaults,
    floors: [{
      id: "floor-1",
      name: "همکف",
      elevationM: 0,
      heightM: 3,
      walls: [],
      doors: [],
      obstacles: [],
      cameras: [],
      rooms
    }]
  };
}

test("automatic camera selection prefers 2.8/4 mm indoors and writes placement overrides", () => {
  const plan = planWithRooms([
    { id: "sales", polygon: rect(0, 0, 12, 10), sectionTypeId: "shop.salesfloor", boundarySource: "drawn" },
    { id: "entrance", polygon: rect(12, 0, 4, 4), sectionTypeId: "shop.entrance", boundarySource: "drawn" }
  ]);
  const result = recommendCameraSelection(plan, brief);

  assert.equal(result.analysedSpaces, 2);
  assert.ok(result.totalCameras >= 4);
  assert.ok(result.templates.every((template) => template.focalMm === 2.8 || template.focalMm === 4));
  assert.ok(result.templates.some((template) => template.goal === "face-capture"));
  assert.ok(result.plan.floors[0].rooms.every((room) => room.overrides?.cameraCount >= 1));
  assert.ok(result.plan.floors[0].rooms.every((room) => room.overrides?.megapixel >= 4));
});

test("privacy-protected rooms are excluded from the automatic proposal", () => {
  const result = recommendCameraSelection(planWithRooms([
    { id: "fitting", polygon: rect(0, 0, 4, 4), sectionTypeId: "shop.fitting", boundarySource: "drawn" }
  ]), brief);

  assert.equal(result.analysedSpaces, 0);
  assert.equal(result.excludedSpaces, 1);
  assert.ok(result.notes.some((note) => note.includes("حریم خصوصی")));
});
