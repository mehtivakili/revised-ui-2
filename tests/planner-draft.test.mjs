import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyPlan } from "@/src/domain/planner/types.ts";
import {
  PLANNER_DRAFT_KEY,
  clearPlannerDraft,
  planHasContent,
  readPlannerDraft,
  summariseDraft,
  writePlannerDraft
} from "@/src/lib/planner/draft.ts";

/** In-memory stand-in for localStorage, with an optional size quota. */
function memoryStorage(quota = Infinity) {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => {
      if (value.length > quota) throw new Error("QuotaExceededError");
      items.set(key, value);
    },
    removeItem: (key) => items.delete(key)
  };
}

const wall = (id, ax, az, bx, bz) => ({ id, a: { x: ax, z: az }, b: { x: bx, z: bz }, heightM: 3, thicknessM: 0.2, blocksView: true });

function drawnPlan() {
  const plan = createEmptyPlan();
  plan.venueTypeId = "office";
  plan.floors[0].walls.push(wall("w1", 0, 0, 6, 0), wall("w2", 6, 0, 6, 4));
  return plan;
}

const base = (plan, id = "draft-a") => ({ id, projectName: "دفتر مرکزی", brief: { floors: 1 }, plan, experience: "advanced", stage: "design" });

test("an empty plan is not worth a draft; a drawn one is", () => {
  assert.equal(planHasContent(createEmptyPlan()), false);
  assert.equal(planHasContent(drawnPlan()), true);
});

test("a draft round-trips and summarises what is on the plan", () => {
  const store = memoryStorage();
  assert.equal(writePlannerDraft(base(drawnPlan()), store), true);
  const draft = readPlannerDraft(store);
  assert.ok(draft);
  assert.equal(draft.id, "draft-a");
  assert.equal(draft.plan.floors[0].walls.length, 2);
  const summary = summariseDraft(draft);
  assert.deepEqual(
    { name: summary.projectName, venue: summary.venueTypeId, floors: summary.floors, walls: summary.walls, elements: summary.elements, cameras: summary.cameras, stage: summary.stage },
    { name: "دفتر مرکزی", venue: "office", floors: 1, walls: 2, elements: 0, cameras: 0, stage: "design" }
  );
});

test("saving one design never clears another design's draft", () => {
  const store = memoryStorage();
  writePlannerDraft(base(drawnPlan(), "draft-a"), store);
  clearPlannerDraft("draft-b", store);
  assert.ok(readPlannerDraft(store), "a different session's id leaves the draft alone");
  clearPlannerDraft("draft-a", store);
  assert.equal(readPlannerDraft(store), null);
  writePlannerDraft(base(drawnPlan(), "draft-c"), store);
  clearPlannerDraft(undefined, store);
  assert.equal(readPlannerDraft(store), null, "discarding clears whatever is there");
});

test("a large scanned drawing is left out rather than losing the whole draft", () => {
  const store = memoryStorage();
  const plan = drawnPlan();
  plan.floors[0].backdrop = {
    imageUrl: `data:image/png;base64,${"A".repeat(1_600_000)}`,
    widthPx: 100, heightPx: 100, originM: { x: 0, z: 0 }, metresPerPixel: 0.05, opacity: 0.6, calibrated: true
  };
  assert.equal(writePlannerDraft(base(plan), store), true);
  const draft = readPlannerDraft(store);
  assert.equal(draft.backdropDropped, true);
  assert.equal(draft.plan.floors[0].backdrop, undefined);
  assert.equal(draft.plan.floors[0].walls.length, 2, "the drawing itself is kept");
});

test("when storage is nearly full, the draft is still kept without images", () => {
  const plan = drawnPlan();
  plan.floors[0].backdrop = {
    imageUrl: `data:image/png;base64,${"A".repeat(400_000)}`,
    widthPx: 100, heightPx: 100, originM: { x: 0, z: 0 }, metresPerPixel: 0.05, opacity: 0.6, calibrated: true
  };
  const store = memoryStorage(200_000);
  assert.equal(writePlannerDraft(base(plan), store), true);
  assert.equal(readPlannerDraft(store).backdropDropped, true);
});

test("a corrupt or foreign value reads as no draft", () => {
  const store = memoryStorage();
  store.setItem(PLANNER_DRAFT_KEY, "{not json");
  assert.equal(readPlannerDraft(store), null);
  store.setItem(PLANNER_DRAFT_KEY, JSON.stringify({ version: 2, plan: drawnPlan() }));
  assert.equal(readPlannerDraft(store), null);
  store.setItem(PLANNER_DRAFT_KEY, JSON.stringify({ ...base(createEmptyPlan()), version: 1 }));
  assert.equal(readPlannerDraft(store), null, "an empty plan is not offered");
});
