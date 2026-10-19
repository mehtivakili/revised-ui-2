import type { FloorPlan, PlanObstacle, Vec2 } from "@/src/domain/planner/types";
import {
  cellOf,
  nearestWalkable,
  obstacleToWorld,
  type NavGrid
} from "@/src/lib/planner/crowd/navigation";

/**
 * What the dynamic environment can do with a plan's objects: seats to sit on and places
 * to stand and use something (a till, a shelf, a fridge). Roads are in traffic.ts.
 * All geometry is read from the same footprints the 3D models are built from, so a
 * person sits on the cushion that is drawn and faces the way the chair faces.
 */

export type Seat = {
  id: string;
  obstacleId: string;
  /** Hip position when seated. */
  position: Vec2;
  /** Direction the seated person faces, in radians (world, three.js y rotation). */
  facing: number;
  /** Top of the seat. */
  heightM: number;
  /** Walkable point the person walks to before turning and sitting. */
  approach: Vec2;
  /** Seats on the same piece of furniture, for people sitting together. */
  group: string;
  index: number;
};

export type Spot = {
  id: string;
  obstacleId: string;
  position: Vec2;
  /** Faces the object being used. */
  facing: number;
  action: "use" | "browse" | "write";
};

/** Facing (three.js y rotation) of an obstacle's local +z axis. */
const facingOf = (obstacle: PlanObstacle, sign = 1) => {
  const radians = (obstacle.rotationDeg * Math.PI) / 180;
  return Math.atan2(-Math.sin(radians) * sign, Math.cos(radians) * sign);
};

/** World yaw that looks from `from` toward `to`. */
export const yawToward = (from: Vec2, to: Vec2) => Math.atan2(to.x - from.x, to.z - from.z);

function seatHeight(obstacle: PlanObstacle, isChair: boolean) {
  // Matches the seat pads in the furniture builder.
  return isChair ? obstacle.heightM * 0.42 + 0.05 : obstacle.heightM * 0.5 + 0.05;
}

/**
 * A walkable point next to the object: in front first, then the sides, then behind.
 * A sofa, bench or bleacher is only ever entered from the front, so nobody slides along
 * a row past people already sitting there.
 */
function approachFor(grid: NavGrid, obstacle: PlanObstacle, local: Vec2, frontOnly = false): Vec2 | null {
  const halfD = obstacle.depthM / 2;
  const halfW = obstacle.widthM / 2;
  const candidates: Vec2[] = [
    { x: local.x, z: halfD + 0.42 },
    { x: -halfW - 0.4, z: local.z },
    { x: halfW + 0.4, z: local.z },
    { x: local.x, z: -halfD - 0.42 }
  ];
  for (const candidate of frontOnly ? candidates.slice(0, 1) : candidates) {
    const world = obstacleToWorld(obstacle, candidate);
    const index = cellOf(grid, world);
    if (index >= 0 && grid.walkable[index]) return world;
  }
  return null;
}

export function findSeats(floor: FloorPlan, grid: NavGrid): Seat[] {
  const seats: Seat[] = [];
  for (const obstacle of floor.obstacles) {
    if (obstacle.kind !== "seating") continue;
    const variant = obstacle.variant;
    const isChair = variant === "office-chair" || variant === "dining-chair";
    const slots: { local: Vec2; height: number }[] = [];
    if (isChair) {
      slots.push({ local: { x: 0, z: -0.06 }, height: seatHeight(obstacle, true) });
    } else if (variant === "gym-bleacher") {
      // Only the bottom tier: the upper tiers would need climbing.
      const rowDepth = obstacle.depthM / 4;
      const count = Math.max(1, Math.floor(obstacle.widthM / 0.6));
      for (let index = 0; index < count; index += 1) {
        slots.push({
          local: { x: -obstacle.widthM / 2 + (index + 0.5) * (obstacle.widthM / count), z: obstacle.depthM / 2 - rowDepth * 0.5 },
          height: obstacle.heightM / 4 + 0.08
        });
      }
    } else {
      // Sofas and benches: one place per cushion between the arms.
      const armW = Math.min(0.22, obstacle.widthM * 0.14);
      const span = obstacle.widthM - armW * 2;
      const count = Math.max(1, Math.round(obstacle.widthM / (variant === "waiting-bench" ? 0.62 : 0.95)));
      for (let index = 0; index < count; index += 1) {
        slots.push({ local: { x: -span / 2 + (index + 0.5) * (span / count), z: obstacle.depthM * 0.06 }, height: seatHeight(obstacle, false) });
      }
    }
    slots.forEach((slot, index) => {
      const approach = approachFor(grid, obstacle, slot.local, !isChair);
      if (!approach) return;
      seats.push({
        id: `${obstacle.id}#${index}`,
        obstacleId: obstacle.id,
        position: obstacleToWorld(obstacle, slot.local),
        facing: facingOf(obstacle),
        heightM: slot.height,
        approach,
        group: obstacle.id,
        index
      });
    });
  }
  return seats;
}

/** Objects people stand at and use, with the kind of use the pose should show. */
const usable: Record<string, Spot["action"]> = {
  "checkout-counter": "use", "reception-desk": "use", "service-counter": "use", "concierge-desk": "use",
  "nurse-station": "use", "kitchen-counter": "use", stove: "use", "sink-unit": "use", "kitchen-island": "use",
  fridge: "use", "display-fridge": "browse", "vending-machine": "use", "shelving-unit": "browse",
  "clothing-rack": "browse", "display-stand": "browse", bookshelf: "browse", "library-shelf": "browse",
  "storage-rack": "browse", workbench: "use", "lab-bench": "use", "packing-table": "use", "tool-cabinet": "use",
  "filing-cabinet": "use", whiteboard: "write", "cnc-machine": "use", "welding-station": "use",
  "medical-cart": "use", "luggage-cart": "use", "equipment-rack": "use", "monitoring-console": "use"
};

export function findSpots(floor: FloorPlan, grid: NavGrid): Spot[] {
  const spots: Spot[] = [];
  for (const obstacle of floor.obstacles) {
    const action = obstacle.variant ? usable[obstacle.variant] : undefined;
    if (!action) continue;
    // Long counters and shelves get a place every 1.4 m along their front.
    const count = Math.max(1, Math.min(4, Math.floor(obstacle.widthM / 1.4)));
    for (let index = 0; index < count; index += 1) {
      const x = -obstacle.widthM / 2 + (index + 0.5) * (obstacle.widthM / count);
      for (const side of [1, -1]) {
        const position = obstacleToWorld(obstacle, { x, z: side * (obstacle.depthM / 2 + 0.38) });
        const cell = cellOf(grid, position);
        if (cell < 0 || !grid.walkable[cell]) continue;
        spots.push({ id: `${obstacle.id}@${index}${side > 0 ? "f" : "b"}`, obstacleId: obstacle.id, position, facing: facingOf(obstacle, -side), action });
        break;
      }
    }
  }
  return spots;
}

/** Walkable cell for a point, for spawning. */
export function walkableNear(grid: NavGrid, point: Vec2) {
  return nearestWalkable(grid, point, 1.2);
}
