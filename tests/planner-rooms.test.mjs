import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  detectRooms,
  overlapRatio,
  reconcileRooms,
  roomAreaM2,
  roomAtPoint,
  roomsAtPoint,
  unassignedRooms
} from "@/src/lib/planner/rooms";
import { createFloor } from "@/src/domain/planner/types";

const wall = (id, ax, az, bx, bz) => ({
  id, a: { x: ax, z: az }, b: { x: bx, z: bz }, heightM: 3, thicknessM: 0.2, blocksView: true
});

const floorWith = (walls, rooms = []) => ({ ...createFloor("طبقه", 0), walls, rooms });

/** 10 × 6 closed room. */
const singleRoom = [
  wall("w1", 0, 0, 10, 0),
  wall("w2", 10, 0, 10, 6),
  wall("w3", 10, 6, 0, 6),
  wall("w4", 0, 6, 0, 0)
];

/**
 * Two rooms sharing a spine wall:
 *
 *   0,0 ────── 10,0
 *    │    A     │
 *   0,6 ────── 10,6      ← shared
 *    │    B     │
 *   0,12 ───── 10,12
 */
const twoRooms = [
  wall("t1", 0, 0, 10, 0),
  wall("t2", 10, 0, 10, 6),
  wall("t3", 10, 6, 0, 6),
  wall("t4", 0, 6, 0, 0),
  wall("t5", 10, 6, 10, 12),
  wall("t6", 10, 12, 0, 12),
  wall("t7", 0, 12, 0, 6)
];

/** Three sides of an 8 × 5 rectangle; the mouth at z = 0 is left open. */
const threeSided = [
  wall("u1", 0, 0, 0, 5),
  wall("u2", 0, 5, 8, 5),
  wall("u3", 8, 5, 8, 0)
];

/** A rectangle added from the middle of an existing wall, as the canvas tool stores it. */
const rectangleAttachedToWall = [
  ...singleRoom,
  wall("a1", 3, 0, 7, 0), // deliberately coincides with part of w1
  wall("a2", 7, 0, 7, -3),
  wall("a3", 7, -3, 3, -3),
  wall("a4", 3, -3, 3, 0)
];

