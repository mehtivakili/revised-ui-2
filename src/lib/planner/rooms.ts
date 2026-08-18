import type { FloorPlan, PlanRoom, PlanWall, RoomBoundarySource, Vec2 } from "@/src/domain/planner/types";
import { distance, pointInPolygon, polygonArea } from "@/src/lib/planner/geometry";

/**
 * Turning a wall drawing into a set of spaces.
 *
 * Walls are a soup of segments; a "room" is a face of the planar graph they form. This
 * module enumerates those faces, and — because real drawings are rarely watertight —
 * offers two ways to resolve a boundary the user left open:
 *
 *   • infer the missing side, when the open walls are three sides of a rectangle, and
 *   • fall back to the larger region the open walls sit inside.
 *
 * Which one applies is the user's call, so both are returned and neither is silently
 * adopted. Nothing here mutates the floor; `reconcileRooms` does the merging.
 */

/** Endpoints closer than this are the same corner. Matches the wall-loop tracer. */
const JOIN_TOLERANCE_M = 0.06;
/** Faces below this are drawing noise — a sliver between two nearly collinear walls. */
const MIN_ROOM_AREA_M2 = 0.75;
/** How far past the open walls the enclosing fallback reaches. */
const ENCLOSING_MARGIN_M = 1.5;
/** Keeps the enclosing fallback usable when the open walls are a single straight run. */
const MIN_ENCLOSING_EXTENT_M = 3;
/** Corner angles this close to square still count as a rectangle. */
const RECTANGLE_ANGLE_TOLERANCE_DEG = 6;
/** Opposite sides may differ by this fraction and still read as a rectangle. */
const RECTANGLE_LENGTH_TOLERANCE = 0.12;

export type RoomCandidate = {
  /** Stable across re-detection while the geometry holds, so selection survives edits. */
  key: string;
  polygon: Vec2[];
  boundarySource: RoomBoundarySource;
  wallIds: string[];
  /** Index i marks the edge from polygon[i] to polygon[i+1] as implied, not built. */
  impliedEdgeIndices: number[];
  areaM2: number;
};

/**
 * An open run of walls, with the two ways it can become a room.
 *
 * `inferred` is null when closing the run would produce a self-crossing outline or too
 * little area to be a space — in that case the enclosing region is the only offer.
 */
export type OpenRegion = {
  id: string;
  wallIds: string[];
  /** True when the run really is three sides of a rectangle, which is the strong case. */
  isRectangleGap: boolean;
  inferred: RoomCandidate | null;
  enclosing: RoomCandidate;
};

export type RoomDetection = {
  closed: RoomCandidate[];
  openRegions: OpenRegion[];
};

/* ── Geometry helpers ──────────────────────────────────────────────── */

const pointKey = (point: Vec2) =>
  `${Math.round(point.x / JOIN_TOLERANCE_M)}:${Math.round(point.z / JOIN_TOLERANCE_M)}`;

const angleOf = (from: Vec2, to: Vec2) => Math.atan2(to.z - from.z, to.x - from.x);

/** Clockwise sweep from one heading to another, always in [0, 2π). */
function clockwiseAngle(from: number, to: number): number {
  const delta = (from - to) % (Math.PI * 2);
  return delta < 0 ? delta + Math.PI * 2 : delta;
}

/**
 * Signed area in the plan's x-right / z-down frame.
 *
 * Interior faces come out positive under the traversal below and the single outer face
 * comes out negative, which is exactly how the outer face is discarded.
 */
function signedArea(polygon: Vec2[]): number {
  let sum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    sum += current.x * next.z - next.x * current.z;
  }
  return sum / 2;
}

export function roomCentroid(polygon: Vec2[]): Vec2 {
  let x = 0;
  let z = 0;
  let weight = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = current.x * next.z - next.x * current.z;
    x += (current.x + next.x) * cross;
    z += (current.z + next.z) * cross;
    weight += cross;
  }
  if (Math.abs(weight) < 1e-9) {
    // Degenerate ring: fall back to the vertex mean so callers always get a point.
    const mean = polygon.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 });
    return { x: mean.x / polygon.length, z: mean.z / polygon.length };
  }
  return { x: x / (3 * weight), z: z / (3 * weight) };
}

