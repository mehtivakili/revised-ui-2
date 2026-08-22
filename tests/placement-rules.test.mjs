import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { recipeFor, roomContext, syncEquipmentRequirements } from "@/src/lib/planner/placement-rules";
import { findSectionType, genericSectionType } from "@/src/domain/planner/venues";
import { createFloor } from "@/src/domain/planner/types";

const section = (id) => {
  const found = findSectionType(id);
  assert.ok(found, `section ${id} should exist in the taxonomy`);
  return found;
};

const context = (overrides = {}) => ({
  ceilingHeightM: 2.8,
  areaM2: 24,
  spanM: 7,
  widthM: 4,
  openAbove: false,
  megapixel: 4,
  sensorWidthMm: 5.12,
  ...overrides
});

describe("housing selection", () => {
  test("indoor rooms get a turret with a dome alternative", () => {
    const recipe = recipeFor(section("shop.salesfloor"), context());
    assert.equal(recipe.housing, "turret");
    assert.equal(recipe.housingAlternative, "dome");
  });

  test("outdoor sections get a bullet", () => {
    assert.equal(recipeFor(section("residential.yard"), context({ areaM2: 120 })).housing, "bullet");
  });

  test("a long perimeter offers a speed dome as the alternative", () => {
    const recipe = recipeFor(section("farm.perimeter"), context({ areaM2: 4000, spanM: 90 }));
    assert.equal(recipe.housing, "bullet");
    assert.equal(recipe.housingAlternative, "ptz");
  });
});

describe("mount height", () => {
  test("a low ceiling keeps the camera just under it", () => {
    const recipe = recipeFor(section("shop.salesfloor"), context({ ceilingHeightM: 2.6 }));
    assert.equal(recipe.mountHeightM, 2.35);
  });

  test("a high ceiling stops the camera at three metres", () => {
    // A monitoring goal, so nothing else competes with the ceiling rule.
    const recipe = recipeFor(section("industrial.production"), context({ ceilingHeightM: 8, spanM: 14 }));
    assert.equal(recipe.mountHeightM, 3);
    assert.ok(
      recipe.reasons.some((reason) => reason.includes("۳ متر")),
      "the reason should name the three-metre rule"
    );
  });

  test("the face rule outranks the ceiling rule", () => {
    // Same 8 metre ceiling, but this space has to show faces, so 3 m is still too high.
    const recipe = recipeFor(section("industrial.warehouse"), context({ ceilingHeightM: 8, spanM: 14 }));
    assert.equal(recipe.goal, "face-capture");
    assert.equal(recipe.mountHeightM, 2.8);
  });

  test("face work pulls the camera down to 2.8 even under a 3 metre ceiling", () => {
    const recipe = recipeFor(section("shop.entrance"), context({ ceilingHeightM: 3.2 }));
    assert.equal(recipe.goal, "face-capture");
    assert.equal(recipe.mountHeightM, 2.8);
  });

  test("an outdoor wall mount also stays below a short wall", () => {
    const recipe = recipeFor(section("residential.yard"), context({ areaM2: 200, spanM: 18 }));
    assert.equal(recipe.mountHeightM, 2.55);
  });

  test("a perimeter pole rises exactly 45 centimetres above the wall", () => {
    assert.equal(recipeFor(section("farm.perimeter"), context({ spanM: 60 })).mountHeightM, 3.25);
  });
});

describe("mount position", () => {
  test("indoor rooms stay on the wall and never fall back to a pole or ceiling", () => {
    const recipe = recipeFor(section("residential.living"), context());
    assert.equal(recipe.mountKind, "corner");
    assert.deepEqual(recipe.mountFallbacks, ["wall-edge"]);
  });

  test("a space with no ceiling never falls back to a ceiling mount", () => {
    const recipe = recipeFor(section("residential.living"), context({ openAbove: true }));
    assert.ok(!recipe.mountFallbacks.includes("ceiling"));
  });

  test("corridors are mounted along the axis rather than in a corner", () => {
    assert.equal(recipeFor(section("shared.corridor"), context({ widthM: 1.8, spanM: 14 })).mountKind, "wall-edge");
  });

  test("perimeters go on a pole", () => {
    assert.equal(recipeFor(section("farm.perimeter"), context({ spanM: 60 })).mountKind, "pole");
  });
});

const INDOOR_PAIR = [2.8, 4];

