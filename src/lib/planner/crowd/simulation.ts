import type { FloorPlan, Vec2 } from "@/src/domain/planner/types";
import { appearances, type Appearance } from "@/src/lib/planner/crowd/appearances";
import { findSeats, findSpots, yawToward, type Seat, type Spot } from "@/src/lib/planner/crowd/features";
import { buildTraffic, stepTraffic, type Traffic } from "@/src/lib/planner/crowd/traffic";
import { buildNavGrid, cellCentre, cellOf, findPath, nearestWalkable, type NavGrid } from "@/src/lib/planner/crowd/navigation";

/**
 * The dynamic environment: people who walk, sit, use things and talk, and cars on roads.
 *
 * Everything here is plain data stepped by time, so it runs the same in a test as on
 * screen. The rules that keep it believable are hard ones, checked on every step:
 * - nobody ends a step closer than MIN_GAP to anyone else, and nobody leaves the
 *   walkable area or steps onto a road;
 * - a seat or a place at a counter belongs to one person at a time;
 * - cars drive a road network (see traffic.ts): they keep their distance, turn at
 *   junctions and take turns through them, and never meet people, who keep off roads.
 */

export const MIN_GAP_M = 0.48;
const ARRIVE_M = 0.18;
const MAX_PATHS_PER_STEP = 3;

type Rng = () => number;
function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export type Pose = "walk" | "stand" | "sit" | "talk" | "use" | "browse" | "write";

type Activity =
  | { kind: "idle"; until: number }
  | { kind: "wander"; target: Vec2 }
  | { kind: "sit"; seat: Seat; phase: "walk" | "lower" | "seated" | "rise"; until: number; phaseStart: number }
  | { kind: "use"; spot: Spot; phase: "walk" | "using"; until: number }
  /** `until` is a give-up deadline while walking to meet, then the end of the conversation. */
  | { kind: "talk"; partner: number; meet: Vec2; phase: "walk" | "talking"; until: number }
  | { kind: "follow" };

export type Agent = {
  index: number;
  appearance: Appearance;
  /** Variation for a repeated appearance (0 for the first of each look). */
  variant: number;
  position: Vec2;
  yaw: number;
  speed: number;
  preferredSpeed: number;
  path: Vec2[];
  pathIndex: number;
  needsPath: boolean;
  activity: Activity;
  /** Companion walking with this person, if any; the leader decides, the companion follows. */
  companion: number | null;
  leads: boolean;
  stuck: number;
  walkPhase: number;
  /** 0 standing … 1 fully seated. */
  sit: number;
  seatHeightM: number;
  pose: Pose;
  /** Seconds into the current gesture, for talking and using. */
  gesture: number;
};

export type CrowdState = {
  time: number;
  rng: Rng;
  grid: NavGrid;
  seats: Seat[];
  spots: Spot[];
  agents: Agent[];
  traffic: Traffic;
  seatTaken: Map<string, number>;
  spotTaken: Map<string, number>;
  /** Cells taken by people standing still, so routes go round them. */
  standing: Uint8Array;
  standingCells: number[];
  pathBudget: number;
  /** Route searches stop for this step once this clock time (ms) is passed. */
  pathDeadline: number;
  regionCells: Map<number, number[]>;
};