export function roomAreaM2(polygon: Vec2[]): number {
  return polygonArea(polygon);
}

function segmentsProperlyCross(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const orient = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = orient(a1, a2, b1);
  const d2 = orient(a1, a2, b2);
  const d3 = orient(b1, b2, a1);
  const d4 = orient(b1, b2, a2);
  const epsilon = 1e-9;
  if (Math.abs(d1) < epsilon || Math.abs(d2) < epsilon || Math.abs(d3) < epsilon || Math.abs(d4) < epsilon) {
    return false;
  }
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Rejects self-crossing outlines, which would otherwise render and measure nonsense. */
function isSimplePolygon(polygon: Vec2[]): boolean {
  const count = polygon.length;
  if (count < 3) return false;
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      // Skip the pairs that legitimately share a vertex.
      if (j === i || (j + 1) % count === i || (i + 1) % count === j) continue;
      if (segmentsProperlyCross(polygon[i], polygon[(i + 1) % count], polygon[j], polygon[(j + 1) % count])) {
        return false;
      }
    }
  }
  return true;
}

/* ── Face enumeration ──────────────────────────────────────────────── */

type DirectedEdge = { wallId: string; fromKey: string; toKey: string; from: Vec2; to: Vec2 };

/**
 * Walks every face of the wall graph.
 *
 * At each corner the traversal takes the sharpest clockwise turn available, which is the
 * standard planar-face walk: it hugs one face all the way round rather than wandering
 * into the interior. Spurs and dead ends are visited in both directions and collapse to
 * zero area, so the area filter drops them without a special case.
 */
function enumerateFaces(walls: PlanWall[]): { polygon: Vec2[]; wallIds: string[] }[] {
  const outgoing = new Map<string, DirectedEdge[]>();
  const points = new Map<string, Vec2>();

  for (const wall of walls) {
    if (distance(wall.a, wall.b) < JOIN_TOLERANCE_M) continue;
    const aKey = pointKey(wall.a);
    const bKey = pointKey(wall.b);
    if (aKey === bKey) continue;
    points.set(aKey, wall.a);
    points.set(bKey, wall.b);
    outgoing.set(aKey, [...(outgoing.get(aKey) ?? []), { wallId: wall.id, fromKey: aKey, toKey: bKey, from: wall.a, to: wall.b }]);
    outgoing.set(bKey, [...(outgoing.get(bKey) ?? []), { wallId: wall.id, fromKey: bKey, toKey: aKey, from: wall.b, to: wall.a }]);
  }

  const visited = new Set<string>();
  const edgeKey = (edge: DirectedEdge) => `${edge.wallId}|${edge.fromKey}`;
  const faces: { polygon: Vec2[]; wallIds: string[] }[] = [];

  for (const edges of outgoing.values()) {
    for (const seed of edges) {
      if (visited.has(edgeKey(seed))) continue;

      const polygon: Vec2[] = [];
      const wallIds: string[] = [];
      let current = seed;
      let guard = 0;
      const limit = walls.length * 2 + 4;

      while (guard++ < limit) {
        visited.add(edgeKey(current));
        polygon.push(current.from);
        wallIds.push(current.wallId);

        const candidates = outgoing.get(current.toKey) ?? [];
        if (candidates.length === 0) break;
        const incomingHeading = angleOf(current.to, current.from);
        let next: DirectedEdge | null = null;
        let bestSweep = Infinity;
        for (const candidate of candidates) {
          // The reverse of the edge we arrived on is the last resort: taking it means
          // bouncing off a dead end, which is correct only when nothing else leaves.
          if (candidate.wallId === current.wallId) continue;
          const sweep = clockwiseAngle(incomingHeading, angleOf(candidate.from, candidate.to));
          if (sweep < bestSweep) {
            bestSweep = sweep;
            next = candidate;
          }
        }
        if (!next) {
          next = candidates.find((candidate) => candidate.wallId === current.wallId) ?? null;
        }
        if (!next) break;
        if (edgeKey(next) === edgeKey(seed)) {
          faces.push({ polygon, wallIds });
          break;
        }
        if (visited.has(edgeKey(next))) break;
        current = next;
      }
    }
  }

  return faces;
}