describe("room detection", () => {
  test("a closed rectangle becomes one room", () => {
    const detection = detectRooms(floorWith(singleRoom));
    assert.equal(detection.closed.length, 1);
    assert.equal(Math.round(detection.closed[0].areaM2), 60);
    assert.equal(detection.closed[0].boundarySource, "detected");
    assert.equal(detection.openRegions.length, 0);
  });

  test("an internal loose partition is not reported as a room that needs closing", () => {
    const internalPartition = [
      wall("p1", 2, 2, 5, 2),
      wall("p2", 5, 2, 5, 4)
    ];
    const detection = detectRooms(floorWith([...singleRoom, ...internalPartition]));
    assert.equal(detection.closed.length, 1);
    assert.equal(detection.openRegions.length, 0, "an internal partition is not an open perimeter");
  });

  test("a shared wall yields two rooms, not one merged outline", () => {
    const detection = detectRooms(floorWith(twoRooms));
    assert.equal(detection.closed.length, 2, "each side of the spine is its own space");
    const areas = detection.closed.map((room) => Math.round(room.areaM2)).sort((a, b) => a - b);
    assert.deepEqual(areas, [60, 60]);
  });

  test("a rectangle drawn from the middle of an existing wall creates a second room", () => {
    const detection = detectRooms(floorWith(rectangleAttachedToWall));
    assert.equal(detection.closed.length, 2, "T-junctions are real corners in the room graph");
    const areas = detection.closed.map((room) => Math.round(room.areaM2)).sort((a, b) => a - b);
    assert.deepEqual(areas, [12, 60]);
    assert.equal(detection.openRegions.length, 0, "the coincident side is not reported as an opening");
  });

  test("a visually touching side room closes against a host wall despite small centreline gaps", () => {
    const attachedOnLeft = [
      ...singleRoom,
      wall("left-top", -4, 1.5, -0.22, 1.5),
      wall("left-outer", -4, 1.5, -4, 4.5),
      wall("left-bottom", -4, 4.5, -0.22, 4.5)
    ];
    const detection = detectRooms(floorWith(attachedOnLeft));

    assert.equal(detection.closed.length, 2, "the host wall supplies the side shared by both rooms");
    const areas = detection.closed.map((room) => Math.round(room.areaM2)).sort((a, b) => a - b);
    assert.deepEqual(areas, [12, 60]);
  });

  test("a real opening wider than the visual junction tolerance stays open", () => {
    const detachedOnLeft = [
      ...singleRoom,
      wall("left-top", -4, 1.5, -0.35, 1.5),
      wall("left-outer", -4, 1.5, -4, 4.5),
      wall("left-bottom", -4, 4.5, -0.35, 4.5)
    ];
    const detection = detectRooms(floorWith(detachedOnLeft));

    assert.equal(detection.closed.length, 1, "a deliberate gap must not invent another room");
  });

  test("the outer face is discarded rather than reported as a room", () => {
    const detection = detectRooms(floorWith(twoRooms));
    const total = detection.closed.reduce((sum, room) => sum + room.areaM2, 0);
    assert.equal(Math.round(total), 120, "120 not 240 — the surrounding face is not a room");
  });

  test("three sides of a rectangle offer an inferred fourth side", () => {
    const detection = detectRooms(floorWith(threeSided));
    assert.equal(detection.closed.length, 0);
    assert.equal(detection.openRegions.length, 1);

    const region = detection.openRegions[0];
    assert.equal(region.isRectangleGap, true, "the run is recognised as a rectangle gap");
    assert.ok(region.inferred, "closing the run is offered");
    assert.equal(region.inferred.boundarySource, "inferred");
    assert.equal(Math.round(region.inferred.areaM2), 40);
    assert.equal(region.inferred.impliedEdgeIndices.length, 1, "exactly one edge is implied");
  });

  test("an open run also offers the larger enclosing region", () => {
    const region = detectRooms(floorWith(threeSided)).openRegions[0];
    assert.equal(region.enclosing.boundarySource, "enclosing");
    assert.ok(
      region.enclosing.areaM2 > region.inferred.areaM2,
      "the enclosing offer reaches past the drawn walls"
    );
  });

  test("an L of two walls gets no inferred room but still gets an enclosing one", () => {
    const detection = detectRooms(floorWith([wall("l1", 0, 0, 6, 0), wall("l2", 6, 0, 6, 4)]));
    assert.equal(detection.closed.length, 0);
    assert.equal(detection.openRegions.length, 1);
    assert.equal(detection.openRegions[0].isRectangleGap, false);
    assert.equal(detection.openRegions[0].inferred, null, "two walls cannot bound an area");
    assert.ok(detection.openRegions[0].enclosing.areaM2 > 0);
  });
});