export function createCrowd(floor: FloorPlan, options: { seed?: number; maxPeople?: number } = {}): CrowdState {
  const rng = makeRng(options.seed ?? 1);
  const grid = buildNavGrid(floor);
  const seats = findSeats(floor, grid);
  const spots = findSpots(floor, grid);

  // Walkable cells of each sizeable region, for spawning and picking destinations.
  const regionCells = new Map<number, number[]>();
  const cellArea = grid.cellM * grid.cellM;
  for (let index = 0; index < grid.walkable.length; index += 1) {
    const region = grid.region[index]!;
    if (!region || (grid.regionSize.get(region) ?? 0) * cellArea < 12) continue;
    let list = regionCells.get(region);
    if (!list) { list = []; regionCells.set(region, list); }
    list.push(index);
  }
  const walkableArea = [...regionCells.values()].reduce((sum, list) => sum + list.length, 0) * cellArea;

  const state: CrowdState = {
    time: 0, rng, grid, seats, spots, agents: [], traffic: buildTraffic(floor, rng),
    seatTaken: new Map(), spotTaken: new Map(),
    standing: new Uint8Array(grid.walkable.length), standingCells: [], pathBudget: MAX_PATHS_PER_STEP, pathDeadline: Infinity, regionCells
  };

  // People: about one per 32 m² of walkable floor, between 4 and the cap.
  const count = regionCells.size ? Math.max(4, Math.min(options.maxPeople ?? 22, Math.round(walkableArea / 32))) : 0;
  const looks = [...appearances].sort(() => rng() - 0.5);
  const allCells = [...regionCells.values()].flat();
  const freeSeats = [...seats].sort(() => rng() - 0.5);
  for (let index = 0; index < count; index += 1) {
    const appearance = looks[index % looks.length]!;
    const agent: Agent = {
      index, appearance, variant: Math.floor(index / looks.length),
      position: { x: 0, z: 0 }, yaw: rng() * Math.PI * 2, speed: 0,
      preferredSpeed: appearance.walkSpeed * between(rng, 0.88, 1.1),
      path: [], pathIndex: 0, needsPath: false,
      activity: { kind: "idle", until: between(rng, 0.5, 4) },
      companion: null, leads: false, stuck: 0, walkPhase: rng() * Math.PI * 2,
      sit: 0, seatHeightM: 0.45, pose: "stand", gesture: rng() * 10
    };
    // A third of people start seated, so a scene is lived in from the first frame.
    const seat = index % 3 === 1 ? freeSeats.find((item) => !state.seatTaken.has(item.id) && clearOf(state, item.position, 0.5)) : undefined;
    if (seat) {
      state.seatTaken.set(seat.id, index);
      agent.position = { ...seat.position };
      agent.yaw = seat.facing;
      agent.sit = 1;
      agent.seatHeightM = seat.heightM;
      agent.pose = "sit";
      agent.activity = { kind: "sit", seat, phase: "seated", until: between(rng, 8, 30), phaseStart: 0 };
    } else {
      let placed = false;
      for (let attempt = 0; attempt < 400 && !placed && allCells.length; attempt += 1) {
        const point = cellCentre(grid, allCells[Math.floor(rng() * allCells.length)]!);
        if (clearOf(state, point, 1)) { agent.position = point; placed = true; }
      }
      if (!placed) break;
    }
    state.agents.push(agent);
  }

  // Companions: a child walks with an adult, and some adults walk in pairs.
  const free = state.agents.filter((agent) => agent.activity.kind !== "sit");
  const adults = free.filter((agent) => agent.appearance.group === "man" || agent.appearance.group === "woman");
  const children = free.filter((agent) => agent.appearance.heightM < 1.3);
  for (const child of children) {
    const adult = adults.find((item) => item.companion === null && grid.region[cellOf(grid, item.position)] === grid.region[cellOf(grid, child.position)]);
    if (adult) pair(adult, child);
  }
  const loners = adults.filter((agent) => agent.companion === null);
  if (loners.length >= 4) pair(loners[0]!, loners[1]!);

  return state;
}

function pair(leader: Agent, follower: Agent) {
  leader.companion = follower.index;
  leader.leads = true;
  follower.companion = leader.index;
  follower.leads = false;
  follower.activity = { kind: "follow" };
}

function clearOf(state: CrowdState, point: Vec2, gap: number, except = -1) {
  return state.agents.every((agent) => agent.index === except || Math.hypot(agent.position.x - point.x, agent.position.z - point.z) >= gap);
}

/* ── Stepping ─────────────────────────────────────────────────────── */