/* ── Open runs ─────────────────────────────────────────────────────── */

type WallChain = { wallIds: string[]; points: Vec2[] };

/** Threads a set of loose walls into ordered runs, end to end. */
function buildChains(walls: PlanWall[]): WallChain[] {
  const remaining = walls.map((wall) => ({ id: wall.id, a: wall.a, b: wall.b }));
  const chains: WallChain[] = [];

  while (remaining.length) {
    const seed = remaining.shift()!;
    const points = [seed.a, seed.b];
    const wallIds = [seed.id];

    let extended = true;
    while (extended) {
      extended = false;
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const head = points[0];
        const tail = points[points.length - 1];
        if (distance(candidate.a, tail) <= JOIN_TOLERANCE_M) points.push(candidate.b);
        else if (distance(candidate.b, tail) <= JOIN_TOLERANCE_M) points.push(candidate.a);
        else if (distance(candidate.b, head) <= JOIN_TOLERANCE_M) points.unshift(candidate.a);
        else if (distance(candidate.a, head) <= JOIN_TOLERANCE_M) points.unshift(candidate.b);
        else continue;
        wallIds.push(candidate.id);
        remaining.splice(index, 1);
        extended = true;
        break;
      }
    }
    chains.push({ wallIds, points });
  }

  return chains;
}

/**
 * Whether an open run is three sides of a rectangle.
 *
 * This is the case the user asked to be closed automatically: two parallel arms of equal
 * length joined by a perpendicular back, with the mouth left open. Anything looser still
 * gets an inferred outline, but only this shape is flagged as the confident reading.
 */
function isThreeSidedRectangle(points: Vec2[]): boolean {
  if (points.length !== 4) return false;
  const [p0, p1, p2, p3] = points;
  const armA = distance(p0, p1);
  const back = distance(p1, p2);
  const armB = distance(p2, p3);
  if (armA < 0.4 || back < 0.4 || armB < 0.4) return false;

  const lengthDelta = Math.abs(armA - armB) / Math.max(armA, armB);
  if (lengthDelta > RECTANGLE_LENGTH_TOLERANCE) return false;

  const cornerAngle = (a: Vec2, corner: Vec2, b: Vec2) => {
    const first = angleOf(corner, a);
    const second = angleOf(corner, b);
    const raw = Math.abs(((first - second) * 180) / Math.PI) % 360;
    return raw > 180 ? 360 - raw : raw;
  };
  return (
    Math.abs(cornerAngle(p0, p1, p2) - 90) <= RECTANGLE_ANGLE_TOLERANCE_DEG
    && Math.abs(cornerAngle(p1, p2, p3) - 90) <= RECTANGLE_ANGLE_TOLERANCE_DEG
  );
}

/**
 * The larger region an open boundary belongs to.
 *
 * Deliberately a rectangle around the run rather than an attempt to guess the true
 * extent: an open yard has no geometric answer, and a predictable box the user can then
 * reshape beats a clever guess they have to undo.
 */
function enclosingCandidate(chain: WallChain, index: number): RoomCandidate {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of chain.points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  minX -= ENCLOSING_MARGIN_M;
  maxX += ENCLOSING_MARGIN_M;
  minZ -= ENCLOSING_MARGIN_M;
  maxZ += ENCLOSING_MARGIN_M;

  if (maxX - minX < MIN_ENCLOSING_EXTENT_M) {
    const centre = (minX + maxX) / 2;
    minX = centre - MIN_ENCLOSING_EXTENT_M / 2;
    maxX = centre + MIN_ENCLOSING_EXTENT_M / 2;
  }
  if (maxZ - minZ < MIN_ENCLOSING_EXTENT_M) {
    const centre = (minZ + maxZ) / 2;
    minZ = centre - MIN_ENCLOSING_EXTENT_M / 2;
    maxZ = centre + MIN_ENCLOSING_EXTENT_M / 2;
  }

  const polygon = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ }
  ];
  return {
    key: `enclosing:${index}:${chain.wallIds.slice().sort().join(",")}`,
    polygon,
    boundarySource: "enclosing",
    wallIds: chain.wallIds,
    impliedEdgeIndices: [0, 1, 2, 3],
    areaM2: roomAreaM2(polygon)
  };
}