describe("room reconciliation", () => {
  test("open runs produce no room until the user picks a resolution", () => {
    assert.equal(reconcileRooms(floorWith(threeSided)).length, 0);
    assert.equal(reconcileRooms(floorWith(threeSided), { openChoices: {} }).length, 0);
  });

  test("choosing the inferred outline creates the room", () => {
    const floor = floorWith(threeSided);
    const region = detectRooms(floor).openRegions[0];
    const rooms = reconcileRooms(floor, { openChoices: { [region.id]: "inferred" } });
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].boundarySource, "inferred");
    assert.deepEqual(rooms[0].impliedEdgeIndices, [3]);
  });

  test("choosing the enclosing region creates a larger room instead", () => {
    const floor = floorWith(threeSided);
    const region = detectRooms(floor).openRegions[0];
    const rooms = reconcileRooms(floor, { openChoices: { [region.id]: "enclosing" } });
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].boundarySource, "enclosing");
    assert.ok(roomAreaM2(rooms[0].polygon) > 40);
  });

  test("a room keeps its assigned type when a wall is nudged", () => {
    const assigned = reconcileRooms(floorWith(singleRoom)).map((room) => ({
      ...room, sectionTypeId: "shop.checkout", name: "صندوق جلو"
    }));
    assigned[0].overrides = { focalMm: 6, cameraCount: 2 };

    const moved = singleRoom.map((item) =>
      item.id === "w2" ? wall("w2", 10.4, 0, 10.4, 6) : item
    );
    // The two end walls have to follow the corner, or the ring would no longer close.
    const nudged = moved.map((item) => {
      if (item.id === "w1") return wall("w1", 0, 0, 10.4, 0);
      if (item.id === "w3") return wall("w3", 10.4, 6, 0, 6);
      return item;
    });

    const after = reconcileRooms(floorWith(nudged, assigned));
    assert.equal(after.length, 1);
    assert.equal(after[0].sectionTypeId, "shop.checkout", "the programme survives the edit");
    assert.equal(after[0].name, "صندوق جلو");
    assert.equal(after[0].id, assigned[0].id, "and it is still the same room");
    assert.deepEqual(after[0].overrides, assigned[0].overrides, "rule overrides survive the edit too");
  });

  test("adding an attached rectangle preserves the existing room and leaves only the new space unassigned", () => {
    const assigned = reconcileRooms(floorWith(singleRoom)).map((room) => ({
      ...room,
      sectionTypeId: "shop.salesfloor",
      name: "فضای اصلی"
    }));

    const after = reconcileRooms(floorWith(rectangleAttachedToWall, assigned));
    assert.equal(after.length, 2);
    assert.equal(after.filter((room) => room.sectionTypeId === "shop.salesfloor").length, 1);
    assert.equal(unassignedRooms({ ...floorWith(rectangleAttachedToWall), rooms: after }).length, 1);
    assert.equal(
      Math.round(roomAreaM2(unassignedRooms({ ...floorWith(rectangleAttachedToWall), rooms: after })[0].polygon)),
      12,
      "the new attached space remains visible and awaits its type"
    );
  });

  test("a hand-drawn room is never rebuilt from the walls", () => {
    const drawn = {
      id: "manual-1",
      polygon: [{ x: 20, z: 20 }, { x: 26, z: 20 }, { x: 26, z: 24 }, { x: 20, z: 24 }],
      sectionTypeId: "residential.yard",
      boundarySource: "drawn"
    };
    const rooms = reconcileRooms(floorWith(singleRoom, [drawn]));
    assert.equal(rooms.length, 2);
    assert.ok(rooms.some((room) => room.id === "manual-1"), "the drawn room is left alone");
  });

  test("a hand-drawn copy of a detected room replaces the duplicate unassigned outline", () => {
    const drawn = {
      id: "manual-overlap",
      polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }],
      sectionTypeId: "residential.play",
      boundarySource: "drawn"
    };
    const rooms = reconcileRooms(floorWith(singleRoom, [drawn]));

    assert.equal(rooms.length, 1, "one physical outline must produce one room");
    assert.equal(rooms[0].id, drawn.id, "the user's explicit room is retained");
    assert.equal(rooms[0].sectionTypeId, "residential.play");
    assert.equal(unassignedRooms({ ...floorWith(singleRoom), rooms }).length, 0);
  });

  test("a smaller declared sub-space inside a room is not mistaken for a duplicate", () => {
    const subSpace = {
      id: "manual-sub-space",
      polygon: [{ x: 1, z: 1 }, { x: 4, z: 1 }, { x: 4, z: 3 }, { x: 1, z: 3 }],
      sectionTypeId: "shop.checkout",
      boundarySource: "drawn"
    };
    const rooms = reconcileRooms(floorWith(singleRoom, [subSpace]));

    assert.equal(rooms.length, 2, "a real sub-space and its containing room both remain");
    assert.ok(rooms.some((room) => room.id === subSpace.id));
  });

  test("rooms without a type are the ones that render red", () => {
    const floor = floorWith(singleRoom);
    const rooms = reconcileRooms(floor);
    assert.equal(unassignedRooms({ ...floor, rooms }).length, 1);

    const typed = rooms.map((room) => ({ ...room, sectionTypeId: "shop.salesfloor" }));
    assert.equal(unassignedRooms({ ...floor, rooms: typed }).length, 0);
  });
});

