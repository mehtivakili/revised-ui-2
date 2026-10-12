import type { FloorPlan, PlanObstacle, PlanWall, Vec2 } from "@/src/domain/planner/types";

/**
 * Walkable-area grid for the dynamic environment.
 *
 * People may only stand where the plan says a person can be: inside a space or a
 * must-cover area, on a walkable surface, on the pavement beside a road, or in a
 * doorway. Walls (except door openings), furniture, equipment and roads are blocked,
 * each grown by a person's radius so a body never pokes into them.
 */

export const PERSON_RADIUS_M = 0.22;

export type NavGrid = {
  cellM: number;
  originX: number;
  originZ: number;
  cols: number;
  rows: number;
  /** 1 where a person may stand. */
  walkable: Uint8Array;
  /** 1 on road surface: cars only. */
  road: Uint8Array;
  /** Height of the walkable surface people stand on (a deck, a helipad, a rug), in metres. */
  ground: Float32Array;
  /** Connected-region label of each walkable cell (0 = none), for reachable destinations. */
  region: Int32Array;
  regionSize: Map<number, number>;
  /** Reused search memory, so a route on a large site does not allocate megabytes each time. */
  search?: { cost: Float32Array; costStamp: Uint32Array; came: Int32Array; closedStamp: Uint32Array; stamp: number };
};

/** Objects lower than this are stepped over (speed bumps, wheel stops, rugs). */
const STEP_OVER_M = 0.15;

export function obstacleToLocal(obstacle: PlanObstacle, point: Vec2): Vec2 {
  const radians = (obstacle.rotationDeg * Math.PI) / 180;
  const dx = point.x - obstacle.center.x;
  const dz = point.z - obstacle.center.z;
  return { x: dx * Math.cos(radians) + dz * Math.sin(radians), z: -dx * Math.sin(radians) + dz * Math.cos(radians) };
}

export function obstacleToWorld(obstacle: PlanObstacle, local: Vec2): Vec2 {
  const radians = (obstacle.rotationDeg * Math.PI) / 180;
  return {
    x: obstacle.center.x + local.x * Math.cos(radians) - local.z * Math.sin(radians),
    z: obstacle.center.z + local.x * Math.sin(radians) + local.z * Math.cos(radians)
  };
}

export function insideObstacle(obstacle: PlanObstacle, point: Vec2, grow = 0): boolean {
  const local = obstacleToLocal(obstacle, point);
  return Math.abs(local.x) <= obstacle.widthM / 2 + grow && Math.abs(local.z) <= obstacle.depthM / 2 + grow;
}

function insidePolygon(polygon: Vec2[], point: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.z > point.z) !== (b.z > point.z) && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** How an obstacle affects people on foot. */
export function obstacleFootprint(obstacle: PlanObstacle): "walkable" | "road" | "block" | "trunk" {
  if (obstacle.variant === "road") return "road";
  if (obstacle.heightM < STEP_OVER_M) return "walkable";
  // Decks, pads and lawns are walked on; a raised table of solar panels is not.
  if (obstacle.kind === "surface") return obstacle.heightM > 0.6 ? "block" : "walkable";
  if (obstacle.kind === "tree" && obstacle.variant !== "hedge" && obstacle.variant !== "bush") return "trunk";
  return "block";
}

/** Door openings along a wall, as distances from its start point. */
function wallOpenings(floor: FloorPlan, wall: PlanWall, lengthM: number): [number, number][] {
  return (floor.doors ?? [])
    .filter((door) => door.wallId === wall.id && (door.type ?? "door") === "door")
    .map((door) => {
      const middle = door.offset * lengthM;
      return [middle - door.widthM / 2 + 0.08, middle + door.widthM / 2 - 0.08] as [number, number];
    });
}