export function stepCrowd(state: CrowdState, dtSeconds: number) {
  const dt = Math.min(0.1, Math.max(0, dtSeconds));
  if (!dt) return;
  state.time += dt;
  // Route searches share a few milliseconds per step; the rest wait for the next one.
  state.pathBudget = MAX_PATHS_PER_STEP;
  state.pathDeadline = performance.now() + 4;
  markStanding(state);
  for (const agent of state.agents) stepAgent(state, agent, dt);
  stepTraffic(state.traffic, dt, state.time, state.rng);
}

/** People standing still block routes; walkers are handled by local avoidance instead. */
function markStanding(state: CrowdState) {
  for (const index of state.standingCells) state.standing[index] = 0;
  state.standingCells = [];
  const { grid } = state;
  const reach = Math.ceil(0.4 / grid.cellM);
  for (const agent of state.agents) {
    if (agent.speed > 0.05 || agent.sit > 0.5) continue;
    const centre = cellOf(grid, agent.position);
    if (centre < 0) continue;
    const col0 = centre % grid.cols;
    const row0 = Math.floor(centre / grid.cols);
    for (let row = row0 - reach; row <= row0 + reach; row += 1) {
      for (let col = col0 - reach; col <= col0 + reach; col += 1) {
        if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
        const index = row * grid.cols + col;
        if (!state.standing[index]) { state.standing[index] = agent.index + 1; state.standingCells.push(index); }
      }
    }
  }
}

function requestPath(state: CrowdState, agent: Agent, to: Vec2): "ok" | "wait" | "fail" {
  if (state.pathBudget <= 0 || performance.now() > state.pathDeadline) return "wait";
  state.pathBudget -= 1;
  // Ignore the cells this person is standing on themselves.
  const own: number[] = [];
  for (const index of state.standingCells) if (state.standing[index] === agent.index + 1) { own.push(index); state.standing[index] = 0; }
  const path = findPath(state.grid, agent.position, to, state.standing);
  for (const index of own) state.standing[index] = agent.index + 1;
  if (!path) return "fail";
  agent.path = path;
  agent.pathIndex = 0;
  agent.needsPath = false;
  return "ok";
}

function release(state: CrowdState, agent: Agent) {
  const activity = agent.activity;
  if (activity.kind === "sit" && state.seatTaken.get(activity.seat.id) === agent.index) state.seatTaken.delete(activity.seat.id);
  if (activity.kind === "use" && state.spotTaken.get(activity.spot.id) === agent.index) state.spotTaken.delete(activity.spot.id);
}

function setIdle(state: CrowdState, agent: Agent, seconds = between(state.rng, 1, 3.5)) {
  release(state, agent);
  agent.activity = { kind: "idle", until: state.time + seconds };
  agent.path = [];
  agent.stuck = 0;
  agent.sit = 0;
  // Safety net: never left standing inside furniture or a wall.
  const cell = cellOf(state.grid, agent.position);
  if (cell < 0 || !state.grid.walkable[cell]) {
    const near = nearestWalkable(state.grid, agent.position, 1.2);
    if (near >= 0) agent.position = cellCentre(state.grid, near);
  }
}

/**
 * Ends someone's sitting without breaking it off: still walking there, they simply stop;
 * already down, they stand up and step out the normal way.
 */
function cancelSit(state: CrowdState, agent: Agent) {
  const activity = agent.activity;
  if (activity.kind !== "sit") return;
  if (activity.phase === "walk") setIdle(state, agent);
  else if (activity.phase !== "rise") activity.until = Math.min(activity.until, state.time);
}

function regionOf(state: CrowdState, point: Vec2) {
  return state.grid.region[cellOf(state.grid, point)] ?? 0;
}

function sameRegion(state: CrowdState, a: Vec2, b: Vec2) {
  const region = regionOf(state, a);
  return region > 0 && region === regionOf(state, b);
}