/* ── Detection ─────────────────────────────────────────────────────── */

export function detectRooms(floor: FloorPlan): RoomDetection {
  const walls = floor.walls ?? [];
  const faces = enumerateFaces(walls);
  const closed: RoomCandidate[] = [];
  const usedWallIds = new Set<string>();

  for (const face of faces) {
    if (face.polygon.length < 3) continue;
    if (signedArea(face.polygon) <= 0) continue;
    const areaM2 = roomAreaM2(face.polygon);
    if (areaM2 < MIN_ROOM_AREA_M2) continue;
    for (const wallId of face.wallIds) usedWallIds.add(wallId);
    closed.push({
      key: `closed:${face.wallIds.slice().sort().join(",")}`,
      polygon: face.polygon,
      boundarySource: "detected",
      wallIds: face.wallIds,
      impliedEdgeIndices: [],
      areaM2
    });
  }

  const looseWalls = walls.filter((wall) => !usedWallIds.has(wall.id));
  const openRegions: OpenRegion[] = [];

  buildChains(looseWalls).forEach((chain, index) => {
    if (chain.wallIds.length < 2) return;
    const isRectangleGap = isThreeSidedRectangle(chain.points);

    let inferred: RoomCandidate | null = null;
    // The run's own points already form the outline; closing it just joins the last
    // point back to the first, and that single edge is the one drawn dashed.
    //
    // Three walls is the floor for offering this at all. Closing two walls produces a
    // triangle cut across the corner, which is not a room anyone drew — for an L the
    // enclosing region is the only honest reading.
    if (chain.wallIds.length >= 3 && isSimplePolygon(chain.points)) {
      const polygon = signedArea(chain.points) > 0 ? chain.points : [...chain.points].reverse();
      const areaM2 = roomAreaM2(polygon);
      if (areaM2 >= MIN_ROOM_AREA_M2) {
        inferred = {
          key: `inferred:${chain.wallIds.slice().sort().join(",")}`,
          polygon,
          boundarySource: "inferred",
          wallIds: chain.wallIds,
          impliedEdgeIndices: [polygon.length - 1],
          areaM2
        };
      }
    }

    openRegions.push({
      id: `open:${chain.wallIds.slice().sort().join(",")}`,
      wallIds: chain.wallIds,
      isRectangleGap,
      inferred,
      enclosing: enclosingCandidate(chain, index)
    });
  });

  return { closed, openRegions };
}

/* ── Reconciliation ────────────────────────────────────────────────── */

/** Grid resolution for the overlap estimate. 32×32 is plenty at room scale. */
const OVERLAP_SAMPLES = 32;

/**
 * Intersection over union, estimated by sampling.
 *
 * Exact polygon clipping is more code than this needs: the result only has to rank
 * candidates well enough to carry a room's assigned type onto its new outline after a
 * wall moves, and a sampled ratio does that without a clipping library.
 */
export function overlapRatio(a: Vec2[], b: Vec2[]): number {
  if (a.length < 3 || b.length < 3) return 0;
  const all = [...a, ...b];
  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const minZ = Math.min(...all.map((point) => point.z));
  const maxZ = Math.max(...all.map((point) => point.z));
  if (maxX - minX < 1e-6 || maxZ - minZ < 1e-6) return 0;

  let both = 0;
  let either = 0;
  for (let ix = 0; ix < OVERLAP_SAMPLES; ix += 1) {
    const x = minX + ((ix + 0.5) / OVERLAP_SAMPLES) * (maxX - minX);
    for (let iz = 0; iz < OVERLAP_SAMPLES; iz += 1) {
      const z = minZ + ((iz + 0.5) / OVERLAP_SAMPLES) * (maxZ - minZ);
      const point = { x, z };
      const inA = pointInPolygon(point, a);
      const inB = pointInPolygon(point, b);
      if (inA && inB) both += 1;
      if (inA || inB) either += 1;
    }
  }
  return either === 0 ? 0 : both / either;
}

/** Below this two outlines are different spaces, not the same space edited. */
const MATCH_THRESHOLD = 0.35;

