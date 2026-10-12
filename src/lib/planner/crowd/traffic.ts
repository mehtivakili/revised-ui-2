import type { FloorPlan, PlanObstacle, Vec2 } from "@/src/domain/planner/types";
import { insideObstacle, obstacleFootprint, obstacleToWorld } from "@/src/lib/planner/crowd/navigation";

/**
 * Traffic for the dynamic environment: a road network built from the plan's road pieces,
 * and cars that drive it.
 *
 * Road pieces that meet end to end are chained (a bend, a long curved highway), a road
 * ending against the side of another makes a T-junction, and two roads crossing make a
 * crossroads. Every junction gets turning curves between its lanes, so a car turns into
 * the next road instead of vanishing where its piece ends. Cars drive on the right, slow
 * for curves, stop at the end of a side road, give way, and enter a junction only when it
 * is empty and there is room on the far side. Wherever two tracks pass close enough for
 * cars to touch without meeting at a junction (a side road merging beside a main road,
 * roads that overlap), that stretch is a conflict zone taken one car at a time. A barrier
 * or gate across a road is a
 * checkpoint: cars pull up, wait a moment and drive on. They come and go only where a road
 * leaves the site; a road that ends inside the site is a turning point.
 */

const RIGHT_HAND_OFFSET = 0.25; // of the road width, from the centre line
const JUNCTION_MERGE_M = 2.2;
const STOP_SECONDS: [number, number] = [0.6, 1.6];
const ACCEL = 2.2;
const BRAKE = 4.5;

type Rng = () => number;

export type Track = {
  id: number;
  kind: "lane" | "connector";
  points: Vec2[];
  /** Cumulative distance at each point. */
  cum: number[];
  length: number;
  /** Speed limit on this track (curves are slower). */
  limit: number;
  /** Tracks that may follow this one. */
  next: number[];
  /** For a lane: the junction at its far end. For a connector: the junction it crosses. */
  node: number;
  /** What a lane does at its end. */
  control: "none" | "yield" | "stop" | "exit";
  /** The edge a lane belongs to, and its direction, to tell a U-turn from a turn. */
  edge: number;
  entry: boolean;
  /** Distances along a lane where it passes a barrier or gate. */
  checkpoints: number[];
  /**
   * Stretches of this track inside a conflict zone, by distance along it, and where a car
   * waiting for the zone stops its front (clear of anything swinging through the zone).
   */
  zones: { zone: number; start: number; end: number; wait: number }[];
  /** For a lane: where a waiting car's front stops, set back from the end where turning cars swing close. */
  hold: number;
};

/** A place two tracks pass close enough for cars on them to touch; one car at a time. */
export type ConflictZone = {
  id: number;
  heldBy: string | null;
  /** Cars waiting for it: when each started waiting and when it last said so. First come, first served. */
  waiting: Map<string, { since: number; seen: number }>;
};

export type Junction = { id: number; position: Vec2; degree: number; gateway: boolean; heldBy: string | null };

export type TrafficCar = {
  id: string;
  track: number;
  s: number;
  speed: number;
  cruise: number;
  lengthM: number;
  widthM: number;
  variant: "sedan" | "suv" | "van" | "pickup";
  color: number;
  active: boolean;
  waitUntil: number;
  presence: number;
  /** Upcoming tracks, chosen ahead so the car can slow for the turn it will take. */
  route: number[];
  /** Junction this car has been let into, until it is clear of it. */
  holds: number | null;
  /** The next junction too, when the road between is shorter than the car (keep the box clear). */
  alsoHolds: number | null;
  /** Conflict zones this car has taken, with the stretch it will drive through. */
  zoneHolds: { zone: number; track: number; start: number; end: number; takenAt: number; entered: boolean }[];
  /** The car it is waiting for, and for how long, to spot two cars waiting for each other. */
  blockedBy: string | null;
  blockedFor: number;
  /** Metres still to back up to make room, and when it may move on again. */
  backing: number;
  pauseUntil: number;
  /** A car this one may squeeze past after a standoff no one could back out of. */
  passing: { id: string; until: number } | null;
  /** The last checkpoint the car was let through, and when it pulled up at the current one. */
  clearedGate: string | null;
  gateSince: number | null;
  /** When the car came to a halt at a stop line. */
  stoppedAt: number | null;
  stopFor: number;
  heading: number;
  position: Vec2;
};

export type Traffic = { tracks: Track[]; junctions: Junction[]; zones: ConflictZone[]; cars: TrafficCar[]; entries: number[] };

/* ── Network ──────────────────────────────────────────────────────── */

type Piece = { obstacle: PlanObstacle; a: Vec2; b: Vec2; length: number; width: number };

/** Road pieces long enough to drive along; squarer paved areas (aprons, yards) are not lanes. */
function roadPieces(floor: FloorPlan): Piece[] {
  return floor.obstacles
    .filter((obstacle) => obstacleFootprint(obstacle) === "road")
    .map((obstacle) => {
      const alongX = obstacle.widthM >= obstacle.depthM;
      const length = Math.max(obstacle.widthM, obstacle.depthM);
      const width = Math.min(obstacle.widthM, obstacle.depthM);
      const a = obstacleToWorld(obstacle, alongX ? { x: -length / 2, z: 0 } : { x: 0, z: -length / 2 });
      const b = obstacleToWorld(obstacle, alongX ? { x: length / 2, z: 0 } : { x: 0, z: length / 2 });
      return { obstacle, a, b, length, width };
    })
    .filter((piece) => piece.length >= 3 && piece.length / piece.width >= 1.6 && piece.width >= 2.4);
}

const sub = (a: Vec2, b: Vec2) => ({ x: a.x - b.x, z: a.z - b.z });
const add = (a: Vec2, b: Vec2) => ({ x: a.x + b.x, z: a.z + b.z });
const scale = (a: Vec2, k: number) => ({ x: a.x * k, z: a.z * k });
const len = (a: Vec2) => Math.hypot(a.x, a.z);
const unit = (a: Vec2) => { const l = len(a) || 1; return { x: a.x / l, z: a.z / l }; };
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.z * b.z;
const at = (piece: Piece, t: number) => ({ x: piece.a.x + (piece.b.x - piece.a.x) * t, z: piece.a.z + (piece.b.z - piece.a.z) * t });

function polyline(points: Vec2[]) {
  const cum = [0];
  for (let index = 1; index < points.length; index += 1) cum.push(cum[index - 1]! + len(sub(points[index]!, points[index - 1]!)));
  return { cum, length: cum[cum.length - 1]! };
}

/** Point and direction a distance s along a track. */
export function trackPose(track: Track, s: number): { position: Vec2; heading: Vec2 } {
  const distance = Math.max(0, Math.min(track.length, s));
  let index = 1;
  while (index < track.points.length - 1 && track.cum[index]! < distance) index += 1;
  const from = track.points[index - 1]!;
  const to = track.points[index]!;
  const span = track.cum[index]! - track.cum[index - 1]! || 1;
  const t = (distance - track.cum[index - 1]!) / span;
  return { position: { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }, heading: unit(sub(to, from)) };
}

