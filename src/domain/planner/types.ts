import type { CameraHousing, CameraStreamConfig, SurveillanceTask } from "@/src/domain/catalog/types";

/**
 * Floor plan model for the site designer.
 *
 * Everything is stored in metres in plan space, with +x to the right and +z "down" the
 * page — the same convention the three.js scene uses for its ground plane, so no unit or
 * axis conversion happens between the editor, the coverage engine and the 3D view.
 *
 * Heights are metres above the floor of the storey the element belongs to, not absolute
 * elevation; a floor's own `elevationM` positions it in the stacked 3D view.
 */

export type Vec2 = { x: number; z: number };

/**
 * What a wall is built as, when it is not ordinary masonry or glazing.
 *
 * Site boundaries are drawn with the wall tool so they snap, join and carry gates like any
 * other wall: a mesh fence is see-through, a boundary wall is solid but lower than a
 * building wall.
 */
export type PlanWallVariant = "fence-mesh" | "fence-wall";

export type PlanWall = {
  id: string;
  a: Vec2;
  b: Vec2;
  heightM: number;
  thicknessM: number;
  /** Glass and low partitions bound the space without blocking the camera's line of sight. */
  blocksView: boolean;
  /** Fence or boundary wall; absent for building walls and glazing. */
  variant?: PlanWallVariant;
};

/**
 * An opening cut into a wall.
 *
 * Doors and windows share this shape because they share everything that matters here:
 * they attach to a wall, move with it, and are deleted with it. `sillHeightM` is what
 * separates them — a window starts above the floor, which is also why it does not break
 * a camera's sight line the way an open doorway does.
 */
export type PlanOpeningType = "door" | "window";
export type PlanDoorVariant = "single-solid" | "double-solid" | "single-glass" | "double-glass";
export type PlanDoorSwingDirection = "inward" | "outward";

export type PlanDoor = {
  id: string;
  wallId: string;
  type?: PlanOpeningType;
  /** Door construction; absent in older saves means a normal single solid leaf. */
  variant?: PlanDoorVariant;
  /** Normalised distance of the opening's centre from wall.a toward wall.b. */
  offset: number;
  widthM: number;
  heightM: number;
  /** Height of the opening's lower edge above the floor; 0 for a door. */
  sillHeightM?: number;
  hinge: "start" | "end";
  /** Semantic swing side; absent in older saves means inward. */
  swingDirection?: PlanDoorSwingDirection;
  /** Visual opening angle; 0 is closed and 90 is fully open. Doors only. */
  openAngleDeg: number;
  /** Glazed openings bound the space without blocking the view through it. */
  blocksView?: boolean;
};

export type ObstacleKind =
  | "block"
  | "pillar"
  | "shelf"
  | "vehicle"
  | "counter"
  | "tree"
  | "stairs"
  | "surface"
  | "fence"
  | "gate"
  | "pole"
  | "equipment"
  | "furniture"
  | "appliance"
  | "seating"
  | "bed";