export function buildNavGrid(floor: FloorPlan, preferredCellM = 0.25): NavGrid {
  const points: Vec2[] = [
    ...floor.walls.flatMap((wall) => [wall.a, wall.b]),
    ...(floor.rooms ?? []).flatMap((room) => room.polygon),
    ...(floor.coverageRequirements ?? []).flatMap((item) => item.polygon),
    ...floor.obstacles.flatMap((obstacle) => [
      obstacleToWorld(obstacle, { x: -obstacle.widthM / 2, z: -obstacle.depthM / 2 }),
      obstacleToWorld(obstacle, { x: obstacle.widthM / 2, z: obstacle.depthM / 2 }),
      obstacleToWorld(obstacle, { x: -obstacle.widthM / 2, z: obstacle.depthM / 2 }),
      obstacleToWorld(obstacle, { x: obstacle.widthM / 2, z: -obstacle.depthM / 2 })
    ])
  ];
  if (!points.length) points.push({ x: -5, z: -5 }, { x: 5, z: 5 });
  const minX = Math.min(...points.map((p) => p.x)) - 2;
  const maxX = Math.max(...points.map((p) => p.x)) + 2;
  const minZ = Math.min(...points.map((p) => p.z)) - 2;
  const maxZ = Math.max(...points.map((p) => p.z)) + 2;
  // Very large sites get a coarser grid so building it stays well under a frame budget.
  let cellM = preferredCellM;
  while (((maxX - minX) / cellM) * ((maxZ - minZ) / cellM) > 420_000) cellM += 0.05;
  const cols = Math.ceil((maxX - minX) / cellM);
  const rows = Math.ceil((maxZ - minZ) / cellM);
  const count = cols * rows;
  const walkable = new Uint8Array(count);
  const road = new Uint8Array(count);
  const ground = new Float32Array(count);
  const centre = (index: number): Vec2 => ({
    x: minX + ((index % cols) + 0.5) * cellM,
    z: minZ + (Math.floor(index / cols) + 0.5) * cellM
  });

  // 1. Where people belong: spaces, must-cover areas, walkable surfaces, pavements.
  const areas = [...(floor.rooms ?? []).map((room) => room.polygon), ...(floor.coverageRequirements ?? []).map((item) => item.polygon)];
  const surfaces = floor.obstacles.filter((obstacle) => obstacle.kind === "surface" && obstacleFootprint(obstacle) === "walkable");
  const roads = floor.obstacles.filter((obstacle) => obstacleFootprint(obstacle) === "road");
  const anyArea = areas.length + surfaces.length + roads.length > 0;
  for (let index = 0; index < count; index += 1) {
    const point = centre(index);
    if (!anyArea) { walkable[index] = 1; continue; }
    for (const surface of surfaces) {
      if (surface.heightM > ground[index]! && insideObstacle(surface, point)) ground[index] = surface.heightM;
    }
    if (areas.some((polygon) => insidePolygon(polygon, point))
      || surfaces.some((surface) => insideObstacle(surface, point))
      || roads.some((item) => insideObstacle(item, point, 1.4))) walkable[index] = 1;
  }

  // 2. Doorways are always passable, across the whole wall thickness and a step either side.
  const stamp = (from: Vec2, to: Vec2, reach: number, apply: (index: number, t: number) => void) => {
    const x0 = Math.max(0, Math.floor((Math.min(from.x, to.x) - reach - minX) / cellM));
    const x1 = Math.min(cols - 1, Math.ceil((Math.max(from.x, to.x) + reach - minX) / cellM));
    const z0 = Math.max(0, Math.floor((Math.min(from.z, to.z) - reach - minZ) / cellM));
    const z1 = Math.min(rows - 1, Math.ceil((Math.max(from.z, to.z) + reach - minZ) / cellM));
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSq = dx * dx + dz * dz || 1e-9;
    for (let row = z0; row <= z1; row += 1) {
      for (let col = x0; col <= x1; col += 1) {
        const index = row * cols + col;
        const point = centre(index);
        const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSq));
        const distance = Math.hypot(point.x - (from.x + dx * t), point.z - (from.z + dz * t));
        if (distance <= reach) apply(index, t);
      }
    }
  };
  const doorways: { wall: PlanWall; openings: [number, number][]; lengthM: number }[] = [];
  for (const wall of floor.walls) {
    const lengthM = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
    const openings = wallOpenings(floor, wall, lengthM);
    doorways.push({ wall, openings, lengthM });
    stamp(wall.a, wall.b, wall.thicknessM / 2 + 0.6, (index, t) => {
      if (openings.some(([start, end]) => t * lengthM >= start && t * lengthM <= end)) walkable[index] = 1;
    });
  }

  // 3. Walls, except where a door opens through them.
  for (const { wall, openings, lengthM } of doorways) {
    stamp(wall.a, wall.b, wall.thicknessM / 2 + PERSON_RADIUS_M, (index, t) => {
      if (!openings.some(([start, end]) => t * lengthM >= start && t * lengthM <= end)) walkable[index] = 0;
    });
  }

  // 4. Furniture, equipment and roads.
  for (const obstacle of floor.obstacles) {
    const footprint = obstacleFootprint(obstacle);
    if (footprint === "walkable") continue;
    const reach = Math.hypot(obstacle.widthM, obstacle.depthM) / 2 + PERSON_RADIUS_M + cellM;
    stamp(obstacle.center, obstacle.center, reach, (index) => {
      const point = centre(index);
      if (footprint === "road") {
        if (insideObstacle(obstacle, point)) { road[index] = 1; walkable[index] = 0; }
      } else if (footprint === "trunk") {
        if (Math.hypot(point.x - obstacle.center.x, point.z - obstacle.center.z) <= 0.3 + PERSON_RADIUS_M) walkable[index] = 0;
      } else if (insideObstacle(obstacle, point, PERSON_RADIUS_M)) {
        walkable[index] = 0;
      }
    });
  }

  // 5. Connected regions, so a destination is only ever one the walker can reach.
  const region = new Int32Array(count);
  const regionSize = new Map<number, number>();
  let label = 0;
  const queue = new Int32Array(count);
  for (let start = 0; start < count; start += 1) {
    if (!walkable[start] || region[start]) continue;
    label += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    region[start] = label;
    while (head < tail) {
      const index = queue[head++]!;
      const col = index % cols;
      const neighbours = [index - cols, index + cols, col > 0 ? index - 1 : -1, col < cols - 1 ? index + 1 : -1];
      for (const next of neighbours) {
        if (next < 0 || next >= count || !walkable[next] || region[next]) continue;
        region[next] = label;
        queue[tail++] = next;
      }
    }
    regionSize.set(label, tail);
  }

  return { cellM, originX: minX, originZ: minZ, cols, rows, walkable, road, ground, region, regionSize };
}

