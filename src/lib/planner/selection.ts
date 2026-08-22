import type {
  CoverageRequirement,
  FloorPlan,
  PlanCamera,
  PlanDoor,
  PlanObstacle,
  PlanRoom,
  PlanSelection,
  PlanSelectionRef,
  PlanWall,
  Vec2
} from "@/src/domain/planner/types";
import {
  obstacleCorners,
  obstacleIntersectsRect,
  pointInRect,
  projectPointToWall,
  segmentIntersectsRect,
  type PlanRect
} from "@/src/lib/planner/geometry";

/**
 * Turns a dragged rectangle into a set of selected elements.
 *
 * Kept out of the canvas component so the rule "what counts as inside the box" is one
 * testable function rather than something buried in a pointer handler.
 */
export function elementsInRect(floor: FloorPlan, rect: PlanRect): PlanSelectionRef[] {
  const hits: PlanSelectionRef[] = [];

  for (const wall of floor.walls) {
    if (segmentIntersectsRect(wall.a, wall.b, rect)) hits.push({ kind: "wall", id: wall.id });
  }

  // Openings follow their host wall, so they are matched at their own position along it
  // rather than by the whole wall — dragging over one end of a wall should not sweep up
  // a door at the far end.
  for (const door of floor.doors ?? []) {
    const wall = floor.walls.find((item) => item.id === door.wallId);
    if (!wall) continue;
    const center = {
      x: wall.a.x + (wall.b.x - wall.a.x) * door.offset,
      z: wall.a.z + (wall.b.z - wall.a.z) * door.offset
    };
    if (pointInRect(center, rect)) hits.push({ kind: "door", id: door.id });
  }

  for (const obstacle of floor.obstacles) {
    if (obstacleIntersectsRect(obstacleCorners(obstacle), rect)) hits.push({ kind: "obstacle", id: obstacle.id });
  }

  for (const camera of floor.cameras) {
    if (pointInRect(camera.position, rect)) hits.push({ kind: "camera", id: camera.id });
  }

  return hits;
}

/** Union of two selections, preserving order and dropping duplicates. */
export function mergeSelection(base: PlanSelection, additions: PlanSelectionRef[]): PlanSelection {
  const seen = new Set(base.map((item) => `${item.kind}:${item.id}`));
  const merged = [...base];
  for (const ref of additions) {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ref);
  }
  return merged;
}

export type PlanClipboard = {
  walls: PlanWall[];
  doors: PlanDoor[];
  obstacles: PlanObstacle[];
  cameras: PlanCamera[];
  rooms: PlanRoom[];
  requirements: CoverageRequirement[];
  selection: PlanSelection;
  /** Centre of the copied selection, used to paste it under the pointer. */
  anchor: Vec2;
};

const clone = <T,>(value: T): T => structuredClone(value);