export function buildTraffic(floor: FloorPlan, rng: Rng): Traffic {
  const pieces = roadPieces(floor);
  const tracks: Track[] = [];
  const junctions: Junction[] = [];
  if (!pieces.length) return { tracks, junctions, zones: [], cars: [], entries: [] };

  // 1. Where pieces meet: each piece is cut at its ends, where another road ends against
  //    its side, and where another road crosses it.
  type Cut = { piece: number; t: number; point: Vec2; end: boolean };
  const cuts: Cut[] = [];
  pieces.forEach((piece, index) => {
    cuts.push({ piece: index, t: 0, point: piece.a, end: true }, { piece: index, t: 1, point: piece.b, end: true });
  });
  pieces.forEach((piece, i) => {
    for (const end of [piece.a, piece.b]) {
      pieces.forEach((other, j) => {
        if (i === j || !insideObstacle(other.obstacle, end, 0.6)) return;
        // Ending at the other's end is a chain or a corner, found by merging below.
        if (Math.min(len(sub(end, other.a)), len(sub(end, other.b))) < other.width * 0.5 + 0.6) return;
        const direction = unit(sub(other.b, other.a));
        const t = Math.max(0, Math.min(1, dot(sub(end, other.a), direction) / other.length));
        cuts.push({ piece: j, t, point: at(other, t), end: false });
      });
    }
  });
  pieces.forEach((p, i) => pieces.forEach((q, j) => {
    if (j <= i) return;
    const r = sub(p.b, p.a);
    const s = sub(q.b, q.a);
    const denominator = r.x * s.z - r.z * s.x;
    if (Math.abs(denominator) < 1e-6) return;
    const qp = sub(q.a, p.a);
    const t = (qp.x * s.z - qp.z * s.x) / denominator;
    const u = (qp.x * r.z - qp.z * r.x) / denominator;
    if (t > 0.08 && t < 0.92 && u > 0.08 && u < 0.92) {
      const point = at(p, t);
      cuts.push({ piece: i, t, point, end: false }, { piece: j, t: u, point, end: false });
    }
  }));

  // 2. Cuts close together are one junction — transitively, whatever order they come in.
  const parent = cuts.map((_, index) => index);
  const root = (index: number): number => (parent[index] === index ? index : (parent[index] = root(parent[index]!)));
  cuts.forEach((cut, i) => cuts.forEach((other, j) => {
    if (j > i && len(sub(cut.point, other.point)) <= JUNCTION_MERGE_M) parent[root(j)] = root(i);
  }));
  const nodeOf: number[] = [];
  const members: number[][] = [];
  const memberOf = new Map<number, number>();
  cuts.forEach((_, index) => {
    const key = root(index);
    if (!memberOf.has(key)) { memberOf.set(key, members.length); members.push([]); }
    nodeOf[index] = memberOf.get(key)!;
    members[nodeOf[index]!]!.push(index);
  });
  members.forEach((list, id) => {
    const points = list.map((index) => cuts[index]!.point);
    // Prefer points on a through road's centre line, so a T-junction sits on the main road.
    const through = list.filter((index) => !cuts[index]!.end).map((index) => cuts[index]!.point);
    const source = through.length ? through : points;
    junctions.push({
      id,
      position: { x: source.reduce((sum, p) => sum + p.x, 0) / source.length, z: source.reduce((sum, p) => sum + p.z, 0) / source.length },
      degree: 0, gateway: false, heldBy: null
    });
  });

  // 3. Edges between consecutive junctions along each piece.
  type Edge = { u: number; v: number; width: number; throughAt: Set<number> };
  const edges: Edge[] = [];
  const seen = new Set<string>();
  pieces.forEach((piece, index) => {
    const ordered = cuts
      .map((cut, cutIndex) => ({ cut, node: nodeOf[cutIndex]! }))
      .filter((item) => item.cut.piece === index)
      .sort((x, y) => x.cut.t - y.cut.t);
    const interior = new Set(ordered.filter((item) => !item.cut.end).map((item) => item.node));
    for (let k = 1; k < ordered.length; k += 1) {
      const u = ordered[k - 1]!.node;
      const v = ordered[k]!.node;
      if (u === v) continue;
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (seen.has(key) || len(sub(junctions[u]!.position, junctions[v]!.position)) < 1.2) continue;
      seen.add(key);
      edges.push({ u, v, width: piece.width, throughAt: interior });
    }
  });
  // 3b. Junctions so close that the lane between them would be a stub (their stop lines
  //     overlap) are one junction: a stub that short only makes two cars block each other.
  for (let merged = true; merged;) {
    merged = false;
    const widthOf = (node: number) => Math.max(0, ...edges.filter((edge) => edge.u === node || edge.v === node).map((edge) => edge.width));
    for (let index = 0; index < edges.length; index += 1) {
      const edge = edges[index]!;
      const u = junctions[edge.u]!;
      const v = junctions[edge.v]!;
      if (len(sub(u.position, v.position)) >= (widthOf(edge.u) + widthOf(edge.v)) / 2 + 4.5) continue;
      const uDegree = edges.filter((item) => item.u === edge.u || item.v === edge.u).length;
      const vDegree = edges.filter((item) => item.u === edge.v || item.v === edge.v).length;
      // Only two real junctions merge; a dead end (often where the road leaves the site) stays.
      if (uDegree < 2 || vDegree < 2) continue;
      const keep = uDegree >= vDegree ? edge.u : edge.v;
      const drop = keep === edge.u ? edge.v : edge.u;
      junctions[keep]!.position = scale(add(u.position, v.position), 0.5);
      edges.splice(index, 1);
      for (const other of edges) {
        if (other.u === drop) other.u = keep;
        if (other.v === drop) other.v = keep;
        if (other.throughAt.has(drop)) other.throughAt.add(keep);
      }
      for (let k = edges.length - 1; k >= 0; k -= 1) if (edges[k]!.u === edges[k]!.v) edges.splice(k, 1);
      merged = true;
      break;
    }
  }
  for (const edge of edges) { junctions[edge.u]!.degree += 1; junctions[edge.v]!.degree += 1; }

  // 4. A dead end at the edge of the site is where traffic comes and goes.
  const extent = siteExtent(floor);
  for (const junction of junctions) {
    junction.gateway = junction.degree === 1 && (
      junction.position.x < extent.minX + 3 || junction.position.x > extent.maxX - 3
      || junction.position.z < extent.minZ + 3 || junction.position.z > extent.maxZ - 3
    );
  }

  // 5. Lanes: one each way on a two-way road, kept back from junctions so the turns fit.
  const widthAt = (node: number) => Math.max(...edges.filter((edge) => edge.u === node || edge.v === node).map((edge) => edge.width));
  const trimAt = (node: number, along: Vec2) => {
    const junction = junctions[node]!;
    if (junction.degree === 1) return 0.8;
    const others = edges.filter((edge) => edge.u === node || edge.v === node).map((edge) => unit(sub(junctions[edge.u === node ? edge.v : edge.u]!.position, junction.position)));
    // A gentle bend in a chain of pieces needs hardly any room; a real junction needs its width.
    const sharpest = Math.min(...others.map((other) => Math.abs(dot(other, along))));
    const straightish = junction.degree === 2 && sharpest > 0.82;
    // Stop lines sit well back from a real junction, so a car waiting there is clear of
    // every turn through it.
    return straightish ? 0.3 + (1 - sharpest) * 6 : widthAt(node) / 2 + 2.2;
  };
  const gates = floor.obstacles.filter((obstacle) => obstacle.kind === "gate");
  const blockers = floor.obstacles.filter((obstacle) => {
    const footprint = obstacleFootprint(obstacle);
    return (footprint === "block" || footprint === "trunk") && obstacle.kind !== "gate";
  });
  const checkpointsOn = (from: Vec2, to: Vec2) => {
    const direction = unit(sub(to, from));
    const distance = len(sub(to, from));
    const found: number[] = [];
    for (const gate of gates) {
      for (let s = 0; s <= distance; s += 0.4) {
        if (insideObstacle(gate, add(from, scale(direction, s)), 0.1)) { found.push(s); break; }
      }
    }
    return found.sort((a, b) => a - b);
  };
  const blocked = (from: Vec2, to: Vec2) => {
    const direction = unit(sub(to, from));
    const normal = { x: -direction.z, z: direction.x };
    const distance = len(sub(to, from));
    for (let s = 0; s <= distance; s += 0.5) {
      for (const lateral of [-0.8, 0, 0.8]) {
        const point = add(add(from, scale(direction, s)), scale(normal, lateral));
        if (blockers.some((blocker) => insideObstacle(blocker, point, 0.2))) return true;
        if (floor.walls.some((wall) => segmentDistance(point, wall.a, wall.b) < wall.thicknessM / 2 + 0.3)) return true;
      }
    }
    return false;
  };
  const laneOf = new Map<string, number>(); // "edge:direction" -> track id
  edges.forEach((edge, edgeIndex) => {
    const twoWay = edge.width >= 3.4;
    const directions: [number, number][] = twoWay ? [[edge.u, edge.v], [edge.v, edge.u]] : [[edge.u, edge.v]];
    for (const [from, to] of directions) {
      const p = junctions[from]!.position;
      const q = junctions[to]!.position;
      const direction = unit(sub(q, p));
      const right = { x: -direction.z, z: direction.x };
      const offset = twoWay ? edge.width * RIGHT_HAND_OFFSET : 0;
      const total = len(sub(q, p));
      let trimFrom = trimAt(from, direction);
      let trimTo = trimAt(to, scale(direction, -1));
      // Short pieces between two junctions keep at least a short straight.
      if (trimFrom + trimTo > total - 0.4) {
        const k = Math.max(0, total - 0.4) / (trimFrom + trimTo);
        trimFrom *= k;
        trimTo *= k;
      }
      const start = add(add(p, scale(direction, trimFrom)), scale(right, offset));
      const end = add(sub(q, scale(direction, trimTo)), scale(right, offset));
      if (blocked(start, end)) continue;
      const geometry = polyline([start, end]);
      const id = tracks.length;
      tracks.push({
        id, kind: "lane", points: [start, end], ...geometry, limit: Infinity, next: [], node: to,
        control: "none", edge: edgeIndex, entry: junctions[from]!.gateway, checkpoints: checkpointsOn(start, end), zones: [],
        hold: geometry.length - 0.3
      });
      laneOf.set(`${edgeIndex}:${from}`, id);
    }
  });

  // 6. Turns: a curve from every lane into a junction to every lane out of it.
  for (const lane of tracks.filter((track) => track.kind === "lane")) {
    const junction = junctions[lane.node]!;
    const outgoing = tracks.filter((track) => track.kind === "lane" && trackStartNode(track, edges, laneOf) === lane.node);
    const edge = edges[lane.edge]!;
    if (junction.gateway) { lane.control = "exit"; continue; }
    const incomingDirection = unit(sub(lane.points[1]!, lane.points[0]!));
    for (const out of outgoing) {
      const uTurn = out.edge === lane.edge;
      if (uTurn && junction.degree > 1) continue;
      const p0 = lane.points[lane.points.length - 1]!;
      const p3 = out.points[0]!;
      const outDirection = unit(sub(out.points[1]!, out.points[0]!));
      const reach = uTurn ? edge.width * 0.9 + 1 : Math.max(0.6, len(sub(p3, p0)) * 0.42);
      const p1 = add(p0, scale(incomingDirection, reach));
      const p2 = sub(p3, scale(outDirection, reach));
      const points: Vec2[] = [];
      for (let k = 0; k <= 10; k += 1) {
        const t = k / 10;
        const m = 1 - t;
        points.push({
          x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
          z: m * m * m * p0.z + 3 * m * m * t * p1.z + 3 * m * t * t * p2.z + t * t * t * p3.z
        });
      }
      const geometry = polyline(points);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot(incomingDirection, outDirection))));
      const radius = angle > 0.15 ? geometry.length / angle : Infinity;
      const id = tracks.length;
      tracks.push({
        id, kind: "connector", points, ...geometry,
        limit: radius === Infinity ? Infinity : Math.max(2.2, Math.min(11, Math.sqrt(2.4 * radius))),
        next: [out.id], node: lane.node, control: "none", edge: -1, entry: false, checkpoints: [], zones: [], hold: geometry.length
      });
      lane.next.push(id);
    }
    if (!lane.next.length) { lane.control = "exit"; continue; }
    // Who stops: at a junction of three or more roads, a road that ends there stops; a
    // road running through it only gives way. A sharp corner is taken one car at a time
    // (two cars turning there at once would clip), and a gentle bend needs nothing.
    if (junction.degree >= 3) lane.control = edge.throughAt.has(lane.node) ? "yield" : "stop";
    else if (junction.degree === 2 && lane.next.some((id) => tracks[id]!.limit < Infinity && tracks[id]!.limit < 8)) lane.control = "yield";
  }

  setBackStopLines(tracks);
  const zones = conflictZones(tracks);
  const entries = tracks.filter((track) => track.kind === "lane" && track.entry).map((track) => track.id);
  const cars = spawnCars(tracks, rng);
  for (const car of cars) placeCar(tracks, car);
  return { tracks, junctions, zones, cars, entries };
}