export function cellOf(grid: NavGrid, point: Vec2): number {
  const col = Math.floor((point.x - grid.originX) / grid.cellM);
  const row = Math.floor((point.z - grid.originZ) / grid.cellM);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return -1;
  return row * grid.cols + col;
}

export function cellCentre(grid: NavGrid, index: number): Vec2 {
  return {
    x: grid.originX + ((index % grid.cols) + 0.5) * grid.cellM,
    z: grid.originZ + (Math.floor(index / grid.cols) + 0.5) * grid.cellM
  };
}

export function isWalkable(grid: NavGrid, point: Vec2): boolean {
  const index = cellOf(grid, point);
  return index >= 0 && grid.walkable[index] === 1;
}

/** Height of the ground under a point, for standing people on decks and pads. */
export function groundAt(grid: NavGrid, point: Vec2): number {
  const index = cellOf(grid, point);
  return index >= 0 ? grid.ground[index]! : 0;
}

export function isRoad(grid: NavGrid, point: Vec2): boolean {
  const index = cellOf(grid, point);
  return index >= 0 && grid.road[index] === 1;
}

/** The nearest walkable cell within reach, or -1. */
export function nearestWalkable(grid: NavGrid, point: Vec2, reachM = 1): number {
  const start = cellOf(grid, point);
  if (start >= 0 && grid.walkable[start]) return start;
  const steps = Math.ceil(reachM / grid.cellM);
  let best = -1;
  let bestDistance = Infinity;
  const col0 = Math.floor((point.x - grid.originX) / grid.cellM);
  const row0 = Math.floor((point.z - grid.originZ) / grid.cellM);
  for (let row = row0 - steps; row <= row0 + steps; row += 1) {
    for (let col = col0 - steps; col <= col0 + steps; col += 1) {
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
      const index = row * grid.cols + col;
      if (!grid.walkable[index]) continue;
      const centre = cellCentre(grid, index);
      const distance = Math.hypot(centre.x - point.x, centre.z - point.z);
      if (distance < bestDistance && distance <= reachM) { best = index; bestDistance = distance; }
    }
  }
  return best;
}

