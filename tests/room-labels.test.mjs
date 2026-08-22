import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { collectRoomLabels } from "@/src/lib/planner/scene-builders";
import { findSectionType } from "@/src/domain/planner/venues";
import { createFloor } from "@/src/domain/planner/types";

const resolve = (id) => findSectionType(id);

/** 10 × 6 space with its centre at (5, 3). */
const square = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }];

const floorWith = (rooms = [], coverageRequirements = []) => ({
  ...createFloor("طبقه", 0),
  rooms,
  coverageRequirements
});

const labelFor = (room) => collectRoomLabels(floorWith([room]), resolve)[0];

describe("room badges", () => {
  test("a space with no type says so, and is marked as the problem it is", () => {
    const label = labelFor({ id: "r1", polygon: square, boundarySource: "detected" });
    assert.equal(label.text, "بدون فضا");
    assert.equal(label.subtext, "نوع کاربری مشخص نشده");
    assert.equal(label.kind, "room-unassigned");
  });

  test("an unnamed space shows its section type as the headline", () => {
    const label = labelFor({
      id: "r1", polygon: square, sectionTypeId: "shop.checkout", boundarySource: "detected"
    });
    assert.equal(label.text, "صندوق فروش");
    assert.equal(label.subtext, undefined, "with no name there is nothing to put on a second line");
    assert.equal(label.kind, "room");
  });

  test("a named space shows the name above and the type below", () => {
    const label = labelFor({
      id: "r1",
      polygon: square,
      sectionTypeId: "shop.checkout",
      name: "صندوق جلوی در",
      boundarySource: "detected"
    });
    assert.equal(label.text, "صندوق جلوی در");
    assert.equal(label.subtext, "صندوق فروش", "the kind of space is never lost behind the name");
  });

  test("a whitespace-only name falls back to the type rather than rendering blank", () => {
    const label = labelFor({
      id: "r1", polygon: square, sectionTypeId: "shop.checkout", name: "   ", boundarySource: "detected"
    });
    assert.equal(label.text, "صندوق فروش");
  });

  test("a protected space gets its own styling hook", () => {
    const label = labelFor({
      id: "r1", polygon: square, sectionTypeId: "shop.fitting", boundarySource: "detected"
    });
    assert.equal(label.kind, "room-forbidden");
    assert.equal(label.text, "اتاق پرو");
  });

  test("the badge sits at the centre of the space", () => {
    const label = labelFor({ id: "r1", polygon: square, boundarySource: "detected" });
    assert.equal(Math.round(label.world.x), 5);
    assert.equal(Math.round(label.world.z), 3);
    assert.ok(label.world.y > 0, "and floats above the floor so it is not z-fighting the fill");
  });

  test("a custom section type is resolved like any other", () => {
    const custom = {
      id: "custom.1", venueIds: [], label: "اتاق ژنراتور", aliases: [],
      environment: "indoor-room", priority: "important", goal: "monitor",
      requiredFeatures: [], isCustom: true
    };
    const floor = floorWith([
      { id: "r1", polygon: square, sectionTypeId: "custom.1", boundarySource: "drawn" }
    ]);
    const label = collectRoomLabels(floor, (id) => findSectionType(id, [custom]))[0];
    assert.equal(label.text, "اتاق ژنراتور");
    assert.equal(label.kind, "room");
  });
});

describe("must-cover badges", () => {
  test("a required area is labelled with its own name and purpose", () => {
    const labels = collectRoomLabels(
      floorWith([], [{ id: "c1", polygon: square, label: "گاوصندوق", origin: "user" }]),
      resolve
    );
    assert.equal(labels.length, 1);
    assert.equal(labels[0].text, "گاوصندوق");
    assert.equal(labels[0].subtext, "پوشش اجباری");
    assert.equal(labels[0].kind, "room-requirement");
  });

  test("a required sub-area shows the checklist item it represents", () => {
    const labels = collectRoomLabels(
      floorWith([], [{
        id: "c2", polygon: square, label: "صندوق کوچک", origin: "user", sectionTypeId: "shop.checkout"
      }]),
      resolve
    );
    assert.ok(labels[0].subtext.includes("صندوق فروش"));
  });
});

describe("degenerate input", () => {
  test("an outline with fewer than three points produces no badge", () => {
    const labels = collectRoomLabels(
      floorWith([{ id: "r1", polygon: [{ x: 0, z: 0 }, { x: 1, z: 1 }], boundarySource: "drawn" }]),
      resolve
    );
    assert.equal(labels.length, 0);
  });

  test("a floor with no rooms produces no badges", () => {
    assert.deepEqual(collectRoomLabels(createFloor("طبقه", 0), resolve), []);
  });
});