/** Pick the next thing to do. */
function chooseActivity(state: CrowdState, agent: Agent) {
  const { rng } = state;
  const companion = agent.companion !== null ? state.agents[agent.companion]! : null;
  const child = agent.appearance.heightM < 1.3;
  // Wait for a companion to be back alongside before starting anything together.
  if (companion && companion.activity.kind !== "follow") {
    agent.activity = { kind: "idle", until: state.time + 0.6 };
    return;
  }
  const roll = rng();

  // Sit: a free seat in reach (with a free one beside it when walking with someone).
  if (roll < 0.32) {
    const options = state.seats.filter((seat) => !state.seatTaken.has(seat.id) && sameRegion(state, agent.position, seat.approach));
    const nearest = options.sort((a, b) => dist(a.approach, agent.position) - dist(b.approach, agent.position)).slice(0, 6);
    for (const seat of nearest.sort(() => rng() - 0.5)) {
      const partnerSeat = companion
        ? state.seats.find((item) => item.group === seat.group && Math.abs(item.index - seat.index) === 1 && !state.seatTaken.has(item.id))
        : undefined;
      if (companion && !partnerSeat) continue;
      const until = state.time + between(rng, 12, 32);
      state.seatTaken.set(seat.id, agent.index);
      agent.activity = { kind: "sit", seat, phase: "walk", until, phaseStart: state.time };
      agent.needsPath = true;
      if (companion && partnerSeat) {
        state.seatTaken.set(partnerSeat.id, companion.index);
        companion.activity = { kind: "sit", seat: partnerSeat, phase: "walk", until, phaseStart: state.time };
        companion.needsPath = true;
      }
      return;
    }
  }
  // Use something: a till, a shelf, a fridge. Children and companions leave this to adults alone.
  if (roll < 0.58 && !child && !companion) {
    const options = state.spots.filter((spot) => !state.spotTaken.has(spot.id) && sameRegion(state, agent.position, spot.position));
    const spot = options.sort((a, b) => dist(a.position, agent.position) - dist(b.position, agent.position)).slice(0, 5)[Math.floor(rng() * 5)] ?? options[0];
    if (spot) {
      state.spotTaken.set(spot.id, agent.index);
      agent.activity = { kind: "use", spot, phase: "walk", until: 0 };
      agent.needsPath = true;
      return;
    }
  }
  // Talk: with a companion, or with someone nearby who is free.
  if (roll < 0.72) {
    const partner = companion ?? state.agents
      .filter((other) => other !== agent && other.companion === null && other.activity.kind === "idle" && sameRegion(state, agent.position, other.position) && dist(other.position, agent.position) < 14)
      .sort((a, b) => dist(a.position, agent.position) - dist(b.position, agent.position))[0];
    const meeting = partner ? meetingPoints(state, agent, partner) : null;
    if (partner && meeting) {
      const until = state.time + 30;
      agent.activity = { kind: "talk", partner: partner.index, meet: meeting[0], phase: "walk", until };
      partner.activity = { kind: "talk", partner: agent.index, meet: meeting[1], phase: "walk", until };
      agent.needsPath = true;
      partner.needsPath = true;
      partner.path = [];
      return;
    }
  }
  // Pause and look around now and then.
  if (roll > 0.94) {
    agent.activity = { kind: "idle", until: state.time + between(rng, 2, 5) };
    return;
  }
  // Otherwise walk somewhere in the same area.
  const cells = state.regionCells.get(regionOf(state, agent.position));
  if (!cells?.length) { setIdle(state, agent); return; }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const target = cellCentre(state.grid, cells[Math.floor(rng() * cells.length)]!);
    const distance = dist(target, agent.position);
    if (distance < 3 || distance > 28 || state.standing[cellOf(state.grid, target)]) continue;
    agent.activity = { kind: "wander", target };
    agent.needsPath = true;
    return;
  }
  setIdle(state, agent);
}