export type ReconcileOptions = {
  /**
   * Open runs the user has resolved: chain id → which offer they took. Unresolved runs
   * produce no room at all, so they stay visible as bare walls rather than as a red
   * outline the user never asked for.
   */
  openChoices?: Record<string, "inferred" | "enclosing" | "ignore">;
};

/**
 * Recovers earlier resolutions from the rooms themselves.
 *
 * A choice about an open boundary has to survive the next wall edit, and storing it in
 * component state would lose it on reload. The room that resulted already records which
 * offer was taken — its `boundarySource` is either `inferred` or `enclosing` — so the
 * decision is read back out of the plan rather than tracked alongside it.
 */
function inferredOpenChoices(
  previous: PlanRoom[],
  regions: OpenRegion[]
): Record<string, "inferred" | "enclosing"> {
  const choices: Record<string, "inferred" | "enclosing"> = {};
  for (const region of regions) {
    const wallIds = new Set(region.wallIds);
    const match = previous.find(
      (room) =>
        (room.boundarySource === "inferred" || room.boundarySource === "enclosing")
        && (room.wallIds ?? []).length > 0
        && (room.wallIds ?? []).some((wallId) => wallIds.has(wallId))
    );
    if (match) choices[region.id] = match.boundarySource as "inferred" | "enclosing";
  }
  return choices;
}

/**
 * Rebuilds the floor's rooms from its walls while preserving what the user assigned.
 *
 * Hand-drawn rooms are never touched — they are the user's own outline, not a reading of
 * the walls. Detected rooms carry their type across to whichever new outline overlaps
 * them most, so nudging a wall does not blank the room's programme.
 */
export function reconcileRooms(floor: FloorPlan, options: ReconcileOptions = {}): PlanRoom[] {
  const detection = detectRooms(floor);
  const previous = floor.rooms ?? [];
  const drawn = previous.filter((room) => room.boundarySource === "drawn");

  const remembered = inferredOpenChoices(previous, detection.openRegions);
  const candidates: RoomCandidate[] = [...detection.closed];
  for (const region of detection.openRegions) {
    const choice = options.openChoices?.[region.id] ?? remembered[region.id];
    if (choice === "inferred" && region.inferred) candidates.push(region.inferred);
    else if (choice === "enclosing") candidates.push(region.enclosing);
  }

  const carried = previous.filter((room) => room.boundarySource !== "drawn");
  const claimed = new Set<string>();

  const rooms = candidates.map((candidate, index) => {
    let bestRoom: PlanRoom | null = null;
    let bestScore = MATCH_THRESHOLD;
    for (const room of carried) {
      if (claimed.has(room.id)) continue;
      const score = overlapRatio(room.polygon, candidate.polygon);
      if (score > bestScore) {
        bestScore = score;
        bestRoom = room;
      }
    }
    if (bestRoom) claimed.add(bestRoom.id);

    return {
      id: bestRoom?.id ?? `room-${Date.now().toString(36)}-${index}`,
      polygon: candidate.polygon,
      sectionTypeId: bestRoom?.sectionTypeId,
      name: bestRoom?.name,
      ceilingHeightM: bestRoom?.ceilingHeightM,
      boundarySource: candidate.boundarySource,
      wallIds: candidate.wallIds,
      impliedEdgeIndices: candidate.impliedEdgeIndices.length ? candidate.impliedEdgeIndices : undefined,
      manual: bestRoom?.manual
    } satisfies PlanRoom;
  });

  return [...rooms, ...drawn];
}

/** A room still waiting for its type, which is what turns its outline red. */
export function isRoomUnassigned(room: PlanRoom): boolean {
  return !room.sectionTypeId;
}

export function unassignedRooms(floor: FloorPlan): PlanRoom[] {
  return (floor.rooms ?? []).filter(isRoomUnassigned);
}

/** The room a point falls in, innermost first so a room inside a hall wins. */
export function roomAtPoint(floor: FloorPlan, point: Vec2): PlanRoom | null {
  const hits = (floor.rooms ?? []).filter((room) => pointInPolygon(point, room.polygon));
  if (hits.length === 0) return null;
  return hits.reduce((smallest, room) =>
    roomAreaM2(room.polygon) < roomAreaM2(smallest.polygon) ? room : smallest
  );
}