/** Captures exactly the selected objects; doors attached to copied walls travel with them. */
export function copySelection(floor: FloorPlan, selection: PlanSelection): PlanClipboard | null {
  if (!selection.length) return null;
  const ids = (kind: PlanSelectionRef["kind"]) => new Set(selection.filter((item) => item.kind === kind).map((item) => item.id));
  const wallIds = ids("wall");
  const doorIds = ids("door");
  const walls = floor.walls.filter((item) => wallIds.has(item.id));
  const doors = (floor.doors ?? []).filter((item) => doorIds.has(item.id) || wallIds.has(item.wallId));
  const anchorPoints: Vec2[] = [];
  for (const ref of selection) {
    if (ref.kind === "wall") {
      const wall = floor.walls.find((item) => item.id === ref.id);
      if (wall) anchorPoints.push(wall.a, wall.b);
    } else if (ref.kind === "door") {
      const door = (floor.doors ?? []).find((item) => item.id === ref.id);
      const wall = door ? floor.walls.find((item) => item.id === door.wallId) : undefined;
      if (door && wall) anchorPoints.push({
        x: wall.a.x + (wall.b.x - wall.a.x) * door.offset,
        z: wall.a.z + (wall.b.z - wall.a.z) * door.offset
      });
    } else if (ref.kind === "obstacle") {
      const item = floor.obstacles.find((candidate) => candidate.id === ref.id);
      if (item) anchorPoints.push(item.center);
    } else if (ref.kind === "camera") {
      const item = floor.cameras.find((candidate) => candidate.id === ref.id);
      if (item) anchorPoints.push(item.position);
    } else if (ref.kind === "room") {
      anchorPoints.push(...((floor.rooms ?? []).find((item) => item.id === ref.id)?.polygon ?? []));
    } else {
      anchorPoints.push(...((floor.coverageRequirements ?? []).find((item) => item.id === ref.id)?.polygon ?? []));
    }
  }
  const bounds = anchorPoints.reduce(
    (result, point) => ({
      minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
      minZ: Math.min(result.minZ, point.z), maxZ: Math.max(result.maxZ, point.z)
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );
  const anchor = anchorPoints.length
    ? { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
    : { x: 0, z: 0 };
  return clone({
    walls,
    doors,
    obstacles: floor.obstacles.filter((item) => ids("obstacle").has(item.id)),
    cameras: floor.cameras.filter((item) => ids("camera").has(item.id)),
    rooms: (floor.rooms ?? []).filter((item) => ids("room").has(item.id)),
    requirements: (floor.coverageRequirements ?? []).filter((item) => ids("requirement").has(item.id)),
    selection,
    anchor
  });
}

const moved = (point: Vec2, delta: Vec2) => ({ x: point.x + delta.x, z: point.z + delta.z });

/** Pastes a clipboard with fresh ids and a visible offset, preserving internal links. */
export function pasteSelection(
  floor: FloorPlan,
  clipboard: PlanClipboard,
  delta: Vec2 = { x: 0.5, z: 0.5 },
  target?: Vec2
): { floor: FloorPlan; selection: PlanSelection } {
  const batchId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const pastedId = (prefix: string, order: number) => `${prefix}-paste-${batchId}-${order}`;
  const wallIds = new Map(clipboard.walls.map((wall, index) => [wall.id, pastedId("wall", index)]));
  const doorIds = new Map(clipboard.doors.map((door, index) => [door.id, pastedId("door", index)]));
  const obstacleIds = new Map(clipboard.obstacles.map((item, index) => [item.id, pastedId("obs", index)]));
  const cameraIds = new Map(clipboard.cameras.map((item, index) => [item.id, pastedId("cam", index)]));
  const roomIds = new Map(clipboard.rooms.map((room, index) => [room.id, pastedId("room", index)]));
  const requirementIds = new Map(clipboard.requirements.map((item, index) => [item.id, pastedId("cover", index)]));
  const walls = clipboard.walls.map((wall) => ({
    ...clone(wall),
    id: wallIds.get(wall.id)!,
    a: moved(wall.a, delta),
    b: moved(wall.b, delta)
  }));
  const doors: PlanDoor[] = [];
  clipboard.doors.forEach((door) => {
    const mappedWallId = wallIds.get(door.wallId);
    const originalHost = floor.walls.find((wall) => wall.id === door.wallId);
    const pointerHost = !mappedWallId && target
      ? floor.walls.reduce<{ wall: PlanWall; distanceM: number } | null>((best, wall) => {
          const projected = projectPointToWall(target, wall);
          const distanceM = Math.hypot(target.x - projected.point.x, target.z - projected.point.z);
          return !best || distanceM < best.distanceM ? { wall, distanceM } : best;
        }, null)?.wall
      : undefined;
    const host = pointerHost ?? originalHost;
    if (!mappedWallId && !host) {
      doorIds.delete(door.id);
      return;
    }
    let offset = door.offset;
    if (!mappedWallId && host) {
      const span = Math.max(0.01, Math.hypot(host.b.x - host.a.x, host.b.z - host.a.z));
      const widthM = Math.min(door.widthM, Math.max(0.5, span - 0.2));
      if (target && pointerHost) {
        offset = projectPointToWall(target, host, widthM / 2 + 0.1).offset;
      } else {
        const ux = (host.b.x - host.a.x) / span;
        const uz = (host.b.z - host.a.z) / span;
        offset += (delta.x * ux + delta.z * uz) / span;
      }
      const edge = Math.min(0.49, (widthM / 2 + 0.1) / span);
      offset = Math.max(edge, Math.min(1 - edge, offset));

      // A copied opening stays attached to its host, but must not be pasted over an
      // existing opening. Search alternately in both directions for the nearest gap.
      const occupied = [...(floor.doors ?? []), ...doors].filter((item) => item.wallId === host.id);
      const fits = (candidate: number) => occupied.every((item) =>
        Math.abs(item.offset - candidate) * span >= (item.widthM + widthM) / 2 + 0.1
      );
      if (!fits(offset)) {
        const step = Math.max(0.05, (widthM + 0.1) / span);
        const candidates = Array.from({ length: 40 }, (_, index) => {
          const distance = (Math.floor(index / 2) + 1) * step;
          return offset + (index % 2 === 0 ? distance : -distance);
        });
        const free = candidates.find((candidate) => candidate >= edge && candidate <= 1 - edge && fits(candidate));
        if (free === undefined) {
          doorIds.delete(door.id);
          return;
        }
        offset = free;
      }
      doors.push({ ...clone(door), id: doorIds.get(door.id)!, wallId: host.id, widthM, offset });
      return;
    }
    doors.push({ ...clone(door), id: doorIds.get(door.id)!, wallId: mappedWallId!, offset });
  });
  const obstacles = clipboard.obstacles.map((item, index) => ({
    ...clone(item), id: obstacleIds.get(item.id)!, center: moved(item.center, delta)
  }));
  const rooms = clipboard.rooms.map((item, index) => ({
    ...clone(item),
    id: roomIds.get(item.id)!,
    polygon: item.polygon.map((point) => moved(point, delta)),
    boundarySource: "drawn" as const,
    wallIds: item.wallIds?.every((id) => wallIds.has(id)) ? item.wallIds.map((id) => wallIds.get(id)!) : undefined
  }));
  const cameras = clipboard.cameras.map((item, index) => ({
    ...clone(item),
    id: cameraIds.get(item.id)!,
    definitionId: undefined,
    roomId: item.roomId ? roomIds.get(item.roomId) : undefined,
    position: moved(item.position, delta)
  }));
  const requirements = clipboard.requirements.map((item, index) => ({
    ...clone(item),
    id: requirementIds.get(item.id)!,
    polygon: item.polygon.map((point) => moved(point, delta)),
    satisfied: undefined
  }));

  const idMaps: Record<PlanSelectionRef["kind"], Map<string, string>> = {
    wall: wallIds,
    door: doorIds,
    obstacle: obstacleIds,
    camera: cameraIds,
    room: roomIds,
    requirement: requirementIds
  };
  const nextSelection = clipboard.selection.flatMap<PlanSelectionRef>((item) => {
    const id = idMaps[item.kind].get(item.id);
    return id ? [{ kind: item.kind, id } as PlanSelectionRef] : [];
  });
  return {
    floor: {
      ...floor,
      walls: [...floor.walls, ...walls],
      doors: [...(floor.doors ?? []), ...doors],
      obstacles: [...floor.obstacles, ...obstacles],
      cameras: [...floor.cameras, ...cameras],
      rooms: [...(floor.rooms ?? []), ...rooms],
      coverageRequirements: [...(floor.coverageRequirements ?? []), ...requirements]
    },
    selection: nextSelection
  };
}

/** Removes every selected element from the floor in one pass. */
export function deleteSelection(floor: FloorPlan, selection: PlanSelection): FloorPlan {
  const wallIds = new Set(selection.filter((item) => item.kind === "wall").map((item) => item.id));
  const doorIds = new Set(selection.filter((item) => item.kind === "door").map((item) => item.id));
  const obstacleIds = new Set(selection.filter((item) => item.kind === "obstacle").map((item) => item.id));
  const cameraIds = new Set(selection.filter((item) => item.kind === "camera").map((item) => item.id));
  const roomIds = new Set(selection.filter((item) => item.kind === "room").map((item) => item.id));
  const requirementIds = new Set(selection.filter((item) => item.kind === "requirement").map((item) => item.id));

  return {
    ...floor,
    walls: floor.walls.filter((wall) => !wallIds.has(wall.id)),
    // Openings cannot outlive their wall, so deleting a wall takes its doors and windows
    // with it even when they were not part of the selection.
    doors: (floor.doors ?? []).filter((door) => !doorIds.has(door.id) && !wallIds.has(door.wallId)),
    obstacles: floor.obstacles.filter((obstacle) => !obstacleIds.has(obstacle.id)),
    cameras: floor.cameras.filter((camera) => !cameraIds.has(camera.id)),
    // Deleting a wall leaves any room it bounded without an outline. The room is dropped
    // rather than silently reshaped, so detection can rebuild it from whatever remains.
    rooms: (floor.rooms ?? []).filter(
      (room) => !roomIds.has(room.id) && !(room.wallIds ?? []).some((wallId) => wallIds.has(wallId))
    ),
    coverageRequirements: (floor.coverageRequirements ?? []).filter(
      (requirement) => !requirementIds.has(requirement.id)
    )
  };
}

export type SelectionSummary = { kind: PlanSelectionRef["kind"]; label: string; count: number };

const kindLabels: Record<PlanSelectionRef["kind"], string> = {
  wall: "دیوار",
  door: "در و پنجره",
  obstacle: "مانع و عناصر محوطه",
  camera: "دوربین",
  room: "فضا",
  requirement: "ناحیه پوشش اجباری"
};

export function summariseSelection(selection: PlanSelection): SelectionSummary[] {
  const order: PlanSelectionRef["kind"][] = ["camera", "room", "requirement", "wall", "door", "obstacle"];
  return order
    .map((kind) => ({ kind, label: kindLabels[kind], count: selection.filter((item) => item.kind === kind).length }))
    .filter((entry) => entry.count > 0);
}

/** Human-readable name for one selected element, for the multi-selection list. */
export function describeElement(floor: FloorPlan, ref: PlanSelectionRef): string {
  if (ref.kind === "camera") {
    return floor.cameras.find((item) => item.id === ref.id)?.name ?? "دوربین";
  }
  if (ref.kind === "obstacle") {
    return floor.obstacles.find((item) => item.id === ref.id)?.label ?? "مانع";
  }
  if (ref.kind === "room") {
    const room = (floor.rooms ?? []).find((item) => item.id === ref.id);
    return room?.name?.trim() || "فضای بدون نوع";
  }
  if (ref.kind === "requirement") {
    return (floor.coverageRequirements ?? []).find((item) => item.id === ref.id)?.label ?? "ناحیه اجباری";
  }
  if (ref.kind === "door") {
    const door = (floor.doors ?? []).find((item) => item.id === ref.id);
    return door?.type === "window" ? "پنجره" : "در";
  }
  const wall = floor.walls.find((item) => item.id === ref.id);
  if (!wall) return "دیوار";
  return `دیوار ${Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z).toFixed(1)} متر`;
}