describe("room lookup", () => {
  test("overlap is 1 for identical outlines and 0 for disjoint ones", () => {
    const square = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }];
    const far = [{ x: 40, z: 40 }, { x: 44, z: 40 }, { x: 44, z: 44 }, { x: 40, z: 44 }];
    assert.ok(overlapRatio(square, square) > 0.98);
    assert.equal(overlapRatio(square, far), 0);
  });

  test("the innermost room wins when outlines nest", () => {
    const outer = {
      id: "outer",
      polygon: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 }],
      boundarySource: "drawn"
    };
    const inner = {
      id: "inner",
      polygon: [{ x: 5, z: 5 }, { x: 10, z: 5 }, { x: 10, z: 10 }, { x: 5, z: 10 }],
      boundarySource: "drawn"
    };
    const floor = floorWith([], [outer, inner]);
    assert.equal(roomAtPoint(floor, { x: 7, z: 7 })?.id, "inner");
    assert.equal(roomAtPoint(floor, { x: 17, z: 17 })?.id, "outer");
    assert.equal(roomAtPoint(floor, { x: 50, z: 50 }), null);
  });

  test("all nested rooms are returned from inner to outer for click cycling", () => {
    const outer = {
      id: "outer", polygon: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 }], boundarySource: "drawn"
    };
    const middle = {
      id: "middle", polygon: [{ x: 3, z: 3 }, { x: 14, z: 3 }, { x: 14, z: 14 }, { x: 3, z: 14 }], boundarySource: "drawn"
    };
    const inner = {
      id: "inner", polygon: [{ x: 5, z: 5 }, { x: 9, z: 5 }, { x: 9, z: 9 }, { x: 5, z: 9 }], boundarySource: "drawn"
    };
    assert.deepEqual(roomsAtPoint(floorWith([], [outer, inner, middle]), { x: 7, z: 7 }).map((room) => room.id), ["inner", "middle", "outer"]);
  });
});

describe("open-boundary choices persist", () => {
  const threeSidedWalls = [
    wall("u1", 0, 0, 0, 5),
    wall("u2", 0, 5, 8, 5),
    wall("u3", 8, 5, 8, 0)
  ];

  test("a resolved open region is not re-opened by the next wall edit", () => {
    const floor = floorWith(threeSidedWalls);
    const region = detectRooms(floor).openRegions[0];
    const resolved = reconcileRooms(floor, { openChoices: { [region.id]: "inferred" } })
      .map((room) => ({ ...room, sectionTypeId: "residential.yard" }));

    // A later edit runs reconciliation with no explicit choice, exactly as a wall drag would.
    const after = reconcileRooms(floorWith(threeSidedWalls, resolved));
    assert.equal(after.length, 1, "the room survives without re-asking");
    assert.equal(after[0].boundarySource, "inferred");
    assert.equal(after[0].sectionTypeId, "residential.yard");
  });

  test("the enclosing choice is remembered too", () => {
    const floor = floorWith(threeSidedWalls);
    const region = detectRooms(floor).openRegions[0];
    const resolved = reconcileRooms(floor, { openChoices: { [region.id]: "enclosing" } });
    const after = reconcileRooms(floorWith(threeSidedWalls, resolved));
    assert.equal(after.length, 1);
    assert.equal(after[0].boundarySource, "enclosing");
  });
});