/** Two standing places about a metre apart, between the two people. */
function meetingPoints(state: CrowdState, a: Agent, b: Agent): [Vec2, Vec2] | null {
  const middle = { x: (a.position.x + b.position.x) / 2, z: (a.position.z + b.position.z) / 2 };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const angle = state.rng() * Math.PI * 2;
    const centre = attempt === 0 ? middle : { x: middle.x + Math.cos(angle) * 1.5, z: middle.z + Math.sin(angle) * 1.5 };
    for (let turn = 0; turn < 8; turn += 1) {
      const heading = (turn / 8) * Math.PI;
      const offset = { x: Math.cos(heading) * 0.55, z: Math.sin(heading) * 0.55 };
      const p = { x: centre.x - offset.x, z: centre.z - offset.z };
      const q = { x: centre.x + offset.x, z: centre.z + offset.z };
      if (!standable(state, p, a.index, b.index) || !standable(state, q, a.index, b.index)) continue;
      if (!sameRegion(state, p, a.position) || !sameRegion(state, q, b.position)) continue;
      return dist(p, a.position) + dist(q, b.position) <= dist(q, a.position) + dist(p, b.position) ? [p, q] : [q, p];
    }
  }
  return null;
}

/** Room to stand: walkable with a margin around it, and nobody else already there. */
function standable(state: CrowdState, point: Vec2, ...except: number[]) {
  const { grid } = state;
  for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]] as const) {
    const index = cellOf(grid, { x: point.x + dx, z: point.z + dz });
    if (index < 0 || !grid.walkable[index]) return false;
  }
  return state.agents.every((agent) => except.includes(agent.index) || dist(agent.position, point) >= 1);
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

function stepAgent(state: CrowdState, agent: Agent, dt: number) {
  agent.gesture += dt;
  const activity = agent.activity;

  switch (activity.kind) {
    case "idle": {
      agent.pose = "stand";
      settle(agent, dt);
      if (state.time < activity.until) return;
      // A companion goes back to walking alongside; everyone else picks something to do.
      if (agent.companion !== null && !agent.leads) agent.activity = { kind: "follow" };
      else chooseActivity(state, agent);
      return;
    }
    case "follow": {
      stepFollow(state, agent, dt);
      return;
    }
    case "wander": {
      if (!ensurePath(state, agent, activity.target)) return;
      if (walk(state, agent, dt)) setIdle(state, agent, between(state.rng, 0.5, 3));
      return;
    }
    case "use": {
      if (activity.phase === "walk") {
        if (!ensurePath(state, agent, activity.spot.position)) return;
        if (walk(state, agent, dt)) {
          activity.phase = "using";
          activity.until = state.time + between(state.rng, 6, 14);
          agent.gesture = 0;
        }
        return;
      }
      agent.pose = activity.spot.action;
      turnToward(agent, activity.spot.facing, dt);
      settle(agent, dt);
      if (state.time >= activity.until) setIdle(state, agent);
      return;
    }
    case "talk": {
      const partner = state.agents[activity.partner]!;
      const partnerActivity = partner.activity;
      if (partnerActivity.kind !== "talk" || partnerActivity.partner !== agent.index) { setIdle(state, agent); return; }
      if (activity.phase === "walk") {
        if (dist(agent.position, activity.meet) > ARRIVE_M) {
          if (!ensurePath(state, agent, activity.meet)) return;
          walk(state, agent, dt);
          if (agent.stuck > 6 || state.time > activity.until) { setIdle(state, agent); setIdle(state, partner); }
          return;
        }
        agent.speed = 0;
        agent.pose = "stand";
        turnToward(agent, yawToward(agent.position, partner.position), dt);
        // Both there: the conversation starts, for the same length on both sides.
        if (dist(partner.position, partnerActivity.meet) <= ARRIVE_M && partner.speed < 0.05) {
          const until = state.time + between(state.rng, 7, 15);
          activity.phase = "talking";
          activity.until = until;
          partnerActivity.phase = "talking";
          partnerActivity.until = until;
          agent.gesture = 0;
          partner.gesture = 1.3;
        }
        if (state.time > activity.until) { setIdle(state, agent); setIdle(state, partner); }
        return;
      }
      agent.pose = "talk";
      settle(agent, dt);
      turnToward(agent, yawToward(agent.position, partner.position), dt);
      if (state.time >= activity.until) {
        setIdle(state, agent);
        if (partner.activity.kind === "talk") setIdle(state, partner);
        // A companion goes back to walking alongside.
        for (const person of [agent, partner]) if (person.companion !== null && !person.leads) person.activity = { kind: "follow" };
      }
      return;
    }
    case "sit": {
      stepSit(state, agent, activity, dt);
      return;
    }
  }
}