/** Centre and facing of a vehicle body with its centre a distance along a path. */
function bodyAt(tracks: Track[], path: { track: number; route: number[] }, s: number, lengthM: number) {
  const centre = routePoint(tracks, path, s);
  const forward = unit(sub(routePoint(tracks, path, s + lengthM * 0.35), routePoint(tracks, path, s - lengthM * 0.35)));
  return { centre, forward };
}

/** The largest vehicle, for working out how wide a turn swings. */
const LARGEST = { lengthM: 5.4, widthM: 2.05 };

/**
 * Do two vehicle bodies (centre, way they face, size) touch? A separating-axis test, with
 * the bodies a little smaller than drawn so mirrors may pass close.
 */
function bodiesTouch(
  a: { centre: Vec2; forward: Vec2; lengthM: number; widthM: number },
  b: { centre: Vec2; forward: Vec2; lengthM: number; widthM: number },
  margin = 0
) {
  const aSide = { x: -a.forward.z, z: a.forward.x };
  const bSide = { x: -b.forward.z, z: b.forward.x };
  const rel = sub(b.centre, a.centre);
  for (const axis of [a.forward, aSide, b.forward, bSide]) {
    const reachA = a.lengthM * 0.5 * Math.abs(dot(a.forward, axis)) + a.widthM * 0.45 * Math.abs(dot(aSide, axis));
    const reachB = b.lengthM * 0.5 * Math.abs(dot(b.forward, axis)) + b.widthM * 0.45 * Math.abs(dot(bSide, axis));
    if (Math.abs(dot(rel, axis)) > reachA + reachB + margin) return false;
  }
  return true;
}

/**
 * Where cars wait at a junction: as near the end of the lane as a large vehicle turning
 * through the junction from another road can still get past a car waiting there, the way
 * stop lines are painted back from a tight corner. Up to 3 m back.
 */
function setBackStopLines(tracks: Track[]) {
  for (const lane of tracks) {
    if (lane.kind !== "lane" || (lane.control !== "yield" && lane.control !== "stop")) continue;
    const turns = tracks.filter((track) => track.kind === "connector" && track.node === lane.node && !lane.next.includes(track.id));
    const sweeps: { centre: Vec2; forward: Vec2 }[] = [];
    for (const turn of turns) {
      const route = { track: turn.id, route: turn.next.slice(0, 1) };
      for (let s = -LARGEST.lengthM / 2; s <= turn.length + LARGEST.lengthM / 2; s += 0.4) {
        const centre = routePoint(tracks, route, s);
        const forward = unit(sub(routePoint(tracks, route, s + LARGEST.lengthM * 0.35), routePoint(tracks, route, s - LARGEST.lengthM * 0.35)));
        sweeps.push({ centre, forward });
      }
    }
    const waiting = { lengthM: 4.6, widthM: 1.9 };
    for (let hold = lane.length - 0.3; hold >= lane.length - 3.3; hold -= 0.25) {
      lane.hold = hold;
      const centre = routePoint(tracks, { track: lane.id, route: [] }, hold - waiting.lengthM / 2);
      const forward = trackPose(lane, Math.max(0, hold - waiting.lengthM / 2)).heading;
      if (!sweeps.some((sweep) => bodiesTouch({ centre, forward, ...waiting }, { ...sweep, ...LARGEST }, 0.15))) break;
    }
  }
}

/** Centre lines closer than this let two cars touch: crossing at an angle, or side by side. */
const CONFLICT_CLEARANCE_M = 2.15;
const PARALLEL_CLEARANCE_M = 1.75;

/**
 * Stretches where two tracks come within touching distance without the road graph making
 * them one junction. Excluded: a track and the one it leads into, two turns through the
 * same junction (the junction itself is taken one car at a time), and the two lanes of one
 * road (they run side by side by design).
 */
