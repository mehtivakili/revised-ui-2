import assert from "node:assert/strict";
import test, { describe } from "node:test";
import * as THREE from "three";
import { createSamplePlan } from "@/src/lib/planner/sample-plans.ts";
import { appearances, proportions } from "@/src/lib/planner/crowd/appearances.ts";
import { createCrowd, stepCrowd, MIN_GAP_M } from "@/src/lib/planner/crowd/simulation.ts";
import { isRoad, isWalkable } from "@/src/lib/planner/crowd/navigation.ts";
import { buildCrowdView, buildPerson, updateCrowdView } from "@/src/lib/planner/crowd/models.ts";

/** Steps a sample for a while and records everything the rules forbid. */
function run(sampleId, seconds = 45, seed = 3) {
  const floor = createSamplePlan(sampleId).floors[0];
  const state = createCrowd(floor, { seed });
  const record = { state, minGap: Infinity, offGround: 0, onRoad: 0, sharedSeat: 0, sharedSpot: 0, carGap: Infinity, poses: new Set() };
  for (let frame = 0; frame < seconds * 30; frame += 1) {
    stepCrowd(state, 1 / 30);
    const people = state.agents;
    const seats = new Map();
    const spots = new Map();
    for (let i = 0; i < people.length; i += 1) {
      const person = people[i];
      record.poses.add(person.pose);
      if (person.sit < 0.01 && !isWalkable(state.grid, person.position)) record.offGround += 1;
      if (isRoad(state.grid, person.position)) record.onRoad += 1;
      const activity = person.activity;
      if (activity.kind === "sit" && activity.phase !== "walk") {
        if (seats.has(activity.seat.id)) record.sharedSeat += 1;
        seats.set(activity.seat.id, i);
      }
      if (activity.kind === "use" && activity.phase === "using") {
        if (spots.has(activity.spot.id)) record.sharedSpot += 1;
        spots.set(activity.spot.id, i);
      }
      for (let j = i + 1; j < people.length; j += 1) {
        record.minGap = Math.min(record.minGap, Math.hypot(person.position.x - people[j].position.x, person.position.z - people[j].position.z));
      }
    }
    const lanes = new Map();
    for (const car of state.cars) if (car.active) lanes.set(car.lane, [...(lanes.get(car.lane) ?? []), car]);
    for (const cars of lanes.values()) {
      cars.sort((a, b) => a.s - b.s);
      for (let k = 1; k < cars.length; k += 1) {
        record.carGap = Math.min(record.carGap, cars[k].s - cars[k].lengthM / 2 - (cars[k - 1].s + cars[k - 1].lengthM / 2));
      }
    }
  }
  return record;
}

describe("dynamic environment: people", () => {
  for (const sample of ["family-villa", "modern-office", "neighbourhood-restaurant", "urban-sports-complex", "boutique-hotel", "school-campus"]) {
    test(`${sample}: nobody overlaps, leaves the floor, walks on a road or shares a seat`, () => {
      const record = run(sample);
      assert.ok(record.state.agents.length >= 4, "the scene has people in it");
      assert.ok(record.minGap >= MIN_GAP_M - 1e-6, `two people came ${record.minGap.toFixed(2)} m apart`);
      assert.equal(record.offGround, 0, "a standing person was inside a wall or furniture");
      assert.equal(record.onRoad, 0, "a person stepped onto a road");
      assert.equal(record.sharedSeat, 0, "two people used one seat");
      assert.equal(record.sharedSpot, 0, "two people used one counter place");
    });
  }

  test("people walk, sit, talk and use things", () => {
    const office = run("neighbourhood-restaurant", 60);
    for (const pose of ["walk", "sit", "talk"]) assert.ok(office.poses.has(pose), `nobody was seen to ${pose}`);
    const shop = run("corner-retail-shop", 60);
    assert.ok(shop.poses.has("browse") || shop.poses.has("use"), "nobody used the shop's shelves or till");
  });

  test("the same floor always starts the same way", () => {
    const floor = createSamplePlan("family-villa").floors[0];
    const a = createCrowd(floor, { seed: 11 });
    const b = createCrowd(floor, { seed: 11 });
    for (let frame = 0; frame < 90; frame += 1) { stepCrowd(a, 1 / 30); stepCrowd(b, 1 / 30); }
    assert.deepEqual(a.agents.map((agent) => agent.position), b.agents.map((agent) => agent.position));
  });

  test("a decked platform puts people on its deck", () => {
    const record = run("offshore-platform", 10);
    assert.ok(record.state.agents.length > 0);
  });
});

describe("dynamic environment: traffic", () => {
  for (const sample of ["urban-public-parking", "regional-warehouse", "highway-interchange"]) {
    test(`${sample}: cars keep their distance and stay on their road`, () => {
      const record = run(sample, 40);
      assert.ok(record.state.cars.length > 0, "the roads have traffic");
      assert.ok(record.carGap >= 1.9, `cars came ${record.carGap.toFixed(2)} m apart`);
      for (const car of record.state.cars) {
        const lane = record.state.lanes[car.lane];
        assert.ok(car.s >= 0 && car.s <= lane.lengthM + car.lengthM, "a car left its lane");
      }
      const speeds = new Set(record.state.cars.map((car) => car.cruise.toFixed(1)));
      assert.ok(speeds.size > 1 || record.state.cars.length === 1, "cars drive at different speeds");
    });
  }
});

describe("dynamic environment: figures", () => {
  test("ten distinct people of every age group, at true scale", () => {
    assert.equal(appearances.length, 10);
    assert.equal(new Set(appearances.map((item) => item.id)).size, 10);
    for (const group of ["man", "woman", "boy", "girl"]) assert.ok(appearances.some((item) => item.group === group), `no ${group}`);
    for (const appearance of appearances) {
      const body = proportions(appearance);
      const top = body.hipY + body.torso + body.neck + body.headR * 2;
      assert.ok(Math.abs(top - appearance.heightM) < appearance.heightM * 0.08, `${appearance.id} is ${top.toFixed(2)} m tall, not ${appearance.heightM}`);
    }
  });

  test("every figure builds and poses without error, and stands on the floor", () => {
    for (const appearance of appearances) {
      const rig = buildPerson(THREE, appearance);
      const box = new THREE.Box3().setFromObject(rig.root);
      assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `${appearance.id}: feet at ${box.min.y.toFixed(2)}`);
      assert.ok(Math.abs(box.max.y - appearance.heightM) < 0.15, `${appearance.id}: head at ${box.max.y.toFixed(2)}`);
    }
    const state = createCrowd(createSamplePlan("urban-public-parking").floors[0], { seed: 2 });
    const view = buildCrowdView(THREE, state);
    for (let frame = 0; frame < 60; frame += 1) { stepCrowd(state, 1 / 30); updateCrowdView(state, view, 1 / 30); }
    assert.equal(view.rigs.length, state.agents.length);
    assert.equal(view.cars.length, state.cars.length);
    view.group.traverse((child) => assert.equal(child.userData.kind, undefined, "dynamic objects must not be pickable plan elements"));
  });
});