export type ObstacleVariant =
  | "sedan"
  | "suv"
  | "pickup"
  | "van"
  | "truck"
  | "deciduous"
  | "conifer"
  | "palm"
  | "stairs-straight"
  | "structural-column"
  | "elevator"
  | "escalator"
  | "grass"
  | "road"
  | "bush"
  | "hedge"
  | "fence-mesh"
  | "fence-wall"
  | "gate-sliding"
  | "camera-pole"
  | "light-pole"
  | "equipment-rack"
  | "nvr-cabinet"
  | "ups-unit"
  | "network-switch"
  | "monitoring-console"
  // Living room
  | "sofa-three"
  | "sofa-single"
  | "coffee-table"
  | "tv-unit"
  | "rug"
  | "dining-table"
  | "dining-chair"
  // Bedroom
  | "bed-double"
  | "bed-single"
  | "wardrobe"
  | "bookshelf"
  | "nightstand"
  | "dresser"
  // Kitchen
  | "fridge"
  | "kitchen-counter"
  | "stove"
  | "sink-unit"
  | "kitchen-island"
  | "dishwasher"
  // Office
  | "office-desk"
  | "office-chair"
  | "meeting-table"
  | "filing-cabinet"
  | "reception-desk"
  | "partition-screen"
  // Retail
  | "shelving-unit"
  | "display-fridge"
  | "checkout-counter"
  | "clothing-rack"
  | "display-stand"
  // Industrial workshop
  | "workbench"
  | "cnc-machine"
  | "tool-cabinet"
  | "welding-station"
  | "conveyor"
  // Utilities and energy
  | "transformer"
  | "storage-tank"
  | "chemical-tank"
  | "generator-unit"
  | "pump-unit"
  | "pipeline"
  | "pipe-valve"
  | "solar-panel"
  // Public transport and emergency vehicles
  | "bus"
  | "ambulance"
  // Freight
  | "shipping-container"
  // Structure
  | "stair-landing"
  // Warehouse and logistics
  | "storage-rack"
  | "pallet-stack"
  | "crate-stack"
  | "packing-table"
  | "loading-platform"
  // Parking and traffic
  | "parking-barrier"
  | "guard-booth"
  | "bollard"
  | "speed-bump"
  | "wheel-stop"
  // Hospitality and public spaces
  | "lobby-sofa"
  | "concierge-desk"
  | "luggage-cart"
  | "queue-barrier"
  | "vending-machine"
  | "hospital-bed"
  | "stretcher"
  | "exam-table"
  | "nurse-station"
  | "medical-cart"
  | "privacy-screen"
  | "service-counter"
  | "waiting-bench"
  | "locker-row"
  | "metal-bunk"
  | "student-desk"
  | "whiteboard"
  | "lab-bench"
  | "library-shelf"
  | "gym-bleacher";

export type PlanObstacle = {
  id: string;
  label: string;
  kind: ObstacleKind;
  /** Optional visual model. Geometry calculations continue to use the editable envelope below. */
  variant?: ObstacleVariant;
  center: Vec2;
  widthM: number;
  depthM: number;
  heightM: number;
  rotationDeg: number;
  blocksView: boolean;
};

/**
 * Optics for one placed camera.
 *
 * Held per camera rather than per project so a single floor can mix, for example, a
 * long-lens plate reader on the ramp with a wide turret over the till.
 */
export type PlanCameraOptics = {
  megapixel: number;
  sensorWidthMm: number;
  focalMm: number;
  mountHeightM: number;
  tiltDeg: number;
  irRangeM: number;
  /** Hard cap on the drawn wedge; beyond this the image is not useful regardless of maths. */
  maxRangeM: number;
};

export type PlanCamera = {
  id: string;
  name: string;
  /**
   * Device type this placement was created from.
   *
   * Unlike the old `definitionId`, a template is reusable: dropping the same type ten
   * times produces ten independent cameras. Editing a placement never writes back to the
   * template, so a one-off lens change stays local to that position.
   */
  templateId?: string;
  /** Legacy single-use inventory slot, retained so saved projects still load. */
  definitionId?: string;
  /** Links the placement back to a wizard zone so counts and goals stay in sync. */
  zoneId?: string;
  groupName?: string;
  /** Space and rule that produced an automatic placement. */
  roomId?: string;
  /** Mandatory sub-area and rule that produced an automatic placement. */
  requirementId?: string;
  sectionTypeId?: string;
  mountKind?: "corner" | "wall-edge" | "ceiling" | "pole";
  /** Human-readable audit trail retained on the placed camera. */
  placementReasons?: string[];
  /** Analytics/features required by the section taxonomy, kept separate from image quality. */
  requiredFeatures?: string[];
  housing?: CameraHousing;
  outdoor?: boolean;
  features?: {
    microphone: boolean;
    colorNightVision: boolean;
    weatherproof: boolean;
  };
  /** Encoder settings; filled in on the per-camera detail step. */
  stream?: CameraStreamConfig;
  position: Vec2;
  yawDeg: number;
  goal: SurveillanceTask;
  optics: PlanCameraOptics;
  productId?: string;
};