function conflictZones(tracks: Track[]): ConflictZone[] {
  const related = (a: Track, b: Track) =>
    a.next.includes(b.id) || b.next.includes(a.id)
    || (a.kind === "connector" && b.kind === "connector" && a.node === b.node)
    || (a.kind === "lane" && b.kind === "lane" && a.edge === b.edge);
  const nearestOn = (point: Vec2, track: Track) => {
    let best = Infinity;
    let direction = { x: 1, z: 0 };
    for (let index = 1; index < track.points.length; index += 1) {
      const distance = segmentDistance(point, track.points[index - 1]!, track.points[index]!);
      if (distance < best) { best = distance; direction = unit(sub(track.points[index]!, track.points[index - 1]!)); }
    }
    return { distance: best, direction };
  };
  // Stretches of each track near another track, as [start, end] intervals.
  const stretches: { track: number; start: number; end: number; with: number }[] = [];
  const near = (a: Track, b: Track) => {
    let start = -1;
    for (let d = 0; d <= a.length + 1e-6; d += 0.4) {
      const here = trackPose(a, d);
      const there = nearestOn(here.position, b);
      // Running side by side (the two lanes either side of a corner, say) cars pass at lane
      // spacing; only where the tracks meet at an angle does a car need the wider margin.
      const parallel = Math.abs(dot(here.heading, there.direction)) > 0.92;
      const close = there.distance < (parallel ? PARALLEL_CLEARANCE_M : CONFLICT_CLEARANCE_M);
      if (close && start < 0) start = d;
      if ((!close || d + 0.4 > a.length) && start >= 0) {
        stretches.push({ track: a.id, start: Math.max(0, start - 0.6), end: Math.min(a.length, (close ? d : d - 0.4) + 0.6), with: b.id });
        start = -1;
      }
    }
  };
  for (let i = 0; i < tracks.length; i += 1) {
    for (let j = i + 1; j < tracks.length; j += 1) {
      const a = tracks[i]!;
      const b = tracks[j]!;
      if (related(a, b)) continue;
      const before = stretches.length;
      near(a, b);
      if (stretches.length > before) near(b, a);
    }
  }
  // One zone per group of stretches that touch, either across tracks or along one track.
  const parent = stretches.map((_, index) => index);
  const root = (index: number): number => (parent[index] === index ? index : (parent[index] = root(parent[index]!)));
  stretches.forEach((a, i) => stretches.forEach((b, j) => {
    if (j <= i) return;
    const sameTrackOverlap = a.track === b.track && a.start <= b.end && b.start <= a.end;
    const pair = (a.track === b.with && b.track === a.with);
    if (sameTrackOverlap || pair) parent[root(j)] = root(i);
  }));
  const zoneOf = new Map<number, number>();
  const zones: ConflictZone[] = [];
  stretches.forEach((stretch, index) => {
    const key = root(index);
    if (!zoneOf.has(key)) { zoneOf.set(key, zones.length); zones.push({ id: zones.length, heldBy: null, waiting: new Map() }); }
    const zone = zoneOf.get(key)!;
    const track = tracks[stretch.track]!;
    const existing = track.zones.find((item) => item.zone === zone && item.start <= stretch.end && stretch.start <= item.end);
    if (existing) {
      existing.start = Math.min(existing.start, stretch.start);
      existing.end = Math.max(existing.end, stretch.end);
    } else {
      track.zones.push({ zone, start: stretch.start, end: stretch.end, wait: stretch.start });
    }
  });
  for (const track of tracks) track.zones.sort((a, b) => a.start - b.start);
  // Where to wait: back from the stretch until a car standing there is clear of the
  // largest vehicle driving through the zone on any of its other tracks.
  for (const track of tracks) {
    for (const stretch of track.zones) {
      const sweeps: { centre: Vec2; forward: Vec2 }[] = [];
      for (const other of tracks) {
        if (other === track) continue;
        for (const through of other.zones) {
          if (through.zone !== stretch.zone) continue;
          const path = { track: other.id, route: other.next.slice(0, 1) };
          for (let d = through.start - 1; d <= through.end + 1; d += 0.4) sweeps.push(bodyAt(tracks, path, d, LARGEST.lengthM));
        }
      }
      const path = { track: track.id, route: [] };
      for (let wait = stretch.start - 0.4; wait >= stretch.start - 5; wait -= 0.25) {
        stretch.wait = wait;
        const body = { ...bodyAt(tracks, path, wait - LARGEST.lengthM / 2, LARGEST.lengthM), ...LARGEST };
        if (!sweeps.some((sweep) => bodiesTouch(body, { ...sweep, ...LARGEST }, 0.1))) break;
      }
    }
  }
  return zones;
}

function trackStartNode(track: Track, edges: { u: number; v: number }[], laneOf: Map<string, number>) {
  const edge = edges[track.edge]!;
  return laneOf.get(`${track.edge}:${edge.u}`) === track.id ? edge.u : edge.v;
}

function siteExtent(floor: FloorPlan) {
  const points: Vec2[] = [
    ...floor.walls.flatMap((wall) => [wall.a, wall.b]),
    ...(floor.rooms ?? []).flatMap((room) => room.polygon),
    ...floor.obstacles.flatMap((obstacle) => [
      obstacleToWorld(obstacle, { x: -obstacle.widthM / 2, z: -obstacle.depthM / 2 }),
      obstacleToWorld(obstacle, { x: obstacle.widthM / 2, z: obstacle.depthM / 2 }),
      obstacleToWorld(obstacle, { x: -obstacle.widthM / 2, z: obstacle.depthM / 2 }),
      obstacleToWorld(obstacle, { x: obstacle.widthM / 2, z: -obstacle.depthM / 2 })
    ])
  ];
  return {
    minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)), maxZ: Math.max(...points.map((p) => p.z))
  };
}

function segmentDistance(point: Vec2, a: Vec2, b: Vec2) {
  const d = sub(b, a);
  const lengthSq = dot(d, d) || 1e-9;
  const t = Math.max(0, Math.min(1, dot(sub(point, a), d) / lengthSq));
  return len(sub(point, add(a, scale(d, t))));
}

/* ── Cars ─────────────────────────────────────────────────────────── */

const carColors = [0x0f766e, 0x2563eb, 0xdc2626, 0xf8fafc, 0x111827, 0x9ca3af, 0xf59e0b, 0x7c3aed];
const carSizes = {
  sedan: { lengthM: 4.5, widthM: 1.8 },
  suv: { lengthM: 4.8, widthM: 1.95 },
  van: { lengthM: 5.4, widthM: 2.05 },
  pickup: { lengthM: 5.3, widthM: 1.9 }
} as const;

function newCar(id: string, rng: Rng, track: number, s: number): TrafficCar {
  const variant = (["sedan", "sedan", "suv", "van", "pickup"] as const)[Math.floor(rng() * 5)]!;
  return {
    id, track, s, speed: 0, cruise: 4 + rng() * 5, ...carSizes[variant], variant,
    color: carColors[Math.floor(rng() * carColors.length)]!,
    active: true, waitUntil: 0, presence: 1, route: [], holds: null, stoppedAt: null,
    stopFor: STOP_SECONDS[0] + rng() * (STOP_SECONDS[1] - STOP_SECONDS[0]), heading: 0, position: { x: 0, z: 0 },
    blockedBy: null, blockedFor: 0, backing: 0, pauseUntil: 0, passing: null, clearedGate: null, gateSince: null, alsoHolds: null,
    zoneHolds: []
  };
}

/** About one car per 35 m of lane, spaced out along the lanes. */
function spawnCars(tracks: Track[], rng: Rng): TrafficCar[] {
  const lanes = tracks.filter((track) => track.kind === "lane" && track.length > 6);
  const total = lanes.reduce((sum, lane) => sum + lane.length, 0);
  const count = Math.max(lanes.length ? 1 : 0, Math.min(14, Math.round(total / 35)));
  const cars: TrafficCar[] = [];
  for (let attempt = 0; attempt < count * 12 && cars.length < count; attempt += 1) {
    const lane = lanes[Math.floor(rng() * lanes.length)]!;
    const car = newCar(`car-${cars.length}`, rng, lane.id, 0);
    const room = lane.length - car.lengthM - 2;
    if (room <= 0) continue;
    car.s = car.lengthM / 2 + 1 + rng() * room;
    if (cars.some((other) => other.track === lane.id && Math.abs(other.s - car.s) < 9)) continue;
    // Nor right beside a car on another road that happens to pass close by.
    const here = trackPose(lane, car.s).position;
    if (cars.some((other) => len(sub(trackPose(tracks[other.track]!, other.s).position, here)) < 8)) continue;
    car.speed = car.cruise * 0.5;
    cars.push(car);
  }
  return cars;
}