describe("lens selection", () => {
  test("a small indoor room gets 2.8 mm", () => {
    assert.equal(recipeFor(section("residential.bedroom"), context({ spanM: 5 })).focalMm, 2.8);
  });

  test("a deeper indoor room steps up to 4 mm rather than anything exotic", () => {
    const recipe = recipeFor(section("supermarket.aisle"), context({ spanM: 13, widthM: 2.5 }));
    assert.ok([2.8, 4].includes(recipe.focalMm), `expected the 2.8/4 pair, got ${recipe.focalMm}`);
  });

  test("leaving the 2.8/4 pair indoors is explained", () => {
    const recipe = recipeFor(section("supermarket.checkout-line"), context({ spanM: 26 }));
    if (!INDOOR_PAIR.includes(recipe.focalMm)) {
      assert.ok(
        recipe.reasons.some((reason) => reason.includes("تراکم پیکسل")),
        "an unusual indoor lens must state why"
      );
    }
  });

  test("plate work uses a long lens", () => {
    const recipe = recipeFor(section("parking.entry-ramp"), context({ spanM: 12, openAbove: false }));
    assert.ok(recipe.focalMm >= 8, `plate capture needs a long lens, got ${recipe.focalMm}`);
  });
});

describe("goal and feature separation", () => {
  test("an entrance needs face-grade quality but no analytics on the camera", () => {
    const recipe = recipeFor(section("residential.entrance"), context());
    assert.equal(recipe.goal, "face-capture");
    assert.deepEqual(recipe.requiredFeatures, []);
    assert.ok(recipe.reasons.some((reason) => reason.includes("قابلیت تشخیص چهره روی دوربین لازم نیست")));
  });

  test("a parking ramp reads plates without demanding a plate-reading camera", () => {
    const recipe = recipeFor(section("parking.entry-ramp"), context());
    assert.equal(recipe.goal, "plate-capture");
    assert.deepEqual(recipe.requiredFeatures, []);
  });

  test("an industrial vehicle gate does demand plate reading", () => {
    assert.deepEqual(recipeFor(section("industrial.vehicle-gate"), context()).requiredFeatures, ["anpr"]);
  });

  test("a till needs positive identification", () => {
    assert.equal(recipeFor(section("shop.checkout"), context()).goal, "face-identify");
  });
});

describe("camera count", () => {
  test("a critical entrance is a pair, not a single camera", () => {
    assert.equal(recipeFor(section("shop.entrance"), context()).cameraCount, 2);
  });

  test("an ordinary room is a single camera", () => {
    assert.equal(recipeFor(section("residential.bedroom"), context()).cameraCount, 1);
  });
});

describe("privacy", () => {
  test("no recipe is produced for a protected space", () => {
    assert.equal(recipeFor(section("shop.fitting"), context()), null);
    assert.equal(recipeFor(section("hotel.guest-room"), context()), null);
    assert.equal(recipeFor(section("shared.washroom"), context()), null);
  });

  test("the generic fallback still yields a usable recipe", () => {
    const recipe = recipeFor(genericSectionType, context());
    assert.ok(recipe);
    assert.equal(recipe.housing, "turret");
  });
});

describe("room measurement", () => {
  test("the span is the diagonal, because a corner camera looks across the room", () => {
    const floor = { ...createFloor("طبقه", 0), heightM: 3.2 };
    const room = {
      id: "r1",
      polygon: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 8 }, { x: 0, z: 8 }],
      boundarySource: "detected"
    };
    const measured = roomContext(room, floor);
    assert.equal(Math.round(measured.areaM2), 48);
    assert.equal(Math.round(measured.spanM), 10);
    assert.equal(measured.widthM, 6);
    assert.equal(measured.ceilingHeightM, 3.2, "falls back to the storey height");
  });

  test("manual dimensions override the drawn outline", () => {
    const floor = createFloor("طبقه", 0);
    const room = {
      id: "r1",
      polygon: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 }],
      boundarySource: "enclosing",
      manual: { widthM: 3, depthM: 4 }
    };
    assert.equal(Math.round(roomContext(room, floor).spanM), 5);
  });
});

describe("equipment coverage", () => {
  const rack = {
    id: "rack-1",
    label: "رک NVR",
    kind: "equipment",
    variant: "equipment-rack",
    center: { x: 5, z: 5 },
    widthM: 0.6,
    depthM: 0.8,
    heightM: 1.8,
    rotationDeg: 0,
    blocksView: true
  };

  test("a placed rack raises its own coverage requirement", () => {
    const floor = { ...createFloor("طبقه", 0), obstacles: [rack] };
    const requirements = syncEquipmentRequirements(floor);
    assert.equal(requirements.length, 1);
    assert.equal(requirements[0].origin, "equipment");
    assert.equal(requirements[0].polygon.length, 4);
  });

  test("user areas are preserved alongside the generated ones", () => {
    const floor = {
      ...createFloor("طبقه", 0),
      obstacles: [rack],
      coverageRequirements: [
        { id: "user-1", polygon: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }], label: "ناحیه من", origin: "user" }
      ]
    };
    const requirements = syncEquipmentRequirements(floor);
    assert.equal(requirements.length, 2);
    assert.ok(requirements.some((item) => item.id === "user-1"));
  });

  test("removing the rack removes its requirement", () => {
    const floor = { ...createFloor("طبقه", 0), obstacles: [] };
    assert.equal(syncEquipmentRequirements(floor).length, 0);
  });
});