export type PlanCameraDefinition = {
  id: string;
  zoneId: string;
  groupName: string;
  name: string;
  housing: CameraHousing;
  outdoor?: boolean;
  goal: SurveillanceTask;
  optics: PlanCameraOptics;
  features: {
    microphone: boolean;
    colorNightVision: boolean;
    weatherproof: boolean;
  };
  /** Optional rule metadata for definitions generated from a declared room. */
  roomId?: string;
  requirementId?: string;
  sectionTypeId?: string;
  mountKind?: "corner" | "wall-edge" | "ceiling" | "pole";
  mountFallbacks?: ("corner" | "wall-edge" | "ceiling" | "pole")[];
  placementReasons?: string[];
  requiredFeatures?: string[];
};

/**
 * An uploaded plan drawing positioned in plan space.
 *
 * `metresPerPixel` comes from the two-point calibration: the user clicks a known span on
 * the image and types its real length. Until that is done the image is decorative and
 * the designer will not derive dimensions from it.
 */
export type PlanBackdrop = {
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  /** Plan-space position of the image's top-left corner. */
  originM: Vec2;
  metresPerPixel: number;
  opacity: number;
  calibrated: boolean;
};

/**
 * How a room's outline was arrived at, which is what the canvas needs in order to draw
 * an implied edge differently from a real wall.
 *
 * `detected` — every edge is a real wall forming a closed cycle.
 * `inferred` — three walls formed three sides of a rectangle and the fourth was closed
 *   for the user; that edge is drawn dashed because nothing is built there.
 * `enclosing` — the space is genuinely open (a yard, a forecourt) and the outline is the
 *   larger region the open walls sit inside.
 * `drawn` — the user drew the polygon by hand.
 */
export type RoomBoundarySource = "detected" | "inferred" | "enclosing" | "drawn";

/**
 * Manual parameters for a space the geometry cannot answer for.
 *
 * Filled in when a room stays red because detection could not close it, or when the user
 * picks the plain-room fallback. Every field is also editable afterwards from the same
 * panel, so accepting a default is never a one-way door.
 */
export type RoomManualParams = {
  /** Clear internal width and depth in metres, when the outline is only approximate. */
  widthM?: number;
  depthM?: number;
  /** True when the space has no ceiling, which rules out ceiling mounts. */
  openAbove?: boolean;
  /** Set when the user wants this space watched even though its type says otherwise. */
  mustCover?: boolean;
};

export type PlanRoom = {
  id: string;
  /** Outline in plan space, wound in either direction. */
  polygon: Vec2[];
  /** Section type id from the venue taxonomy. Absent means the outline renders red. */
  sectionTypeId?: string;
  /** Optional human label; the section type already supplies a default name. */
  name?: string;
  /** Falls back to the floor's storey height when unset. */
  ceilingHeightM?: number;
  boundarySource: RoomBoundarySource;
  /** Wall ids that produced the outline, used to re-match the room after wall edits. */
  wallIds?: string[];
  /** Indices into `polygon` whose outgoing edge is implied rather than built. */
  impliedEdgeIndices?: number[];
  manual?: RoomManualParams;
  /**
   * Deliberate departures from what the rule engine derived.
   *
   * Accepting a suggested configuration must never be a one-way door, so anything the
   * engine decides can be overridden here and the override is what the designer uses.
   * Fields left unset keep following the rules as the room's geometry changes.
   */
  overrides?: RoomPlacementOverrides;
};

export type RoomPlacementOverrides = {
  housing?: CameraHousing;
  mountKind?: "corner" | "wall-edge" | "ceiling" | "pole";
  mountHeightM?: number;
  megapixel?: number;
  focalMm?: number;
  goal?: SurveillanceTask;
  cameraCount?: number;
};

/**
 * An area the user has demanded be covered.
 *
 * Distinct from a room's priority: a priority orders the suggestions and can be skipped,
 * while a requirement is a hard constraint the optimiser must satisfy or report as
 * unmet. `equipment` requirements are created automatically around a placed rack so the
 * recorder itself ends up on camera.
 */
export type CoverageRequirement = {
  id: string;
  polygon: Vec2[];
  label: string;
  origin: "user" | "equipment";
  /** Optional checklist/programme item represented by this sub-area instead of a room. */
  sectionTypeId?: string;
  /** Present when the whole requirement mirrors a room marked as mandatory. */
  sourceRoomId?: string;
  /** Set once a solution covers it, so the checklist can tick without recomputing. */
  satisfied?: boolean;
};