/** True when the straight segment crosses only walkable cells (and none of `blocked`). */
export function clearLine(grid: NavGrid, from: Vec2, to: Vec2, blocked?: Uint8Array): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(distance / (grid.cellM * 0.45)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const index = cellOf(grid, { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
    if (index < 0 || !grid.walkable[index] || blocked?.[index]) return false;
  }
  return true;
}

/**
 * A* over the grid, 8-connected without cutting corners, then straightened by line of
 * sight. `occupied` marks cells other people are standing on: they cost extra rather
 * than being walls, so a route goes round a person where it can but a search never fails
 * because someone is in a doorway (local avoidance handles the actual passing). The
 * heuristic is weighted a little, which keeps searches on large sites short; the
 * straightening step removes the detours that would otherwise cause.
 */
export function findPath(grid: NavGrid, from: Vec2, to: Vec2, occupied?: Uint8Array, maxExpanded = 40_000): Vec2[] | null {
  const start = nearestWalkable(grid, from, 0.6);
  const goal = nearestWalkable(grid, to, 0.6);
  if (start < 0 || goal < 0 || grid.region[start] !== grid.region[goal]) return null;
  if (start === goal) return [to];
  const count = grid.cols * grid.rows;
  grid.search ??= {
    cost: new Float32Array(count), costStamp: new Uint32Array(count), came: new Int32Array(count),
    closedStamp: new Uint32Array(count), stamp: 0
  };
  const memory = grid.search;
  const stamp = ++memory.stamp;
  const costOf = (index: number) => (memory.costStamp[index] === stamp ? memory.cost[index]! : Infinity);
  const setCost = (index: number, value: number, from: number) => {
    memory.cost[index] = value;
    memory.costStamp[index] = stamp;
    memory.came[index] = from;
  };
  const isClosed = (index: number) => memory.closedStamp[index] === stamp;
  const goalCentre = cellCentre(grid, goal);
  const heuristic = (index: number) => {
    const dx = Math.abs((index % grid.cols) - (goal % grid.cols));
    const dz = Math.abs(Math.floor(index / grid.cols) - Math.floor(goal / grid.cols));
    return (Math.max(dx, dz) + 0.4142 * Math.min(dx, dz)) * grid.cellM * 1.25;
  };
  // Binary heap of [f, index].
  const heapF: number[] = [];
  const heapI: number[] = [];
  const push = (f: number, index: number) => {
    heapF.push(f); heapI.push(index);
    let at = heapF.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (heapF[parent]! <= heapF[at]!) break;
      [heapF[parent], heapF[at]] = [heapF[at]!, heapF[parent]!];
      [heapI[parent], heapI[at]] = [heapI[at]!, heapI[parent]!];
      at = parent;
    }
  };
  const pop = () => {
    const index = heapI[0]!;
    const lastF = heapF.pop()!;
    const lastI = heapI.pop()!;
    if (heapF.length) {
      heapF[0] = lastF; heapI[0] = lastI;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let smallest = at;
        if (left < heapF.length && heapF[left]! < heapF[smallest]!) smallest = left;
        if (right < heapF.length && heapF[right]! < heapF[smallest]!) smallest = right;
        if (smallest === at) break;
        [heapF[smallest], heapF[at]] = [heapF[at]!, heapF[smallest]!];
        [heapI[smallest], heapI[at]] = [heapI[at]!, heapI[smallest]!];
        at = smallest;
      }
    }
    return index;
  };
  const passable = (index: number) => grid.walkable[index] === 1;
  const penalty = (index: number) => (occupied?.[index] && index !== goal && index !== start ? 2.5 : 0);

  setCost(start, 0, -1);
  push(heuristic(start), start);
  let expanded = 0;
  while (heapF.length) {
    const current = pop();
    if (isClosed(current)) continue;
    memory.closedStamp[current] = stamp;
    if (current === goal) break;
    if (++expanded > maxExpanded) return null;
    const col = current % grid.cols;
    const row = Math.floor(current / grid.cols);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dz) continue;
        const ncol = col + dx;
        const nrow = row + dz;
        if (ncol < 0 || nrow < 0 || ncol >= grid.cols || nrow >= grid.rows) continue;
        const next = nrow * grid.cols + ncol;
        if (!passable(next) || isClosed(next)) continue;
        // No squeezing diagonally between two blocked cells.
        if (dx && dz && (!passable(row * grid.cols + ncol) || !passable(nrow * grid.cols + col))) continue;
        const cost = costOf(current) + (dx && dz ? 1.4142 : 1) * grid.cellM + penalty(next);
        if (cost < costOf(next)) {
          setCost(next, cost, current);
          push(cost + heuristic(next), next);
        }
      }
    }
  }
  if (!isClosed(goal)) return null;
  const cells: number[] = [];
  for (let at = goal; at !== -1; at = memory.came[at]!) cells.push(at);
  cells.reverse();
  // String-pulling: keep a waypoint only where the straight line would leave the walkable area.
  const raw = cells.map((index) => cellCentre(grid, index));
  raw[raw.length - 1] = isWalkable(grid, to) ? to : goalCentre;
  const smooth: Vec2[] = [];
  let anchor = from;
  let index = 0;
  while (index < raw.length - 1) {
    let furthest = index + 1;
    for (let probe = raw.length - 1; probe > index + 1; probe -= 1) {
      if (clearLine(grid, anchor, raw[probe]!)) { furthest = probe; break; }
    }
    smooth.push(raw[furthest]!);
    anchor = raw[furthest]!;
    index = furthest;
  }
  return smooth.length ? smooth : [raw[raw.length - 1]!];
}