function stepSit(state: CrowdState, agent: Agent, activity: Extract<Activity, { kind: "sit" }>, dt: number) {
  const { seat } = activity;
  if (activity.phase === "walk") {
    if (dist(agent.position, seat.approach) > ARRIVE_M) {
      if (!ensurePath(state, agent, seat.approach)) return;
      if (!walk(state, agent, dt)) return;
    }
    // Wait at the seat until the way onto it is clear of anyone else.
    if (!segmentClear(state, seat.approach, seat.position, agent.index)) {
      agent.pose = "stand";
      agent.speed = 0;
      agent.stuck += dt;
      if (agent.stuck > 8) setIdle(state, agent);
      return;
    }
    agent.stuck = 0;
    activity.phase = "lower";
    activity.phaseStart = state.time;
    agent.seatHeightM = seat.heightM;
  }
  const blend = Math.min(1, (state.time - activity.phaseStart) / 0.9);
  if (activity.phase === "lower") {
    // Turn to face away from the seat, step back onto it and sit down — pausing if
    // someone steps into the way.
    turnToward(agent, seat.facing, dt * 2);
    const next = lerp(seat.approach, seat.position, smooth(blend));
    if (!transitionAllowed(state, agent, next)) { activity.phaseStart += dt; return; }
    agent.position = next;
    agent.sit = smooth(blend);
    agent.pose = "sit";
    agent.speed = 0;
    if (blend >= 1) { activity.phase = "seated"; activity.phaseStart = state.time; }
    return;
  }
  if (activity.phase === "seated") {
    agent.pose = "sit";
    agent.sit = 1;
    agent.position = { ...seat.position };
    agent.yaw = seat.facing;
    const leader = agent.companion !== null && !agent.leads ? state.agents[agent.companion]! : null;
    const leaderStill = leader?.activity.kind === "sit" && leader.activity.phase !== "rise";
    if (state.time >= activity.until && !leaderStill && segmentClear(state, seat.position, seat.approach, agent.index)) {
      activity.phase = "rise";
      activity.phaseStart = state.time;
    }
    return;
  }
  // Rise: stand up and step back out to the approach point.
  const next = lerp(seat.position, seat.approach, smooth(blend));
  if (!transitionAllowed(state, agent, next)) { activity.phaseStart += dt; return; }
  agent.position = next;
  agent.sit = 1 - smooth(blend);
  agent.pose = "sit";
  if (blend >= 1) {
    agent.sit = 0;
    const companion = agent.companion !== null ? state.agents[agent.companion]! : null;
    setIdle(state, agent, between(state.rng, 0.5, 2));
    if (companion && !agent.leads) agent.activity = { kind: "follow" };
    if (companion && agent.leads && companion.activity.kind === "sit" && companion.activity.phase === "seated") companion.activity.until = state.time;
  }
}