export type FloorPlan = {
  id: string;
  name: string;
  elevationM: number;
  heightM: number;
  walls: PlanWall[];
  doors: PlanDoor[];
  obstacles: PlanObstacle[];
  cameras: PlanCamera[];
  rooms?: PlanRoom[];
  /** Large CAD imports render immediately; room detection can be run explicitly later. */
  roomDetectionDeferred?: boolean;
  coverageRequirements?: CoverageRequirement[];
  backdrop?: PlanBackdrop;
};

export type BuildingPlan = {
  floors: FloorPlan[];
  activeFloorId: string;
  gridSizeM: number;
  snapM: number;
  defaults: PlanDefaults;
  /** Venue chosen in the first step; drives which section types are offered. */
  venueTypeId?: string;
  /** Section types the user invented, kept so later projects can offer them again. */
  customSectionTypes?: CustomSectionRecord[];
  /** Sections the user has explicitly declared absent, so the checklist stops nagging. */
  dismissedSectionIds?: string[];
};

/**
 * A user-defined section type as stored on the project.
 *
 * Structurally identical to the catalog entries in `venues.ts` but declared here to keep
 * the plan model free of an import cycle; `findSectionType` accepts either.
 */
export type CustomSectionRecord = {
  id: string;
  venueIds: string[];
  label: string;
  aliases: string[];
  environment: string;
  priority: string;
  goal: SurveillanceTask;
  requiredFeatures: string[];
  forbidden?: boolean;
  note?: string;
  isCustom?: boolean;
};

export type PlanDefaults = {
  wallHeightM: number;
  wallThicknessM: number;
  obstacleHeightM: number;
  cameraMountHeightM: number;
};

export type PlanTool =
  | "select"
  | "wall"
  | "door"
  | "window"
  | "obstacle"
  | "camera"
  | "measure"
  | "room"
  | "coverage";
export type PlanViewMode = "top" | "orbit" | "building";
/**
 * How the wall tool draws.
 *
 * `glass` is a line partition that does not block the view — the see-through boundary a
 * shopfront or an internal glazed screen makes. It is a separate draw mode rather than a
 * checkbox so a transparent wall is a deliberate choice at the moment of drawing. The two
 * fence modes draw a site boundary line by line, the same way.
 */
export type WallDrawMode = "line" | "rectangle" | "glass" | PlanWallVariant;

export type PlanElementKind = "wall" | "door" | "obstacle" | "camera" | "room" | "requirement";

export type PlanSelectionRef = { kind: PlanElementKind; id: string };

/**
 * Current selection, as a list.
 *
 * An array rather than a single reference because marquee dragging can pick up many
 * elements at once: one entry drives the property editor, several switch the panel to
 * bulk actions, and zero means nothing is selected.
 */
export type PlanSelection = PlanSelectionRef[];

export const emptySelection: PlanSelection = [];

export function isSelected(selection: PlanSelection, kind: PlanElementKind, id: string): boolean {
  return selection.some((item) => item.kind === kind && item.id === id);
}

/** Single selected element, or null when the selection is empty or plural. */
export function soleSelection(selection: PlanSelection): PlanSelectionRef | null {
  return selection.length === 1 ? selection[0] : null;
}

export function toggleSelection(selection: PlanSelection, ref: PlanSelectionRef): PlanSelection {
  return isSelected(selection, ref.kind, ref.id)
    ? selection.filter((item) => !(item.kind === ref.kind && item.id === ref.id))
    : [...selection, ref];
}

export const defaultCameraOptics: PlanCameraOptics = {
  megapixel: 4,
  sensorWidthMm: 5.12,
  focalMm: 4,
  mountHeightM: 3,
  tiltDeg: 12,
  irRangeM: 30,
  maxRangeM: 35
};

export const defaultWallHeightM = 3;
export const defaultWallThicknessM = 0.2;
export const defaultPlanDefaults: PlanDefaults = {
  wallHeightM: defaultWallHeightM,
  wallThicknessM: defaultWallThicknessM,
  obstacleHeightM: 1.2,
  cameraMountHeightM: defaultCameraOptics.mountHeightM
};