/** Pick the next turn: carrying straight on is likelier than turning. */
function chooseNext(traffic: Traffic, track: Track, rng: Rng): number | null {
  if (!track.next.length) return null;
  if (track.kind === "connector") return track.next[0]!;
  const direction = unit(sub(track.points[track.points.length - 1]!, track.points[0]!));
  const weights = track.next.map((id) => {
    const connector = traffic.tracks[id]!;
    const out = traffic.tracks[connector.next[0]!]!;
    const outDirection = unit(sub(out.points[out.points.length - 1]!, out.points[0]!));
    const straight = dot(direction, outDirection);
    return straight > 0.8 ? 3 : straight < -0.8 ? 0.4 : 1;
  });
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return track.next[index]!;
  }
  return track.next[track.next.length - 1]!;
}

function ensureRoute(traffic: Traffic, car: TrafficCar, rng: Rng) {
  let last = car.route.length ? car.route[car.route.length - 1]! : car.track;
  while (car.route.length < 3) {
    const next = chooseNext(traffic, traffic.tracks[last]!, rng);
    if (next === null) break;
    car.route.push(next);
    last = next;
  }
}

/** Room for one more car at the start of a track, counting cars still on their way into it. */
function roomAtStart(traffic: Traffic, track: number, lengthM: number, except: TrafficCar) {
  return traffic.cars.every((other) => other === except || !other.active || other.track !== track || other.s - other.lengthM / 2 > lengthM + 2);
}

/** Zone stretches ahead of the car's front: on its track and along its route. */
function zonesAhead(traffic: Traffic, car: TrafficCar, reach: number) {
  const found: { zone: number; track: number; start: number; end: number; toStart: number; toEnd: number; toWait: number }[] = [];
  const front = car.s + car.lengthM / 2;
  let offset = -front;
  const path = [car.track, ...car.route];
  for (const id of path) {
    const track = traffic.tracks[id]!;
    for (const stretch of track.zones) {
      const toStart = offset + stretch.start;
      const toEnd = offset + stretch.end;
      // Behind the car's rear already: nothing to do with it.
      if (toEnd < -car.lengthM) continue;
      if (toStart > reach) break;
      found.push({ zone: stretch.zone, track: id, start: stretch.start, end: stretch.end, toStart, toEnd, toWait: offset + stretch.wait });
    }
    offset += track.length;
    if (offset > reach) break;
  }
  return found;
}

/** The car standing in one of a zone's stretches, other than `car`. */
function zoneOccupant(traffic: Traffic, zone: number, car: TrafficCar) {
  return traffic.cars.find((other) => {
    if (other === car || !other.active) return false;
    return traffic.tracks[other.track]!.zones.some((stretch) => stretch.zone === zone
      && other.s - other.lengthM / 2 < stretch.end && other.s + other.lengthM / 2 > stretch.start);
  }) ?? null;
}

/** A zone is free when nobody else holds it and no other car stands in any of its stretches. */
function zoneFree(traffic: Traffic, zone: number, car: TrafficCar) {
  const holder = traffic.zones[zone]!.heldBy;
  if (holder && holder !== car.id) return false;
  return zoneOccupant(traffic, zone, car) === null;
}

/** Free, and nobody has been waiting for it longer than this car. */
function zoneAvailable(traffic: Traffic, zone: number, car: TrafficCar, time: number) {
  if (!zoneFree(traffic, zone, car)) return false;
  const mine = traffic.zones[zone]!.waiting.get(car.id)?.since ?? Infinity;
  for (const [id, wait] of traffic.zones[zone]!.waiting) {
    if (id !== car.id && time - wait.seen < 0.5 && wait.since < mine) return false;
  }
  return true;
}

/** Join (or stay in) the queue for the zones this car is stopped for. */
function waitFor(traffic: Traffic, car: TrafficCar, zones: number[], time: number) {
  for (const zone of zones) {
    const queue = traffic.zones[zone]!.waiting;
    const entry = queue.get(car.id);
    if (entry) entry.seen = time;
    else queue.set(car.id, { since: time, seen: time });
  }
}

function takeZones(traffic: Traffic, car: TrafficCar, stretches: { zone: number; track: number; start: number; end: number }[], time: number) {
  for (const stretch of stretches) {
    traffic.zones[stretch.zone]!.heldBy = car.id;
    traffic.zones[stretch.zone]!.waiting.delete(car.id);
    if (!car.zoneHolds.some((held) => held.zone === stretch.zone)) {
      car.zoneHolds.push({ zone: stretch.zone, track: stretch.track, start: stretch.start, end: stretch.end, takenAt: time, entered: stretch.track === car.track });
    }
  }
}

/**
 * Let go of zones the car is through: its rear is past the stretch, or it has left that
 * track. A car that has come to a halt before reaching a zone it holds lets it go too:
 * holding one thing while waiting for another is how two cars end up waiting for each
 * other.
 */
function releaseZones(traffic: Traffic, car: TrafficCar, time: number, all = false) {
  car.zoneHolds = car.zoneHolds.filter((held) => {
    const onIt = held.track === car.track;
    if (onIt) held.entered = true;
    // Once driven through, a stretch is done with, even if a short loop brings it round again.
    const ahead = !held.entered && car.route.includes(held.track);
    const through = onIt ? car.s - car.lengthM / 2 > held.end : !ahead && car.s - car.lengthM / 2 > 0;
    const notReached = (onIt && car.s + car.lengthM / 2 < held.start - 0.3) || (!onIt && ahead);
    const waitingOutside = notReached && car.speed < 0.05 && time - held.takenAt > 1;
    const drop = all || through || waitingOutside;
    if (drop && traffic.zones[held.zone]!.heldBy === car.id) traffic.zones[held.zone]!.heldBy = null;
    return !drop;
  });
}

/**
 * Distance from the car's front to the next stop line it has not been let through: zones
 * beyond it are taken with that junction, never on the way to it.
 */
function toNextStopLine(traffic: Traffic, car: TrafficCar) {
  let offset = -(car.s + car.lengthM / 2);
  for (const id of [car.track, ...car.route]) {
    const track = traffic.tracks[id]!;
    offset += track.length;
    if (track.kind === "lane" && (track.control === "yield" || track.control === "stop") && car.holds !== track.node && car.alsoHolds !== track.node) return offset;
  }
  return Infinity;
}

/** A junction is free when nobody holds it and no car is on one of its turns. */
function junctionFree(traffic: Traffic, node: number, car: TrafficCar) {
  const junction = traffic.junctions[node]!;
  if (junction.heldBy && junction.heldBy !== car.id) return false;
  return traffic.cars.every((other) => other === car || !other.active || traffic.tracks[other.track]!.kind !== "connector" || traffic.tracks[other.track]!.node !== node);
}

/**
 * Who is in my way, from where cars actually are rather than from the road graph alone:
 * roads in a plan can run close or overlap without meeting at a junction. Each car looks
 * along its own route; a car whose body lies on that path makes it brake. When two cars
 * are in each other's way, the one holding a junction, or nearer the meeting point,
 * goes first.
 */
function ignores(car: TrafficCar, other: TrafficCar, time: number) {
  return car.passing !== null && car.passing.id === other.id && time < car.passing.until;
}

