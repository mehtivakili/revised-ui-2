import {
  defaultPlanDefaults,
  type BuildingPlan,
  type CoverageRequirement,
  type CustomSectionRecord,
  type FloorPlan,
  type ObstacleKind,
  type ObstacleVariant,
  type PlanDoor,
  type PlanObstacle,
  type PlanRoom,
  type PlanWall,
  type Vec2
} from "@/src/domain/planner/types";
import { findSectionType, sectionsForVenue, type SectionType, type VenueTypeId } from "@/src/domain/planner/venues";
import { pointInPolygon, polygonArea } from "@/src/lib/planner/geometry";
import { obstaclePreset } from "@/src/lib/planner/obstacle-presets";
import { reconcileRooms, roomCentroid } from "@/src/lib/planner/rooms";

type SamplePlanId =
  | "family-villa"
  | "corner-retail-shop"
  | "luxury-villa"
  | "modern-office"
  | "retail-gallery"
  | "neighbourhood-supermarket"
  | "secure-jewellery-branch"
  | "compact-industrial-workshop"
  | "urban-public-parking"
  | "neighbourhood-restaurant"
  | "primary-school"
  | "outpatient-clinic"
  | "boutique-hotel"
  | "neighbourhood-fuel-station"
  | "courtyard-apartment"
  | "orchard-farm"
  | "urban-roundabout"
  | "highway-interchange"
  | "active-construction-site"
  | "conference-centre"
  | "car-showroom"
  | "bus-terminal"
  | "city-bus-fleet"
  | "security-control-room"
  | "urban-substation"
  | "regional-warehouse"
  | "neighbourhood-mall"
  | "pipeline-monitoring-station"
  | "transmission-corridor"
  | "onshore-oil-field"
  | "offshore-platform"
  | "solar-generation-farm"
  | "hydroelectric-power-station"
  | "safe-city-district"
  | "urban-sports-complex"
  | "compact-data-centre"
  | "regional-airport-terminal"
  | "container-port"
  | "railway-interchange-station"
  | "open-pit-mine"
  | "water-treatment-plant"
  | "factory-campus"
  | "residential-parking"
  | "kourosh-mall"
  | "mega-mall"
  | "general-hospital"
  | "police-station"
  | "barracks-campus"
  | "school-campus";

export const sampleVenueTypeIds: Record<SamplePlanId, VenueTypeId> = {
  "family-villa": "residential",
  "corner-retail-shop": "shop",
  "luxury-villa": "residential",
  "modern-office": "office",
  "retail-gallery": "shop",
  "neighbourhood-supermarket": "supermarket",
  "secure-jewellery-branch": "jewellery",
  "compact-industrial-workshop": "industrial",
  "urban-public-parking": "parking",
  "neighbourhood-restaurant": "restaurant",
  "primary-school": "school",
  "outpatient-clinic": "hospital",
  "boutique-hotel": "hotel",
  "neighbourhood-fuel-station": "fuel",
  "courtyard-apartment": "apartment",
  "orchard-farm": "farm",
  "urban-roundabout": "urban-road",
  "highway-interchange": "highway",
  "active-construction-site": "construction",
  "conference-centre": "conference",
  "car-showroom": "car-showroom",
  "bus-terminal": "bus-station",
  "city-bus-fleet": "transit-fleet",
  "security-control-room": "control-room",
  "urban-substation": "substation",
  "regional-warehouse": "warehouse",
  "neighbourhood-mall": "mall",
  "pipeline-monitoring-station": "pipeline",
  "transmission-corridor": "transmission-line",
  "onshore-oil-field": "onshore-oil",
  "offshore-platform": "offshore-oil",
  "solar-generation-farm": "solar-farm",
  "hydroelectric-power-station": "hydro-plant",
  "safe-city-district": "safe-city",
  "urban-sports-complex": "sports-complex",
  "compact-data-centre": "data-centre",
  "regional-airport-terminal": "airport",
  "container-port": "port",
  "railway-interchange-station": "railway",
  "open-pit-mine": "mine",
  "water-treatment-plant": "water-plant",
  "factory-campus": "industrial",
  "residential-parking": "apartment",
  "kourosh-mall": "mall",
  "mega-mall": "mall",
  "general-hospital": "hospital",
  "police-station": "office",
  "barracks-campus": "industrial",
  "school-campus": "school"
};

const sampleCustomSectionTypes: Partial<Record<SamplePlanId, CustomSectionRecord[]>> = {
  "family-villa": [sampleSection("sample.residential.study", "residential", "اتاق کار و مطالعه")],
  "luxury-villa": [sampleSection("sample.residential.study", "residential", "اتاق کار و مطالعه")],
  "corner-retail-shop": [sampleSection("sample.shop.office", "shop", "دفتر و اتاق کنترل فروشگاه")],
  "retail-gallery": [sampleSection("sample.shop.admin", "shop", "اداری و کنترل فروشگاه")],
  "secure-jewellery-branch": [sampleSection("sample.jewellery.staff", "jewellery", "اتاق کارکنان و کنترل")],
  "compact-industrial-workshop": [sampleSection("sample.industrial.admin", "industrial", "اداری و کنترل کارخانه")],
  "factory-campus": [sampleSection("sample.industrial.admin", "industrial", "اداری و کنترل کارخانه")],
  "residential-parking": [{
    ...sampleSection("sample.apartment.private-unit", "apartment", "فضای خصوصی واحد مسکونی"),
    forbidden: true,
    note: "حریم خصوصی؛ جانمایی دوربین داخل واحد مسکونی مجاز نیست."
  }],
  "general-hospital": [sampleSection("sample.hospital.admin", "hospital", "مدیریت و خدمات بیمارستان")],
  "police-station": [sampleSection("sample.office.secure-room", "office", "فضای حفاظت‌شده و نگهداری")],
  "barracks-campus": [
    sampleSection("sample.industrial.support", "industrial", "ساختمان پشتیبانی و ستاد"),
    sampleSection("sample.industrial.dormitory", "industrial", "آسایشگاه و فضای اقامت"),
    sampleSection("sample.industrial.training", "industrial", "آموزش و جلسات"),
    sampleSection("sample.industrial.welfare", "industrial", "رفاهی، غذاخوری و ورزش")
  ],
  "boutique-hotel": [sampleSection("sample.hotel.admin", "hotel", "اداری و مدیریت هتل")],
  "courtyard-apartment": [sampleSection("sample.apartment.management", "apartment", "نگهبانی و مدیریت ساختمان")],
  "neighbourhood-mall": [sampleSection("sample.mall.shop", "mall", "واحد تجاری")],
  "primary-school": [sampleSection("sample.school.lobby", "school", "لابی و انتظار مدرسه")],
  "school-campus": [
    sampleSection("sample.school.multipurpose", "school", "سالن چندمنظوره و ورزشی"),
    sampleSection("sample.school.lobby", "school", "لابی و انتظار مدرسه"),
    sampleSection("sample.school.admin", "school", "دفتر مدیریت و معاونت")
  ]
};

function sampleSection(id: string, venueId: VenueTypeId, label: string): CustomSectionRecord {
  return {
    id,
    venueIds: [venueId],
    label,
    aliases: [label],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: [],
    isCustom: true
  };
}

const wallHeightM = 3.2;
const wallThicknessM = 0.2;

function wall(id: string, a: Vec2, b: Vec2, heightM = wallHeightM, thicknessM = wallThicknessM): PlanWall {
  return { id, a, b, heightM, thicknessM, blocksView: true };
}

function rectangle(prefix: string, left: number, top: number, right: number, bottom: number, heightM = wallHeightM): PlanWall[] {
  return [
    wall(`${prefix}-north`, { x: left, z: top }, { x: right, z: top }, heightM),
    wall(`${prefix}-east`, { x: right, z: top }, { x: right, z: bottom }, heightM),
    wall(`${prefix}-south`, { x: right, z: bottom }, { x: left, z: bottom }, heightM),
    wall(`${prefix}-west`, { x: left, z: bottom }, { x: left, z: top }, heightM)
  ];
}

function partition(id: string, x1: number, z1: number, x2: number, z2: number, heightM = wallHeightM): PlanWall {
  return wall(id, { x: x1, z: z1 }, { x: x2, z: z2 }, heightM, 0.15);
}

function glassPartition(id: string, x1: number, z1: number, x2: number, z2: number, heightM = wallHeightM): PlanWall {
  return { ...partition(id, x1, z1, x2, z2, heightM), blocksView: false };
}

function door(id: string, wallId: string, offset = 0.5, widthM = 1.2): PlanDoor {
  return { id, wallId, offset, widthM, heightM: 2.2, hinge: "start", openAngleDeg: 55 };
}

function windowOpening(id: string, wallId: string, offset: number, widthM = 2): PlanDoor {
  return {
    id,
    wallId,
    type: "window",
    offset,
    widthM,
    heightM: 1.5,
    sillHeightM: 0.85,
    hinge: "start",
    openAngleDeg: 0,
    blocksView: false
  };
}

function obstacle(
  id: string,
  label: string,
  kind: ObstacleKind,
  x: number,
  z: number,
  widthM: number,
  depthM: number,
  heightM: number,
  blocksView = true,
  rotationDeg = 0
): PlanObstacle {
  return { id, label, kind, center: { x, z }, widthM, depthM, heightM, rotationDeg, blocksView };
}

function presetObstacle(id: string, variant: ObstacleVariant, x: number, z: number, rotationDeg = 0): PlanObstacle {
  const preset = obstaclePreset(variant);
  if (!preset) throw new Error(`Unknown obstacle preset: ${variant}`);
  return {
    id,
    label: preset.label,
    kind: preset.kind,
    variant,
    center: { x, z },
    widthM: preset.widthM,
    depthM: preset.depthM,
    heightM: preset.heightM,
    rotationDeg,
    blocksView: preset.blocksView ?? true
  };
}

function presetObstacles(
  prefix: string,
  placements: Array<[variant: ObstacleVariant, x: number, z: number, rotationDeg?: number]>
): PlanObstacle[] {
  return placements.map(([variant, x, z, rotationDeg], index) =>
    presetObstacle(`${prefix}-${variant}-${index + 1}`, variant, x, z, rotationDeg)
  );
}

function tableChairs(
  prefix: string,
  x: number,
  z: number,
  rotationDeg = 0,
  variant: Extract<ObstacleVariant, "office-chair" | "dining-chair"> = "office-chair"
): PlanObstacle[] {
  const vertical = Math.abs(rotationDeg % 180) === 90;
  const placements: Array<[ObstacleVariant, number, number, number]> = vertical
    ? [
        [variant, x - 1.15, z - 0.38, 270], [variant, x - 1.15, z + 0.38, 270],
        [variant, x + 1.15, z - 0.38, 90], [variant, x + 1.15, z + 0.38, 90]
      ]
    : [
        [variant, x - 0.55, z - 1.05, 0], [variant, x + 0.55, z - 1.05, 0],
        [variant, x - 0.55, z + 1.05, 180], [variant, x + 0.55, z + 1.05, 180]
      ];
  return presetObstacles(prefix, placements);
}

const partitionThicknessM = 0.15;

/** The wall an object stands with its back against. */
type WallSide = "north" | "south" | "east" | "west";

/**
 * Presets face +z at 0° and turn clockwise in plan, so the rotation that puts an
 * object's back on a wall follows directly from which side that wall is on.
 */
const backToWallRotation: Record<WallSide, number> = { north: 0, east: 90, south: 180, west: 270 };

/**
 * A preset standing with its back on a wall face and its front toward the room.
 *
 * Deriving both the offset and the rotation from the wall keeps wardrobes, beds,
 * fridges and shelving from floating in a room or opening into the wall behind them.
 * `wallLine` is the wall's centreline coordinate; `along` is the position along it.
 */
function onWall(
  id: string,
  variant: ObstacleVariant,
  backTo: WallSide,
  wallLine: number,
  along: number,
  thicknessM = wallThicknessM
): PlanObstacle {
  const preset = obstaclePreset(variant);
  if (!preset) throw new Error(`Unknown obstacle preset: ${variant}`);
  const offset = thicknessM / 2 + preset.depthM / 2 + 0.02;
  const rotation = backToWallRotation[backTo];
  switch (backTo) {
    case "north": return presetObstacle(id, variant, along, wallLine + offset, rotation);
    case "south": return presetObstacle(id, variant, along, wallLine - offset, rotation);
    case "west": return presetObstacle(id, variant, wallLine + offset, along, rotation);
    case "east": return presetObstacle(id, variant, wallLine - offset, along, rotation);
  }
}

/** Several presets of one kind along the same wall face. */
function alongWall(
  prefix: string,
  variant: ObstacleVariant,
  backTo: WallSide,
  wallLine: number,
  positions: number[],
  thicknessM = wallThicknessM
): PlanObstacle[] {
  return positions.map((along, index) => onWall(`${prefix}-${index + 1}`, variant, backTo, wallLine, along, thicknessM));
}

/** A preset stretched to a site-specific size, such as a road along a whole frontage. */
function sizedPreset(id: string, variant: ObstacleVariant, x: number, z: number, widthM: number, depthM: number, rotationDeg = 0): PlanObstacle {
  return { ...presetObstacle(id, variant, x, z, rotationDeg), widthM, depthM };
}

/**
 * A checklist sub-area drawn where that part of the programme physically is: the
 * pavement in front of a façade, the threshold inside a door, the cash wrap.
 */
function zone(id: string, sectionTypeId: string, label: string, left: number, top: number, right: number, bottom: number): CoverageRequirement {
  return {
    id,
    polygon: [{ x: left, z: top }, { x: right, z: top }, { x: right, z: bottom }, { x: left, z: bottom }],
    label,
    origin: "user",
    sectionTypeId
  };
}

/** Parking bays with each car nosed into the bay and centred in it. */
function parkingRow(prefix: string, variants: ObstacleVariant[], xs: number[], z: number, facing: "north" | "south" = "north"): PlanObstacle[] {
  // Vehicles are modelled lengthwise on local x with the headlights at +x, so the nose
  // points east at 0°, south at 90° and north at 270°.
  const rotation = facing === "north" ? 270 : 90;
  return xs.map((x, index) => presetObstacle(`${prefix}-${index + 1}`, variants[index % variants.length], x, z, rotation));
}

function topLanding(id: string, x: number, z: number, rotationDeg = 0): PlanObstacle {
  return presetObstacle(id, "stair-landing", x, z, rotationDeg);
}

function mallCore(prefix: string, top = false): PlanObstacle[] {
  return [
    top
      ? topLanding(`${prefix}-landing`, -2, 0, 90)
      : presetObstacle(`${prefix}-stairs`, "stairs-straight", -2, 0, 90),
    presetObstacle(`${prefix}-elevator`, "elevator", 0, 0, 90),
    presetObstacle(`${prefix}-escalator`, "escalator", 2, 0, 90)
  ];
}

function floor(id: string, name: string, index: number, walls: PlanWall[], doors: PlanDoor[] = [], obstacles: PlanObstacle[] = [], heightM = 3.4): FloorPlan {
  return { id, name, elevationM: index * heightM, heightM, walls, doors, obstacles, cameras: [] };
}

function building(floors: FloorPlan[]): BuildingPlan {
  return {
    floors,
    activeFloorId: floors[0].id,
    gridSizeM: 1,
    snapM: 1,
    defaults: { ...defaultPlanDefaults, wallHeightM, wallThicknessM }
  };
}

/**
 * A two-storey family house on a fenced plot.
 *
 * Every residential checklist item exists as a real place: the entrance hall, the yard
 * gate and driveway parking at the street, the garden and children's play area to the
 * west, the blind rear wall, a first-floor corridor and a stair that lines up on both
 * floors. Furniture is placed against walls and faces into the room it serves.
 */
function familyVillaPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const ground = floor("family-villa-ground", "همکف، ورودی، نشیمن و آشپزخانه", 0, [
    ...rectangle("family-villa-ground-shell", -14, -9, 14, 9),
    partition("family-villa-ground-spine", -14, 2, 14, 2),
    partition("family-villa-ground-kitchen", 5, -9, 5, 2),
    partition("family-villa-ground-hall-west", -5, 2, -5, 9),
    partition("family-villa-ground-hall-east", 4, 2, 4, 9),
    partition("family-villa-ground-utility", 9, 2, 9, 9)
  ], [
    { ...door("family-villa-main-entry", "family-villa-ground-shell-south", 0.5, 1.6), variant: "single-glass", swingDirection: "inward" },
    door("family-villa-living-door", "family-villa-ground-spine", 0.5, 1.4),
    door("family-villa-kitchen-door", "family-villa-ground-kitchen", 0.7, 1.2),
    door("family-villa-utility-door", "family-villa-ground-spine", 0.9107, 1),
    door("family-villa-study-door", "family-villa-ground-hall-west", 0.3, 1),
    door("family-villa-stair-door", "family-villa-ground-hall-east", 0.83, 1),
    windowOpening("family-villa-ground-window-north-a", "family-villa-ground-shell-north", 0.25, 2.6),
    windowOpening("family-villa-ground-window-north-b", "family-villa-ground-shell-north", 0.85, 2.4),
    windowOpening("family-villa-ground-window-east", "family-villa-ground-shell-east", 0.38, 2.2),
    windowOpening("family-villa-ground-window-west", "family-villa-ground-shell-west", 0.2, 1.8),
    windowOpening("family-villa-ground-window-study-south", "family-villa-ground-shell-south", 0.839, 1.8)
  ], [
    // Living room: TV on the west wall, sofa facing it across the coffee table.
    onWall("family-villa-tv", "tv-unit", "west", -14, -4),
    ...presetObstacles("family-villa-living", [
      ["rug", -10.6, -4, 90], ["coffee-table", -10.6, -4, 90], ["sofa-three", -8.6, -4, 90],
      ["sofa-single", -10.6, -6.3, 0], ["sofa-single", -10.6, -1.7, 180], ["dining-table", -1.5, -4, 90]
    ]),
    ...tableChairs("family-villa-dining-chairs", -1.5, -4, 90, "dining-chair"),
    // Kitchen: one continuous run on the north wall, fridge on the east wall, island free.
    ...[
      onWall("family-villa-dishwasher", "dishwasher", "north", -9, 6.7),
      onWall("family-villa-counter-a", "kitchen-counter", "north", -9, 8.2),
      onWall("family-villa-sink", "sink-unit", "north", -9, 9.85),
      onWall("family-villa-stove", "stove", "north", -9, 10.6),
      onWall("family-villa-counter-b", "kitchen-counter", "north", -9, 12.1),
      onWall("family-villa-fridge", "fridge", "east", 14, -6.5)
    ],
    presetObstacle("family-villa-kitchen-island", "kitchen-island", 9.6, -5.2),
    // Study: desk under the west window, shelves on the spine wall.
    onWall("family-villa-study-desk", "office-desk", "west", -14, 5.4),
    presetObstacle("family-villa-study-chair", "office-chair", -12.75, 5.4, 90),
    ...alongWall("family-villa-study-shelf", "bookshelf", "north", 2, [-11, -9.7], t),
    // Entrance hall console, stair and utility room with the recorder.
    onWall("family-villa-hall-console", "dresser", "west", -5, 6, t),
    presetObstacle("family-villa-ground-stairs", "stairs-straight", 6.5, 5.5, 90),
    presetObstacle("family-villa-ground-rack", "equipment-rack", 13.45, 8.45, 90),
    presetObstacle("family-villa-ground-ups", "ups-unit", 12.5, 8.5, 90),
    presetObstacle("family-villa-utility-store", "crate-stack", 10.2, 7.9),
    // Plot: boundary walls, sliding gate, driveway with a parked car and the garden.
    sizedPreset("family-villa-fence-north", "fence-wall", 0, -14, 44, 0.25),
    sizedPreset("family-villa-fence-south-west", "fence-wall", -8.25, 16, 27.5, 0.25),
    sizedPreset("family-villa-fence-south-east", "fence-wall", 16.25, 16, 11.5, 0.25),
    sizedPreset("family-villa-fence-west", "fence-wall", -22, 1, 30, 0.25, 90),
    sizedPreset("family-villa-fence-east", "fence-wall", 22, 1, 30, 0.25, 90),
    presetObstacle("family-villa-yard-gate", "gate-sliding", 8, 16),
    sizedPreset("family-villa-driveway", "road", 8, 12.8, 4.6, 6.2),
    ...parkingRow("family-villa-car", ["sedan"], [8], 12.5, "north"),
    sizedPreset("family-villa-garden-west", "grass", -18, -2.5, 7, 21),
    sizedPreset("family-villa-garden-front", "grass", -8, 12.6, 11.5, 5.6),
    ...presetObstacles("family-villa-yard", [
      ["deciduous", -19, -10], ["hedge", 20, 0, 90], ["light-pole", 11.8, 15.2],
      ["waiting-bench", -18, 9.6, 180], ["bush", -20.5, 3.5], ["bush", -15.5, 3.5]
    ])
  ]);
  ground.coverageRequirements = [
    zone("family-villa-gate-zone", "residential.gate", "درِ حیاط و ورود خودرو", 5, 14.4, 11, 17.6),
    zone("family-villa-entry-zone", "residential.entrance", "ورودی اصلی ساختمان", -1.8, 7.2, 1.8, 8.85),
    zone("family-villa-parking-zone", "residential.parking", "پارکینگ داخل حیاط", 5.4, 10, 10.6, 15.2),
    zone("family-villa-garden-zone", "residential.yard", "حیاط و باغچه غربی", -18.8, -6, -15.2, -0.5),
    zone("family-villa-front-yard-zone", "residential.yard", "حیاط جلوی ساختمان", -13.8, 9.6, 3.8, 15.4),
    zone("family-villa-play-zone", "residential.pool", "فضای بازی کودکان", -20.5, 2.5, -15.2, 8.5),
    zone("family-villa-rear-zone", "residential.blind-wall", "پشت ساختمان و دیوار کور", -14, -13.6, 14, -9.3)
  ];

  const first = floor("family-villa-first", "طبقه اول، اتاق‌خواب‌ها و نشیمن خانوادگی", 1, [
    ...rectangle("family-villa-first-shell", -14, -9, 14, 9),
    partition("family-villa-first-corridor-north", -14, -1, 14, -1),
    partition("family-villa-first-corridor-south", -14, 1.5, 14, 1.5),
    partition("family-villa-first-bedroom-west", -4.5, -9, -4.5, -1),
    partition("family-villa-first-bedroom-east", 5, -9, 5, -1),
    partition("family-villa-first-stair-west", 4, 1.5, 4, 9),
    partition("family-villa-first-store", 9, 1.5, 9, 9)
  ], [
    door("family-villa-first-bedroom-a", "family-villa-first-corridor-north", 0.25, 1),
    door("family-villa-first-bedroom-b", "family-villa-first-corridor-north", 0.5179, 1),
    door("family-villa-first-bedroom-c", "family-villa-first-corridor-north", 0.8929, 1),
    door("family-villa-first-lounge-door", "family-villa-first-corridor-south", 0.3214, 1.4),
    door("family-villa-first-stair-door", "family-villa-first-corridor-south", 0.7321, 1),
    door("family-villa-first-store-door", "family-villa-first-corridor-south", 0.9107, 1),
    windowOpening("family-villa-first-window-north-a", "family-villa-first-shell-north", 0.0714, 1.6),
    windowOpening("family-villa-first-window-north-b", "family-villa-first-shell-north", 0.5893, 1.6),
    windowOpening("family-villa-first-window-north-c", "family-villa-first-shell-north", 0.9286, 1.6),
    windowOpening("family-villa-first-window-south-a", "family-villa-first-shell-south", 0.8214, 2.2),
    windowOpening("family-villa-first-window-south-b", "family-villa-first-shell-south", 0.5714, 2.2),
    windowOpening("family-villa-first-window-south-c", "family-villa-first-shell-south", 0.0893, 1)
  ], [
    // Master bedroom: headboard on the north wall between two nightstands.
    onWall("family-villa-bed-master", "bed-double", "north", -9, -9.25),
    ...alongWall("family-villa-master-nightstand", "nightstand", "north", -9, [-10.35, -8.15]),
    onWall("family-villa-master-wardrobe", "wardrobe", "west", -14, -3.5),
    onWall("family-villa-master-dresser", "dresser", "east", -4.5, -6, t),
    // Child bedroom with a desk.
    onWall("family-villa-bed-child", "bed-single", "north", -9, -2),
    onWall("family-villa-child-nightstand", "nightstand", "north", -9, -0.95),
    onWall("family-villa-child-wardrobe", "wardrobe", "east", 5, -3.5, t),
    onWall("family-villa-child-desk", "office-desk", "west", -4.5, -4.5, t),
    presetObstacle("family-villa-child-chair", "office-chair", -3.3, -4.5, 90),
    // Guest bedroom.
    onWall("family-villa-bed-guest", "bed-single", "north", -9, 8),
    onWall("family-villa-guest-nightstand", "nightstand", "north", -9, 9.05),
    onWall("family-villa-guest-wardrobe", "wardrobe", "east", 14, -3.5),
    onWall("family-villa-guest-shelf", "bookshelf", "west", 5, -4, t),
    // Family lounge facing a TV on the west wall.
    onWall("family-villa-lounge-tv", "tv-unit", "west", -14, 5.2),
    ...presetObstacles("family-villa-family-lounge", [
      ["rug", -10.6, 5.2, 90], ["coffee-table", -10.6, 5.2, 90], ["sofa-three", -8.6, 5.2, 90],
      ["sofa-single", -10.6, 2.9, 0], ["sofa-single", -10.6, 7.5, 180]
    ]),
    onWall("family-villa-lounge-shelf", "bookshelf", "east", 4, 6.5, t),
    topLanding("family-villa-first-landing", 6.5, 5.5, 90),
    presetObstacle("family-villa-first-store-crates", "crate-stack", 12.6, 7.9)
  ]);
  return building([ground, first]);
}

/**
 * A neighbourhood corner shop: street front to the north, stock room and office at the back.
 *
 * The till stands beside the door so the cashier faces everyone entering, with the
 * high-value shelf behind the cashier where only staff can reach it. All wall shelving
 * backs onto a wall and the central gondolas are back-to-back pairs with real aisles.
 */
function cornerRetailShopPlan(): BuildingPlan {
  const ground = floor("corner-shop-ground", "فروشگاه، صندوق و انبار پشتی", 0, [
    ...rectangle("corner-shop-shell", -10, -7, 10, 7),
    partition("corner-shop-back-spine", -10, 3, 10, 3),
    partition("corner-shop-back-split", 3, 3, 3, 7)
  ], [
    { ...door("corner-shop-entry", "corner-shop-shell-north", 0.5, 2), variant: "double-glass", swingDirection: "inward" },
    door("corner-shop-stock-door", "corner-shop-back-spine", 0.28, 1.2),
    door("corner-shop-service-door", "corner-shop-back-spine", 0.77, 1.1),
    { ...door("corner-shop-back-exit", "corner-shop-shell-south", 0.72, 1.1), swingDirection: "outward" },
    windowOpening("corner-shop-front-window-a", "corner-shop-shell-north", 0.2, 2.4),
    windowOpening("corner-shop-front-window-b", "corner-shop-shell-north", 0.8, 2.4),
    windowOpening("corner-shop-side-window", "corner-shop-shell-east", 0.464, 2.4)
  ], [
    // Sales floor: wall shelving, two back-to-back gondolas and window display stands.
    ...alongWall("corner-shop-wall-shelf-west", "shelving-unit", "west", -10, [-3.6, -1.6, 0.4]),
    onWall("corner-shop-wall-shelf-east", "shelving-unit", "east", 10, 1.9),
    ...[-5.5, -3.5, 0.5, 2.5].flatMap((x, index) => [
      presetObstacle(`corner-shop-gondola-north-${index + 1}`, "shelving-unit", x, -1.6, 180),
      presetObstacle(`corner-shop-gondola-south-${index + 1}`, "shelving-unit", x, -1, 0)
    ]),
    ...presetObstacles("corner-shop-window-display", [
      ["display-stand", -6.6, -6.25], ["display-stand", -5.4, -6.25], ["display-stand", 6, -6.25],
      ["display-stand", 6, -1.3], ["display-stand", 6, 1.3]
    ]),
    // Cash wrap beside the entrance: counter, cashier and the high-value shelf behind.
    presetObstacle("corner-shop-checkout", "checkout-counter", 7.6, -4.4, 90),
    presetObstacle("corner-shop-cashier-chair", "office-chair", 8.75, -4.4, 90),
    onWall("corner-shop-high-value-shelf", "shelving-unit", "east", 10, -4.4),
    // Stock room: racking on the rear wall, clear route from the stock door to the back exit.
    ...alongWall("corner-shop-stock-rack", "storage-rack", "south", 7, [-8, -0.4]),
    ...presetObstacles("corner-shop-stock", [
      ["crate-stack", -8.9, 3.95], ["pallet-stack", -7.2, 3.9], ["packing-table", -1.2, 4.3]
    ]),
    // Office: desk facing the door, recorder rack and UPS in the far corner.
    presetObstacle("corner-shop-office-desk", "office-desk", 8.2, 5, 90),
    presetObstacle("corner-shop-office-chair", "office-chair", 9.1, 5, 90),
    presetObstacle("corner-shop-nvr-rack", "equipment-rack", 9.45, 6.45, 90),
    presetObstacle("corner-shop-ups", "ups-unit", 8.55, 6.5, 90),
    onWall("corner-shop-filing", "filing-cabinet", "south", 7, 4.6, wallThicknessM),
    // Street frontage.
    sizedPreset("corner-shop-street", "road", 0, -10.8, 28, 3.6),
    ...presetObstacles("corner-shop-frontage", [
      ["light-pole", -8.5, -8.1], ["light-pole", 8.5, -8.1], ["bollard", -2.6, -7.8], ["bollard", 2.6, -7.8]
    ])
  ]);
  ground.coverageRequirements = [
    zone("corner-shop-entrance-zone", "shop.entrance", "درِ ورودی مغازه", -1.8, -6.9, 1.8, -5),
    zone("corner-shop-checkout-zone", "shop.checkout", "صندوق و قفسه پشت صندوق", 6.95, -5.8, 9.9, -3),
    zone("corner-shop-display-zone", "shop.display", "ویترین جلوی شیشه", -7.4, -6.9, -4.6, -5.5),
    zone("corner-shop-facade-zone", "shop.facade", "نمای بیرونی و پیاده‌رو", -10, -9, 10, -7.15),
    zone("corner-shop-delivery-zone", "shop.delivery", "محل تحویل بار پشت مغازه", -6.2, 7.15, -2.6, 9.2)
  ];
  return building([ground]);
}

/**
 * A fully furnished multi-level estate.
 *
 * An enclosed stair and lift core sits in the same place on every level. The basement
 * holds the garage behind its ramp barrier, the plant and server room and storage; the
 * ground floor is the family's public floor opening onto the garden and pool; the upper
 * floors are bedrooms off a real corridor, then cinema, games and a guest suite.
 */
function luxuryVillaPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const core = (prefix: string): PlanObstacle[] => [
    presetObstacle(`${prefix}-stairs`, "stairs-straight", 2, 4.3, 90),
    presetObstacle(`${prefix}-elevator`, "elevator", 3.8, 4.3, 90)
  ];

  const basement = floor("villa-basement", "زیرزمین، پارکینگ و خدمات", -1, [
    ...rectangle("villa-basement-shell", -22, -15, 22, 15),
    partition("villa-basement-spine", 0, -15, 0, 15),
    partition("villa-basement-east-bay", 0, 1, 22, 1),
    partition("villa-basement-core-east", 6, 1, 6, 7),
    partition("villa-basement-core-south", 0, 7, 6, 7)
  ], [
    { ...door("villa-basement-ramp", "villa-basement-shell-south", 0.75, 5), variant: "double-solid" },
    door("villa-basement-core-door", "villa-basement-spine", 0.6333, 1.2),
    door("villa-basement-plant-door", "villa-basement-spine", 0.2333, 1.4),
    door("villa-basement-store-door", "villa-basement-spine", 0.8667, 1.4),
    door("villa-basement-store-core-door", "villa-basement-core-east", 0.5, 1),
    windowOpening("villa-basement-vent-a", "villa-basement-shell-east", 0.28, 1.4),
    windowOpening("villa-basement-vent-b", "villa-basement-shell-east", 0.72, 1.4)
  ], [
    // Garage: two rows of nosed-in bays, the ramp lane kept clear.
    ...parkingRow("villa-basement-bay-north", ["sedan", "suv", "sedan", "pickup", "suv", "sedan"], [-19, -16, -13, -9.8, -6.6, -3.4], -11, "north"),
    ...parkingRow("villa-basement-bay-south", ["van", "sedan", "sedan", "suv"], [-19, -16, -5.6, -2.8], 10.6, "south"),
    ...presetObstacles("villa-basement-ramp-control", [
      ["parking-barrier", -11, 13.2], ["speed-bump", -11, 11.4], ["bollard", -14, 13.8], ["bollard", -8, 13.8]
    ]),
    // Plant and server room.
    ...[
      onWall("villa-basement-rack", "equipment-rack", "north", -15, 2),
      onWall("villa-basement-nvr", "nvr-cabinet", "north", -15, 3.2),
      onWall("villa-basement-ups", "ups-unit", "north", -15, 4.2),
      onWall("villa-basement-switch", "network-switch", "north", -15, 5)
    ],
    onWall("villa-basement-console", "monitoring-console", "east", 22, -9),
    presetObstacle("villa-basement-console-chair", "office-chair", 20.3, -9, 270),
    onWall("villa-basement-tool-cabinet", "tool-cabinet", "north", -15, 12),
    presetObstacle("villa-basement-workbench", "workbench", 13, -9),
    presetObstacle("villa-basement-boiler", "cnc-machine", 8, -4),
    // Storage.
    ...alongWall("villa-basement-store-rack", "storage-rack", "south", 15, [10, 14, 18]),
    ...presetObstacles("villa-basement-store", [["crate-stack", 9, 4.5], ["pallet-stack", 12.5, 4.5]]),
    ...core("villa-basement")
  ]);

  const ground = floor("villa-ground", "همکف، باغ و پذیرایی", 0, [
    ...rectangle("villa-estate", -32, -24, 32, 24, 2.2),
    ...rectangle("villa-house", -16, -11, 16, 11),
    partition("villa-ground-spine", -16, 1, 16, 1),
    partition("villa-ground-living-wall", -2, -11, -2, 1),
    partition("villa-ground-office-wall", -6, 1, -6, 11),
    partition("villa-ground-core-west", 0, 1, 0, 11),
    partition("villa-ground-core-east", 6, 1, 6, 11),
    partition("villa-ground-core-south", 0, 7, 6, 7)
  ], [
    door("villa-gate", "villa-estate-south", 0.5, 5),
    { ...door("villa-main-entry", "villa-house-south", 0.5938, 2.4), variant: "double-glass", swingDirection: "inward" },
    { ...door("villa-garden-entry", "villa-house-north", 0.2188, 2.4), variant: "double-glass" },
    { ...door("villa-garden-entry-dining", "villa-house-north", 0.7188, 2.4), variant: "double-glass" },
    door("villa-hall-living", "villa-ground-spine", 0.375, 1.6),
    door("villa-dining-core", "villa-ground-spine", 0.5938, 1.2),
    door("villa-kitchen-entry", "villa-ground-spine", 0.8438, 1.2),
    door("villa-living-dining", "villa-ground-living-wall", 0.5, 3),
    door("villa-core-door", "villa-ground-core-west", 0.3, 1.2),
    door("villa-coat-door", "villa-ground-core-west", 0.8, 0.9),
    door("villa-office-entry", "villa-ground-office-wall", 0.5, 1.1),
    { ...door("villa-kitchen-service", "villa-house-east", 0.8636, 1), swingDirection: "outward" },
    windowOpening("villa-ground-window-west-living", "villa-house-west", 0.5682, 2),
    windowOpening("villa-ground-window-west-office", "villa-house-west", 0.2273, 2),
    windowOpening("villa-ground-window-east", "villa-house-east", 0.2727, 2.4),
    windowOpening("villa-ground-window-south-a", "villa-house-south", 0.8438, 2.4),
    windowOpening("villa-ground-window-south-b", "villa-house-south", 0.1563, 2.4)
  ], [
    // Living room: TV on the west wall, sofa facing it.
    onWall("villa-living-tv", "tv-unit", "west", -16, -6),
    ...presetObstacles("villa-lounge", [
      ["rug", -12.6, -6, 90], ["coffee-table", -12.6, -6, 90], ["sofa-three", -10.4, -6, 90],
      ["sofa-single", -12.6, -8.3, 0], ["sofa-single", -12.6, -3.7, 180]
    ]),
    onWall("villa-living-bookshelf", "bookshelf", "north", -11, -14.5),
    // Dining for eight.
    ...[5, 10].flatMap((x, index) => [
      presetObstacle(`villa-dining-table-${index + 1}`, "dining-table", x, -5),
      ...tableChairs(`villa-dining-chairs-${index + 1}`, x, -5, 0, "dining-chair")
    ]),
    onWall("villa-dining-sideboard", "dresser", "east", 16, -8.5),
    // Entrance hall, coat room, study and kitchen.
    onWall("villa-hall-console", "dresser", "west", -6, 8.8, t),
    onWall("villa-coat-wardrobe", "wardrobe", "south", 11, 3),
    onWall("villa-study-desk", "office-desk", "west", -16, 6),
    presetObstacle("villa-study-chair", "office-chair", -14.75, 6, 90),
    ...alongWall("villa-study-shelf", "bookshelf", "north", 1, [-13, -11.6], t),
    onWall("villa-study-filing", "filing-cabinet", "east", -6, 3, t),
    onWall("villa-kitchen-counter-a", "kitchen-counter", "south", 11, 8.5),
    onWall("villa-kitchen-sink", "sink-unit", "south", 11, 10.15),
    onWall("villa-kitchen-dishwasher", "dishwasher", "south", 11, 10.9),
    onWall("villa-kitchen-stove", "stove", "south", 11, 11.5),
    onWall("villa-kitchen-counter-b", "kitchen-counter", "south", 11, 13),
    onWall("villa-kitchen-fridge", "fridge", "east", 16, 3),
    presetObstacle("villa-kitchen-island", "kitchen-island", 10.5, 5.5),
    ...core("villa-ground"),
    // Garden, pool, driveway and the ramp down to the garage.
    ...presetObstacles("villa-arrival", [
      ["gate-sliding", 0, 23.2], ["fence-mesh", -24, 23.2], ["fence-wall", 24, 23.2],
      ["camera-pole", -29, 19], ["light-pole", 29, 19], ["light-pole", 5, 14]
    ]),
    sizedPreset("villa-driveway", "road", 0, 18.5, 6, 10.5),
    sizedPreset("villa-garage-ramp", "road", -11, 18, 5, 6),
    sizedPreset("villa-north-lawn", "grass", -24, -14, 14, 16),
    ...presetObstacles("villa-landscape", [
      ["hedge", 25, -10, 90], ["bush", -19, -20], ["deciduous", -27, -4], ["conifer", 28, 0], ["palm", 24, -18]
    ]),
    obstacle("villa-pool", "استخر روباز", "block", -23, 5, 10, 4.5, 0.18, false)
  ]);
  ground.coverageRequirements = [
    zone("villa-gate-zone", "residential.gate", "درِ ورودی باغ و خودرو", -4, 21.6, 4, 23.9),
    zone("villa-entry-zone", "residential.entrance", "ورودی اصلی ساختمان", -4.8, 9.2, -1.2, 10.85),
    zone("villa-front-garden-zone", "residential.yard", "باغ جلوی ساختمان", -28, 14, -17, 17),
    zone("villa-north-garden-zone", "residential.yard", "باغ پشتی و چمن", -31, -22, -17, -6),
    zone("villa-pool-zone", "residential.pool", "استخر و محوطه بازی", -28.5, 2.2, -17.5, 7.8),
    zone("villa-blind-side-zone", "residential.blind-wall", "دیوار جانبی شرقی و مسیر سرویس", 16.2, -11, 21, 11)
  ];

  const first = floor("villa-first", "طبقه اول، اتاق‌خواب‌ها و کتابخانه", 1, [
    ...rectangle("villa-first-shell", -16, -11, 16, 11),
    partition("villa-first-corridor-north", -16, -1, 16, -1),
    partition("villa-first-corridor-south", -16, 1, 16, 1),
    partition("villa-first-north-1", -4, -11, -4, -1),
    partition("villa-first-north-2", 6, -11, 6, -1),
    partition("villa-first-core-west", 0, 1, 0, 11),
    partition("villa-first-core-east", 6, 1, 6, 11),
    partition("villa-first-core-south", 0, 7, 6, 7)
  ], [
    door("villa-first-master-door", "villa-first-corridor-north", 0.3125, 1.1),
    door("villa-first-bedroom-b-door", "villa-first-corridor-north", 0.5313, 1.1),
    door("villa-first-bedroom-c-door", "villa-first-corridor-north", 0.75, 1.1),
    door("villa-first-study", "villa-first-corridor-south", 0.4063, 1.1),
    door("villa-first-core-door", "villa-first-corridor-south", 0.5938, 1.2),
    door("villa-first-lounge-door", "villa-first-corridor-south", 0.75, 1.4),
    door("villa-first-linen-door", "villa-first-core-south", 0.75, 0.9),
    windowOpening("villa-first-window-north-a", "villa-first-shell-north", 0.1875, 2.4),
    windowOpening("villa-first-window-north-b", "villa-first-shell-north", 0.5313, 2),
    windowOpening("villa-first-window-north-c", "villa-first-shell-north", 0.8438, 2.4),
    windowOpening("villa-first-window-south-a", "villa-first-shell-south", 0.75, 2.4),
    windowOpening("villa-first-window-south-b", "villa-first-shell-south", 0.1563, 2.4),
    windowOpening("villa-first-window-east", "villa-first-shell-east", 0.7727, 2)
  ], [
    // Master bedroom.
    onWall("villa-first-master-bed", "bed-double", "west", -16, -6),
    ...alongWall("villa-first-master-nightstand", "nightstand", "west", -16, [-7.05, -4.95]),
    onWall("villa-first-master-wardrobe", "wardrobe", "east", -4, -8.5, t),
    onWall("villa-first-master-tv", "tv-unit", "east", -4, -6, t),
    onWall("villa-first-master-dresser", "dresser", "north", -11, -6.8),
    // Child bedroom with desk.
    onWall("villa-first-child-bed", "bed-single", "west", -4, -6, t),
    onWall("villa-first-child-nightstand", "nightstand", "west", -4, -7, t),
    onWall("villa-first-child-wardrobe", "wardrobe", "east", 6, -8.5, t),
    onWall("villa-first-child-desk", "office-desk", "north", -11, 3.6),
    presetObstacle("villa-first-child-chair", "office-chair", 3.6, -9.6, 180),
    // Guest bedroom.
    onWall("villa-first-guest-bed", "bed-single", "east", 16, -6),
    onWall("villa-first-guest-nightstand", "nightstand", "east", 16, -7),
    onWall("villa-first-guest-wardrobe", "wardrobe", "west", 6, -8.5, t),
    onWall("villa-first-guest-shelf", "bookshelf", "north", -11, 8),
    // Library / home office.
    onWall("villa-first-study-desk", "office-desk", "south", 11, -8),
    presetObstacle("villa-first-study-chair", "office-chair", -8, 9.65, 0),
    presetObstacle("villa-first-meeting", "meeting-table", -12, 5, 90),
    ...tableChairs("villa-first-meeting-chairs", -12, 5, 90),
    ...alongWall("villa-first-library", "bookshelf", "west", -16, [3, 4.3]),
    onWall("villa-first-study-filing", "filing-cabinet", "east", 0, 9.5, t),
    // Family lounge.
    onWall("villa-first-lounge-tv", "tv-unit", "west", 6, 6, t),
    ...presetObstacles("villa-first-lounge", [
      ["coffee-table", 7.9, 6, 90], ["sofa-three", 9.2, 6, 90], ["sofa-single", 7.9, 3.8, 0], ["sofa-single", 7.9, 8.2, 180]
    ]),
    onWall("villa-first-linen", "wardrobe", "south", 11, 3),
    ...core("villa-first")
  ]);

  const second = floor("villa-second", "طبقه دوم، سینما و سرگرمی", 2, [
    ...rectangle("villa-second-shell", -16, -11, 16, 11),
    partition("villa-second-corridor-north", -16, -1, 16, -1),
    partition("villa-second-corridor-south", -16, 1, 16, 1),
    partition("villa-second-cinema-wall", -2, -11, -2, -1),
    partition("villa-second-core-west", 0, 1, 0, 11),
    partition("villa-second-core-east", 6, 1, 6, 11),
    partition("villa-second-core-south", 0, 7, 6, 7)
  ], [
    door("villa-second-cinema-door", "villa-second-corridor-north", 0.2188, 1.4),
    door("villa-second-games-door", "villa-second-corridor-north", 0.7188, 1.6),
    door("villa-second-lounge-door", "villa-second-corridor-south", 0.25, 1.4),
    door("villa-second-core-door", "villa-second-corridor-south", 0.5938, 1.2),
    door("villa-second-guest-door", "villa-second-corridor-south", 0.8438, 1.1),
    door("villa-second-service-door", "villa-second-core-south", 0.75, 0.9),
    windowOpening("villa-second-window-north", "villa-second-shell-north", 0.7188, 3.2),
    windowOpening("villa-second-window-south-a", "villa-second-shell-south", 0.75, 2.4),
    windowOpening("villa-second-window-south-b", "villa-second-shell-south", 0.1563, 2.4),
    windowOpening("villa-second-window-west", "villa-second-shell-west", 0.2273, 2.2)
  ], [
    // Home cinema: screen on the west wall, two rows of lounge seating facing it.
    onWall("villa-second-cinema-screen", "tv-unit", "west", -16, -6),
    ...presetObstacles("villa-second-cinema-seats", [["lobby-sofa", -11, -6, 90], ["lobby-sofa", -8, -6, 90]]),
    // Games room and bar.
    obstacle("villa-games", "میز بازی", "counter", 2, -6, 3, 1.6, 0.85, false),
    onWall("villa-bar", "service-counter", "east", 16, -6),
    ...[-6.8, -6, -5.2].map((z, index) => presetObstacle(`villa-bar-stool-${index + 1}`, "dining-chair", 14.55, z, 270)),
    onWall("villa-second-drinks", "display-fridge", "north", -11, 13),
    // Sky lounge.
    onWall("villa-second-lounge-tv", "tv-unit", "east", 0, 6, t),
    ...presetObstacles("villa-second-lounge", [
      ["rug", -3.4, 6, 90], ["coffee-table", -2.3, 6, 90], ["sofa-three", -4, 6, 270],
      ["sofa-single", -2.3, 3.8, 0], ["sofa-single", -2.3, 8.2, 180]
    ]),
    // Service store and guest suite.
    presetObstacle("villa-second-service-crates", "crate-stack", 3, 9.5),
    onWall("villa-second-guest-bed", "bed-double", "east", 16, 6),
    ...alongWall("villa-second-guest-nightstand", "nightstand", "east", 16, [4.95, 7.05]),
    onWall("villa-second-guest-wardrobe", "wardrobe", "west", 6, 4, t),
    onWall("villa-second-guest-dresser", "dresser", "south", 11, 8),
    ...core("villa-second")
  ]);

  const roof = floor("villa-roof", "بام، روف‌گاردن و تاسیسات", 3, [
    ...rectangle("villa-roof-shell", -16, -11, 16, 11, 1.25),
    ...rectangle("villa-roof-room", -5, -3.5, 5, 6.8)
  ], [
    door("villa-roof-door", "villa-roof-room-south", 0.5, 1.4),
    windowOpening("villa-roof-window-east", "villa-roof-room-east", 0.5, 1.6),
    windowOpening("villa-roof-window-west", "villa-roof-room-west", 0.5, 1.6)
  ], [
    obstacle("villa-roof-pergola", "پرگولا و نشیمن سایه‌بان", "counter", -10, 6, 6, 5, 2.5, false),
    obstacle("villa-roof-garden-a", "باغچه خطی بام", "shelf", 11, -7.5, 7, 1.4, 0.7, false),
    obstacle("villa-roof-garden-b", "باغچه خطی بام", "shelf", 11, 7.5, 7, 1.4, 0.7, false),
    obstacle("villa-roof-firepit", "آتشدان مرکزی", "pillar", 0, -7, 1.4, 1.4, 0.55, false),
    topLanding("villa-roof-landing", 2, 4.3, 90),
    presetObstacle("villa-roof-elevator", "elevator", 3.8, 4.3, 90)
  ]);
  const plan = building([basement, ground, first, second, roof]);
  return { ...plan, activeFloorId: ground.id };
}

/**
 * A three-storey office: every floor shares one stair and lift core, a corridor and the
 * same north band of open-plan desks and a manager's office.
 *
 * The south band holds what each floor needs: the reception lobby, server room and
 * archive at grade; a floor reception, meeting room (a privacy area), equipment store
 * and archive upstairs. Staff and visitor parking lines the street in front.
 */
function modernOfficePlan(): BuildingPlan {
  const t = partitionThicknessM;
  const deskXs = [-15, -12.6, -10.2, -3, -0.6, 1.8, 4.2];
  const make = (index: number, name: string) => {
    const prefix = `office-${index}`;
    const ground = index === 0;
    const walls = [
      ...rectangle(`${prefix}-shell`, -18, -11, 18, 11),
      partition(`${prefix}-corridor-north`, -18, -1, 18, -1),
      partition(`${prefix}-corridor-south`, -18, 2, 18, 2),
      glassPartition(`${prefix}-rooms-v`, 7, -11, 7, -1),
      partition(`${prefix}-stair-wall`, -13, 2, -13, 11),
      partition(`${prefix}-lift-wall`, -10, 2, -10, 11),
      ...(ground ? [] : [glassPartition(`${prefix}-meeting-wall`, -2, 2, -2, 11)]),
      partition(`${prefix}-store-wall`, 10, 2, 10, 11),
      partition(`${prefix}-archive-wall`, 14, 2, 14, 11)
    ];
    const openings = [
      ...(ground ? [{ ...door(`${prefix}-entry`, `${prefix}-shell-south`, 0.5, 1.8), variant: "double-glass" as const, swingDirection: "inward" as const }] : []),
      door(`${prefix}-stair-door`, `${prefix}-corridor-south`, 0.0694, 1),
      door(`${prefix}-lift-door`, `${prefix}-corridor-south`, 0.1806, 1.2),
      ground
        ? { ...door(`${prefix}-lobby-opening`, `${prefix}-corridor-south`, 0.5, 3), variant: "double-glass" as const }
        : door(`${prefix}-floor-lobby-door`, `${prefix}-corridor-south`, 0.3333, 1.6),
      ...(ground ? [] : [door(`${prefix}-meeting-door`, `${prefix}-corridor-south`, 0.6111, 1)]),
      door(`${prefix}-store-door`, `${prefix}-corridor-south`, 0.8333, 0.9),
      door(`${prefix}-archive-door`, `${prefix}-corridor-south`, 0.9444, 0.9),
      door(`${prefix}-openplan-door`, `${prefix}-corridor-north`, 0.3333, 1.6),
      door(`${prefix}-manager-door`, `${prefix}-corridor-north`, 0.8333, 1),
      windowOpening(`${prefix}-window-north-a`, `${prefix}-shell-north`, 0.22, 3),
      windowOpening(`${prefix}-window-north-b`, `${prefix}-shell-north`, 0.78, 3),
      windowOpening(`${prefix}-window-east`, `${prefix}-shell-east`, 0.2273, 2.4),
      windowOpening(`${prefix}-window-west`, `${prefix}-shell-west`, 0.7727, 2.4),
      windowOpening(`${prefix}-window-south-a`, `${prefix}-shell-south`, 0.3333, 3),
      windowOpening(`${prefix}-window-south-b`, `${prefix}-shell-south`, 0.6667, 3)
    ];
    const shared = [
      index < 2
        ? presetObstacle(`${prefix}-stairs`, "stairs-straight", -15.5, 6.5, 90)
        : topLanding(`${prefix}-landing`, -15.5, 6.5, 90),
      presetObstacle(`${prefix}-elevator`, "elevator", -11.5, 6.5, 90),
      // Open plan: one row of desks under the windows, a second row facing it.
      ...deskXs.flatMap((x, desk) => [
        onWall(`${prefix}-desk-a-${desk + 1}`, "office-desk", "north", -11, x),
        presetObstacle(`${prefix}-chair-a-${desk + 1}`, "office-chair", x, -9.6, 180),
        presetObstacle(`${prefix}-desk-b-${desk + 1}`, "office-desk", x, -5.6),
        presetObstacle(`${prefix}-chair-b-${desk + 1}`, "office-chair", x, -4.65, 180)
      ]),
      // Manager's office.
      presetObstacle(`${prefix}-manager-desk`, "office-desk", 12.5, -7),
      presetObstacle(`${prefix}-manager-chair`, "office-chair", 12.5, -8, 0),
      ...presetObstacles(`${prefix}-manager-visitor`, [["office-chair", 12.05, -5.9, 180], ["office-chair", 12.95, -5.9, 180]]),
      onWall(`${prefix}-manager-shelf`, "bookshelf", "north", -11, 15.5),
      onWall(`${prefix}-manager-sofa`, "sofa-three", "east", 18, -3.2),
      // Archive.
      ...alongWall(`${prefix}-archive-cabinet`, "filing-cabinet", "east", 18, [4, 5, 6]),
      onWall(`${prefix}-archive-cabinet-south`, "filing-cabinet", "south", 11, 16)
    ];
    const specific = ground ? [
      // Reception lobby facing the entrance.
      presetObstacle(`${prefix}-reception`, "reception-desk", 3, 4.6),
      presetObstacle(`${prefix}-reception-chair`, "office-chair", 3, 3.7, 0),
      ...presetObstacles(`${prefix}-lobby`, [["lobby-sofa", -6, 6.2, 0], ["lobby-sofa", -6, 9.6, 180], ["coffee-table", -6, 7.9]]),
      onWall(`${prefix}-vending`, "vending-machine", "west", -10, 9, t),
      // Server room.
      ...alongWall(`${prefix}-server-rack`, "equipment-rack", "south", 11, [11.2, 12.4]),
      onWall(`${prefix}-server-ups`, "ups-unit", "east", 14, 8, t),
      // Staff and visitor parking on the street.
      ...parkingRow(`${prefix}-parking`, ["sedan", "suv", "sedan", "sedan"], [-15, -12.3, -9.6, -6.9, 6.9, 9.6, 12.3, 15], 15, "north"),
      sizedPreset(`${prefix}-street`, "road", 0, 21, 40, 4)
    ] : [
      // Floor reception where people arrive from the core.
      presetObstacle(`${prefix}-floor-reception`, "reception-desk", -6, 5.5),
      presetObstacle(`${prefix}-floor-reception-chair`, "office-chair", -6, 6.4, 180),
      onWall(`${prefix}-floor-bench`, "waiting-bench", "west", -10, 8.5, t),
      // Meeting room.
      presetObstacle(`${prefix}-meeting-table`, "meeting-table", 4, 6.5),
      ...tableChairs(`${prefix}-meeting-chairs`, 4, 6.5),
      onWall(`${prefix}-meeting-whiteboard`, "whiteboard", "west", -2, 6.5, t),
      // Equipment store.
      onWall(`${prefix}-store-rack`, "storage-rack", "south", 11, 12),
      onWall(`${prefix}-store-cabinet`, "tool-cabinet", "east", 14, 6, t)
    ];
    const plan = floor(prefix, name, index, walls, openings, [...shared, ...specific]);
    if (ground) {
      plan.coverageRequirements = [
        zone(`${prefix}-parking-west-zone`, "shared.staff-parking", "پارکینگ کارکنان و مراجعان غربی", -16.5, 12.6, -5.4, 17.6),
        zone(`${prefix}-parking-east-zone`, "shared.staff-parking", "پارکینگ کارکنان و مراجعان شرقی", 5.4, 12.6, 16.5, 17.6)
      ];
    }
    return plan;
  };
  return building([make(0, "لابی و خدمات"), make(1, "دفترهای عملیاتی"), make(2, "مدیریت و جلسات")]);
}

/**
 * A two-level fashion store: street front to the south, back of house to the north.
 *
 * The sales floor runs from the shop windows to the back wall with shelving on both side
 * walls, clothing racks in two blocks and the cash wrap beside the entrance. Behind it
 * sit the control office, the stair and lift core, the fitting rooms (a privacy area)
 * and the stock room with its own rear delivery door. The office mezzanine is directly
 * above the back of house so the core lines up.
 */
function retailGalleryPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const core = (prefix: string, top = false): PlanObstacle[] => [
    top ? topLanding(`${prefix}-landing`, -8, -9.5, 90) : presetObstacle(`${prefix}-stairs`, "stairs-straight", -8, -9.5, 90),
    presetObstacle(`${prefix}-elevator`, "elevator", -6.2, -9.5, 90)
  ];
  const ground = floor("gallery-ground", "گالری، صندوق و انبار", 0, [
    ...rectangle("gallery-shell", -20, -13, 20, 13),
    partition("gallery-back", -20, -6, 20, -6),
    partition("gallery-office-wall", -10, -13, -10, -6),
    partition("gallery-core-wall", -4, -13, -4, -6),
    partition("gallery-fitting-wall", 5, -13, 5, -6)
  ], [
    { ...door("gallery-entry", "gallery-shell-south", 0.5, 3), variant: "double-glass", swingDirection: "inward" },
    door("gallery-office-door", "gallery-back", 0.125, 1),
    door("gallery-core-door", "gallery-back", 0.325, 1.2),
    door("gallery-fitting-door", "gallery-back", 0.5125, 1.2),
    door("gallery-stock-door", "gallery-back", 0.8, 1.6),
    { ...door("gallery-delivery-door", "gallery-shell-north", 0.8, 1.4), swingDirection: "outward" },
    windowOpening("gallery-window-south-a", "gallery-shell-south", 0.18, 4),
    windowOpening("gallery-window-south-b", "gallery-shell-south", 0.82, 4),
    windowOpening("gallery-window-east", "gallery-shell-east", 0.6538, 2.4),
    windowOpening("gallery-window-west", "gallery-shell-west", 0.3462, 2.4)
  ], [
    // Sales floor: wall shelving, clothing-rack blocks, display tables and window displays.
    ...alongWall("gallery-wall-shelf-west", "shelving-unit", "west", -20, [-4, -2, 0, 7.5, 9.5]),
    ...alongWall("gallery-wall-shelf-east", "shelving-unit", "east", 20, [-4, -2, 0, 7.5, 9.5]),
    ...[-16, -13, -10, 11, 14, 17].flatMap((x) => [-3, 0, 3].map((z) => [x, z] as const))
      .map(([x, z], index) => presetObstacle(`gallery-clothing-rack-${index + 1}`, "clothing-rack", x, z)),
    ...presetObstacles("gallery-display-table", [
      ["display-stand", -4, -2], ["display-stand", 4, -2], ["display-stand", -4, 3], ["display-stand", 4, 3]
    ]),
    ...presetObstacles("gallery-window-display", [
      ["display-stand", -13.4, 12.15], ["display-stand", -12.2, 12.15], ["display-stand", 12.2, 12.15], ["display-stand", 13.4, 12.15]
    ]),
    // Cash wrap beside the entrance with the cashiers facing the door.
    ...presetObstacles("gallery-checkout", [["checkout-counter", 7, 8.6, 90], ["checkout-counter", 7, 10.2, 90]]),
    ...presetObstacles("gallery-cashier", [["office-chair", 7.85, 8.6, 90], ["office-chair", 7.85, 10.2, 90]]),
    // Control office.
    onWall("gallery-rack", "equipment-rack", "north", -13, -18.5),
    onWall("gallery-ups", "ups-unit", "north", -13, -17.3),
    onWall("gallery-console", "monitoring-console", "west", -20, -9.5),
    presetObstacle("gallery-console-chair", "office-chair", -18.3, -9.5, 90),
    onWall("gallery-office-desk", "office-desk", "east", -10, -9.5, t),
    presetObstacle("gallery-office-chair", "office-chair", -11.25, -9.5, 270),
    onWall("gallery-office-filing", "filing-cabinet", "north", -13, -13),
    ...core("gallery-ground"),
    // Fitting rooms: cubicle screens and a bench.
    ...[-1.6, 0.9, 3.4].map((x, index) => presetObstacle(`gallery-fitting-screen-${index + 1}`, "partition-screen", x, -11.6, 90)),
    presetObstacle("gallery-fitting-bench", "waiting-bench", -2.5, -7.4, 180),
    // Stock room.
    onWall("gallery-stock-rack-west", "storage-rack", "west", 5, -9.5, t),
    onWall("gallery-stock-rack-east", "storage-rack", "east", 20, -9.5),
    ...presetObstacles("gallery-stock", [["packing-table", 12, -8.6], ["pallet-stack", 9, -11.5], ["crate-stack", 15.5, -11.5]]),
    // Street frontage and rear service lane.
    sizedPreset("gallery-street", "road", 0, 17, 44, 4),
    sizedPreset("gallery-service-lane", "road", 12, -17, 16, 4),
    ...presetObstacles("gallery-street-lights", [["light-pole", -17, 14], ["light-pole", 17, 14]])
  ]);
  ground.coverageRequirements = [
    zone("gallery-entrance-zone", "shop.entrance", "درِ ورودی گالری", -2, 11, 2, 12.9),
    zone("gallery-checkout-zone", "shop.checkout", "صندوق کنار ورودی", 6, 7.4, 8.6, 11.4),
    zone("gallery-display-west-zone", "shop.display", "ویترین غربی", -14.8, 11.3, -10.8, 12.9),
    zone("gallery-display-east-zone", "shop.display", "ویترین شرقی", 10.8, 11.3, 14.8, 12.9),
    zone("gallery-facade-zone", "shop.facade", "نمای بیرونی و پیاده‌رو", -20, 13.15, 20, 15),
    zone("gallery-delivery-zone", "shop.delivery", "محل تحویل بار پشت فروشگاه", 9.5, -15.6, 14.5, -13.15)
  ];

  const mezzanine = floor("gallery-mezzanine", "نیم‌طبقه اداری", 1, [
    ...rectangle("gallery-mezz-shell", -11, -13, 11, -1),
    partition("gallery-mezz-core-wall", -4, -13, -4, -6),
    glassPartition("gallery-mezz-h", -11, -6, 11, -6),
    glassPartition("gallery-mezz-v", 2, -6, 2, -1)
  ], [
    door("gallery-mezz-core-door", "gallery-mezz-core-wall", 0.7143, 1),
    door("gallery-mezz-meeting", "gallery-mezz-h", 0.4545, 1),
    door("gallery-mezz-lounge", "gallery-mezz-h", 0.7727, 1.2),
    { ...door("gallery-mezz-link", "gallery-mezz-v", 0.5, 0.9), variant: "single-glass" },
    windowOpening("gallery-mezz-window-north", "gallery-mezz-shell-north", 0.5909, 3),
    windowOpening("gallery-mezz-window-east", "gallery-mezz-shell-east", 0.1667, 1.6)
  ], [
    // Open office: desks on the north wall, staff facing them.
    ...[-1, 5, 8.5].flatMap((x, index) => [
      onWall(`gallery-mezz-desk-${index + 1}`, "office-desk", "north", -13, x),
      presetObstacle(`gallery-mezz-chair-${index + 1}`, "office-chair", x, -11.6, 180)
    ]),
    onWall("gallery-mezz-filing", "filing-cabinet", "east", 11, -9),
    // Meeting room.
    presetObstacle("gallery-mezz-meeting-table", "meeting-table", -4.5, -3.5),
    ...tableChairs("gallery-mezz-meeting-chairs", -4.5, -3.5),
    // Reception and lounge overlooking the sales floor.
    presetObstacle("gallery-mezz-reception", "reception-desk", 6.5, -4.6),
    presetObstacle("gallery-mezz-sofa", "lobby-sofa", 6.5, -2, 180),
    onWall("gallery-mezz-vending", "vending-machine", "east", 11, -3.5),
    ...core("gallery-mezz", true)
  ]);
  return building([ground, mezzanine]);
}

/**
 * A neighbourhood supermarket with a street front to the south and a service yard north.
 *
 * Staff reach the cold store, stock room, freight lift, server room, cash room and
 * lockers along a service corridor behind the sales floor, so none of them opens onto
 * the shop. Gondolas are back-to-back runs with 2.8 m aisles, the checkouts sit in front
 * of the entrance vestibule and the high-value shelf is beside the last till.
 */
function neighbourhoodSupermarketPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const h = 4.4;
  const walls = [
    ...rectangle("market-shell", -24, -15, 24, 15, h),
    partition("market-corridor-north", -24, -7, 24, -7, h),
    partition("market-corridor-south", -24, -5, 24, -5, h),
    partition("market-coldstore-wall", -12, -15, -12, -7, h),
    partition("market-stock-east", 6, -15, 6, -7, h),
    partition("market-lift-east", 9.5, -15, 9.5, -7, h),
    partition("market-lift-floor", 6, -11, 9.5, -11, h),
    partition("market-staff-wall", 16, -15, 16, -7, h),
    glassPartition("market-entry-west", -5, 10.5, -5, 15, 3.2),
    glassPartition("market-entry-east", 5, 10.5, 5, 15, 3.2),
    glassPartition("market-entry-inner", -5, 10.5, 5, 10.5, 3.2)
  ];
  const doors: PlanDoor[] = [
    { ...door("market-customer-entry", "market-shell-south", 0.5, 2.8), variant: "double-glass", swingDirection: "inward" },
    { ...door("market-entry-inner-door", "market-entry-inner", 0.5, 2.4), variant: "double-glass", swingDirection: "inward" },
    door("market-coldstore-door", "market-corridor-north", 0.125, 1.5),
    { ...door("market-stock-door", "market-corridor-north", 0.4375, 1.8), variant: "double-solid" },
    door("market-lift-door", "market-corridor-north", 0.6615, 1.2),
    door("market-cashroom-door", "market-corridor-north", 0.7656, 1),
    door("market-staff-door", "market-corridor-north", 0.9167, 1),
    door("market-server-door", "market-stock-east", 0.25, 1),
    door("market-service-door-west", "market-corridor-south", 0.3333, 1.4),
    door("market-service-door-east", "market-corridor-south", 0.875, 1.2),
    { ...door("market-loading-door", "market-shell-north", 0.4375, 3.4), variant: "double-solid", swingDirection: "outward" },
    windowOpening("market-shopfront-west", "market-shell-south", 0.7917, 6),
    windowOpening("market-shopfront-east", "market-shell-south", 0.2083, 6)
  ];
  const gondolaRuns = [-19.6, -15.6, -11.6, -7.6, -3.6, 0.4, 4.4, 8.4];
  const gondolaRows = [-0.2, 1.8, 3.8, 5.8];
  const checkouts = [-16, -12.5, -9, 9, 12.5, 16];
  const obstacles = [
    // Cold store and stock room: racking on the walls, a clear lane from dock door to corridor.
    ...alongWall("market-cold-rack-west", "storage-rack", "west", -24, [-12.9, -9.3]),
    ...alongWall("market-cold-rack-north", "storage-rack", "north", -15, [-19.5, -16.1]),
    ...presetObstacles("market-cold-pallets", [["pallet-stack", -17.5, -10.2], ["pallet-stack", -15.5, -10.2]]),
    ...alongWall("market-stock-rack-north", "storage-rack", "north", -15, [-9.5, 2.5]),
    onWall("market-stock-rack-west", "storage-rack", "west", -12, -11, t),
    ...presetObstacles("market-stock", [
      ["pallet-stack", -7, -10.5], ["pallet-stack", -7, -8.9], ["crate-stack", 3.5, -10.8], ["packing-table", 2.8, -8.3]
    ]),
    // Freight lift, server room and cash room.
    presetObstacle("market-freight-lift", "elevator", 7.75, -9.6),
    onWall("market-server-rack", "equipment-rack", "north", -15, 8.8),
    onWall("market-server-ups", "ups-unit", "north", -15, 7.6),
    onWall("market-cash-desk", "office-desk", "east", 16, -11, t),
    presetObstacle("market-cash-chair", "office-chair", 14.75, -11, 270),
    onWall("market-cash-safe", "tool-cabinet", "north", -15, 13.5),
    onWall("market-cash-filing", "filing-cabinet", "north", -15, 11),
    // Staff lockers.
    onWall("market-locker-east", "locker-row", "east", 24, -11),
    onWall("market-locker-north", "locker-row", "north", -15, 19.5),
    presetObstacle("market-locker-bench", "waiting-bench", 19.5, -11, 90),
    // Sales floor: chilled wall, ambient wall shelving, gondola runs and produce.
    ...alongWall("market-dairy-west", "display-fridge", "north", -5, [-21.5, -20.3, -19.1, -17.9, -16.7], t),
    ...alongWall("market-dairy-centre", "display-fridge", "north", -5, [-4.4, -3.2, -2, -0.8, 0.4, 1.6, 2.8], t),
    ...alongWall("market-dairy-east", "display-fridge", "north", -5, [10.4, 11.6, 12.8, 14], t),
    ...alongWall("market-frozen-east", "display-fridge", "east", 24, [-3.5, -2.3, -1.1, 0.1, 1.3]),
    ...alongWall("market-wall-shelf-west", "shelving-unit", "west", -24, [-2.5, -0.5, 1.5, 3.5, 5.5]),
    ...gondolaRuns.flatMap((x, run) => gondolaRows.flatMap((z, row) => [
      presetObstacle(`market-gondola-${run + 1}-${row + 1}-west`, "shelving-unit", x - 0.3, z, 90),
      presetObstacle(`market-gondola-${run + 1}-${row + 1}-east`, "shelving-unit", x + 0.3, z, 270)
    ])),
    ...presetObstacles("market-produce", [
      ["display-stand", 13.5, 0.5], ["display-stand", 16.5, 0.5], ["display-stand", 13.5, 3.5], ["display-stand", 16.5, 3.5]
    ]),
    // High-value shelf beside the last till, visible from the cashiers.
    ...alongWall("market-high-value", "shelving-unit", "east", 24, [8, 10]),
    presetObstacle("market-high-value-stand", "display-stand", 20.6, 9),
    // Checkout line in front of the vestibule; each cashier faces the lane.
    ...checkouts.flatMap((x, index) => [
      presetObstacle(`market-checkout-${index + 1}`, "checkout-counter", x, 9.6, 90),
      presetObstacle(`market-cashier-${index + 1}`, "office-chair", x + 0.85, 9.6, 90)
    ]),
    // Vestibule separating the in and out lanes.
    presetObstacle("market-entry-divider", "queue-barrier", 0, 12.7, 90),
    onWall("market-entry-vending", "vending-machine", "west", -5, 13.6, t),
    // Service yard with a truck reversed onto the dock.
    presetObstacle("market-dock-platform", "loading-platform", -3, -16.3),
    presetObstacle("market-dock-truck", "truck", -3, -21.75, 270),
    sizedPreset("market-service-road", "road", -3, -21, 9, 10),
    ...presetObstacles("market-yard-lights", [["light-pole", -12, -17], ["light-pole", 6, -17]]),
    // Customer and staff parking on the street side.
    ...parkingRow("market-parking-west", ["sedan", "suv", "sedan", "pickup", "sedan"], [-20, -17, -14, -11, -8], 20, "north"),
    ...parkingRow("market-parking-east", ["sedan", "sedan", "suv", "van", "sedan"], [8, 11, 14, 17, 20], 20, "north"),
    ...[-20, -17, -14, -11, -8, 8, 11, 14, 17, 20].map((x, index) => presetObstacle(`market-wheel-stop-${index + 1}`, "wheel-stop", x, 17)),
    sizedPreset("market-parking-aisle", "road", 0, 25.5, 50, 5),
    ...presetObstacles("market-frontage-lights", [["light-pole", -23, 17.5], ["light-pole", 23, 17.5]])
  ];
  const ground = floor("market-ground", "فروشگاه، صندوق‌ها و پشتیبانی", 0, walls, doors, obstacles, 4.6);
  ground.coverageRequirements = [
    zone("market-checkout-zone", "supermarket.checkout-line", "خط صندوق‌ها", -17.2, 8.4, 17.2, 10.45),
    zone("market-high-value-zone", "supermarket.highvalue", "قفسه اقلام گران کنار صندوق", 19.6, 6.6, 23.9, 11.4),
    zone("market-dock-zone", "supermarket.dock", "بارانداز و محوطه تخلیه", -10, -21, -0.5, -15.8),
    zone("market-parking-west-zone", "shared.staff-parking", "پارکینگ مشتریان و کارکنان غربی", -22, 16.6, -6, 23),
    zone("market-parking-east-zone", "shared.staff-parking", "پارکینگ مشتریان و کارکنان شرقی", 6, 16.6, 22, 23)
  ];
  return building([ground]);
}

/**
 * A jewellery / exchange branch: glazed street front to the south, secure band behind.
 *
 * A continuous counter line divides the customer hall from the staff side; glass screens
 * close both ends and the only way through is a staff gate. Staff face customers across
 * the counters with the wall vitrines behind them, a guard desk watches the security
 * airlock, and the vault, server room and monitoring office open only from the staff side.
 * The plan is intentionally generic and does not reproduce a real protected site.
 */
function secureJewelleryBranchPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const h = 3.6;
  const walls = [
    ...rectangle("jewellery-shell", -12, -8, 12, 8, h),
    partition("jewellery-secure-spine", -12, -3, 12, -3, h),
    partition("jewellery-exit-corridor", -9.5, -8, -9.5, -3, h),
    partition("jewellery-vault-wall", 4, -8, 4, -3, h),
    partition("jewellery-server-west", 1, -8, 1, -5, h),
    partition("jewellery-server-front", 1, -5, 4, -5, h),
    glassPartition("jewellery-counter-screen-west", -12, 0, -9.6, 0, 2.4),
    glassPartition("jewellery-counter-screen-east", 9.6, 0, 12, 0, 2.4),
    glassPartition("jewellery-entry-west", -3, 5, -3, 8, 3),
    glassPartition("jewellery-entry-east", 3, 5, 3, 8, 3),
    glassPartition("jewellery-entry-inner", -3, 5, 3, 5, 3)
  ];
  const doors: PlanDoor[] = [
    { ...door("jewellery-main-entry", "jewellery-shell-south", 0.5, 1.8), variant: "double-glass", swingDirection: "inward" },
    { ...door("jewellery-inner-security-door", "jewellery-entry-inner", 0.5, 1.2), variant: "single-glass", swingDirection: "inward" },
    { ...door("jewellery-staff-gate", "jewellery-counter-screen-east", 0.5, 1), variant: "single-glass" },
    door("jewellery-exit-corridor-door", "jewellery-secure-spine", 0.0521, 1),
    door("jewellery-staff-door", "jewellery-secure-spine", 0.3333, 1),
    door("jewellery-vault-door", "jewellery-secure-spine", 0.8333, 1),
    door("jewellery-server-door", "jewellery-server-front", 0.5, 0.9),
    { ...door("jewellery-emergency-exit", "jewellery-shell-north", 0.0521, 1), swingDirection: "outward" },
    windowOpening("jewellery-show-window-a", "jewellery-shell-south", 0.2, 2.5),
    windowOpening("jewellery-show-window-b", "jewellery-shell-south", 0.8, 2.5)
  ];
  const seatXs = [-8, -4.8, -1.6, 1.6, 4.8, 8];
  const obstacles = [
    // Counter line with staff seated behind it and customer chairs in front.
    ...Array.from({ length: 12 }, (_, index) => presetObstacle(`jewellery-counter-${index + 1}`, "checkout-counter", -8.8 + index * 1.6, 0)),
    ...seatXs.map((x, index) => presetObstacle(`jewellery-staff-chair-${index + 1}`, "office-chair", x, -0.95, 0)),
    ...seatXs.map((x, index) => presetObstacle(`jewellery-customer-chair-${index + 1}`, "dining-chair", x, 0.95, 180)),
    // Wall vitrines behind the staff, kept clear of the three secure doors.
    ...alongWall("jewellery-wall-vitrine", "shelving-unit", "north", -3, [-8.6, -6.4, -2, 0.2, 2.4, 4.6, 10.4], t),
    // Customer side: window displays, waiting bench and the guard desk facing the airlock.
    ...presetObstacles("jewellery-window-display", [["display-stand", -7.2, 6.95], ["display-stand", 7.2, 6.95]]),
    onWall("jewellery-waiting-bench", "waiting-bench", "west", -12, 3.5),
    presetObstacle("jewellery-guard-desk", "service-counter", 6.6, 3.6),
    presetObstacle("jewellery-guard-chair", "office-chair", 6.6, 2.7, 0),
    // Security airlock lanes.
    ...presetObstacles("jewellery-airlock", [["queue-barrier", -1.8, 6.4, 90], ["queue-barrier", 1.8, 6.4, 90]]),
    // Monitoring office.
    onWall("jewellery-office-desk", "office-desk", "west", -9.5, -6, t),
    presetObstacle("jewellery-office-chair", "office-chair", -8.3, -6, 90),
    onWall("jewellery-monitoring", "monitoring-console", "north", -8, -4.5),
    presetObstacle("jewellery-monitoring-chair", "office-chair", -4.5, -6.4, 180),
    onWall("jewellery-office-filing", "filing-cabinet", "east", 1, -7, t),
    // Server room.
    onWall("jewellery-server-rack", "equipment-rack", "north", -8, 3.2),
    onWall("jewellery-server-ups", "ups-unit", "north", -8, 2),
    // Vault.
    onWall("jewellery-vault-rack", "storage-rack", "north", -8, 8),
    onWall("jewellery-vault-safe", "tool-cabinet", "east", 12, -5.5),
    onWall("jewellery-vault-filing", "filing-cabinet", "west", 4, -6.5, t),
    // Street frontage.
    sizedPreset("jewellery-street-road", "road", 0, 12.5, 28, 3.6),
    ...presetObstacles("jewellery-street", [
      ["bollard", -8, 8.9], ["bollard", -5, 8.9], ["bollard", 5, 8.9], ["bollard", 8, 8.9], ["light-pole", 10.5, 9.6]
    ])
  ];
  const ground = floor("jewellery-ground", "شعبه فروش، خزانه و کنترل ورودی", 0, walls, doors, obstacles, 3.8);
  ground.coverageRequirements = [
    zone("jewellery-street-zone", "jewellery.street", "نمای بیرونی و پیاده‌رو", -12, 8.15, 12, 10.6),
    zone("jewellery-wall-vitrine-zone", "jewellery.display", "ویترین‌های دیواری پشت پیشخوان", -10.2, -2.92, 11.9, -2.15),
    zone("jewellery-window-west-zone", "jewellery.display", "ویترین جلوی شیشه غربی", -8.6, 6.2, -5.8, 7.9),
    zone("jewellery-window-east-zone", "jewellery.display", "ویترین جلوی شیشه شرقی", 5.8, 6.2, 8.6, 7.9),
    zone("jewellery-counter-zone", "jewellery.counter", "خط پیشخوان معامله", -9.6, -0.5, 9.6, 0.5)
  ];
  return building([ground]);
}

/**
 * A single-storey production workshop inside a fenced yard.
 *
 * Trucks reach the warehouse dock and the production hall from the service yard to the
 * north, through a guarded vehicle gate; staff walk in from the street on the south side
 * where their parking is. The electrical room, server room and office form a rear band,
 * and hazardous materials are kept in their own corner of the yard.
 */
function compactIndustrialWorkshopPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const h = 5.4;
  const walls = [
    ...rectangle("compact-factory-shell", -22, -14, 22, 14, h),
    partition("compact-factory-warehouse", -8, -14, -8, 14, h),
    partition("compact-factory-rear", -8, 6, 22, 6, h),
    partition("compact-factory-electrical-split", 1, 6, 1, 14, 4),
    partition("compact-factory-service-split", 6, 6, 6, 14, 4)
  ];
  const openings: PlanDoor[] = [
    { ...door("compact-factory-vehicle-entry", "compact-factory-shell-north", 0.65, 4.5), variant: "double-solid", swingDirection: "inward" },
    { ...door("compact-factory-dock-door", "compact-factory-shell-north", 0.1591, 4), variant: "double-solid", swingDirection: "outward" },
    { ...door("compact-factory-staff-entry", "compact-factory-shell-south", 0.15, 1.5), swingDirection: "inward" },
    { ...door("compact-factory-warehouse-door", "compact-factory-warehouse", 0.5, 3), variant: "double-solid" },
    door("compact-factory-electrical-door", "compact-factory-rear", 0.15, 1.2),
    door("compact-factory-server-door", "compact-factory-rear", 0.3833, 0.9),
    door("compact-factory-admin-door", "compact-factory-rear", 0.6667, 1.2),
    windowOpening("compact-factory-hall-window-north", "compact-factory-shell-north", 0.82, 2.8),
    windowOpening("compact-factory-hall-window-east", "compact-factory-shell-east", 0.28, 3),
    windowOpening("compact-factory-office-window-east", "compact-factory-shell-east", 0.8571, 2.2),
    windowOpening("compact-factory-office-window-south", "compact-factory-shell-south", 0.2955, 2)
  ];
  const obstacles = [
    // Production hall: three conveyor lines, machining cells, welding and a tool cabinet.
    ...presetObstacles("compact-factory-production", [
      ["conveyor", -1, -9], ["conveyor", -1, -4], ["conveyor", -1, 1],
      ["cnc-machine", 8, -9], ["cnc-machine", 15, -9], ["cnc-machine", 8, -3],
      ["workbench", 16, -2], ["workbench", 8, 3], ["welding-station", 16, 3]
    ]),
    onWall("compact-factory-tool-cabinet", "tool-cabinet", "east", 22, -11),
    // Warehouse: racking on the west wall, pallets staged by the production door.
    ...alongWall("compact-factory-rack", "storage-rack", "west", -22, [-9.5, -4.5, 3, 8]),
    ...presetObstacles("compact-factory-warehouse-assets", [
      ["pallet-stack", -13, -6], ["pallet-stack", -13, -3], ["crate-stack", -13, 4], ["packing-table", -13, 9]
    ]),
    // Electrical room, server room and office in the rear band.
    ...alongWall("compact-factory-switchboard", "tool-cabinet", "south", 14, [-6, -4.4, -2.8]),
    ...alongWall("compact-factory-server-rack", "equipment-rack", "south", 14, [2.2, 3.4]),
    onWall("compact-factory-server-ups", "ups-unit", "south", 14, 4.6),
    onWall("compact-factory-office-desk", "office-desk", "east", 22, 10),
    presetObstacle("compact-factory-office-chair", "office-chair", 20.75, 10, 270),
    presetObstacle("compact-factory-reception", "reception-desk", 13, 10.2),
    presetObstacle("compact-factory-reception-chair", "office-chair", 13, 9.3, 0),
    onWall("compact-factory-office-filing", "filing-cabinet", "north", 6, 18, t),
    onWall("compact-factory-staff-lockers", "locker-row", "west", 6, 10, t),
    // Service yard: dock platform with a truck backed onto it, vehicle gate and guard booth.
    presetObstacle("compact-factory-dock-platform", "loading-platform", -15, -15.2),
    presetObstacle("compact-factory-dock-truck", "truck", -15, -20.6, 270),
    sizedPreset("compact-factory-yard-surface", "road", 0, -21, 44, 10),
    presetObstacle("compact-factory-yard-pickup", "pickup", -6, -24, 0),
    presetObstacle("compact-factory-gate", "gate-sliding", 6.6, -28),
    sizedPreset("compact-factory-gate-approach", "road", 6.6, -30.5, 6, 5),
    presetObstacle("compact-factory-guard-booth", "guard-booth", 12, -25.5),
    // Hazardous materials store in the north-east corner of the yard.
    { ...sizedPreset("compact-factory-chemical-tank", "chemical-tank", 19.5, -24.5, 3, 2), label: "مخزن مواد شیمیایی", heightM: 2.2 },
    // Mesh perimeter fence with the vehicle gate north and the staff gate south.
    sizedPreset("compact-factory-fence-north-west", "fence-mesh", -9.95, -28, 28.1, 0.1),
    sizedPreset("compact-factory-fence-north-east", "fence-mesh", 16.55, -28, 14.9, 0.1),
    sizedPreset("compact-factory-fence-west", "fence-mesh", -24, -7, 42, 0.1, 90),
    sizedPreset("compact-factory-fence-east", "fence-mesh", 24, -7, 42, 0.1, 90),
    sizedPreset("compact-factory-fence-south-west", "fence-mesh", -4.8, 16, 38.4, 0.1),
    sizedPreset("compact-factory-fence-south-east", "fence-mesh", 20.2, 16, 7.6, 0.1),
    ...presetObstacles("compact-factory-site-poles", [["camera-pole", -23, -27], ["light-pole", 23, -15], ["light-pole", -23, 15]]),
    // Staff parking on the street outside the south fence.
    ...parkingRow("compact-factory-staff-car", ["sedan", "suv", "sedan", "pickup", "sedan"], [-18, -15.3, -12.6, -9.9, -7.2, 2, 4.7, 7.4], 20, "north"),
    sizedPreset("compact-factory-street", "road", 0, 25, 48, 4)
  ];
  const ground = floor("compact-factory-ground", "کارگاه تولید، انبار و محوطه خدماتی", 0, walls, openings, obstacles, 5.6);
  ground.coverageRequirements = [
    zone("compact-factory-gate-zone", "industrial.vehicle-gate", "گیت ورود خودرو", 3.5, -29.8, 9.7, -25.6),
    zone("compact-factory-dock-zone", "industrial.dock", "بارانداز انبار", -18.5, -22, -11.5, -16.4),
    zone("compact-factory-staff-entry-zone", "industrial.staff-entrance", "ورود پرسنل", 13.5, 14.2, 17.3, 15.9),
    zone("compact-factory-perimeter-zone", "industrial.perimeter", "حصار شمالی محوطه", -22, -27.8, 2, -26.2),
    zone("compact-factory-hazard-zone", "industrial.hazard", "مخزن مواد شیمیایی", 16, -27.5, 23, -21.5),
    zone("compact-factory-parking-zone", "shared.staff-parking", "پارکینگ کارکنان", -19.5, 17.4, 9, 22.6)
  ];
  return building([ground]);
}

/**
 * A single public parking deck with separate entry and exit ramps on the street side.
 *
 * Cars park nose-in along the north wall and back-to-back on a central island, with a
 * driving aisle either side. The east service band holds the control and cash room, a
 * server room, a pedestrian lobby with its own street door, and the stair and lift.
 */
function urbanPublicParkingPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const h = 3.2;
  const walls = [
    ...rectangle("public-parking-shell", -24, -14, 24, 14, h),
    partition("public-parking-service", 16, -14, 16, 14, h),
    partition("public-parking-server-wall", 16, -6, 24, -6, h),
    partition("public-parking-lobby-wall", 16, -2, 24, -2, h),
    partition("public-parking-core-wall", 16, 6, 24, 6, h),
    partition("public-parking-core-split", 20, 6, 20, 14, h)
  ];
  const openings: PlanDoor[] = [
    { ...door("public-parking-entry-ramp", "public-parking-shell-south", 0.75, 5), variant: "double-solid", swingDirection: "inward" },
    { ...door("public-parking-exit-ramp", "public-parking-shell-south", 0.3333, 5), variant: "double-solid", swingDirection: "outward" },
    door("public-parking-control-door", "public-parking-service", 0.1429, 1.1),
    door("public-parking-pedestrian-door", "public-parking-service", 0.5714, 1.6),
    { ...door("public-parking-street-door", "public-parking-shell-east", 0.5714, 1.4), variant: "single-glass" },
    door("public-parking-server-door", "public-parking-server-wall", 0.5, 0.9),
    door("public-parking-stair-door", "public-parking-core-wall", 0.25, 1),
    door("public-parking-lift-door", "public-parking-core-wall", 0.75, 1.2),
    windowOpening("public-parking-control-window", "public-parking-shell-east", 0.0536, 2),
    windowOpening("public-parking-vent-west-a", "public-parking-shell-west", 0.3, 2.8),
    windowOpening("public-parking-vent-west-b", "public-parking-shell-west", 0.7, 2.8)
  ];
  const northBays = [-21.5, -18.8, -16.1, -13.4, -10.7, -8, -5.3, -2.6, 0.1, 2.8, 5.5, 8.2, 10.9, 13.6];
  const islandBays = [-20, -17.3, -14.6, -11.9, -9.2, -6.5, -3.8, -1.1, 1.6, 4.3, 7, 9.7, 12.4];
  const obstacles = [
    ...parkingRow("public-parking-bay-north", ["sedan", "suv", "sedan"], northBays, -11.2, "north"),
    ...northBays.map((x, index) => presetObstacle(`public-parking-wheel-stop-${index + 1}`, "wheel-stop", x, -13.72)),
    ...parkingRow("public-parking-bay-island-north", ["suv", "sedan", "pickup", "sedan"], islandBays, -0.4, "north"),
    ...parkingRow("public-parking-bay-island-south", ["sedan", "suv", "sedan"], islandBays, 4.6, "south"),
    ...presetObstacles("public-parking-ramps", [
      ["parking-barrier", -12, 12.6], ["parking-barrier", 8, 12.6],
      ["speed-bump", -12, 10.5], ["speed-bump", 8, 10.5],
      ["bollard", 15.3, 0.6], ["bollard", 15.3, 3.4]
    ]),
    sizedPreset("public-parking-entry-road", "road", -12, 17, 6, 6),
    sizedPreset("public-parking-exit-road", "road", 8, 17, 6, 6),
    sizedPreset("public-parking-street", "road", 0, 22, 52, 4),
    // Control and cash room.
    onWall("public-parking-console", "monitoring-console", "east", 24, -10),
    presetObstacle("public-parking-console-chair", "office-chair", 22.3, -10, 270),
    onWall("public-parking-cash-desk", "office-desk", "north", -14, 19),
    presetObstacle("public-parking-cash-chair", "office-chair", 19, -12.6, 180),
    onWall("public-parking-filing", "filing-cabinet", "west", 16, -7.5, t),
    // Server room.
    onWall("public-parking-rack", "equipment-rack", "east", 24, -4),
    onWall("public-parking-ups", "ups-unit", "north", -6, 21.8, t),
    // Pedestrian lobby with bench and pay station.
    onWall("public-parking-bench", "waiting-bench", "north", -2, 20, t),
    onWall("public-parking-pay-station", "vending-machine", "east", 24, -0.6),
    presetObstacle("public-parking-stairs", "stairs-straight", 18, 10, 90),
    presetObstacle("public-parking-elevator", "elevator", 22, 10)
  ];
  const ground = floor("public-parking-ground", "پارکینگ عمومی، رمپ‌ها و کنترل", 0, walls, openings, obstacles, 3.3);
  ground.coverageRequirements = [
    zone("public-parking-entry-zone", "parking.entry-ramp", "رمپ ورود و راهبند", -14.5, 10.2, -9.5, 13.8),
    zone("public-parking-exit-zone", "parking.exit-ramp", "رمپ خروج و راهبند", 5.5, 10.2, 10.5, 13.8)
  ];
  return building([ground]);
}

/**
 * A neighbourhood restaurant: dining on the street side, kitchen and food store behind.
 *
 * The kitchen works along its walls (one cooking line, fridges together) and has its
 * own back door to the bin area. Guests walk a clear central aisle from the door to the
 * serving pass; the till stands beside the entrance with the cashier facing it.
 */
function neighbourhoodRestaurantPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const h = 3.6;
  const walls = [
    ...rectangle("restaurant-shell", -14, -10, 14, 10, h),
    partition("restaurant-service-spine", -14, -3, 14, -3, h),
    partition("restaurant-store-split", 5, -10, 5, -3, h),
    partition("restaurant-wc-west", 10.5, -3, 10.5, 1.5, h),
    partition("restaurant-wc-north", 10.5, 1.5, 14, 1.5, h)
  ];
  const openings: PlanDoor[] = [
    { ...door("restaurant-customer-entry", "restaurant-shell-south", 0.5, 2), variant: "double-glass", swingDirection: "inward" },
    door("restaurant-kitchen-door", "restaurant-service-spine", 0.3, 1.3),
    door("restaurant-store-door", "restaurant-service-spine", 0.78, 1.1),
    door("restaurant-wc-door", "restaurant-wc-west", 0.7, 0.9),
    { ...door("restaurant-backdoor", "restaurant-shell-north", 0.5893, 1.2), swingDirection: "outward" },
    windowOpening("restaurant-front-window-a", "restaurant-shell-south", 0.2, 2.6),
    windowOpening("restaurant-front-window-b", "restaurant-shell-south", 0.8, 2.6),
    windowOpening("restaurant-side-window-east", "restaurant-shell-east", 0.7, 2.2),
    windowOpening("restaurant-side-window-west", "restaurant-shell-west", 0.35, 2.2)
  ];
  const diningTables = [
    [-8.5, 0], [-3.5, 0], [3.5, 0], [8, 0],
    [-8.5, 3.8], [-3.5, 3.8], [3.5, 3.8], [8, 3.8],
    [-8.5, 7.4], [-3.5, 7.4], [8, 7.4]
  ] as const;
  const obstacles = [
    // Dining hall.
    ...diningTables.flatMap(([x, z], index) => [
      presetObstacle(`restaurant-table-${index + 1}`, "dining-table", x, z),
      ...tableChairs(`restaurant-chairs-${index + 1}`, x, z, 0, "dining-chair")
    ]),
    onWall("restaurant-serving-pass", "service-counter", "north", -3, 1, t),
    presetObstacle("restaurant-checkout", "checkout-counter", 5.5, 7.8, 90),
    presetObstacle("restaurant-cashier-chair", "office-chair", 6.4, 7.8, 90),
    onWall("restaurant-waiting-bench", "waiting-bench", "south", 10, -4),
    // Kitchen: one cooking line on the north wall, fridges on the west wall.
    onWall("restaurant-counter-a", "kitchen-counter", "north", -10, -9.2),
    onWall("restaurant-sink", "sink-unit", "north", -10, -7.55),
    onWall("restaurant-dishwasher", "dishwasher", "north", -10, -6.8),
    onWall("restaurant-counter-b", "kitchen-counter", "north", -10, -5.3),
    onWall("restaurant-stove-a", "stove", "north", -10, -3.8),
    onWall("restaurant-stove-b", "stove", "north", -10, -3.2),
    onWall("restaurant-counter-c", "kitchen-counter", "north", -10, -1.7),
    ...alongWall("restaurant-fridge", "fridge", "west", -14, [-8.4, -7.4]),
    ...presetObstacles("restaurant-prep", [["kitchen-island", -5.5, -6.2], ["kitchen-island", -1.5, -6.2]]),
    // Food store.
    onWall("restaurant-store-rack-north", "storage-rack", "north", -10, 9.5),
    onWall("restaurant-store-rack-east", "storage-rack", "east", 14, -6.3),
    onWall("restaurant-store-cold", "display-fridge", "west", 5, -8.5, t),
    presetObstacle("restaurant-store-crates", "crate-stack", 9, -5),
    // Guest WC (privacy area).
    onWall("restaurant-wc-basin", "sink-unit", "east", 14, -1.5),
    // Bin store outside the kitchen back door, street frontage in front.
    obstacle("restaurant-bins", "سطل‌های زباله", "block", 4.2, -11.2, 1.6, 0.8, 1.2),
    sizedPreset("restaurant-street", "road", 0, 13.6, 30, 3.6),
    presetObstacle("restaurant-street-light", "light-pole", -11, 11)
  ];
  const ground = floor("restaurant-ground", "سالن پذیرایی، آشپزخانه و انبار", 0, walls, openings, obstacles, 3.8);
  ground.coverageRequirements = [
    zone("restaurant-entrance-zone", "restaurant.entrance", "ورودی مشتری", -2, 8.2, 2, 9.9),
    zone("restaurant-checkout-zone", "restaurant.checkout", "صندوق و پرداخت", 4.4, 6.6, 7.1, 9),
    zone("restaurant-backdoor-zone", "restaurant.backdoor", "درِ پشتی و محل زباله", 0.3, -12.8, 5.4, -10.15),
    zone("restaurant-takeaway-zone", "restaurant.takeaway", "تحویل بیرون‌بر و پیک", 2.5, 10.15, 8, 12.2)
  ];
  return building([ground]);
}

/**
 * A small one-storey primary school: six rooms around a central corridor in fenced grounds.
 *
 * Each classroom faces a board on a solid wall, with emergency exits at both corridor
 * ends. The lobby counter faces the main door and the server room opens off the lobby.
 * Outside, a path runs from the guarded gate to the door between the play yard and staff
 * parking, and parents collect children at the kerb outside the gate.
 */
function primarySchoolPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const h = 3.6;
  const walls = [
    ...rectangle("primary-school-shell", -24, -14, 24, 14, h),
    partition("primary-school-corridor-north", -24, -2, 24, -2, h),
    partition("primary-school-corridor-south", -24, 2, 24, 2, h),
    partition("primary-school-north-west", -8, -14, -8, -2, h),
    partition("primary-school-north-east", 8, -14, 8, -2, h),
    partition("primary-school-south-west", -8, 2, -8, 14, h),
    partition("primary-school-south-east", 8, 2, 8, 14, h),
    partition("primary-school-server-west", 4, 9, 4, 14, h),
    partition("primary-school-server-north", 4, 9, 8, 9, h)
  ];
  const openings: PlanDoor[] = [
    { ...door("primary-school-main-entry", "primary-school-shell-south", 0.5, 2.4), variant: "double-glass", swingDirection: "inward" },
    door("primary-school-lobby-door", "primary-school-corridor-south", 0.5, 1.8),
    door("primary-school-class-a", "primary-school-corridor-north", 0.16, 1.2),
    door("primary-school-class-b", "primary-school-corridor-north", 0.5, 1.2),
    door("primary-school-lab-door", "primary-school-corridor-north", 0.84, 1.2),
    door("primary-school-class-c", "primary-school-corridor-south", 0.16, 1.2),
    door("primary-school-class-d", "primary-school-corridor-south", 0.84, 1.2),
    door("primary-school-server-door", "primary-school-server-west", 0.5, 0.9),
    { ...door("primary-school-emergency-exit-east", "primary-school-shell-east", 0.5, 1.6), swingDirection: "outward" },
    { ...door("primary-school-emergency-exit-west", "primary-school-shell-west", 0.5, 1.6), swingDirection: "outward" },
    ...[0.0625, 0.2708, 0.3958, 0.6042, 0.7708, 0.9375].map((offset, index) =>
      windowOpening(`primary-school-window-north-${index + 1}`, "primary-school-shell-north", offset, 2.4)),
    windowOpening("primary-school-window-south-a", "primary-school-shell-south", 0.2, 3),
    windowOpening("primary-school-window-south-b", "primary-school-shell-south", 0.8, 3)
  ];
  const obstacles = [
    // North classrooms and lab: board on the north wall between the windows.
    ...[-16, 0].flatMap((cx, room) => [
      ...gridPresets(`primary-school-desks-${room + 1}`, ["student-desk"], [cx - 4, cx, cx + 4], [-10, -6]),
      onWall(`primary-school-board-${room + 1}`, "whiteboard", "north", -14, cx)
    ]),
    ...gridPresets("primary-school-lab", ["lab-bench"], [12, 16, 20], [-10, -6]),
    onWall("primary-school-lab-board", "whiteboard", "north", -14, 16),
    // South classrooms: board on the end wall, desks turned to face it.
    ...gridPresets("primary-school-desks-3", ["student-desk"], [-20, -16, -12], [6, 10], 90),
    onWall("primary-school-board-3", "whiteboard", "west", -24, 8),
    ...gridPresets("primary-school-desks-4", ["student-desk"], [12, 16, 20], [6, 10], 90),
    onWall("primary-school-board-4", "whiteboard", "east", 24, 8),
    // Lobby counter facing the main door, benches and the server room.
    presetObstacle("primary-school-counter", "service-counter", -2.5, 6.5),
    presetObstacle("primary-school-counter-chair", "office-chair", -2.5, 5.6, 0),
    ...alongWall("primary-school-lobby-bench", "waiting-bench", "west", -8, [8, 11], t),
    onWall("primary-school-server-rack", "equipment-rack", "east", 8, 12.5, t),
    onWall("primary-school-server-ups", "ups-unit", "east", 8, 11.3, t),
    // Grounds: fenced, gate and guard booth, path, play yard and staff parking.
    sizedPreset("primary-school-fence-north", "fence-mesh", 0, -16, 52, 0.1),
    sizedPreset("primary-school-fence-west", "fence-mesh", -26, 5.5, 43, 0.1, 90),
    sizedPreset("primary-school-fence-east", "fence-mesh", 26, 5.5, 43, 0.1, 90),
    sizedPreset("primary-school-fence-south-west", "fence-mesh", -14.25, 27, 23.5, 0.1),
    sizedPreset("primary-school-fence-south-east", "fence-mesh", 14.25, 27, 23.5, 0.1),
    presetObstacle("primary-school-gate", "gate-sliding", 0, 27),
    presetObstacle("primary-school-guard-booth", "guard-booth", -6, 25),
    sizedPreset("primary-school-path", "road", 0, 20.5, 4, 13),
    sizedPreset("primary-school-play-yard", "grass", -13, 20.5, 18, 11),
    ...presetObstacles("primary-school-yard", [
      ["waiting-bench", -15, 17.5], ["waiting-bench", -10, 17.5], ["deciduous", -21, 23]
    ]),
    ...parkingRow("primary-school-staff-car", ["sedan", "suv", "sedan"], [6, 8.7, 11.4, 14.1, 16.8, 19.5], 19.5, "north"),
    sizedPreset("primary-school-parking-aisle", "road", 13, 24, 18, 4),
    ...presetObstacles("primary-school-poles", [["light-pole", 23, 24.5], ["light-pole", -23, -15]]),
    sizedPreset("primary-school-street", "road", 0, 31, 56, 4)
  ];
  const ground = floor("primary-school-ground", "مدرسه ابتدایی، کلاس‌ها و حیاط", 0, walls, openings, obstacles, 3.8);
  ground.coverageRequirements = [
    zone("primary-school-exit-east-zone", "shared.stairwell", "خروج اضطراری شرقی راهرو", 21, -1.9, 23.9, 1.9),
    zone("primary-school-exit-west-zone", "shared.stairwell", "خروج اضطراری غربی راهرو", -23.9, -1.9, -21, 1.9),
    zone("primary-school-entrance-zone", "school.main-entrance", "درِ ورودی اصلی", -3, 14.2, 3, 17),
    zone("primary-school-yard-zone", "school.yard", "حیاط و زمین بازی", -21, 16, -4, 25),
    zone("primary-school-pickup-zone", "school.pickup", "محل تحویل دانش‌آموز کنار درِ مدرسه", -8, 27.3, 8, 29),
    zone("primary-school-parking-zone", "shared.staff-parking", "پارکینگ کارکنان", 4, 16.8, 22, 22.2),
    zone("primary-school-perimeter-west-zone", "school.perimeter", "پیرامون پشت مدرسه، غرب", -24, -15.8, 0, -14.3),
    zone("primary-school-perimeter-east-zone", "school.perimeter", "پیرامون پشت مدرسه، شرق", 0, -15.8, 24, -14.3)
  ];
  return building([ground]);
}

/** A compact outpatient clinic, not a full hospital campus. */
function outpatientClinicPlan(): BuildingPlan {
  const walls = [
    ...rectangle("clinic-shell", -20, -12, 20, 12, 3.6),
    partition("clinic-corridor-north", -20, -2, 20, -2, 3.6),
    partition("clinic-corridor-south", -20, 2, 20, 2, 3.6),
    partition("clinic-north-west", -7, -12, -7, -2, 3.6),
    partition("clinic-north-east", 7, -12, 7, -2, 3.6),
    partition("clinic-south-west", -7, 2, -7, 12, 3.6),
    partition("clinic-south-east", 7, 2, 7, 12, 3.6),
    partition("clinic-server-west", 3, 8, 3, 12, 3.6),
    partition("clinic-server-north", 3, 8, 7, 8, 3.6),
    partition("clinic-lift-wall", 16, -2, 16, 2, 3.6)
  ];
  const openings: PlanDoor[] = [
    { ...door("clinic-main-entry", "clinic-shell-south", 0.5, 2.4), variant: "double-glass", swingDirection: "inward" },
    { ...door("clinic-emergency-entry", "clinic-shell-south", 0.83, 2), variant: "double-glass", swingDirection: "inward" },
    door("clinic-reception-door", "clinic-corridor-south", 0.5, 1.8),
    door("clinic-emergency-door", "clinic-corridor-south", 0.16, 1.5),
    door("clinic-pharmacy-door", "clinic-corridor-south", 0.84, 1.2),
    door("clinic-exam-a-door", "clinic-corridor-north", 0.16, 1.2),
    door("clinic-exam-b-door", "clinic-corridor-north", 0.5, 1.2),
    door("clinic-exam-c-door", "clinic-corridor-north", 0.84, 1.2),
    door("clinic-server-door", "clinic-server-west", 0.5, 0.9),
    door("clinic-lift-door", "clinic-lift-wall", 0.5, 1.2),
    windowOpening("clinic-window-north-a", "clinic-shell-north", 0.17, 2.4),
    windowOpening("clinic-window-north-b", "clinic-shell-north", 0.5, 2.4),
    windowOpening("clinic-window-north-c", "clinic-shell-north", 0.83, 2.4),
    windowOpening("clinic-window-east", "clinic-shell-east", 0.35, 2.2),
    windowOpening("clinic-window-west", "clinic-shell-west", 0.35, 2.2)
  ];
  const obstacles = [
    ...presetObstacles("clinic-emergency", [
      ["stretcher", -15, 7], ["stretcher", -10, 7], ["nurse-station", -10, 4],
      ["medical-cart", -18, 10], ["privacy-screen", -8, 9, 90]
    ]),
    // Reception faces the main door and leaves a clear walk to the corridor.
    ...presetObstacles("clinic-reception", [
      ["reception-desk", -3.5, 7.5], ["office-chair", -3.5, 6.6, 0], ["waiting-bench", -4, 4.5], ["waiting-bench", 4, 4.5]
    ]),
    onWall("clinic-server-rack", "equipment-rack", "east", 7, 10.8, partitionThicknessM),
    onWall("clinic-server-ups", "ups-unit", "south", 12, 4.5),
    presetObstacle("clinic-patient-lift", "elevator", 18.8, 0),
    ...presetObstacles("clinic-pharmacy", [
      ["storage-rack", 10, 6], ["storage-rack", 15, 6], ["medical-cart", 18, 10],
      ["service-counter", 12, 10]
    ]),
    onWall("clinic-pharmacy-fridge", "display-fridge", "east", 20, 6),
    ...presetObstacles("clinic-exam-a", [["exam-table", -14, -7], ["medical-cart", -10, -7], ["privacy-screen", -8, -7, 90]]),
    ...presetObstacles("clinic-exam-b", [["exam-table", 0, -7], ["medical-cart", 4, -7], ["privacy-screen", 6, -7, 90]]),
    ...presetObstacles("clinic-exam-c", [["hospital-bed", 13, -7], ["medical-cart", 17, -7], ["privacy-screen", 8, -7, 90]]),
    ...presetObstacles("clinic-ambulance", [
      ["ambulance", -14, 16, 90], ["road", -12, 14], ["bollard", -3, 14], ["light-pole", 19.5, 14.5]
    ]),
    ...parkingRow("clinic-staff-car", ["sedan", "suv", "sedan", "sedan"], [8, 10.7, 13.4, 16.1], 16.5, "north"),
    sizedPreset("clinic-street", "road", 0, 21, 44, 3)
  ];
  const ground = floor("clinic-ground", "درمانگاه، اورژانس و داروخانه", 0, walls, openings, obstacles, 3.8);
  ground.coverageRequirements = [
    zone("clinic-ambulance-zone", "hospital.ambulance", "توقف آمبولانس کنار درِ اورژانس", -18, 12.3, -10, 19.3),
    zone("clinic-parking-zone", "shared.staff-parking", "پارکینگ کارکنان و مراجعان", 6.8, 13.8, 17.4, 19)
  ];
  return building([ground]);
}

/**
 * A two-level boutique hotel on a chamfered plot.
 *
 * Ground floor: lobby and reception on the street, back-of-house rooms (safe deposit,
 * server room, luggage store, restaurant) off a service corridor, and the stair and lift
 * core at the east end. The guest floor repeats the corridor and core exactly; every bed
 * has its headboard on a wall with the TV opposite, and guest rooms stay privacy areas.
 */
function boutiqueHotelPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const envelope: Vec2[] = [
    { x: -16, z: -12 }, { x: 16, z: -12 }, { x: 20, z: -8 }, { x: 20, z: 10 },
    { x: 16, z: 14 }, { x: -16, z: 14 }, { x: -20, z: 10 }, { x: -20, z: -8 }
  ];
  const ground = floor("boutique-hotel-ground", "همکف، لابی، صندوق امانات و رستوران", 0, [
    ...polygonEnvelope("boutique-hotel-ground", envelope, 4),
    partition("boutique-hotel-ground-spine", -20, -2, 20, -2, 4),
    partition("boutique-hotel-ground-lobby-spine", -20, 2, 20, 2, 4),
    partition("boutique-hotel-ground-restaurant-wall", -6, -12, -6, -2, 4),
    partition("boutique-hotel-ground-safe-wall", 0, -12, 0, -2, 4),
    partition("boutique-hotel-ground-server-wall", 4, -12, 4, -2, 4),
    partition("boutique-hotel-ground-store-wall", 10, -12, 10, -2, 4),
    partition("boutique-hotel-ground-core-wall", 15, -12, 15, -2, 4),
    partition("boutique-hotel-ground-admin-wall", -8, 2, -8, 14, 4)
  ], [
    { ...door("boutique-hotel-main-entry", "boutique-hotel-ground-envelope-5", 0.5, 2.4), variant: "double-glass", swingDirection: "inward" },
    { ...door("boutique-hotel-kitchen-service-exit", "boutique-hotel-ground-envelope-1", 0.1, 1.2), swingDirection: "outward" },
    door("boutique-hotel-restaurant-door", "boutique-hotel-ground-spine", 0.25, 1.6),
    door("boutique-hotel-safe-door", "boutique-hotel-ground-spine", 0.425, 1),
    door("boutique-hotel-server-door", "boutique-hotel-ground-spine", 0.55, 0.9),
    door("boutique-hotel-store-door", "boutique-hotel-ground-spine", 0.675, 1),
    door("boutique-hotel-stair-door", "boutique-hotel-ground-spine", 0.8125, 1),
    door("boutique-hotel-lift-door", "boutique-hotel-ground-spine", 0.9375, 1.4),
    { ...door("boutique-hotel-lobby-opening", "boutique-hotel-ground-lobby-spine", 0.5, 3), variant: "double-glass" },
    door("boutique-hotel-admin-door", "boutique-hotel-ground-lobby-spine", 0.2, 1),
    windowOpening("boutique-hotel-window-front-a", "boutique-hotel-ground-envelope-5", 0.2, 2.6),
    windowOpening("boutique-hotel-window-front-b", "boutique-hotel-ground-envelope-5", 0.8, 2.6),
    windowOpening("boutique-hotel-window-east", "boutique-hotel-ground-envelope-3", 0.75, 2.2),
    windowOpening("boutique-hotel-window-west", "boutique-hotel-ground-envelope-7", 0.25, 2.2)
  ], [
    // Lobby: two reception positions facing the door, lounge and luggage trolley.
    ...presetObstacles("boutique-hotel-reception", [["reception-desk", 6, 3.8], ["reception-desk", 8, 3.8]]),
    ...presetObstacles("boutique-hotel-reception-staff", [["office-chair", 6, 2.9, 0], ["office-chair", 8, 2.9, 0]]),
    ...presetObstacles("boutique-hotel-lobby", [
      ["lobby-sofa", -4.5, 6.6, 0], ["lobby-sofa", -4.5, 10.4, 180], ["coffee-table", -4.5, 8.5],
      ["luggage-cart", 3.5, 11.5], ["structural-column", -1, 6], ["structural-column", 11, 6]
    ]),
    // Administration office.
    ...alongWall("boutique-hotel-admin-desk", "office-desk", "east", -8, [5, 9], t),
    ...presetObstacles("boutique-hotel-admin-chairs", [["office-chair", -9.6, 5, 270], ["office-chair", -9.6, 9, 270]]),
    ...alongWall("boutique-hotel-admin-filing", "filing-cabinet", "north", 2, [-15, -13.8], t),
    // Restaurant with its serving counter on the corridor wall.
    ...[[-15.5, -7.5], [-11, -7.5], [-11, -4.5]].flatMap(([x, z], index) => [
      presetObstacle(`boutique-hotel-restaurant-table-${index + 1}`, "dining-table", x, z),
      ...tableChairs(`boutique-hotel-restaurant-chairs-${index + 1}`, x, z, 0, "dining-chair")
    ]),
    onWall("boutique-hotel-restaurant-counter", "service-counter", "east", -6, -7, t),
    // Safe deposit: guest safes on the rear wall, clerk desk facing the door.
    ...alongWall("boutique-hotel-safe-box", "tool-cabinet", "north", -12, [-4.2, -2.6]),
    onWall("boutique-hotel-safe-filing", "filing-cabinet", "north", -12, -1),
    presetObstacle("boutique-hotel-safe-desk", "office-desk", -3, -6.5),
    presetObstacle("boutique-hotel-safe-chair", "office-chair", -3, -7.5, 0),
    // Server room.
    ...alongWall("boutique-hotel-server-rack", "equipment-rack", "north", -12, [1, 2.2]),
    onWall("boutique-hotel-server-ups", "ups-unit", "north", -12, 3.3),
    // Luggage store.
    onWall("boutique-hotel-store-rack", "storage-rack", "north", -12, 7),
    presetObstacle("boutique-hotel-store-trolley", "luggage-cart", 8.6, -5),
    // Stair and lift core.
    presetObstacle("boutique-hotel-ground-stairs", "stairs-straight", 12.5, -7, 90),
    presetObstacle("boutique-hotel-ground-lift", "elevator", 16.6, -6.5),
    // Service lane with staff parking behind the hotel, street in front.
    ...parkingRow("boutique-hotel-staff-car", ["sedan", "suv", "sedan", "van", "sedan"], [-8, -5, -2, 1, 4], -16.5, "south"),
    sizedPreset("boutique-hotel-service-lane", "road", 0, -21.5, 40, 4),
    sizedPreset("boutique-hotel-street", "road", 0, 17.5, 40, 4),
    ...presetObstacles("boutique-hotel-site-lights", [["light-pole", -10.5, -14.5], ["light-pole", 7, -14.5], ["light-pole", 10, 15.2]])
  ], 4);
  ground.coverageRequirements = [
    zone("boutique-hotel-staff-parking-zone", "shared.staff-parking", "پارکینگ کارکنان پشت هتل", -9.6, -19.4, 5.6, -13.6)
  ];

  const roomXs = [-20, -12.5, -5, 2.5];
  const suiteXs = [-20, -10, 0, 10];
  const first = floor("boutique-hotel-first", "طبقه اتاق‌ها و راهروی مرکزی", 1, [
    ...polygonEnvelope("boutique-hotel-first", envelope, 3.6),
    partition("boutique-hotel-first-corridor-north", -20, -2, 20, -2, 3.6),
    partition("boutique-hotel-first-corridor-south", -20, 2, 20, 2, 3.6),
    ...[-12.5, -5, 2.5, 10, 15].map((x, index) => partition(`boutique-hotel-first-north-${index + 1}`, x, -12, x, -2, 3.6)),
    ...[-10, 0, 10].map((x, index) => partition(`boutique-hotel-first-south-${index + 1}`, x, 2, x, 14, 3.6))
  ], [
    ...[0.1375, 0.325, 0.5125, 0.7].map((offset, index) => door(`boutique-hotel-first-room-n${index + 1}`, "boutique-hotel-first-corridor-north", offset, 1)),
    door("boutique-hotel-first-stair-door", "boutique-hotel-first-corridor-north", 0.8125, 1),
    door("boutique-hotel-first-lift-door", "boutique-hotel-first-corridor-north", 0.9375, 1.4),
    ...[0.2, 0.45, 0.7, 0.95].map((offset, index) => door(`boutique-hotel-first-room-s${index + 1}`, "boutique-hotel-first-corridor-south", offset, 1)),
    ...[0.0625, 0.2266, 0.4609, 0.6953].map((offset, index) => windowOpening(`boutique-hotel-first-window-north-${index + 1}`, "boutique-hotel-first-envelope-1", offset, 1.6)),
    ...[0.9063, 0.6563, 0.3438, 0.0938].map((offset, index) => windowOpening(`boutique-hotel-first-window-south-${index + 1}`, "boutique-hotel-first-envelope-5", offset, 2.2))
  ], [
    // North rooms: headboard on the west wall, TV opposite, wardrobe by the door.
    ...roomXs.flatMap((left, index) => {
      const bedZ = index === 0 ? -5 : -7.5;
      const prefix = `boutique-hotel-room-n${index + 1}`;
      return [
        onWall(`${prefix}-bed`, "bed-double", "west", left, bedZ, index === 0 ? wallThicknessM : t),
        ...alongWall(`${prefix}-nightstand`, "nightstand", "west", left, [bedZ - 1.05, bedZ + 1.05], index === 0 ? wallThicknessM : t),
        onWall(`${prefix}-tv`, "tv-unit", "east", left + 7.5, bedZ, t),
        onWall(`${prefix}-wardrobe`, "wardrobe", "east", left + 7.5, index === 0 ? -8.7 : -3.6, t),
        onWall(`${prefix}-dresser`, "dresser", "north", -12, left + 6.2)
      ];
    }),
    // South suites: headboard on the west wall, TV opposite, desk under the window.
    ...suiteXs.flatMap((left, index) => {
      const bedZ = index === 0 ? 6 : 8.5;
      const right = left + 10;
      const prefix = `boutique-hotel-room-s${index + 1}`;
      return [
        onWall(`${prefix}-bed`, "bed-double", "west", left, bedZ, index === 0 ? wallThicknessM : t),
        ...alongWall(`${prefix}-nightstand`, "nightstand", "west", left, [bedZ - 1.05, bedZ + 1.05], index === 0 ? wallThicknessM : t),
        onWall(`${prefix}-tv`, "tv-unit", "east", right, index === 3 ? 6 : bedZ, index === 3 ? wallThicknessM : t),
        onWall(`${prefix}-wardrobe`, "wardrobe", "east", right, 3.6, index === 3 ? wallThicknessM : t),
        onWall(`${prefix}-desk`, "office-desk", "south", 14, left + 5),
        presetObstacle(`${prefix}-chair`, "office-chair", left + 5, 12.7, 0)
      ];
    }),
    topLanding("boutique-hotel-first-landing", 12.5, -7, 90),
    presetObstacle("boutique-hotel-first-lift", "elevator", 16.6, -6.5)
  ], 3.6);
  return stackBuilding([ground, first], ground.id);
}

/** A compact roadside fuel station with a chamfered shop and an open columned canopy. */
function neighbourhoodFuelStationPlan(): BuildingPlan {
  const shopOutline: Vec2[] = [
    { x: -11, z: -7 }, { x: 8, z: -7 }, { x: 11, z: -4 }, { x: 11, z: 7 },
    { x: 8, z: 10 }, { x: -11, z: 10 }, { x: -14, z: 7 }, { x: -14, z: -4 }
  ];
  const ground = floor("fuel-station-ground", "فروشگاه، سکوهای سوخت و محوطه", 0, [
    ...polygonEnvelope("fuel-station-shop", shopOutline, 3.5)
  ], [
    // The shop faces the pumps; deliveries use the rear door.
    { ...door("fuel-station-shop-entry", "fuel-station-shop-envelope-1", 0.55, 1.8), variant: "double-glass", swingDirection: "inward" },
    { ...door("fuel-station-shop-service", "fuel-station-shop-envelope-5", 0.2, 1.1), swingDirection: "outward" },
    windowOpening("fuel-station-shop-window-front", "fuel-station-shop-envelope-1", 0.2, 3),
    windowOpening("fuel-station-shop-window-east", "fuel-station-shop-envelope-3", 0.5, 2),
    windowOpening("fuel-station-shop-window-west", "fuel-station-shop-envelope-7", 0.5, 2)
  ], [
    ...alongWall("fuel-station-shop-shelf", "shelving-unit", "west", -14, [0, 4]),
    onWall("fuel-station-shop-fridge", "display-fridge", "east", 11, 5),
    presetObstacle("fuel-station-shop-checkout", "checkout-counter", 3.5, -4.8, 90),
    presetObstacle("fuel-station-shop-cashier", "office-chair", 4.35, -4.8, 90),
    onWall("fuel-station-shop-stock", "storage-rack", "south", 10, -4),
    ...[-10, 0, 10].flatMap((x, island) => [
      obstacle(`fuel-station-pump-${island + 1}-a`, "پمپ سوخت", "counter", x - 1.1, -17, 0.8, 1.6, 1.8, true),
      obstacle(`fuel-station-pump-${island + 1}-b`, "پمپ سوخت", "counter", x + 1.1, -17, 0.8, 1.6, 1.8, true),
      presetObstacle(`fuel-station-canopy-column-${island + 1}-a`, "structural-column", x - 3, -17),
      presetObstacle(`fuel-station-canopy-column-${island + 1}-b`, "structural-column", x + 3, -17)
    ]),
    ...presetObstacles("fuel-station-traffic", [
      ["road", -24, -24], ["road", -12, -24], ["road", 0, -24], ["road", 12, -24], ["road", 24, -24],
      ["road", -18, -16, 90], ["road", 18, -16, 90], ["speed-bump", -20, -28],
      ["bollard", -14, -10], ["bollard", 14, -10], ["light-pole", -22, -12], ["light-pole", 22, -12]
    ]),
    obstacle("fuel-station-tank-a", "مخزن زیرزمینی یک", "block", 18, 5, 4, 4, 0.25, true),
    obstacle("fuel-station-tank-b", "مخزن زیرزمینی دو", "block", 24, 5, 4, 4, 0.25, true),
    presetObstacle("fuel-station-gate-camera-pole", "camera-pole", 24, -27),
    presetObstacle("fuel-station-service-van", "van", 19, 11, 90),
    ...parkingRow("fuel-station-service-staff-car", ["sedan", "suv", "sedan", "sedan", "pickup"], [-9, -6.3, -3.6, -0.9, 1.8], 14.5, "north")
  ], 3.8);
  ground.coverageRequirements = [
    zone("fuel-station-island-zone", "fuel.island", "سکوهای سوخت‌گیری", -14, -19.5, 14, -14.5),
    zone("fuel-station-gate-west-zone", "fuel.gate", "ورودی جایگاه", -21, -22, -15, -17.5),
    zone("fuel-station-gate-east-zone", "fuel.gate", "خروجی جایگاه", 15, -22, 21, -17.5),
    zone("fuel-station-tank-zone", "fuel.tanks", "مخازن و محل تخلیه", 15.5, 2.5, 26.5, 7.5),
    zone("fuel-station-forecourt-zone", "fuel.forecourt", "محوطه جلوی فروشگاه", -14, -13.5, 14, -8.2),
    zone("fuel-station-parking-zone", "shared.staff-parking", "پارکینگ کارکنان پشت فروشگاه", -10.5, 11.8, 3.3, 17.2)
  ];
  return building([ground]);
}

/**
 * A residential block with a parking basement and a chamfered common ground floor.
 *
 * The stair and lift sit in the same place on both floors. The basement is a real car
 * park: a ramp gate with its barrier, two rows of bays around a 5 m aisle, and resident
 * storage, server and plant rooms opening off it. Upstairs, a common corridor links the
 * lobby, community lounge, utility and bike rooms; the guard room is glazed onto the lobby.
 */
function courtyardApartmentPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const coreStairs: [number, number] = [-3.5, -5.5];
  const coreLift: [number, number] = [0.5, -3.4];
  const basement = floor("courtyard-apartment-basement", "زیرزمین، پارکینگ، انباری و تاسیسات", -1, [
    ...rectangle("courtyard-apartment-basement-shell", -18, -12, 18, 14),
    partition("courtyard-apartment-service-spine", -18, -1, 18, -1),
    ...[-6, -1, 2, 6].map((x, index) => partition(`courtyard-apartment-basement-room-${index + 1}`, x, -12, x, -1))
  ], [
    { ...door("courtyard-apartment-parking-gate", "courtyard-apartment-basement-shell-south", 0.1389, 4.5), variant: "double-solid" },
    door("courtyard-apartment-storage-door", "courtyard-apartment-service-spine", 0.1667, 1.2),
    door("courtyard-apartment-parking-access", "courtyard-apartment-service-spine", 0.4028, 1),
    door("courtyard-apartment-basement-lift-door", "courtyard-apartment-service-spine", 0.5139, 1.2),
    door("courtyard-apartment-server-door", "courtyard-apartment-service-spine", 0.6111, 0.9),
    door("courtyard-apartment-plant-door", "courtyard-apartment-service-spine", 0.8333, 1.2)
  ], [
    ...parkingRow("courtyard-apartment-bay-north", ["sedan", "suv", "sedan", "sedan", "suv", "sedan", "suv"], [-16.3, -13.9, -9.6, -6.9, 7.2, 9.9, 14.6], 1.5, "north"),
    ...parkingRow("courtyard-apartment-bay-south", ["sedan", "suv", "sedan"], [-16.3, -13.6, -10.9, -8.2, -5.5, -2.8, 0, 2.7, 5.4], 11.4, "south"),
    presetObstacle("courtyard-apartment-gate-barrier", "parking-barrier", 13, 12.2),
    presetObstacle("courtyard-apartment-gate-bump", "speed-bump", 13, 10.3),
    // Resident storage.
    ...alongWall("courtyard-apartment-storage-rack", "storage-rack", "north", -12, [-15, -11.4]),
    presetObstacle("courtyard-apartment-storage-crates", "crate-stack", -9, -3.5),
    // Core.
    presetObstacle("courtyard-apartment-basement-stairs", "stairs-straight", coreStairs[0], coreStairs[1], 90),
    presetObstacle("courtyard-apartment-basement-elevator", "elevator", coreLift[0], coreLift[1]),
    // Server room with the recorder rack and UPS.
    onWall("courtyard-apartment-server-rack", "equipment-rack", "north", -12, 3),
    onWall("courtyard-apartment-server-ups", "ups-unit", "north", -12, 4.4),
    // Plant room.
    ...alongWall("courtyard-apartment-plant-cabinet", "tool-cabinet", "north", -12, [9, 11]),
    presetObstacle("courtyard-apartment-plant-bench", "workbench", 13, -6)
  ]);
  basement.coverageRequirements = [
    zone("courtyard-apartment-gate-zone", "apartment.parking-gate", "درِ پارکینگ و راهبند", 10.3, 11.9, 15.7, 13.9)
  ];

  const commonOutline: Vec2[] = [
    { x: -14, z: -10 }, { x: 14, z: -10 }, { x: 18, z: -6 }, { x: 18, z: 8 },
    { x: 14, z: 12 }, { x: -14, z: 12 }, { x: -18, z: 8 }, { x: -18, z: -6 }
  ];
  const ground = floor("courtyard-apartment-ground", "همکف، لابی، نگهبانی و مشاعات", 0, [
    ...polygonEnvelope("courtyard-apartment-ground", commonOutline),
    partition("courtyard-apartment-corridor-north", -18, -1, 18, -1),
    partition("courtyard-apartment-corridor-south", -18, 1.5, 18, 1.5),
    ...[-6, -1, 2, 8].map((x, index) => partition(`courtyard-apartment-ground-room-${index + 1}`, x, -10, x, -1)),
    glassPartition("courtyard-apartment-guard-glass", 8, 1.5, 8, 12)
  ], [
    { ...door("courtyard-apartment-main-entry", "courtyard-apartment-ground-envelope-5", 0.6429, 2.2), variant: "double-glass", swingDirection: "inward" },
    { ...door("courtyard-apartment-lobby-opening", "courtyard-apartment-corridor-south", 0.3889, 2), variant: "double-glass" },
    door("courtyard-apartment-community-door", "courtyard-apartment-corridor-north", 0.1667, 1.2),
    door("courtyard-apartment-ground-stair-door", "courtyard-apartment-corridor-north", 0.4028, 1),
    door("courtyard-apartment-ground-lift-door", "courtyard-apartment-corridor-north", 0.5139, 1.2),
    door("courtyard-apartment-utility-door", "courtyard-apartment-corridor-north", 0.6389, 1),
    door("courtyard-apartment-bike-door", "courtyard-apartment-corridor-north", 0.8611, 1.2),
    { ...door("courtyard-apartment-guard-door", "courtyard-apartment-guard-glass", 0.7143, 1), variant: "single-glass" },
    windowOpening("courtyard-apartment-window-front-a", "courtyard-apartment-ground-envelope-5", 0.0893, 2.4),
    windowOpening("courtyard-apartment-window-front-b", "courtyard-apartment-ground-envelope-5", 0.86, 2),
    windowOpening("courtyard-apartment-window-east", "courtyard-apartment-ground-envelope-3", 0.1429, 2)
  ], [
    // Community lounge.
    onWall("courtyard-apartment-community-tv", "tv-unit", "west", -18, -3.5),
    ...presetObstacles("courtyard-apartment-community", [
      ["rug", -14.5, -3.5, 90], ["coffee-table", -14.5, -3.5, 90], ["sofa-three", -12.5, -3.5, 90],
      ["sofa-single", -14.5, -5.8, 0], ["dining-table", -9.5, -6]
    ]),
    ...tableChairs("courtyard-apartment-community-chairs", -9.5, -6, 0, "dining-chair"),
    // Core.
    topLanding("courtyard-apartment-ground-landing", coreStairs[0], coreStairs[1], 90),
    presetObstacle("courtyard-apartment-ground-elevator", "elevator", coreLift[0], coreLift[1]),
    // Utility (meters and building services) and bike / parcel store.
    onWall("courtyard-apartment-utility-cabinet", "tool-cabinet", "north", -10, 4),
    presetObstacle("courtyard-apartment-utility-bench", "workbench", 5, -6),
    onWall("courtyard-apartment-bike-rack", "storage-rack", "north", -10, 11),
    presetObstacle("courtyard-apartment-parcel-crates", "crate-stack", 16, -3),
    // Lobby: concierge facing the door, mailboxes and seating.
    presetObstacle("courtyard-apartment-concierge", "reception-desk", 2, 4.5),
    presetObstacle("courtyard-apartment-concierge-chair", "office-chair", 2, 3.6, 0),
    onWall("courtyard-apartment-mailboxes", "locker-row", "north", 1.5, -12, t),
    ...presetObstacles("courtyard-apartment-lobby", [
      ["lobby-sofa", -12, 5.5, 0], ["lobby-sofa", -12, 9.3, 180], ["coffee-table", -12, 7.4]
    ]),
    // Guard and management room overlooking the lobby.
    onWall("courtyard-apartment-guard-console", "monitoring-console", "east", 18, 5),
    presetObstacle("courtyard-apartment-guard-chair", "office-chair", 16.5, 5, 270),
    onWall("courtyard-apartment-manager-desk", "office-desk", "north", 1.5, 12, t),
    presetObstacle("courtyard-apartment-manager-chair", "office-chair", 12, 2.95, 180),
    onWall("courtyard-apartment-manager-filing", "filing-cabinet", "north", 1.5, 14.5, t),
    // Site: garden, ramp to the basement gate.
    sizedPreset("courtyard-apartment-garden", "grass", -22, 1, 7, 14),
    sizedPreset("courtyard-apartment-ramp", "road", 13, 15, 6, 6),
    ...presetObstacles("courtyard-apartment-landscape", [
      ["deciduous", -22.5, -8], ["waiting-bench", -21, 5, 90], ["light-pole", -20.5, -3], ["light-pole", 17, 13]
    ])
  ]);
  ground.coverageRequirements = [
    zone("courtyard-apartment-ramp-zone", "apartment.parking-gate", "ورودی رمپ پارکینگ", 9.8, 12.3, 16.2, 18)
  ];
  return stackBuilding([basement, ground], ground.id);
}

/** An orchard farm with separate product, livestock and utility buildings. */
function orchardFarmPlan(): BuildingPlan {
  const walls = [
    ...rectangle("orchard-farm-barn", -18, -10, 10, 10, 4.2),
    partition("orchard-farm-barn-split", -4, -10, -4, 10, 4.2),
    ...polygonEnvelope("orchard-farm-utility", [
      { x: 14, z: -5 }, { x: 21, z: -5 }, { x: 24, z: -2 }, { x: 24, z: 5 },
      { x: 21, z: 8 }, { x: 14, z: 8 }, { x: 11, z: 5 }, { x: 11, z: -2 }
    ], 3.4)
  ];
  const openings: PlanDoor[] = [
    door("orchard-farm-store-entry", "orchard-farm-barn-south", 0.74, 2.8),
    door("orchard-farm-livestock-entry", "orchard-farm-barn-south", 0.22, 3.2),
    door("orchard-farm-utility-entry", "orchard-farm-utility-envelope-5", 0.5, 1.2),
    windowOpening("orchard-farm-store-window", "orchard-farm-barn-north", 0.22, 2.4),
    windowOpening("orchard-farm-livestock-window", "orchard-farm-barn-north", 0.74, 2.4),
    windowOpening("orchard-farm-utility-window", "orchard-farm-utility-envelope-3", 0.5, 1.8)
  ];
  const orchardTrees = [-34, -28, -22, -16].flatMap((x, column) =>
    [16, 23, 30].map((z, row) => presetObstacle(`orchard-farm-tree-${column * 3 + row + 1}`, "deciduous", x, z))
  );
  const obstacles = [
    ...presetObstacles("orchard-farm-store", [
      ["storage-rack", -15, -6, 90], ["storage-rack", -10, -6, 90], ["pallet-stack", -15, 4],
      ["crate-stack", -9, 4], ["packing-table", -10, 0]
    ]),
    // Livestock barn: four pens either side of a feeding alley, troughs along the alley.
    sizedPreset("orchard-farm-pen-rail-north", "fence-mesh", 3, -1.2, 13.6, 0.1),
    sizedPreset("orchard-farm-pen-rail-south", "fence-mesh", 3, 1.2, 13.6, 0.1),
    sizedPreset("orchard-farm-pen-divider-north", "fence-mesh", 3, -5.5, 8.4, 0.1, 90),
    sizedPreset("orchard-farm-pen-divider-south", "fence-mesh", 3, 4.85, 7.1, 0.1, 90),
    ...[-0.5, 6.5].flatMap((x, index) => [
      obstacle(`orchard-farm-trough-north-${index + 1}`, "آبشخور", "block", x, -1.7, 2.6, 0.5, 0.6, false),
      obstacle(`orchard-farm-trough-south-${index + 1}`, "آبشخور", "block", x, 1.7, 2.6, 0.5, 0.6, false)
    ]),
    onWall("orchard-farm-pump-panel", "equipment-rack", "east", 24, 0),
    onWall("orchard-farm-tool-cabinet", "tool-cabinet", "west", 11, 1.5),
    presetObstacle("orchard-farm-workbench", "workbench", 17, 5),
    // Farm track from the gate to the barns, perimeter fence along the road.
    sizedPreset("orchard-farm-access-track", "road", 1, 23, 8, 26),
    ...presetObstacles("orchard-farm-access", [
      ["gate-sliding", 0, 36], ["guard-booth", 7, 34], ["pickup", -7, 30, 90],
      ["camera-pole", -18, 34], ["light-pole", 18, 34]
    ]),
    sizedPreset("orchard-farm-access-fence-west", "fence-mesh", -21.25, 36, 37.5, 0.1),
    sizedPreset("orchard-farm-access-fence-east", "fence-mesh", 21.25, 36, 37.5, 0.1),
    ...orchardTrees,
    { ...sizedPreset("orchard-farm-water-tank", "storage-tank", 31, 2, 6, 6), label: "مخزن گرد آب", heightM: 3 }
  ];
  const ground = floor("orchard-farm-ground", "انبار محصول، جایگاه دام و باغ", 0, walls, openings, obstacles, 4.4);
  ground.coverageRequirements = [
    zone("orchard-farm-access-zone", "farm.access", "درِ ورودی و مسیر دسترسی", -3.5, 31, 3.5, 35.8),
    zone("orchard-farm-perimeter-zone", "farm.perimeter", "حصار جنوبی باغ", -20, 33.8, -4, 35.8)
  ];
  return building([ground]);
}

/** A small urban roundabout using a true cylindrical island and a chamfered signal booth. */
function urbanRoundaboutPlan(): BuildingPlan {
  const boothOutline: Vec2[] = [
    { x: 17, z: 12 }, { x: 23, z: 12 }, { x: 26, z: 15 }, { x: 26, z: 21 },
    { x: 23, z: 24 }, { x: 17, z: 24 }, { x: 14, z: 21 }, { x: 14, z: 15 }
  ];
  const island = {
    ...presetObstacle("urban-roundabout-central-island", "structural-column", 0, 0),
    label: "جزیره دایره‌ای میدان",
    widthM: 8,
    depthM: 8,
    heightM: 0.35,
    blocksView: false
  };
  const circularCarriageway = Array.from({ length: 8 }, (_, index) => {
    const angle = index * 45;
    const radians = angle * Math.PI / 180;
    return {
      ...presetObstacle(`urban-roundabout-ring-${index + 1}`, "road", Math.cos(radians) * 8, Math.sin(radians) * 8, angle + 90),
      widthM: 7,
      label: "مسیر حلقوی میدان"
    };
  });
  const ground = floor("urban-roundabout-ground", "میدان شهری، تقاطع و پیاده‌رو", 0, [
    ...polygonEnvelope("urban-roundabout-booth", boothOutline, 3.2)
  ], [
    door("urban-roundabout-booth-door", "urban-roundabout-booth-envelope-5", 0.5, 1.1),
    windowOpening("urban-roundabout-booth-window-a", "urban-roundabout-booth-envelope-1", 0.5, 2),
    windowOpening("urban-roundabout-booth-window-b", "urban-roundabout-booth-envelope-3", 0.5, 1.6)
  ], [
    island,
    ...circularCarriageway,
    ...presetObstacles("urban-roundabout-roads", [
      ["road", 0, -15, 90], ["road", 0, -27, 90], ["road", 0, 15, 90], ["road", 0, 27, 90],
      ["road", -15, 0], ["road", -27, 0], ["road", 15, 0], ["road", 27, 0]
    ]),
    ...presetObstacles("urban-roundabout-signals", [
      ["light-pole", -9, -9], ["light-pole", 9, -9], ["light-pole", -9, 9], ["light-pole", 9, 9],
      ["bollard", -6, -6], ["bollard", 6, -6], ["bollard", -6, 6], ["bollard", 6, 6],
      ["waiting-bench", -18, 14], ["waiting-bench", -18, 20], ["camera-pole", 11, -11], ["camera-pole", -11, 11]
    ]),
    // Signal booth: the operator faces the junction through the north window.
    onWall("urban-roundabout-booth-rack", "equipment-rack", "east", 26, 18),
    onWall("urban-roundabout-booth-filing", "filing-cabinet", "west", 14, 18),
    presetObstacle("urban-roundabout-booth-desk", "office-desk", 19, 17),
    presetObstacle("urban-roundabout-booth-chair", "office-chair", 19, 18.2, 180),
    // Marked pedestrian crossing on the west approach.
    obstacle("urban-roundabout-roads-crosswalk", "خط عابر پیاده", "surface", -14.5, 0, 2, 4, 0.03, false),
    // Right-hand traffic: every vehicle keeps to its own lane, heading into the roundabout.
    ...presetObstacles("urban-roundabout-traffic", [
      ["sedan", -1, -21, 90], ["suv", 21, -1, 180], ["van", 1, 21, 270], ["pickup", -21, 1, 0]
    ])
  ], 3.4);
  ground.coverageRequirements = [
    zone("urban-roundabout-junction-zone", "urban-road.junction", "میدان و تقاطع", -11, -11, 11, 11),
    zone("urban-roundabout-crossing-zone", "urban-road.crossing", "گذرگاه عابر پیاده ضلع غربی", -16, -2.2, -13, 2.2),
    zone("urban-roundabout-lane-zone", "urban-road.lane", "مسیر ورود شرقی", 15, -2.2, 30, 2.2)
  ];
  return building([ground]);
}

/** A compact interchange plate with separated lanes, a curved ramp and a VMS booth. */
function highwayInterchangePlan(): BuildingPlan {
  const boothOutline: Vec2[] = [
    { x: 19, z: 10 }, { x: 26, z: 10 }, { x: 29, z: 13 }, { x: 29, z: 20 },
    { x: 26, z: 23 }, { x: 19, z: 23 }, { x: 16, z: 20 }, { x: 16, z: 13 }
  ];
  const rampSegments = Array.from({ length: 7 }, (_, index) => {
    const angle = -70 + index * 18;
    const radians = angle * Math.PI / 180;
    return {
      ...presetObstacle(`highway-ramp-segment-${index + 1}`, "road", 20 + Math.cos(radians) * 16, -2 + Math.sin(radians) * 16, angle + 90),
      label: "رمپ منحنی ورود و خروج"
    };
  });
  const ground = floor("highway-interchange-ground", "بزرگراه، رمپ و پایش ترافیک", 0, [
    ...polygonEnvelope("highway-control-booth", boothOutline, 3.4)
  ], [
    door("highway-control-door", "highway-control-booth-envelope-5", 0.5, 1.1),
    windowOpening("highway-control-window-a", "highway-control-booth-envelope-1", 0.5, 2),
    windowOpening("highway-control-window-b", "highway-control-booth-envelope-3", 0.5, 1.6)
  ], [
    ...gridPresets("highway-mainline", ["road"], [-18, -6, 6, 18], [-8, 8]),
    ...rampSegments,
    ...presetObstacles("highway-traffic", [
      // Westbound on the north carriageway, eastbound on the south one.
      ["sedan", -18, -8, 180], ["suv", -4, 8, 0], ["van", 10, -8, 180], ["truck", 20, 8, 0],
      ["bollard", 12, 12], ["bollard", 12, 18]
    ]),
    ...presetObstacles("highway-monitoring", [
      ["camera-pole", -27, -13], ["camera-pole", 27, 13], ["light-pole", -27, 13], ["light-pole", 27, -13]
    ]),
    obstacle("highway-vms-gantry", "تابلو متغیر پیام", "block", 0, -14, 12, 0.7, 4.5, true),
    obstacle("highway-emergency-bay", "توقفگاه اضطراری", "surface", -22, 18, 10, 5, 0.08, false),
    // Control booth: the operator faces the carriageway through the north window.
    onWall("highway-control-rack", "equipment-rack", "east", 29, 16.5),
    onWall("highway-control-filing", "filing-cabinet", "west", 16, 16.5),
    presetObstacle("highway-control-desk", "office-desk", 21, 16),
    presetObstacle("highway-control-chair", "office-chair", 21, 17.2, 180)
  ], 3.6);
  ground.coverageRequirements = [
    zone("highway-ramp-zone", "highway.ramp", "رمپ ورود و خروج", 30, -12, 38, 2),
    zone("highway-mainline-zone", "highway.mainline", "لاین‌های اصلی شرق‌سو", -12, 6, 12, 10),
    zone("highway-lane-zone", "urban-road.lane", "لاین‌های غرب‌سو", -6, -10, 12, -6),
    zone("highway-speed-zone", "highway.speed", "نقطه پایش سرعت", -24, -10, -12, -6),
    zone("highway-shoulder-zone", "highway.shoulder", "توقفگاه اضطراری", -25, 15.8, -19, 20.2)
  ];
  return building([ground]);
}

/** A live construction site with a non-rectangular office, material stacks and crane zone. */
function activeConstructionSitePlan(): BuildingPlan {
  const officeOutline: Vec2[] = [
    { x: -25, z: -13 }, { x: -11, z: -13 }, { x: -8, z: -10 }, { x: -8, z: 0 },
    { x: -11, z: 3 }, { x: -25, z: 3 }, { x: -28, z: 0 }, { x: -28, z: -10 }
  ];
  const walls = [
    ...polygonEnvelope("construction-office", officeOutline, 3.2),
    ...rectangle("construction-tool-store", 12, -12, 27, 2, 3.6)
  ];
  const openings: PlanDoor[] = [
    door("construction-office-entry", "construction-office-envelope-5", 0.5, 1.2),
    door("construction-store-entry", "construction-tool-store-south", 0.5, 2.5),
    windowOpening("construction-office-window", "construction-office-envelope-1", 0.5, 2.4),
    windowOpening("construction-store-window", "construction-tool-store-east", 0.5, 1.8)
  ];
  const obstacles = [
    ...presetObstacles("construction-office-assets", [
      ["office-desk", -21, -6], ["office-chair", -21, -4.8, 180], ["meeting-table", -15, -5]
    ]),
    onWall("construction-office-filing", "filing-cabinet", "west", -28, -3),
    onWall("construction-office-rack", "equipment-rack", "east", -8, -4),
    ...tableChairs("construction-office-chairs", -15, -5),
    ...presetObstacles("construction-tool-assets", [
      ["storage-rack", 20, -8, 90], ["crate-stack", 16, -2], ["pallet-stack", 22, -2], ["workbench", 19, 0]
    ]),
    onWall("construction-tool-rack-east", "storage-rack", "east", 27, -8),
    onWall("construction-tool-cabinet", "tool-cabinet", "west", 12, -8),
    ...presetObstacles("construction-material-yard", [
      ["pallet-stack", -20, 14], ["pallet-stack", -14, 14], ["crate-stack", -8, 14],
      ["loading-platform", -14, 21], ["truck", 17, 18, 180], ["pickup", 10, 20, 90]
    ]),
    ...presetObstacles("construction-vehicle-route", [
      ["road", 0, 25, 90], ["road", 6, 18, 45], ["road", 16, 18]
    ]),
    ...presetObstacles("construction-site-security", [
      ["gate-sliding", 0, 31], ["guard-booth", 7, 29], ["camera-pole", -29, 27], ["camera-pole", 29, 27],
      ["light-pole", -29, -20], ["light-pole", 29, -20]
    ]),
    sizedPreset("construction-site-fence-south-west", "fence-mesh", -16.25, 31, 27.5, 0.1),
    sizedPreset("construction-site-fence-south-east", "fence-wall", 16.25, 31, 27.5, 0.25),
    sizedPreset("construction-site-fence-north", "fence-mesh", 0, -22, 60, 0.1),
    sizedPreset("construction-site-fence-west", "fence-mesh", -30, 4.5, 53, 0.1, 90),
    sizedPreset("construction-site-fence-east", "fence-mesh", 30, 4.5, 53, 0.1, 90),
    obstacle("construction-crane-mast", "دکل جرثقیل", "pillar", 0, 7, 2.2, 2.2, 18, true),
    // The jib swings high overhead, so it never hides anything on the ground.
    obstacle("construction-crane-jib", "بازوی جرثقیل", "block", 7, 7, 16, 0.6, 0.6, false),
    obstacle("construction-foundation", "گود و فونداسیون", "surface", 2, -10, 18, 12, 0.12, false),
    ...[-6, 0, 6].map((x, index) => presetObstacle(`construction-foundation-column-${index + 1}`, "structural-column", x, -10))
  ];
  const ground = floor("construction-site-ground", "کارگاه فعال، دفتر و دپوی مصالح", 0, walls, openings, obstacles, 4);
  ground.coverageRequirements = [
    zone("construction-gate-zone", "construction.gate", "گیت ورود کارگاه", -4, 27, 4, 30.8),
    zone("construction-material-zone", "construction.material", "دپوی مصالح", -17, 15.4, -7, 18.4),
    zone("construction-crane-zone", "construction.crane", "جرثقیل و محدوده بازو", -2, 5.5, 10, 8.5),
    zone("construction-perimeter-zone", "construction.perimeter", "حصار شمالی سایت", -6, -21.8, 10, -20.3)
  ];
  return building([ground]);
}

/** A fan-shaped conference hall with registration, stage, seating and AV control. */
function conferenceCentrePlan(): BuildingPlan {
  const outline: Vec2[] = [
    { x: -18, z: -14 }, { x: 18, z: -14 }, { x: 24, z: -8 }, { x: 24, z: 12 },
    { x: 18, z: 18 }, { x: -18, z: 18 }, { x: -24, z: 12 }, { x: -24, z: -8 }
  ];
  const ground = floor("conference-centre-ground", "سالن همایش، صحنه و لابی ثبت‌نام", 0, [
    ...polygonEnvelope("conference-centre", outline, 5),
    partition("conference-stage-wall", -24, -5, 24, -5, 5),
    partition("conference-lobby-wall", -24, 10, 24, 10, 5),
    partition("conference-av-wall", 12, -14, 12, -5, 5)
  ], [
    { ...door("conference-main-entry", "conference-centre-envelope-5", 0.5, 3), variant: "double-glass", swingDirection: "inward" },
    door("conference-hall-door-a", "conference-lobby-wall", 0.3, 1.8),
    door("conference-hall-door-b", "conference-lobby-wall", 0.7, 1.8),
    door("conference-stage-door", "conference-stage-wall", 0.25, 1.4),
    door("conference-av-door", "conference-stage-wall", 0.82, 1.1),
    { ...door("conference-emergency-exit-east", "conference-centre-envelope-3", 0.78, 1.4), swingDirection: "outward" },
    { ...door("conference-emergency-exit-west", "conference-centre-envelope-7", 0.5, 1.4), swingDirection: "outward" },
    windowOpening("conference-window-front-a", "conference-centre-envelope-5", 0.22, 3),
    windowOpening("conference-window-front-b", "conference-centre-envelope-5", 0.78, 3),
    windowOpening("conference-window-east", "conference-centre-envelope-3", 0.5, 2.4)
  ], [
    obstacle("conference-stage-platform", "صحنه اصلی", "surface", -5, -10, 26, 5, 0.8, false),
    onWall("conference-stage-screen", "whiteboard", "north", -14, -5),
    obstacle("conference-podium", "تریبون سخنران", "counter", -5, -8, 1.2, 0.8, 1.2, false),
    ...gridPresets("conference-seating", ["gym-bleacher"], [-15, -5, 5, 15], [0, 5]),
    // Registration desks either side of a clear walk from the doors to the hall.
    ...presetObstacles("conference-registration", [
      ["reception-desk", -6, 14], ["service-counter", 6, 14], ["queue-barrier", -7, 11.5], ["waiting-bench", 13, 13.2]
    ]),
    onWall("conference-vending", "vending-machine", "north", 10, 16, partitionThicknessM),
    onWall("conference-av-rack", "equipment-rack", "east", 24, -6.6),
    onWall("conference-av-filing", "filing-cabinet", "west", 12, -10, partitionThicknessM),
    ...presetObstacles("conference-av-assets", [["office-desk", 16, -10], ["office-chair", 16, -8.8, 180]]),
    ...[-18, 18].map((x, index) => presetObstacle(`conference-hall-column-${index + 1}`, "structural-column", x, 8))
  ], 5.2);
  ground.coverageRequirements = [
    zone("conference-entrance-zone", "conference.entrance", "ورودی سالن", -2.5, 15.5, 2.5, 17.9)
  ];
  return building([ground]);
}

/**
 * A glazed car showroom: street front to the south, stock yard behind, delivery bay east.
 *
 * Display cars stand at an angle with clear walking routes, and a 4 m vehicle door on the
 * east façade leads straight onto the delivery pad. The sales office is glazed onto the
 * floor; the parts store has its own counter door and a rear exit to the stock yard.
 */
function carShowroomPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const outline: Vec2[] = [
    { x: -20, z: -13 }, { x: 15, z: -13 }, { x: 22, z: -6 }, { x: 22, z: 11 },
    { x: 17, z: 16 }, { x: -20, z: 16 }, { x: -25, z: 11 }, { x: -25, z: -8 }
  ];
  const ground = floor("car-showroom-ground", "شوروم، فروش، قطعات و تحویل خودرو", 0, [
    ...polygonEnvelope("car-showroom", outline, 4.5),
    glassPartition("car-showroom-sales-wall", -12, -3, -12, 16, 4.5),
    partition("car-showroom-parts-wall", -25, -3, -7, -3, 4.5),
    partition("car-showroom-parts-east", -7, -13, -7, -3, 4.5)
  ], [
    { ...door("car-showroom-main-entry", "car-showroom-envelope-5", 0.3514, 2.4), variant: "double-glass", swingDirection: "inward" },
    { ...door("car-showroom-vehicle-delivery", "car-showroom-envelope-3", 0.5, 4), variant: "double-solid", swingDirection: "outward" },
    { ...door("car-showroom-sales-door", "car-showroom-sales-wall", 0.4737, 1.2), variant: "single-glass" },
    door("car-showroom-parts-door", "car-showroom-parts-east", 0.7, 1.2),
    { ...door("car-showroom-parts-service-exit", "car-showroom-envelope-1", 0.1714, 1.4), swingDirection: "outward" },
    windowOpening("car-showroom-window-front-a", "car-showroom-envelope-5", 0.1351, 5),
    windowOpening("car-showroom-window-front-b", "car-showroom-envelope-5", 0.5676, 4),
    windowOpening("car-showroom-window-sales", "car-showroom-envelope-5", 0.9189, 2.4),
    windowOpening("car-showroom-window-east", "car-showroom-envelope-3", 0.1765, 2.5)
  ], [
    // Showroom floor: angled display cars, brochure stand and customer lounge.
    ...presetObstacles("car-showroom-display", [
      ["sedan", 2, -7, 330], ["suv", 12, -7, 30], ["pickup", 1, 6, 340], ["sedan", 13, 7, 20],
      ["display-stand", 8, 13], ["lobby-sofa", -7, 13.4, 180], ["coffee-table", -7, 12]
    ]),
    // Sales office: reception by the glass door, two sales desks and a contract table.
    presetObstacle("car-showroom-reception", "reception-desk", -13.6, 9.5, 90),
    ...[-20, -16].flatMap((x, index) => [
      presetObstacle(`car-showroom-sales-desk-${index + 1}`, "office-desk", x, 2),
      presetObstacle(`car-showroom-sales-staff-${index + 1}`, "office-chair", x, 1.05, 0),
      presetObstacle(`car-showroom-sales-client-a-${index + 1}`, "office-chair", x - 0.45, 2.95, 180),
      presetObstacle(`car-showroom-sales-client-b-${index + 1}`, "office-chair", x + 0.45, 2.95, 180)
    ]),
    presetObstacle("car-showroom-contract-table", "meeting-table", -18.5, 9),
    ...tableChairs("car-showroom-contract-chairs", -18.5, 9, 0, "office-chair"),
    ...alongWall("car-showroom-sales-filing", "filing-cabinet", "north", -3, [-23.5, -22.3], t),
    // Parts store: racking on the walls, counter by the showroom door.
    ...alongWall("car-showroom-parts-rack-north", "storage-rack", "north", -13, [-16.5, -10.5]),
    ...alongWall("car-showroom-parts-rack-south", "storage-rack", "south", -3, [-18, -14], t),
    presetObstacle("car-showroom-parts-counter", "packing-table", -9.5, -7.5, 90),
    presetObstacle("car-showroom-parts-crates", "crate-stack", -22, -5.5),
    // Delivery bay outside the vehicle door, with the car being handed over.
    obstacle("car-showroom-delivery-pad", "سکوی تحویل خودرو", "surface", 26.1, 2.5, 8, 8, 0.05, false),
    presetObstacle("car-showroom-delivery-car", "sedan", 26.5, 2.5, 0),
    // Stock yard behind the showroom.
    ...parkingRow("car-showroom-yard-car", ["sedan", "suv", "sedan", "pickup", "sedan"], [-19, -16.5, -11.5, -9, -6.5, -4, -1.5, 1, 3.5, 6], -17.6, "south"),
    sizedPreset("car-showroom-yard-road", "road", 0, -22.5, 44, 4),
    presetObstacle("car-showroom-yard-barrier", "parking-barrier", 14, -22.5, 90),
    ...presetObstacles("car-showroom-yard-poles", [["camera-pole", 16, -19], ["light-pole", -22, -18], ["light-pole", 10, -18]]),
    // Street frontage.
    sizedPreset("car-showroom-street", "road", 0, 20, 46, 4)
  ], 4.8);
  ground.coverageRequirements = [
    zone("car-showroom-delivery-zone", "car-showroom.delivery", "محل تحویل خودرو", 22.2, -1.6, 30.2, 6.6),
    zone("car-showroom-yard-zone", "car-showroom.yard", "محوطه پارک خودروهای موجودی", -21, -20.6, 9, -13.4)
  ];
  return building([ground]);
}

/** A neighbourhood bus terminal with a curved ticket hall, platform and two bus bays. */
function busTerminalPlan(): BuildingPlan {
  const ticketOutline: Vec2[] = [
    { x: -18, z: -7 }, { x: 4, z: -7 }, { x: 8, z: -3 }, { x: 8, z: 8 },
    { x: 4, z: 12 }, { x: -18, z: 12 }, { x: -22, z: 8 }, { x: -22, z: -3 }
  ];
  const buses = [
    // Both buses pull in southbound, doors to the platform on their right.
    { ...sizedPreset("bus-terminal-bus-a", "bus", 18, -10, 11, 2.55, 90), heightM: 3.3 },
    { ...sizedPreset("bus-terminal-bus-b", "bus", 18, 8, 11, 2.55, 90), heightM: 3.3 }
  ];
  const ground = floor("bus-terminal-ground", "پایانه اتوبوس، بلیت و سکوی انتظار", 0, [
    ...polygonEnvelope("bus-terminal-ticket-hall", ticketOutline, 3.8)
  ], [
    { ...door("bus-terminal-main-entry", "bus-terminal-ticket-hall-envelope-5", 0.55, 2), variant: "double-glass", swingDirection: "inward" },
    door("bus-terminal-platform-door", "bus-terminal-ticket-hall-envelope-3", 0.5, 1.8),
    windowOpening("bus-terminal-ticket-window", "bus-terminal-ticket-hall-envelope-1", 0.55, 3),
    windowOpening("bus-terminal-side-window", "bus-terminal-ticket-hall-envelope-7", 0.5, 2.2)
  ], [
    ...presetObstacles("bus-terminal-ticket-assets", [
      ["service-counter", -13, -4], ["service-counter", -7, -4], ["queue-barrier", -10, 0],
      ["waiting-bench", -15, 5], ["waiting-bench", -7, 5]
    ]),
    onWall("bus-terminal-ticket-rack", "equipment-rack", "east", 8, 5.5),
    ...buses,
    // Platform alongside the bus lane: benches face the bays, bollards line the kerb.
    ...presetObstacles("bus-terminal-platform", [
      ["waiting-bench", 12.4, -11, 270], ["waiting-bench", 12.4, -5, 270], ["waiting-bench", 12.4, 6, 270], ["waiting-bench", 12.4, 11, 270],
      ["road", 18, -24, 90], ["road", 18, -12, 90], ["road", 18, 0, 90], ["road", 18, 12, 90], ["road", 18, 24, 90],
      ["bollard", 15.5, -14], ["bollard", 15.5, -7], ["bollard", 15.5, 0], ["bollard", 15.5, 7], ["bollard", 15.5, 13]
    ]),
    ...presetObstacles("bus-terminal-security", [
      ["camera-pole", -27, 17], ["camera-pole", 29, 17], ["light-pole", -27, -14], ["light-pole", 29, -14],
      ["guard-booth", 22.5, -20], ["parking-barrier", 18, -22]
    ]),
    obstacle("bus-terminal-shelter", "سایبان منحنی انتظار", "surface", 12.5, -1, 4, 30, 0.15, false),
    ...[-14, -7, 0, 7, 13].map((z, index) => presetObstacle(`bus-terminal-shelter-column-${index + 1}`, "structural-column", 10.8, z))
  ], 4);
  ground.coverageRequirements = [
    zone("bus-terminal-platform-zone", "bus-station.platform", "لبه سکوی سوار و پیاده شدن", 13.5, -14, 16, 13),
    zone("bus-terminal-shelter-zone", "bus-station.shelter", "سرپناه انتظار", 11, -10, 13.4, 10),
    zone("bus-terminal-lane-zone", "bus-station.bus-lane", "مسیر ورود اتوبوس", 16.2, -24, 19.8, -16.5)
  ];
  return building([ground]);
}

/** A city bus shown as an editable rounded cabin beside a small fleet depot. */
function cityBusFleetPlan(): BuildingPlan {
  const cabinOutline: Vec2[] = [
    { x: -18, z: -5 }, { x: 15, z: -5 }, { x: 19, z: -2 }, { x: 19, z: 5 },
    { x: 15, z: 8 }, { x: -18, z: 8 }, { x: -22, z: 5 }, { x: -22, z: -2 }
  ];
  const ground = floor("city-bus-fleet-ground", "اتوبوس نمونه و توقفگاه ناوگان", 0, [
    ...polygonEnvelope("city-bus-cabin", cabinOutline, 3.2)
  ], [
    door("city-bus-passenger-door", "city-bus-cabin-envelope-3", 0.85, 1.4),
    door("city-bus-rear-door", "city-bus-cabin-envelope-7", 0.5, 1.3),
    windowOpening("city-bus-front-window", "city-bus-cabin-envelope-1", 0.82, 3),
    windowOpening("city-bus-side-window-a", "city-bus-cabin-envelope-5", 0.25, 3),
    windowOpening("city-bus-side-window-b", "city-bus-cabin-envelope-5", 0.7, 3)
  ], [
    ...gridPresets("city-bus-passenger-seats", ["waiting-bench"], [-14, -8, -2, 4, 10], [-1, 4]),
    presetObstacle("city-bus-driver-seat", "office-chair", 15, 1, 270),
    obstacle("city-bus-dashboard", "داشبورد راننده", "counter", 17, 1, 0.8, 2.8, 1.2, true, 90),
    ...presetObstacles("city-bus-depot-vehicles", [
      ["van", -16, 20, 90], ["truck", -5, 20, 90], ["van", 8, 20, 90], ["pickup", 18, 20, 90]
    ]),
    ...presetObstacles("city-bus-depot-assets", [
      ["road", -24, 28], ["road", -12, 28], ["road", 0, 28], ["road", 12, 28], ["road", 24, 28],
      ["road", -24, 20, 90], ["parking-barrier", 24, 28], ["guard-booth", 29, 26],
      ["camera-pole", -29, 25], ["camera-pole", 26.5, 22], ["light-pole", 0, 25]
    ]),
    obstacle("city-bus-wash-bay", "جایگاه شست‌وشوی ناوگان", "surface", -24, 16, 7, 13, 0.1, false)
  ], 3.4);
  ground.coverageRequirements = [
    zone("city-bus-door-zone", "transit-fleet.door", "درِ ورود مسافر", 16.5, 2.8, 18.8, 4.9),
    zone("city-bus-driver-zone", "transit-fleet.driver", "راننده و داشبورد", 14, -1.5, 18.8, 2.4),
    zone("city-bus-road-view-zone", "transit-fleet.road-view", "دید جلوی اتوبوس", 19.6, -2, 26, 5),
    zone("city-bus-depot-zone", "transit-fleet.depot", "محل توقف و مانور ناوگان", -19, 23, 21, 26.5)
  ];
  return building([ground]);
}

/** A secure operations room with operator hall, video wall and isolated UPS room. */
function securityControlRoomPlan(): BuildingPlan {
  const ground = floor("security-control-ground", "مرکز مانیتورینگ و برق پشتیبان", 0, [
    ...rectangle("security-control-shell", -18, -11, 18, 11, 3.6),
    glassPartition("security-control-lobby-wall", -18, 5, 18, 5, 3.6),
    partition("security-control-power-wall", 10, -11, 10, 5, 3.6),
    partition("security-control-video-wall", -18, -4, 10, -4, 3.6)
  ], [
    { ...door("security-control-main-entry", "security-control-shell-south", 0.5, 1.6), variant: "single-glass", swingDirection: "inward" },
    door("security-control-operator-door", "security-control-lobby-wall", 0.45, 1.3),
    door("security-control-power-door", "security-control-lobby-wall", 0.82, 1.1),
    door("security-control-video-door", "security-control-video-wall", 0.5, 1.3),
    windowOpening("security-control-window-front-a", "security-control-shell-south", 0.2, 2.2),
    windowOpening("security-control-window-front-b", "security-control-shell-south", 0.8, 2.2)
  ], [
    // Operator desk row; the briefing room behind carries the video wall.
    ...gridPresets("security-control-operator-desks", ["office-desk"], [-11, -4, 3], [0]),
    ...gridPresets("security-control-operator-chairs", ["office-chair"], [-11, -4, 3], [1.2], 180),
    ...alongWall("security-control-video-screen", "whiteboard", "north", -11, [-12, -4, 4]),
    presetObstacle("security-control-briefing-table", "meeting-table", -4, -6),
    onWall("security-control-filing", "filing-cabinet", "west", -18, -7),
    // Backup power: racks and UPS on the north wall, cabinet on the east wall.
    ...alongWall("security-control-power-rack", "equipment-rack", "north", -11, [12.6, 13.8]),
    ...alongWall("security-control-power-ups", "ups-unit", "north", -11, [15.2, 16.2]),
    onWall("security-control-power-cabinet", "tool-cabinet", "east", 18, 0),
    presetObstacle("security-control-power-bench", "workbench", 13.5, 3),
    ...presetObstacles("security-control-entry", [
      ["reception-desk", -5, 8], ["queue-barrier", -5, 6], ["waiting-bench", 4, 8]
    ])
  ], 3.8);
  return building([ground]);
}

/**
 * An urban electrical substation: a switchgear hall and a relay/control building inside a
 * fenced yard, with the two transformers on the bus line between them and the access road.
 *
 * Vehicles enter through the guarded sliding gate in the south-east corner and run along
 * the yard road in front of the transformers; footpaths lead from the road to each building.
 */
function urbanSubstationPlan(): BuildingPlan {
  const relayOutline: Vec2[] = [
    { x: 10, z: -9 }, { x: 22, z: -9 }, { x: 25, z: -6 }, { x: 25, z: 5 },
    { x: 22, z: 8 }, { x: 10, z: 8 }, { x: 7, z: 5 }, { x: 7, z: -6 }
  ];
  const ground = floor("urban-substation-ground", "پست برق، سوئیچگیر و اتاق رله", 0, [
    ...rectangle("urban-substation-switchgear", -24, -10, -5, 8, 4),
    ...polygonEnvelope("urban-substation-relay", relayOutline, 3.5)
  ], [
    door("urban-substation-switchgear-entry", "urban-substation-switchgear-south", 0.5, 1.5),
    door("urban-substation-relay-entry", "urban-substation-relay-envelope-5", 0.5, 1.2),
    windowOpening("urban-substation-switchgear-window", "urban-substation-switchgear-north", 0.5, 2.4),
    windowOpening("urban-substation-relay-window", "urban-substation-relay-envelope-3", 0.5, 2)
  ], [
    // Switchgear hall: two rows of high-voltage panels.
    ...gridPresets("urban-substation-switchgear-assets", ["equipment-rack"], [-21, -16, -11, -7], [-5, 2], 90),
    // Relay room: protection racks and console on the walls, engineer's desk in the middle.
    ...alongWall("urban-substation-relay-rack", "equipment-rack", "east", 25, [-4.6, -3.4]),
    onWall("urban-substation-relay-console", "monitoring-console", "north", -9, 13),
    presetObstacle("urban-substation-relay-console-chair", "office-chair", 13, -7.6, 180),
    presetObstacle("urban-substation-relay-desk", "office-desk", 15, 0),
    presetObstacle("urban-substation-relay-desk-chair", "office-chair", 15, 1, 180),
    onWall("urban-substation-relay-filing", "filing-cabinet", "west", 7, 0),
    onWall("urban-substation-relay-tools", "tool-cabinet", "north", -9, 19),
    // Transformer bay on the bus line, in front of the yard road.
    { ...sizedPreset("urban-substation-transformer-a", "transformer", -6, 17, 6, 5), label: "ترانسفورماتور یک", heightM: 4.5 },
    { ...sizedPreset("urban-substation-transformer-b", "transformer", 6, 17, 6, 5), label: "ترانسفورماتور دو", heightM: 4.5 },
    ...[-18, 0, 12].map((x, index) => presetObstacle(`urban-substation-bus-column-${index + 1}`, "structural-column", x, 12)),
    // Yard road from the gate, with footpaths to both buildings.
    sizedPreset("urban-substation-yard-road", "road", 2, 24, 42, 4),
    sizedPreset("urban-substation-gate-road", "road", 20, 29.5, 6, 7),
    sizedPreset("urban-substation-switchgear-path", "road", -14.5, 15, 3, 14),
    sizedPreset("urban-substation-relay-path", "road", 16, 15, 3, 14),
    // Mesh perimeter fence with the sliding gate and guard booth.
    sizedPreset("urban-substation-fence-north", "fence-mesh", 0, -14, 56, 0.1),
    sizedPreset("urban-substation-fence-west", "fence-mesh", -28, 8.5, 45, 0.1, 90),
    sizedPreset("urban-substation-fence-east", "fence-mesh", 28, 8.5, 45, 0.1, 90),
    sizedPreset("urban-substation-fence-south-west", "fence-mesh", -5.25, 31, 45.5, 0.1),
    sizedPreset("urban-substation-fence-south-east", "fence-mesh", 25.25, 31, 5.5, 0.1),
    presetObstacle("urban-substation-gate", "gate-sliding", 20, 31),
    presetObstacle("urban-substation-guard-booth", "guard-booth", 25.5, 28),
    ...presetObstacles("urban-substation-poles", [
      ["camera-pole", -27, 30], ["light-pole", -27, -13], ["light-pole", 27, -13]
    ]),
    sizedPreset("urban-substation-street", "road", 0, 35, 60, 4)
  ], 4.2);
  ground.coverageRequirements = [
    zone("urban-substation-transformer-zone", "substation.transformer", "جلوی ترانسفورماتورها", -10, 19.7, 10, 21.8),
    zone("urban-substation-gate-zone", "substation.gate", "گیت ورود پست", 17.5, 26.5, 22.5, 30.8),
    zone("urban-substation-perimeter-zone", "substation.perimeter", "حصار شمالی پست", -24, -13.8, 0, -12.3)
  ];
  return building([ground]);
}

/**
 * A regional distribution warehouse: two blocks of long rack rows on the west, a staging
 * and packing floor behind the two dock doors, and the stock-control office in the
 * south-east corner with its own staff door.
 *
 * Trucks come in through the guarded gate in the north yard fence and back onto the
 * loading platforms outside the dock doors.
 */
function regionalWarehousePlan(): BuildingPlan {
  const t = partitionThicknessM;
  const rackRows = [-24, -19, -14, -9, -4];
  const ground = floor("regional-warehouse-ground", "انبار منطقه‌ای، بارانداز و کنترل موجودی", 0, [
    ...rectangle("regional-warehouse-shell", -28, -16, 28, 16, 6),
    partition("regional-warehouse-office-wall", 14, 6, 28, 6, 4),
    partition("regional-warehouse-office-split", 14, 6, 14, 16, 4)
  ], [
    { ...door("regional-warehouse-dock-door-a", "regional-warehouse-shell-north", 0.6429, 4), variant: "double-solid", swingDirection: "outward" },
    { ...door("regional-warehouse-dock-door-b", "regional-warehouse-shell-north", 0.8214, 4), variant: "double-solid", swingDirection: "outward" },
    { ...door("regional-warehouse-staff-entry", "regional-warehouse-shell-south", 0.125, 1.2), swingDirection: "inward" },
    door("regional-warehouse-office-door", "regional-warehouse-office-wall", 0.2143, 1.2),
    windowOpening("regional-warehouse-office-window", "regional-warehouse-shell-east", 0.8438, 2.4),
    windowOpening("regional-warehouse-vent", "regional-warehouse-shell-west", 0.35, 2)
  ], [
    // Rack rows running north-south with a cross aisle between the two blocks.
    ...rackRows.flatMap((x, index) => [
      sizedPreset(`regional-warehouse-rack-north-${index + 1}`, "storage-rack", x, -7.6, 12.8, 1.1, 90),
      sizedPreset(`regional-warehouse-rack-south-${index + 1}`, "storage-rack", x, 9, 10.8, 1.1, 90)
    ]),
    // Staging behind the dock doors and the packing line.
    ...presetObstacles("regional-warehouse-staging", [
      ["pallet-stack", 3, -13], ["pallet-stack", 3, -11], ["pallet-stack", 13, -13], ["pallet-stack", 13, -11],
      ["pallet-stack", 23, -13], ["pallet-stack", 23, -11],
      ["packing-table", 6, -3], ["packing-table", 12, -3], ["packing-table", 18, -3],
      ["crate-stack", 4, 10], ["crate-stack", 8, 10]
    ]),
    // Stock-control office.
    ...presetObstacles("regional-warehouse-office", [
      ["office-desk", 18, 10.5], ["office-chair", 18, 11.5, 180], ["office-desk", 23, 10.5], ["office-chair", 23, 11.5, 180]
    ]),
    onWall("regional-warehouse-office-filing", "filing-cabinet", "east", 28, 8),
    onWall("regional-warehouse-office-rack", "equipment-rack", "west", 14, 14, t),
    // Dock platforms with trucks backed onto them.
    presetObstacle("regional-warehouse-platform-a", "loading-platform", 8, -17.3),
    presetObstacle("regional-warehouse-platform-b", "loading-platform", 18, -17.3),
    presetObstacle("regional-warehouse-truck-a", "truck", 8, -22.6, 270),
    presetObstacle("regional-warehouse-truck-b", "truck", 18, -22.6, 270),
    sizedPreset("regional-warehouse-yard", "road", 4, -27, 48, 20),
    presetObstacle("regional-warehouse-waiting-van", "van", -12, -30, 0),
    // Yard fence with the guarded truck gate onto the street.
    sizedPreset("regional-warehouse-fence-north-west", "fence-mesh", -7.25, -38, 49.5, 0.1),
    sizedPreset("regional-warehouse-fence-north-east", "fence-mesh", 27.25, -38, 9.5, 0.1),
    sizedPreset("regional-warehouse-fence-west", "fence-mesh", -32, -27, 22, 0.1, 90),
    sizedPreset("regional-warehouse-fence-east", "fence-mesh", 32, -27, 22, 0.1, 90),
    sizedPreset("regional-warehouse-fence-link-west", "fence-mesh", -30, -16, 4, 0.1),
    sizedPreset("regional-warehouse-fence-link-east", "fence-mesh", 30, -16, 4, 0.1),
    presetObstacle("regional-warehouse-gate", "gate-sliding", 20, -38),
    presetObstacle("regional-warehouse-barrier", "parking-barrier", 20, -35),
    presetObstacle("regional-warehouse-guard-booth", "guard-booth", 29.5, -35),
    ...presetObstacles("regional-warehouse-poles", [["camera-pole", -31, -37], ["light-pole", -31, -17], ["light-pole", 31, -17]]),
    sizedPreset("regional-warehouse-gate-road", "road", 20, -40, 6, 4),
    sizedPreset("regional-warehouse-street", "road", 0, -44, 70, 4)
  ], 6.2);
  ground.coverageRequirements = [
    zone("regional-warehouse-dock-zone", "warehouse.dock", "سکوهای بارانداز", 4, -18.6, 22, -16.2),
    zone("regional-warehouse-gate-zone", "warehouse.vehicle-gate", "گیت کامیون و راهبند", 17.5, -37.8, 22.5, -33.5),
    zone("regional-warehouse-perimeter-zone", "warehouse.perimeter", "حصار شمالی محوطه", -30, -37.8, -6, -36.3)
  ];
  return building([ground]);
}

/**
 * A light three-level neighbourhood mall on one rectangular footprint.
 *
 * Basement: a car park with a ramp gate, guard booth and four rows of bays. Ground: the
 * glazed entrance hall leads into a T-shaped concourse lined by shop units, with the
 * escalator atrium, control room and stair core on its north side. First floor: food
 * stalls around the food-court hall. Stair, lifts and escalators line up on every floor.
 */
function neighbourhoodMallPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const stairs: [number, number] = [7.5, -9.5];
  const lift: [number, number] = [0, -13.4];
  const atrium = (prefix: string): PlanObstacle[] => [
    presetObstacle(`${prefix}-escalator-up`, "escalator", -2.5, -10, 90),
    presetObstacle(`${prefix}-escalator-down`, "escalator", 2.5, -10, 90),
    presetObstacle(`${prefix}-glass-lift`, "elevator", lift[0], lift[1])
  ];
  /** A retail unit: wall shelving on one side, stock in the middle, till beside the door. */
  const shopUnit = (prefix: string, left: number, right: number, side: "north" | "south", clothing: boolean): PlanObstacle[] => {
    const mid = (left + right) / 2;
    const sign = side === "south" ? 1 : -1;
    const leftThickness = left === -22 ? wallThicknessM : t;
    const shelvesAt = [7, 10, 13].map((z) => z * sign);
    return [
      ...alongWall(`${prefix}-shelf`, "shelving-unit", "west", left, shelvesAt, leftThickness),
      ...[9.5, 12.5].map((z, index) => presetObstacle(
        `${prefix}-${clothing ? "rack" : "stand"}-${index + 1}`,
        clothing ? "clothing-rack" : "display-stand",
        mid + 0.6,
        z * sign,
        clothing ? 90 : 0
      )),
      presetObstacle(`${prefix}-checkout`, "checkout-counter", mid + 1.6, 4.7 * sign, 90),
      presetObstacle(`${prefix}-cashier`, "office-chair", mid + 2.35, 4.7 * sign, 90)
    ];
  };

  const basement = floor("neighbourhood-mall-basement", "زیرزمین، پارکینگ و ورودی خودرو", -1, [
    ...rectangle("neighbourhood-mall-basement-shell", -22, -15, 22, 15, 3.2),
    partition("neighbourhood-mall-basement-stair-west", 5, -15, 5, -3, 3.2),
    partition("neighbourhood-mall-basement-stair-east", 10, -15, 10, -3, 3.2),
    partition("neighbourhood-mall-basement-stair-front", 5, -3, 10, -3, 3.2),
    partition("neighbourhood-mall-basement-lift-west", -2.5, -15, -2.5, -10, 3.2),
    partition("neighbourhood-mall-basement-lift-east", 2.5, -15, 2.5, -10, 3.2),
    partition("neighbourhood-mall-basement-lift-front", -2.5, -10, 2.5, -10, 3.2)
  ], [
    { ...door("neighbourhood-mall-parking-gate", "neighbourhood-mall-basement-shell-south", 0.1364, 5), variant: "double-solid" },
    door("neighbourhood-mall-basement-stair-door", "neighbourhood-mall-basement-stair-front", 0.5, 1.2),
    door("neighbourhood-mall-basement-lift-door", "neighbourhood-mall-basement-lift-front", 0.5, 1.4)
  ], [
    ...parkingRow("neighbourhood-mall-bay-a", ["sedan", "suv"], [-19, -16.3, -13.6, -10.9, -8.2, -5.5, 12.5, 15.2, 17.9, 20.6], -12.4, "north"),
    ...parkingRow("neighbourhood-mall-bay-b", ["sedan", "suv", "sedan"], [-19, -16.3, -13.6, -10.9, -8.2, -5.5, -2.8, 0, 2.7, 5.4, 10.8, 13.5, 16.2, 18.9], -0.4, "south"),
    ...parkingRow("neighbourhood-mall-bay-c", ["suv", "sedan"], [-19, -16.3, -13.6, -10.9, -8.2, -5.5, -2.8, 0, 2.7, 5.4, 10.8, 13.5, 16.2, 18.9], 4.4, "north"),
    ...parkingRow("neighbourhood-mall-bay-d", ["sedan", "sedan", "suv"], [-19, -16.3, -13.6, -10.9, -8.2, -5.5, -2.8, 0, 2.7, 5.4, 8.1, 10.8], 12.5, "south"),
    ...presetObstacles("neighbourhood-mall-parking-assets", [
      ["parking-barrier", 16, 13.2], ["speed-bump", 16, 11.5], ["guard-booth", 20, 9]
    ]),
    presetObstacle("neighbourhood-mall-basement-stairs", "stairs-straight", stairs[0], stairs[1], 90),
    presetObstacle("neighbourhood-mall-basement-lift", "elevator", lift[0], lift[1])
  ], 3.4);
  basement.coverageRequirements = [
    zone("neighbourhood-mall-gate-zone", "mall.parking", "درِ ورود و خروج پارکینگ", 13.4, 11, 18.6, 14.9)
  ];

  const ground = floor("neighbourhood-mall-ground", "همکف، ورودی، راهروی تجاری و اتاق کنترل", 0, [
    ...rectangle("neighbourhood-mall-ground-shell", -22, -15, 22, 15, 4.5),
    partition("neighbourhood-mall-concourse-north", -22, -3, 22, -3, 4.5),
    partition("neighbourhood-mall-concourse-south-west", -22, 3, -5, 3, 4.5),
    partition("neighbourhood-mall-concourse-south-east", 5, 3, 22, 3, 4.5),
    partition("neighbourhood-mall-entry-west", -5, 3, -5, 15, 4.5),
    partition("neighbourhood-mall-entry-east", 5, 3, 5, 15, 4.5),
    glassPartition("neighbourhood-mall-entry-inner", -5, 9, 5, 9, 4.5),
    ...[-13.5, -5, 5, 10, 16].map((x, index) => partition(`neighbourhood-mall-ground-north-${index + 1}`, x, -15, x, -3, 4.5)),
    ...[-16.33, -10.67, 10.67, 16.33].map((x, index) => partition(`neighbourhood-mall-ground-south-${index + 1}`, x, 3, x, 15, 4.5))
  ], [
    { ...door("neighbourhood-mall-main-entry", "neighbourhood-mall-ground-shell-south", 0.5, 3), variant: "double-glass", swingDirection: "inward" },
    { ...door("neighbourhood-mall-entry-inner-door", "neighbourhood-mall-entry-inner", 0.5, 3), variant: "double-glass", swingDirection: "inward" },
    ...[0.0966, 0.2898, 0.9318].map((offset, index) => ({ ...door(`neighbourhood-mall-shop-n${index + 1}-door`, "neighbourhood-mall-concourse-north", offset, 2), variant: "double-glass" as const })),
    { ...door("neighbourhood-mall-atrium-opening", "neighbourhood-mall-concourse-north", 0.5, 6), variant: "double-glass" },
    door("neighbourhood-mall-stair-door", "neighbourhood-mall-concourse-north", 0.6705, 1.2),
    door("neighbourhood-mall-control-door", "neighbourhood-mall-concourse-north", 0.7955, 1),
    ...[0.1647, 0.5, 0.8353].map((offset, index) => ({ ...door(`neighbourhood-mall-shop-s${index + 1}-door`, "neighbourhood-mall-concourse-south-west", offset, 2), variant: "double-glass" as const })),
    ...[0.1647, 0.5, 0.8353].map((offset, index) => ({ ...door(`neighbourhood-mall-shop-s${index + 4}-door`, "neighbourhood-mall-concourse-south-east", offset, 2), variant: "double-glass" as const })),
    ...[0.9364, 0.8068, 0.6773, 0.3227, 0.1932, 0.0636].map((offset, index) => windowOpening(`neighbourhood-mall-shopfront-${index + 1}`, "neighbourhood-mall-ground-shell-south", offset, 3))
  ], [
    // Shop units along both sides of the concourse.
    ...shopUnit("neighbourhood-mall-shop-n1", -22, -13.5, "north", true),
    ...shopUnit("neighbourhood-mall-shop-n2", -13.5, -5, "north", false),
    ...shopUnit("neighbourhood-mall-shop-n3", 16, 22, "north", true),
    ...shopUnit("neighbourhood-mall-shop-s1", -22, -16.33, "south", false),
    ...shopUnit("neighbourhood-mall-shop-s2", -16.33, -10.67, "south", true),
    ...shopUnit("neighbourhood-mall-shop-s3", -10.67, -5, "south", false),
    ...shopUnit("neighbourhood-mall-shop-s4", 5, 10.67, "south", false),
    ...shopUnit("neighbourhood-mall-shop-s5", 10.67, 16.33, "south", true),
    ...shopUnit("neighbourhood-mall-shop-s6", 16.33, 22, "south", false),
    // Entrance hall with the information desk beside the inner doors.
    presetObstacle("neighbourhood-mall-info-desk", "reception-desk", 3, 11.6, 90),
    onWall("neighbourhood-mall-entry-bench", "waiting-bench", "west", -5, 12, t),
    // Concourse seating.
    ...presetObstacles("neighbourhood-mall-concourse-seats", [["waiting-bench", -12, 0], ["waiting-bench", 12, 0]]),
    // Escalator atrium and stair core.
    ...atrium("neighbourhood-mall-ground"),
    presetObstacle("neighbourhood-mall-ground-stairs", "stairs-straight", stairs[0], stairs[1], 90),
    // Control room: video console on the rear wall, recorder rack and supervisor desk.
    onWall("neighbourhood-mall-control-console", "monitoring-console", "north", -15, 13),
    ...presetObstacles("neighbourhood-mall-control-operators", [["office-chair", 12.4, -13.2, 180], ["office-chair", 13.6, -13.2, 180]]),
    onWall("neighbourhood-mall-control-rack", "equipment-rack", "west", 10, -9, t),
    onWall("neighbourhood-mall-control-ups", "ups-unit", "west", 10, -7.8, t),
    onWall("neighbourhood-mall-control-desk", "office-desk", "east", 16, -6, t),
    presetObstacle("neighbourhood-mall-control-desk-chair", "office-chair", 14.75, -6, 270),
    // Street and the ramp down to the car park.
    sizedPreset("neighbourhood-mall-street", "road", 0, 19, 48, 4),
    sizedPreset("neighbourhood-mall-ramp", "road", 16, 18.5, 6, 7)
  ], 4.6);

  const first = floor("neighbourhood-mall-first", "طبقه اول، فودکورت و هسته دسترسی", 1, [
    ...rectangle("neighbourhood-mall-first-shell", -22, -15, 22, 15, 4.2),
    partition("neighbourhood-mall-first-stall-front", -22, -3, 22, -3, 4.2),
    ...[-13.5, -5, 5, 10, 16].map((x, index) => partition(`neighbourhood-mall-first-north-${index + 1}`, x, -15, x, -3, 4.2))
  ], [
    ...[0.0966, 0.2898, 0.7955, 0.9318].map((offset, index) => door(`neighbourhood-mall-food-stall-${index + 1}`, "neighbourhood-mall-first-stall-front", offset, 3)),
    { ...door("neighbourhood-mall-first-atrium-opening", "neighbourhood-mall-first-stall-front", 0.5, 6), variant: "double-glass" },
    door("neighbourhood-mall-first-stair-door", "neighbourhood-mall-first-stall-front", 0.6705, 1.2),
    ...[0.2, 0.5, 0.8].map((offset, index) => windowOpening(`neighbourhood-mall-first-window-${index + 1}`, "neighbourhood-mall-first-shell-south", offset, 6))
  ], [
    // Food stalls: serving counter to the hall, kitchen line on the back wall.
    ...[
      { prefix: "neighbourhood-mall-stall-1", mid: -17.75, kitchen: -19.5, stove: -17.9 },
      { prefix: "neighbourhood-mall-stall-2", mid: -9.25, kitchen: -11, stove: -9.4 },
      { prefix: "neighbourhood-mall-stall-3", mid: 13, kitchen: 12, stove: 13.5 },
      { prefix: "neighbourhood-mall-stall-4", mid: 19, kitchen: 18.5, stove: 20 }
    ].flatMap(({ prefix, mid, kitchen, stove }) => [
      presetObstacle(`${prefix}-counter`, "service-counter", mid, -4.8),
      onWall(`${prefix}-kitchen`, "kitchen-counter", "north", -15, kitchen),
      onWall(`${prefix}-stove`, "stove", "north", -15, stove)
    ]),
    onWall("neighbourhood-mall-stall-1-fridge", "fridge", "west", -22, -12),
    onWall("neighbourhood-mall-stall-2-fridge", "display-fridge", "east", -5, -12, t),
    onWall("neighbourhood-mall-stall-3-fridge", "fridge", "east", 16, -12, t),
    onWall("neighbourhood-mall-stall-4-fridge", "fridge", "east", 22, -12),
    // Food-court hall.
    ...[-18, -12, -6, 0, 6, 12, 18].flatMap((x) => [1.5, 6.5, 11.5].map((z) => [x, z] as const)).flatMap(([x, z], index) => [
      presetObstacle(`neighbourhood-mall-food-table-${index + 1}`, "dining-table", x, z),
      ...tableChairs(`neighbourhood-mall-food-chairs-${index + 1}`, x, z, 0, "dining-chair")
    ]),
    ...atrium("neighbourhood-mall-first"),
    topLanding("neighbourhood-mall-first-landing", stairs[0], stairs[1], 90)
  ], 4.4);
  return stackBuilding([basement, ground, first], ground.id);
}

/**
 * A pipeline monitoring site: the main line runs east-west past a fenced pumping station.
 *
 * Inline valve stations split the run, a branch pipe feeds the two pumps inside the
 * station, and a leak-detection post stands beside the line. Vehicles reach the station
 * through the guarded gate on its north fence; a service track follows the pipe.
 */
function pipelineMonitoringStationPlan(): BuildingPlan {
  const pumpOutline: Vec2[] = [
    { x: 15, z: -8 }, { x: 27, z: -8 }, { x: 30, z: -5 }, { x: 30, z: 7 },
    { x: 27, z: 10 }, { x: 15, z: 10 }, { x: 12, z: 7 }, { x: 12, z: -5 }
  ];
  const valveXs = [-22, -8, 6];
  const valveHalf = 1.25;
  // Pipe runs between the inline valves, from the west edge of the site to the east edge.
  const runEnds = [-36, ...valveXs.flatMap((x) => [x - valveHalf, x + valveHalf]), 36];
  const pipeRuns = Array.from({ length: runEnds.length / 2 }, (_, index) => {
    const [from, to] = [runEnds[index * 2], runEnds[index * 2 + 1]];
    return { ...sizedPreset(`pipeline-route-run-${index + 1}`, "pipeline", (from + to) / 2, 18, to - from, 0.7), label: "مسیر خط لوله", heightM: 1.1 };
  });
  const ground = floor("pipeline-monitoring-ground", "خط لوله، شیرآلات و ایستگاه پمپاژ", 0, [
    ...polygonEnvelope("pipeline-pump-room", pumpOutline, 4)
  ], [
    door("pipeline-pump-entry", "pipeline-pump-room-envelope-1", 0.5, 1.5),
    windowOpening("pipeline-pump-window-a", "pipeline-pump-room-envelope-5", 0.5, 2.2),
    windowOpening("pipeline-pump-window-b", "pipeline-pump-room-envelope-3", 0.5, 1.8)
  ], [
    ...pipeRuns,
    ...valveXs.map((x, index) => ({ ...sizedPreset(`pipeline-valve-${index + 1}`, "pipe-valve", x, 18, 2.5, 2.5), label: "مجموعه شیر خط", heightM: 2.2 })),
    { ...sizedPreset("pipeline-branch", "pipeline", 26, 13.95, 7.3, 0.7, 90), label: "انشعاب ورودی پمپ", heightM: 1.1 },
    obstacle("pipeline-leak-monitor", "نقطه پایش نشتی", "pillar", 0, 19.5, 1.2, 1.2, 2.4, true),
    // Pump room: two pumps on the branch, control desk, rack and tools on the walls.
    ...[19, 25].map((x, index) => ({ ...sizedPreset(`pipeline-pump-${index + 1}`, "pump-unit", x, 5, 3, 1.6), label: "پمپ خط", heightM: 1.8 })),
    onWall("pipeline-pump-desk", "office-desk", "north", -8, 16.5),
    presetObstacle("pipeline-pump-desk-chair", "office-chair", 16.5, -6.75, 180),
    onWall("pipeline-pump-rack", "equipment-rack", "east", 30, -2),
    onWall("pipeline-pump-tools", "tool-cabinet", "west", 12, 2),
    presetObstacle("pipeline-pump-workbench", "workbench", 25, -3),
    // Station compound: mesh fence, gate and guard booth on the north side.
    sizedPreset("pipeline-fence-north-west", "fence-mesh", 13.25, -14, 10.5, 0.1),
    sizedPreset("pipeline-fence-north-east", "fence-mesh", 29.75, -14, 12.5, 0.1),
    sizedPreset("pipeline-fence-west", "fence-mesh", 8, 0, 28, 0.1, 90),
    sizedPreset("pipeline-fence-east", "fence-mesh", 36, 0, 28, 0.1, 90),
    sizedPreset("pipeline-fence-south-west", "fence-mesh", 16.75, 14, 17.5, 0.1),
    sizedPreset("pipeline-fence-south-east", "fence-mesh", 31.25, 14, 9.5, 0.1),
    presetObstacle("pipeline-gate", "gate-sliding", 21, -14),
    presetObstacle("pipeline-guard-booth", "guard-booth", 27, -12),
    sizedPreset("pipeline-station-road", "road", 21, -11.15, 6, 5.7),
    presetObstacle("pipeline-station-pickup", "pickup", 14, -11, 0),
    sizedPreset("pipeline-gate-road", "road", 21, -18, 6, 8),
    sizedPreset("pipeline-street", "road", 0, -24, 80, 4),
    // Service track along the line.
    sizedPreset("pipeline-service-track", "road", 0, 25, 72, 4),
    presetObstacle("pipeline-patrol-pickup", "pickup", -20, 25, 180),
    ...presetObstacles("pipeline-poles", [["camera-pole", -35, 21], ["light-pole", 9, -13], ["light-pole", 35, 13]])
  ], 4.2);
  ground.coverageRequirements = [
    zone("pipeline-valve-zone", "pipeline.valve-station", "ایستگاه شیر میانی", -11, 19.4, -5, 21.6),
    zone("pipeline-route-zone", "pipeline.route", "مسیر خط لوله غربی", -36, 18.6, -24, 20.1),
    zone("pipeline-leak-zone", "pipeline.leak-point", "نقطه پایش نشتی", -2.5, 19, 2.5, 21.5)
  ];
  return building([ground]);
}

/**
 * A transmission right-of-way: five lattice towers carry the line east-west, and a fenced
 * step-down yard with its transformer and service room sits north of the corridor.
 *
 * A service track runs south of the towers; a spur crosses the corridor between two
 * towers to the yard gate, which a guard booth watches from inside the fence.
 */
function transmissionCorridorPlan(): BuildingPlan {
  const serviceOutline: Vec2[] = [
    { x: 18, z: -8 }, { x: 29, z: -8 }, { x: 32, z: -5 }, { x: 32, z: 6 },
    { x: 29, z: 9 }, { x: 18, z: 9 }, { x: 15, z: 6 }, { x: 15, z: -5 }
  ];
  const towers = [-28, -14, 0, 14, 28].flatMap((x, index) => [
    obstacle(`transmission-tower-mast-${index + 1}`, "دکل انتقال برق", "pillar", x, 17, 2.4, 2.4, 15, true),
    obstacle(`transmission-tower-arm-${index + 1}`, "بازوی دکل", "block", x, 17, 9, 0.6, 0.6, true)
  ]);
  const ground = floor("transmission-corridor-ground", "حریم انتقال، دکل‌ها و پست تبدیل", 0, [
    ...polygonEnvelope("transmission-service-room", serviceOutline, 3.8)
  ], [
    door("transmission-service-entry", "transmission-service-room-envelope-5", 0.5, 1.3),
    windowOpening("transmission-service-window-a", "transmission-service-room-envelope-1", 0.5, 2),
    windowOpening("transmission-service-window-b", "transmission-service-room-envelope-3", 0.5, 1.8)
  ], [
    ...towers,
    // Service room: protection racks, tools and the duty desk on the walls.
    ...alongWall("transmission-service-rack", "equipment-rack", "east", 32, [-3.4, -2.2]),
    onWall("transmission-service-tools", "tool-cabinet", "west", 15, 1),
    onWall("transmission-service-desk", "office-desk", "north", -8, 20.5),
    presetObstacle("transmission-service-desk-chair", "office-chair", 20.5, -6.75, 180),
    presetObstacle("transmission-service-workbench", "workbench", 21, 6),
    // Step-down yard: transformer, fence, gate and guard booth.
    { ...sizedPreset("transmission-transformer", "transformer", 6, -3, 6, 5), label: "ترانس کاهنده", heightM: 4.5 },
    sizedPreset("transmission-yard-fence-north", "fence-mesh", 18, -12, 36, 0.1),
    sizedPreset("transmission-yard-fence-west", "fence-mesh", 0, 0, 24, 0.1, 90),
    sizedPreset("transmission-yard-fence-east", "fence-mesh", 36, 0, 24, 0.1, 90),
    sizedPreset("transmission-yard-fence-south-west", "fence-mesh", 2.25, 12, 4.5, 0.1),
    sizedPreset("transmission-yard-fence-south-east", "fence-mesh", 22.75, 12, 26.5, 0.1),
    presetObstacle("transmission-yard-gate", "gate-sliding", 7, 12),
    presetObstacle("transmission-guard-booth", "guard-booth", 12, 9.5),
    presetObstacle("transmission-yard-pickup", "pickup", 7, -9.5, 0),
    // Service track along the corridor and the spur to the yard gate.
    sizedPreset("transmission-yard-road", "road", 7, 7, 4, 10),
    sizedPreset("transmission-spur-road", "road", 7, 18, 4, 12),
    sizedPreset("transmission-service-track", "road", 0, 26, 80, 4),
    presetObstacle("transmission-patrol-pickup", "pickup", -20, 26, 0),
    ...presetObstacles("transmission-poles", [["camera-pole", -35, 22], ["light-pole", 11, 22], ["light-pole", 1, -11]])
  ], 4);
  ground.coverageRequirements = [
    zone("transmission-tower-zone", "transmission-line.tower", "پای دکل شماره دو", -17, 19.4, -11, 21.6),
    zone("transmission-corridor-zone", "transmission-line.corridor", "حریم شمالی خط انتقال", -36, 13, -16, 14.5),
    zone("transmission-access-zone", "transmission-line.access", "ورود مسیر سرویس به پست", 2, 24.2, 12, 27.8)
  ];
  return building([ground]);
}

/**
 * A fenced onshore oil pad: control room in the west, two storage tanks with a tanker
 * loading lane, a row of three wellheads and the flare stack in the far corner.
 *
 * Vehicles enter through the guarded gate in the south fence and follow the field road;
 * a spur leads to the tanker lane and a footpath to the control room door.
 */
function onshoreOilFieldPlan(): BuildingPlan {
  const controlOutline: Vec2[] = [
    { x: -27, z: -9 }, { x: -13, z: -9 }, { x: -10, z: -6 }, { x: -10, z: 6 },
    { x: -13, z: 9 }, { x: -27, z: 9 }, { x: -30, z: 6 }, { x: -30, z: -6 }
  ];
  const roundTank = (id: string, x: number, z: number) => ({ ...presetObstacle(id, "storage-tank", x, z), label: "مخزن ذخیره نفت" });
  const ground = floor("onshore-oil-ground", "میدان نفتی خشکی و اتاق کنترل", 0, [
    ...polygonEnvelope("onshore-control-room", controlOutline, 4)
  ], [
    door("onshore-control-entry", "onshore-control-room-envelope-5", 0.5, 1.4),
    windowOpening("onshore-control-window-a", "onshore-control-room-envelope-1", 0.5, 2.2),
    windowOpening("onshore-control-window-b", "onshore-control-room-envelope-3", 0.5, 1.8)
  ], [
    // Control room: consoles under the north window, rack and filing on the side walls.
    ...alongWall("onshore-control-console", "monitoring-console", "north", -9, [-24.5, -15.5]),
    ...presetObstacles("onshore-control-console-chairs", [["office-chair", -24.5, -7.3, 180], ["office-chair", -15.5, -7.3, 180]]),
    onWall("onshore-control-rack", "equipment-rack", "east", -10, -3),
    onWall("onshore-control-filing", "filing-cabinet", "west", -30, 2),
    presetObstacle("onshore-control-meeting", "meeting-table", -17, 3),
    // Tank farm with the tanker loading lane in front.
    roundTank("onshore-tank-a", 12, -4),
    roundTank("onshore-tank-b", 23, -4),
    sizedPreset("onshore-tanker-lane", "road", 19, 4, 24, 4),
    presetObstacle("onshore-tanker", "truck", 17, 4, 180),
    // Wellheads and the flare stack away from them in the north-east corner.
    ...[-2, 8, 18].map((x, index) => obstacle(`onshore-wellhead-${index + 1}`, "سرچاه", "equipment", x, 14, 3, 3, 3.5, true)),
    obstacle("onshore-flare-mast", "مشعل فلر", "pillar", 32, -10, 1.5, 1.5, 14, true),
    // Field roads, perimeter fence, gate and guard booth.
    sizedPreset("onshore-field-road", "road", 5.5, 26, 51, 4),
    sizedPreset("onshore-tank-spur", "road", 29, 15, 4, 18),
    sizedPreset("onshore-control-path", "road", -20, 16.6, 4, 14.8),
    sizedPreset("onshore-gate-road", "road", 25, 30.5, 6, 5),
    sizedPreset("onshore-approach-road", "road", 25, 35, 6, 4),
    sizedPreset("onshore-street", "road", 0, 39, 76, 4),
    sizedPreset("onshore-fence-north", "fence-mesh", 1, -14, 70, 0.1),
    sizedPreset("onshore-fence-west", "fence-mesh", -34, 9.5, 47, 0.1, 90),
    sizedPreset("onshore-fence-east", "fence-mesh", 36, 9.5, 47, 0.1, 90),
    sizedPreset("onshore-fence-south-west", "fence-mesh", -5.75, 33, 56.5, 0.1),
    sizedPreset("onshore-fence-south-east", "fence-mesh", 31.75, 33, 8.5, 0.1),
    presetObstacle("onshore-gate", "gate-sliding", 25, 33),
    presetObstacle("onshore-guard-booth", "guard-booth", 31, 30),
    ...presetObstacles("onshore-poles", [["camera-pole", -33, 32], ["light-pole", -33, -13], ["light-pole", 35, 32]])
  ], 4.2);
  ground.coverageRequirements = [
    zone("onshore-wellhead-zone", "onshore-oil.wellhead", "سرچاه شماره یک", -5, 16, 1, 18.4),
    zone("onshore-tanks-zone", "onshore-oil.tanks", "جلوی مخازن ذخیره", 8, 0, 27, 1.8),
    zone("onshore-gate-zone", "onshore-oil.gate", "گیت ورود میدان", 22.5, 28.5, 27.5, 32.8),
    zone("onshore-perimeter-zone", "onshore-oil.perimeter", "حصار شمالی میدان", -30, -13.8, -6, -12.3),
    zone("onshore-flare-zone", "onshore-oil.flare", "پای مشعل", 29, -7.5, 35, -5.5)
  ];
  return building([ground]);
}

/**
 * A compact offshore platform deck: control module in the middle, circular helipad on the
 * east, laydown area and deck crane on the west.
 *
 * The risers come up the south leg line, with the lifeboat stations on the south edge
 * beside them; a railing runs round the whole deck.
 */
function offshorePlatformPlan(): BuildingPlan {
  const controlOutline: Vec2[] = [
    { x: -12, z: -8 }, { x: 4, z: -8 }, { x: 7, z: -5 }, { x: 7, z: 6 },
    { x: 4, z: 9 }, { x: -12, z: 9 }, { x: -15, z: 6 }, { x: -15, z: -5 }
  ];
  const helipad = {
    ...presetObstacle("offshore-helipad", "structural-column", 21, -2),
    label: "هلی‌پد دایره‌ای",
    kind: "surface" as const,
    widthM: 16,
    depthM: 16,
    heightM: 0.3,
    blocksView: false
  };
  const ground = floor("offshore-platform-ground", "سکوی دریایی، هلی‌پد و اتاق کنترل", 0, [
    ...polygonEnvelope("offshore-control-room", controlOutline, 4)
  ], [
    door("offshore-control-entry", "offshore-control-room-envelope-5", 0.5, 1.4),
    windowOpening("offshore-control-window-a", "offshore-control-room-envelope-1", 0.5, 2.4),
    windowOpening("offshore-control-window-b", "offshore-control-room-envelope-3", 0.5, 1.8)
  ], [
    obstacle("offshore-main-deck", "عرشه اصلی سکو", "surface", 0, 8, 64, 42, 0.4, false),
    helipad,
    // Control module: consoles under the north window, rack and filing on the side walls.
    ...alongWall("offshore-control-console", "monitoring-console", "north", -8, [-9.5, 1.5]),
    ...presetObstacles("offshore-control-console-chairs", [["office-chair", -9.5, -6.3, 180], ["office-chair", 1.5, -6.3, 180]]),
    onWall("offshore-control-rack", "equipment-rack", "east", 7, -3),
    onWall("offshore-control-filing", "filing-cabinet", "west", -15, 2),
    presetObstacle("offshore-control-meeting", "meeting-table", -3, 3),
    onWall("offshore-deck-tools", "tool-cabinet", "north", 9, 2),
    // Laydown area and deck crane.
    obstacle("offshore-deck-crane", "جرثقیل عرشه", "pillar", -24, -6, 2, 2, 12, true),
    ...presetObstacles("offshore-laydown", [["crate-stack", -26, 4], ["crate-stack", -22, 4], ["pallet-stack", -26, 7]]),
    // Risers on the south leg line and the lifeboat stations on the south edge.
    ...[-10, 0, 10].map((x, index) => obstacle(`offshore-riser-${index + 1}`, "رایزر دریایی", "pillar", x, 22, 1.4, 1.4, 6, true)),
    obstacle("offshore-lifeboat-a", "قایق نجات", "vehicle", -20, 27, 8, 3, 2.5, true),
    obstacle("offshore-lifeboat-b", "قایق نجات", "vehicle", 20, 27, 8, 3, 2.5, true),
    // Deck-edge railing and masts.
    sizedPreset("offshore-railing-north", "fence-mesh", 0, -13, 64, 0.1),
    sizedPreset("offshore-railing-south", "fence-mesh", 0, 29, 64, 0.1),
    sizedPreset("offshore-railing-west", "fence-mesh", -32, 8, 42, 0.1, 90),
    sizedPreset("offshore-railing-east", "fence-mesh", 32, 8, 42, 0.1, 90),
    ...presetObstacles("offshore-deck-poles", [
      ["camera-pole", -31, -12], ["camera-pole", 31, 28], ["light-pole", -31, 28], ["light-pole", 31, 12]
    ])
  ], 4.2);
  ground.coverageRequirements = [
    zone("offshore-deck-zone", "offshore-oil.deck", "محوطه بارگذاری عرشه", -30, 10, -16, 13),
    zone("offshore-helipad-zone", "offshore-oil.helipad", "سطح فرود هلی‌پد", 17, -6, 25, 2),
    zone("offshore-lifeboat-zone", "offshore-oil.lifeboat", "ایستگاه قایق نجات غربی", -25, 23.5, -15, 25.3),
    zone("offshore-riser-zone", "offshore-oil.riser", "مسیر رایزرها", -12, 23.3, 12, 25)
  ];
  return building([ground]);
}

/**
 * A fenced solar farm: four rows of south-facing panel tables, the inverter cabin to the
 * east and the farm's step-up substation in front of it.
 *
 * The site road runs along the south fence from the guarded gate, with a spur up between
 * the two transformers to the inverter cabin door.
 */
function solarGenerationFarmPlan(): BuildingPlan {
  const inverterOutline: Vec2[] = [
    { x: 18, z: -9 }, { x: 29, z: -9 }, { x: 32, z: -6 }, { x: 32, z: 5 },
    { x: 29, z: 8 }, { x: 18, z: 8 }, { x: 15, z: 5 }, { x: 15, z: -6 }
  ];
  const panels = [-24, -12, 0, 12].flatMap((z, row) =>
    [-32, -23, -14, -5, 4].map((x, column) =>
      ({ ...sizedPreset(`solar-panel-${row + 1}-${column + 1}`, "solar-panel", x, z, 8, 3.4), label: "پنل خورشیدی" })
    )
  );
  const ground = floor("solar-generation-ground", "مزرعه خورشیدی، اینورتر و پست تبدیل", 0, [
    ...polygonEnvelope("solar-inverter-room", inverterOutline, 3.6)
  ], [
    door("solar-inverter-entry", "solar-inverter-room-envelope-5", 0.5, 1.3),
    windowOpening("solar-inverter-window-a", "solar-inverter-room-envelope-1", 0.5, 2),
    windowOpening("solar-inverter-window-b", "solar-inverter-room-envelope-3", 0.5, 1.8)
  ], [
    ...panels,
    // Inverter cabin: inverter racks on the north wall, desk and tools on the side walls.
    ...alongWall("solar-inverter-rack", "equipment-rack", "north", -9, [19.5, 20.5, 26.5, 27.5]),
    onWall("solar-inverter-tools", "tool-cabinet", "west", 15, 0),
    onWall("solar-inverter-desk", "office-desk", "east", 32, -4),
    presetObstacle("solar-inverter-desk-chair", "office-chair", 30.6, -4, 270),
    presetObstacle("solar-inverter-workbench", "workbench", 21, 5),
    // Step-up substation either side of the spur road.
    { ...sizedPreset("solar-transformer-a", "transformer", 28, 16, 5, 4), label: "ترانس تبدیل", heightM: 4 },
    { ...sizedPreset("solar-transformer-b", "transformer", 18, 16, 4, 3), label: "تابلو پست خورشیدی", heightM: 3.5 },
    // Site road, perimeter fence, gate and guard booth.
    sizedPreset("solar-farm-road", "road", -2, 29, 64, 4),
    sizedPreset("solar-farm-spur", "road", 22.75, 17.6, 4, 18.8),
    sizedPreset("solar-farm-gate-road", "road", 27, 32.5, 6, 3),
    sizedPreset("solar-farm-approach", "road", 27, 36, 6, 4),
    sizedPreset("solar-farm-street", "road", 0, 40, 80, 4),
    presetObstacle("solar-farm-pickup", "pickup", 10, 29, 0),
    sizedPreset("solar-farm-fence-north", "fence-mesh", -1, -29, 74, 0.1),
    sizedPreset("solar-farm-fence-west", "fence-mesh", -38, 2.5, 63, 0.1, 90),
    sizedPreset("solar-farm-fence-east", "fence-mesh", 36, 2.5, 63, 0.1, 90),
    sizedPreset("solar-farm-fence-south-west", "fence-mesh", -6.75, 34, 62.5, 0.1),
    sizedPreset("solar-farm-fence-south-east", "fence-mesh", 32.75, 34, 6.5, 0.1),
    presetObstacle("solar-farm-gate", "gate-sliding", 27, 34),
    presetObstacle("solar-farm-guard-booth", "guard-booth", 33, 31),
    ...presetObstacles("solar-farm-poles", [["camera-pole", -37, 33], ["light-pole", 35, -28], ["light-pole", -37, -28]])
  ], 3.8);
  ground.coverageRequirements = [
    zone("solar-array-zone", "solar-farm.array", "راهروی بین ردیف‌های پنل", -36, 4, -14, 6),
    zone("solar-perimeter-zone", "solar-farm.perimeter", "حصار شمالی مزرعه", -34, -28.8, -10, -27.3),
    zone("solar-gate-zone", "solar-farm.gate", "گیت ورود مزرعه", 24.5, 29.5, 29.5, 33.8),
    zone("solar-substation-zone", "solar-farm.substation", "جلوی ترانس تبدیل", 25, 18.4, 31, 20.4)
  ];
  return building([ground]);
}

/**
 * A compact hydroelectric site: the reservoir sits behind a concrete dam to the south, the
 * spillway discharges into the tailrace channel running north, and the powerhouse
 * (turbine hall and control room) stands at the dam's west toe.
 *
 * The site is fenced on its landward sides; the access road comes in through the guarded
 * gate south of the powerhouse to the turbine hall's loading door.
 */
function hydroelectricPowerStationPlan(): BuildingPlan {
  const ground = floor("hydro-plant-ground", "سد، توربین‌خانه و اتاق کنترل", 0, [
    ...rectangle("hydro-powerhouse", -31, -12, -3, 10, 6),
    partition("hydro-control-split", -15, -12, -15, 10, 4)
  ], [
    { ...door("hydro-turbine-entry", "hydro-powerhouse-south", 0.75, 2.4), variant: "double-solid", swingDirection: "inward" },
    door("hydro-control-entry", "hydro-control-split", 0.55, 1.3),
    windowOpening("hydro-control-window", "hydro-powerhouse-north", 0.78, 3),
    windowOpening("hydro-turbine-window", "hydro-powerhouse-west", 0.5, 2.6)
  ], [
    // Dam, spillway, reservoir and tailrace.
    obstacle("hydro-dam-body", "بدنه سد", "block", 19, 12.5, 42, 4, 12, true),
    obstacle("hydro-spillway", "سرریز سد", "surface", 18, 8, 10, 4.6, 0.18, false),
    obstacle("hydro-upstream-water", "مخزن بالادست", "surface", 19, 24, 42, 18, 0.05, false),
    obstacle("hydro-tailrace", "کانال خروجی آب", "surface", 18, -12.25, 12, 35.5, 0.05, false),
    // Turbine hall: three generator units with the tool store on the north wall.
    ...[-28.5, -23.5, -18.5].map((x, index) => ({ ...sizedPreset(`hydro-generator-${index + 1}`, "generator-unit", x, -2, 4, 5), label: "واحد توربین و ژنراتور", heightM: 4.2 })),
    onWall("hydro-turbine-tools", "tool-cabinet", "north", -12, -27),
    presetObstacle("hydro-turbine-workbench", "workbench", -20, 6),
    // Control room: consoles either side of the north window, racks and filing on the walls.
    ...alongWall("hydro-control-console", "monitoring-console", "north", -12, [-12.6, -5.4]),
    ...presetObstacles("hydro-control-console-chairs", [["office-chair", -12.6, -10.3, 180], ["office-chair", -5.4, -10.3, 180]]),
    ...alongWall("hydro-control-rack", "equipment-rack", "east", -3, [-7, -5.8]),
    presetObstacle("hydro-control-desk", "office-desk", -10, -4),
    presetObstacle("hydro-control-desk-chair", "office-chair", -10, -3, 180),
    presetObstacle("hydro-control-meeting", "meeting-table", -9, 5),
    onWall("hydro-control-filing", "filing-cabinet", "south", 10, -5),
    // Landward fence, access road, gate and guard booth.
    sizedPreset("hydro-site-fence-north", "fence-mesh", 2, -30, 76, 0.1),
    sizedPreset("hydro-site-fence-west", "fence-mesh", -36, -5, 50, 0.1, 90),
    sizedPreset("hydro-site-fence-east", "fence-mesh", 40, -9.75, 40.5, 0.1, 90),
    sizedPreset("hydro-site-fence-south-west", "fence-mesh", -31.25, 20, 9.5, 0.1),
    sizedPreset("hydro-site-fence-south-east", "fence-mesh", -11.75, 20, 19.5, 0.1),
    presetObstacle("hydro-site-gate", "gate-sliding", -24, 20),
    presetObstacle("hydro-site-guard-booth", "guard-booth", -30, 17),
    sizedPreset("hydro-site-road", "road", -24, 15.1, 5, 9.8),
    sizedPreset("hydro-site-approach", "road", -24, 23, 5, 6),
    sizedPreset("hydro-site-street", "road", -22, 28, 36, 4),
    presetObstacle("hydro-site-pickup", "pickup", -14, 14, 0),
    ...presetObstacles("hydro-site-poles", [["camera-pole", -35, -29], ["light-pole", 39, -29], ["light-pole", -35, 19]])
  ], 6.2);
  ground.coverageRequirements = [
    zone("hydro-dam-zone", "hydro-plant.dam", "پای سد و دریچه‌های سرریز", 0, 6.8, 12, 9.4),
    zone("hydro-perimeter-zone", "hydro-plant.perimeter", "حصار شمالی نیروگاه", -32, -29.8, -8, -28.3),
    zone("hydro-channel-zone", "hydro-plant.channel", "کرانه کانال خروجی", 10, -22, 11.8, -2)
  ];
  return building([ground]);
}

/**
 * A safe-city district block: a main road crossed by a boulevard, a civic plaza on the
 * corner, a small park, a bus stop on the main road and the district command post.
 *
 * The bus pulls in eastbound at the south kerb beside its shelter benches; the command
 * post has a public lobby with its reception desk facing the door and an operations room
 * behind the glass partition.
 */
function safeCityDistrictPlan(): BuildingPlan {
  const plaza = {
    ...presetObstacle("safe-city-plaza", "structural-column", -4, 1),
    label: "میدان و پلازای شهری",
    kind: "surface" as const,
    widthM: 20,
    depthM: 20,
    heightM: 0.08,
    blocksView: false
  };
  const ground = floor("safe-city-ground", "میدان شهری، بوستان و مرکز پایش", 0, [
    ...rectangle("safe-city-command", 20, -12, 35, 8, 4),
    glassPartition("safe-city-command-split", 27, -12, 27, 8, 4)
  ], [
    { ...door("safe-city-command-entry", "safe-city-command-south", 0.75, 1.6), variant: "double-glass", swingDirection: "inward" },
    door("safe-city-operations-door", "safe-city-command-split", 0.5, 1.2),
    windowOpening("safe-city-command-window", "safe-city-command-west", 0.5, 3)
  ], [
    plaza,
    obstacle("safe-city-main-road", "خیابان اصلی", "surface", -5, -16, 68, 7, 0.03, false),
    obstacle("safe-city-cross-road", "بلوار متقاطع", "surface", -18, 1, 7, 48, 0.03, false),
    ...[-12, -4, 4].map((x, index) => presetObstacle(`safe-city-plaza-light-${index + 1}`, "light-pole", x, 11.6)),
    // Park: two lawns with trees, benches facing them and lights at the back.
    ...presetObstacles("safe-city-park", [
      ["grass", 7, 19], ["grass", 17, 19], ["deciduous", 7, 25.5], ["deciduous", 17, 25.5],
      ["waiting-bench", 7, 15, 180], ["waiting-bench", 17, 15, 180], ["light-pole", 2, 23], ["light-pole", 21, 23]
    ]),
    // Bus stop at the south kerb of the main road.
    { ...sizedPreset("safe-city-transit-bus", "bus", -28, -14.2, 11, 2.6), label: "اتوبوس شهری", heightM: 3.2 },
    ...presetObstacles("safe-city-transit", [
      ["waiting-bench", -30, -11.5, 180], ["waiting-bench", -25, -11.5, 180],
      ["camera-pole", -34, -10], ["light-pole", -22.5, -10]
    ]),
    // Command post: public lobby and operations room.
    presetObstacle("safe-city-command-reception", "reception-desk", 23.5, 4.5),
    presetObstacle("safe-city-command-reception-chair", "office-chair", 23.5, 3.6, 0),
    onWall("safe-city-command-bench", "waiting-bench", "north", -12, 23.5),
    ...alongWall("safe-city-command-rack", "equipment-rack", "north", -12, [32.5, 33.7]),
    ...alongWall("safe-city-command-console", "monitoring-console", "east", 35, [-4, 1]),
    ...presetObstacles("safe-city-command-console-chairs", [["office-chair", 33.5, -4, 270], ["office-chair", 33.5, 1, 270]]),
    presetObstacle("safe-city-command-meeting", "meeting-table", 30, 4)
  ], 4.2);
  ground.coverageRequirements = [
    zone("safe-city-junction-zone", "urban-road.junction", "تقاطع خیابان و بلوار", -21.5, -19.5, -14.5, -12.5),
    zone("safe-city-crossing-zone", "urban-road.crossing", "گذرگاه عابر بلوار", -21.5, -7, -14.5, -5),
    zone("safe-city-square-zone", "safe-city.square", "مرکز میدان شهری", -9, -4, 1, 6),
    zone("safe-city-park-zone", "safe-city.park", "چمن غربی بوستان", 3, 16.5, 11, 19),
    zone("safe-city-transit-zone", "safe-city.transit-stop", "سکوی ایستگاه اتوبوس", -33, -12.3, -22, -10),
    zone("safe-city-gathering-zone", "safe-city.gathering", "لبه جنوبی میدان برای تجمع", -12, 8, 4, 10.6)
  ];
  return building([ground]);
}

/**
 * A compact stadium: the playing field inside a running track, stands on three sides
 * facing the pitch, and the ticketing and security building at the north-east corner.
 *
 * Spectators gather on the forecourt, pass the north doors, the queue lines and the
 * ticket counters, and leave through the south doors towards the stands. The spectator
 * car park lies east of the stands with its barrier on the street entrance.
 */
function urbanSportsComplexPlan(): BuildingPlan {
  const standXs = [-25, -19, -13, -7, -1, 5, 11];
  const ground = floor("sports-complex-ground", "ورزشگاه شهری، جایگاه و گیت‌ها", 0, [
    ...rectangle("sports-ticket-building", 23, -17, 36, -3, 3.4)
  ], [
    { ...door("sports-main-gate", "sports-ticket-building-north", 0.5, 2.2), variant: "double-glass", swingDirection: "inward" },
    { ...door("sports-venue-entry", "sports-ticket-building-south", 0.5, 2.2), variant: "double-glass", swingDirection: "outward" },
    windowOpening("sports-ticket-window-a", "sports-ticket-building-west", 0.3, 2),
    windowOpening("sports-ticket-window-b", "sports-ticket-building-west", 0.72, 2)
  ], [
    obstacle("sports-playing-field", "زمین مسابقه", "surface", -7, 5, 42, 24, 0.05, false),
    obstacle("sports-running-track", "پیست پیرامون زمین", "surface", -7, 5, 50, 31, 0.03, false),
    // Stands face the pitch from the north, south and east.
    ...gridPresets("sports-north-stands", ["gym-bleacher"], standXs, [-12]),
    ...gridPresets("sports-south-stands", ["gym-bleacher"], standXs, [22], 180),
    ...[-3, 3, 9, 15].map((z, index) => presetObstacle(`sports-east-stand-${index + 1}`, "gym-bleacher", 19.5, z, 90)),
    // Ticketing and security: queue lines to the counters, the passage between them.
    ...presetObstacles("sports-ticket-assets", [
      ["service-counter", 26, -12, 180], ["service-counter", 33, -12, 180],
      ["queue-barrier", 26, -14.5], ["queue-barrier", 33, -14.5]
    ]),
    onWall("sports-ticket-rack", "equipment-rack", "east", 36, -5),
    obstacle("sports-gates-forecourt", "میدان ورودی تماشاگران", "surface", 29.5, -20.6, 13, 6.85, 0.03, false),
    sizedPreset("sports-gates-walk", "road", 39, -20.6, 6, 4),
    // Spectator car park with its street entrance.
    sizedPreset("sports-parking-surface", "road", 31, 19.5, 18, 15),
    ...parkingRow("sports-parking-row-north", ["sedan", "suv", "sedan"], [24, 26.8, 29.6, 32.4, 35.2, 38], 14.4, "north"),
    ...parkingRow("sports-parking-row-south", ["suv", "sedan", "sedan"], [24, 26.8, 29.6, 32.4, 35.2, 38], 24.6, "south"),
    sizedPreset("sports-parking-entry", "road", 41, 19.5, 2, 5),
    presetObstacle("sports-parking-barrier", "parking-barrier", 40.6, 19.5, 90),
    sizedPreset("sports-parking-street", "road", 44, 5, 4, 50),
    ...presetObstacles("sports-gates-poles", [
      ["camera-pole", -34, 20], ["camera-pole", -34, -8], ["light-pole", 16, 21], ["light-pole", 37.5, -21]
    ])
  ], 3.6);
  ground.coverageRequirements = [
    zone("sports-stand-zone", "sports-complex.stand", "جایگاه تماشاگران جنوبی", -27, 20.8, -3, 23.2),
    zone("sports-gate-zone", "sports-complex.gate", "صف ورود جلوی گیت", 26.5, -20.8, 32.5, -17.3),
    zone("sports-field-zone", "sports-complex.field", "محوطه جلوی دروازه غربی", -27, 2, -21, 8),
    zone("sports-parking-zone", "sports-complex.parking", "پارکینگ تماشاگران", 23, 16.5, 38, 22.5)
  ];
  return building([ground]);
}

/**
 * A compact data centre: the secure entrance and control room in the west, the data hall
 * with paired rack rows (cold aisles between their fronts), and a service band holding
 * the power room, the cooling plant and the equipment receiving room.
 *
 * Staff enter from the access road on the north through the reception and the mantrap
 * door; deliveries come to the loading platform outside the receiving room's south door.
 */
function compactDataCentrePlan(): BuildingPlan {
  const t = partitionThicknessM;
  const rackRows: [number, number][] = [[-12.5, 0], [-9.5, 180], [-5.5, 0], [-2.5, 180]];
  const ground = floor("data-centre-ground", "سالن رک، برق، سرمایش و تحویل تجهیزات", 0, [
    ...rectangle("data-centre-shell", -28, -16, 28, 16, 4.8),
    partition("data-centre-service-spine", -28, 7, 28, 7, 4.8),
    partition("data-centre-power-split", -8, 7, -8, 16, 4.8),
    partition("data-centre-cooling-split", 10, 7, 10, 16, 4.8),
    glassPartition("data-centre-mantrap", -20, -16, -20, 7, 4.8)
  ], [
    { ...door("data-centre-secure-entry", "data-centre-shell-north", 0.08, 1.6), variant: "double-glass", swingDirection: "inward" },
    door("data-centre-mantrap-door", "data-centre-mantrap", 0.55, 1.2),
    door("data-centre-power-door", "data-centre-service-spine", 0.18, 1.2),
    door("data-centre-cooling-door", "data-centre-service-spine", 0.5, 1.2),
    door("data-centre-loading-door-internal", "data-centre-service-spine", 0.75, 1.4),
    { ...door("data-centre-loading-door", "data-centre-shell-south", 0.16, 3), variant: "double-solid" },
    windowOpening("data-centre-control-window", "data-centre-mantrap", 0.22, 1.6)
  ], [
    // Data hall: two blocks of paired rack rows either side of a cross aisle.
    ...rackRows.flatMap(([z, rot], row) => [
      sizedPreset(`data-centre-racks-west-${row + 1}`, "equipment-rack", -7, z, 18, 0.8, rot),
      sizedPreset(`data-centre-racks-east-${row + 1}`, "equipment-rack", 15, z, 18, 0.8, rot)
    ]),
    // Entrance and control: reception facing the secure door, consoles on the west wall.
    presetObstacle("data-centre-reception", "reception-desk", -24, -11, 180),
    presetObstacle("data-centre-reception-chair", "office-chair", -24, -10.1, 180),
    presetObstacle("data-centre-queue", "queue-barrier", -24, -13.5),
    onWall("data-centre-console", "monitoring-console", "west", -28, -3),
    presetObstacle("data-centre-console-chair", "office-chair", -26.5, -3, 90),
    ...alongWall("data-centre-nvr", "nvr-cabinet", "west", -28, [1, 1.7]),
    onWall("data-centre-switch", "network-switch", "west", -28, 2.4),
    // Power room: switchboards on the south wall, UPS strings on the east partition.
    ...alongWall("data-centre-power-board", "equipment-rack", "south", 16, [-25, -24.2, -23.4, -22.6]),
    ...alongWall("data-centre-power-ups", "ups-unit", "east", -8, [10, 11, 12, 13], t),
    onWall("data-centre-power-tools", "tool-cabinet", "west", -28, 12),
    // Cooling plant: two chillers and the maintenance bench.
    ...presetObstacles("data-centre-cooling", [["cnc-machine", 1, 12], ["cnc-machine", 6, 12]]),
    onWall("data-centre-cooling-bench", "workbench", "west", -8, 12, t),
    // Receiving room and the loading platform outside its door.
    ...presetObstacles("data-centre-loading", [["packing-table", 13, 10], ["crate-stack", 25, 10], ["crate-stack", 25, 12.5]]),
    presetObstacle("data-centre-access-platform", "loading-platform", 19, 17.3),
    sizedPreset("data-centre-access-yard", "road", 19, 22.5, 6, 8),
    presetObstacle("data-centre-access-van", "van", 19, 21.5, 90),
    // Access road on the north with the guarded barrier.
    sizedPreset("data-centre-access-road", "road", 0, -20, 64, 4),
    presetObstacle("data-centre-access-barrier", "parking-barrier", -30, -20, 90),
    presetObstacle("data-centre-access-booth", "guard-booth", -31, -15.5),
    ...presetObstacles("data-centre-access-poles", [["camera-pole", -34, 15], ["camera-pole", 34, 15]])
  ], 5);
  return building([ground]);
}

/**
 * A regional terminal laid out along the passenger flow.
 *
 * Passengers enter from the landside kerb into the check-in hall, walk west through the
 * security gate into the screening hall, queue past the inspection desks and come back
 * east into the departures hall, which opens onto the apron. Checked bags go through a
 * staff door to the baggage hall, whose own door serves the baggage carts on the apron.
 */
function regionalAirportTerminalPlan(): BuildingPlan {
  const terminalOutline: Vec2[] = [
    { x: -30, z: -14 }, { x: 20, z: -14 }, { x: 26, z: -8 }, { x: 26, z: 12 },
    { x: 20, z: 18 }, { x: -30, z: 18 }, { x: -36, z: 12 }, { x: -36, z: -8 }
  ];
  const ground = floor("airport-terminal-ground", "ترمینال منطقه‌ای و اپرون", 0, [
    ...polygonEnvelope("airport-terminal", terminalOutline, 5),
    glassPartition("airport-security-line", -20, -14, -20, 18, 5),
    glassPartition("airport-transit-line", -20, 2, 8, 2, 5),
    partition("airport-baggage-line", 8, -14, 8, 18, 5)
  ], [
    { ...door("airport-main-entry", "airport-terminal-envelope-5", 0.5, 4), variant: "double-glass", swingDirection: "inward" },
    door("airport-security-gate", "airport-security-line", 0.8125, 2),
    door("airport-security-exit", "airport-security-line", 0.25, 2),
    door("airport-baggage-door", "airport-baggage-line", 0.55, 2),
    { ...door("airport-apron-exit", "airport-terminal-envelope-1", 0.5, 2), variant: "double-glass" },
    { ...door("airport-baggage-apron-door", "airport-terminal-envelope-1", 0.94, 2.4), variant: "double-solid" },
    windowOpening("airport-front-window-a", "airport-terminal-envelope-5", 0.3, 4),
    windowOpening("airport-front-window-b", "airport-terminal-envelope-5", 0.7, 4)
  ], [
    // Check-in hall: counters face the entrance, with a clear lane from the door.
    ...gridPresets("airport-checkin", ["service-counter"], [-14, -9, 1, 6], [10]),
    // Screening hall: queue lines from the gate, inspection desks, then the exit door.
    ...presetObstacles("airport-security", [
      ["queue-barrier", -24, 10.5], ["queue-barrier", -24, 13.5], ["queue-barrier", -28, 7], ["queue-barrier", -28, 4]
    ]),
    ...presetObstacles("airport-security-desks", [["reception-desk", -31, 0, 270], ["reception-desk", -31, -4, 270]]),
    onWall("airport-security-rack", "equipment-rack", "west", -36, 6),
    // Departures hall: bench rows either side of the walkway to the apron door.
    ...gridPresets("airport-waiting", ["waiting-bench"], [-15, -10, 0, 5], [-8, -2]),
    // Baggage hall: make-up belts and a baggage cart.
    ...presetObstacles("airport-baggage", [
      ["conveyor", 16, -7], ["conveyor", 16, 0], ["conveyor", 16, 7], ["luggage-cart", 23, 14]
    ]),
    // Apron with the stand, aircraft and ground vehicles; airside fence beyond.
    obstacle("airport-apron", "اپرون هواپیما", "surface", 1, -24, 74, 19, 0.03, false),
    obstacle("airport-aircraft-body", "هواپیمای منطقه‌ای", "vehicle", 2, -26, 18, 3.2, 3.5, true),
    obstacle("airport-aircraft-wing", "بال هواپیما", "block", 2, -26, 4, 18, 0.5, true),
    presetObstacle("airport-apron-assets-van", "van", -15, -20, 90),
    obstacle("airport-apron-assets-baggage-train", "قطار حمل بار", "vehicle", 17, -19, 4, 1.5, 1.4, true),
    ...presetObstacles("airport-apron-assets-poles", [["camera-pole", -33, -29], ["camera-pole", 33, -29], ["light-pole", 23, -20]]),
    sizedPreset("airport-apron-assets-fence", "fence-mesh", 1, -36, 76, 0.1),
    // Landside kerb road.
    sizedPreset("airport-landside-road", "road", -5, 22, 70, 4)
  ], 5.2);
  ground.coverageRequirements = [
    zone("airport-apron-zone", "airport.apron", "اپرون جلوی در خروج", -8, -21, -2, -15.5),
    zone("airport-perimeter-zone", "airport.perimeter", "حصار سمت هوایی", -34, -35.8, -10, -34.3)
  ];
  return building([ground]);
}

/**
 * A container port: ship-to-shore cranes straddle the quay along the water, the container
 * stacks fill the yard behind it in two rows, and the customs office stands at the
 * yard's east end.
 *
 * Trucks come off the street through the guarded gate in the north fence onto the yard
 * road that runs past the stacks to the customs office.
 */
function containerPortPlan(): BuildingPlan {
  const cranes = [-15, 2, 19].flatMap((x, index) => [
    ...[[x - 3, 19], [x + 3, 19], [x - 3, 26], [x + 3, 26]].map(([legX, legZ], leg) =>
      obstacle(`port-crane-leg-${index + 1}-${leg + 1}`, "پایه جرثقیل ساحلی", "pillar", legX, legZ, 0.8, 0.8, 9, true)),
    // The boom is high above the quay, so it does not block the view at ground level.
    obstacle(`port-crane-boom-${index + 1}`, "بازوی جرثقیل ساحلی", "block", x, 26, 0.8, 22, 0.8, false)
  ]);
  const ground = floor("container-port-ground", "بندر کانتینری، گمرک و اسکله", 0, [
    ...rectangle("port-customs-building", 21, -15, 35, 1, 3.8)
  ], [
    door("port-customs-entry", "port-customs-building-south", 0.5, 1.5),
    windowOpening("port-customs-window-a", "port-customs-building-west", 0.3, 2),
    windowOpening("port-customs-window-b", "port-customs-building-west", 0.72, 2)
  ], [
    obstacle("port-quay", "خط اسکله", "surface", 0, 22, 72, 11, 0.08, false),
    obstacle("port-water", "حوض بندر", "surface", 0, 34, 72, 13, 0.03, false),
    ...cranes,
    ...[-27, -17, -7, 3, 13].flatMap((x, column) => [
      { ...sizedPreset(`port-container-a-${column + 1}`, "shipping-container", x, -6, 6, 2.5), label: "کانتینر", heightM: 2.6 },
      { ...sizedPreset(`port-container-b-${column + 1}`, "shipping-container", x, 1, 6, 2.5), label: "کانتینر", heightM: 5.2 }
    ]),
    // Customs office: counter facing the door, inspector's desk, rack and filing on walls.
    presetObstacle("port-customs-counter", "service-counter", 28, -4),
    presetObstacle("port-customs-desk", "office-desk", 31, -10),
    presetObstacle("port-customs-desk-chair", "office-chair", 31, -8.8, 180),
    onWall("port-customs-rack", "equipment-rack", "east", 35, -3),
    onWall("port-customs-filing", "filing-cabinet", "north", -15, 33),
    // Yard road, truck gate with barrier and guard booth, fence and street.
    sizedPreset("port-gate-yard-road", "road", -8, -14, 56, 4),
    ...presetObstacles("port-gate-trucks", [["truck", -14, -13, 0], ["truck", 2, -13, 0]]),
    sizedPreset("port-gate-road", "road", -24, -18, 6, 4),
    sizedPreset("port-gate-approach", "road", -24, -22, 6, 4),
    sizedPreset("port-gate-street", "road", 0, -26, 76, 4),
    presetObstacle("port-gate-sliding", "gate-sliding", -24, -20),
    presetObstacle("port-gate-barrier", "parking-barrier", -24, -17),
    presetObstacle("port-gate-booth", "guard-booth", -29.5, -17.5),
    sizedPreset("port-gate-fence-west-run", "fence-mesh", -31.25, -20, 9.5, 0.1),
    sizedPreset("port-gate-fence-east-run", "fence-mesh", 7.25, -20, 57.5, 0.1),
    sizedPreset("port-gate-fence-west", "fence-mesh", -36, -1.75, 36.5, 0.1, 90),
    sizedPreset("port-gate-fence-east", "fence-mesh", 36, -1.75, 36.5, 0.1, 90),
    ...presetObstacles("port-gate-poles", [["camera-pole", -35, 10], ["camera-pole", 35, 10]])
  ], 4);
  ground.coverageRequirements = [
    zone("port-yard-zone", "port.container-yard", "راهروی بین ردیف‌های کانتینر", -30, -4.4, -6, -0.6),
    zone("port-gate-zone", "port.gate", "گیت ورود کامیون", -26.5, -19.8, -21.5, -16.5),
    zone("port-quay-zone", "port.quay", "لبه اسکله غربی", -35, 25.4, -20, 27.3),
    zone("port-crane-zone", "port.crane", "پای جرثقیل ساحلی میانی", -2, 16.8, 6, 18.4)
  ];
  return building([ground]);
}

/**
 * A through railway station: the ticket hall faces the street, the escalator hall behind
 * it leads to the footbridge and onto platform one, and two tracks run between the
 * platforms out to the tunnel mouths at either end.
 *
 * Ticket counters line the side walls, and the fare-gate line separates the paid side
 * of the hall from the street side.
 */
function railwayInterchangeStationPlan(): BuildingPlan {
  const ground = floor("railway-station-ground", "ایستگاه راه‌آهن، سکوها و سالن بلیت", 0, [
    ...rectangle("railway-ticket-hall", -13, -12, 13, 8, 4.2),
    partition("railway-escalator-wall", -13, 1, 13, 1, 4.2)
  ], [
    { ...door("railway-main-entry", "railway-ticket-hall-north", 0.5, 3), variant: "double-glass", swingDirection: "inward" },
    { ...door("railway-escalator-door", "railway-escalator-wall", 0.5, 3), variant: "double-glass" },
    door("railway-platform-door", "railway-ticket-hall-south", 0.5, 2.4),
    windowOpening("railway-ticket-window-a", "railway-ticket-hall-west", 0.65, 2),
    windowOpening("railway-ticket-window-b", "railway-ticket-hall-east", 0.35, 2)
  ], [
    obstacle("railway-platform-a", "سکوی شماره یک", "surface", 0, 11, 50, 4, 0.25, false),
    obstacle("railway-platform-b", "سکوی شماره دو", "surface", 0, 21, 50, 4, 0.25, false),
    ...[15, 16.5, 25, 26.5].map((z, index) => obstacle(`railway-track-${index + 1}`, "ریل", "block", 0, z, 62.8, 0.16, 0.12, false)),
    obstacle("railway-tunnel-west", "دهانه تونل غربی", "block", -32, 20.75, 1, 16, 4.5, true),
    obstacle("railway-tunnel-east", "دهانه تونل شرقی", "block", 32, 20.75, 1, 16, 4.5, true),
    ...gridPresets("railway-platform-seating-a", ["waiting-bench"], [-18, -6, 6, 18], [11]),
    ...gridPresets("railway-platform-seating-b", ["waiting-bench"], [-18, -6, 6, 18], [21]),
    // Ticket hall: counters on the side walls, fare-gate line in front of the escalator hall.
    ...alongWall("railway-ticket-counter-west", "service-counter", "west", -13, [-9.5]),
    ...alongWall("railway-ticket-counter-east", "service-counter", "east", 13, [-9.5]),
    ...presetObstacles("railway-ticket-gates", [
      ["queue-barrier", -9, -1], ["queue-barrier", -5, -1], ["queue-barrier", 5, -1], ["queue-barrier", 9, -1]
    ]),
    // Escalator hall: escalators up to the footbridge and the lift.
    ...presetObstacles("railway-escalator", [["escalator", -9, 4.5, 90], ["escalator", -7, 4.5, 90]]),
    presetObstacle("railway-lift", "elevator", 9, 4.5),
    sizedPreset("railway-street", "road", 0, -16, 40, 4),
    ...presetObstacles("railway-security", [
      ["camera-pole", -30, 8], ["camera-pole", 30, 8], ["light-pole", -30, 30], ["light-pole", 30, 30]
    ])
  ], 4.4);
  ground.coverageRequirements = [
    zone("railway-platform-zone", "railway.platform", "سکوی شماره دو، بخش غربی", -24, 19.4, -10, 22.6),
    zone("railway-edge-zone", "railway.platform-edge", "لبه خطر سکوی یک", -24, 12, 0, 13),
    zone("railway-tunnel-zone", "railway.tunnel", "ورودی تونل شرقی", 26, 14, 31.3, 17.5)
  ];
  return building([ground]);
}

/**
 * An open-pit mine: the terraced pit in the south-west, the haul road along its north rim
 * to the primary crusher, and the explosives magazine fenced off on its own to the east.
 *
 * Loaded trucks climb out of the pit by the ramp and run east to the crusher's dump pad;
 * product trucks leave through the weighbridge and the guarded gate on the north fence.
 */
function openPitMinePlan(): BuildingPlan {
  const pitOuter = {
    ...presetObstacle("mine-pit-outer", "structural-column", -12, 10),
    label: "دهانه معدن روباز",
    kind: "surface" as const,
    widthM: 34,
    depthM: 34,
    heightM: 0.12,
    blocksView: false
  };
  const pitInner = {
    ...presetObstacle("mine-pit-inner", "structural-column", -12, 10),
    label: "جبهه‌کار معدن",
    kind: "surface" as const,
    widthM: 20,
    depthM: 20,
    heightM: 0.2,
    blocksView: false
  };
  const ground = floor("open-pit-mine-ground", "معدن روباز و سایت فرآوری", 0, [
    ...rectangle("mine-explosives-store", 22, 13, 34, 25, 3.5)
  ], [
    door("mine-explosives-entry", "mine-explosives-store-south", 0.5, 1.2),
  ], [
    pitOuter,
    pitInner,
    obstacle("mine-haul-road", "جاده حمل", "surface", -2, -12, 64, 7, 0.04, false),
    obstacle("mine-haul-ramp", "رمپ خروج از معدن", "surface", -12, -4.5, 6, 9, 0.04, false),
    ...presetObstacles("mine-vehicles", [["truck", -18, -13.2, 0], ["truck", -4, -10.8, 180]]),
    // Primary crusher with its dump pad, conveyor and crushed-stone stockpile.
    obstacle("mine-crusher", "سنگ‌شکن اصلی", "equipment", 22, -2, 8, 7, 6, true),
    obstacle("mine-conveyor", "نوار انتقال سنگ", "equipment", 29.25, -2, 6.5, 1.4, 1.2, false),
    obstacle("mine-crusher-stockpile", "دپوی سنگ شکسته", "block", 34.5, -2, 3.8, 4, 3, true),
    // Weighbridge on the exit road, gate and guard booth.
    sizedPreset("mine-haul-exit-road", "road", 28, -19.75, 6, 8.5),
    obstacle("mine-weighbridge", "باسکول کامیون", "equipment", 28, -19.2, 3, 7.5, 0.6, false),
    presetObstacle("mine-vehicles-gate", "gate-sliding", 28, -24),
    presetObstacle("mine-vehicles-booth", "guard-booth", 32.5, -21),
    sizedPreset("mine-vehicles-approach", "road", 28, -25, 6, 2),
    sizedPreset("mine-vehicles-street", "road", 0, -28, 80, 4),
    // Explosives magazine: racks on the side walls, monitor rack, its own fence and gate.
    ...alongWall("mine-explosives-rack-west", "storage-rack", "west", 22, [16.5, 20.5]),
    ...alongWall("mine-explosives-rack-east", "storage-rack", "east", 34, [16.5, 20.5]),
    onWall("mine-explosives-monitor", "equipment-rack", "north", 13, 28),
    sizedPreset("mine-explosives-fence-north", "fence-mesh", 28, 11, 16, 0.1),
    sizedPreset("mine-explosives-fence-west", "fence-mesh", 20, 19, 16, 0.1, 90),
    sizedPreset("mine-explosives-fence-east", "fence-mesh", 36, 19, 16, 0.1, 90),
    sizedPreset("mine-explosives-fence-south-west", "fence-mesh", 22.75, 27, 5.5, 0.1),
    sizedPreset("mine-explosives-fence-south-east", "fence-mesh", 33.25, 27, 5.5, 0.1),
    presetObstacle("mine-explosives-gate", "gate-sliding", 28, 27),
    presetObstacle("mine-vehicles-magazine-pickup", "pickup", 28, 29.5, 0),
    // Site fence.
    sizedPreset("mine-vehicles-fence-north-west", "fence-mesh", -5.25, -24, 61.5, 0.1),
    sizedPreset("mine-vehicles-fence-north-east", "fence-mesh", 34.25, -24, 7.5, 0.1),
    sizedPreset("mine-vehicles-fence-west", "fence-mesh", -36, 4, 56, 0.1, 90),
    sizedPreset("mine-vehicles-fence-east", "fence-mesh", 38, 4, 56, 0.1, 90),
    sizedPreset("mine-vehicles-fence-south", "fence-mesh", 1, 32, 74, 0.1),
    ...presetObstacles("mine-vehicles-poles", [["camera-pole", -35, 31], ["camera-pole", 37, 31]])
  ], 3.8);
  ground.coverageRequirements = [
    zone("mine-pit-zone", "mine.pit", "پله شمالی دهانه معدن", -20, -5, -4, -1),
    zone("mine-haul-zone", "mine.haul-road", "جاده حمل غربی", -30, -15.4, -24, -8.6),
    zone("mine-weighbridge-zone", "mine.weighbridge", "باسکول خروجی", 25.2, -22.8, 30.8, -16.2),
    zone("mine-crusher-zone", "mine.crusher", "سکوی تخلیه سنگ‌شکن", 18, -8.3, 26, -5.8)
  ];
  return building([ground]);
}

/**
 * A fenced water-treatment plant: four circular treatment basins joined by channels on
 * the west, and the process building on the east with the pump room on the intake
 * channel, the chemical store and the SCADA control room by the main door.
 *
 * Staff and deliveries come through the guarded gate on the south fence and up the
 * road to the control room door.
 */
function waterTreatmentPlantPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const basin = (id: string, x: number, z: number, diameter: number) => ({
    ...presetObstacle(id, "structural-column", x, z),
    label: "حوضچه تصفیه آب",
    kind: "surface" as const,
    widthM: diameter,
    depthM: diameter,
    heightM: 0.18,
    blocksView: false
  });
  const ground = floor("water-treatment-ground", "تصفیه‌خانه، حوضچه‌ها و کنترل", 0, [
    ...rectangle("water-process-building", 13, -15, 35, 9, 4.2),
    partition("water-chemical-split", 21, -15, 21, 9, 4.2),
    partition("water-control-split", 28, -15, 28, 9, 4.2)
  ], [
    door("water-control-main-entry", "water-process-building-south", 0.16, 1.4),
    door("water-pump-chemical-door", "water-chemical-split", 0.52, 1.2),
    door("water-chemical-control-door", "water-control-split", 0.52, 1.2),
    windowOpening("water-control-window", "water-process-building-east", 0.5, 2.4)
  ], [
    basin("water-basin-a", -23, -4, 15),
    basin("water-basin-b", -5, -4, 15),
    basin("water-basin-c", -23, 15, 15),
    basin("water-basin-d", -5, 15, 15),
    obstacle("water-channel-a", "کانال ارتباطی", "surface", -14, 5.5, 34, 1.2, 0.08, false),
    obstacle("water-channel-b", "کانال ورودی", "surface", 4, 5.5, 1.2, 24, 0.08, false),
    obstacle("water-channel-intake", "کانال آبگیر پمپ‌خانه", "surface", 8.7, -3, 8.2, 1.2, 0.08, false),
    // Pump room: two pump sets on the intake side and the maintenance bench.
    ...presetObstacles("water-pump-assets", [["cnc-machine", 16.5, -8], ["cnc-machine", 16.5, 2]]),
    onWall("water-pump-bench", "workbench", "south", 9, 17),
    // Chemical store: racks on the partition, tool cabinet on the south wall.
    ...alongWall("water-chemical-rack", "storage-rack", "east", 28, [-11, -7.4], t),
    onWall("water-chemical-tools", "tool-cabinet", "south", 9, 24.5),
    // SCADA control room.
    onWall("water-control-console", "monitoring-console", "north", -15, 31.5),
    presetObstacle("water-control-console-chair", "office-chair", 31.5, -13.3, 180),
    onWall("water-control-rack", "equipment-rack", "east", 35, -9),
    presetObstacle("water-control-desk", "office-desk", 31, -6),
    presetObstacle("water-control-desk-chair", "office-chair", 31, -5, 180),
    presetObstacle("water-control-meeting", "meeting-table", 31, 4),
    // Site road, fence, gate and guard booth.
    sizedPreset("water-site-road", "road", 30.5, 18.1, 5, 17.8),
    presetObstacle("water-site-pickup", "pickup", 25, 18, 90),
    sizedPreset("water-site-approach", "road", 30.5, 29, 5, 4),
    sizedPreset("water-site-street", "road", 0, 33, 76, 4),
    sizedPreset("water-site-fence-north", "fence-mesh", 1.5, -18, 71, 0.1),
    sizedPreset("water-site-fence-west", "fence-mesh", -34, 4.5, 45, 0.1, 90),
    sizedPreset("water-site-fence-east", "fence-mesh", 37, 4.5, 45, 0.1, 90),
    sizedPreset("water-site-fence-south-west", "fence-mesh", -3, 27, 62, 0.1),
    sizedPreset("water-site-fence-south-east", "fence-mesh", 35, 27, 4, 0.1),
    presetObstacle("water-site-gate", "gate-sliding", 30.5, 27),
    presetObstacle("water-site-booth", "guard-booth", 35, 24),
    ...presetObstacles("water-site-poles", [["camera-pole", -33, 26], ["camera-pole", 36, 26], ["light-pole", 1, 24]])
  ], 4.4);
  ground.coverageRequirements = [
    zone("water-perimeter-zone", "water-plant.perimeter", "حصار شمالی تصفیه‌خانه", -30, -17.8, -6, -16.3),
    zone("water-basin-zone", "water-plant.basin", "گذرگاه بین حوضچه‌های شمالی", -15.2, -10, -12.8, 2)
  ];
  return building([ground]);
}

/**
 * A fenced factory campus: the production hall with its warehouse, the gatehouse office
 * beside the staff car park, and an administration floor above the hall's service band.
 *
 * Trucks enter through the guarded gate on the north fence into the service yard and back
 * onto the warehouse dock. Staff drive down the east lane to the car park and come in by
 * the office door; a side door takes them into the production hall. The service band
 * along the hall's south side holds the electrical room, the server room and the stair
 * and lift core that rises to the administration floor.
 */
function factoryCampusPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const coreStairs: [number, number] = [7, 9.5];
  const coreLift: [number, number] = [10.3, 9.5];
  const ground = floor("factory-ground", "محوطه، تولید و انبار", 0, [
    ...rectangle("factory-hall", -25, -14, 12, 14, 6),
    ...rectangle("factory-office", 15, -14, 26, 2, 3.4),
    partition("factory-storage", -8, -14, -8, 14, 6),
    partition("factory-service-line", -8, 4, 12, 4, 4),
    partition("factory-electrical-split", 0, 4, 0, 14, 4),
    partition("factory-core-west", 5, 4, 5, 14, 4)
  ], [
    { ...door("factory-dock-door", "factory-hall-north", 0.2297, 4), variant: "double-solid", swingDirection: "outward" },
    { ...door("factory-storage-door", "factory-storage", 0.5, 3), variant: "double-solid" },
    { ...door("factory-hall-side-door", "factory-hall-east", 0.3214, 1.6), swingDirection: "inward" },
    door("factory-electrical-door", "factory-service-line", 0.2, 1.2),
    door("factory-server-door", "factory-service-line", 0.525, 0.9),
    door("factory-core-door", "factory-service-line", 0.825, 1.2),
    { ...door("factory-office-door", "factory-office-south", 0.5, 1.5), swingDirection: "inward" },
    windowOpening("factory-office-window-east", "factory-office-east", 0.5, 2),
    windowOpening("factory-office-window-north", "factory-office-north", 0.5, 2.4),
    windowOpening("factory-hall-window-west", "factory-hall-west", 0.5, 3)
  ], [
    // Warehouse: racking on the west wall and a free-standing row, pallets by the dock.
    ...alongWall("factory-storage-wall-rack", "storage-rack", "west", -25, [-10, -6.4, 4, 7.6]),
    sizedPreset("factory-storage-rack-row", "storage-rack", -18.5, -2, 14, 1.1, 90),
    ...presetObstacles("factory-storage-zone", [
      ["pallet-stack", -12, -11], ["pallet-stack", -12, -8.5], ["crate-stack", -12, 8], ["crate-stack", -12, 11],
      ["packing-table", -17, 11]
    ]),
    // Production hall: two lines feeding the machining cells, then assembly and welding.
    ...presetObstacles("factory-production", [
      ["conveyor", -2.5, -10], ["conveyor", -2.5, -6.5], ["cnc-machine", 5, -10], ["cnc-machine", 8.8, -10],
      ["cnc-machine", 5, -6.5], ["cnc-machine", 8.8, -6.5], ["workbench", -3, -1.5], ["welding-station", 5, -1.5]
    ]),
    ...alongWall("factory-production-tools", "tool-cabinet", "east", 12, [-12, 1.5]),
    // Electrical room, server room and the stair and lift core.
    ...alongWall("factory-electrical-board", "tool-cabinet", "south", 14, [-6.2, -4.6, -3, -1.4]),
    ...alongWall("factory-server-rack", "equipment-rack", "south", 14, [1.4, 2.6]),
    onWall("factory-server-ups", "ups-unit", "east", 5, 11, t),
    presetObstacle("factory-ground-stairs", "stairs-straight", coreStairs[0], coreStairs[1], 90),
    presetObstacle("factory-ground-elevator", "elevator", coreLift[0], coreLift[1]),
    // Gatehouse office: reception facing the staff door, desk and filing on the walls.
    presetObstacle("factory-ground-office-reception", "reception-desk", 20.5, -2),
    presetObstacle("factory-ground-office-reception-chair", "office-chair", 20.5, -2.9, 0),
    onWall("factory-ground-office-desk", "office-desk", "north", -14, 18),
    presetObstacle("factory-ground-office-chair", "office-chair", 18, -12.6, 180),
    onWall("factory-ground-office-filing", "filing-cabinet", "east", 26, -10),
    // Service yard and dock on the north side.
    sizedPreset("factory-yard-road", "road", 0, -21, 56, 8),
    presetObstacle("factory-yard-dock-platform", "loading-platform", -16.5, -15.3),
    presetObstacle("factory-yard-truck", "truck", -16.5, -20.6, 270),
    presetObstacle("factory-yard-van", "van", 5, -21, 0),
    presetObstacle("factory-yard-speed-bump", "speed-bump", 20, -19.5),
    // Hazardous materials beside the warehouse.
    { ...sizedPreset("factory-yard-hazard-tank-a", "chemical-tank", -22, 17.2, 3, 2.4), label: "مخزن مواد شیمیایی", heightM: 2.4 },
    { ...sizedPreset("factory-yard-hazard-tank-b", "chemical-tank", -17.5, 17.2, 3, 2.4), label: "مخزن مواد شیمیایی", heightM: 2.4 },
    // East lane and the staff car park.
    sizedPreset("factory-yard-east-lane", "road", 28, -6.5, 3.6, 21),
    sizedPreset("factory-yard-staff-parking", "road", 21, 11, 17.6, 14),
    ...parkingRow("factory-yard-staff-car", ["sedan", "suv", "pickup", "sedan", "suv", "sedan"], [14.5, 17.2, 19.9, 22.6, 25.3, 28], 15.6, "south"),
    // Perimeter fence, vehicle gate, guard booth and street.
    sizedPreset("factory-yard-fence-north-west", "fence-wall", -6.25, -26, 47.5, 0.25),
    sizedPreset("factory-yard-fence-north-east", "fence-wall", 26.25, -26, 7.5, 0.25),
    sizedPreset("factory-yard-fence-west", "fence-wall", -30, -3, 46, 0.25, 90),
    sizedPreset("factory-yard-fence-east", "fence-wall", 30, -3, 46, 0.25, 90),
    sizedPreset("factory-yard-fence-south", "fence-wall", 0, 20, 60, 0.25),
    presetObstacle("factory-yard-gate", "gate-sliding", 20, -26),
    presetObstacle("factory-yard-barrier", "parking-barrier", 20, -23.5),
    presetObstacle("factory-yard-guard-booth", "guard-booth", 25.5, -23.5),
    sizedPreset("factory-yard-gate-road", "road", 20, -27, 6, 2),
    sizedPreset("factory-yard-street", "road", 0, -30, 64, 4),
    ...presetObstacles("factory-yard-poles", [["camera-pole", -29, 19], ["light-pole", -29, -25], ["light-pole", 29, 19]])
  ], 6.2);
  ground.coverageRequirements = [
    zone("factory-gate-zone", "industrial.vehicle-gate", "گیت خودرو", 17.5, -25.7, 22.5, -22),
    zone("factory-dock-zone", "industrial.dock", "بارانداز انبار", -21, -17.2, -12, -14.4),
    zone("factory-staff-entry-zone", "industrial.staff-entrance", "درِ ورود پرسنل", 18.5, 2.3, 22.5, 5.5),
    zone("factory-perimeter-zone", "industrial.perimeter", "حصار غربی کارخانه", -29.7, -14, -28.2, 10),
    zone("factory-parking-zone", "shared.staff-parking", "پارکینگ کارکنان", 13, 5, 29, 12.5),
    zone("factory-hazard-zone", "industrial.hazard", "مخازن مواد شیمیایی", -25, 14.5, -14, 15.9)
  ];

  // Administration floor above the production side and the service band.
  const admin = floor("factory-admin", "مدیریت، کنترل کیفیت و رفاه", 1, [
    ...rectangle("factory-admin-shell", -8, -6, 12, 14),
    partition("factory-admin-h", -8, 4, 5, 4),
    partition("factory-admin-core-north", 5, 4, 12, 4),
    partition("factory-admin-core-west", 5, 4, 5, 14),
    partition("factory-admin-break-split", -1, 4, -1, 14),
    glassPartition("factory-admin-meeting-wall", 2, -6, 2, 4)
  ], [
    door("factory-admin-core-door", "factory-admin-core-west", 0.3, 1.2),
    door("factory-admin-office-door", "factory-admin-h", 0.6923, 1.2),
    door("factory-admin-break-door", "factory-admin-break-split", 0.5, 1),
    door("factory-admin-meeting-door", "factory-admin-meeting-wall", 0.5, 1),
    windowOpening("factory-admin-window-north-a", "factory-admin-shell-north", 0.25, 2.5),
    windowOpening("factory-admin-window-north-b", "factory-admin-shell-north", 0.75, 2.5),
    windowOpening("factory-admin-window-east", "factory-admin-shell-east", 0.3, 2)
  ], [
    // Open office: desks under the north windows, a screen and filing on the west wall.
    ...[-6, -3.5, -1].flatMap((x, index) => [
      onWall(`factory-admin-desk-${index + 1}`, "office-desk", "north", -6, x),
      presetObstacle(`factory-admin-chair-${index + 1}`, "office-chair", x, -4.6, 180)
    ]),
    presetObstacle("factory-admin-screen", "partition-screen", -3.5, -1.5),
    onWall("factory-admin-filing", "filing-cabinet", "west", -8, 0),
    // Meeting room.
    presetObstacle("factory-admin-meeting-table", "meeting-table", 7, -1),
    ...tableChairs("factory-admin-meeting-chairs", 7, -1),
    onWall("factory-admin-meeting-board", "whiteboard", "south", 4, 8.5, t),
    // Floor lobby off the core: reception facing the core door and a sofa.
    presetObstacle("factory-admin-reception", "reception-desk", 1.8, 9.5, 270),
    presetObstacle("factory-admin-reception-chair", "office-chair", 0.9, 9.5, 270),
    onWall("factory-admin-lobby-sofa", "lobby-sofa", "south", 14, 2),
    presetObstacle("factory-admin-coffee-table", "coffee-table", 2, 12),
    // Break room.
    onWall("factory-admin-kitchen", "kitchen-counter", "west", -8, 8),
    onWall("factory-admin-fridge", "fridge", "west", -8, 10.4),
    onWall("factory-admin-vending", "vending-machine", "south", 14, -6),
    presetObstacle("factory-admin-break-table", "dining-table", -4, 8.5, 90),
    ...tableChairs("factory-admin-break-chairs", -4, 8.5, 90, "dining-chair"),
    // Core.
    topLanding("factory-admin-landing", coreStairs[0], coreStairs[1], 90),
    presetObstacle("factory-admin-elevator", "elevator", coreLift[0], coreLift[1])
  ], 3.8);
  admin.elevationM = ground.heightM;
  return building([ground, admin]);
}

/**
 * A small residential block: car park and lobby at grade, one apartment per upper floor.
 *
 * The lift and stair have separate shafts in the same place on every floor, opening onto
 * the lobby below and a landing corridor above. Each floor has a resident storage room
 * off the stair. Apartments stay privacy areas, but are still furnished correctly: the
 * kitchen run backs onto the façade, beds have their headboards on walls.
 */
function residentialParkingPlan(): BuildingPlan {
  const t = partitionThicknessM;
  const coreWalls = (prefix: string) => [
    partition(`${prefix}-landing-west`, 8, -12, 8, 12),
    partition(`${prefix}-core-split`, 11, -2, 11, 5),
    partition(`${prefix}-core-north`, 8, -2, 16, -2),
    partition(`${prefix}-core-south`, 8, 5, 16, 5)
  ];
  const coreDoors = (prefix: string) => [
    door(`${prefix}-lift-door`, `${prefix}-core-south`, 0.2, 1.2),
    door(`${prefix}-stair-door`, `${prefix}-core-south`, 0.8125, 1.2),
    door(`${prefix}-store-door`, `${prefix}-core-north`, 0.8125, 0.9)
  ];
  const parking = floor("residential-parking", "پارکینگ و لابی", 0, [
    ...rectangle("residential-parking-shell", -16, -12, 16, 12),
    ...coreWalls("residential"),
    partition("residential-lobby-storage", 8, -6, 16, -6)
  ], [
    { ...door("residential-gate", "residential-parking-shell-south", 0.625, 4), variant: "double-solid" },
    { ...door("residential-pedestrian-entry", "residential-parking-shell-south", 0.125, 1.6), variant: "double-glass", swingDirection: "inward" },
    door("residential-lobby-door", "residential-landing-west", 0.875, 1.2),
    door("residential-storage-door", "residential-landing-west", 0.125, 1.2),
    ...coreDoors("residential"),
    windowOpening("residential-lobby-window", "residential-parking-shell-east", 0.95, 1.6)
  ], [
    // Car park: two rows of nosed-in bays, the gate lane and the lobby door kept clear.
    ...parkingRow("residential-bay-north", ["sedan", "suv", "sedan", "sedan", "suv", "sedan", "sedan", "suv"], [-14, -11.3, -8.6, -5.9, -3.2, -0.5, 2.2, 4.9], -9.2, "north"),
    ...parkingRow("residential-bay-south", ["sedan", "suv", "sedan", "sedan", "suv"], [-14, -11.3, -8.6, 0.9, 3.6], 8.8, "south"),
    ...[-14, -11.3, -8.6, -5.9, -3.2, -0.5, 2.2, 4.9].map((x, index) => presetObstacle(`residential-wheel-stop-${index + 1}`, "wheel-stop", x, -11.78)),
    ...presetObstacles("residential-parking-tools", [
      ["parking-barrier", -4, 10.6], ["speed-bump", -4, 8.6], ["bollard", 7.2, -1], ["bollard", 7.2, 3]
    ]),
    // Lobby: concierge facing the entrance, mailboxes and seating.
    presetObstacle("residential-concierge", "reception-desk", 10.5, 9.2),
    presetObstacle("residential-concierge-chair", "office-chair", 10.5, 8.3, 0),
    onWall("residential-mailboxes", "locker-row", "north", 5, 12.4, t),
    onWall("residential-lobby-sofa", "lobby-sofa", "east", 16, 8.5),
    presetObstacle("residential-lobby-table", "coffee-table", 14.2, 8.5, 90),
    // Server room and resident storage.
    onWall("residential-server-rack", "equipment-rack", "north", -6, 10, t),
    onWall("residential-server-ups", "ups-unit", "north", -6, 11.2, t),
    onWall("residential-storage-rack", "storage-rack", "north", -12, 12),
    presetObstacle("residential-storage-crates", "crate-stack", 14.6, -8.5),
    presetObstacle("residential-parking-stairs", "stairs-straight", 12, 2, 90),
    presetObstacle("residential-parking-elevator", "elevator", 9.6, 2, 90)
  ]);
  parking.coverageRequirements = [
    zone("residential-gate-zone", "apartment.parking-gate", "درِ پارکینگ و راهبند", -6.5, 9.8, -1.5, 11.9)
  ];

  const apartment = (index: number) => {
    const p = `residential-${index}`;
    return floor(p, `طبقه مسکونی ${index}`, index, [
      ...rectangle(`${p}-shell`, -16, -12, 16, 12),
      ...coreWalls(p),
      partition(`${p}-unit-north`, -16, -1, 8, -1),
      partition(`${p}-unit-south`, -16, 2, 8, 2),
      partition(`${p}-bed-divider-a`, -6, -12, -6, -1),
      partition(`${p}-bed-divider-b`, 2, -12, 2, -1),
      partition(`${p}-living-divider`, -2, 2, -2, 12)
    ], [
      door(`${p}-entry`, `${p}-landing-west`, 0.8542, 1.1),
      door(`${p}-hall-living`, `${p}-unit-south`, 0.2917, 1.2),
      door(`${p}-hall-kitchen`, `${p}-unit-south`, 0.8333, 1),
      door(`${p}-living-kitchen`, `${p}-living-divider`, 0.5, 2.4),
      door(`${p}-bed-a`, `${p}-unit-north`, 0.3333, 1),
      door(`${p}-bed-b`, `${p}-unit-north`, 0.625, 1),
      door(`${p}-study`, `${p}-unit-north`, 0.875, 1),
      ...coreDoors(p),
      windowOpening(`${p}-window-north-a`, `${p}-shell-north`, 0.25, 1.6),
      windowOpening(`${p}-window-north-b`, `${p}-shell-north`, 0.4375, 2),
      windowOpening(`${p}-window-north-c`, `${p}-shell-north`, 0.6563, 1.6),
      windowOpening(`${p}-window-south-a`, `${p}-shell-south`, 0.7813, 2.4),
      windowOpening(`${p}-window-south-b`, `${p}-shell-south`, 0.4063, 2),
      windowOpening(`${p}-window-west`, `${p}-shell-west`, 0.2083, 2),
      windowOpening(`${p}-window-east`, `${p}-shell-east`, 0.95, 1.6)
    ], [
      // Living room: TV on the hall wall, sofa facing it.
      onWall(`${p}-tv`, "tv-unit", "north", 2, -12, t),
      ...presetObstacles(`${p}-living`, [
        ["rug", -12, 4.5], ["coffee-table", -12, 4.2], ["sofa-three", -12, 6, 180],
        ["sofa-single", -14.2, 4.2, 270], ["sofa-single", -9.8, 4.2, 90]
      ]),
      // Kitchen run on the south façade, fridge on the landing wall, dining table.
      onWall(`${p}-counter-a`, "kitchen-counter", "south", 12, 1),
      onWall(`${p}-sink`, "sink-unit", "south", 12, 2.65),
      onWall(`${p}-dishwasher`, "dishwasher", "south", 12, 3.4),
      onWall(`${p}-stove`, "stove", "south", 12, 4),
      onWall(`${p}-counter-b`, "kitchen-counter", "south", 12, 5.5),
      onWall(`${p}-fridge`, "fridge", "east", 8, 3.2, t),
      presetObstacle(`${p}-dining-table`, "dining-table", 1.5, 6.5),
      ...tableChairs(`${p}-dining-chairs`, 1.5, 6.5, 0, "dining-chair"),
      // Master bedroom.
      onWall(`${p}-bed-master`, "bed-double", "north", -12, -12),
      ...alongWall(`${p}-master-nightstand`, "nightstand", "north", -12, [-13.05, -10.95]),
      onWall(`${p}-master-wardrobe`, "wardrobe", "west", -16, -4),
      onWall(`${p}-master-dresser`, "dresser", "east", -6, -9, t),
      // Second bedroom.
      onWall(`${p}-bed-second`, "bed-single", "north", -12, -4.5),
      onWall(`${p}-second-nightstand`, "nightstand", "north", -12, -3.5),
      onWall(`${p}-second-wardrobe`, "wardrobe", "east", 2, -4, t),
      // Study.
      onWall(`${p}-desk`, "office-desk", "north", -12, 5),
      presetObstacle(`${p}-chair`, "office-chair", 5, -10.6, 180),
      onWall(`${p}-study-shelf`, "bookshelf", "west", 2, -6, t),
      // Resident storage off the stair.
      onWall(`${p}-storage-rack`, "storage-rack", "north", -12, 12),
      presetObstacle(`${p}-storage-crates`, "crate-stack", 14.6, -8.5),
      index < 3
        ? presetObstacle(`${p}-stairs`, "stairs-straight", 12, 2, 90)
        : topLanding(`${p}-landing`, 12, 2, 90),
      presetObstacle(`${p}-elevator`, "elevator", 9.6, 2, 90)
    ]);
  };
  return building([parking, apartment(1), apartment(2), apartment(3)]);
}

/**
 * A compact surveillance-ready abstraction of Kourosh Mall rather than a literal
 * architectural survey: parking and loading below, Hyperstar-style grocery at B1,
 * a retail atrium at grade, and the leisure/food/cinema mix on the upper level.
 */
function kouroshMallPrototypePlan(): BuildingPlan {
  const parking = floor("kourosh-parking", "پارکینگ و بارانداز کوروش مال", -2, [
    ...rectangle("kourosh-parking-shell", -30, -18, 30, 18),
    partition("kourosh-parking-ramp", -30, -9, -17, -9),
    partition("kourosh-parking-service", 16, -18, 16, 18)
  ], [
    door("kourosh-parking-gate", "kourosh-parking-shell-south", 0.2, 5),
    door("kourosh-loading-gate", "kourosh-parking-shell-south", 0.82, 5),
    door("kourosh-parking-service-door", "kourosh-parking-service", 0.72, 1.5),
    windowOpening("kourosh-parking-window-east", "kourosh-parking-shell-east", 0.5, 2.4)
  ], [
    ...mallCore("kourosh-parking"),
    ...presetObstacles("kourosh-parking-cars", [
      ["sedan", -25, -13, 90], ["suv", -19, -13, 90], ["sedan", -13, -13, 90],
      ["pickup", -7, -13, 90], ["sedan", 7, -13, 90], ["van", 13, -13, 90],
      ["suv", -25, 12, 90], ["sedan", -19, 12, 90], ["sedan", -13, 12, 90],
      ["suv", -7, 12, 90], ["pickup", 7, 12, 90], ["van", 13, 12, 90],
      ["truck", 23, 10, 90], ["truck", 23, -8, 90]
    ]),
    ...presetObstacles("kourosh-parking-safety", [
      ["parking-barrier", -20, 16], ["parking-barrier", 20, 16], ["guard-booth", -25, 15],
      ["speed-bump", -10, 15], ["speed-bump", 10, 15], ["bollard", -5, -3], ["bollard", 5, -3],
      ["wheel-stop", -25, 15], ["wheel-stop", -19, 15], ["equipment-rack", 28, -15, 90]
    ])
  ], 3.8);

  const hypermarket = floor("kourosh-hypermarket", "هایپرمارکت کوروش مال", -1, [
    ...rectangle("kourosh-hyper-shell", -30, -18, 30, 18),
    glassPartition("kourosh-hyper-front", -30, -12, 30, -12),
    partition("kourosh-hyper-back", -30, 11, 30, 11),
    partition("kourosh-hyper-cold", 19, -12, 19, 11),
    partition("kourosh-hyper-stock", -18, 11, -18, 18)
  ], [
    door("kourosh-hyper-entry-a", "kourosh-hyper-front", 0.38, 2.2),
    door("kourosh-hyper-entry-b", "kourosh-hyper-front", 0.62, 2.2),
    door("kourosh-hyper-stock-door", "kourosh-hyper-back", 0.18, 1.8),
    door("kourosh-hyper-cold-door", "kourosh-hyper-cold", 0.7, 1.5),
    windowOpening("kourosh-hyper-window-east", "kourosh-hyper-shell-east", 0.5, 2.8)
  ], [
    ...mallCore("kourosh-hyper"),
    ...presetObstacles("kourosh-hyper-aisles-a", [
      ["shelving-unit", -25, -8], ["shelving-unit", -21, -8], ["shelving-unit", -17, -8], ["shelving-unit", -13, -8],
      ["shelving-unit", -25, -4], ["shelving-unit", -21, -4], ["shelving-unit", -17, -4], ["shelving-unit", -13, -4],
      ["shelving-unit", -25, 4], ["shelving-unit", -21, 4], ["shelving-unit", -17, 4], ["shelving-unit", -13, 4],
      ["shelving-unit", -25, 8], ["shelving-unit", -21, 8], ["shelving-unit", -17, 8], ["shelving-unit", -13, 8]
    ]),
    ...presetObstacles("kourosh-hyper-aisles-b", [
      ["shelving-unit", 8, -8], ["shelving-unit", 12, -8], ["shelving-unit", 16, -8],
      ["shelving-unit", 8, -4], ["shelving-unit", 12, -4], ["shelving-unit", 16, -4],
      ["shelving-unit", 8, 4], ["shelving-unit", 12, 4], ["shelving-unit", 16, 4],
      ["shelving-unit", 8, 8], ["shelving-unit", 12, 8], ["shelving-unit", 16, 8]
    ]),
    ...presetObstacles("kourosh-hyper-cold-assets", [
      ["display-fridge", 22, -9, 90], ["display-fridge", 22, -5, 90], ["display-fridge", 22, -1, 90],
      ["display-fridge", 22, 3, 90], ["display-fridge", 22, 7, 90], ["display-fridge", 27, 7, 90],
      ["fridge", 27, -8, 90], ["fridge", 27, -4, 90], ["fridge", 27, 0, 90]
    ]),
    ...presetObstacles("kourosh-hyper-checkouts", [
      ["checkout-counter", -18, -14], ["checkout-counter", -13, -14], ["checkout-counter", -8, -14],
      ["checkout-counter", -3, -14], ["checkout-counter", 3, -14], ["checkout-counter", 8, -14],
      ["queue-barrier", -18, -16], ["queue-barrier", -8, -16], ["queue-barrier", 3, -16],
      ["storage-rack", -27, 14, 90], ["storage-rack", -22, 14, 90], ["pallet-stack", -14, 14],
      ["crate-stack", -10, 14], ["packing-table", -5, 14], ["equipment-rack", 28, 14, 90]
    ])
  ]);

  const retail = floor("kourosh-retail", "همکف تجاری و آتریوم کوروش مال", 0, [
    ...rectangle("kourosh-retail-shell", -30, -18, 30, 18),
    glassPartition("kourosh-retail-north", -30, 8, 30, 8),
    glassPartition("kourosh-retail-west", -10, -18, -10, 8),
    glassPartition("kourosh-retail-east", 10, -18, 10, 8)
  ], [
    door("kourosh-main-entry-a", "kourosh-retail-shell-south", 0.38, 3),
    door("kourosh-main-entry-b", "kourosh-retail-shell-south", 0.62, 3),
    door("kourosh-retail-west-door", "kourosh-retail-west", 0.35, 1.8),
    door("kourosh-retail-east-door", "kourosh-retail-east", 0.35, 1.8),
    windowOpening("kourosh-retail-window-north-a", "kourosh-retail-shell-north", 0.25, 4),
    windowOpening("kourosh-retail-window-north-b", "kourosh-retail-shell-north", 0.75, 4)
  ], [
    ...mallCore("kourosh-retail"),
    ...presetObstacles("kourosh-retail-shops", [
      ["clothing-rack", -25, -10, 90], ["clothing-rack", -21, -10, 90], ["display-stand", -16, -10],
      ["clothing-rack", 25, -10, 90], ["clothing-rack", 21, -10, 90], ["display-stand", 16, -10],
      ["shelving-unit", -25, -3, 90], ["shelving-unit", -20, -3, 90], ["display-stand", -15, -3],
      ["shelving-unit", 25, -3, 90], ["shelving-unit", 20, -3, 90], ["display-stand", 15, -3],
      ["checkout-counter", -24, 5], ["checkout-counter", 24, 5], ["display-fridge", -28, 5, 90], ["display-fridge", 28, 5, 90]
    ]),
    ...presetObstacles("kourosh-retail-atrium", [
      ["concierge-desk", 0, -9], ["queue-barrier", -4, -12], ["queue-barrier", 4, -12],
      ["lobby-sofa", -7, 12], ["lobby-sofa", 7, 12], ["coffee-table", -7, 10.5], ["coffee-table", 7, 10.5],
      ["vending-machine", -27, 14, 90], ["vending-machine", 27, 14, 90], ["luggage-cart", -12, 14],
      ["equipment-rack", 12, 14, 90], ["display-stand", -20, 13], ["display-stand", 20, 13]
    ])
  ]);

  const leisure = floor("kourosh-leisure", "طبقه دوم، فودکورت و شهربازی ژوپیتر", 1, [
    ...rectangle("kourosh-leisure-shell", -30, -18, 30, 18),
    partition("kourosh-leisure-cinema", -30, 7, 30, 7),
    glassPartition("kourosh-leisure-food", 10, -18, 10, 7),
    partition("kourosh-leisure-play", -12, -18, -12, 7)
  ], [
    door("kourosh-cinema-entry-a", "kourosh-leisure-cinema", 0.28, 1.8),
    door("kourosh-cinema-entry-b", "kourosh-leisure-cinema", 0.72, 1.8),
    door("kourosh-food-door", "kourosh-leisure-food", 0.55, 1.8),
    door("kourosh-play-door", "kourosh-leisure-play", 0.55, 1.8),
    windowOpening("kourosh-leisure-window-north-a", "kourosh-leisure-shell-north", 0.25, 4),
    windowOpening("kourosh-leisure-window-north-b", "kourosh-leisure-shell-north", 0.75, 4)
  ], [
    ...mallCore("kourosh-leisure"),
    obstacle("kourosh-bowling", "بولینگ و بازی گروهی", "block", -20, 12, 17, 7, 1.1, false),
    obstacle("kourosh-family-zone", "سرگرمی خانوادگی", "block", 0, 12, 17, 7, 1.1, false),
    obstacle("kourosh-events-zone", "رویداد و اجرای کودک", "block", 20, 12, 17, 7, 1.1, false),
    obstacle("kourosh-jupiter", "شهربازی ژوپیتر", "block", -21, -5, 14, 9, 1.1, false),
    ...presetObstacles("kourosh-food-counters", [
      ["kitchen-counter", 14, -14], ["kitchen-counter", 19, -14], ["kitchen-counter", 24, -14],
      ["display-fridge", 28, -13, 90], ["checkout-counter", 14, -10], ["checkout-counter", 20, -10], ["checkout-counter", 26, -10]
    ]),
    ...presetObstacles("kourosh-food-tables", [
      ["dining-table", 15, -4], ["dining-table", 21, -4], ["dining-table", 27, -4],
      ["dining-table", 15, 2], ["dining-table", 21, 2], ["dining-table", 27, 2],
      ["lobby-sofa", -7, -10], ["coffee-table", -7, -8.5], ["vending-machine", 7, -14, 90],
      ["queue-barrier", -5, 5], ["queue-barrier", 5, 5], ["equipment-rack", 28, 5, 90]
    ]),
    ...tableChairs("kourosh-food-a", 15, -4, 0, "dining-chair"),
    ...tableChairs("kourosh-food-b", 21, -4, 0, "dining-chair"),
    ...tableChairs("kourosh-food-c", 27, -4, 0, "dining-chair"),
    ...tableChairs("kourosh-food-d", 15, 2, 0, "dining-chair"),
    ...tableChairs("kourosh-food-e", 21, 2, 0, "dining-chair"),
    ...tableChairs("kourosh-food-f", 27, 2, 0, "dining-chair")
  ]);

  const cinema = floor("kourosh-cinema", "طبقه ششم، پردیس سینمایی کوروش", 2, [
    ...rectangle("kourosh-cinema-shell", -30, -18, 30, 18),
    partition("kourosh-cinema-lobby", -30, 3, 30, 3),
    partition("kourosh-cinema-west", -10, 3, -10, 18),
    partition("kourosh-cinema-east", 10, 3, 10, 18)
  ], [
    door("kourosh-cinema-hall-a", "kourosh-cinema-lobby", 0.18, 1.8),
    door("kourosh-cinema-hall-b", "kourosh-cinema-lobby", 0.5, 1.8),
    door("kourosh-cinema-hall-c", "kourosh-cinema-lobby", 0.82, 1.8),
    door("kourosh-cinema-west-exit", "kourosh-cinema-west", 0.55, 1.4),
    door("kourosh-cinema-east-exit", "kourosh-cinema-east", 0.55, 1.4),
    windowOpening("kourosh-cinema-window-east", "kourosh-cinema-shell-east", 0.35, 2.5)
  ], [
    ...mallCore("kourosh-cinema"),
    obstacle("kourosh-cinema-a", "سالن سینمای کوروش ۱", "block", -20, 11, 17, 12, 3, true),
    obstacle("kourosh-cinema-b", "سالن سینمای کوروش ۲", "block", 0, 11, 17, 12, 3, true),
    obstacle("kourosh-cinema-c", "سالن سینمای کوروش ۳", "block", 20, 11, 17, 12, 3, true),
    ...presetObstacles("kourosh-cinema-lobby-assets", [
      ["checkout-counter", -24, -12], ["checkout-counter", -18, -12], ["queue-barrier", -21, -9],
      ["display-fridge", 25, -13, 90], ["display-fridge", 28, -13, 90], ["vending-machine", 28, -8, 90],
      ["lobby-sofa", -15, -3], ["lobby-sofa", -8, -3], ["lobby-sofa", 8, -3], ["lobby-sofa", 15, -3],
      ["coffee-table", -15, -1.5], ["coffee-table", -8, -1.5], ["coffee-table", 8, -1.5], ["coffee-table", 15, -1.5],
      ["equipment-rack", 27, 0, 90], ["concierge-desk", 20, -12]
    ])
  ]);

  const roof = floor("kourosh-roof", "طبقه هفتم، فودکورت و روف‌گاردن کوروش", 3, [
    ...rectangle("kourosh-roof-shell", -30, -18, 30, 18, 2.2),
    ...rectangle("kourosh-roof-core", -7, -5, 7, 5),
    glassPartition("kourosh-roof-food", 10, -18, 10, 18, 2.8)
  ], [
    door("kourosh-roof-core-door", "kourosh-roof-core-south", 0.5, 1.8),
    door("kourosh-roof-food-door", "kourosh-roof-food", 0.5, 1.8),
    windowOpening("kourosh-roof-window-east", "kourosh-roof-shell-east", 0.5, 3),
    windowOpening("kourosh-roof-window-west", "kourosh-roof-shell-west", 0.5, 3)
  ], [
    ...mallCore("kourosh-roof", true),
    ...presetObstacles("kourosh-roof-food", [
      ["kitchen-counter", 15, -14], ["kitchen-counter", 20, -14], ["kitchen-counter", 25, -14],
      ["checkout-counter", 15, -10], ["checkout-counter", 21, -10], ["checkout-counter", 27, -10],
      ["display-fridge", 28, -15, 90], ["vending-machine", 28, 15, 90],
      ["dining-table", 15, -3], ["dining-table", 22, -3], ["dining-table", 15, 4], ["dining-table", 22, 4],
      ["dining-table", 15, 11], ["dining-table", 22, 11]
    ]),
    ...tableChairs("kourosh-roof-table-a", 15, -3, 0, "dining-chair"),
    ...tableChairs("kourosh-roof-table-b", 22, -3, 0, "dining-chair"),
    ...tableChairs("kourosh-roof-table-c", 15, 4, 0, "dining-chair"),
    ...tableChairs("kourosh-roof-table-d", 22, 4, 0, "dining-chair"),
    ...tableChairs("kourosh-roof-table-e", 15, 11, 0, "dining-chair"),
    ...tableChairs("kourosh-roof-table-f", 22, 11, 0, "dining-chair"),
    ...presetObstacles("kourosh-roof-garden", [
      ["grass", -20, -10], ["grass", -20, 10], ["grass", -10, -12], ["grass", -10, 12],
      ["palm", -25, -13], ["palm", -25, 13], ["deciduous", -15, -12], ["deciduous", -15, 12],
      ["bush", -10, -8], ["bush", -10, 8], ["hedge", -22, 0, 90], ["light-pole", -28, 0]
    ])
  ]);

  return building([parking, hypermarket, retail, leisure, cinema, roof]);
}

function kouroshEnvelope(prefix: string, heightM = 3.4): PlanWall[] {
  const points: Vec2[] = [
    { x: -49, z: -41 }, { x: 47, z: -41 }, { x: 58, z: -30 }, { x: 58, z: 30 },
    { x: 47, z: 41 }, { x: -49, z: 41 }, { x: -58, z: 30 }, { x: -58, z: -30 }
  ];
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return points.map((point, index) => wall(
    `${prefix}-envelope-${names[index]}`,
    point,
    points[(index + 1) % points.length],
    heightM
  ));
}

function kouroshAtrium(prefix: string): PlanWall[] {
  const points: Vec2[] = [
    { x: -14, z: -13 }, { x: 14, z: -13 }, { x: 20, z: -7 }, { x: 20, z: 8 },
    { x: 14, z: 14 }, { x: -14, z: 14 }, { x: -20, z: 8 }, { x: -20, z: -7 }
  ];
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return points.map((point, index) => glassPartition(
    `${prefix}-atrium-${names[index]}`,
    point.x,
    point.z,
    points[(index + 1) % points.length].x,
    points[(index + 1) % points.length].z,
    1.35
  ));
}

function kouroshAccessCore(prefix: string, top = false): PlanObstacle[] {
  // Keep stairs in the north/south circulation bands and lift banks in the
  // east/west bands. Their previous coordinates landed inside shop units.
  const stairPositions: Array<[number, number]> = [[-39, -12], [39, -12], [-39, 12], [39, 12]];
  const elevatorPositions: Array<[number, number]> = [
    [-39, -8], [-39, -2.7], [-39, 2.7], [-39, 8], [39, -8], [39, -2.7], [39, 2.7], [39, 8]
  ];
  const escalatorPositions: Array<[number, number]> = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
  return [
    ...stairPositions.map(([x, z], index) => top
      ? topLanding(`${prefix}-landing-${index + 1}`, x, z, 90)
      : presetObstacle(`${prefix}-stairs-${index + 1}`, "stairs-straight", x, z, 90)),
    ...elevatorPositions.map(([x, z], index) => presetObstacle(`${prefix}-elevator-${index + 1}`, "elevator", x, z, 90)),
    ...escalatorPositions.map(([x, z], index) => presetObstacle(`${prefix}-escalator-${index + 1}`, "escalator", x, z, 90))
  ];
}

function shopBand(
  prefix: string,
  count: number,
  start: number,
  end: number,
  front: number,
  back: number,
  horizontal: boolean
): { walls: PlanWall[]; doors: PlanDoor[] } {
  const walls: PlanWall[] = [];
  const doors: PlanDoor[] = [];
  const step = (end - start) / count;
  for (let index = 0; index < count; index += 1) {
    const from = start + step * index;
    const to = from + step;
    const frontageId = `${prefix}-shop-${index + 1}-front`;
    walls.push(horizontal
      ? glassPartition(frontageId, from, front, to, front)
      : glassPartition(frontageId, front, from, front, to));
    walls.push(horizontal
      ? partition(`${prefix}-shop-${index + 1}-side`, from, front, from, back)
      : partition(`${prefix}-shop-${index + 1}-side`, front, from, back, from));
    doors.push(door(`${prefix}-shop-${index + 1}-door`, frontageId, 0.5, Math.min(0.9, Math.abs(step) * 0.62)));
  }
  walls.push(horizontal
    ? partition(`${prefix}-shop-end`, end, front, end, back)
    : partition(`${prefix}-shop-end`, front, end, back, end));
  return { walls, doors };
}

function kouroshShopRing(prefix: string, total: number) {
  const definitions = [
    { name: "north-inner", weight: 96, start: -48, end: 48, front: -22, back: -15, horizontal: true },
    { name: "north-outer", weight: 96, start: -48, end: 48, front: -30, back: -40, horizontal: true },
    { name: "south-inner", weight: 96, start: -48, end: 48, front: 22, back: 15, horizontal: true },
    { name: "south-outer", weight: 96, start: -48, end: 48, front: 30, back: 40, horizontal: true },
    { name: "west-inner", weight: 46, start: -23, end: 23, front: -34, back: -22, horizontal: false },
    { name: "west-outer", weight: 46, start: -23, end: 23, front: -44, back: -57, horizontal: false },
    { name: "east-inner", weight: 46, start: -23, end: 23, front: 34, back: 22, horizontal: false },
    { name: "east-outer", weight: 46, start: -23, end: 23, front: 44, back: 57, horizontal: false }
  ];
  const weightTotal = definitions.reduce((sum, item) => sum + item.weight, 0);
  const counts = definitions.map((item) => Math.floor(total * item.weight / weightTotal));
  for (let index = 0; counts.reduce((sum, count) => sum + count, 0) < total; index = (index + 1) % counts.length) counts[index] += 1;
  const bands = definitions.map((item, index) => shopBand(
    `${prefix}-${item.name}`,
    counts[index],
    item.start,
    item.end,
    item.front,
    item.back,
    item.horizontal
  ));
  return {
    walls: bands.flatMap((band) => band.walls),
    doors: bands.flatMap((band) => band.doors)
  };
}

function kouroshRetailAssets(prefix: string): PlanObstacle[] {
  const shopFixtures: Array<[ObstacleVariant, number, number, number?]> = [];
  for (const z of [-27, -18, 18, 27]) {
    // At z=±18 the outer x positions sit in the side-shop entrance lanes.
    // Keep those two rows in the north/south units so no rack masks a door.
    const xs = Math.abs(z) === 18 ? [-26, -17, 17, 26] : [-44, -35, -26, -17, 17, 26, 35, 44];
    for (const x of xs) {
      const variant: ObstacleVariant = shopFixtures.length % 3 === 0 ? "clothing-rack" : shopFixtures.length % 3 === 1 ? "shelving-unit" : "display-stand";
      shopFixtures.push([variant, x, z, 0]);
    }
  }
  return [
    ...presetObstacles(`${prefix}-shop-fixtures`, shopFixtures),
    ...presetObstacles(`${prefix}-atrium-kiosks`, [
      ["display-stand", -16, -10], ["display-stand", 16, -10], ["display-stand", -16, 11], ["display-stand", 16, 11],
      ["concierge-desk", 0, -16], ["lobby-sofa", -7, 0, 90], ["lobby-sofa", 7, 0, 90],
      ["coffee-table", -7, 0, 90], ["coffee-table", 7, 0, 90], ["equipment-rack", 42, 27, 90]
    ]),
    ...kouroshAccessCore(`${prefix}-core`)
  ];
}

function kouroshCommercialFloor(id: string, name: string, index: number, shopCount: number): FloorPlan {
  const ring = kouroshShopRing(id, shopCount);
  return floor(id, name, index, [
    ...kouroshEnvelope(id),
    ...kouroshAtrium(id),
    ...ring.walls
  ], [
    ...ring.doors,
    windowOpening(`${id}-window-east`, `${id}-envelope-east`, 0.5, 3.2)
  ], kouroshRetailAssets(id));
}

function kouroshParkingFloor(index: number): FloorPlan {
  const id = `kourosh-parking-b${Math.abs(index)}`;
  const vehiclePlacements: Array<[ObstacleVariant, number, number, number]> = [];
  const variants: ObstacleVariant[] = ["sedan", "suv", "sedan", "pickup", "sedan", "van"];
  for (const z of [-27, -9, 9, 27]) {
    for (const x of [-48, -25, -17, -9, 9, 17, 25, 48]) {
      vehiclePlacements.push([variants[vehiclePlacements.length % variants.length], x, z, 90]);
    }
  }
  return floor(id, `پارکینگ کوروش مال B${Math.abs(index)}`, index, [
    ...kouroshEnvelope(id, 3.6),
    partition(`${id}-lane-west`, -6, -34, -6, 34, 1.2),
    partition(`${id}-lane-east`, 6, -34, 6, 34, 1.2)
  ], [
    door(`${id}-vehicle-gate`, `${id}-envelope-south`, 0.5, 6),
    windowOpening(`${id}-vent-east`, `${id}-envelope-east`, 0.5, 3)
  ], [
    ...presetObstacles(`${id}-cars`, vehiclePlacements),
    ...presetObstacles(`${id}-traffic`, [
      ["parking-barrier", -12, 31], ["parking-barrier", 12, 31], ["speed-bump", 0, 27],
      ["guard-booth", -42, 28], ["bollard", -5, -26], ["bollard", 5, -26], ["equipment-rack", 43, -28, 90]
    ]),
    ...kouroshAccessCore(`${id}-core`).filter((item) => item.variant !== "escalator")
  ], 3.6);
}

function kouroshCinemaFloor(index: number, firstHall: number): FloorPlan {
  const id = `kourosh-cinema-${index}`;
  const hallCenters: Array<[number, number]> = [[-32, -21], [0, -21], [32, -21], [-32, 21], [0, 21], [32, 21]];
  const hallWalls = hallCenters.flatMap(([x, z], hallIndex) => rectangle(
    `${id}-hall-${hallIndex + 1}`,
    x - 12,
    z - 6,
    x + 12,
    z + 6,
    4.2
  ));
  return floor(id, `طبقه ${index}، سالن‌های ${firstHall} تا ${firstHall + 5} پردیس سینمایی کوروش`, index, [
    ...kouroshEnvelope(id, 4.2),
    ...hallWalls
  ], [
    ...hallCenters.map((_, hallIndex) => door(
      `${id}-hall-${hallIndex + 1}-door`,
      `${id}-hall-${hallIndex + 1}-${hallIndex < 3 ? "south" : "north"}`,
      0.5,
      1.8
    )),
    windowOpening(`${id}-window-east`, `${id}-envelope-east`, 0.5, 3)
  ], [
    ...hallCenters.map(([x, z], hallIndex) => obstacle(
      `${id}-auditorium-${hallIndex + 1}`,
      `سالن سینما ${firstHall + hallIndex}`,
      "block",
      x,
      z,
      22,
      10,
      3.4,
      true
    )),
    ...presetObstacles(`${id}-lobby`, [
      ["checkout-counter", -10, 0], ["checkout-counter", -5, 0], ["queue-barrier", -7.5, 3],
      ["display-fridge", 38, 0, 90], ["vending-machine", 42, 0, 90], ["lobby-sofa", 12, 0]
    ]),
    ...kouroshAccessCore(`${id}-core`)
  ], 4.2);
}

function kouroshMallPlan(): BuildingPlan {
  const prototype = kouroshMallPrototypePlan();
  const prototypeHyper = prototype.floors.find((item) => item.id === "kourosh-hypermarket");
  const prototypeLeisure = prototype.floors.find((item) => item.id === "kourosh-leisure");
  const prototypeRoof = prototype.floors.find((item) => item.id === "kourosh-roof");
  const stripPrototypeCore = (items: PlanObstacle[] = []) => items.filter((item) =>
    item.variant !== "stairs-straight" && item.variant !== "elevator" && item.variant !== "escalator" && !item.label.includes("پاگرد نهایی")
  );

  const parkingFloors = [-9, -8, -7, -6, -5, -4, -3].map(kouroshParkingFloor);
  const hyperRing = kouroshShopRing("kourosh-hyper-b2", 68);
  const hypermarket = floor("kourosh-hyper-b2", "زیرزمین دوم، هایپراستار، ۳۱ واحد تجاری و ۳۷ واحد بازار طلا", -2, [
    ...kouroshEnvelope("kourosh-hyper-b2"),
    ...kouroshAtrium("kourosh-hyper-b2"),
    ...hyperRing.walls,
    partition("kourosh-hyper-b2-stock", -42, 16, 42, 16)
  ], [
    ...hyperRing.doors,
    door("kourosh-hyper-b2-stock-door", "kourosh-hyper-b2-stock", 0.82, 2),
    windowOpening("kourosh-hyper-b2-window-east", "kourosh-hyper-b2-envelope-east", 0.5, 3)
  ], [
    ...stripPrototypeCore(prototypeHyper?.obstacles),
    ...kouroshAccessCore("kourosh-hyper-b2-core")
  ]);

  const commercialB1 = kouroshCommercialFloor("kourosh-commercial-b1", "منفی یک، ۱۴۹ واحد تجاری و ۴۶ واحد بازار طلا", -1, 195);
  const ground = kouroshCommercialFloor("kourosh-commercial-ground", "همکف، ۱۱۱ واحد تجاری و ۲۵ واحد شمالی", 0, 136);
  ground.doors = [
    ...(ground.doors ?? []),
    door("kourosh-main-entry", "kourosh-commercial-ground-envelope-south", 0.5, 4.5)
  ];
  const first = kouroshCommercialFloor("kourosh-commercial-first", "طبقه اول، ۱۴۳ واحد تجاری، بورس موبایل و تراریوم", 1, 143);
  first.obstacles = first.obstacles.filter((item) =>
    !item.id.includes("-atrium-kiosks-lobby-sofa") && !item.id.includes("-atrium-kiosks-coffee-table")
  );
  first.obstacles.push(
    obstacle("kourosh-terrarium", "تراریوم کوروش", "block", 0, 0, 15, 10, 2.2, false),
    presetObstacle("kourosh-terrarium-palm-a", "palm", -3, 0),
    presetObstacle("kourosh-terrarium-palm-b", "palm", 3, 0)
  );

  const leisure = floor("kourosh-leisure-2", "طبقه دوم، ژوپیتر ۴۴۲۸ مترمربع و فودکورت", 2, [
    ...kouroshEnvelope("kourosh-leisure-2", 4.2),
    ...kouroshAtrium("kourosh-leisure-2"),
    partition("kourosh-leisure-2-food", 8, -34, 8, 34, 4.2)
  ], [
    door("kourosh-leisure-2-food-door", "kourosh-leisure-2-food", 0.58, 2),
    windowOpening("kourosh-leisure-2-window-east", "kourosh-leisure-2-envelope-east", 0.5, 4)
  ], [
    ...stripPrototypeCore(prototypeLeisure?.obstacles).filter((item) =>
      !["kourosh-bowling", "kourosh-family-zone", "kourosh-events-zone", "kourosh-jupiter"].includes(item.id)
    ),
    obstacle("kourosh-jupiter-main", "سرزمین بازی ژوپیتر", "block", -24, 0, 20, 43, 2.2, false),
    ...kouroshAccessCore("kourosh-leisure-2-core")
  ], 4.2);

  const cinemaLobby = floor("kourosh-cinema-lobby-3", "طبقه سوم، گیشه سینما و خانه کودک", 3, [
    ...kouroshEnvelope("kourosh-cinema-lobby-3"),
    ...kouroshAtrium("kourosh-cinema-lobby-3"),
    glassPartition("kourosh-cinema-lobby-3-kids", -42, 16, -12, 16)
  ], [
    door("kourosh-cinema-lobby-3-kids-door", "kourosh-cinema-lobby-3-kids", 0.5, 1.8),
    windowOpening("kourosh-cinema-lobby-3-window-east", "kourosh-cinema-lobby-3-envelope-east", 0.5, 3)
  ], [
    ...presetObstacles("kourosh-cinema-lobby-3-assets", [
      ["checkout-counter", -8, -20], ["checkout-counter", 0, -20], ["checkout-counter", 8, -20],
      ["queue-barrier", -8, -16], ["queue-barrier", 8, -16], ["lobby-sofa", -30, 20],
      ["lobby-sofa", 30, 20], ["display-fridge", 42, -18, 90], ["vending-machine", 42, 18, 90]
    ]),
    obstacle("kourosh-kids-club", "خانه بازی کودک", "block", -12, 27, 25, 18, 1.2, false),
    ...kouroshAccessCore("kourosh-cinema-lobby-3-core")
  ]);

  const cinema4 = kouroshCinemaFloor(4, 1);
  const admin5 = floor("kourosh-admin-5", "طبقه پنجم، اداری، فرهنگی و سالن VIP", 5, [
    ...kouroshEnvelope("kourosh-admin-5"),
    ...kouroshAtrium("kourosh-admin-5"),
    glassPartition("kourosh-admin-5-office", -42, 16, 42, 16),
    glassPartition("kourosh-admin-5-vip", 12, -34, 12, 34)
  ], [
    door("kourosh-admin-5-office-door", "kourosh-admin-5-office", 0.35, 1.5),
    door("kourosh-admin-5-vip-door", "kourosh-admin-5-vip", 0.65, 1.5),
    windowOpening("kourosh-admin-5-window-east", "kourosh-admin-5-envelope-east", 0.5, 3)
  ], [
    ...presetObstacles("kourosh-admin-5-desks", [
      ["office-desk", -34, 20], ["office-chair", -34, 21.2, 180], ["office-desk", -26, 20], ["office-chair", -26, 21.2, 180],
      ["office-desk", -18, 20], ["office-chair", -18, 21.2, 180], ["meeting-table", 28, 20],
      ["filing-cabinet", -42, 28, 90], ["reception-desk", 25, -20], ["lobby-sofa", 34, -12]
    ]),
    ...tableChairs("kourosh-admin-5-meeting", 28, 20),
    obstacle("kourosh-vip-hall", "سالن VIP کوروش", "block", 27, 27, 26, 18, 1.1, false),
    ...kouroshAccessCore("kourosh-admin-5-core")
  ]);
  const cinema6 = kouroshCinemaFloor(6, 7);
  const roof = floor("kourosh-roof-7", "طبقه هفتم، فودکورت و روف‌گاردن", 7, [
    ...kouroshEnvelope("kourosh-roof-7", 2.4),
    ...kouroshAtrium("kourosh-roof-7")
  ], [
    door("kourosh-roof-7-atrium-door", "kourosh-roof-7-atrium-south", 0.5, 1.8),
    windowOpening("kourosh-roof-7-window-east", "kourosh-roof-7-envelope-east", 0.5, 4)
  ], [
    ...stripPrototypeCore(prototypeRoof?.obstacles),
    ...presetObstacles("kourosh-roof-7-landscape", [
      ["grass", -34, -22], ["grass", -34, 22], ["grass", 34, -22], ["grass", 34, 22],
      ["palm", -42, -26], ["palm", -42, 26], ["palm", 42, -26], ["palm", 42, 26],
      ["hedge", -30, 0, 90], ["hedge", 30, 0, 90], ["light-pole", 0, -29], ["light-pole", 0, 29]
    ]),
    ...kouroshAccessCore("kourosh-roof-7-core", true).filter((item) => item.variant !== "escalator")
  ]);

  const floors = [
    ...parkingFloors,
    hypermarket,
    commercialB1,
    ground,
    first,
    leisure,
    cinemaLobby,
    cinema4,
    admin5,
    cinema6,
    roof
  ];
  ground.elevationM = 0;
  const belowGround = [commercialB1, hypermarket, ...[...parkingFloors].reverse()];
  let lowerElevation = 0;
  for (const lowerFloor of belowGround) {
    lowerElevation -= lowerFloor.heightM;
    lowerFloor.elevationM = lowerElevation;
  }
  const aboveGround = [first, leisure, cinemaLobby, cinema4, admin5, cinema6, roof];
  let upperElevation = ground.heightM;
  for (const upperFloor of aboveGround) {
    upperFloor.elevationM = upperElevation;
    upperElevation += upperFloor.heightM;
  }
  const plan = building(floors);
  return { ...plan, activeFloorId: ground.id };
}

function polygonEnvelope(prefix: string, points: Vec2[], heightM = 3.6): PlanWall[] {
  return points.map((point, index) => wall(
    `${prefix}-envelope-${index + 1}`,
    point,
    points[(index + 1) % points.length],
    heightM
  ));
}

function stackBuilding(floors: FloorPlan[], groundId: string): BuildingPlan {
  const groundIndex = floors.findIndex((item) => item.id === groundId);
  if (groundIndex < 0) return building(floors);
  floors[groundIndex].elevationM = 0;
  for (let index = groundIndex - 1; index >= 0; index -= 1) {
    floors[index].elevationM = floors[index + 1].elevationM - floors[index].heightM;
  }
  for (let index = groundIndex + 1; index < floors.length; index += 1) {
    floors[index].elevationM = floors[index - 1].elevationM + floors[index - 1].heightM;
  }
  const plan = building(floors);
  return { ...plan, activeFloorId: groundId };
}

/** One room beside the corridor of a corridor block. */
interface BlockRoom {
  side: "north" | "south";
  left: number;
  right: number;
  /** z of the corridor-side wall and of the façade wall. */
  near: number;
  far: number;
}

interface CorridorBlock {
  walls: PlanWall[];
  doors: PlanDoor[];
  north: BlockRoom[];
  south: BlockRoom[];
  /** Service rooms behind the four core rooms, reached through the core. */
  service: { westNorth: BlockRoom; westSouth: BlockRoom; eastNorth: BlockRoom; eastSouth: BlockRoom };
  core: PlanObstacle[];
}

/**
 * One storey of a double-loaded corridor block: the corridor runs the full width with rooms
 * either side and a circulation core at each end.
 *
 * At each end the room north of the corridor holds the stair and the one south of it the
 * lift, each with a service room behind it. Stairs and lifts sit in the same place on every
 * storey so the shafts line up; the top storey gets a final landing instead of a stair.
 * Each room's door is near its west end, leaving the rest of the corridor wall for
 * furniture, and each room has a window in the middle of its façade (unless it is below
 * ground).
 */
function corridorBlock(
  prefix: string,
  halfWidth: number,
  halfDepth: number,
  columns: { north: number; south: number },
  heightM: number,
  top: boolean,
  coreDepth = 8,
  windows = true
): CorridorBlock {
  const coreWidth = 6;
  const W = halfWidth;
  const D = halfDepth;
  const offsetOn = (x: number) => Math.round(((x + W) / (2 * W)) * 10000) / 10000;
  const walls: PlanWall[] = [
    ...rectangle(`${prefix}-shell`, -W, -D, W, D, heightM),
    partition(`${prefix}-corridor-north`, -W, -3, W, -3, heightM),
    partition(`${prefix}-corridor-south`, -W, 3, W, 3, heightM)
  ];
  const doors: PlanDoor[] = [];
  const core: PlanObstacle[] = [];
  for (const [end, sign] of [["west", -1], ["east", 1]] as const) {
    const inner = sign * (W - coreWidth);
    const centre = sign * (W - coreWidth / 2);
    walls.push(
      partition(`${prefix}-core-${end}-north`, inner, -D, inner, -3, heightM),
      partition(`${prefix}-core-${end}-south`, inner, 3, inner, D, heightM),
      partition(`${prefix}-core-${end}-stair-back`, inner, -3 - coreDepth, sign * W, -3 - coreDepth, heightM),
      partition(`${prefix}-core-${end}-lift-back`, inner, 3 + coreDepth, sign * W, 3 + coreDepth, heightM)
    );
    doors.push(
      door(`${prefix}-core-${end}-stair-door`, `${prefix}-corridor-north`, offsetOn(centre), 1.2),
      door(`${prefix}-core-${end}-lift-door`, `${prefix}-corridor-south`, offsetOn(centre), 1.4),
      door(`${prefix}-core-${end}-stair-service-door`, `${prefix}-core-${end}-stair-back`, 0.5, 0.9),
      door(`${prefix}-core-${end}-lift-service-door`, `${prefix}-core-${end}-lift-back`, 0.5, 0.9)
    );
    // The stair runs beside its door, the lift faces its door across the lobby.
    const stairX = centre - sign * 1.6;
    core.push(
      top
        ? topLanding(`${prefix}-core-${end}-landing`, stairX, -5.5, 90)
        : presetObstacle(`${prefix}-core-${end}-stairs`, "stairs-straight", stairX, -5.5, 90),
      presetObstacle(`${prefix}-core-${end}-elevator`, "elevator", centre, 5.5)
    );
  }
  const band = (side: "north" | "south", count: number): BlockRoom[] => {
    const step = (2 * (W - coreWidth)) / count;
    const near = side === "north" ? -3 : 3;
    const far = side === "north" ? -D : D;
    return Array.from({ length: count }, (_, index) => {
      const left = -W + coreWidth + step * index;
      const right = left + step;
      if (index > 0) walls.push(partition(`${prefix}-${side}-divider-${index}`, left, Math.min(near, far), left, Math.max(near, far), heightM));
      doors.push(door(`${prefix}-${side}-room-door-${index + 1}`, `${prefix}-corridor-${side}`, offsetOn(left + 1.6), 1.35));
      const centre = (left + right) / 2;
      if (windows) doors.push(windowOpening(
        `${prefix}-window-${side}-${index + 1}`,
        `${prefix}-shell-${side}`,
        side === "north" ? offsetOn(centre) : Math.round(((W - centre) / (2 * W)) * 10000) / 10000,
        2.4
      ));
      return { side, left, right, near, far };
    });
  };
  const serviceRoom = (side: "north" | "south", end: "west" | "east"): BlockRoom => ({
    side,
    left: end === "west" ? -W : W - coreWidth,
    right: end === "west" ? -W + coreWidth : W,
    near: side === "north" ? -3 - coreDepth : 3 + coreDepth,
    far: side === "north" ? -D : D
  });
  return {
    walls,
    doors,
    north: band("north", columns.north),
    south: band("south", columns.south),
    service: {
      westNorth: serviceRoom("north", "west"),
      westSouth: serviceRoom("south", "west"),
      eastNorth: serviceRoom("north", "east"),
      eastSouth: serviceRoom("south", "east")
    },
    core
  };
}

/** Exits at both ends of a ground-floor corridor. */
function corridorExits(prefix: string): PlanDoor[] {
  return [
    { ...door(`${prefix}-exit-west`, `${prefix}-shell-west`, 0.5, 1.6), swingDirection: "outward" },
    { ...door(`${prefix}-exit-east`, `${prefix}-shell-east`, 0.5, 1.6), swingDirection: "outward" }
  ];
}

/** A door in a block's south façade, centred on x. */
function southFacadeDoor(id: string, prefix: string, halfWidth: number, x: number, widthM: number): PlanDoor {
  return {
    ...door(id, `${prefix}-shell-south`, Math.round(((halfWidth - x) / (2 * halfWidth)) * 10000) / 10000, widthM),
    variant: "double-glass",
    swingDirection: "inward"
  };
}

/** A door in a block's north façade, centred on x. */
function northFacadeDoor(id: string, prefix: string, halfWidth: number, x: number, widthM: number): PlanDoor {
  return {
    ...door(id, `${prefix}-shell-north`, Math.round(((x + halfWidth) / (2 * halfWidth)) * 10000) / 10000, widthM),
    variant: "double-solid",
    swingDirection: "outward"
  };
}

/* ── Room furnishing for corridor blocks ─────────────────────────────── */

/** A point measured from the room's façade towards its corridor. */
const fromFacade = (room: BlockRoom, metres: number) => room.far + (room.side === "north" ? metres : -metres);
/** Rotation that faces into the room, away from the façade. */
const awayFromFacade = (room: BlockRoom) => (room.side === "north" ? 0 : 180);
/** Rotation that faces the façade. */
const towardFacade = (room: BlockRoom) => (room.side === "north" ? 180 : 0);
/** Positions spread evenly across the room, keeping clear of its two side walls. */
function acrossRoom(room: BlockRoom, count: number, margin = 2): number[] {
  const span = room.right - room.left - 2 * margin;
  return Array.from({ length: count }, (_, index) =>
    Math.round((room.left + margin + (count === 1 ? span / 2 : (span * index) / (count - 1))) * 100) / 100);
}
/** Positions spread across the room's depth, keeping clear of façade and corridor. */
function intoRoom(room: BlockRoom, count: number, fromFacadeM: number, toCorridorM: number): number[] {
  const depth = Math.abs(room.near - room.far) - fromFacadeM - toCorridorM;
  return Array.from({ length: count }, (_, index) =>
    Math.round(fromFacade(room, fromFacadeM + (count === 1 ? depth / 2 : (depth * index) / (count - 1))) * 100) / 100);
}

/** Desks against the façade under the window, each with its chair. */
function facadeDesks(prefix: string, room: BlockRoom, count: number): PlanObstacle[] {
  return acrossRoom(room, count).flatMap((x, index) => [
    onWall(`${prefix}-desk-${index + 1}`, "office-desk", room.side, room.far, x),
    presetObstacle(`${prefix}-chair-${index + 1}`, "office-chair", x, fromFacade(room, 1.45), towardFacade(room))
  ]);
}

/** Wall-backed units along the room's east partition. */
function eastWallRun(prefix: string, variant: ObstacleVariant, room: BlockRoom, count: number, spacing: number, startFromFacade = 1.5): PlanObstacle[] {
  return alongWall(prefix, variant, "east", room.right,
    Array.from({ length: count }, (_, index) => Math.round(fromFacade(room, startFromFacade + spacing * index) * 100) / 100),
    partitionThicknessM);
}

/** Wall-backed units along the room's façade. */
function facadeRun(prefix: string, variant: ObstacleVariant, room: BlockRoom, count: number, margin = 2): PlanObstacle[] {
  return alongWall(prefix, variant, room.side, room.far, acrossRoom(room, count, margin));
}

/** A meeting table in the middle of the room with a board on its east partition. */
function meetingRoom(prefix: string, room: BlockRoom): PlanObstacle[] {
  const x = (room.left + room.right) / 2;
  const z = (room.near + room.far) / 2;
  return [
    presetObstacle(`${prefix}-table`, "meeting-table", x, z),
    ...tableChairs(`${prefix}-chairs`, x, z),
    onWall(`${prefix}-board`, "whiteboard", "east", room.right, z, partitionThicknessM)
  ];
}

/** Beds or trolleys along the façade, headboards on the wall, screens and carts between. */
function clinicalBays(prefix: string, room: BlockRoom, variant: ObstacleVariant, count: number): PlanObstacle[] {
  const xs = acrossRoom(room, count, 1.6);
  const halfLength = variant === "hospital-bed" ? 1.1 : variant === "stretcher" ? 1.03 : 0.95;
  const z = fromFacade(room, 0.15 + halfLength);
  return xs.flatMap((x, index) => [
    presetObstacle(`${prefix}-${index + 1}`, variant, x, z, awayFromFacade(room)),
    presetObstacle(`${prefix}-cart-${index + 1}`, "medical-cart", x + 1.05, fromFacade(room, 0.5)),
    ...(index < xs.length - 1
      ? [presetObstacle(`${prefix}-screen-${index + 1}`, "privacy-screen", (x + xs[index + 1]) / 2, fromFacade(room, 1.2), 90)]
      : [])
  ]);
}

/** A classroom: board on the west partition, the class facing it, the teacher beside it. */
function classroom(prefix: string, room: BlockRoom, rows = 3): PlanObstacle[] {
  const z = (room.near + room.far) / 2;
  const deskXs = [4.5, 7.5, 10.5, 13.5].map((offset) => room.left + offset).filter((x) => x < room.right - 1.5);
  return [
    onWall(`${prefix}-board`, "whiteboard", "west", room.left, z, partitionThicknessM),
    presetObstacle(`${prefix}-teacher-desk`, "office-desk", room.left + 2.3, z + 2.5, 270),
    presetObstacle(`${prefix}-teacher-chair`, "office-chair", room.left + 1.4, z + 2.5, 270),
    ...gridPresets(`${prefix}-desks`, ["student-desk"], deskXs, intoRoom(room, rows, 4, 4), 90)
  ];
}

function gridPresets(
  prefix: string,
  variants: ObstacleVariant[],
  xs: number[],
  zs: number[],
  rotationDeg = 0
): PlanObstacle[] {
  const placements: Array<[ObstacleVariant, number, number, number]> = [];
  for (const z of zs) for (const x of xs) placements.push([variants[placements.length % variants.length], x, z, rotationDeg]);
  return presetObstacles(prefix, placements);
}

/* Mega Mall Ekbatan: three parking levels, a full hypermarket plate, two retail
   galleries with 210 shopfronts, a 6,000 m² leisure floor and ten cinema halls. */
function megaEnvelope(prefix: string, heightM = 4.2): PlanWall[] {
  return polygonEnvelope(prefix, [
    { x: -62, z: -44 }, { x: 54, z: -44 }, { x: 70, z: -30 }, { x: 70, z: 32 },
    { x: 58, z: 45 }, { x: -58, z: 45 }, { x: -72, z: 30 }, { x: -72, z: -30 }
  ], heightM);
}

function megaAtrium(prefix: string): PlanWall[] {
  const points: Vec2[] = Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 12;
    return { x: Math.cos(angle) * 23, z: Math.sin(angle) * 14 };
  });
  return points.map((point, index) => glassPartition(
    `${prefix}-atrium-${index + 1}`,
    point.x,
    point.z,
    points[(index + 1) % points.length].x,
    points[(index + 1) % points.length].z,
    1.4
  ));
}

function megaCore(prefix: string, top = false): PlanObstacle[] {
  // Dedicated circulation bands keep the core clear of shopfront walls.
  const stairs: Array<[number, number]> = [[-48, -25], [48, -25], [-48, 25], [48, 25]];
  const elevators: Array<[number, number]> = [[-66, -10], [-66, 0], [-66, 10], [66, -10], [66, 0], [66, 10]];
  // Escalators belong inside the atrium. The former +/-11, +/-10 positions clipped
  // the dodecagonal glass balustrade and made the landing look embedded in a wall.
  const escalators: Array<[number, number]> = [[-10, -5], [10, -5], [-10, 5], [10, 5]];
  return [
    ...stairs.map(([x, z], index) => top ? topLanding(`${prefix}-landing-${index + 1}`, x, z, 90) : presetObstacle(`${prefix}-stairs-${index + 1}`, "stairs-straight", x, z, 90)),
    ...elevators.map(([x, z], index) => presetObstacle(`${prefix}-elevator-${index + 1}`, "elevator", x, z, 90)),
    ...escalators.map(([x, z], index) => presetObstacle(`${prefix}-escalator-${index + 1}`, "escalator", x, z, 90))
  ];
}

function megaShopRing(prefix: string, total: number) {
  const definitions = [
    { name: "north-inner", weight: 116, start: -58, end: 58, front: -21, back: -14, horizontal: true },
    { name: "north-outer", weight: 116, start: -58, end: 58, front: -31, back: -43, horizontal: true },
    { name: "south-inner", weight: 116, start: -58, end: 58, front: 21, back: 14, horizontal: true },
    { name: "south-outer", weight: 116, start: -58, end: 58, front: 31, back: 44, horizontal: true },
    { name: "west-inner", weight: 54, start: -27, end: 27, front: -35, back: -23, horizontal: false },
    { name: "east-inner", weight: 54, start: -27, end: 27, front: 35, back: 23, horizontal: false }
  ];
  const totalWeight = definitions.reduce((sum, item) => sum + item.weight, 0);
  const counts = definitions.map((item) => Math.floor(total * item.weight / totalWeight));
  for (let index = 0; counts.reduce((sum, value) => sum + value, 0) < total; index = (index + 1) % counts.length) counts[index] += 1;
  const bands = definitions.map((item, index) => shopBand(`${prefix}-${item.name}`, counts[index], item.start, item.end, item.front, item.back, item.horizontal));
  return { walls: bands.flatMap((item) => item.walls), doors: bands.flatMap((item) => item.doors) };
}

function megaRetailFloor(id: string, name: string, index: number, units: number): FloorPlan {
  const ring = megaShopRing(id, units);
  return floor(id, name, index, [...megaEnvelope(id), ...megaAtrium(id), ...ring.walls], [
    ...ring.doors,
    windowOpening(`${id}-facade-window-east`, `${id}-envelope-3`, 0.5, 7),
    windowOpening(`${id}-facade-window-west`, `${id}-envelope-7`, 0.5, 7)
  ], [
    ...gridPresets(`${id}-fixtures-a`, ["clothing-rack", "display-stand", "shelving-unit"], [-52, -40, -28, 28, 40, 52], [-36, -27, 27, 36]),
    ...gridPresets(`${id}-kiosks`, ["display-stand", "concierge-desk"], [-17, 0, 17], [-10, 10]),
    ...megaCore(`${id}-core`)
  ], 4.2);
}

function megaParkingFloor(index: number): FloorPlan {
  const id = `mega-parking-b${Math.abs(index)}`;
  return floor(id, `پارکینگ مگامال B${Math.abs(index)}`, index, [
    ...megaEnvelope(id, 3.6),
    partition(`${id}-lane-west`, -9, -38, -9, 38, 1.2),
    partition(`${id}-lane-east`, 9, -38, 9, 38, 1.2)
  ], [
    door(`${id}-vehicle-entry`, `${id}-envelope-1`, 0.5, 6),
    windowOpening(`${id}-vent-east`, `${id}-envelope-3`, 0.5, 4),
    windowOpening(`${id}-vent-west`, `${id}-envelope-7`, 0.5, 4)
  ], [
    ...gridPresets(`${id}-vehicles`, ["sedan", "suv", "pickup", "van"], [-52, -39, -25, -15, 15, 25, 39, 52], [-32, -11, 11, 32], 90),
    ...presetObstacles(`${id}-traffic`, [["parking-barrier", 0, -40], ["guard-booth", 7, -38], ["speed-bump", 0, -34], ["equipment-rack", 57, 37]]),
    ...megaCore(`${id}-core`).filter((item) => item.variant !== "escalator")
  ], 3.6);
}

function megaMallPlan(): BuildingPlan {
  const parking = [-3, -2, -1].map(megaParkingFloor);
  const hyper = floor("mega-hyper-ground", "همکف، هایپرمارکت ۱۱٬۰۰۰ مترمربعی و ورودی مترو", 0, [
    ...megaEnvelope("mega-hyper-ground"),
    glassPartition("mega-hyper-ground-front", -58, -32, 58, -32),
    partition("mega-hyper-ground-stock", -58, 28, 58, 28),
    partition("mega-hyper-ground-service", 52, -32, 52, 44)
  ], [
    door("mega-hyper-main-entry", "mega-hyper-ground-envelope-1", 0.5, 5),
    door("mega-hyper-stock-door", "mega-hyper-ground-stock", 0.82, 2.4),
    door("mega-hyper-service-door", "mega-hyper-ground-service", 0.75, 2),
    windowOpening("mega-hyper-window-east", "mega-hyper-ground-envelope-3", 0.5, 7),
    windowOpening("mega-hyper-window-west", "mega-hyper-ground-envelope-7", 0.5, 7)
  ], [
    ...gridPresets("mega-hyper-aisles", ["shelving-unit"], [-48, -40, -32, -24, -16, -8, 8, 16, 24, 32, 40, 48], [-22, -12, -2, 8, 18]),
    ...gridPresets("mega-hyper-checkouts", ["checkout-counter"], [-38, -30, -22, -14, -6, 6, 14, 22, 30, 38], [-28]),
    ...gridPresets("mega-hyper-cold", ["display-fridge"], [-42, -28, -14, 0, 14, 28, 42], [24]),
    ...megaCore("mega-hyper-core")
  ], 4.2);
  const retail1 = megaRetailFloor("mega-retail-1", "طبقه اول، گالری مد، خدمات و ۱۰۵ واحد", 1, 105);
  const retail2 = megaRetailFloor("mega-retail-2", "طبقه دوم، ۱۰۵ واحد، سرای غذا و تراس", 2, 105);
  retail2.obstacles.push(...Array.from({ length: 8 }, (_, index) => tableChairs(`mega-food-table-${index + 1}`, 34 + (index % 4) * 7, -12 + Math.floor(index / 4) * 8, 0, "dining-chair")).flat());
  const leisure = floor("mega-leisure-3", "طبقه سوم، شهربازی ۶٬۰۰۰ مترمربعی و ورزش", 3, [
    ...megaEnvelope("mega-leisure-3", 4.8),
    ...megaAtrium("mega-leisure-3"),
    partition("mega-leisure-3-play", 8, -40, 8, 40, 4.8),
    partition("mega-leisure-3-food", 8, 12, 66, 12, 4.8)
  ], [
    door("mega-leisure-play-door", "mega-leisure-3-play", 0.5, 2.4),
    door("mega-leisure-food-door", "mega-leisure-3-food", 0.55, 2),
    windowOpening("mega-leisure-window-east", "mega-leisure-3-envelope-3", 0.5, 8)
  ], [
    obstacle("mega-play-zone", "شهربازی سرپوشیده مگامال", "block", -30, 2, 16, 60, 1.2, false),
    ...gridPresets("mega-play-assets", ["display-stand", "vending-machine", "waiting-bench"], [-36, -32, -28, -24], [-24, -8, 8, 24]),
    ...Array.from({ length: 10 }, (_, index) => tableChairs(`mega-leisure-table-${index + 1}`, 20 + (index % 5) * 9, 18 + Math.floor(index / 5) * 14, 0, "dining-chair")).flat(),
    ...megaCore("mega-leisure-core")
  ], 4.8);
  const cinema = floor("mega-cinema-4", "طبقه چهارم، پردیس سینمایی ۱۰ سالن و لابی", 4, [
    ...megaEnvelope("mega-cinema-4", 5),
    partition("mega-cinema-lobby-line", -66, 5, 66, 5, 5),
    ...[-52, -26, 0, 26, 52].flatMap((x, index) => [
      partition(`mega-cinema-divider-n-${index}`, x, -40, x, 5, 5),
      partition(`mega-cinema-divider-s-${index}`, x, 5, x, 42, 5)
    ])
  ], [
    ...Array.from({ length: 10 }, (_, index) => door(`mega-cinema-hall-door-${index + 1}`, "mega-cinema-lobby-line", (index + 0.5) / 10, 1.8)),
    windowOpening("mega-cinema-lobby-window", "mega-cinema-4-envelope-1", 0.5, 8)
  ], [
    ...Array.from({ length: 10 }, (_, index) => obstacle(`mega-cinema-hall-${index + 1}`, `سالن سینما ${index + 1}`, "block", -52 + (index % 5) * 26, index < 5 ? -18 : 24, 22, 27, 3.6, true)),
    ...gridPresets("mega-cinema-lobby", ["waiting-bench", "vending-machine", "queue-barrier"], [-42, -25, -8, 8, 25, 42], [0]),
    ...megaCore("mega-cinema-core", true).filter((item) => item.variant !== "escalator")
  ], 5);
  return stackBuilding([...parking, hyper, retail1, retail2, leisure, cinema], hyper.id);
}

/* ── General hospital ─────────────────────────────────────────────────── */

const hospitalHalfWidth = 36;
const hospitalHalfDepth = 26;

/** Server and supply rooms behind the hospital's cores, the same on every storey. */
function hospitalServiceRooms(prefix: string, block: CorridorBlock): PlanObstacle[] {
  const { westNorth, westSouth, eastNorth, eastSouth } = block.service;
  return [
    ...facadeRun(`${prefix}-server-rack`, "equipment-rack", westNorth, 2, 1.8),
    onWall(`${prefix}-server-ups`, "ups-unit", "west", westNorth.left, fromFacade(westNorth, 4)),
    ...facadeRun(`${prefix}-supply-rack`, "storage-rack", westSouth, 1, 3),
    presetObstacle(`${prefix}-supply-cart`, "medical-cart", westSouth.left + 3, fromFacade(westSouth, 4)),
    ...facadeRun(`${prefix}-plant-rack`, "equipment-rack", eastNorth, 2, 1.8),
    onWall(`${prefix}-plant-ups`, "ups-unit", "east", eastNorth.right, fromFacade(eastNorth, 4)),
    ...facadeRun(`${prefix}-lockers`, "locker-row", eastSouth, 2, 1.6)
  ];
}

function hospitalFloor(
  id: string,
  name: string,
  index: number,
  top: boolean,
  furnish: (block: CorridorBlock) => PlanObstacle[],
  extraDoors: PlanDoor[] = []
): FloorPlan {
  const block = corridorBlock(id, hospitalHalfWidth, hospitalHalfDepth, { north: 6, south: 6 }, 3.8, top);
  return floor(id, name, index, block.walls, [...block.doors, ...extraDoors], [
    ...block.core,
    ...hospitalServiceRooms(id, block),
    ...furnish(block)
  ], 3.8);
}

/** A nurse station facing the corridor door, with its trolley. */
function nurseStation(prefix: string, room: BlockRoom): PlanObstacle[] {
  const x = (room.left + room.right) / 2;
  return [
    presetObstacle(`${prefix}-station`, "nurse-station", x, fromFacade(room, 6), awayFromFacade(room)),
    presetObstacle(`${prefix}-station-chair`, "office-chair", x, fromFacade(room, 5), awayFromFacade(room)),
    ...eastWallRun(`${prefix}-station-filing`, "filing-cabinet", room, 2, 1.2),
    presetObstacle(`${prefix}-station-cart`, "medical-cart", room.left + 1.5, fromFacade(room, 2))
  ];
}

/** An operating theatre: table in the middle, trolleys and a screen around it. */
function operatingTheatre(prefix: string, room: BlockRoom): PlanObstacle[] {
  const x = (room.left + room.right) / 2;
  const z = (room.near + room.far) / 2;
  return [
    presetObstacle(`${prefix}-table`, "exam-table", x, z, 90),
    presetObstacle(`${prefix}-cart-a`, "medical-cart", x - 2, z - 1.5),
    presetObstacle(`${prefix}-cart-b`, "medical-cart", x + 2, z + 1.5),
    presetObstacle(`${prefix}-screen`, "privacy-screen", x, fromFacade(room, 3)),
    ...eastWallRun(`${prefix}-supplies`, "tool-cabinet", room, 2, 1.6, 3)
  ];
}

/**
 * A five-storey general hospital: emergency, reception and outpatients at grade, theatres
 * and ICU above, two ward floors, and administration and training at the top.
 *
 * Every storey shares the corridor-block layout, so the two stair and lift cores and their
 * server and supply rooms stack. Ambulances pull in under the emergency entrance at the
 * south-west corner; the main entrance opens into the reception hall, and the staff car
 * park lies across the drop-off road.
 */
function generalHospitalPlan(): BuildingPlan {
  const W = hospitalHalfWidth;
  const ground = hospitalFloor("hospital-ground", "همکف، اورژانس، تریاژ، تصویربرداری و درمانگاه", 0, false, (block) => {
    const [emergencyA, emergencyB, imaging, exam, pharmacy, records] = block.north;
    const [emergencyEntry, triage, lobby, waiting, outpatients, admin] = block.south;
    return [
      ...clinicalBays("hospital-ground-emergency-a-stretcher", emergencyA, "stretcher", 3),
      ...clinicalBays("hospital-ground-emergency-b-stretcher", emergencyB, "stretcher", 3),
      ...clinicalBays("hospital-ground-imaging-table", imaging, "exam-table", 2),
      ...clinicalBays("hospital-ground-exam-table", exam, "exam-table", 3),
      ...facadeRun("hospital-ground-pharmacy-rack", "storage-rack", pharmacy, 2),
      ...eastWallRun("hospital-ground-pharmacy-shelf", "storage-rack", pharmacy, 3, 4, 3),
      presetObstacle("hospital-ground-pharmacy-cart", "medical-cart", pharmacy.left + 3, fromFacade(pharmacy, 8)),
      ...facadeDesks("hospital-ground-records", records, 3),
      ...eastWallRun("hospital-ground-records-filing", "filing-cabinet", records, 3, 1.2, 4),
      // Emergency entrance: the triage station faces the ambulance doors.
      ...nurseStation("hospital-ground-emergency-entry", emergencyEntry),
      presetObstacle("hospital-ground-emergency-entry-stretcher", "stretcher", emergencyEntry.left + 1.2, fromFacade(emergencyEntry, 10)),
      ...clinicalBays("hospital-ground-triage-stretcher", triage, "stretcher", 3),
      // Reception hall facing the main doors, waiting along the walls.
      presetObstacle("hospital-ground-reception", "service-counter", (lobby.left + lobby.right) / 2, fromFacade(lobby, 8), towardFacade(lobby)),
      presetObstacle("hospital-ground-reception-chair", "office-chair", (lobby.left + lobby.right) / 2, fromFacade(lobby, 8.9), towardFacade(lobby)),
      ...eastWallRun("hospital-ground-lobby-bench", "waiting-bench", lobby, 3, 3, 3),
      ...eastWallRun("hospital-ground-waiting-bench", "waiting-bench", waiting, 4, 3, 2),
      ...facadeRun("hospital-ground-waiting-facade-bench", "waiting-bench", waiting, 2, 2.5),
      onWall("hospital-ground-waiting-vending", "vending-machine", "west", waiting.left, fromFacade(waiting, 14), partitionThicknessM),
      ...clinicalBays("hospital-ground-outpatient-table", outpatients, "exam-table", 3),
      ...facadeDesks("hospital-ground-admin", admin, 3),
      ...eastWallRun("hospital-ground-admin-filing", "filing-cabinet", admin, 2, 1.2, 4),
      // Drop-off road, ambulance bay and staff car park across the road.
      sizedPreset("hospital-ground-dropoff-road", "road", 0, 30.5, 2 * W + 8, 5),
      { ...sizedPreset("hospital-ground-ambulance", "ambulance", -22, 30.5, 5.7, 2.1, 90), label: "آمبولانس اورژانس", heightM: 2.5 },
      sizedPreset("hospital-ground-parking-surface", "road", 18, 38, 28, 6),
      ...parkingRow("hospital-ground-staff-car", ["sedan", "suv", "sedan", "van", "sedan", "suv", "sedan", "sedan", "suv"], [6, 8.7, 11.4, 14.1, 16.8, 19.5, 22.2, 24.9, 27.6], 37.6, "south"),
      ...presetObstacles("hospital-ground-site-poles", [["light-pole", -W, 34], ["camera-pole", W, 34]])
    ];
  }, [
    ...corridorExits("hospital-ground"),
    { ...southFacadeDoor("hospital-ground-emergency-entry", "hospital-ground", W, -22, 3.2), variant: "double-solid" },
    southFacadeDoor("hospital-ground-main-entry", "hospital-ground", W, -2, 2.4)
  ]);
  ground.coverageRequirements = [
    zone("hospital-ambulance-zone", "hospital.ambulance", "محل توقف آمبولانس", -30, 26.4, -26.5, 33.5),
    zone("hospital-parking-zone", "shared.staff-parking", "پارکینگ کارکنان و مراجعان", 4.5, 35.2, 29, 37)
  ];

  const first = hospitalFloor("hospital-first", "طبقه اول، اتاق‌های عمل، ریکاوری و ICU", 1, false, (block) => [
    ...block.north.slice(0, 3).flatMap((room, index) => operatingTheatre(`hospital-first-theatre-${index + 1}`, room)),
    ...nurseStation("hospital-first-nurse", block.north[3]),
    ...block.north.slice(4).flatMap((room, index) => clinicalBays(`hospital-first-icu-${index + 1}-bed`, room, "hospital-bed", 3)),
    ...block.south.slice(0, 4).flatMap((room, index) => clinicalBays(`hospital-first-recovery-${index + 1}-bed`, room, "hospital-bed", 3)),
    ...nurseStation("hospital-first-recovery-nurse", block.south[4]),
    ...facadeDesks("hospital-first-staff", block.south[5], 3)
  ]);
  const ward = (id: string, name: string, index: number) => hospitalFloor(id, name, index, false, (block) => [
    ...[...block.north.slice(0, 2), ...block.north.slice(3)].flatMap((room, roomIndex) => clinicalBays(`${id}-north-${roomIndex + 1}-bed`, room, "hospital-bed", 3)),
    ...nurseStation(`${id}-nurse-north`, block.north[2]),
    ...[...block.south.slice(0, 3), ...block.south.slice(4)].flatMap((room, roomIndex) => clinicalBays(`${id}-south-${roomIndex + 1}-bed`, room, "hospital-bed", 3)),
    ...nurseStation(`${id}-nurse-south`, block.south[3])
  ]);
  const second = ward("hospital-second", "طبقه دوم، بخش‌های بستری داخلی و جراحی", 2);
  const third = ward("hospital-third", "طبقه سوم، زنان، زایمان و اطفال", 3);
  const fourth = hospitalFloor("hospital-fourth", "طبقه چهارم، مدیریت، آموزش، توان‌بخشی و خدمات", 4, true, (block) => [
    ...block.north.slice(0, 4).flatMap((room, index) => [
      ...facadeDesks(`hospital-fourth-office-${index + 1}`, room, 3),
      ...eastWallRun(`hospital-fourth-office-${index + 1}-filing`, "filing-cabinet", room, 2, 1.2, 4)
    ]),
    ...block.north.slice(4).flatMap((room, index) => meetingRoom(`hospital-fourth-meeting-${index + 1}`, room)),
    ...block.south.slice(0, 2).flatMap((room, index) => classroom(`hospital-fourth-training-${index + 1}`, room, 2)),
    ...block.south.slice(2, 4).flatMap((room, index) => [
      ...clinicalBays(`hospital-fourth-rehab-${index + 1}-table`, room, "exam-table", 3),
      ...eastWallRun(`hospital-fourth-rehab-${index + 1}-bench`, "waiting-bench", room, 2, 3, 8)
    ]),
    ...block.south.slice(4).flatMap((room, index) => facadeDesks(`hospital-fourth-admin-${index + 1}`, room, 3))
  ]);
  return stackBuilding([ground, first, second, third, fourth], ground.id);
}

/* ── Police station ───────────────────────────────────────────────────── */

const policeHalfWidth = 30;
const policeHalfDepth = 22;

/** Server room, stores and lockers behind the police station's cores. */
function policeServiceRooms(prefix: string, block: CorridorBlock): PlanObstacle[] {
  const { westNorth, westSouth, eastNorth, eastSouth } = block.service;
  return [
    ...facadeRun(`${prefix}-server-rack`, "equipment-rack", westNorth, 2, 1.8),
    onWall(`${prefix}-server-ups`, "ups-unit", "west", westNorth.left, fromFacade(westNorth, 4)),
    ...facadeRun(`${prefix}-store-rack`, "storage-rack", westSouth, 1, 3),
    ...facadeRun(`${prefix}-records`, "filing-cabinet", eastNorth, 3, 1.5),
    ...facadeRun(`${prefix}-lockers`, "locker-row", eastSouth, 2, 1.6)
  ];
}

function policeFloor(
  id: string,
  name: string,
  index: number,
  top: boolean,
  columns: { north: number; south: number },
  furnish: (block: CorridorBlock) => PlanObstacle[],
  extraDoors: PlanDoor[] = []
): FloorPlan {
  const block = corridorBlock(id, policeHalfWidth, policeHalfDepth, columns, 3.6, top, 7, index >= 0);
  return floor(id, name, index, block.walls, [...block.doors, ...extraDoors], [
    ...block.core,
    ...policeServiceRooms(id, block),
    ...furnish(block)
  ], 3.6);
}

/** Monitoring consoles under the façade window, each with its operator. */
function controlConsoles(prefix: string, room: BlockRoom, count: number): PlanObstacle[] {
  return acrossRoom(room, count, 2.5).flatMap((x, index) => [
    onWall(`${prefix}-console-${index + 1}`, "monitoring-console", room.side, room.far, x),
    presetObstacle(`${prefix}-console-chair-${index + 1}`, "office-chair", x, fromFacade(room, 1.7), towardFacade(room))
  ]);
}

/**
 * A four-level police station on one corridor-block footprint.
 *
 * The basement holds the staff car park behind its ramp door, with the archive, evidence
 * store, holding cells and armoury across the corridor. The public reaches the counters
 * in the ground-floor lobby; operations, command and training are upstairs, each floor
 * entered from the cores through a floor reception.
 */
function policeStationPlan(): BuildingPlan {
  const W = policeHalfWidth;
  const basement = policeFloor("police-basement", "زیرزمین، پارکینگ سازمانی، بایگانی و نگهداری موقت", -1, false, { north: 1, south: 4 }, (block) => {
    const [archive, evidence, cells, armoury] = block.south;
    const bays = [-22, -19.3, -16.6, -13.9, -11.2, -8.5, -5.8, 5.8, 8.5, 11.2, 13.9, 16.6, 19.3, 22];
    return [
      ...parkingRow("police-basement-bay-north", ["sedan", "suv", "sedan"], bays, -19.4, "north"),
      ...parkingRow("police-basement-bay-south", ["suv", "sedan", "sedan"], bays.filter((x) => x > -20), -5.6, "south"),
      ...facadeRun("police-basement-archive-cabinet", "filing-cabinet", archive, 6, 1.5),
      ...eastWallRun("police-basement-archive-side", "filing-cabinet", archive, 4, 1.2, 4),
      ...facadeRun("police-basement-evidence-rack", "storage-rack", evidence, 2, 2.2),
      ...eastWallRun("police-basement-evidence-tools", "tool-cabinet", evidence, 2, 2, 5),
      ...acrossRoom(cells, 4, 1.6).map((x, index) => presetObstacle(`police-basement-cell-bunk-${index + 1}`, "metal-bunk", x, fromFacade(cells, 1.2), awayFromFacade(cells))),
      ...facadeRun("police-basement-armoury-locker", "locker-row", armoury, 3, 1.8),
      ...eastWallRun("police-basement-armoury-tools", "tool-cabinet", armoury, 2, 2, 5),
      sizedPreset("police-basement-ramp", "road", 0, -25, 8, 6)
    ];
  }, [northFacadeDoor("police-basement-gate", "police-basement", W, 0, 5)]);

  const ground = policeFloor("police-ground", "همکف، پیشخوان خدمات، گزارش، انتظار و مصاحبه", 0, false, { north: 4, south: 3 }, (block) => {
    const [duty, control, briefing, lockers] = block.north;
    const [interview, lobby, reports] = block.south;
    const lobbyX = (lobby.left + lobby.right) / 2;
    return [
      ...facadeDesks("police-ground-duty", duty, 2),
      ...eastWallRun("police-ground-duty-filing", "filing-cabinet", duty, 2, 1.2, 4),
      ...controlConsoles("police-ground-control", control, 2),
      ...meetingRoom("police-ground-briefing", briefing),
      ...facadeRun("police-ground-staff-locker", "locker-row", lockers, 3, 1.6),
      ...meetingRoom("police-ground-interview", interview),
      // Public lobby: counters face the main doors, waiting along the side walls.
      ...[lobbyX - 3, lobbyX + 3].flatMap((x, index) => [
        presetObstacle(`police-ground-counter-${index + 1}`, "service-counter", x, fromFacade(lobby, 9), towardFacade(lobby)),
        presetObstacle(`police-ground-counter-chair-${index + 1}`, "office-chair", x, fromFacade(lobby, 9.9), towardFacade(lobby))
      ]),
      ...eastWallRun("police-ground-waiting", "waiting-bench", lobby, 2, 3, 2),
      ...alongWall("police-ground-waiting-west", "waiting-bench", "west", lobby.left, [fromFacade(lobby, 2), fromFacade(lobby, 5)], partitionThicknessM),
      ...facadeDesks("police-ground-reports", reports, 3),
      ...parkingRow("police-ground-visitor-car", ["sedan", "suv", "sedan", "sedan"], [-24, -21.3, 21.3, 24], 26.5, "south"),
      sizedPreset("police-ground-street", "road", 0, 31, 2 * W + 8, 4)
    ];
  }, [...corridorExits("police-ground"), southFacadeDoor("police-ground-main-entry", "police-ground", W, 3, 2.2)]);

  const upper = (id: string, name: string, index: number, top: boolean, furnish: (block: CorridorBlock) => PlanObstacle[]) =>
    policeFloor(id, name, index, top, { north: 4, south: 3 }, (block) => {
      const reception = block.south[0];
      return [
        // Floor reception facing the corridor door, by the west core.
        presetObstacle(`${id}-floor-reception`, "reception-desk", reception.left + 4, fromFacade(reception, 9), awayFromFacade(reception)),
        presetObstacle(`${id}-floor-reception-chair`, "office-chair", reception.left + 4, fromFacade(reception, 8.1), awayFromFacade(reception)),
        ...eastWallRun(`${id}-floor-bench`, "waiting-bench", reception, 2, 3, 3),
        ...furnish(block)
      ];
    });
  const first = upper("police-first", "طبقه اول، عملیات، فرماندهی، اداری و اتاق جلسات", 1, false, (block) => [
    ...facadeDesks("police-first-operations-a", block.north[0], 3),
    ...facadeDesks("police-first-operations-b", block.north[1], 3),
    ...facadeRun("police-first-archive", "filing-cabinet", block.north[2], 6, 1.5),
    ...meetingRoom("police-first-meeting", block.north[3]),
    ...facadeDesks("police-first-command", block.south[1], 2),
    onWall("police-first-command-sofa", "sofa-three", "east", block.south[1].right, fromFacade(block.south[1], 7), partitionThicknessM),
    ...facadeRun("police-first-equipment-rack", "storage-rack", block.south[2], 2, 2.2),
    ...eastWallRun("police-first-equipment-tools", "tool-cabinet", block.south[2], 2, 2, 5)
  ]);
  const second = upper("police-second", "طبقه دوم، آموزش، توجیه، رفاه و مدیریت", 2, true, (block) => [
    ...classroom("police-second-training", block.north[0]),
    ...meetingRoom("police-second-briefing", block.north[1]),
    presetObstacle("police-second-dining-table-a", "dining-table", (block.north[2].left + block.north[2].right) / 2, fromFacade(block.north[2], 6)),
    ...tableChairs("police-second-dining-chairs-a", (block.north[2].left + block.north[2].right) / 2, fromFacade(block.north[2], 6), 0, "dining-chair"),
    presetObstacle("police-second-dining-table-b", "dining-table", (block.north[2].left + block.north[2].right) / 2, fromFacade(block.north[2], 12)),
    ...tableChairs("police-second-dining-chairs-b", (block.north[2].left + block.north[2].right) / 2, fromFacade(block.north[2], 12), 0, "dining-chair"),
    onWall("police-second-dining-vending", "vending-machine", "east", block.north[2].right, fromFacade(block.north[2], 3), partitionThicknessM),
    ...facadeRun("police-second-welfare-lockers", "locker-row", block.north[3], 3, 1.6),
    ...facadeDesks("police-second-management", block.south[1], 3),
    ...facadeRun("police-second-equipment-rack", "storage-rack", block.south[2], 2, 2.2)
  ]);
  return stackBuilding([basement, ground, first, second], ground.id);
}

/* ── Barracks campus ──────────────────────────────────────────────────── */

const barracksHalfWidth = 42;
const barracksHalfDepth = 27;

/** Server room, spare-parts store, stores and lockers behind the barracks cores. */
function barracksServiceRooms(prefix: string, block: CorridorBlock): PlanObstacle[] {
  const { westNorth, westSouth, eastNorth, eastSouth } = block.service;
  return [
    ...facadeRun(`${prefix}-server-rack`, "equipment-rack", westNorth, 2, 1.8),
    onWall(`${prefix}-server-nvr`, "nvr-cabinet", "west", westNorth.left, fromFacade(westNorth, 4)),
    onWall(`${prefix}-server-switch`, "network-switch", "west", westNorth.left, fromFacade(westNorth, 5)),
    ...facadeRun(`${prefix}-store-crates`, "crate-stack", westSouth, 2, 1.6),
    ...facadeRun(`${prefix}-spares-rack`, "storage-rack", eastNorth, 1, 3),
    ...facadeRun(`${prefix}-lockers`, "locker-row", eastSouth, 2, 1.6)
  ];
}

function barracksFloor(
  id: string,
  name: string,
  index: number,
  top: boolean,
  furnish: (block: CorridorBlock) => PlanObstacle[],
  extraDoors: PlanDoor[] = []
): FloorPlan {
  const block = corridorBlock(id, barracksHalfWidth, barracksHalfDepth, { north: 4, south: 4 }, 3.6, top);
  return floor(id, name, index, block.walls, [...block.doors, ...extraDoors], [
    ...block.core,
    ...barracksServiceRooms(id, block),
    ...furnish(block)
  ], 3.6);
}

/** Bunks along the façade and the east partition, lockers along the west partition. */
function dormitory(prefix: string, room: BlockRoom): PlanObstacle[] {
  return [
    ...acrossRoom(room, 6, 1.5).map((x, index) => presetObstacle(`${prefix}-bunk-${index + 1}`, "metal-bunk", x, fromFacade(room, 1.2), awayFromFacade(room))),
    ...intoRoom(room, 4, 5, 6).map((z, index) => presetObstacle(`${prefix}-side-bunk-${index + 1}`, "metal-bunk", room.right - 1.2, z, 90)),
    ...alongWall(`${prefix}-locker`, "locker-row", "west", room.left, intoRoom(room, 3, 5, 6), partitionThicknessM)
  ];
}

/**
 * A fenced barracks campus around one four-storey block.
 *
 * The ground floor is the support base: the supply depot with its truck dock and the
 * vehicle workshop open onto the north service yard, with headquarters and the clinic
 * beside them; the main lobby, electrical room, armoury and guard room face the parade
 * ground. Dormitories, training and the welfare floor are above. Vehicles enter through the
 * guarded south gate; fuel is stored in the north-east corner of the yard.
 */
function barracksCampusPlan(): BuildingPlan {
  const W = barracksHalfWidth;
  const D = barracksHalfDepth;
  const ground = barracksFloor("barracks-ground", "همکف، محوطه پادگان، گیت، ستاد، درمانگاه و خدمات", 0, false, (block) => {
    const [depot, workshop, headquarters, clinic] = block.north;
    const [electrical, lobby, armoury, guard] = block.south;
    const depotX = (depot.left + depot.right) / 2;
    const workshopX = (workshop.left + workshop.right) / 2;
    const lobbyX = (lobby.left + lobby.right) / 2;
    return [
      // Supply depot and its dock.
      ...alongWall("barracks-ground-depot-rack", "storage-rack", "west", depot.left, intoRoom(depot, 4, 2, 4), partitionThicknessM),
      sizedPreset("barracks-ground-depot-rack-row", "storage-rack", depotX + 3, fromFacade(depot, 12), 10, 1.1, 90),
      ...presetObstacles("barracks-ground-depot-pallets", [
        ["pallet-stack", depotX, fromFacade(depot, 4)], ["pallet-stack", depotX, fromFacade(depot, 6)], ["packing-table", depot.right - 2.5, fromFacade(depot, 20)]
      ]),
      presetObstacle("barracks-yard-dock-platform", "loading-platform", depotX - 4, -D - 1.25),
      presetObstacle("barracks-yard-dock-truck", "truck", depotX - 4, -D - 6.55, 270),
      // Vehicle workshop with a pickup in for service.
      presetObstacle("barracks-ground-workshop-pickup", "pickup", workshopX - 4, fromFacade(workshop, 5), 270),
      ...presetObstacles("barracks-ground-workshop", [
        ["workbench", workshop.left + 4, fromFacade(workshop, 12)], ["cnc-machine", workshop.left + 9, fromFacade(workshop, 12)],
        ["welding-station", workshop.left + 14, fromFacade(workshop, 12)]
      ]),
      ...eastWallRun("barracks-ground-workshop-tools", "tool-cabinet", workshop, 3, 2, 3),
      // Headquarters and clinic.
      ...facadeDesks("barracks-ground-hq", headquarters, 5),
      ...eastWallRun("barracks-ground-hq-filing", "filing-cabinet", headquarters, 3, 1.2, 4),
      ...meetingRoom("barracks-ground-hq-meeting", { ...headquarters, far: fromFacade(headquarters, 8) }),
      ...clinicalBays("barracks-ground-clinic-table", clinic, "exam-table", 4),
      ...eastWallRun("barracks-ground-clinic-bench", "waiting-bench", clinic, 3, 3, 10),
      // Electrical room: switchboards on the walls, UPS strings by the façade.
      ...facadeRun("barracks-ground-electrical-ups", "ups-unit", electrical, 4, 2),
      ...eastWallRun("barracks-ground-electrical-board", "tool-cabinet", electrical, 4, 1.6, 3),
      onWall("barracks-ground-electrical-switchgear", "equipment-rack", "west", electrical.left, fromFacade(electrical, 6), partitionThicknessM),
      // Main lobby: reception faces the doors, benches along the walls.
      presetObstacle("barracks-ground-reception", "reception-desk", lobbyX, fromFacade(lobby, 8), towardFacade(lobby)),
      presetObstacle("barracks-ground-reception-chair", "office-chair", lobbyX, fromFacade(lobby, 8.9), towardFacade(lobby)),
      ...eastWallRun("barracks-ground-lobby-bench", "waiting-bench", lobby, 3, 3, 3),
      ...facadeRun("barracks-ground-armoury-locker", "locker-row", armoury, 5, 1.8),
      ...eastWallRun("barracks-ground-armoury-side", "locker-row", armoury, 3, 3, 5),
      ...controlConsoles("barracks-ground-guard", guard, 2),
      ...eastWallRun("barracks-ground-guard-lockers", "locker-row", guard, 2, 3, 6),
      // North service yard with the fuel store; parade ground, car park and gate to the south.
      sizedPreset("barracks-yard-service-road", "road", 0, -35, 2 * W + 8, 6),
      { ...sizedPreset("barracks-yard-fuel-tank-a", "chemical-tank", 48, -37, 3, 2.4), label: "مخزن سوخت", heightM: 2.4 },
      { ...sizedPreset("barracks-yard-fuel-tank-b", "chemical-tank", 53, -37, 3, 2.4), label: "مخزن سوخت", heightM: 2.4 },
      sizedPreset("barracks-yard-parade", "grass", -16, 34, 36, 10),
      ...presetObstacles("barracks-yard-trees", [["deciduous", -52, 32], ["conifer", -52, -32], ["conifer", 56, 20]]),
      sizedPreset("barracks-yard-gate-road", "road", 0, 35.5, 8, 13),
      sizedPreset("barracks-yard-parking-surface", "road", 26, 34, 28, 10),
      ...parkingRow("barracks-yard-staff-car", ["sedan", "pickup", "van", "sedan", "suv", "sedan", "pickup", "sedan"], [15, 17.7, 20.4, 23.1, 25.8, 28.5, 31.2, 33.9], 36.6, "south"),
      sizedPreset("barracks-yard-fence-north", "fence-wall", 0, -42, 124, 0.25),
      sizedPreset("barracks-yard-fence-west", "fence-wall", -62, 0, 84, 0.25, 90),
      sizedPreset("barracks-yard-fence-east", "fence-wall", 62, 0, 84, 0.25, 90),
      sizedPreset("barracks-yard-fence-south-west", "fence-wall", -32.5, 42, 59, 0.25),
      sizedPreset("barracks-yard-fence-south-east", "fence-wall", 32.5, 42, 59, 0.25),
      presetObstacle("barracks-yard-gate", "gate-sliding", 0, 42),
      presetObstacle("barracks-yard-barrier", "parking-barrier", 0, 39),
      presetObstacle("barracks-yard-guard-booth", "guard-booth", 6.5, 39.5),
      ...presetObstacles("barracks-yard-poles", [["camera-pole", -61, 41], ["camera-pole", 61, -41], ["light-pole", -61, -41], ["light-pole", 61, 41]])
    ];
  }, [
    ...corridorExits("barracks-ground"),
    southFacadeDoor("barracks-ground-main-entry", "barracks-ground", W, -5, 2.4),
    northFacadeDoor("barracks-ground-dock-door", "barracks-ground", W, -31, 4),
    northFacadeDoor("barracks-ground-workshop-door", "barracks-ground", W, -13, 4.5)
  ]);
  ground.coverageRequirements = [
    zone("barracks-gate-zone", "industrial.vehicle-gate", "گیت ورودی پادگان", -2.5, 37.5, 2.5, 41.8),
    zone("barracks-dock-zone", "industrial.dock", "بارانداز انبار تدارکات", -36, -29.2, -26, -27.3),
    zone("barracks-entrance-zone", "industrial.staff-entrance", "درِ ورودی ساختمان ستاد", -7.5, 27.3, -2.5, 29.5),
    zone("barracks-perimeter-zone", "industrial.perimeter", "دیوار غربی پادگان", -61.8, -20, -60.3, 4),
    zone("barracks-parking-zone", "shared.staff-parking", "پارکینگ کارکنان", 13, 34.2, 24, 39),
    zone("barracks-hazard-zone", "industrial.hazard", "مخازن سوخت", 45, -35.5, 56, -33.6)
  ];

  const dorm = barracksFloor("barracks-first", "طبقه اول، آسایشگاه‌ها، رختکن و فضاهای بهداشتی", 1, false, (block) =>
    [...block.north, ...block.south].flatMap((room, index) => dormitory(`barracks-first-dorm-${index + 1}`, room)));
  const training = barracksFloor("barracks-second", "طبقه دوم، آموزش نظری، فرماندهی و جلسات", 2, false, (block) => [
    ...block.north.flatMap((room, index) => classroom(`barracks-second-class-${index + 1}`, room, 4)),
    ...block.south.slice(0, 2).flatMap((room, index) => meetingRoom(`barracks-second-meeting-${index + 1}`, room)),
    ...block.south.slice(2).flatMap((room, index) => [
      ...facadeDesks(`barracks-second-command-${index + 1}`, room, 4),
      ...eastWallRun(`barracks-second-command-${index + 1}-filing`, "filing-cabinet", room, 3, 1.2, 4)
    ])
  ]);
  const welfare = barracksFloor("barracks-third", "طبقه سوم، غذاخوری، کتابخانه، ورزش و رفاه", 3, true, (block) => {
    const [diningA, diningB, library, gym] = block.north;
    const [kitchen, lounge, reading, fitness] = block.south;
    const diningTables = (prefix: string, room: BlockRoom) => [-4.5, 0, 4.5].flatMap((dx, column) =>
      intoRoom(room, 3, 5, 5).flatMap((z, row) => {
        const x = (room.left + room.right) / 2 + dx;
        const tag = `${prefix}-${column + 1}-${row + 1}`;
        return [presetObstacle(`${tag}-table`, "dining-table", x, z), ...tableChairs(`${tag}-chairs`, x, z, 0, "dining-chair")];
      }));
    return [
      ...diningTables("barracks-third-dining-a", diningA),
      ...diningTables("barracks-third-dining-b", diningB),
      ...facadeRun("barracks-third-library-shelf", "library-shelf", library, 5, 1.8),
      ...eastWallRun("barracks-third-library-side", "library-shelf", library, 4, 3, 4),
      ...gridPresets("barracks-third-library-desks", ["student-desk"], [library.left + 5, library.left + 8, library.left + 11], intoRoom(library, 3, 10, 4)),
      ...facadeRun("barracks-third-gym-bleacher", "gym-bleacher", gym, 3, 3),
      ...eastWallRun("barracks-third-gym-locker", "locker-row", gym, 3, 3, 8),
      ...facadeRun("barracks-third-kitchen-counter", "kitchen-counter", kitchen, 4, 2),
      ...alongWall("barracks-third-kitchen-appliances", "fridge", "east", kitchen.right, [fromFacade(kitchen, 2), fromFacade(kitchen, 3.2)], partitionThicknessM),
      ...alongWall("barracks-third-kitchen-cooking", "stove", "west", kitchen.left, [fromFacade(kitchen, 2), fromFacade(kitchen, 3)], partitionThicknessM),
      onWall("barracks-third-kitchen-sink", "sink-unit", "west", kitchen.left, fromFacade(kitchen, 4.2), partitionThicknessM),
      presetObstacle("barracks-third-kitchen-island", "kitchen-island", (kitchen.left + kitchen.right) / 2, fromFacade(kitchen, 6)),
      ...facadeRun("barracks-third-lounge-sofa", "sofa-three", lounge, 3, 3),
      onWall("barracks-third-lounge-tv", "tv-unit", "east", lounge.right, fromFacade(lounge, 8), partitionThicknessM),
      ...facadeRun("barracks-third-reading-shelf", "bookshelf", reading, 6, 2),
      ...gridPresets("barracks-third-reading-desks", ["student-desk"], [reading.left + 5, reading.left + 9, reading.left + 13], intoRoom(reading, 2, 8, 6)),
      ...facadeRun("barracks-third-fitness-bleacher", "gym-bleacher", fitness, 2, 4),
      ...eastWallRun("barracks-third-fitness-locker", "locker-row", fitness, 2, 3, 8)
    ];
  });
  return stackBuilding([ground, dorm, training, welfare], ground.id);
}

/* ── School campus ────────────────────────────────────────────────────── */

const schoolHalfWidth = 40;
const schoolHalfDepth = 28;
/** The main door, off-centre in the lobby so it clears the lobby window. */
const schoolDoorX = -5.5;

/** Server room, storerooms and the staff changing room behind the school cores. */
function schoolServiceRooms(prefix: string, block: CorridorBlock): PlanObstacle[] {
  const { westNorth, westSouth, eastNorth, eastSouth } = block.service;
  return [
    ...facadeRun(`${prefix}-server-rack`, "equipment-rack", westNorth, 2, 1.8),
    onWall(`${prefix}-server-ups`, "ups-unit", "west", westNorth.left, fromFacade(westNorth, 4)),
    ...facadeRun(`${prefix}-store-rack`, "storage-rack", westSouth, 1, 3),
    ...facadeRun(`${prefix}-store-crates`, "crate-stack", eastNorth, 2, 1.6),
    ...facadeRun(`${prefix}-lockers`, "locker-row", eastSouth, 2, 1.6)
  ];
}

function schoolFloor(
  id: string,
  name: string,
  index: number,
  top: boolean,
  columns: { north: number; south: number },
  furnish: (block: CorridorBlock) => PlanObstacle[],
  extraDoors: PlanDoor[] = []
): FloorPlan {
  const block = corridorBlock(id, schoolHalfWidth, schoolHalfDepth, columns, 3.7, top);
  return floor(id, name, index, block.walls, [...block.doors, ...extraDoors], [
    ...block.core,
    ...schoolServiceRooms(id, block),
    ...furnish(block)
  ], 3.7);
}

/** A science lab: benches in rows facing the board on the west partition. */
function scienceLab(prefix: string, room: BlockRoom): PlanObstacle[] {
  const z = (room.near + room.far) / 2;
  return [
    onWall(`${prefix}-board`, "whiteboard", "west", room.left, z, partitionThicknessM),
    presetObstacle(`${prefix}-teacher-desk`, "office-desk", room.left + 2.3, z + 2.5, 270),
    presetObstacle(`${prefix}-teacher-chair`, "office-chair", room.left + 1.4, z + 2.5, 270),
    ...gridPresets(`${prefix}-bench`, ["lab-bench"], [room.left + 6, room.left + 11], intoRoom(room, 3, 4, 5), 90),
    ...eastWallRun(`${prefix}-store`, "storage-rack", room, 1, 0, 3)
  ];
}

/** A library: shelves on the façade and east partition, reading desks in the middle. */
function library(prefix: string, room: BlockRoom): PlanObstacle[] {
  return [
    ...facadeRun(`${prefix}-shelf`, "library-shelf", room, 5, 1.8),
    ...eastWallRun(`${prefix}-side-shelf`, "library-shelf", room, 4, 3, 4),
    ...gridPresets(`${prefix}-desk`, ["student-desk"], [room.left + 4, room.left + 7, room.left + 10], intoRoom(room, 3, 8, 5))
  ];
}

/**
 * A four-storey school campus in fenced grounds.
 *
 * Classrooms line both sides of the corridor, each with its board on a solid partition and
 * windows to the side. The ground floor has the entrance lobby and the head's office on
 * the south front facing the gate; labs and the libraries are on the second floor and the
 * multipurpose hall and sports hall on the top floor. Parents wait at the kerb outside the
 * gate; the play yard and staff car park are inside the fence on the south side.
 */
function schoolCampusPlan(): BuildingPlan {
  const W = schoolHalfWidth;
  const D = schoolHalfDepth;
  const ground = schoolFloor("school-ground", "همکف، ورودی، مدیریت، کلاس‌های پایه و حیاط", 0, false, { north: 4, south: 4 }, (block) => {
    const [classA, lobby, office, classB] = block.south;
    const lobbyX = (lobby.left + lobby.right) / 2;
    const doorX = schoolDoorX;
    return [
      ...block.north.flatMap((room, index) => classroom(`school-ground-class-${index + 1}`, room, 4)),
      ...classroom("school-ground-class-5", classA, 4),
      ...classroom("school-ground-class-6", classB, 4),
      // Entrance lobby: reception faces the main doors, benches along the walls.
      presetObstacle("school-ground-reception", "reception-desk", lobbyX, fromFacade(lobby, 8), towardFacade(lobby)),
      presetObstacle("school-ground-reception-chair", "office-chair", lobbyX, fromFacade(lobby, 8.9), towardFacade(lobby)),
      ...eastWallRun("school-ground-lobby-bench", "waiting-bench", lobby, 3, 3, 3),
      ...facadeDesks("school-ground-office", office, 4),
      ...eastWallRun("school-ground-office-filing", "filing-cabinet", office, 3, 1.2, 4),
      ...meetingRoom("school-ground-office-meeting", { ...office, far: fromFacade(office, 8) }),
      // Grounds: path to the gate, play yard, staff car park, fence and gate.
      sizedPreset("school-yard-path", "road", doorX, 35, 4, 14),
      sizedPreset("school-yard-play", "grass", -28, 35, 24, 10),
      ...presetObstacles("school-yard-play-assets", [
        ["waiting-bench", -36, 30.5, 180], ["waiting-bench", -20, 30.5, 180], ["deciduous", -50, 34], ["deciduous", -50, -34], ["conifer", 50, -34]
      ]),
      sizedPreset("school-yard-parking-surface", "road", 26, 34.5, 26, 9),
      ...parkingRow("school-yard-staff-car", ["sedan", "suv", "sedan", "sedan", "suv", "sedan", "sedan", "pickup"], [16, 18.7, 21.4, 24.1, 26.8, 29.5, 32.2, 34.9], 37, "south"),
      sizedPreset("school-yard-fence-north", "fence-mesh", 0, -42, 116, 0.1),
      sizedPreset("school-yard-fence-west", "fence-mesh", -58, 0, 84, 0.1, 90),
      sizedPreset("school-yard-fence-east", "fence-mesh", 58, 0, 84, 0.1, 90),
      sizedPreset("school-yard-fence-south-west", "fence-mesh", (-58 + doorX - 2.5) / 2, 42, doorX - 2.5 + 58, 0.1),
      sizedPreset("school-yard-fence-south-east", "fence-mesh", (58 + doorX + 2.5) / 2, 42, 58 - doorX - 2.5, 0.1),
      presetObstacle("school-yard-gate", "gate-sliding", doorX, 42),
      presetObstacle("school-yard-guard-booth", "guard-booth", doorX + 5, 39.5),
      sizedPreset("school-yard-street", "road", 0, 46, 124, 4),
      ...presetObstacles("school-yard-poles", [["camera-pole", -57, 41], ["camera-pole", 57, -41], ["light-pole", -57, -41], ["light-pole", 57, 41]])
    ];
  }, [...corridorExits("school-ground"), southFacadeDoor("school-ground-main-entry", "school-ground", W, schoolDoorX, 2.4)]);
  ground.coverageRequirements = [
    zone("school-entrance-zone", "school.main-entrance", "درِ ورودی اصلی", schoolDoorX - 3, D + 0.3, schoolDoorX + 3, D + 3),
    zone("school-pickup-zone", "school.pickup", "محل تحویل دانش‌آموز کنار درِ مدرسه", schoolDoorX - 8, 42.3, schoolDoorX + 8, 43.9),
    zone("school-yard-zone", "school.yard", "حیاط و زمین بازی", -38, 31.2, -26, 34),
    zone("school-parking-zone", "shared.staff-parking", "پارکینگ کارکنان", 15, 31, 25, 34),
    zone("school-perimeter-zone", "school.perimeter", "حصار شمالی مدرسه", -36, -41.8, -12, -40.3)
  ];
  const first = schoolFloor("school-first", "طبقه اول، کلاس‌ها، اتاق معلمان و مشاوره", 1, false, { north: 4, south: 4 }, (block) =>
    [...block.north, ...block.south].flatMap((room, index) => classroom(`school-first-class-${index + 1}`, room, 4)));
  const second = schoolFloor("school-second", "طبقه دوم، آزمایشگاه‌ها، کارگاه و کتابخانه", 2, false, { north: 4, south: 4 }, (block) => [
    ...block.north.flatMap((room, index) => scienceLab(`school-second-lab-${index + 1}`, room)),
    ...library("school-second-library-a", block.south[0]),
    ...library("school-second-library-b", block.south[1]),
    ...classroom("school-second-class-1", block.south[2], 4),
    ...classroom("school-second-class-2", block.south[3], 4)
  ]);
  const third = schoolFloor("school-third", "طبقه سوم، سالن چندمنظوره، ورزش، هنر و بام آموزشی", 3, true, { north: 2, south: 2 }, (block) => [
    ...facadeRun("school-third-hall-bleacher", "gym-bleacher", block.north[0], 5, 3),
    ...facadeRun("school-third-sports-bleacher", "gym-bleacher", block.north[1], 5, 3),
    ...eastWallRun("school-third-sports-locker", "locker-row", block.north[1], 3, 3, 8),
    ...gridPresets("school-third-art-bench", ["lab-bench"], [block.south[0].left + 6, block.south[0].left + 13, block.south[0].left + 20, block.south[0].left + 27], intoRoom(block.south[0], 3, 4, 6), 90),
    ...facadeRun("school-third-art-store", "storage-rack", block.south[0], 2, 4),
    ...library("school-third-library", block.south[1])
  ]);
  return stackBuilding([ground, first, second, third], ground.id);
}

function rawSamplePlan(id: SamplePlanId): BuildingPlan {
  switch (id) {
    case "family-villa": return familyVillaPlan();
    case "corner-retail-shop": return cornerRetailShopPlan();
    case "luxury-villa": return luxuryVillaPlan();
    case "modern-office": return modernOfficePlan();
    case "retail-gallery": return retailGalleryPlan();
    case "neighbourhood-supermarket": return neighbourhoodSupermarketPlan();
    case "secure-jewellery-branch": return secureJewelleryBranchPlan();
    case "compact-industrial-workshop": return compactIndustrialWorkshopPlan();
    case "urban-public-parking": return urbanPublicParkingPlan();
    case "neighbourhood-restaurant": return neighbourhoodRestaurantPlan();
    case "primary-school": return primarySchoolPlan();
    case "outpatient-clinic": return outpatientClinicPlan();
    case "boutique-hotel": return boutiqueHotelPlan();
    case "neighbourhood-fuel-station": return neighbourhoodFuelStationPlan();
    case "courtyard-apartment": return courtyardApartmentPlan();
    case "orchard-farm": return orchardFarmPlan();
    case "urban-roundabout": return urbanRoundaboutPlan();
    case "highway-interchange": return highwayInterchangePlan();
    case "active-construction-site": return activeConstructionSitePlan();
    case "conference-centre": return conferenceCentrePlan();
    case "car-showroom": return carShowroomPlan();
    case "bus-terminal": return busTerminalPlan();
    case "city-bus-fleet": return cityBusFleetPlan();
    case "security-control-room": return securityControlRoomPlan();
    case "urban-substation": return urbanSubstationPlan();
    case "regional-warehouse": return regionalWarehousePlan();
    case "neighbourhood-mall": return neighbourhoodMallPlan();
    case "pipeline-monitoring-station": return pipelineMonitoringStationPlan();
    case "transmission-corridor": return transmissionCorridorPlan();
    case "onshore-oil-field": return onshoreOilFieldPlan();
    case "offshore-platform": return offshorePlatformPlan();
    case "solar-generation-farm": return solarGenerationFarmPlan();
    case "hydroelectric-power-station": return hydroelectricPowerStationPlan();
    case "safe-city-district": return safeCityDistrictPlan();
    case "urban-sports-complex": return urbanSportsComplexPlan();
    case "compact-data-centre": return compactDataCentrePlan();
    case "regional-airport-terminal": return regionalAirportTerminalPlan();
    case "container-port": return containerPortPlan();
    case "railway-interchange-station": return railwayInterchangeStationPlan();
    case "open-pit-mine": return openPitMinePlan();
    case "water-treatment-plant": return waterTreatmentPlantPlan();
    case "factory-campus": return factoryCampusPlan();
    case "residential-parking": return residentialParkingPlan();
    case "kourosh-mall": return kouroshMallPlan();
    case "mega-mall": return megaMallPlan();
    case "general-hospital": return generalHospitalPlan();
    case "police-station": return policeStationPlan();
    case "barracks-campus": return barracksCampusPlan();
    case "school-campus": return schoolCampusPlan();
  }
}

/**
 * The compact sample buildings are meant to open ready for editing, not as an exercise
 * in programming every detected space.  Use the architecture and the furniture already
 * present in each room to give it an honest venue section from the outset.  The two mall
 * models are deliberately excluded: their hundreds of units are large reference models
 * and assigning their programme is part of the heavy-project workflow.
 */
function sampleRoomSectionType(id: SamplePlanId, floor: FloorPlan, room: PlanRoom, siblings: PlanRoom[] = []): string {
  const wallIds = room.wallIds ?? [];
  const hasWall = (part: string) => wallIds.some((wallId) => wallId.includes(part));
  // A garden or roof outline encloses the building drawn inside it. Objects standing in
  // a smaller room nested within this one belong to that room, not to this one.
  const area = Math.abs(polygonArea(room.polygon));
  const nested = siblings.filter((other) => other !== room && Math.abs(polygonArea(other.polygon)) < area);
  const roomObstacles = floor.obstacles.filter((item) =>
    pointInPolygon(item.center, room.polygon) && !nested.some((other) => pointInPolygon(item.center, other.polygon))
  );
  const hasVariant = (...variants: ObstacleVariant[]) => roomObstacles.some((item) => item.variant && variants.includes(item.variant));
  const isCorridor = hasWall("-corridor-north") && hasWall("-corridor-south") && roomObstacles.length === 0;

  // Vertical circulation is never a bedroom, ward, shop or storage room. Keep
  // this invariant ahead of venue-specific furnishing heuristics so a stair/lift
  // cannot accidentally inherit the surrounding private room's programme.
  if (hasVariant("stairs-straight") || roomObstacles.some((item) => item.label.includes("پاگرد نهایی"))) {
    return "shared.stairwell";
  }
  // A room holding only lift cars is a lift shaft or lift lobby rather than a stair.
  // Escalator atriums with a glass lift keep their venue programme instead.
  if (hasVariant("elevator") && !hasVariant("escalator")) {
    return roomObstacles.every((item) => item.variant === "elevator" || item.kind === "pillar")
      ? "shared.elevator"
      : "shared.stairwell";
  }

  switch (id) {
    case "family-villa":
      if (hasWall("family-villa-ground-utility") && hasVariant("equipment-rack")) return "shared.storeroom";
      if (hasWall("family-villa-first-store") && hasVariant("crate-stack")) return "shared.storeroom";
      if (hasVariant("fridge", "kitchen-counter", "stove", "sink-unit")) return "residential.kitchen";
      if (hasWall("family-villa-ground-hall-west") && hasWall("family-villa-ground-hall-east")) return "residential.entrance";
      if (floor.id === "family-villa-ground" && hasVariant("office-desk", "bookshelf")) return "sample.residential.study";
      if (hasVariant("bed-double", "bed-single")) return "residential.bedroom";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "residential.living";

    case "corner-retail-shop":
      if (hasVariant("storage-rack", "crate-stack", "packing-table")) return "shop.backstore";
      if (hasVariant("office-desk", "equipment-rack")) return "sample.shop.office";
      return "shop.salesfloor";

    case "luxury-villa":
      if (floor.id === "villa-basement") {
        if (hasVariant("sedan", "suv", "pickup", "van", "truck")) return "residential.parking";
        return "shared.storeroom";
      }
      if (floor.id === "villa-roof") return hasWall("villa-roof-room-") ? "shared.storeroom" : "residential.roof";
      if (hasWall("villa-estate-")) return "residential.yard";
      if (hasVariant("fridge", "kitchen-counter", "stove", "sink-unit", "kitchen-island")) return "residential.kitchen";
      if (hasVariant("bed-double", "bed-single")) return "residential.bedroom";
      if (hasWall("-core-south") && !hasVariant("sofa-three", "office-desk")) return "shared.storeroom";
      if (hasWall("villa-ground-office-wall") && hasWall("villa-ground-core-west")) return "residential.entrance";
      if (hasVariant("office-desk", "meeting-table")) return "sample.residential.study";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "residential.living";

    case "modern-office":
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("filing-cabinet") && !hasVariant("office-desk")) return "office.archive";
      if (hasVariant("storage-rack", "tool-cabinet")) return "office.equipment-store";
      if (hasVariant("meeting-table")) return "office.meeting";
      if (floor.id === "office-0" && hasVariant("reception-desk", "lobby-sofa")) return "office.lobby";
      if (hasVariant("reception-desk", "waiting-bench")) return "office.floor-entrance";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "office.openplan";

    case "retail-gallery":
      if (floor.id === "gallery-mezzanine") return "sample.shop.admin";
      if (hasVariant("partition-screen")) return "shop.fitting";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack", "packing-table")) return "shop.backstore";
      if (hasVariant("monitoring-console", "equipment-rack", "office-desk")) return "sample.shop.admin";
      return "shop.salesfloor";

    case "neighbourhood-supermarket":
      if (hasVariant("queue-barrier")) return "supermarket.entrance";
      if (hasVariant("locker-row")) return "shared.washroom";
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("office-desk", "filing-cabinet", "tool-cabinet")) return "supermarket.cashroom";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack", "packing-table")) return "supermarket.coldstore";
      if (roomObstacles.length === 0 && hasWall("market-corridor-north")) return "shared.corridor";
      return "supermarket.aisle";

    case "secure-jewellery-branch":
      if (hasVariant("queue-barrier")) return "jewellery.entrance";
      if (hasVariant("equipment-rack", "ups-unit") && !hasVariant("office-desk")) return "shared.equipment-room";
      if (hasVariant("storage-rack", "tool-cabinet")) return "jewellery.vault";
      if (hasVariant("office-desk", "monitoring-console")) return "sample.jewellery.staff";
      if (roomObstacles.length === 0 && hasWall("jewellery-exit-corridor")) return "jewellery.emergency-exit";
      return hasVariant("checkout-counter") ? "jewellery.counter" : "jewellery.display";

    case "compact-industrial-workshop":
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack")) return "industrial.warehouse";
      if (hasVariant("tool-cabinet") && !hasVariant("cnc-machine", "conveyor")) return "industrial.electrical";
      if (hasVariant("office-desk", "reception-desk")) return "sample.industrial.admin";
      return "industrial.production";

    case "urban-public-parking":
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("monitoring-console", "office-desk")) return "parking.control-room";
      if (hasVariant("waiting-bench", "vending-machine")) return "parking.pedestrian";
      return "parking.bay-aisle";

    case "neighbourhood-restaurant":
      if (hasWall("restaurant-wc-west") && !hasVariant("dining-table")) return "shared.washroom";
      if (hasVariant("fridge", "kitchen-counter", "stove", "sink-unit", "kitchen-island")) return "restaurant.kitchen";
      if (hasVariant("storage-rack", "display-fridge", "crate-stack")) return "restaurant.foodstore";
      return "restaurant.dining";

    case "primary-school":
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("lab-bench")) return "school.lab";
      if (hasVariant("service-counter", "waiting-bench")) return "sample.school.lobby";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "school.classroom";

    case "outpatient-clinic":
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("storage-rack", "display-fridge")) return "hospital.pharmacy-store";
      if (hasVariant("reception-desk", "service-counter", "queue-barrier")) return "hospital.reception";
      if (hasVariant("stretcher", "nurse-station")) return "hospital.emergency";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "hospital.patient-room";

    case "boutique-hotel":
      if (hasVariant("bed-double", "bed-single")) return "hotel.guest-room";
      if (hasVariant("dining-table", "dining-chair", "service-counter")) return "hotel.restaurant";
      if (hasVariant("tool-cabinet")) return "hotel.safe-deposit";
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("storage-rack")) return "shared.storeroom";
      if (hasVariant("reception-desk", "lobby-sofa")) return "hotel.lobby";
      if (hasVariant("office-desk", "filing-cabinet")) return "sample.hotel.admin";
      if (roomObstacles.length === 0) return floor.id === "boutique-hotel-ground" ? "shared.corridor" : "hotel.floor-corridor";
      return "hotel.lobby";

    case "neighbourhood-fuel-station":
      return "fuel.shop";

    case "courtyard-apartment":
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("storage-rack", "crate-stack")) return "apartment.storage";
      if (hasVariant("tool-cabinet", "workbench")) return "apartment.plantroom";
      if (hasVariant("sedan", "suv", "van", "parking-barrier")) return "parking.bay-aisle";
      if (hasVariant("monitoring-console", "office-desk")) return "sample.apartment.management";
      if (hasVariant("rug", "sofa-three", "sofa-single")) return "apartment.amenities";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "apartment.lobby";

    case "orchard-farm":
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack", "packing-table")) return "farm.store";
      if (roomObstacles.some((item) => item.label === "آبشخور")) return "farm.livestock";
      return "farm.utilities";

    case "urban-roundabout":
      return "urban-road.signal";

    case "highway-interchange":
      return "highway.sign";

    case "active-construction-site":
      if (hasVariant("office-desk", "meeting-table", "filing-cabinet")) return "construction.office";
      return "construction.equipment";

    case "conference-centre":
      if (hasVariant("equipment-rack", "office-desk", "filing-cabinet")) return "conference.av-room";
      if (hasVariant("reception-desk", "service-counter", "queue-barrier")) return "conference.registration";
      if (hasVariant("gym-bleacher")) return "conference.seating";
      return "conference.stage";

    case "car-showroom":
      if (hasVariant("storage-rack", "crate-stack", "packing-table")) return "car-showroom.parts";
      if (hasVariant("office-desk", "reception-desk", "filing-cabinet")) return "car-showroom.sales";
      return "car-showroom.floor";

    case "bus-terminal":
      return "bus-station.ticket";

    case "city-bus-fleet":
      return "transit-fleet.cabin";

    case "security-control-room":
      if (hasVariant("equipment-rack", "tool-cabinet", "workbench")) return "control-room.power";
      if (hasVariant("reception-desk", "queue-barrier", "waiting-bench")) return "control-room.entrance";
      if (hasVariant("whiteboard", "meeting-table")) return "control-room.video-wall";
      return "control-room.operator";

    case "urban-substation":
      return hasWall("urban-substation-switchgear") ? "substation.switchgear" : "substation.relay-room";

    case "regional-warehouse":
      return hasVariant("office-desk", "office-chair", "filing-cabinet", "equipment-rack")
        ? "warehouse.office"
        : "warehouse.aisle";

    case "neighbourhood-mall":
      if (floor.id === "neighbourhood-mall-basement") return "mall.parking";
      if (hasVariant("escalator")) return "mall.escalator";
      if (hasVariant("monitoring-console", "equipment-rack")) return "mall.control";
      if (hasVariant("reception-desk")) return "mall.main-entrance";
      if (hasVariant("dining-table", "service-counter")) return "mall.food-court";
      if (hasVariant("checkout-counter")) return "sample.mall.shop";
      return "mall.concourse";

    case "pipeline-monitoring-station":
      return "pipeline.pump-station";

    case "transmission-corridor":
      return "transmission-line.step-down";

    case "onshore-oil-field":
      return "onshore-oil.control";

    case "offshore-platform":
      return "offshore-oil.control";

    case "solar-generation-farm":
      return "solar-farm.inverter";

    case "hydroelectric-power-station":
      return hasVariant("equipment-rack", "office-desk", "meeting-table") ? "hydro-plant.control" : "hydro-plant.turbine-hall";

    case "safe-city-district":
      return "safe-city.command";

    case "urban-sports-complex":
      return "sports-complex.ticket";

    case "compact-data-centre":
      if (hasVariant("loading-platform", "packing-table", "crate-stack")) return "data-centre.loading";
      if (hasVariant("cnc-machine", "workbench")) return "data-centre.cooling";
      if (hasWall("data-centre-power-split")) return "data-centre.power";
      if (hasVariant("reception-desk", "queue-barrier")) return "data-centre.entrance";
      return "data-centre.rack-aisle";

    case "regional-airport-terminal":
      if (hasVariant("conveyor", "luggage-cart")) return "airport.baggage";
      if (hasVariant("service-counter")) return "airport.check-in";
      if (hasVariant("waiting-bench")) return "airport.transit-hall";
      return "airport.security-gate";

    case "container-port":
      return "port.customs";

    case "railway-interchange-station":
      return hasVariant("escalator") ? "railway.escalator" : "railway.ticket-hall";

    case "open-pit-mine":
      return "mine.explosives";

    case "water-treatment-plant":
      if (hasVariant("storage-rack", "tool-cabinet")) return "water-plant.chemical";
      if (hasVariant("cnc-machine", "workbench")) return "water-plant.pump";
      return "water-plant.control";

    case "factory-campus":
      if (hasVariant("ups-unit")) return "shared.equipment-room";
      if (hasWall("factory-electrical-split") && hasWall("factory-storage")) return "industrial.electrical";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack")) return "industrial.warehouse";
      if (hasVariant("conveyor", "cnc-machine", "workbench", "welding-station")) return "industrial.production";
      return "sample.industrial.admin";

    case "residential-parking":
      if (floor.id === "residential-parking") {
        if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
        if (hasVariant("storage-rack", "crate-stack")) return "apartment.storage";
        if (hasVariant("reception-desk", "lobby-sofa")) return "apartment.lobby";
        return "parking.bay-aisle";
      }
      if (hasVariant("storage-rack", "crate-stack")) return "apartment.storage";
      if (roomObstacles.length === 0 && hasWall("-landing-west") && hasWall("-core-south")) return "shared.corridor";
      return "sample.apartment.private-unit";

    case "general-hospital":
      if (isCorridor) return "shared.corridor";
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("locker-row")) return "shared.washroom";
      if (hasVariant("storage-rack")) return "hospital.pharmacy-store";
      if (hasVariant("stretcher")) return "hospital.emergency";
      if (hasVariant("exam-table", "hospital-bed")) return "hospital.patient-room";
      if (hasVariant("service-counter", "nurse-station", "waiting-bench")) return "hospital.reception";
      return "sample.hospital.admin";

    case "police-station":
      if (isCorridor) return "shared.corridor";
      if (hasVariant("sedan", "suv", "van", "pickup")) return "shared.staff-parking";
      if (hasVariant("equipment-rack", "ups-unit", "monitoring-console")) return "shared.equipment-room";
      if (hasVariant("metal-bunk")) return "sample.office.secure-room";
      if (hasVariant("storage-rack", "tool-cabinet")) return "office.equipment-store";
      if (hasVariant("filing-cabinet") && !hasVariant("office-desk")) return "office.archive";
      if (hasVariant("service-counter")) return "office.lobby";
      if (hasVariant("reception-desk")) return "office.floor-entrance";
      if (hasVariant("meeting-table")) return "office.meeting";
      if (hasVariant("locker-row")) return "shared.washroom";
      return "office.openplan";

    case "barracks-campus":
      if (isCorridor) return "shared.corridor";
      if (hasVariant("network-switch", "nvr-cabinet")) return "shared.equipment-room";
      if (hasVariant("ups-unit")) return "industrial.electrical";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack")) return "industrial.warehouse";
      if (hasVariant("workbench", "cnc-machine", "welding-station")) return "industrial.production";
      if (floor.id === "barracks-first") return "sample.industrial.dormitory";
      if (floor.id === "barracks-second") return "sample.industrial.training";
      if (floor.id === "barracks-third") return "sample.industrial.welfare";
      return "sample.industrial.support";

    case "school-campus":
      if (isCorridor) return "shared.corridor";
      if (hasVariant("equipment-rack", "ups-unit")) return "shared.equipment-room";
      if (hasVariant("lab-bench")) return "school.lab";
      if (hasVariant("gym-bleacher")) return "sample.school.multipurpose";
      if (hasVariant("storage-rack", "crate-stack")) return "shared.storeroom";
      if (hasVariant("locker-row")) return "shared.washroom";
      if (hasVariant("reception-desk")) return "sample.school.lobby";
      if (hasVariant("office-desk") && !hasVariant("student-desk")) return "sample.school.admin";
      return "school.classroom";

    case "kourosh-mall":
    case "mega-mall":
      return "generic.room";
  }
}

const checklistObstacleVariants: Partial<Record<string, ObstacleVariant[]>> = {
  "shared.equipment-room": ["equipment-rack", "nvr-cabinet", "ups-unit", "network-switch", "monitoring-console"],
  "shared.stairwell": ["stairs-straight"],
  "shared.elevator": ["elevator"],
  "shared.staff-parking": ["sedan", "suv", "pickup", "van", "truck"],
  "office.archive": ["filing-cabinet"],
  "office.equipment-store": ["equipment-rack", "filing-cabinet"],
  "shop.checkout": ["checkout-counter"],
  "shop.display": ["display-stand", "clothing-rack", "shelving-unit"],
  "shop.backstore": ["storage-rack", "pallet-stack", "crate-stack"],
  "industrial.dock": ["loading-platform", "packing-table"],
  "industrial.warehouse": ["storage-rack", "pallet-stack", "crate-stack"],
  "industrial.production": ["conveyor", "cnc-machine", "workbench"],
  "industrial.electrical": ["equipment-rack"],
  "parking.bay-aisle": ["sedan", "suv", "pickup", "van"],
  "apartment.lobby": ["reception-desk", "lobby-sofa"],
  "apartment.parking-gate": ["parking-barrier", "gate-sliding"],
  "apartment.storage": ["storage-rack", "crate-stack"],
  "residential.gate": ["gate-sliding", "parking-barrier"],
  "residential.yard": ["grass"],
  "residential.parking": ["sedan", "suv", "pickup", "van"],
  "hospital.reception": ["service-counter", "reception-desk", "nurse-station"],
  "hospital.pharmacy-store": ["medical-cart", "storage-rack"],
  "school.yard": ["grass", "waiting-bench", "light-pole"],
  "sports-complex.stand": ["gym-bleacher"],
  "sports-complex.gate": ["gate-sliding", "parking-barrier"],
  "sports-complex.parking": ["sedan", "suv", "pickup", "van"]
};

/** Physical plan elements that intentionally have no reusable furniture variant. */
const checklistObstacleIdPrefixes: Partial<Record<string, string[]>> = {
  "residential.pool": ["villa-pool"],
  "sports-complex.field": ["sports-playing-field"]
};

function openingPoint(floor: FloorPlan, sectionId: string): Vec2 | null {
  const wantsGate = sectionId.includes("gate") || sectionId.includes("parking-gate");
  const opening = floor.doors.find((item) => {
    if (item.type === "window") return false;
    const value = `${item.id} ${item.wallId}`;
    return wantsGate ? value.includes("gate") : value.includes("entry") || value.includes("door");
  });
  const wall = opening ? floor.walls.find((item) => item.id === opening.wallId) : null;
  if (!opening || !wall) return null;
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * opening.offset,
    z: wall.a.z + (wall.b.z - wall.a.z) * opening.offset
  };
}

/** Pick a real architectural feature as the centre of a checklist sub-area. */
function checklistAnchor(plan: BuildingPlan, section: SectionType): { floorIndex: number; point: Vec2 } {
  const variants = checklistObstacleVariants[section.id] ?? [];
  for (let floorIndex = 0; floorIndex < plan.floors.length; floorIndex += 1) {
    const floor = plan.floors[floorIndex];
    const obstacle = floor.obstacles.find((item) => item.variant && variants.includes(item.variant));
    if (obstacle) return { floorIndex, point: obstacle.center };
    if (section.id === "hospital.ambulance") {
      const vehicle = floor.obstacles.find((item) => item.kind === "vehicle");
      if (vehicle) return { floorIndex, point: vehicle.center };
    }
  }

  const isOpening = section.id.includes("entrance") || section.id.includes("gate") || section.id.includes("floor-entrance");
  if (isOpening) {
    for (let floorIndex = 0; floorIndex < plan.floors.length; floorIndex += 1) {
      const point = openingPoint(plan.floors[floorIndex], section.id);
      if (point) return { floorIndex, point };
    }
  }

  const activeIndex = Math.max(0, plan.floors.findIndex((floor) => floor.id === plan.activeFloorId));
  const room = plan.floors[activeIndex].rooms?.[0];
  return { floorIndex: activeIndex, point: room ? roomCentroid(room.polygon) : { x: 0, z: 0 } };
}

function squareRequirement(center: Vec2, offsetIndex: number): Vec2[] {
  // A small deterministic spread keeps several checklist areas at one doorway clickable.
  const column = offsetIndex % 3;
  const row = Math.floor(offsetIndex / 3) % 3;
  const x = center.x + (column - 1) * 1.8;
  const z = center.z + (row - 1) * 1.8;
  const half = 0.65;
  return [
    { x: x - half, z: z - half },
    { x: x + half, z: z - half },
    { x: x + half, z: z + half },
    { x: x - half, z: z + half }
  ];
}

/** Whether a checklist section already exists as a room, zone, fixture or opening. */
export function sampleSectionIsRepresented(plan: BuildingPlan, sectionId: string): boolean {
  if (plan.floors.some((floor) =>
    (floor.rooms ?? []).some((room) => room.sectionTypeId === sectionId)
    || (floor.coverageRequirements ?? []).some((requirement) => requirement.sectionTypeId === sectionId)
  )) return true;
  const variants = checklistObstacleVariants[sectionId] ?? [];
  if (variants.length > 0 && plan.floors.some((floor) =>
    floor.obstacles.some((item) => item.variant && variants.includes(item.variant))
  )) return true;
  const idPrefixes = checklistObstacleIdPrefixes[sectionId] ?? [];
  if (idPrefixes.length > 0 && plan.floors.some((floor) =>
    floor.obstacles.some((item) => idPrefixes.some((prefix) => item.id.startsWith(prefix)))
  )) return true;
  const isOpening = sectionId.includes("entrance") || sectionId.includes("gate") || sectionId.includes("floor-entrance");
  return isOpening && plan.floors.some((floor) => openingPoint(floor, sectionId));
}

/**
 * Represent the venue programme in checklist order. Critical and important items are
 * always present; optional types are only used where a real sample room needs them.
 */
function addChecklistProgramme(plan: BuildingPlan, venueTypeId: VenueTypeId): BuildingPlan {
  const requiredSections = sectionsForVenue(venueTypeId).filter(
    (section) => section.priority === "critical" || section.priority === "important"
  );
  const floors = plan.floors.map((floor) => ({
    ...floor,
    coverageRequirements: [...(floor.coverageRequirements ?? [])]
  }));
  const workingPlan = { ...plan, floors, venueTypeId };
  const represented = new Set(requiredSections
    .filter((section) => sampleSectionIsRepresented(workingPlan, section.id))
    .map((section) => section.id));

  requiredSections.forEach((section, index) => {
    if (represented.has(section.id)) return;
    // Residential samples must describe the house that was actually drawn. A
    // villa without a pool, parking bay, corridor or marked blind spot must not
    // receive synthetic checklist squares for those spaces inside its rooms.
    if (venueTypeId === "residential") return;
    const { floorIndex, point } = checklistAnchor(workingPlan, section);
    floors[floorIndex].coverageRequirements!.push({
      id: `${floors[floorIndex].id}-sample-checklist-${section.id.replaceAll(".", "-")}`,
      polygon: squareRequirement(point, index),
      label: section.label,
      origin: "user",
      sectionTypeId: section.id
    });
    represented.add(section.id);
  });

  return workingPlan;
}

function programmeSampleRooms(id: SamplePlanId, plan: BuildingPlan): BuildingPlan {
  if (id === "kourosh-mall" || id === "mega-mall") return plan;
  const customSectionTypes = sampleCustomSectionTypes[id]?.map((section) => ({ ...section })) ?? [];
  const programmed = {
    ...plan,
    venueTypeId: sampleVenueTypeIds[id],
    customSectionTypes,
    floors: plan.floors.map((floor) => {
      const detectedRooms = reconcileRooms(floor);
      const sectionIds = detectedRooms.map((room) => sampleRoomSectionType(id, floor, room, detectedRooms));
      const sectionCounts = new Map<string, number>();
      sectionIds.forEach((sectionId) => sectionCounts.set(sectionId, (sectionCounts.get(sectionId) ?? 0) + 1));
      const sectionOrdinals = new Map<string, number>();
      return {
        ...floor,
        rooms: detectedRooms.map((room, index) => {
        const sectionTypeId = sampleRoomSectionType(id, floor, room, detectedRooms);
        const baseName = findSectionType(sectionTypeId)?.label
          ?? customSectionTypes.find((section) => section.id === sectionTypeId)?.label;
        const ordinal = (sectionOrdinals.get(sectionTypeId) ?? 0) + 1;
        sectionOrdinals.set(sectionTypeId, ordinal);
        return {
          ...room,
          id: `${floor.id}-sample-room-${index + 1}`,
          sectionTypeId,
          name: room.name
            ?? (baseName && (sectionCounts.get(sectionTypeId) ?? 0) > 1 ? `${baseName} ${ordinal}` : baseName)
        };
        })
      };
    })
  };
  return addChecklistProgramme(programmed, sampleVenueTypeIds[id]);
}

export function createSamplePlan(id: SamplePlanId): BuildingPlan {
  return programmeSampleRooms(id, rawSamplePlan(id));
}

export type { SamplePlanId };