/** Nobody (other than `except`) within MIN_GAP of the straight move from a to b. */
function segmentClear(state: CrowdState, a: Vec2, b: Vec2, except: number) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz || 1e-9;
  return state.agents.every((other) => {
    if (other.index === except) return true;
    const t = Math.max(0, Math.min(1, ((other.position.x - a.x) * dx + (other.position.z - a.z) * dz) / lengthSq));
    return Math.hypot(other.position.x - (a.x + dx * t), other.position.z - (a.z + dz * t)) >= MIN_GAP_M;
  });
}

/** A sitting or standing movement may not bring anyone closer than MIN_GAP. */
function transitionAllowed(state: CrowdState, agent: Agent, next: Vec2) {
  return state.agents.every((other) => {
    if (other === agent) return true;
    const after = dist(next, other.position);
    return after >= MIN_GAP_M || after > dist(agent.position, other.position);
  });
}

function stepFollow(state: CrowdState, agent: Agent, dt: number) {
  const leader = agent.companion !== null ? state.agents[agent.companion]! : null;
  if (!leader) { setIdle(state, agent); return; }
  // Side by side, on the leader's right; behind when there is no room beside them.
  const right = { x: Math.cos(leader.yaw), z: -Math.sin(leader.yaw) };
  const forward = { x: Math.sin(leader.yaw), z: Math.cos(leader.yaw) };
  let target = { x: leader.position.x + right.x * 0.62, z: leader.position.z + right.z * 0.62 };
  if (!standableFor(state, target, agent.index, leader.index)) target = { x: leader.position.x - forward.x * 0.85, z: leader.position.z - forward.z * 0.85 };
  const distance = dist(agent.position, target);
  if (distance < 0.12) {
    agent.pose = leader.speed > 0.1 ? "walk" : "stand";
    settle(agent, dt);
    turnToward(agent, leader.speed > 0.1 ? leader.yaw : yawToward(agent.position, leader.position), dt);
    return;
  }
  // Far behind (round a corner): route there; close by: step straight over.
  if (distance > 2.5 || !standableFor(state, target, agent.index, leader.index)) {
    if (agent.needsPath || !agent.path.length || dist(agent.path[agent.path.length - 1]!, target) > 1.5) {
      agent.needsPath = true;
      if (!ensurePath(state, agent, target)) return;
    }
    walk(state, agent, dt, Math.min(1.9, leader.preferredSpeed * 1.35));
    return;
  }
  agent.path = [target];
  agent.pathIndex = 0;
  walk(state, agent, dt, Math.min(1.9, Math.max(0.4, distance * 2.2)));
}

function standableFor(state: CrowdState, point: Vec2, ...except: number[]) {
  const index = cellOf(state.grid, point);
  return index >= 0 && state.grid.walkable[index] === 1 && state.agents.every((agent) => except.includes(agent.index) || dist(agent.position, point) >= MIN_GAP_M + 0.1);
}

/** Make sure there is a route; while waiting for one, stand. */
function ensurePath(state: CrowdState, agent: Agent, to: Vec2) {
  if (!agent.needsPath && agent.path.length) return true;
  const result = requestPath(state, agent, to);
  if (result === "ok") return true;
  agent.speed = 0;
  agent.pose = "stand";
  if (result === "fail") {
    // Unreachable: give up on it (and release what was reserved).
    const companion = agent.companion !== null ? state.agents[agent.companion] : undefined;
    setIdle(state, agent);
    if (companion && agent.leads) cancelSit(state, companion);
  }
  return false;
}

/**
 * One step along the route with local avoidance. Returns true on arrival.
 *
 * The move is checked before it is taken: it must stay on walkable ground and must not
 * end closer than MIN_GAP to anyone (unless it moves away from them). If the direct step
 * is not allowed, a few sidesteps are tried; if none is, the person waits, and after a
 * while asks for a new route round whoever is in the way.
 */