export function createFloor(name: string, index: number, storeyHeightM = 3.2): FloorPlan {
  return {
    id: `floor-${Date.now().toString(36)}-${index}`,
    name,
    elevationM: index * storeyHeightM,
    heightM: storeyHeightM,
    walls: [],
    doors: [],
    obstacles: [],
    cameras: [],
    rooms: [],
    coverageRequirements: []
  };
}

/** Fresh ids throughout, so editing the copy never mutates the floor it came from. */
export function duplicateFloor(source: FloorPlan, name: string, index: number): FloorPlan {
  const stamp = Date.now().toString(36);
  return {
    id: `floor-${stamp}-${index}`,
    name,
    elevationM: index * source.heightM,
    heightM: source.heightM,
    walls: source.walls.map((wall, order) => ({ ...wall, id: `wall-${stamp}-${order}`, a: { ...wall.a }, b: { ...wall.b } })),
    doors: (source.doors ?? []).map((door, order) => {
      const sourceWallIndex = source.walls.findIndex((wall) => wall.id === door.wallId);
      return {
        ...door,
        id: `door-${stamp}-${order}`,
        wallId: sourceWallIndex >= 0 ? `wall-${stamp}-${sourceWallIndex}` : door.wallId
      };
    }),
    obstacles: source.obstacles.map((obstacle, order) => ({ ...obstacle, id: `obs-${stamp}-${order}`, center: { ...obstacle.center } })),
    cameras: source.cameras.map((camera, order) => ({
      ...camera,
      // A duplicated floor keeps the *template* link — the type is still the same device —
      // but drops the single-use definition id so both copies stay independently valid.
      id: `cam-${stamp}-${order}`,
      roomId: camera.roomId
        ? (() => {
            const roomIndex = (source.rooms ?? []).findIndex((room) => room.id === camera.roomId);
            return roomIndex >= 0 ? `room-${stamp}-${roomIndex}` : undefined;
          })()
        : undefined,
      definitionId: undefined,
      position: { ...camera.position },
      optics: { ...camera.optics },
      features: camera.features ? { ...camera.features } : undefined,
      stream: camera.stream ? { ...camera.stream } : undefined
    })),
    // Rooms keep their assigned section type: duplicating a floor duplicates its
    // programme, not just its geometry, which is the whole point of the button on a
    // building whose storeys repeat.
    rooms: (source.rooms ?? []).map((room, order) => ({
      ...room,
      id: `room-${stamp}-${order}`,
      polygon: room.polygon.map((point) => ({ ...point })),
      wallIds: room.wallIds
        ?.map((wallId) => {
          const index = source.walls.findIndex((wall) => wall.id === wallId);
          return index >= 0 ? `wall-${stamp}-${index}` : null;
        })
        .filter((wallId): wallId is string => wallId !== null),
      impliedEdgeIndices: room.impliedEdgeIndices ? [...room.impliedEdgeIndices] : undefined,
      manual: room.manual ? { ...room.manual } : undefined,
      overrides: room.overrides ? { ...room.overrides } : undefined
    })),
    coverageRequirements: (source.coverageRequirements ?? []).map((requirement, order) => ({
      ...requirement,
      id: `cover-${stamp}-${order}`,
      sourceRoomId: requirement.sourceRoomId
        ? (() => {
          const index = (source.rooms ?? []).findIndex((room) => room.id === requirement.sourceRoomId);
          return index >= 0 ? `room-${stamp}-${index}` : undefined;
        })()
        : undefined,
      polygon: requirement.polygon.map((point) => ({ ...point })),
      satisfied: undefined
    })),
    backdrop: source.backdrop ? { ...source.backdrop, originM: { ...source.backdrop.originM } } : undefined
  };
}

export function createEmptyPlan(): BuildingPlan {
  const ground = createFloor("طبقه همکف", 0);
  return {
    floors: [ground],
    activeFloorId: ground.id,
    gridSizeM: 1,
    snapM: 1,
    defaults: { ...defaultPlanDefaults }
  };
}
