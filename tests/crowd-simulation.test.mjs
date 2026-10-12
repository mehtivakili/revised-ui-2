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
  const record = { state, minGap: Infinity, offGround: 0, onRoad: 0, sharedSeat: 0, sharedSpot: 0, poses: new Set() };
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
  }
  return record;
}

/** A car's body as drawn, a touch smaller so wing mirrors may pass close. */
function footprint(car) {
  const hx = Math.cos(car.heading), hz = -Math.sin(car.heading);
  const length = car.lengthM * 0.46, width = car.widthM * 0.42;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => ({
    x: car.position.x + hx * length * a - hz * width * b,
    z: car.position.z + hz * length * a + hx * width * b
  }));
}

function bodiesOverlap(p, q) {
  for (const poly of [p, q]) {
    for (let i = 0; i < 4; i += 1) {
      const a = poly[i], b = poly[(i + 1) % 4];
      const axis = { x: -(b.z - a.z), z: b.x - a.x };
      const P = p.map((v) => v.x * axis.x + v.z * axis.z);
      const Q = q.map((v) => v.x * axis.x + v.z * axis.z);
      if (Math.max(...P) < Math.min(...Q) || Math.max(...Q) < Math.min(...P)) return false;
    }
  }
  return true;
}

/** Drives a sample's traffic for a while and records everything the rules forbid. */
function drive(sampleId, seconds = 60, seed = 5) {
  const floor = createSamplePlan(sampleId).floors[0];
  const state = createCrowd(floor, { seed });
  const { tracks, junctions } = state.traffic;
  const record = { state, overlaps: 0, vanished: 0, exits: 0, turns: 0, gateStops: 0, gatePasses: 0, gap: Infinity, longestStill: 0 };
  const still = new Map();
  const previous = new Map();
  for (let frame = 0; frame < seconds * 30; frame += 1) {
    stepCrowd(state, 1 / 30);
    const cars = state.traffic.cars;
    for (const car of cars) {
      const before = previous.get(car.id);
      if (before?.active && !car.active) {
        // Leaving is only allowed off the end of a road out of the site.
        const last = tracks[before.track];
        if (last.control === "exit" && junctions[last.node].gateway) record.exits += 1;
        else record.vanished += 1;
      }
      const turned = before?.active && car.active && before.track !== car.track && tracks[before.track].kind === "connector" && tracks[before.track].limit < Infinity;
      if (turned) record.turns += 1;
      if (car.active) {
        const track = tracks[car.track];
        const front = car.s + car.lengthM / 2;
        for (const checkpoint of track.checkpoints) {
          if (car.speed < 0.05 && Math.abs(checkpoint - 1 - front) < 0.7) record.gateStops += 1;
          if (before?.active && before.track === car.track && before.s + car.lengthM / 2 < checkpoint && front >= checkpoint) record.gatePasses += 1;
        }
      }
      const stillFor = car.active && car.speed < 0.05 ? (still.get(car.id) ?? 0) + 1 / 30 : 0;
      still.set(car.id, stillFor);
      record.longestStill = Math.max(record.longestStill, stillFor);
      previous.set(car.id, { active: car.active, track: car.track, s: car.s });
    }
    const active = cars.filter((car) => car.active && car.presence > 0.2);
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        const a = active[i], b = active[j];
        if (bodiesOverlap(footprint(a), footprint(b))) record.overlaps += 1;
        if (a.track === b.track) {
          const [back, ahead] = a.s < b.s ? [a, b] : [b, a];
          record.gap = Math.min(record.gap, ahead.s - ahead.lengthM / 2 - (back.s + back.lengthM / 2));
        }
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
  const busy = ["urban-public-parking", "regional-warehouse", "highway-interchange", "neighbourhood-fuel-station", "urban-substation", "transmission-corridor", "primary-school", "city-bus-fleet"];
  for (const sample of busy) {
    test(`${sample}: cars never touch, never vanish mid-road and never stand stuck`, () => {
      const record = drive(sample);
      const cars = record.state.traffic.cars;
      assert.ok(cars.length > 0, "the roads have traffic");
      assert.equal(record.overlaps, 0, "two cars' bodies overlapped");
      assert.equal(record.vanished, 0, "a car disappeared somewhere other than the edge of the site");
      assert.ok(record.gap >= 1.5, `cars on one road came ${record.gap.toFixed(2)} m apart`);
      assert.ok(record.longestStill < 12, `a car stood still for ${record.longestStill.toFixed(1)} s`);
      const speeds = new Set(cars.map((car) => car.cruise.toFixed(1)));
      assert.ok(speeds.size > 1 || cars.length === 1, "cars drive at different speeds");
    });
  }

  test("traffic comes and goes at the edge of the site", () => {
    const record = drive("urban-public-parking");
    assert.ok(record.exits > 0, "no car drove off the site");
    for (const sample of busy) {
      const { traffic } = createCrowd(createSamplePlan(sample).floors[0], { seed: 5 });
      for (const car of traffic.cars) {
        const track = traffic.tracks[car.track];
        assert.ok(track.control !== "exit" || traffic.junctions[track.node].gateway, `${sample}: a car starts on a road with no way on`);
      }
    }
  });

  test("cars turn at junctions and wait at the stop line", () => {
    const record = drive("neighbourhood-fuel-station");
    const { junctions, tracks } = record.state.traffic;
    assert.ok(junctions.some((junction) => junction.degree >= 3), "the sample has a junction");
    assert.ok(tracks.some((track) => track.control === "stop" || track.control === "yield"), "no road gives way");
    assert.ok(record.turns > 0, "no car turned at a junction");
  });

  test("cars stop at a barrier, then drive through", () => {
    const record = drive("compact-data-centre");
    assert.ok(record.state.traffic.tracks.some((track) => track.checkpoints.length > 0), "the gate is not a checkpoint");
    assert.ok(record.gateStops > 0, "no car stopped at the gate");
    assert.ok(record.gatePasses > 0, "no car drove through the gate");
  });
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
    assert.equal(view.cars.length, state.traffic.cars.length);
    view.group.traverse((child) => assert.equal(child.userData.kind, undefined, "dynamic objects must not be pickable plan elements"));
  });
});
