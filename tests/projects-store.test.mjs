import assert from "node:assert/strict";
import fs from "node:fs";
import test, { describe } from "node:test";

/**
 * Storage tests for saved projects.
 *
 * These need a real PostgreSQL because the behaviour under test is the schema itself —
 * the cascade from project to asset, the per-user scoping, the in-place replacement.
 * Mocking the driver would only assert that the mock was called. When no database is
 * configured or reachable the suite skips rather than failing, so a checkout without one
 * still runs green.
 */

function loadEnv() {
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    /* no .env.local: rely on the ambient environment */
  }
}

loadEnv();

let store = null;
let reason = "";

if (!process.env.DATABASE_URL) {
  reason = "DATABASE_URL is not set";
} else {
  try {
    store = await import("@/src/lib/projects/store");
    await store.ensureProjectTables();
  } catch (error) {
    store = null;
    reason = `database unreachable: ${String(error?.message ?? error).slice(0, 80)}`;
  }
}

const USER = "__test_user_projects__";
const OTHER = "__test_user_other__";

/** 1×1 transparent PNG, the smallest thing that still exercises the asset path. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const wall = (id, ax, az, bx, bz) => ({
  id, a: { x: ax, z: az }, b: { x: bx, z: bz }, heightM: 3, thicknessM: 0.2, blocksView: true
});

/** 10 × 6 room with a backdrop image, so every column is non-trivial. */
const samplePlan = () => ({
  floors: [{
    id: "f1", name: "همکف", elevationM: 0, heightM: 3.2,
    walls: [wall("w1", 0, 0, 10, 0), wall("w2", 10, 0, 10, 6), wall("w3", 10, 6, 0, 6), wall("w4", 0, 6, 0, 0)],
    doors: [], obstacles: [], cameras: [],
    rooms: [{
      id: "r1",
      polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }],
      sectionTypeId: "shop.checkout",
      boundarySource: "detected"
    }],
    coverageRequirements: [],
    backdrop: {
      imageUrl: TINY_PNG, widthPx: 1, heightPx: 1,
      originM: { x: 0, z: 0 }, metresPerPixel: 0.05, opacity: 0.6, calibrated: true
    }
  }],
  activeFloorId: "f1", gridSizeM: 1, snapM: 1,
  defaults: { wallHeightM: 3, wallThicknessM: 0.2, obstacleHeightM: 1.2, cameraMountHeightM: 2.8 },
  venueTypeId: "shop"
});

const created = [];
const make = async (name = "پروژه آزمون", user = USER) => {
  const project = await store.createProject(user, {
    name, venueTypeId: "shop", brief: { note: "آزمون" }, plan: samplePlan()
  });
  created.push([user, project.id]);
  return project;
};

describe("project storage", { skip: store ? false : reason }, () => {
  test("a saved project computes its own summary", async () => {
    const project = await make();
    assert.equal(project.summary.areaM2, 60);
    assert.equal(project.summary.roomCount, 1);
    assert.equal(project.summary.assignedRoomCount, 1);
    assert.equal(project.summary.floorCount, 1);
  });

  test("the plan drawing is lifted out of the row and served by url", async () => {
    const project = await make();
    const url = project.plan.floors[0].backdrop.imageUrl;
    assert.ok(!url.startsWith("data:"), "the base64 payload must not survive in the plan");
    assert.ok(url.startsWith(`/api/projects/${project.id}/assets/`), url);
  });

  test("listing never carries the heavy plan column", async () => {
    await make();
    const list = await store.listProjects(USER);
    assert.ok(list.length > 0);
    assert.ok(!("plan" in list[0]), "listing a gallery must not read every saved plan");
  });

  test("editing replaces the project rather than branching it", async () => {
    const project = await make("قبل از ویرایش");
    const updated = await store.updateProject(USER, project.id, {
      name: "بعد از ویرایش", venueTypeId: "supermarket", brief: {}, plan: project.plan
    });
    assert.equal(updated.id, project.id, "the same row is rewritten");
    assert.equal(updated.name, "بعد از ویرایش");
    assert.equal(updated.venueTypeId, "supermarket");
    assert.equal(updated.revision, project.revision + 1);
  });

  test("re-saving an untouched drawing does not duplicate it", async () => {
    const project = await make();
    const before = project.plan.floors[0].backdrop.imageUrl;
    const updated = await store.updateProject(USER, project.id, {
      name: project.name, venueTypeId: project.venueTypeId, brief: {}, plan: project.plan
    });
    assert.equal(
      updated.plan.floors[0].backdrop.imageUrl,
      before,
      "an autosave every few seconds must not write the image again each time"
    );
  });

  test("a project belongs to exactly one account", async () => {
    const project = await make();
    assert.equal(await store.getProject(OTHER, project.id), null);
    const assetId = project.plan.floors[0].backdrop.imageUrl.split("/").pop();
    assert.equal(await store.readAsset(OTHER, project.id, assetId), null);
    assert.ok(await store.readAsset(USER, project.id, assetId));
  });

  test("a duplicate gets its own copy of the drawing", async () => {
    const project = await make();
    const copy = await store.duplicateProject(USER, project.id);
    created.push([USER, copy.id]);
    assert.notEqual(copy.id, project.id);
    assert.notEqual(
      copy.plan.floors[0].backdrop.imageUrl,
      project.plan.floors[0].backdrop.imageUrl,
      "deleting the original must not blank the copy"
    );
  });

  test("an oversized drawing is refused by name, not by a database error", async () => {
    const plan = samplePlan();
    plan.floors[0].backdrop.imageUrl = `data:image/png;base64,${"A".repeat(8 * 1024 * 1024)}`;
    await assert.rejects(
      () => store.createProject(USER, { name: "بزرگ", brief: {}, plan }),
      (error) => error.name === "AssetTooLargeError" && error.floorName === "همکف"
    );
  });

  test("deleting a project takes its drawings with it", async () => {
    const project = await make();
    const assetId = project.plan.floors[0].backdrop.imageUrl.split("/").pop();
    assert.equal(await store.deleteProject(USER, project.id), true);
    assert.equal(await store.getProject(USER, project.id), null);
    assert.equal(await store.readAsset(USER, project.id, assetId), null);
  });

  test("cleanup", async () => {
    for (const [user, id] of created) await store.deleteProject(user, id);
    assert.equal((await store.listProjects(USER)).length, 0);
    assert.equal((await store.listProjects(OTHER)).length, 0);
  });
});