function pathConflicts(traffic: Traffic, time: number) {
  const active = traffic.cars.filter((car) => car.active && car.presence > 0.2);
  const blockedAt = new Map<TrafficCar, { distance: number; by: TrafficCar }[]>();
  for (const car of active) {
    const reach = Math.max(6, Math.min(16, (car.speed * car.speed) / (2 * BRAKE) + car.lengthM / 2 + 4));
    const hits: { distance: number; by: TrafficCar }[] = [];
    for (const other of active) {
      if (other === car || ignores(car, other, time) || len(sub(other.position, car.position)) > reach + other.lengthM) continue;
      const forward = { x: Math.cos(other.heading), z: -Math.sin(other.heading) };
      const side = { x: -forward.z, z: forward.x };
      // Cars side by side in neighbouring lanes (or passing the other way) may run close;
      // at an angle, in a junction, they keep a proper margin.
      for (let d = car.lengthM / 2 + 0.2; d <= reach; d += 0.6) {
        const point = routePoint(traffic.tracks, car, car.s + d);
        // Parallel is judged by the path at that point, not by the car's heading now: a
        // car mid-turn is headed across the lane it is about to straighten into.
        const along = unit(sub(routePoint(traffic.tracks, car, car.s + d + 0.5), point));
        const parallel = Math.abs(dot(along, forward)) > 0.92;
        const sideMargin = other.widthM / 2 + car.widthM / 2 + (parallel ? -0.3 : 0.25);
        const rel = sub(point, other.position);
        if (Math.abs(dot(rel, forward)) <= other.lengthM / 2 + 0.4 && Math.abs(dot(rel, side)) <= sideMargin) {
          hits.push({ distance: d - car.lengthM / 2, by: other });
          break;
        }
      }
    }
    blockedAt.set(car, hits);
  }
  const gaps = new Map<TrafficCar, { gap: number; by: TrafficCar | null }>();
  for (const [car, hits] of blockedAt) {
    let gap = Infinity;
    let by: TrafficCar | null = null;
    for (const hit of hits) {
      const mutual = blockedAt.get(hit.by)?.find((other) => other.by === car);
      if (mutual) {
        // Both in each other's way: the junction holder, then the nearer one, then the lower id goes.
        const mine = car.holds !== null ? -1 : hit.distance;
        const theirs = hit.by.holds !== null ? -1 : mutual.distance;
        const iGo = mine < theirs || (mine === theirs && car.id < hit.by.id);
        if (iGo) continue;
      }
      if (hit.distance < gap) { gap = hit.distance; by = hit.by; }
    }
    gaps.set(car, { gap, by });
  }
  return gaps;
}

/** A point a distance along a car's track and planned route, straight on beyond it. */
export function routePoint(tracks: Track[], car: Pick<TrafficCar, "track" | "route">, s: number): Vec2 {
  let track = tracks[car.track]!;
  let distance = s;
  for (const next of car.route) {
    if (distance <= track.length) break;
    distance -= track.length;
    track = tracks[next]!;
  }
  const clamped = Math.max(0, Math.min(track.length, distance));
  const pose = trackPose(track, clamped);
  return add(pose.position, scale(pose.heading, distance - clamped));
}

/** The way the car's body points with its centre at s: from its rear wheels to its front. */
function bodyForward(tracks: Track[], car: TrafficCar, s: number) {
  return unit(sub(routePoint(tracks, car, s + car.lengthM * 0.35), routePoint(tracks, car, s - car.lengthM * 0.35)));
}

function placeCar(tracks: Track[], car: TrafficCar) {
  const track = tracks[car.track]!;
  const forward = bodyForward(tracks, car, car.s);
  car.position = routePoint(tracks, car, car.s);
  car.heading = -Math.atan2(forward.z, forward.x);
}