function walk(state: CrowdState, agent: Agent, dt: number, speedOverride?: number): boolean {
  const waypoint = agent.path[agent.pathIndex];
  if (!waypoint) return true;
  const toTarget = { x: waypoint.x - agent.position.x, z: waypoint.z - agent.position.z };
  const remaining = Math.hypot(toTarget.x, toTarget.z);
  if (remaining < ARRIVE_M) {
    agent.pathIndex += 1;
    if (agent.pathIndex >= agent.path.length) {
      agent.speed = 0;
      agent.path = [];
      return true;
    }
    return false;
  }
  const direction = { x: toTarget.x / remaining, z: toTarget.z / remaining };
  let speed = speedOverride ?? agent.preferredSpeed;
  const right = { x: direction.z, z: -direction.x };
  let lateral = 0;
  const push = { x: 0, z: 0 };
  for (const other of state.agents) {
    if (other === agent) continue;
    const dx = other.position.x - agent.position.x;
    const dz = other.position.z - agent.position.z;
    const gap = Math.hypot(dx, dz);
    if (gap > 1.6 || gap < 1e-6) continue;
    const ahead = (dx * direction.x + dz * direction.z) / gap;
    const companion = other.index === agent.companion;
    if (ahead > 0.4 && !companion) {
      speed *= Math.min(1, Math.max(0.15, (gap - 0.55) / 0.8));
      // Keep right: step aside to the right of whoever is ahead.
      lateral += (1.6 - gap) * 0.7;
    }
    if (gap < 0.75) {
      push.x -= (dx / gap) * (0.75 - gap) * 1.6;
      push.z -= (dz / gap) * (0.75 - gap) * 1.6;
    }
  }
  const steer = { x: direction.x + right.x * lateral + push.x, z: direction.z + right.z * lateral + push.z };
  const steerLength = Math.hypot(steer.x, steer.z) || 1;
  const step = Math.min(remaining, speed * dt);
  const tries = [0, 0.6, -0.6, 1.1, -1.1];
  for (const turn of tries) {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const sx = steer.x / steerLength;
    const sz = steer.z / steerLength;
    const move = { x: (sx * cos - sz * sin) * step * (turn ? 0.7 : 1), z: (sx * sin + sz * cos) * step * (turn ? 0.7 : 1) };
    const next = { x: agent.position.x + move.x, z: agent.position.z + move.z };
    if (!allowedStep(state, agent, next)) continue;
    const moved = Math.hypot(move.x, move.z);
    agent.position = next;
    agent.speed = moved / dt;
    agent.walkPhase += (moved / (agent.appearance.heightM * 0.42)) * Math.PI;
    turnToward(agent, Math.atan2(move.x, move.z), dt * 1.5);
    agent.pose = "walk";
    agent.stuck = Math.max(0, agent.stuck - dt);
    return false;
  }
  // Blocked this step: wait, and ask for a way round if it lasts.
  agent.speed = 0;
  agent.pose = "stand";
  agent.stuck += dt;
  if (agent.stuck > 1.6 && agent.stuck - dt <= 1.6) agent.needsPath = true;
  if (agent.stuck > 9) {
    const companion = agent.companion !== null ? state.agents[agent.companion] : undefined;
    setIdle(state, agent);
    if (companion && agent.leads) cancelSit(state, companion);
  }
  return false;
}

function allowedStep(state: CrowdState, agent: Agent, next: Vec2) {
  const index = cellOf(state.grid, next);
  if (index < 0 || !state.grid.walkable[index]) return false;
  for (const other of state.agents) {
    if (other === agent) continue;
    const before = dist(agent.position, other.position);
    const after = dist(next, other.position);
    if (after < MIN_GAP_M && after <= before) return false;
  }
  return true;
}

function settle(agent: Agent, dt: number) {
  agent.speed = 0;
  agent.sit = Math.max(0, agent.sit - dt * 2);
}

function turnToward(agent: Agent, yaw: number, dt: number) {
  let delta = yaw - agent.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const maxTurn = 5 * dt;
  agent.yaw += Math.max(-maxTurn, Math.min(maxTurn, delta));
}

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
const smooth = (t: number) => t * t * (3 - 2 * t);