export function stepTraffic(traffic: Traffic, dt: number, time: number, rng: Rng) {
  for (const car of traffic.cars) if (car.active) ensureRoute(traffic, car, rng);
  const worldGaps = pathConflicts(traffic, time);
  for (const car of traffic.cars) {
    if (!car.active) {
      reenter(traffic, car, time, rng);
      continue;
    }
    ensureRoute(traffic, car, rng);
    // Backing up to clear a standoff, then a moment before moving on.
    if (car.backing > 0) {
      const step = Math.min(car.backing, 1.1 * dt);
      // Never back into anyone either.
      if (overlapsAny(traffic, car, car.s - step)) {
        car.backing = 0;
        car.pauseUntil = time + 1;
        continue;
      }
      car.s -= step;
      car.backing -= step;
      car.speed = 0;
      if (car.backing <= 1e-3) { car.backing = 0; car.pauseUntil = time + 1.4; }
      placeCar(traffic.tracks, car);
      continue;
    }
    const track = traffic.tracks[car.track]!;
    const front = car.s + car.lengthM / 2;
    let allowed = time < car.pauseUntil ? 0 : Math.min(car.cruise, track.limit);

    // The car ahead, on this track or the next two of the route.
    let gap = Infinity;
    let queueBy: TrafficCar | null = null;
    let distanceAhead = track.length - car.s;
    for (const other of traffic.cars) {
      if (other === car || !other.active || other.track !== car.track || other.s <= car.s) continue;
      const between = other.s - other.lengthM / 2 - front;
      if (between < gap) { gap = between; queueBy = other; }
    }
    for (const id of car.route.slice(0, 2)) {
      for (const other of traffic.cars) {
        if (other === car || !other.active || other.track !== id) continue;
        const between = distanceAhead + other.s - other.lengthM / 2 - car.lengthM / 2;
        if (between < gap) { gap = between; queueBy = other; }
      }
      distanceAhead += traffic.tracks[id]!.length;
    }
    // Anyone else in the way on the ground, on any road.
    const world = worldGaps.get(car);
    gap = Math.min(gap, (world?.gap ?? Infinity) + 1.2);
    if (gap < Infinity) allowed = Math.min(allowed, Math.sqrt(Math.max(0, 2 * BRAKE * Math.max(0, gap - 2.5))));

    // Slow for the turn ahead.
    const nextId = car.route[0];
    const next = nextId !== undefined ? traffic.tracks[nextId] : undefined;
    const toEnd = track.length - front;
    if (next && next.limit < Infinity) allowed = Math.min(allowed, Math.sqrt(next.limit * next.limit + 2 * BRAKE * Math.max(0, toEnd)));

    // The stop line: wait for the junction, after a full stop at the end of a side road.
    let stopAt = Infinity;
    let junctionHolder: TrafficCar | null = null;
    if (track.kind === "lane" && next && car.holds !== track.node) {
      const outLane = next.next[0];
      const roomOut = outLane === undefined || roomAtStart(traffic, outLane, car.lengthM, car);
      const mustHalt = track.control === "stop" && (car.stoppedAt === null || time - car.stoppedAt < car.stopFor);
      const needsJunction = track.control !== "none";
      // Keep the box clear: if the road beyond is too short to stop on, the junction after
      // it must be free as well, and is taken at the same time.
      const beyond = outLane !== undefined ? traffic.tracks[outLane]! : undefined;
      const farNode = beyond && beyond.length < car.lengthM + 2 && (beyond.control === "yield" || beyond.control === "stop") && car.alsoHolds !== beyond.node
        ? beyond.node
        : null;
      // The zones the turn crosses are taken with the junction, or not at all.
      const turnZones = zonesAhead(traffic, car, toEnd + next.length + car.lengthM + 1)
        .filter((stretch) => stretch.toStart >= toEnd - 0.5 && !car.zoneHolds.some((held) => held.zone === stretch.zone));
      const zonesClear = turnZones.every((stretch) => zoneAvailable(traffic, stretch.zone, car, time));
      // And nobody standing with any part of them in the way of the turn: a car waiting at
      // another approach can reach into the junction.
      const reserved = (!needsJunction || junctionFree(traffic, track.node, car)) && (farNode === null || junctionFree(traffic, farNode, car))
        && (!needsJunction || zonesClear);
      const inTheWay = reserved && needsJunction && toEnd < 8
        ? standingOnPath(traffic, car, track.length - car.s + next.length + car.lengthM / 2 + 0.5)
        : null;
      const free = reserved && !inTheWay;
      if (mustHalt || !free || !roomOut) {
        stopAt = track.hold;
        const holder = traffic.junctions[track.node]!.heldBy ?? (farNode !== null ? traffic.junctions[farNode]!.heldBy : null);
        if (!free && holder) junctionHolder = traffic.cars.find((other) => other.id === holder) ?? null;
        junctionHolder ??= inTheWay;
        if (!zonesClear && toEnd < 8) waitFor(traffic, car, turnZones.map((stretch) => stretch.zone), time);
        // Or whoever has the turn's zone, or is in the way on the road beyond.
        if (!junctionHolder && !zonesClear) {
          for (const stretch of turnZones) {
            const zoneHeld = traffic.zones[stretch.zone]!.heldBy;
            junctionHolder = (zoneHeld && zoneHeld !== car.id ? traffic.cars.find((other) => other.id === zoneHeld) : null)
              ?? zoneOccupant(traffic, stretch.zone, car);
            if (junctionHolder) break;
          }
        }
        if (!junctionHolder && !roomOut && outLane !== undefined) {
          junctionHolder = traffic.cars.filter((other) => other.active && other.track === outLane).sort((a, b) => a.s - b.s)[0] ?? null;
        }
      } else if ((needsJunction || farNode !== null) && toEnd < 6) {
        // Let go of the last junction before taking this one.
        release(traffic, car);
        if (needsJunction) {
          traffic.junctions[track.node]!.heldBy = car.id;
          car.holds = track.node;
        }
        if (farNode !== null) {
          traffic.junctions[farNode]!.heldBy = car.id;
          if (car.holds === null) car.holds = farNode;
          else car.alsoHolds = farNode;
        }
        if (needsJunction) takeZones(traffic, car, turnZones, time);
      }
      if (track.control === "yield" && toEnd < 8) allowed = Math.min(allowed, 4);
    }
    // Conflict zones: take the next one (and any right after it, so the car never stops
    // between two) when it is free and there is room beyond; otherwise stop short of it.
    let zoneHolder: TrafficCar | null = null;
    const reachZones = (car.speed * car.speed) / (2 * BRAKE) + 8;
    const stopLine = toNextStopLine(traffic, car);
    const upcoming = zonesAhead(traffic, car, reachZones)
      .filter((stretch) => !car.zoneHolds.some((held) => held.zone === stretch.zone) && stretch.toStart < stopLine);
    const first = upcoming[0];
    if (first) {
      const group = upcoming.filter((stretch) => stretch.toStart <= first.toEnd + car.lengthM + 1);
      const last = group.reduce((max, stretch) => Math.max(max, stretch.toEnd), first.toEnd);
      const clear = group.every((stretch) => zoneAvailable(traffic, stretch.zone, car, time));
      const roomBeyond = gap > last + 1 || (queueBy !== null && queueBy.speed > 1.5);
      if (!clear && first.toStart < 8) waitFor(traffic, car, group.map((stretch) => stretch.zone), time);
      // Stretches running up to the car's own stop line are where it will wait: it may
      // roll up into them when they are free, but holds nothing there (a car at a stop
      // line holding anything is how three cars end up waiting on each other).
      const waitsInside = last > stopLine - car.lengthM - 1;
      if (waitsInside) {
        if (!clear && first.toStart > 0.2) {
          stopAt = Math.min(stopAt, front + first.toWait);
          const holderId = group.map((stretch) => traffic.zones[stretch.zone]!.heldBy).find((id) => id && id !== car.id);
          zoneHolder = (holderId ? traffic.cars.find((other) => other.id === holderId) : null)
            ?? group.map((stretch) => zoneOccupant(traffic, stretch.zone, car)).find(Boolean) ?? null;
        }
      } else if (first.toStart <= 0.2) {
        // Already in it (it was free a moment ago, or the car spawned here): carry on through.
        if (clear) takeZones(traffic, car, group, time);
      } else if (clear && roomBeyond) {
        if (first.toStart < Math.max(3, (car.speed * car.speed) / (2 * BRAKE) + 2)) takeZones(traffic, car, group, time);
      } else {
        stopAt = Math.min(stopAt, front + first.toWait);
        const holderId = group.map((stretch) => traffic.zones[stretch.zone]!.heldBy).find((id) => id && id !== car.id);
        zoneHolder = (holderId ? traffic.cars.find((other) => other.id === holderId) : null)
          ?? group.map((stretch) => zoneOccupant(traffic, stretch.zone, car)).find(Boolean) ?? null;
      }
    }
    // A barrier or gate: pull up just before it, wait a moment, then drive through.
    for (let index = 0; index < track.checkpoints.length; index += 1) {
      const key = `${track.id}:${index}`;
      const line = track.checkpoints[index]! - 1;
      if (car.clearedGate === key || front > line + 0.6) continue;
      if (line - front < 0.5 && car.speed < 0.05) {
        car.gateSince ??= time;
        if (time - car.gateSince > 1.6) { car.clearedGate = key; car.gateSince = null; continue; }
      }
      stopAt = Math.min(stopAt, line);
      break;
    }
    if (stopAt < Infinity) allowed = Math.min(allowed, Math.sqrt(Math.max(0, 2 * BRAKE * Math.max(0, stopAt - front))));

    const change = allowed - car.speed;
    car.speed = Math.max(0, car.speed + Math.max(-BRAKE * 1.6 * dt, Math.min(ACCEL * dt, change)));
    let advance = car.speed * dt;
    // Hard limits: never past a stop line, never into the car ahead.
    if (stopAt < Infinity) advance = Math.min(advance, Math.max(0, stopAt - front));
    if (gap < Infinity) advance = Math.min(advance, Math.max(0, gap - 1.6));
    if (advance < car.speed * dt) car.speed = advance / dt;
    if (car.speed < 0.05 && stopAt < Infinity && stopAt - front < 0.6 && car.stoppedAt === null) car.stoppedAt = time;
    // Last guarantee: never move into a car ahead, on any road.
    const hardBlock = advance > 0 ? intoSomeone(traffic, car, car.s + advance, time) : null;
    if (hardBlock) {
      advance = 0;
      car.speed = 0;
    }
    car.s += advance;
    // Who is this car waiting for? Two cars waiting for each other is a standoff to break.
    // Who is this car waiting for: a body in its way, the car ahead on its route, or the
    // car holding the junction it wants.
    // A car that is in turn waiting for this one comes first, so a standoff is recognised.
    const candidates = car.speed < 0.05 && time >= car.pauseUntil
      ? [hardBlock, world && world.gap < 3 ? world.by : null, gap < 3 ? queueBy : null, junctionHolder, zoneHolder].filter((item): item is TrafficCar => Boolean(item))
      : [];
    const waitingFor = candidates.find((other) => other.blockedBy === car.id) ?? candidates[0] ?? null;
    if (waitingFor) {
      car.blockedFor = car.blockedBy === waitingFor.id ? car.blockedFor + dt : dt;
      car.blockedBy = waitingFor.id;
      if (car.blockedFor > 2.5) {
        // Follow who waits for whom; coming back round to this car is a standoff.
        const cycle: TrafficCar[] = [car];
        let next: TrafficCar | undefined = waitingFor;
        while (next && next !== car && cycle.length < 6 && next.blockedFor > 2.5) {
          cycle.push(next);
          const after: string | null = next.blockedBy;
          next = after ? traffic.cars.find((other) => other.id === after) : undefined;
        }
        if (next === car && cycle.length > 1) breakStandoff(traffic, cycle, time);
      }
    } else {
      car.blockedBy = null;
      car.blockedFor = 0;
    }

    // Into the next track.
    while (car.s > traffic.tracks[car.track]!.length) {
      const current = traffic.tracks[car.track]!;
      if (current.control === "exit" || !car.route.length) {
        car.active = false;
        car.waitUntil = time + 1.5 + rng() * 5;
        release(traffic, car);
        if (car.alsoHolds !== null && traffic.junctions[car.alsoHolds]!.heldBy === car.id) traffic.junctions[car.alsoHolds]!.heldBy = null;
        car.alsoHolds = null;
        releaseZones(traffic, car, time, true);
        break;
      }
      car.s -= current.length;
      car.track = car.route.shift()!;
      car.stoppedAt = null;
      car.stopFor = STOP_SECONDS[0] + rng() * (STOP_SECONDS[1] - STOP_SECONDS[0]);
    }
    if (!car.active) continue;
    // Clear of the junction once fully on the road beyond it.
    // Out of the turn and onto the road beyond: the junction is free for the next car.
    const onTrack = traffic.tracks[car.track]!;
    if (car.holds !== null && !(onTrack.kind === "connector" && onTrack.node === car.holds)
      && !(onTrack.kind === "lane" && onTrack.node === car.holds)) {
      release(traffic, car);
      // On to the next junction already taken for this short stretch.
      if (car.alsoHolds !== null) { car.holds = car.alsoHolds; car.alsoHolds = null; }
    }
    releaseZones(traffic, car, time);
    const now = traffic.tracks[car.track]!;
    // Grow in from the edge of the site, shrink out at it.
    const toExit = now.control === "exit" ? now.length - car.s : Infinity;
    car.presence = Math.min(1, car.presence + dt * 1.5, Math.max(0, toExit / 3));
    placeCar(traffic.tracks, car);
  }
}

/**
 * Cars each waiting for the next, round in a circle. One without the right of way (not
 * holding a junction) that has room behind it backs up a little, as a driver would; if
 * nobody can back up, the car waiting for the one with least right of way squeezes past.
 */
function breakStandoff(traffic: Traffic, cycle: TrafficCar[], time: number) {
  const canBack = (car: TrafficCar) => {
    const track = traffic.tracks[car.track]!;
    if (track.kind !== "lane" || car.s - car.lengthM / 2 < 1.6) return false;
    return traffic.cars.every((other) => other === car || !other.active || other.track !== car.track || other.s > car.s
      || car.s - car.lengthM / 2 - (other.s + other.lengthM / 2) > 2.4);
  };
  const order = [...cycle].sort((x, y) => {
    const backs = Number(canBack(y)) - Number(canBack(x));
    if (backs) return backs;
    const holds = Number(x.holds !== null) - Number(y.holds !== null);
    if (holds) return holds;
    return x.id < y.id ? 1 : -1;
  });
  const yielder = order[0]!;
  if (canBack(yielder)) {
    yielder.backing = Math.min(2.4, yielder.s - yielder.lengthM / 2 - 0.6);
  } else {
    // Nobody can back up: the car stuck behind the yielder squeezes past it, slowly.
    const goer = cycle[(cycle.indexOf(yielder) - 1 + cycle.length) % cycle.length]!;
    goer.passing = { id: yielder.id, until: time + 3 };
    goer.cruise = Math.min(goer.cruise, 2.5);
  }
  for (const car of cycle) { car.blockedFor = 0; car.blockedBy = null; }
}

/**
 * A car standing still (or nearly) that the car would touch driving `distance` further
 * along its route; null when the way is clear.
 */
function standingOnPath(traffic: Traffic, car: TrafficCar, distance: number): TrafficCar | null {
  const others = traffic.cars.filter((other) => other !== car && other.active && other.presence > 0.2 && other.speed < 1
    && len(sub(other.position, car.position)) < distance + car.lengthM + other.lengthM);
  if (!others.length) return null;
  for (let d = 0.5; d <= distance; d += 0.5) {
    const centre = routePoint(traffic.tracks, car, car.s + d);
    const forward = bodyForward(traffic.tracks, car, car.s + d);
    const side = { x: -forward.z, z: forward.x };
    for (const other of others) {
      const rel = sub(other.position, centre);
      const otherForward = { x: Math.cos(other.heading), z: -Math.sin(other.heading) };
      const otherSide = { x: -otherForward.z, z: otherForward.x };
      let apart = false;
      for (const axis of [forward, side, otherForward, otherSide]) {
        const reachA = car.lengthM * 0.5 * Math.abs(dot(forward, axis)) + car.widthM * 0.45 * Math.abs(dot(side, axis));
        const reachB = other.lengthM * 0.5 * Math.abs(dot(otherForward, axis)) + other.widthM * 0.45 * Math.abs(dot(otherSide, axis));
        if (Math.abs(dot(rel, axis)) > reachA + reachB) { apart = true; break; }
      }
      if (!apart) return other;
    }
  }
  return null;
}

/** The car ahead or alongside that the car, moved to s, would overlap; null when clear. */
function intoSomeone(traffic: Traffic, car: TrafficCar, s: number, time: number): TrafficCar | null {
  const centre = routePoint(traffic.tracks, car, s);
  const forward = bodyForward(traffic.tracks, car, s);
  const side = { x: -forward.z, z: forward.x };
  return traffic.cars.find((other) => {
    if (other === car || !other.active || other.presence < 0.2 || ignores(car, other, time)) return false;
    const rel = sub(other.position, centre);
    // Only a car clearly behind is the other driver's concern.
    if (dot(rel, forward) < -car.lengthM * 0.3) return false;
    // Separating-axis test of the two bodies.
    const otherForward = { x: Math.cos(other.heading), z: -Math.sin(other.heading) };
    const otherSide = { x: -otherForward.z, z: otherForward.x };
    // Mirrors may pass close on a narrow two-way road; bodies may not touch.
    const a = { f: forward, s: side, hl: car.lengthM * 0.48, hw: car.widthM * 0.42 };
    const b = { f: otherForward, s: otherSide, hl: other.lengthM * 0.48, hw: other.widthM * 0.42 };
    for (const axis of [a.f, a.s, b.f, b.s]) {
      const reachA = a.hl * Math.abs(dot(a.f, axis)) + a.hw * Math.abs(dot(a.s, axis));
      const reachB = b.hl * Math.abs(dot(b.f, axis)) + b.hw * Math.abs(dot(b.s, axis));
      if (Math.abs(dot(rel, axis)) > reachA + reachB) return false;
    }
    return true;
  }) ?? null;
}

/**
 * Would the car backed up to s overlap a car behind it? Backing away from one it is too
 * close to ahead is the point of backing up.
 */
function overlapsAny(traffic: Traffic, car: TrafficCar, s: number) {
  const centre = routePoint(traffic.tracks, car, s);
  const forward = bodyForward(traffic.tracks, car, s);
  const side = { x: -forward.z, z: forward.x };
  const now = routePoint(traffic.tracks, car, car.s);
  return traffic.cars.some((other) => {
    if (other === car || !other.active || other.presence < 0.2) return false;
    const rel = sub(other.position, centre);
    if (dot(rel, forward) > 0 || len(rel) > len(sub(other.position, now))) return false;
    const otherForward = { x: Math.cos(other.heading), z: -Math.sin(other.heading) };
    const otherSide = { x: -otherForward.z, z: otherForward.x };
    for (const axis of [forward, side, otherForward, otherSide]) {
      const reachA = car.lengthM * 0.5 * Math.abs(dot(forward, axis)) + car.widthM * 0.45 * Math.abs(dot(side, axis));
      const reachB = other.lengthM * 0.5 * Math.abs(dot(otherForward, axis)) + other.widthM * 0.45 * Math.abs(dot(otherSide, axis));
      if (Math.abs(dot(rel, axis)) > reachA + reachB) return false;
    }
    return true;
  });
}

function release(traffic: Traffic, car: TrafficCar) {
  if (car.holds !== null && traffic.junctions[car.holds]!.heldBy === car.id) traffic.junctions[car.holds]!.heldBy = null;
  car.holds = null;
}

/** A car that left the site comes back in on a road from the edge, when there is room. */
function reenter(traffic: Traffic, car: TrafficCar, time: number, rng: Rng) {
  if (time < car.waitUntil) return;
  const options = traffic.entries.length ? traffic.entries : traffic.tracks.filter((track) => track.kind === "lane" && track.length > 6).map((track) => track.id);
  if (!options.length) return;
  const lane = options[Math.floor(rng() * options.length)]!;
  const entry = traffic.tracks[lane]!;
  const startS = entry.control === "yield" || entry.control === "stop" ? Math.min(car.lengthM / 2, entry.hold - car.lengthM / 2 - 0.5) : car.lengthM / 2;
  const start = routePoint(traffic.tracks, { track: lane, route: [] }, startS);
  const crowded = traffic.cars.some((other) => other !== car && other.active && len(sub(other.position, start)) < car.lengthM + 3);
  if (crowded || !roomAtStart(traffic, lane, car.lengthM + 4, car)) { car.waitUntil = time + 0.8; return; }
  car.active = true;
  car.track = lane;
  car.s = startS;
  car.speed = car.cruise * 0.6;
  car.route = [];
  car.presence = traffic.entries.length ? 0 : 1;
  car.stoppedAt = null;
  car.cruise = 4 + rng() * 5;
  placeCar(traffic.tracks, car);
}
