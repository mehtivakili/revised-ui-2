import {
  defaultPlanDefaults,
  type BuildingPlan,
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
import { pointInPolygon } from "@/src/lib/planner/geometry";
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
  "corner-retail-shop": [sampleSection("sample.shop.office", "shop", "دفتر و اتاق کنترل فروشگاه")],
  "retail-gallery": [sampleSection("sample.shop.admin", "shop", "نیم‌طبقه اداری")],
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
  "primary-school": [sampleSection("sample.school.lobby", "school", "لابی و انتظار مدرسه")],
  "school-campus": [sampleSection("sample.school.multipurpose", "school", "سالن چندمنظوره و ورزشی")]
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

function topLanding(id: string, x: number, z: number, rotationDeg = 0): PlanObstacle {
  return obstacle(id, "پاگرد نهایی", "block", x, z, 4.2, 1.4, 0.18, false, rotationDeg);
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

/** A readable two-storey home rather than a showcase mansion. */
function familyVillaPlan(): BuildingPlan {
  const ground = floor("family-villa-ground", "همکف، نشیمن و آشپزخانه", 0, [
    ...rectangle("family-villa-ground-shell", -14, -9, 14, 9),
    partition("family-villa-ground-spine", -14, 2, 14, 2),
    partition("family-villa-ground-kitchen", 5, -9, 5, 2),
    partition("family-villa-ground-study", -5, 2, -5, 9)
  ], [
    { ...door("family-villa-main-entry", "family-villa-ground-shell-south", 0.5, 1.6), variant: "single-glass", swingDirection: "inward" },
    door("family-villa-living-door", "family-villa-ground-spine", 0.48, 1.4),
    door("family-villa-kitchen-door", "family-villa-ground-spine", 0.78, 1.2),
    door("family-villa-study-door", "family-villa-ground-study", 0.55, 1.1),
    windowOpening("family-villa-ground-window-north-a", "family-villa-ground-shell-north", 0.25, 2.6),
    windowOpening("family-villa-ground-window-north-b", "family-villa-ground-shell-north", 0.72, 2.6),
    windowOpening("family-villa-ground-window-east", "family-villa-ground-shell-east", 0.38, 2.2),
    windowOpening("family-villa-ground-window-west", "family-villa-ground-shell-west", 0.38, 2.2)
  ], [
    ...presetObstacles("family-villa-living", [
      ["rug", -5, -4], ["sofa-three", -5, -5.5], ["sofa-single", -2, -3.5, 90],
      ["coffee-table", -5, -3.8], ["tv-unit", -12.5, -4, 90], ["dining-table", 0, -4, 90]
    ]),
    ...tableChairs("family-villa-dining-chairs", 0, -4, 90, "dining-chair"),
    ...presetObstacles("family-villa-kitchen-assets", [
      ["fridge", 12.5, -6.5, 90], ["kitchen-counter", 9, -8], ["stove", 12, -8],
      ["sink-unit", 6.5, -8], ["kitchen-island", 9.5, -3.5], ["dishwasher", 7, -6]
    ]),
    ...presetObstacles("family-villa-study-assets", [
      ["office-desk", -10, 5], ["office-chair", -10, 6.2, 180], ["bookshelf", -13, 5, 90]
    ]),
    presetObstacle("family-villa-ground-stairs", "stairs-straight", 8, 5, 90),
    presetObstacle("family-villa-ground-rack", "equipment-rack", 12.5, 6.8, 90),
    ...presetObstacles("family-villa-yard", [
      ["grass", -20, -4], ["deciduous", -20, 5], ["hedge", 20, 0, 90],
      ["gate-sliding", 0, 13], ["light-pole", 10, 12], ["road", 0, 11]
    ])
  ]);

  const first = floor("family-villa-first", "طبقه اول، اتاق‌ها و نشیمن خانوادگی", 1, [
    ...rectangle("family-villa-first-shell", -14, -9, 14, 9),
    partition("family-villa-first-spine", -14, 0, 14, 0),
    // Bedroom dividers stop at the corridor/living line. Extending them to the south
    // façade created three isolated lower rooms with no route back to the stair.
    partition("family-villa-first-west", -4, -9, -4, 0),
    partition("family-villa-first-east", 5, -9, 5, 0)
  ], [
    door("family-villa-first-bedroom-a", "family-villa-first-spine", 0.16, 1.1),
    door("family-villa-first-bedroom-b", "family-villa-first-spine", 0.5, 1.1),
    door("family-villa-first-bedroom-c", "family-villa-first-spine", 0.84, 1.1),
    windowOpening("family-villa-first-window-north-a", "family-villa-first-shell-north", 0.2, 2.2),
    windowOpening("family-villa-first-window-north-b", "family-villa-first-shell-north", 0.5, 2.2),
    windowOpening("family-villa-first-window-north-c", "family-villa-first-shell-north", 0.8, 2.2),
    windowOpening("family-villa-first-window-south-a", "family-villa-first-shell-south", 0.22, 2.2),
    windowOpening("family-villa-first-window-south-b", "family-villa-first-shell-south", 0.75, 2.2)
  ], [
    ...presetObstacles("family-villa-bedrooms", [
      ["bed-double", -9, -5], ["nightstand", -6.8, -5], ["wardrobe", -13, -2, 90],
      ["bed-single", 0, -5], ["nightstand", 2, -5], ["wardrobe", -3.2, -2, 90],
      ["bed-single", 9.5, -5], ["dresser", 12, -2], ["wardrobe", 13, -5, 90]
    ]),
    ...presetObstacles("family-villa-family-lounge", [
      ["sofa-three", -5, 5], ["sofa-single", -2, 5, 90], ["coffee-table", -4, 3.5], ["bookshelf", -13, 5, 90]
    ]),
    topLanding("family-villa-first-landing", 8, 5, 90)
  ]);
  return building([ground, first]);
}

/** A realistic single-unit shop with a sales floor and two small support rooms. */
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
    windowOpening("corner-shop-side-window", "corner-shop-shell-east", 0.35, 2)
  ], [
    ...presetObstacles("corner-shop-sales", [
      ["shelving-unit", -8.5, -3.5, 90], ["shelving-unit", -8.5, 0, 90],
      ["shelving-unit", 8.5, -3.5, 90], ["shelving-unit", 8.5, 0, 90],
      ["display-stand", -3, -2], ["display-stand", 1, -2], ["display-stand", 5, -2],
      ["checkout-counter", 6, 1.2], ["queue-barrier", 2.5, 1.4]
    ]),
    ...presetObstacles("corner-shop-stock", [
      ["storage-rack", -7, 5], ["storage-rack", -2, 5], ["crate-stack", -8.5, 6.2, 90], ["packing-table", -2, 6]
    ]),
    ...presetObstacles("corner-shop-service", [
      ["office-desk", 6, 5], ["office-chair", 6, 6.1, 180],
      ["filing-cabinet", 9, 5, 90], ["equipment-rack", 9, 6.5, 90]
    ])
  ]);
  return building([ground]);
}

/**
 * A fully furnished multi-level estate. Service-heavy objects live in a dedicated
 * basement, leaving the garden and residential floors calm and readable.
 */
function luxuryVillaPlan(): BuildingPlan {
  const basementWalls = [
    ...rectangle("villa-basement-shell", -22, -15, 22, 15),
    partition("villa-basement-spine", 0, -15, 0, 15),
    partition("villa-basement-west-bay", -22, 5, 0, 5),
    partition("villa-basement-east-bay", 0, 0, 22, 0)
  ];
  const basement = floor("villa-basement", "زیرزمین، پارکینگ و خدمات", -1, basementWalls, [
    door("villa-basement-ramp", "villa-basement-shell-south", 0.2, 5),
    door("villa-basement-workshop", "villa-basement-spine", 0.28, 1.4),
    door("villa-basement-warehouse", "villa-basement-spine", 0.76, 1.4),
    door("villa-basement-service", "villa-basement-east-bay", 0.5, 1.4),
    windowOpening("villa-basement-vent-a", "villa-basement-shell-east", 0.28, 1.4),
    windowOpening("villa-basement-vent-b", "villa-basement-shell-east", 0.72, 1.4)
  ], [
    ...presetObstacles("villa-basement-vehicles", [
      ["sedan", -16, -10], ["suv", -16, -5], ["pickup", -16, 0],
      ["van", -16, 9], ["truck", -8, 11, 90]
    ]),
    ...presetObstacles("villa-basement-parking", [
      ["parking-barrier", -10, -13], ["guard-booth", -4, -11], ["bollard", -7, -13],
      ["speed-bump", -15, -12], ["wheel-stop", -16, 3]
    ]),
    ...presetObstacles("villa-basement-workshop", [
      ["workbench", 6, -10], ["cnc-machine", 13, -9], ["tool-cabinet", 20.5, -10, 90],
      ["welding-station", 18, -4], ["conveyor", 8, -3]
    ]),
    ...presetObstacles("villa-basement-warehouse", [
      ["storage-rack", 20.5, 5, 90], ["pallet-stack", 6, 5], ["crate-stack", 9, 5],
      ["packing-table", 6, 11], ["loading-platform", 15, 11]
    ]),
    presetObstacle("villa-basement-rack", "equipment-rack", 1.5, 13),
    presetObstacle("villa-basement-stairs", "stairs-straight", 2, 4.3, 90),
    presetObstacle("villa-basement-elevator", "elevator", 3.8, 4.3, 90)
  ]);

  const estateWalls = rectangle("villa-estate", -32, -24, 32, 24, 2.2);
  const groundWalls = [
    ...estateWalls,
    ...rectangle("villa-house", -16, -11, 16, 11),
    partition("villa-ground-public-h", -16, 2, 16, 2),
    partition("villa-ground-lounge-v", -4, -11, -4, 2),
    partition("villa-ground-kitchen-v", 7, 2, 7, 11),
    partition("villa-ground-office-v", -8, 2, -8, 11)
  ];
  const ground = floor("villa-ground", "همکف، باغ و پذیرایی", 0, groundWalls, [
    door("villa-gate", "villa-estate-south", 0.5, 5),
    door("villa-main-entry", "villa-house-south", 0.5, 2.4),
    door("villa-garden-entry", "villa-house-north", 0.3, 1.8),
    door("villa-kitchen-entry", "villa-ground-public-h", 0.78, 1.2),
    door("villa-office-entry", "villa-ground-public-h", 0.15, 1.1),
    windowOpening("villa-ground-window-south-a", "villa-house-south", 0.2, 2.4),
    windowOpening("villa-ground-window-south-b", "villa-house-south", 0.8, 2.4),
    windowOpening("villa-ground-window-north", "villa-house-north", 0.7, 3),
    windowOpening("villa-ground-window-east", "villa-house-east", 0.5, 2.2),
    windowOpening("villa-ground-window-west", "villa-house-west", 0.5, 2.2)
  ], [
    ...presetObstacles("villa-arrival", [
      ["road", 0, 19], ["gate-sliding", 0, 23.2],
      ["fence-mesh", -24, 23.2], ["fence-wall", 24, 23.2],
      ["camera-pole", -29, 19], ["light-pole", 29, 19]
    ]),
    ...presetObstacles("villa-landscape", [
      ["grass", -25, -14], ["hedge", 25, -10, 90], ["bush", -19, -20],
      ["deciduous", -27, -4], ["conifer", 28, 0], ["palm", 24, -18]
    ]),
    ...presetObstacles("villa-lounge", [
      ["rug", -10, -4], ["sofa-three", -10, -5], ["sofa-single", -7, -3.5, 90],
      ["coffee-table", -10, -3.3], ["tv-unit", -14.5, -4, 90], ["dining-table", 1.5, -4, 90]
    ]),
    ...tableChairs("villa-dining-chairs", 1.5, -4, 90, "dining-chair"),
    ...presetObstacles("villa-hospitality", [
      ["lobby-sofa", 1, -7], ["concierge-desk", 4.5, -9], ["luggage-cart", 6, -7],
      ["queue-barrier", 0, -9], ["vending-machine", 14.5, -7, 90]
    ]),
    ...presetObstacles("villa-kitchen", [
      ["fridge", 14.5, 8.5, 90], ["kitchen-counter", 10.5, 10.2],
      ["stove", 13.5, 10.2], ["sink-unit", 8.5, 10.2],
      ["kitchen-island", 11.5, 6], ["dishwasher", 9.5, 10.2]
    ]),
    presetObstacle("villa-reception", "reception-desk", -4.5, 6, 90),
    presetObstacle("villa-stairs", "stairs-straight", 2, 4.3, 90),
    presetObstacle("villa-ground-elevator", "elevator", 3.8, 4.3, 90),
    obstacle("villa-pool", "استخر روباز", "block", -23, 5, 10, 4.5, 0.18, false)
  ]);

  const firstWalls = [
    ...rectangle("villa-first-shell", -16, -11, 16, 11),
    partition("villa-first-hall", -16, 0, 16, 0),
    partition("villa-first-west", -6, -11, -6, 11),
    partition("villa-first-east", 6, -11, 6, 11),
    partition("villa-first-suite", 0, 0, 0, 11)
  ];
  const first = floor("villa-first", "طبقه اول، سوئیت و کتابخانه", 1, firstWalls, [
    door("villa-first-suite-a", "villa-first-hall", 0.18),
    door("villa-first-suite-b", "villa-first-hall", 0.82),
    door("villa-first-study", "villa-first-west", 0.72),
    windowOpening("villa-first-window-south-a", "villa-first-shell-south", 0.2, 2.2),
    windowOpening("villa-first-window-south-b", "villa-first-shell-south", 0.8, 2.2),
    windowOpening("villa-first-window-north-a", "villa-first-shell-north", 0.25, 2.4),
    windowOpening("villa-first-window-north-b", "villa-first-shell-north", 0.75, 2.4),
    windowOpening("villa-first-window-east", "villa-first-shell-east", 0.5, 2)
  ], [
    ...presetObstacles("villa-private", [
    ["bed-double", -11, -5], ["nightstand", -8.8, -5], ["wardrobe", -14.8, -1.8, 90],
    ["dresser", -10.5, -9.8], ["bed-single", 11, -5], ["bookshelf", 14.8, -4, 90],
    ["office-desk", -3, 6], ["office-chair", -3, 7.2, 180], ["meeting-table", 3, 6, 90],
    ["filing-cabinet", -5.5, 9.5, 90], ["partition-screen", -2, 4.5]
    ]),
    ...tableChairs("villa-first-meeting-chairs", 3, 6, 90),
    presetObstacle("villa-first-stairs", "stairs-straight", 2, 4.3, 90),
    presetObstacle("villa-first-elevator", "elevator", 3.8, 4.3, 90)
  ]);

  const secondWalls = [
    ...rectangle("villa-second-shell", -16, -11, 16, 11),
    partition("villa-second-gallery", -16, 1, 16, 1),
    partition("villa-second-west", -5, -11, -5, 1),
    partition("villa-second-east", 7, -11, 7, 1),
    partition("villa-second-service", 5, 1, 5, 11)
  ];
  const second = floor("villa-second", "طبقه دوم، گالری و سرگرمی", 2, secondWalls, [
    door("villa-second-gallery-a", "villa-second-gallery", 0.2),
    door("villa-second-gallery-b", "villa-second-gallery", 0.78),
    windowOpening("villa-second-window-south-a", "villa-second-shell-south", 0.2, 2.4),
    windowOpening("villa-second-window-south-b", "villa-second-shell-south", 0.8, 2.4),
    windowOpening("villa-second-window-north", "villa-second-shell-north", 0.5, 3.2),
    windowOpening("villa-second-window-west", "villa-second-shell-west", 0.5, 2.2)
  ], [
    ...presetObstacles("villa-gallery", [
      ["shelving-unit", -11, -4, 90], ["display-fridge", -14.8, -8, 90],
      ["checkout-counter", -10, -9.2], ["clothing-rack", 1, -5, 90], ["display-stand", 4, -5]
    ]),
    obstacle("villa-cinema", "سینمای خانگی", "block", 11, -5, 7, 5, 1.1, false),
    obstacle("villa-games", "میز بازی", "counter", -7, 6, 3, 1.6, 0.85, false),
    obstacle("villa-bar", "کافی‌بار", "counter", 10, 7.5, 5, 1, 1.05, false),
    presetObstacle("villa-second-stairs", "stairs-straight", 2, 4.3, 90),
    presetObstacle("villa-second-elevator", "elevator", 3.8, 4.3, 90)
  ]);

  const roofWalls = [
    ...rectangle("villa-roof-shell", -16, -11, 16, 11, 1.25),
    // The roof core is a real enclosed arrival lobby.  The old south wall ran
    // through both the final landing and the lift shaft.
    ...rectangle("villa-roof-room", -5, -3.5, 5, 6.8)
  ];
  const roof = floor("villa-roof", "بام، روف‌گاردن و تاسیسات", 3, roofWalls, [
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

function modernOfficePlan(): BuildingPlan {
  const make = (index: number, name: string) => {
    const prefix = `office-${index}`;
    const walls = [
      ...rectangle(`${prefix}-shell`, -18, -11, 18, 11),
      // Enclose only the southern vertical-circulation lobby. A full-height divider
      // created a redundant north-west office with no door on every upper floor.
      partition(`${prefix}-core-v`, -6, 2, -6, 11),
      glassPartition(`${prefix}-meeting-h`, -18, 2, 18, 2),
      glassPartition(`${prefix}-rooms-v`, 7, -11, 7, 2)
    ];
    const openings = [
      ...(index === 0 ? [door(`${prefix}-entry`, `${prefix}-shell-south`, 0.5, 1.8)] : []),
      // Open into the shared lift/stair lobby at z≈7. The former offset opened into
      // the northern office and left upper-floor rooms disconnected from the core.
      door(`${prefix}-core-door`, `${prefix}-core-v`, 0.55, 1.2),
      door(`${prefix}-meeting-door`, `${prefix}-meeting-h`, 0.68, 1.2),
      door(`${prefix}-room-door`, `${prefix}-rooms-v`, 0.5, 1.1),
      windowOpening(`${prefix}-window-north-a`, `${prefix}-shell-north`, 0.22, 3),
      windowOpening(`${prefix}-window-north-b`, `${prefix}-shell-north`, 0.78, 3),
      windowOpening(`${prefix}-window-east`, `${prefix}-shell-east`, 0.5, 2.4),
      windowOpening(`${prefix}-window-west`, `${prefix}-shell-west`, 0.5, 2.4)
    ];
    const shared = [
      index < 2
        ? presetObstacle(`${prefix}-stairs`, "stairs-straight", -14.5, 6.5, 90)
        : topLanding(`${prefix}-landing`, -14.5, 6.5, 90),
      presetObstacle(`${prefix}-elevator`, "elevator", -10.2, 7, 90),
      presetObstacle(`${prefix}-rack`, "equipment-rack", -16.5, 8.5, 90)
    ];
    const obstacles = index === 0 ? [
      ...shared,
      ...presetObstacles(`${prefix}-lobby`, [
        ["reception-desk", -1.5, -7], ["lobby-sofa", 3, -7], ["lobby-sofa", 3, -4.5],
        ["queue-barrier", -1.5, -9], ["vending-machine", 16.5, -7, 90], ["luggage-cart", 5.5, -7]
      ]),
      ...presetObstacles(`${prefix}-service`, [
        ["office-desk", 11, -5], ["office-chair", 11, -3.8, 180], ["filing-cabinet", 16.5, -2, 90],
        ["coffee-table", 2.5, 5], ["sofa-three", 2.5, 6.5], ["rug", 2.5, 5.5]
      ])
    ] : index === 1 ? [
      ...shared,
      ...presetObstacles(`${prefix}-operations`, [
        ["office-desk", -2, -7], ["office-desk", 2, -7], ["office-desk", -2, -3.5], ["office-desk", 2, -3.5],
        ["office-chair", -2, -5.8, 180], ["office-chair", 2, -5.8, 180], ["office-chair", -2, -2.3, 180], ["office-chair", 2, -2.3, 180],
        ["partition-screen", 0, -5.2, 90], ["partition-screen", 0, -1.8, 90],
        ["filing-cabinet", 5.5, -8.5, 90], ["filing-cabinet", 5.5, -5.8, 90],
        ["office-desk", 11, -7], ["office-chair", 11, -5.8, 180],
        ["office-desk", 15, -4], ["office-chair", 15, -2.8, 180],
        ["meeting-table", 1, 6], ["kitchen-counter", 11, 8.5], ["fridge", 16.5, 8.5, 90]
      ]),
      ...tableChairs(`${prefix}-meeting-chairs`, 1, 6)
    ] : [
      ...shared,
      ...presetObstacles(`${prefix}-management`, [
        ["office-desk", -1, -6], ["office-chair", -1, -4.8, 180], ["bookshelf", 5.5, -7, 90],
        ["meeting-table", 1, 6], ["meeting-table", 11.5, -5, 90], ["filing-cabinet", 16.5, -8, 90],
        ["vending-machine", 16.5, 8.5, 90], ["reception-desk", 11.5, -9]
      ]),
      ...tableChairs(`${prefix}-boardroom-chairs`, 1, 6),
      ...tableChairs(`${prefix}-meeting-room-chairs`, 11.5, -5, 90)
    ];
    return floor(prefix, name, index, walls, openings, obstacles);
  };
  return building([make(0, "لابی و خدمات"), make(1, "دفترهای عملیاتی"), make(2, "مدیریت و جلسات")]);
}

function retailGalleryPlan(): BuildingPlan {
  const groundWalls = [
    ...rectangle("gallery-shell", -20, -13, 20, 13),
    partition("gallery-back", -20, 6, 20, 6),
    glassPartition("gallery-east", 8, -13, 8, 6),
    glassPartition("gallery-west", -8, -13, -8, 6),
    partition("gallery-stock-v", 5, 6, 5, 13)
  ];
  const ground = floor("gallery-ground", "گالری، صندوق و انبار", 0, groundWalls, [
    door("gallery-entry", "gallery-shell-south", 0.5, 3),
    door("gallery-stock-door", "gallery-back", 0.72, 1.5),
    door("gallery-office-door", "gallery-back", 0.18, 1.2),
    windowOpening("gallery-window-south-a", "gallery-shell-south", 0.18, 3),
    windowOpening("gallery-window-south-b", "gallery-shell-south", 0.82, 3),
    windowOpening("gallery-window-east", "gallery-shell-east", 0.5, 2.6),
    windowOpening("gallery-window-west", "gallery-shell-west", 0.5, 2.6)
  ], [
    ...presetObstacles("gallery-sales", [
      ["shelving-unit", -15, -7, 90], ["shelving-unit", -15, -2, 90],
      ["shelving-unit", 15, -7, 90], ["shelving-unit", 15, -2, 90],
      ["display-stand", -4, -6], ["display-stand", 0, -6], ["display-stand", 4, -6],
      ["clothing-rack", -4, -1, 90], ["clothing-rack", 0, -1, 90], ["clothing-rack", 4, -1, 90],
      ["display-fridge", 18.5, 3.5, 90], ["checkout-counter", 12, 4], ["checkout-counter", 16, 4]
    ]),
    ...presetObstacles("gallery-stock", [
      ["storage-rack", 17.5, 9, 90], ["storage-rack", 12.5, 9, 90],
      ["pallet-stack", 8, 10], ["crate-stack", 3.5, 7.5], ["packing-table", 1, 9.5]
    ]),
    presetObstacle("gallery-stairs", "stairs-straight", -8, 8.5, 90),
    presetObstacle("gallery-ground-elevator", "elevator", -6.2, 8.5, 90),
    presetObstacle("gallery-rack", "equipment-rack", -18.5, 10.5, 90)
  ]);
  const mezzanine = floor("gallery-mezzanine", "نیم‌طبقه اداری", 1, [
    ...rectangle("gallery-mezz-shell", -11, -8, 11, 11),
    glassPartition("gallery-mezz-h", -11, 1, 11, 1),
    glassPartition("gallery-mezz-v", 2, -8, 2, 11)
  ], [
    door("gallery-mezz-meeting", "gallery-mezz-h", 0.72),
    windowOpening("gallery-mezz-window-north", "gallery-mezz-shell-north", 0.5, 3),
    windowOpening("gallery-mezz-window-east", "gallery-mezz-shell-east", 0.5, 2)
  ], [
    ...presetObstacles("gallery-mezz-office", [
      ["office-desk", -6, -4], ["office-desk", -2, -4], ["office-chair", -6, -2.8, 180], ["office-chair", -2, -2.8, 180],
      ["meeting-table", -4, 4.5], ["filing-cabinet", -9.5, 5.5, 90], ["reception-desk", 6, -5, 90],
      ["lobby-sofa", 6, 4.5], ["coffee-table", 6, 3], ["vending-machine", 9.5, 6, 90]
    ]),
    ...tableChairs("gallery-mezz-meeting-chairs", -4, 4.5),
    topLanding("gallery-mezz-landing", -8, 8.5, 90),
    presetObstacle("gallery-mezz-elevator", "elevator", -6.2, 8.5, 90)
  ]);
  return building([ground, mezzanine]);
}

/**
 * A medium neighbourhood supermarket: large enough to exercise the aisle and loading
 * tools, but still compact enough to understand at a glance when opened as a sample.
 */
function neighbourhoodSupermarketPlan(): BuildingPlan {
  const walls = [
    ...rectangle("market-shell", -24, -15, 24, 15, 4.4),
    // Stock, cold room and cash office sit against the loading façade, not behind
    // the customer entrance vestibule.
    partition("market-back-spine", -24, -7, 24, -7, 4.4),
    partition("market-back-west", -8, -15, -8, -7, 4.4),
    partition("market-back-east", 9, -15, 9, -7, 4.4),
    glassPartition("market-entry-west", -5, 10.5, -5, 15, 3.2),
    glassPartition("market-entry-east", 5, 10.5, 5, 15, 3.2),
    glassPartition("market-entry-inner", -5, 10.5, 5, 10.5, 3.2)
  ];
  const doors: PlanDoor[] = [
    { ...door("market-customer-entry", "market-shell-south", 0.5, 2.8), variant: "double-glass", swingDirection: "inward" },
    { ...door("market-entry-inner-door", "market-entry-inner", 0.5, 2.4), variant: "double-glass", swingDirection: "inward" },
    door("market-coldstore-door", "market-back-spine", 0.16, 1.5),
    door("market-stock-door", "market-back-spine", 0.51, 1.7),
    door("market-cashroom-door", "market-back-spine", 0.84, 1.1),
    { ...door("market-loading-door", "market-shell-north", 0.5, 3.4), variant: "double-solid", swingDirection: "outward" },
    windowOpening("market-window-east-a", "market-shell-east", 0.3, 3),
    windowOpening("market-window-east-b", "market-shell-east", 0.68, 3),
    windowOpening("market-window-west-a", "market-shell-west", 0.3, 3),
    windowOpening("market-window-west-b", "market-shell-west", 0.68, 3)
  ];
  const obstacles = [
    ...presetObstacles("market-checkouts", [
      ["checkout-counter", -9, 8.8], ["checkout-counter", -4, 8.8],
      ["checkout-counter", 4, 8.8], ["checkout-counter", 9, 8.8]
    ]),
    ...gridPresets("market-aisles", ["shelving-unit"], [-17, -10, -3, 4, 11, 18], [-4, 0.5, 5]),
    ...presetObstacles("market-high-value", [
      ["display-stand", -20, 7.5], ["display-stand", -15, 7.5],
      ["display-fridge", 22.5, -5, 90], ["display-fridge", 22.5, -1, 90], ["display-fridge", 22.5, 3, 90]
    ]),
    ...presetObstacles("market-coldstore", [
      ["display-fridge", -22.5, -10, 90], ["display-fridge", -19.5, -10, 90],
      ["storage-rack", -11, -10], ["crate-stack", -17, -13]
    ]),
    ...presetObstacles("market-stock", [
      ["storage-rack", -4, -10], ["storage-rack", 3, -10], ["storage-rack", 7, -13, 90],
      ["pallet-stack", -4, -13], ["crate-stack", 1, -13], ["packing-table", 5, -9]
    ]),
    ...presetObstacles("market-cashroom", [
      ["office-desk", 14, -11], ["office-chair", 14, -12.2, 180],
      ["filing-cabinet", 22.5, -10, 90], ["equipment-rack", 22.5, -13.5, 90]
    ]),
    ...presetObstacles("market-dock", [
      ["road", 0, -17], ["loading-platform", 0, -17], ["truck", 0, -23, 90],
      ["light-pole", -20, -18], ["light-pole", 20, -18]
    ]),
    ...presetObstacles("market-entry-fixtures", [
      ["queue-barrier", -2.2, 12.5, 90], ["queue-barrier", 2.2, 12.5, 90],
      ["vending-machine", 7, 13.5], ["road", 0, 17]
    ])
  ];
  return building([floor("market-ground", "فروشگاه، صندوق‌ها و پشتیبانی", 0, walls, doors, obstacles, 4.6)]);
}

/**
 * A compact jewellery / exchange branch with a glazed customer front and a solid secure
 * rear.  The plan is intentionally generic and does not reproduce a real protected site.
 */
function secureJewelleryBranchPlan(): BuildingPlan {
  const walls = [
    ...rectangle("jewellery-shell", -12, -8, 12, 8, 3.6),
    // The secure/service band is on the rear façade; keeping it beside the entrance
    // previously put customer furniture inside the staff room and vault.
    partition("jewellery-secure-spine", -12, -3, 12, -3, 3.6),
    partition("jewellery-secure-split", 3, -8, 3, -3, 3.6),
    glassPartition("jewellery-entry-west", -3, 5, -3, 8, 3),
    glassPartition("jewellery-entry-east", 3, 5, 3, 8, 3),
    glassPartition("jewellery-entry-inner", -3, 5, 3, 5, 3)
  ];
  const doors: PlanDoor[] = [
    { ...door("jewellery-main-entry", "jewellery-shell-south", 0.5, 1.8), variant: "double-glass", swingDirection: "inward" },
    { ...door("jewellery-inner-security-door", "jewellery-entry-inner", 0.5, 1.2), variant: "single-glass", swingDirection: "inward" },
    door("jewellery-staff-door", "jewellery-secure-spine", 0.25, 1.1),
    door("jewellery-vault-door", "jewellery-secure-spine", 0.74, 1),
    { ...door("jewellery-emergency-exit", "jewellery-shell-north", 0.25, 1.1), swingDirection: "outward" },
    windowOpening("jewellery-show-window-a", "jewellery-shell-south", 0.2, 2.5),
    windowOpening("jewellery-show-window-b", "jewellery-shell-south", 0.8, 2.5),
    windowOpening("jewellery-side-window-east", "jewellery-shell-east", 0.35, 1.8),
    windowOpening("jewellery-side-window-west", "jewellery-shell-west", 0.35, 1.8)
  ];
  const obstacles = [
    ...presetObstacles("jewellery-counters", [
      ["checkout-counter", -7.5, 1.3], ["checkout-counter", -2.5, 1.3],
      ["checkout-counter", 2.5, 1.3], ["checkout-counter", 7.5, 1.3]
    ]),
    ...presetObstacles("jewellery-displays", [
      ["display-stand", -7, -1.5], ["display-stand", -2.5, -1.5],
      ["display-stand", 2.5, -1.5], ["display-stand", 7, -1.5],
      ["shelving-unit", -11, -2, 90], ["shelving-unit", 11, -2, 90]
    ]),
    ...presetObstacles("jewellery-customer", [
      ["queue-barrier", -1.8, 6.3, 90], ["queue-barrier", 1.8, 6.3, 90],
      ["waiting-bench", -8, 5.3], ["service-counter", 8, 5.2]
    ]),
    ...presetObstacles("jewellery-staff", [
      ["office-desk", -7, -5.5], ["office-chair", -7, -6.6, 180],
      ["filing-cabinet", -11, -5.4, 90], ["equipment-rack", -11, -7, 90]
    ]),
    ...presetObstacles("jewellery-vault", [
      ["storage-rack", 8, -7], ["tool-cabinet", 11, -5.5, 90], ["filing-cabinet", 4, -7]
    ]),
    ...presetObstacles("jewellery-street", [
      ["road", 0, 10], ["bollard", -8, 9.2], ["bollard", -5, 9.2], ["bollard", 5, 9.2], ["light-pole", 10, 11]
    ])
  ];
  return building([floor("jewellery-ground", "شعبه فروش، خزانه و کنترل ورودی", 0, walls, doors, obstacles, 3.8)]);
}

/** A single-storey production workshop with a legible yard and service edge. */
function compactIndustrialWorkshopPlan(): BuildingPlan {
  const walls = [
    ...rectangle("compact-factory-shell", -22, -14, 22, 14, 5.4),
    partition("compact-factory-warehouse", -8, -14, -8, 14, 5.4),
    partition("compact-factory-rear", -8, 6, 22, 6, 5.4),
    partition("compact-factory-service-split", 10, 6, 10, 14, 4)
  ];
  const openings: PlanDoor[] = [
    { ...door("compact-factory-vehicle-entry", "compact-factory-shell-north", 0.65, 4.5), variant: "double-solid", swingDirection: "inward" },
    door("compact-factory-staff-entry", "compact-factory-shell-south", 0.15, 1.5),
    { ...door("compact-factory-dock-door", "compact-factory-shell-north", 0.12, 4), variant: "double-solid", swingDirection: "outward" },
    door("compact-factory-warehouse-door", "compact-factory-warehouse", 0.55, 2.2),
    door("compact-factory-electrical-door", "compact-factory-rear", 0.42, 1.2),
    door("compact-factory-admin-door", "compact-factory-rear", 0.78, 1.2),
    windowOpening("compact-factory-office-window-north", "compact-factory-shell-north", 0.82, 2.8),
    windowOpening("compact-factory-office-window-east", "compact-factory-shell-east", 0.72, 2.2),
    windowOpening("compact-factory-hall-window-east", "compact-factory-shell-east", 0.28, 3)
  ];
  const obstacles = [
    ...presetObstacles("compact-factory-production", [
      ["conveyor", -1, -9], ["conveyor", -1, -4], ["conveyor", -1, 1],
      ["cnc-machine", 8, -9], ["cnc-machine", 15, -9], ["cnc-machine", 8, -3],
      ["workbench", 16, -2], ["workbench", 8, 3], ["welding-station", 16, 3],
      ["tool-cabinet", 20.5, -6, 90]
    ]),
    ...presetObstacles("compact-factory-warehouse-assets", [
      ["storage-rack", -19.5, -9, 90], ["storage-rack", -19.5, -3, 90], ["storage-rack", -19.5, 3, 90],
      ["pallet-stack", -13, -8], ["pallet-stack", -13, -3], ["crate-stack", -13, 3],
      ["packing-table", -13, 9], ["loading-platform", -18, -11]
    ]),
    ...presetObstacles("compact-factory-electrical", [
      ["equipment-rack", -3, 10], ["equipment-rack", 2, 10], ["tool-cabinet", 7.5, 10, 90]
    ]),
    ...presetObstacles("compact-factory-admin", [
      ["office-desk", 15, 9], ["office-chair", 15, 10.2, 180],
      ["filing-cabinet", 20.5, 9, 90], ["reception-desk", 11, 11]
    ]),
    ...presetObstacles("compact-factory-yard", [
      ["road", -12, -16], ["road", 0, -16], ["road", 12, -16], ["gate-sliding", 0, -18],
      ["truck", -12, -18, 90], ["pickup", 10, -20, 90], ["guard-booth", 17, -15.5],
      ["fence-mesh", -18, -18], ["fence-wall", 18, -18],
      ["camera-pole", -21, -16], ["light-pole", 21, -16]
    ])
  ];
  return building([floor("compact-factory-ground", "کارگاه تولید، انبار و محوطه خدماتی", 0, walls, openings, obstacles, 5.6)]);
}

/** A single parking deck with separate ramps, a control booth and pedestrian lobby. */
function urbanPublicParkingPlan(): BuildingPlan {
  const walls = [
    ...rectangle("public-parking-shell", -24, -14, 24, 14, 3.2),
    partition("public-parking-service", 16, -14, 16, 14, 3.2),
    partition("public-parking-service-split", 16, -4, 24, -4, 3.2)
  ];
  const openings: PlanDoor[] = [
    { ...door("public-parking-entry-ramp", "public-parking-shell-south", 0.25, 5), variant: "double-solid", swingDirection: "inward" },
    { ...door("public-parking-exit-ramp", "public-parking-shell-south", 0.72, 5), variant: "double-solid", swingDirection: "outward" },
    door("public-parking-control-door", "public-parking-service", 0.2, 1.1),
    door("public-parking-pedestrian-door", "public-parking-service", 0.72, 1.4),
    windowOpening("public-parking-control-window", "public-parking-shell-east", 0.25, 2.2),
    windowOpening("public-parking-vent-west-a", "public-parking-shell-west", 0.3, 2.8),
    windowOpening("public-parking-vent-west-b", "public-parking-shell-west", 0.7, 2.8)
  ];
  const obstacles = [
    ...gridPresets("public-parking-cars-a", ["sedan", "suv", "pickup"], [-18, -11, -4, 3, 10], [-9, 8], 90),
    ...gridPresets("public-parking-cars-b", ["sedan", "suv"], [-18, -11, -4, 3, 10], [-2.6, 2.6], 90),
    ...gridPresets("public-parking-wheel-stops", ["wheel-stop"], [-18, -11, -4, 3, 10], [-12, 11], 90),
    ...presetObstacles("public-parking-ramps", [
      ["parking-barrier", -12, 12], ["parking-barrier", 10, 12],
      ["speed-bump", -12, 9], ["speed-bump", 10, 9], ["bollard", -2, 12], ["bollard", 2, 12],
      ["road", -12, 16], ["road", 0, 16], ["road", 12, 16]
    ]),
    ...presetObstacles("public-parking-control", [
      ["guard-booth", 20, -9], ["office-desk", 20, -12], ["office-chair", 20, -10.8, 180], ["equipment-rack", 23, -12, 90]
    ]),
    ...presetObstacles("public-parking-pedestrian", [
      ["stairs-straight", 19, 7, 90], ["elevator", 22, 7, 90], ["waiting-bench", 20, 1], ["light-pole", 14, 0]
    ])
  ];
  return building([floor("public-parking-ground", "پارکینگ عمومی، رمپ‌ها و کنترل", 0, walls, openings, obstacles, 3.3)]);
}

/** A neighbourhood restaurant with dining at the front and a clear service band. */
function neighbourhoodRestaurantPlan(): BuildingPlan {
  const walls = [
    ...rectangle("restaurant-shell", -14, -10, 14, 10, 3.6),
    // Kitchen and food store belong on the rear/service façade. The previous band
    // occupied the customer frontage and made the main entrance open into storage.
    partition("restaurant-service-spine", -14, -3, 14, -3, 3.6),
    partition("restaurant-store-split", 5, -10, 5, -3, 3.6)
  ];
  const openings: PlanDoor[] = [
    { ...door("restaurant-customer-entry", "restaurant-shell-south", 0.5, 2), variant: "double-glass", swingDirection: "inward" },
    door("restaurant-kitchen-door", "restaurant-service-spine", 0.3, 1.3),
    door("restaurant-store-door", "restaurant-service-spine", 0.78, 1.1),
    { ...door("restaurant-backdoor", "restaurant-shell-north", 0.5, 1.2), swingDirection: "outward" },
    windowOpening("restaurant-front-window-a", "restaurant-shell-south", 0.2, 2.6),
    windowOpening("restaurant-front-window-b", "restaurant-shell-south", 0.8, 2.6),
    windowOpening("restaurant-side-window-east", "restaurant-shell-east", 0.32, 2.2),
    windowOpening("restaurant-side-window-west", "restaurant-shell-west", 0.32, 2.2)
  ];
  const diningTables = [[-8, 0], [0, 0], [8, 0], [-8, 5], [0, 5], [8, 5]] as const;
  const obstacles = [
    ...diningTables.flatMap(([x, z], index) => [
      presetObstacle(`restaurant-table-${index + 1}`, "dining-table", x, z),
      ...tableChairs(`restaurant-chairs-${index + 1}`, x, z, 0, "dining-chair")
    ]),
    ...presetObstacles("restaurant-checkout", [
      ["checkout-counter", 10.5, 1.5], ["queue-barrier", 7, 1.5], ["service-counter", 3.5, 1.5]
    ]),
    ...presetObstacles("restaurant-kitchen-assets", [
      ["fridge", -12.5, -6, 90], ["kitchen-counter", -8, -8.5], ["stove", -4, -8.5],
      ["sink-unit", -11, -8.5], ["kitchen-island", -6, -5.5], ["dishwasher", -9, -6]
    ]),
    ...presetObstacles("restaurant-store-assets", [
      ["storage-rack", 8, -6], ["storage-rack", 12.5, -6, 90], ["display-fridge", 12.5, -9, 90], ["crate-stack", 8, -9]
    ]),
    ...presetObstacles("restaurant-takeaway", [
      ["waiting-bench", 11, 8], ["vending-machine", 13, 8], ["light-pole", -11, 12]
    ])
  ];
  return building([floor("restaurant-ground", "سالن پذیرایی، آشپزخانه و انبار", 0, walls, openings, obstacles, 3.8)]);
}

/** A small one-storey primary school with six rooms around a central corridor. */
function primarySchoolPlan(): BuildingPlan {
  const walls = [
    ...rectangle("primary-school-shell", -24, -14, 24, 14, 3.6),
    partition("primary-school-corridor-north", -24, -2, 24, -2, 3.6),
    partition("primary-school-corridor-south", -24, 2, 24, 2, 3.6),
    partition("primary-school-north-west", -8, -14, -8, -2, 3.6),
    partition("primary-school-north-east", 8, -14, 8, -2, 3.6),
    partition("primary-school-south-west", -8, 2, -8, 14, 3.6),
    partition("primary-school-south-east", 8, 2, 8, 14, 3.6)
  ];
  const openings: PlanDoor[] = [
    { ...door("primary-school-main-entry", "primary-school-shell-south", 0.5, 2.4), variant: "double-glass", swingDirection: "inward" },
    door("primary-school-lobby-door", "primary-school-corridor-south", 0.5, 1.8),
    door("primary-school-class-a", "primary-school-corridor-north", 0.16, 1.2),
    door("primary-school-class-b", "primary-school-corridor-north", 0.5, 1.2),
    door("primary-school-lab-door", "primary-school-corridor-north", 0.84, 1.2),
    door("primary-school-class-c", "primary-school-corridor-south", 0.16, 1.2),
    door("primary-school-class-d", "primary-school-corridor-south", 0.84, 1.2),
    windowOpening("primary-school-window-north-a", "primary-school-shell-north", 0.17, 3),
    windowOpening("primary-school-window-north-b", "primary-school-shell-north", 0.5, 3),
    windowOpening("primary-school-window-north-c", "primary-school-shell-north", 0.83, 3),
    windowOpening("primary-school-window-south-a", "primary-school-shell-south", 0.2, 3),
    windowOpening("primary-school-window-south-b", "primary-school-shell-south", 0.8, 3)
  ];
  const classroomCentres = [[-16, -8], [0, -8], [-16, 8], [16, 8]] as const;
  const obstacles = [
    ...classroomCentres.flatMap(([cx, cz], roomIndex) => [
      ...gridPresets(`primary-school-desks-${roomIndex + 1}`, ["student-desk"], [cx - 4, cx, cx + 4], [cz - 2, cz + 2]),
      presetObstacle(`primary-school-board-${roomIndex + 1}`, "whiteboard", cx, cz < 0 ? cz - 5 : cz + 5)
    ]),
    ...gridPresets("primary-school-lab", ["lab-bench"], [12, 16, 20], [-10, -6]),
    presetObstacle("primary-school-lab-board", "whiteboard", 16, -13),
    ...presetObstacles("primary-school-lobby", [
      ["service-counter", 0, 8], ["waiting-bench", -4, 8], ["waiting-bench", 4, 8], ["equipment-rack", 7, 12, 90]
    ]),
    ...presetObstacles("primary-school-yard", [
      ["grass", -12, 20], ["grass", 0, 20], ["grass", 12, 20], ["waiting-bench", -15, 17],
      ["waiting-bench", 15, 17], ["gate-sliding", 0, 27], ["guard-booth", 8, 25],
      ["deciduous", -21, 22], ["light-pole", 21, 22], ["fence-mesh", -16, 27], ["fence-wall", 16, 27],
      ["road", 0, 21, 90]
    ])
  ];
  return building([floor("primary-school-ground", "مدرسه ابتدایی، کلاس‌ها و حیاط", 0, walls, openings, obstacles, 3.8)]);
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
    partition("clinic-south-east", 7, 2, 7, 12, 3.6)
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
    ...presetObstacles("clinic-reception", [
      ["reception-desk", 0, 8], ["service-counter", 0, 10], ["queue-barrier", -4, 8],
      ["waiting-bench", -4, 5], ["waiting-bench", 4, 5], ["equipment-rack", 6, 11, 90]
    ]),
    ...presetObstacles("clinic-pharmacy", [
      ["storage-rack", 10, 6], ["storage-rack", 15, 6], ["medical-cart", 18, 10],
      ["display-fridge", 18.5, 6, 90], ["service-counter", 12, 10]
    ]),
    ...presetObstacles("clinic-exam-a", [["exam-table", -14, -7], ["medical-cart", -10, -7], ["privacy-screen", -8, -7, 90]]),
    ...presetObstacles("clinic-exam-b", [["exam-table", 0, -7], ["medical-cart", 4, -7], ["privacy-screen", 6, -7, 90]]),
    ...presetObstacles("clinic-exam-c", [["hospital-bed", 13, -7], ["medical-cart", 17, -7], ["privacy-screen", 8, -7, 90]]),
    ...presetObstacles("clinic-ambulance", [
      ["van", -14, 16, 90], ["road", -12, 14], ["bollard", -3, 14], ["light-pole", 17, 16]
    ])
  ];
  return building([floor("clinic-ground", "درمانگاه، اورژانس و داروخانه", 0, walls, openings, obstacles, 3.8)]);
}

/** A two-level boutique hotel with a chamfered lobby and a columned central corridor. */
function boutiqueHotelPlan(): BuildingPlan {
  const envelope: Vec2[] = [
    { x: -16, z: -12 }, { x: 16, z: -12 }, { x: 20, z: -8 }, { x: 20, z: 10 },
    { x: 16, z: 14 }, { x: -16, z: 14 }, { x: -20, z: 10 }, { x: -20, z: -8 }
  ];
  const ground = floor("boutique-hotel-ground", "همکف، لابی، صندوق امانات و رستوران", 0, [
    ...polygonEnvelope("boutique-hotel-ground", envelope, 4),
    partition("boutique-hotel-ground-spine", -20, -2, 20, -2, 4),
    partition("boutique-hotel-ground-north-west", -7, -12, -7, -2, 4),
    partition("boutique-hotel-ground-north-east", 7, -12, 7, -2, 4),
    partition("boutique-hotel-ground-south-west", -8, -2, -8, 14, 4),
    partition("boutique-hotel-ground-south-east", 8, -2, 8, 14, 4)
  ], [
    { ...door("boutique-hotel-main-entry", "boutique-hotel-ground-envelope-5", 0.5, 2.4), variant: "double-glass", swingDirection: "inward" },
    { ...door("boutique-hotel-kitchen-service-exit", "boutique-hotel-ground-envelope-1", 0.1, 1.2), swingDirection: "outward" },
    door("boutique-hotel-restaurant-door", "boutique-hotel-ground-spine", 0.18, 1.4),
    door("boutique-hotel-lobby-door", "boutique-hotel-ground-spine", 0.5, 1.8),
    door("boutique-hotel-safe-door", "boutique-hotel-ground-spine", 0.82, 1.2),
    door("boutique-hotel-guest-door", "boutique-hotel-ground-south-west", 0.5, 1.1),
    windowOpening("boutique-hotel-window-front-a", "boutique-hotel-ground-envelope-5", 0.2, 2.6),
    windowOpening("boutique-hotel-window-front-b", "boutique-hotel-ground-envelope-5", 0.8, 2.6),
    windowOpening("boutique-hotel-window-east", "boutique-hotel-ground-envelope-3", 0.5, 2.2),
    windowOpening("boutique-hotel-window-west", "boutique-hotel-ground-envelope-7", 0.5, 2.2)
  ], [
    ...presetObstacles("boutique-hotel-lobby", [
      ["reception-desk", 0, 7], ["lobby-sofa", -3, 10], ["lobby-sofa", 3, 10],
      ["coffee-table", 0, 10], ["luggage-cart", 5.5, 6], ["queue-barrier", 0, 4]
    ]),
    ...presetObstacles("boutique-hotel-restaurant", [
      ["dining-table", -14, -7], ["dining-table", -10, -7], ["service-counter", -10, -3.5]
    ]),
    ...tableChairs("boutique-hotel-restaurant-chairs-a", -14, -7, 0, "dining-chair"),
    ...tableChairs("boutique-hotel-restaurant-chairs-b", -10, -7, 0, "dining-chair"),
    ...presetObstacles("boutique-hotel-safe", [
      ["filing-cabinet", 18.5, -8, 90], ["equipment-rack", 18.5, -4, 90], ["office-desk", 12, -7]
    ]),
    ...[-5, 0, 5].map((x, index) => presetObstacle(`boutique-hotel-corridor-column-${index + 1}`, "structural-column", x, 0)),
    presetObstacle("boutique-hotel-ground-stairs", "stairs-straight", 12, 7, 90),
    presetObstacle("boutique-hotel-ground-elevator", "elevator", 15, 7, 90)
  ], 4);

  const first = floor("boutique-hotel-first", "طبقه اتاق‌ها و راهروی مرکزی", 1, [
    ...polygonEnvelope("boutique-hotel-first", envelope, 3.6),
    partition("boutique-hotel-first-corridor-north", -20, -2, 20, -2, 3.6),
    partition("boutique-hotel-first-corridor-south", -20, 2, 20, 2, 3.6),
    partition("boutique-hotel-first-north-west", -7, -12, -7, -2, 3.6),
    partition("boutique-hotel-first-north-east", 7, -12, 7, -2, 3.6),
    partition("boutique-hotel-first-south-west", -7, 2, -7, 14, 3.6),
    partition("boutique-hotel-first-south-east", 7, 2, 7, 14, 3.6)
  ], [
    door("boutique-hotel-first-room-a", "boutique-hotel-first-corridor-north", 0.17, 1.1),
    door("boutique-hotel-first-room-b", "boutique-hotel-first-corridor-north", 0.5, 1.1),
    door("boutique-hotel-first-room-c", "boutique-hotel-first-corridor-north", 0.83, 1.1),
    door("boutique-hotel-first-room-d", "boutique-hotel-first-corridor-south", 0.17, 1.1),
    door("boutique-hotel-first-room-e", "boutique-hotel-first-corridor-south", 0.5, 1.1),
    door("boutique-hotel-first-room-f", "boutique-hotel-first-corridor-south", 0.83, 1.1),
    windowOpening("boutique-hotel-first-window-north-a", "boutique-hotel-first-envelope-1", 0.25, 2.4),
    windowOpening("boutique-hotel-first-window-north-b", "boutique-hotel-first-envelope-1", 0.75, 2.4),
    windowOpening("boutique-hotel-first-window-south-a", "boutique-hotel-first-envelope-5", 0.25, 2.4),
    windowOpening("boutique-hotel-first-window-south-b", "boutique-hotel-first-envelope-5", 0.75, 2.4)
  ], [
    ...presetObstacles("boutique-hotel-first-rooms", [
      ["bed-double", -13, -7], ["wardrobe", -18.5, -5, 90], ["bed-single", 0, -7],
      ["nightstand", 2, -7], ["bed-double", 13, -7], ["wardrobe", 18.5, -5, 90],
      ["bed-single", -13, 8], ["nightstand", -11, 8], ["bed-double", 0, 8],
      ["wardrobe", 5.5, 10, 90]
    ]),
    ...[-5, 0, 5].map((x, index) => presetObstacle(`boutique-hotel-first-column-${index + 1}`, "structural-column", x, 0)),
    topLanding("boutique-hotel-first-landing", 12, 7, 90),
    presetObstacle("boutique-hotel-first-elevator", "elevator", 15, 7, 90)
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
    { ...door("fuel-station-shop-entry", "fuel-station-shop-envelope-5", 0.55, 1.8), variant: "double-glass", swingDirection: "inward" },
    { ...door("fuel-station-shop-service", "fuel-station-shop-envelope-1", 0.2, 1.1), swingDirection: "outward" },
    windowOpening("fuel-station-shop-window-front", "fuel-station-shop-envelope-5", 0.2, 3),
    windowOpening("fuel-station-shop-window-east", "fuel-station-shop-envelope-3", 0.5, 2),
    windowOpening("fuel-station-shop-window-west", "fuel-station-shop-envelope-7", 0.5, 2)
  ], [
    ...presetObstacles("fuel-station-shop-assets", [
      ["shelving-unit", -11, 0, 90], ["shelving-unit", -11, 5, 90], ["display-fridge", 9.5, 2, 90],
      ["checkout-counter", 4, 7], ["queue-barrier", 0, 7], ["storage-rack", 0, -4]
    ]),
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
    presetObstacle("fuel-station-service-van", "van", 19, 11, 90)
  ], 3.8);
  return building([ground]);
}

/** A compact apartment building with a service basement and a chamfered common floor. */
function courtyardApartmentPlan(): BuildingPlan {
  const basement = floor("courtyard-apartment-basement", "زیرزمین، پارکینگ، انباری و تاسیسات", -1, [
    ...rectangle("courtyard-apartment-basement-shell", -18, -12, 18, 12),
    partition("courtyard-apartment-storage-wall", -6, -12, -6, 2),
    partition("courtyard-apartment-plant-wall", 7, -12, 7, 2),
    partition("courtyard-apartment-service-spine", -18, 2, 18, 2)
  ], [
    door("courtyard-apartment-parking-gate", "courtyard-apartment-basement-shell-south", 0.5, 4.5),
    door("courtyard-apartment-storage-door", "courtyard-apartment-service-spine", 0.18, 1.2),
    door("courtyard-apartment-parking-access", "courtyard-apartment-service-spine", 0.5, 1.4),
    door("courtyard-apartment-plant-door", "courtyard-apartment-service-spine", 0.82, 1.2)
  ], [
    ...presetObstacles("courtyard-apartment-cars", [
      ["sedan", -12, 7, 90], ["suv", -5, 7, 90], ["sedan", 4, 8, 90], ["van", 12, 8, 90]
    ]),
    ...presetObstacles("courtyard-apartment-parking-tools", [
      ["parking-barrier", 0, -10], ["speed-bump", 0, -7], ["wheel-stop", -12, 10], ["wheel-stop", 11, 10]
    ]),
    ...presetObstacles("courtyard-apartment-storage", [
      ["storage-rack", -14, -6, 90], ["storage-rack", -10, -6, 90], ["crate-stack", -14, -1]
    ]),
    ...presetObstacles("courtyard-apartment-plant", [
      ["equipment-rack", 15, -7, 90], ["tool-cabinet", 10, -7, 90], ["workbench", 11, -2]
    ]),
    presetObstacle("courtyard-apartment-basement-stairs", "stairs-straight", 0, -5, 90),
    presetObstacle("courtyard-apartment-basement-elevator", "elevator", 2, -5, 90)
  ]);
  const commonOutline: Vec2[] = [
    { x: -14, z: -10 }, { x: 14, z: -10 }, { x: 18, z: -6 }, { x: 18, z: 8 },
    { x: 14, z: 12 }, { x: -14, z: 12 }, { x: -18, z: 8 }, { x: -18, z: -6 }
  ];
  const ground = floor("courtyard-apartment-ground", "همکف، لابی و مشاعات", 0, [
    ...polygonEnvelope("courtyard-apartment-ground", commonOutline),
    partition("courtyard-apartment-ground-spine", -18, 1, 18, 1),
    glassPartition("courtyard-apartment-amenity-wall", 5, 1, 5, 12)
  ], [
    { ...door("courtyard-apartment-main-entry", "courtyard-apartment-ground-envelope-5", 0.5, 2.2), variant: "double-glass", swingDirection: "inward" },
    door("courtyard-apartment-lobby-door", "courtyard-apartment-ground-spine", 0.25, 1.4),
    door("courtyard-apartment-amenity-door", "courtyard-apartment-ground-spine", 0.75, 1.3),
    windowOpening("courtyard-apartment-window-front-a", "courtyard-apartment-ground-envelope-5", 0.22, 2.4),
    windowOpening("courtyard-apartment-window-front-b", "courtyard-apartment-ground-envelope-5", 0.78, 2.4),
    windowOpening("courtyard-apartment-window-east", "courtyard-apartment-ground-envelope-3", 0.5, 2)
  ], [
    ...presetObstacles("courtyard-apartment-lobby", [
      ["reception-desk", -4, 7], ["lobby-sofa", -10, 7], ["lobby-sofa", -10, 10],
      ["coffee-table", -7, 8], ["waiting-bench", 0, 8], ["vending-machine", 3.5, 10, 90]
    ]),
    ...presetObstacles("courtyard-apartment-amenities", [
      ["rug", 11, 7], ["sofa-three", 11, 9], ["sofa-single", 15, 7, 90], ["coffee-table", 11, 7]
    ]),
    ...[-9, 0, 9].map((x, index) => presetObstacle(`courtyard-apartment-lobby-column-${index + 1}`, "structural-column", x, -3)),
    topLanding("courtyard-apartment-ground-landing", 0, -5, 90),
    presetObstacle("courtyard-apartment-ground-elevator", "elevator", 2, -5, 90),
    ...presetObstacles("courtyard-apartment-landscape", [
      ["grass", -22, 4], ["deciduous", -23, -5], ["waiting-bench", 22, 5], ["light-pole", 22, -6]
    ])
  ]);
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
    ...presetObstacles("orchard-farm-livestock", [
      ["metal-bunk", 0, -6], ["metal-bunk", 6, -6], ["metal-bunk", 0, 4], ["metal-bunk", 6, 4],
      ["fence-mesh", 3, 0, 90]
    ]),
    ...presetObstacles("orchard-farm-utilities", [
      ["equipment-rack", 22.5, 0, 90], ["tool-cabinet", 15, 0, 90], ["workbench", 17, 5]
    ]),
    ...presetObstacles("orchard-farm-access", [
      ["road", 0, 30], ["gate-sliding", 0, 36], ["guard-booth", 7, 34], ["pickup", -7, 30, 90],
      ["camera-pole", -18, 34], ["light-pole", 18, 34], ["fence-mesh", -25, 36], ["fence-wall", 25, 36]
    ]),
    ...orchardTrees,
    obstacle("orchard-farm-water-tank", "مخزن گرد آب", "pillar", 31, 2, 6, 6, 3, true)
  ];
  return building([floor("orchard-farm-ground", "انبار محصول، جایگاه دام و باغ", 0, walls, openings, obstacles, 4.4)]);
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
    ...presetObstacles("urban-roundabout-booth-assets", [
      ["equipment-rack", 24.5, 18, 90], ["office-desk", 19, 17], ["office-chair", 19, 18.2, 180], ["filing-cabinet", 15.5, 18, 90]
    ]),
    ...presetObstacles("urban-roundabout-traffic", [
      ["sedan", 0, -21], ["suv", 21, 0, 90], ["van", 0, 21], ["pickup", -21, 0, 90]
    ])
  ], 3.4);
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
      ["sedan", -18, -8], ["suv", -4, 8], ["van", 10, -8], ["truck", 20, 8],
      ["speed-bump", 27, -12], ["bollard", 12, 12], ["bollard", 12, 18]
    ]),
    ...presetObstacles("highway-monitoring", [
      ["camera-pole", -27, -13], ["camera-pole", 27, 13], ["light-pole", -27, 13], ["light-pole", 27, -13]
    ]),
    obstacle("highway-vms-gantry", "تابلو متغیر پیام", "block", 0, -14, 12, 0.7, 4.5, true),
    obstacle("highway-emergency-bay", "توقفگاه اضطراری", "surface", -22, 18, 10, 5, 0.08, false),
    ...presetObstacles("highway-control-assets", [
      ["equipment-rack", 27.5, 17, 90], ["office-desk", 21, 16], ["office-chair", 21, 17.2, 180], ["filing-cabinet", 17.5, 17, 90]
    ])
  ], 3.6);
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
      ["office-desk", -21, -6], ["office-chair", -21, -4.8, 180], ["meeting-table", -15, -5],
      ["filing-cabinet", -26.5, -3, 90], ["equipment-rack", -9.5, -4, 90]
    ]),
    ...tableChairs("construction-office-chairs", -15, -5),
    ...presetObstacles("construction-tool-assets", [
      ["storage-rack", 25.5, -8, 90], ["storage-rack", 20, -8, 90], ["tool-cabinet", 13.5, -8, 90],
      ["crate-stack", 16, -2], ["pallet-stack", 22, -2], ["workbench", 19, 0]
    ]),
    ...presetObstacles("construction-material-yard", [
      ["pallet-stack", -20, 14], ["pallet-stack", -14, 14], ["crate-stack", -8, 14],
      ["loading-platform", -14, 21], ["truck", 20, 18, 90], ["pickup", 10, 20, 90]
    ]),
    ...presetObstacles("construction-vehicle-route", [
      ["road", 0, 25, 90], ["road", 6, 18, 45], ["road", 16, 18]
    ]),
    ...presetObstacles("construction-site-security", [
      ["gate-sliding", 0, 31], ["guard-booth", 7, 29], ["camera-pole", -29, 27], ["camera-pole", 29, 27],
      ["light-pole", -29, -20], ["light-pole", 29, -20], ["fence-mesh", -20, 31], ["fence-wall", 20, 31]
    ]),
    obstacle("construction-crane-mast", "دکل جرثقیل", "pillar", 0, 7, 2.2, 2.2, 18, true),
    obstacle("construction-crane-jib", "بازوی جرثقیل", "block", 7, 7, 16, 0.6, 0.6, true),
    obstacle("construction-foundation", "گود و فونداسیون", "surface", 2, -10, 18, 12, 0.12, false),
    ...[-6, 0, 6].map((x, index) => presetObstacle(`construction-foundation-column-${index + 1}`, "structural-column", x, -10))
  ];
  return building([floor("construction-site-ground", "کارگاه فعال، دفتر و دپوی مصالح", 0, walls, openings, obstacles, 4)]);
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
    presetObstacle("conference-stage-screen", "whiteboard", -5, -13, 0),
    obstacle("conference-podium", "تریبون سخنران", "counter", -5, -8, 1.2, 0.8, 1.2, false),
    ...gridPresets("conference-seating", ["gym-bleacher"], [-15, -5, 5, 15], [0, 5]),
    ...presetObstacles("conference-registration", [
      ["reception-desk", -7, 14], ["service-counter", 0, 14], ["queue-barrier", -7, 11.5],
      ["waiting-bench", 8, 14], ["vending-machine", 18, 14, 90]
    ]),
    ...presetObstacles("conference-av-assets", [
      ["equipment-rack", 20, -11, 90], ["office-desk", 16, -10], ["office-chair", 16, -8.8, 180], ["filing-cabinet", 13.5, -10, 90]
    ]),
    ...[-18, 18].map((x, index) => presetObstacle(`conference-hall-column-${index + 1}`, "structural-column", x, 8))
  ], 5.2);
  return building([ground]);
}

/** A glazed chamfered showroom with sales offices, parts store and delivery yard. */
function carShowroomPlan(): BuildingPlan {
  const outline: Vec2[] = [
    { x: -20, z: -13 }, { x: 15, z: -13 }, { x: 22, z: -6 }, { x: 22, z: 11 },
    { x: 17, z: 16 }, { x: -20, z: 16 }, { x: -25, z: 11 }, { x: -25, z: -8 }
  ];
  const ground = floor("car-showroom-ground", "شوروم، فروش، قطعات و تحویل خودرو", 0, [
    ...polygonEnvelope("car-showroom", outline, 4.5),
    glassPartition("car-showroom-sales-wall", -7, -13, -7, 16, 4.5),
    partition("car-showroom-parts-wall", -25, 6, -7, 6, 4.5)
  ], [
    { ...door("car-showroom-main-entry", "car-showroom-envelope-5", 0.65, 2.4), variant: "double-glass", swingDirection: "inward" },
    door("car-showroom-vehicle-delivery", "car-showroom-envelope-1", 0.65, 4),
    door("car-showroom-sales-door", "car-showroom-sales-wall", 0.25, 1.2),
    door("car-showroom-parts-door", "car-showroom-sales-wall", 0.72, 1.2),
    door("car-showroom-staff-parts-door", "car-showroom-parts-wall", 0.5, 1.2),
    { ...door("car-showroom-parts-service-exit", "car-showroom-envelope-7", 0.15, 1.4), swingDirection: "outward" },
    windowOpening("car-showroom-window-front-a", "car-showroom-envelope-5", 0.2, 3.2),
    windowOpening("car-showroom-window-front-b", "car-showroom-envelope-5", 0.85, 3.2),
    windowOpening("car-showroom-window-east", "car-showroom-envelope-3", 0.5, 3)
  ], [
    ...presetObstacles("car-showroom-display", [
      ["sedan", 2, -7, 35], ["suv", 12, -7, -25], ["pickup", 3, 2, 20], ["sedan", 14, 5, -35],
      ["display-stand", 8, 12], ["waiting-bench", 18, 12]
    ]),
    ...presetObstacles("car-showroom-sales", [
      ["reception-desk", -15, -8], ["office-desk", -18, -2], ["office-chair", -18, -0.8, 180],
      ["office-desk", -11, -2], ["office-chair", -11, -0.8, 180], ["filing-cabinet", -23.5, -3, 90]
    ]),
    ...presetObstacles("car-showroom-parts", [
      ["storage-rack", -19, 12.5, 90], ["storage-rack", -17, 9, 90], ["storage-rack", -12, 9, 90],
      ["crate-stack", -17, 14], ["packing-table", -10, 14]
    ]),
    ...presetObstacles("car-showroom-yard", [
      ["sedan", -18, 25, 90], ["suv", -10, 25, 90], ["van", 0, 25, 90], ["pickup", 10, 25, 90],
      ["parking-barrier", 20, 26], ["light-pole", -24, 25], ["camera-pole", 24, 25]
    ]),
    obstacle("car-showroom-delivery-pad", "محل تحویل خودرو", "surface", 18, -19, 10, 6, 0.08, false)
  ], 4.8);
  return building([ground]);
}

/** A neighbourhood bus terminal with a curved ticket hall, platform and two bus bays. */
function busTerminalPlan(): BuildingPlan {
  const ticketOutline: Vec2[] = [
    { x: -18, z: -7 }, { x: 4, z: -7 }, { x: 8, z: -3 }, { x: 8, z: 8 },
    { x: 4, z: 12 }, { x: -18, z: 12 }, { x: -22, z: 8 }, { x: -22, z: -3 }
  ];
  const buses = [
    obstacle("bus-terminal-bus-a", "اتوبوس شهری", "vehicle", 18, -10, 3, 11, 3.3, true),
    obstacle("bus-terminal-bus-b", "اتوبوس شهری", "vehicle", 18, 8, 3, 11, 3.3, true)
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
      ["waiting-bench", -15, 5], ["waiting-bench", -7, 5], ["equipment-rack", 6.5, 6, 90]
    ]),
    ...buses,
    ...presetObstacles("bus-terminal-platform", [
      ["waiting-bench", 3, 18], ["waiting-bench", 10, 18], ["waiting-bench", 17, 18],
      ["waiting-bench", 24, 18], ["road", 18, -24, 90], ["road", 18, -12, 90], ["road", 18, 0, 90],
      ["road", 18, 12, 90], ["road", 18, 24, 90],
      ["bollard", 6, 14], ["bollard", 12, 14], ["bollard", 18, 14], ["bollard", 24, 14]
    ]),
    ...presetObstacles("bus-terminal-security", [
      ["camera-pole", -27, 17], ["camera-pole", 29, 17], ["light-pole", -27, -14], ["light-pole", 29, -14],
      ["guard-booth", 28, -20], ["parking-barrier", 22, -24]
    ]),
    obstacle("bus-terminal-shelter", "سایبان منحنی انتظار", "surface", 14, 18, 28, 5, 0.15, false),
    ...[-1, 6, 13, 20, 27].map((x, index) => presetObstacle(`bus-terminal-shelter-column-${index + 1}`, "structural-column", x, 18))
  ], 4);
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
    door("city-bus-passenger-door", "city-bus-cabin-envelope-3", 0.55, 1.4),
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
      ["camera-pole", -29, 25], ["camera-pole", 29, 25], ["light-pole", 0, 25]
    ]),
    obstacle("city-bus-wash-bay", "جایگاه شست‌وشوی ناوگان", "surface", -24, 16, 7, 13, 0.1, false)
  ], 3.4);
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
    ...gridPresets("security-control-operator-desks", ["office-desk"], [-11, -4, 3], [0]),
    ...gridPresets("security-control-operator-chairs", ["office-chair"], [-11, -4, 3], [1.2], 180),
    ...presetObstacles("security-control-video-assets", [
      ["whiteboard", -12, -9], ["whiteboard", -4, -9], ["whiteboard", 4, -9],
      ["meeting-table", -4, -6], ["filing-cabinet", -16.5, -7, 90]
    ]),
    ...presetObstacles("security-control-power-assets", [
      ["equipment-rack", 16.5, -7, 90], ["equipment-rack", 13, -7, 90],
      ["tool-cabinet", 16.5, 0, 90], ["workbench", 13.5, 3]
    ]),
    ...presetObstacles("security-control-entry", [
      ["reception-desk", -5, 8], ["queue-barrier", -5, 6], ["waiting-bench", 4, 8]
    ])
  ], 3.8);
  return building([ground]);
}

/** An urban electrical substation with two indoor rooms and an open transformer yard. */
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
    ...gridPresets("urban-substation-switchgear-assets", ["equipment-rack"], [-21, -16, -11, -7], [-5, 2], 90),
    ...presetObstacles("urban-substation-relay-assets", [
      ["equipment-rack", 23.5, -3, 90], ["office-desk", 14, -3], ["office-chair", 14, -1.8, 180],
      ["filing-cabinet", 8.5, 2, 90], ["tool-cabinet", 21, 5, 90]
    ]),
    obstacle("urban-substation-transformer-a", "ترانسفورماتور یک", "equipment", -10, 20, 6, 5, 4.5, true),
    obstacle("urban-substation-transformer-b", "ترانسفورماتور دو", "equipment", 5, 20, 6, 5, 4.5, true),
    ...presetObstacles("urban-substation-yard", [
      ["gate-sliding", 20, 31], ["guard-booth", 27, 28], ["road", -2, 28], ["road", 10, 28], ["road", 22, 28],
      ["road", 20, 27, 90],
      ["camera-pole", -28, 27], ["camera-pole", 28, 27], ["light-pole", -28, -16], ["light-pole", 28, -16],
      ["fence-mesh", -20, 31], ["fence-wall", 0, 31]
    ]),
    ...[-18, -2, 14].map((x, index) => presetObstacle(`urban-substation-bus-column-${index + 1}`, "structural-column", x, 12))
  ], 4.2);
  return building([ground]);
}

/** A regional distribution warehouse with long rack aisles, office and external dock. */
function regionalWarehousePlan(): BuildingPlan {
  const ground = floor("regional-warehouse-ground", "انبار منطقه‌ای، بارانداز و کنترل موجودی", 0, [
    ...rectangle("regional-warehouse-shell", -28, -16, 28, 16, 6),
    partition("regional-warehouse-office-wall", -28, 6, 28, 6, 4),
    partition("regional-warehouse-office-split", 12, 6, 12, 16, 4)
  ], [
    door("regional-warehouse-vehicle-gate", "regional-warehouse-shell-south", 0.5, 5),
    door("regional-warehouse-office-door", "regional-warehouse-office-wall", 0.78, 1.3),
    door("regional-warehouse-dock-door-a", "regional-warehouse-shell-north", 0.25, 4),
    door("regional-warehouse-dock-door-b", "regional-warehouse-shell-north", 0.72, 4),
    windowOpening("regional-warehouse-office-window", "regional-warehouse-shell-east", 0.22, 2.4),
    windowOpening("regional-warehouse-vent", "regional-warehouse-shell-west", 0.35, 2)
  ], [
    ...gridPresets("regional-warehouse-racks", ["storage-rack"], [-22, -14, -6, 2, 10, 18], [-10, -3], 90),
    ...presetObstacles("regional-warehouse-packing", [
      ["pallet-stack", -22, 3], ["pallet-stack", -15, 3], ["crate-stack", -8, 3],
      ["packing-table", 1, 3], ["packing-table", 8, 3], ["loading-platform", -14, 15], ["loading-platform", 10, 15]
    ]),
    ...presetObstacles("regional-warehouse-office", [
      ["office-desk", 17, 10], ["office-chair", 17, 11.2, 180], ["office-desk", 23, 10],
      ["office-chair", 23, 11.2, 180], ["filing-cabinet", 26.5, 14, 90], ["equipment-rack", 13.5, 14, 90]
    ]),
    ...presetObstacles("regional-warehouse-yard", [
      ["truck", -14, -25, 90], ["truck", 10, -25, 90], ["van", 22, -29, 90],
      ["parking-barrier", 24, -22], ["guard-booth", 18, -21], ["camera-pole", -27, 25], ["camera-pole", 27, 25]
    ])
  ], 6.2);
  return building([ground]);
}

/** A light three-level mall; the two very large reference malls remain untouched. */
function neighbourhoodMallPlan(): BuildingPlan {
  const basement = floor("neighbourhood-mall-basement", "زیرزمین، پارکینگ و ورودی خودرو", -1, [
    ...rectangle("neighbourhood-mall-basement-shell", -22, -15, 22, 15, 3.2)
  ], [
    door("neighbourhood-mall-parking-gate", "neighbourhood-mall-basement-shell-south", 0.5, 5),
  ], [
    ...gridPresets("neighbourhood-mall-parking-cars", ["sedan", "suv"], [-16, -8, 0, 8], [-8, 7], 90),
    ...presetObstacles("neighbourhood-mall-parking-assets", [
      ["parking-barrier", 0, -13], ["speed-bump", 0, -10], ["guard-booth", -18, -11],
      ["bollard", -3, -13], ["bollard", 3, -13], ["equipment-rack", 20.5, 12, 90]
    ]),
    presetObstacle("neighbourhood-mall-basement-stairs", "stairs-straight", 12, 10, 90),
    presetObstacle("neighbourhood-mall-basement-elevator", "elevator", 15, 10, 90)
  ], 3.4);
  const groundOutline: Vec2[] = [
    { x: -20, z: -13 }, { x: 20, z: -13 }, { x: 24, z: -9 }, { x: 24, z: 13 },
    { x: 20, z: 17 }, { x: -20, z: 17 }, { x: -24, z: 13 }, { x: -24, z: -9 }
  ];
  const ground = floor("neighbourhood-mall-ground", "همکف، ورودی، گالری و اتاق کنترل", 0, [
    ...polygonEnvelope("neighbourhood-mall-ground", groundOutline, 4.5),
    glassPartition("neighbourhood-mall-control-wall", -10, -13, -10, 17, 4.5),
    glassPartition("neighbourhood-mall-entry-wall", -24, 8, -10, 8, 4.5)
  ], [
    { ...door("neighbourhood-mall-main-entry", "neighbourhood-mall-ground-envelope-5", 0.5, 3), variant: "double-glass", swingDirection: "inward" },
    door("neighbourhood-mall-control-door", "neighbourhood-mall-control-wall", 0.28, 1.2),
    door("neighbourhood-mall-concourse-door", "neighbourhood-mall-entry-wall", 0.5, 1.8),
    windowOpening("neighbourhood-mall-ground-window-a", "neighbourhood-mall-ground-envelope-5", 0.2, 3),
    windowOpening("neighbourhood-mall-ground-window-b", "neighbourhood-mall-ground-envelope-5", 0.8, 3)
  ], [
    ...presetObstacles("neighbourhood-mall-entry-assets", [
      ["reception-desk", -17, 12], ["queue-barrier", -21, 11], ["waiting-bench", -12, 12]
    ]),
    ...presetObstacles("neighbourhood-mall-control-assets", [
      ["equipment-rack", -22.5, -7, 90], ["office-desk", -16, -7], ["office-chair", -16, -5.8, 180],
      ["filing-cabinet", -11.5, -7, 90]
    ]),
    ...presetObstacles("neighbourhood-mall-concourse-assets", [
      ["display-stand", 0, -7], ["display-stand", 8, -7], ["display-stand", 16, -7],
      ["clothing-rack", 0, 4, 90], ["clothing-rack", 8, 4, 90], ["clothing-rack", 16, 4, 90],
      ["checkout-counter", 18, 12], ["waiting-bench", 5, 12]
    ]),
    presetObstacle("neighbourhood-mall-ground-stairs", "stairs-straight", 12, 10, 90),
    presetObstacle("neighbourhood-mall-ground-elevator", "elevator", 15, 10, 90),
    presetObstacle("neighbourhood-mall-ground-escalator", "escalator", 9, 10, 90)
  ], 4.6);
  const first = floor("neighbourhood-mall-first", "طبقه اول، فودکورت و هسته دسترسی", 1, [
    ...rectangle("neighbourhood-mall-first-shell", -20, -13, 20, 13, 4.2),
    glassPartition("neighbourhood-mall-first-core-wall", 7, -13, 7, 13, 4.2)
  ], [
    door("neighbourhood-mall-food-door", "neighbourhood-mall-first-core-wall", 0.25, 1.5),
    door("neighbourhood-mall-core-door", "neighbourhood-mall-first-core-wall", 0.75, 1.3),
    windowOpening("neighbourhood-mall-first-window-a", "neighbourhood-mall-first-shell-north", 0.25, 3),
    windowOpening("neighbourhood-mall-first-window-b", "neighbourhood-mall-first-shell-north", 0.75, 3)
  ], [
    ...gridPresets("neighbourhood-mall-food-tables", ["dining-table"], [-14, -6, 2], [-7, 4]),
    ...presetObstacles("neighbourhood-mall-food-assets", [
      ["service-counter", -14, 10], ["service-counter", -6, 10], ["service-counter", 2, 10],
      ["display-fridge", 5.5, 9, 90], ["vending-machine", 5.5, -9, 90]
    ]),
    topLanding("neighbourhood-mall-first-landing", 12, 10, 90),
    presetObstacle("neighbourhood-mall-first-elevator", "elevator", 15, 10, 90),
    presetObstacle("neighbourhood-mall-first-escalator", "escalator", 9, 10, 90)
  ], 4.4);
  return stackBuilding([basement, ground, first], ground.id);
}

/** A linear pipeline site with visible pipe run, valve yard and compact pumping room. */
function pipelineMonitoringStationPlan(): BuildingPlan {
  const pumpOutline: Vec2[] = [
    { x: 15, z: -8 }, { x: 27, z: -8 }, { x: 30, z: -5 }, { x: 30, z: 7 },
    { x: 27, z: 10 }, { x: 15, z: 10 }, { x: 12, z: 7 }, { x: 12, z: -5 }
  ];
  const pipeSegments = Array.from({ length: 9 }, (_, index) =>
    obstacle(`pipeline-route-segment-${index + 1}`, "مسیر خط لوله", "block", -32 + index * 8, 18, 8.1, 0.7, 1.1, true)
  );
  const ground = floor("pipeline-monitoring-ground", "خط لوله، شیرآلات و ایستگاه پمپاژ", 0, [
    ...polygonEnvelope("pipeline-pump-room", pumpOutline, 4)
  ], [
    door("pipeline-pump-entry", "pipeline-pump-room-envelope-5", 0.5, 1.5),
    windowOpening("pipeline-pump-window-a", "pipeline-pump-room-envelope-1", 0.5, 2.2),
    windowOpening("pipeline-pump-window-b", "pipeline-pump-room-envelope-3", 0.5, 1.8)
  ], [
    ...pipeSegments,
    ...presetObstacles("pipeline-pump-assets", [
      ["equipment-rack", 28.5, -2, 90], ["workbench", 20, -3], ["tool-cabinet", 13.5, 2, 90],
      ["office-desk", 20, 6], ["office-chair", 20, 7.2, 180]
    ]),
    ...[-22, -8, 6].flatMap((x, index) => [
      obstacle(`pipeline-valve-${index + 1}`, "مجموعه شیر خط", "equipment", x, 12, 2.5, 2.5, 2.2, true),
      presetObstacle(`pipeline-valve-column-${index + 1}`, "structural-column", x, 16)
    ]),
    ...presetObstacles("pipeline-site-access", [
      ["road", 8, 24], ["road", 20, 24], ["road", 32, 24], ["road", 28, 16, 90], ["road", 28, 28, 90],
      ["gate-sliding", 28, 29], ["guard-booth", 34, 27],
      ["pickup", 14, 24, 90], ["camera-pole", -34, 25], ["camera-pole", 34, 25], ["light-pole", 0, 25]
    ]),
    obstacle("pipeline-leak-monitor", "نقطه پایش نشتی", "pillar", 0, 20, 1.2, 1.2, 2.4, true)
  ], 4.2);
  return building([ground]);
}

/** A transmission right-of-way with five lattice towers and a step-down service room. */
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
    ...presetObstacles("transmission-service-assets", [
      ["equipment-rack", 30.5, 1, 90], ["equipment-rack", 27, 1, 90], ["tool-cabinet", 16.5, 1, 90],
      ["workbench", 21, 6], ["office-desk", 21, -3]
    ]),
    ...gridPresets("transmission-access-road", ["road"], [-30, -18, -6, 6, 18, 30], [28]),
    ...presetObstacles("transmission-security", [
      ["gate-sliding", 31, 28], ["guard-booth", 25, 27], ["pickup", 12, 28, 90],
      ["camera-pole", -33, 25], ["camera-pole", 33, 25], ["light-pole", 0, 27]
    ]),
    obstacle("transmission-transformer", "ترانس کاهنده", "equipment", 7, 3, 6, 5, 4.5, true)
  ], 4);
  return building([ground]);
}

/** A small onshore oil pad with control room, wellheads, tanks and a flare. */
function onshoreOilFieldPlan(): BuildingPlan {
  const controlOutline: Vec2[] = [
    { x: -27, z: -9 }, { x: -13, z: -9 }, { x: -10, z: -6 }, { x: -10, z: 6 },
    { x: -13, z: 9 }, { x: -27, z: 9 }, { x: -30, z: 6 }, { x: -30, z: -6 }
  ];
  const roundTank = (id: string, x: number, z: number) => ({
    ...presetObstacle(id, "structural-column", x, z),
    label: "مخزن ذخیره نفت",
    widthM: 7,
    depthM: 7,
    heightM: 5,
    blocksView: true
  });
  const ground = floor("onshore-oil-ground", "میدان نفتی خشکی و اتاق کنترل", 0, [
    ...polygonEnvelope("onshore-control-room", controlOutline, 4)
  ], [
    door("onshore-control-entry", "onshore-control-room-envelope-5", 0.5, 1.4),
    windowOpening("onshore-control-window-a", "onshore-control-room-envelope-1", 0.5, 2.2),
    windowOpening("onshore-control-window-b", "onshore-control-room-envelope-3", 0.5, 1.8)
  ], [
    ...presetObstacles("onshore-control-assets", [
      ["equipment-rack", -11.5, 1, 90], ["office-desk", -23, -3], ["office-chair", -23, -1.8, 180],
      ["meeting-table", -17, 4], ["filing-cabinet", -28.5, 2, 90]
    ]),
    roundTank("onshore-tank-a", 12, -4),
    roundTank("onshore-tank-b", 23, -4),
    ...[-2, 8, 18].map((x, index) => obstacle(`onshore-wellhead-${index + 1}`, "سرچاه", "equipment", x, 14, 3, 3, 3.5, true)),
    obstacle("onshore-flare-mast", "مشعل فلر", "pillar", 30, 18, 1.5, 1.5, 14, true),
    ...presetObstacles("onshore-access", [
      ["road", 0, 28], ["road", 12, 28], ["road", 24, 28], ["road", 25, 26, 90],
      ["gate-sliding", 25, 32], ["guard-booth", 31, 30], ["truck", 12, 28, 90],
      ["camera-pole", -33, 27], ["camera-pole", 33, 27], ["light-pole", -12, 27], ["light-pole", 12, 27]
    ]),
    ...presetObstacles("onshore-perimeter", [
      ["fence-mesh", -30, 33], ["fence-wall", -20, 33], ["fence-mesh", -10, 33], ["fence-wall", 0, 33],
      ["fence-mesh", 10, 33], ["fence-wall", 18, 33], ["fence-mesh", 32.5, 33]
    ])
  ], 4.2);
  return building([ground]);
}

/** A compact offshore deck with a circular helipad, control module and lifeboats. */
function offshorePlatformPlan(): BuildingPlan {
  const controlOutline: Vec2[] = [
    { x: -12, z: -8 }, { x: 4, z: -8 }, { x: 7, z: -5 }, { x: 7, z: 6 },
    { x: 4, z: 9 }, { x: -12, z: 9 }, { x: -15, z: 6 }, { x: -15, z: -5 }
  ];
  const helipad = {
    ...presetObstacle("offshore-helipad", "structural-column", 21, -2),
    label: "هلی‌پد دایره‌ای",
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
    ...presetObstacles("offshore-control-assets", [
      ["equipment-rack", 5.5, 1, 90], ["office-desk", -8, -3], ["office-chair", -8, -1.8, 180],
      ["meeting-table", -3, 5], ["filing-cabinet", -13.5, 2, 90]
    ]),
    obstacle("offshore-lifeboat-a", "قایق نجات", "vehicle", -24, 17, 3, 8, 2.5, true, 90),
    obstacle("offshore-lifeboat-b", "قایق نجات", "vehicle", 25, 17, 3, 8, 2.5, true, 90),
    ...[-10, 0, 10].map((x, index) => obstacle(`offshore-riser-${index + 1}`, "رایزر دریایی", "pillar", x, 22, 1.4, 1.4, 6, true)),
    ...presetObstacles("offshore-deck-assets", [
      ["camera-pole", -28, -9], ["camera-pole", 28, 20], ["light-pole", -28, 20], ["light-pole", 28, -9],
      ["bollard", 12, -10], ["bollard", 12, 6], ["tool-cabinet", 0, 20, 90]
    ])
  ], 4.2);
  return building([ground]);
}

/** A medium solar farm with tilted panel rows, inverter cabin and a small substation. */
function solarGenerationFarmPlan(): BuildingPlan {
  const inverterOutline: Vec2[] = [
    { x: 18, z: -9 }, { x: 29, z: -9 }, { x: 32, z: -6 }, { x: 32, z: 5 },
    { x: 29, z: 8 }, { x: 18, z: 8 }, { x: 15, z: 5 }, { x: 15, z: -6 }
  ];
  const panels = [-24, -12, 0, 12].flatMap((z, row) =>
    [-32, -23, -14, -5, 4].map((x, column) =>
      obstacle(`solar-panel-${row + 1}-${column + 1}`, "پنل خورشیدی", "surface", x, z, 8, 3.4, 0.18, false, -12)
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
    ...presetObstacles("solar-inverter-assets", [
      ["equipment-rack", 30.5, 0, 90], ["equipment-rack", 27, 0, 90], ["tool-cabinet", 16.5, 0, 90],
      ["workbench", 21, 5], ["office-desk", 21, -4]
    ]),
    obstacle("solar-transformer-a", "ترانس تبدیل", "equipment", 26, 16, 5, 4, 4, true),
    obstacle("solar-transformer-b", "تابلو پست خورشیدی", "equipment", 17, 16, 4, 3, 3.5, true),
    ...presetObstacles("solar-farm-security", [
      ["road", 0, 29], ["road", 12, 29], ["road", 24, 29], ["road", 27, 27, 90],
      ["gate-sliding", 27, 33], ["guard-booth", 33, 31], ["pickup", 12, 29, 90],
      ["camera-pole", -34, 28], ["camera-pole", 34, 28], ["light-pole", 0, 30],
      ["fence-mesh", -25, 34], ["fence-wall", -8, 34], ["fence-mesh", 9, 34]
    ])
  ], 3.8);
  return building([ground]);
}

/** A compact hydroelectric site with a readable dam, spillway, turbine hall and control room. */
function hydroelectricPowerStationPlan(): BuildingPlan {
  const ground = floor("hydro-plant-ground", "سد، توربین‌خانه و اتاق کنترل", 0, [
    ...rectangle("hydro-powerhouse", -31, -12, -3, 10, 6),
    partition("hydro-control-split", -15, -12, -15, 10, 4)
  ], [
    door("hydro-turbine-entry", "hydro-powerhouse-south", 0.75, 2.4),
    door("hydro-control-entry", "hydro-control-split", 0.55, 1.3),
    windowOpening("hydro-control-window", "hydro-powerhouse-north", 0.78, 3),
    windowOpening("hydro-turbine-window", "hydro-powerhouse-west", 0.5, 2.6)
  ], [
    obstacle("hydro-dam-body", "بدنه سد", "block", 10, 12, 54, 4, 12, true),
    obstacle("hydro-spillway", "سرریز سد", "surface", 10, 9.5, 12, 5, 0.18, false),
    obstacle("hydro-upstream-water", "مخزن بالادست", "surface", 10, 24, 56, 18, 0.05, false),
    obstacle("hydro-tailrace", "کانال خروجی آب", "surface", 10, -15, 18, 28, 0.05, false),
    ...[-27, -22, -17].map((x, index) => obstacle(`hydro-generator-${index + 1}`, "واحد توربین و ژنراتور", "equipment", x, -2, 4, 5, 4.2, true)),
    ...presetObstacles("hydro-control-assets", [
      ["equipment-rack", -4.5, -7, 90], ["equipment-rack", -4.5, -3, 90],
      ["office-desk", -10, -5], ["office-chair", -10, -3.8, 180], ["meeting-table", -9, 5]
    ]),
    ...presetObstacles("hydro-security", [
      ["road", -30, 18], ["road", -18, 18], ["road", -30, 12, 90], ["road", -23, 19, 90],
      ["gate-sliding", -23, 21], ["guard-booth", -29, 20],
      ["camera-pole", -31, 16], ["camera-pole", 35, 17], ["light-pole", -1, 18], ["pickup", -12, 18, 90]
    ])
  ], 6.2);
  return building([ground]);
}

/** A small safe-city district mixing a circular civic plaza, park, transit stop and command post. */
function safeCityDistrictPlan(): BuildingPlan {
  const plaza = {
    ...presetObstacle("safe-city-plaza", "structural-column", -5, 1),
    label: "میدان و پلازای شهری",
    widthM: 20,
    depthM: 20,
    heightM: 0.08,
    blocksView: false
  };
  const ground = floor("safe-city-ground", "میدان شهری، بوستان و مرکز پایش", 0, [
    ...rectangle("safe-city-command", 20, -12, 35, 8, 4),
    glassPartition("safe-city-command-split", 27, -12, 27, 8, 4)
  ], [
    { ...door("safe-city-command-entry", "safe-city-command-south", 0.35, 1.6), variant: "double-glass", swingDirection: "inward" },
    door("safe-city-operations-door", "safe-city-command-split", 0.5, 1.2),
    windowOpening("safe-city-command-window", "safe-city-command-west", 0.5, 3)
  ], [
    plaza,
    obstacle("safe-city-main-road", "خیابان اصلی", "surface", -5, -15, 68, 7, 0.03, false),
    obstacle("safe-city-cross-road", "بلوار متقاطع", "surface", -18, 1, 7, 48, 0.03, false),
    ...presetObstacles("safe-city-park", [
      ["grass", 7, 19], ["grass", 17, 19], ["deciduous", 3, 17], ["deciduous", 12, 21],
      ["waiting-bench", 7, 15], ["waiting-bench", 17, 15], ["light-pole", 2, 23], ["light-pole", 21, 23]
    ]),
    ...presetObstacles("safe-city-transit", [
      ["waiting-bench", -30, -10], ["waiting-bench", -25, -10], ["queue-barrier", -27.5, -7],
      ["camera-pole", -34, -8], ["light-pole", -21, -8]
    ]),
    obstacle("safe-city-transit-bus", "اتوبوس شهری", "vehicle", -27, -16, 11, 2.6, 3.2, true, 90),
    ...presetObstacles("safe-city-command-assets", [
      ["equipment-rack", 33.5, -7, 90], ["equipment-rack", 33.5, -3, 90],
      ["office-desk", 29, -5], ["office-chair", 29, -3.8, 180], ["meeting-table", 24, 3],
      ["reception-desk", 22, -8], ["queue-barrier", 22, -5]
    ]),
    ...[-10, 0, 10].map((x, index) => presetObstacle(`safe-city-plaza-light-${index + 1}`, "light-pole", x, 10))
  ], 4.2);
  return building([ground]);
}

/** A compact stadium with an open playing field, four stands, ticketing and spectator parking. */
function urbanSportsComplexPlan(): BuildingPlan {
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
    ...gridPresets("sports-north-stands", ["gym-bleacher"], [-25, -13, -1, 11], [22]),
    ...gridPresets("sports-south-stands", ["gym-bleacher"], [-25, -13, -1, 11], [-12]),
    ...[-3, 7, 17].map((z, index) => presetObstacle(`sports-east-stand-${index + 1}`, "gym-bleacher", 18, z, 90)),
    ...presetObstacles("sports-ticket-assets", [
      ["service-counter", 26, -12], ["service-counter", 32, -12], ["queue-barrier", 26, -7],
      ["queue-barrier", 32, -7], ["equipment-rack", 34.5, -5, 90]
    ]),
    ...presetObstacles("sports-gates", [
      ["gate-sliding", -31, -16], ["guard-booth", -35, -12], ["parking-barrier", 42, 23],
      ["camera-pole", -34, 20], ["camera-pole", 24, 20], ["camera-pole", -34, -8], ["light-pole", 16, 21]
    ]),
    ...gridPresets("sports-parking", ["sedan", "suv"], [24, 30, 36], [16, 23], 90)
  ], 3.6);
  return building([ground]);
}

/** A compact but complete data centre with hot aisles, power, cooling and secure receiving. */
function compactDataCentrePlan(): BuildingPlan {
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
    door("data-centre-loading-door", "data-centre-shell-south", 0.16, 3),
    windowOpening("data-centre-control-window", "data-centre-mantrap", 0.22, 1.6)
  ], [
    ...gridPresets("data-centre-racks", ["equipment-rack"], [-13, -7, -1, 5, 11, 17, 23], [-10, -3], 90),
    ...presetObstacles("data-centre-power", [
      ["equipment-rack", -24, 11, 90], ["equipment-rack", -20, 11, 90], ["equipment-rack", -16, 11, 90],
      ["ups-unit", -12, 11, 90], ["tool-cabinet", -11, 14, 90]
    ]),
    ...presetObstacles("data-centre-control", [
      ["monitoring-console", -24, -3, 90], ["nvr-cabinet", -18.5, -10, 90],
      ["network-switch", -17.5, -10, 90]
    ]),
    ...presetObstacles("data-centre-cooling", [
      ["cnc-machine", 1, 12], ["cnc-machine", 6, 12], ["workbench", 1, 8.8]
    ]),
    ...presetObstacles("data-centre-loading", [
      ["loading-platform", 19, 13], ["packing-table", 13, 10], ["crate-stack", 25, 10]
    ]),
    ...presetObstacles("data-centre-access", [
      ["reception-desk", -24, -10], ["queue-barrier", -24, -6], ["guard-booth", -33, -12],
      ["parking-barrier", -32, -16], ["camera-pole", -34, 15], ["camera-pole", 34, 15]
    ])
  ], 5);
  return building([ground]);
}

/** A regional terminal where security, check-in, baggage and apron remain visually distinct. */
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
    door("airport-security-gate", "airport-security-line", 0.45, 2),
    door("airport-transit-door", "airport-transit-line", 0.5, 2),
    door("airport-baggage-door", "airport-baggage-line", 0.55, 2),
    door("airport-apron-exit", "airport-terminal-envelope-1", 0.1, 2),
    windowOpening("airport-front-window-a", "airport-terminal-envelope-5", 0.22, 4),
    windowOpening("airport-front-window-b", "airport-terminal-envelope-5", 0.78, 4)
  ], [
    ...gridPresets("airport-checkin", ["service-counter"], [-12, -5, 2], [10]),
    ...gridPresets("airport-waiting", ["waiting-bench"], [-13, -5, 3], [-8, -2]),
    ...presetObstacles("airport-security", [
      ["queue-barrier", -27, -7], ["queue-barrier", -27, -2], ["equipment-rack", -21.5, 12, 90]
    ]),
    ...presetObstacles("airport-baggage", [
      ["conveyor", 16, -7], ["conveyor", 16, 0], ["conveyor", 16, 7], ["luggage-cart", 23, 14]
    ]),
    obstacle("airport-apron", "اپرون هواپیما", "surface", 1, -24, 74, 19, 0.03, false),
    obstacle("airport-aircraft-body", "هواپیمای منطقه‌ای", "vehicle", 2, -24, 18, 3.2, 3.5, true),
    obstacle("airport-aircraft-wing", "بال هواپیما", "block", 2, -24, 4, 18, 0.5, true),
    ...presetObstacles("airport-apron-assets", [
      ["van", -15, -20, 90], ["luggage-cart", -8, -20, 90], ["camera-pole", -33, -29],
      ["camera-pole", 33, -29], ["light-pole", 23, -20], ["fence-mesh", -25, -35], ["fence-mesh", 15, -35]
    ])
  ], 5.2);
  return building([ground]);
}

/** A container port with quay, customs building, truck gate and simple gantry cranes. */
function containerPortPlan(): BuildingPlan {
  const cranes = [-15, 2, 19].flatMap((x, index) => [
    obstacle(`port-crane-leg-a-${index + 1}`, "پایه جرثقیل ساحلی", "pillar", x - 3, 17, 0.8, 0.8, 9, true),
    obstacle(`port-crane-leg-b-${index + 1}`, "پایه جرثقیل ساحلی", "pillar", x + 3, 17, 0.8, 0.8, 9, true),
    obstacle(`port-crane-beam-${index + 1}`, "بازوی جرثقیل ساحلی", "block", x, 17, 7.5, 0.8, 0.8, true)
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
      obstacle(`port-container-a-${column + 1}`, "کانتینر", "block", x, -6, 6, 2.5, 2.6, true),
      obstacle(`port-container-b-${column + 1}`, "کانتینر", "block", x, 1, 6, 2.5, 5.2, true)
    ]),
    ...presetObstacles("port-customs-assets", [
      ["service-counter", 25, -10], ["office-desk", 31, -10], ["office-chair", 31, -8.8, 180],
      ["equipment-rack", 33.5, -3, 90], ["filing-cabinet", 22.5, -3, 90]
    ]),
    ...presetObstacles("port-gate-assets", [
      ["gate-sliding", -29, -18], ["guard-booth", -34, -14], ["parking-barrier", -26, -13],
      ["truck", -19, -14, 90], ["truck", -7, -14, 90], ["road", -30, -14], ["road", -18, -14],
      ["road", -6, -14], ["road", 6, -14], ["road", 18, -14], ["camera-pole", -35, 10], ["camera-pole", 35, 10]
    ])
  ], 4);
  return building([ground]);
}

/** A through railway station with two platforms, central ticket hall and visible tunnel mouths. */
function railwayInterchangeStationPlan(): BuildingPlan {
  const ground = floor("railway-station-ground", "ایستگاه راه‌آهن، سکوها و سالن بلیت", 0, [
    ...rectangle("railway-ticket-hall", -13, -12, 13, 8, 4.2)
  ], [
    { ...door("railway-main-entry", "railway-ticket-hall-north", 0.5, 3), variant: "double-glass", swingDirection: "inward" },
    door("railway-platform-door", "railway-ticket-hall-south", 0.5, 2.4),
    windowOpening("railway-ticket-window-a", "railway-ticket-hall-west", 0.35, 2),
    windowOpening("railway-ticket-window-b", "railway-ticket-hall-east", 0.35, 2)
  ], [
    obstacle("railway-platform-a", "سکوی شماره یک", "surface", 0, 11, 50, 4, 0.25, false),
    obstacle("railway-platform-b", "سکوی شماره دو", "surface", 0, 21, 50, 4, 0.25, false),
    ...[15, 16.5, 25, 26.5].map((z, index) => obstacle(`railway-track-${index + 1}`, "ریل", "block", 0, z, 64, 0.16, 0.12, false)),
    obstacle("railway-tunnel-west", "دهانه تونل غربی", "block", -32, 20.75, 1, 16, 4.5, true),
    obstacle("railway-tunnel-east", "دهانه تونل شرقی", "block", 32, 20.75, 1, 16, 4.5, true),
    ...gridPresets("railway-platform-seating-a", ["waiting-bench"], [-18, -6, 6, 18], [11]),
    ...gridPresets("railway-platform-seating-b", ["waiting-bench"], [-18, -6, 6, 18], [21]),
    ...presetObstacles("railway-ticket-assets", [
      ["service-counter", -7, -7], ["service-counter", 0, -7], ["service-counter", 7, -7],
      ["queue-barrier", -7, -3], ["queue-barrier", 0, -3], ["queue-barrier", 7, -3],
      ["escalator", -7, 4, 90], ["stairs-straight", 2, 4, 90], ["elevator", 8, 4, 90]
    ]),
    ...presetObstacles("railway-security", [
      ["camera-pole", -32, 16], ["camera-pole", 32, 16], ["light-pole", -32, 30], ["light-pole", 32, 30]
    ])
  ], 4.4);
  return building([ground]);
}

/** An open-pit mine with terraced pit, haul road, crusher, weighbridge and secure explosives store. */
function openPitMinePlan(): BuildingPlan {
  const pitOuter = {
    ...presetObstacle("mine-pit-outer", "structural-column", -12, 10),
    label: "دهانه معدن روباز",
    widthM: 34,
    depthM: 34,
    heightM: 0.12,
    blocksView: false
  };
  const pitInner = {
    ...presetObstacle("mine-pit-inner", "structural-column", -12, 10),
    label: "جبهه‌کار معدن",
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
    obstacle("mine-haul-road", "جاده مارپیچ حمل", "surface", -2, -12, 64, 7, 0.04, false, -12),
    obstacle("mine-weighbridge", "باسکول کامیون", "equipment", 21, -13, 9, 3, 0.6, false),
    obstacle("mine-crusher", "سنگ‌شکن اصلی", "equipment", 22, 3, 8, 7, 6, true),
    obstacle("mine-conveyor", "نوار انتقال سنگ", "equipment", 11.5, 4, 13, 1.4, 1.2, false),
    ...presetObstacles("mine-vehicles", [
      ["truck", -24, -11, 78], ["truck", -10, -13, 78], ["pickup", 31, -13, 90],
      ["guard-booth", 31, -7], ["gate-sliding", 28, -18], ["camera-pole", -31, 26], ["camera-pole", 34, 28]
    ]),
    ...presetObstacles("mine-explosives-assets", [
      ["storage-rack", 24, 18, 90], ["storage-rack", 29, 18, 90], ["equipment-rack", 32.5, 23, 90]
    ])
  ], 3.8);
  return building([ground]);
}

/** A water-treatment site with circular basins, chemical room, pumps and SCADA control. */
function waterTreatmentPlantPlan(): BuildingPlan {
  const basin = (id: string, x: number, z: number, diameter: number) => ({
    ...presetObstacle(id, "structural-column", x, z),
    label: "حوضچه تصفیه آب",
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
    ...presetObstacles("water-pump-assets", [
      ["cnc-machine", 16.5, -8], ["cnc-machine", 16.5, 2], ["workbench", 18, 7]
    ]),
    ...presetObstacles("water-chemical-assets", [
      ["storage-rack", 24.5, -8, 90], ["storage-rack", 24.5, 1, 90], ["tool-cabinet", 22.5, 7, 90]
    ]),
    ...presetObstacles("water-control-assets", [
      ["equipment-rack", 33.5, -9, 90], ["office-desk", 31, -4], ["office-chair", 31, -2.8, 180],
      ["meeting-table", 31, 5]
    ]),
    ...presetObstacles("water-site-security", [
      ["road", 17, 16], ["road", 29, 16], ["road", 30, 16, 90],
      ["gate-sliding", 30, 22], ["guard-booth", 35, 20], ["pickup", 16, 17, 90],
      ["camera-pole", -34, 25], ["camera-pole", 36, 25], ["light-pole", 1, 24], ["fence-mesh", -20, 27]
    ])
  ], 4.4);
  return building([ground]);
}

function factoryCampusPlan(): BuildingPlan {
  const groundWalls = [
    ...rectangle("factory-yard", -30, -20, 30, 20, 2.4),
    ...rectangle("factory-hall", -25, -14, 12, 14, 6),
    ...rectangle("factory-office", 15, -14, 26, 2, 3.4),
    partition("factory-storage", -8, -14, -8, 14, 6),
    partition("factory-quality", -25, 8, 12, 8, 6)
  ];
  const ground = floor("factory-ground", "محوطه، تولید و انبار", 0, groundWalls, [
    door("factory-gate", "factory-yard-south", 0.78, 6),
    door("factory-hall-door", "factory-hall-south", 0.5, 5),
    door("factory-storage-door", "factory-storage", 0.75, 2),
    door("factory-quality-door", "factory-quality", 0.72, 1.5),
    door("factory-office-door", "factory-office-south", 0.5, 1.5),
    windowOpening("factory-office-window-east", "factory-office-east", 0.5, 2),
    windowOpening("factory-office-window-north", "factory-office-north", 0.5, 2.4)
  ], [
    ...presetObstacles("factory-production", [
      ["conveyor", -17, -9], ["conveyor", -17, -4], ["conveyor", -17, 1], ["conveyor", -17, 6],
      ["cnc-machine", -3, -9], ["cnc-machine", 4, -9], ["cnc-machine", -3, -3], ["cnc-machine", 4, -3],
      ["workbench", -3, 3], ["workbench", 4, 3], ["welding-station", -3, 6], ["welding-station", 4, 6],
      ["tool-cabinet", 10.5, -10, 90], ["tool-cabinet", 10.5, 4, 90]
    ]),
    ...presetObstacles("factory-storage-zone", [
      ["storage-rack", -22.5, -9, 90], ["storage-rack", -22.5, -3, 90], ["storage-rack", -22.5, 3, 90],
      ["pallet-stack", -12, 10], ["pallet-stack", -17, 10], ["crate-stack", -22, 10],
      ["packing-table", -4, 11], ["loading-platform", 5, 11]
    ]),
    ...presetObstacles("factory-yard-assets", [
      ["truck", 22, 13, 90], ["van", 22, 7, 90], ["pickup", 24, -5, 90],
      ["parking-barrier", 17, 18], ["guard-booth", 11, 17], ["speed-bump", 20, 17],
      ["camera-pole", -27, 17], ["camera-pole", 27, 17], ["light-pole", -27, -16], ["light-pole", 27, -16]
    ]),
    ...presetObstacles("factory-ground-office", [
      ["office-desk", 19, -8], ["office-chair", 19, -6.8, 180], ["filing-cabinet", 25, -10, 90],
      ["reception-desk", 19, -12], ["equipment-rack", 25, -2, 90]
    ]),
    presetObstacle("factory-ground-stairs", "stairs-straight", 10, -1, 90),
    presetObstacle("factory-ground-elevator", "elevator", 8.2, -1, 90)
  ], 6.2);

  const admin = floor("factory-admin", "مدیریت، کنترل کیفیت و رفاه", 1, [
    ...rectangle("factory-admin-shell", -14, -9, 14, 9),
    glassPartition("factory-admin-h", -14, 1, 14, 1),
    glassPartition("factory-admin-v", 4, -9, 4, 9)
  ], [
    door("factory-admin-meeting", "factory-admin-h", 0.72, 1.2),
    door("factory-admin-office", "factory-admin-v", 0.3, 1.2),
    windowOpening("factory-admin-window-north-a", "factory-admin-shell-north", 0.25, 2.5),
    windowOpening("factory-admin-window-north-b", "factory-admin-shell-north", 0.75, 2.5),
    windowOpening("factory-admin-window-east", "factory-admin-shell-east", 0.5, 2)
  ], [
    ...presetObstacles("factory-admin-assets", [
      ["office-desk", -8, -5], ["office-desk", -3, -5], ["office-chair", -8, -3.8, 180], ["office-chair", -3, -3.8, 180],
      ["meeting-table", -4, 5], ["filing-cabinet", -12.5, 6, 90], ["partition-screen", 0, -4, 90],
      ["reception-desk", 9, -6, 90], ["lobby-sofa", 9, 5], ["coffee-table", 9, 3.5],
      ["fridge", 12.5, 7, 90], ["kitchen-counter", 7, 8], ["vending-machine", 12.5, 0, 90]
    ]),
    ...tableChairs("factory-admin-meeting-chairs", -4, 5),
    topLanding("factory-admin-landing", 10, -1, 90),
    presetObstacle("factory-admin-elevator", "elevator", 8.2, -1, 90)
  ], 3.8);
  admin.elevationM = ground.heightM;
  return building([ground, admin]);
}

function residentialParkingPlan(): BuildingPlan {
  const parking = floor("residential-parking", "پارکینگ و لابی", 0, [
    ...rectangle("residential-parking-shell", -16, -12, 16, 12),
    // Closed pedestrian circulation instead of two dangling partitions that
    // previously produced one malformed room around the entire parking floor.
    partition("residential-core-west", 8, -12, 8, 5),
    partition("residential-core-north", 8, 5, 16, 5),
    partition("residential-lobby-storage", 8, -4, 16, -4)
  ], [
    door("residential-gate", "residential-parking-shell-south", 0.5, 4),
    door("residential-lobby-door", "residential-core-west", 0.68, 1.4),
    door("residential-storage-door", "residential-lobby-storage", 0.35, 1.2),
    windowOpening("residential-lobby-window", "residential-parking-shell-east", 0.25, 2)
  ], [
    ...presetObstacles("residential-cars", [
      ["sedan", -12, 7, 90], ["sedan", -7, 7, 90], ["suv", -2, 7, 90],
      ["suv", 3, 7, 90], ["pickup", 8, 7, 90], ["van", 13, 7, 90]
    ]),
    ...presetObstacles("residential-parking-tools", [
      ["parking-barrier", 0, -10], ["guard-booth", -12, -8], ["speed-bump", 0, -7.5],
      ["wheel-stop", -12, 10], ["wheel-stop", -7, 10], ["wheel-stop", -2, 10],
      ["bollard", -3, -10], ["bollard", 3, -10]
    ]),
    ...presetObstacles("residential-lobby-assets", [
      ["reception-desk", 10, -2], ["lobby-sofa", 13.8, -1.5, 90], ["coffee-table", 12.2, -1.5],
      ["vending-machine", 14.5, -8, 90], ["equipment-rack", 10, -8, 90]
    ]),
    presetObstacle("residential-parking-stairs", "stairs-straight", 12, 2, 90),
    presetObstacle("residential-parking-elevator", "elevator", 10.2, 2, 90)
  ]);
  const apartment = (index: number) => floor(`residential-${index}`, `طبقه مسکونی ${index}`, index, [
    ...rectangle(`residential-${index}-shell`, -16, -12, 16, 12),
    // Two bedrooms, a common corridor, an enclosed vertical core, living room
    // and kitchen/dining. The old full grid generated twelve unusable cells.
    partition(`residential-${index}-north`, -16, -2, 16, -2),
    partition(`residential-${index}-south`, -16, 5, 16, 5),
    partition(`residential-${index}-bed-divider`, 0, -12, 0, -2),
    partition(`residential-${index}-living-divider`, 0, 5, 0, 12),
    partition(`residential-${index}-core-west`, 8, -2, 8, 5)
  ], [
    door(`residential-${index}-core-door`, `residential-${index}-core-west`, 0.5, 1.5),
    door(`residential-${index}-bed-a`, `residential-${index}-north`, 0.18),
    door(`residential-${index}-bed-b`, `residential-${index}-north`, 0.58),
    door(`residential-${index}-living`, `residential-${index}-south`, 0.25),
    door(`residential-${index}-kitchen`, `residential-${index}-south`, 0.7),
    windowOpening(`residential-${index}-window-north-a`, `residential-${index}-shell-north`, 0.22, 2.4),
    windowOpening(`residential-${index}-window-north-b`, `residential-${index}-shell-north`, 0.78, 2.4),
    windowOpening(`residential-${index}-window-east`, `residential-${index}-shell-east`, 0.5, 2.2),
    windowOpening(`residential-${index}-window-west`, `residential-${index}-shell-west`, 0.5, 2.2)
  ], [
    ...presetObstacles(`residential-${index}-living-assets`, [
      ["rug", -7, 8.5], ["sofa-three", -8, 10], ["sofa-single", -3, 8, 90],
      ["coffee-table", -7, 8], ["tv-unit", -14.5, 8, 90], ["dining-table", 4, 8, 90]
    ]),
    ...tableChairs(`residential-${index}-dining-chairs`, 4, 8, 90, "dining-chair"),
    ...presetObstacles(`residential-${index}-bedrooms`, [
      ["bed-double", -12, -7], ["nightstand", -9.5, -7], ["wardrobe", -15.5, -4, 90],
      ["bed-single", 12, -7], ["dresser", 9, -10.5], ["bookshelf", 15.5, -4, 90]
    ]),
    ...presetObstacles(`residential-${index}-kitchen-assets`, [
      ["fridge", 14.5, 6.5, 90], ["kitchen-counter", 10, 11], ["stove", 13, 11],
      ["sink-unit", 7, 11], ["kitchen-island", 10, 8], ["dishwasher", 4, 11]
    ]),
    presetObstacle(`residential-${index}-desk`, "office-desk", -4, 1),
    presetObstacle(`residential-${index}-chair`, "office-chair", -4, 2.2, 180),
    index < 3
      ? presetObstacle(`residential-${index}-stairs`, "stairs-straight", 12, 2, 90)
      : topLanding(`residential-${index}-landing`, 12, 2, 90),
    presetObstacle(`residential-${index}-elevator`, "elevator", 10.2, 2, 90)
  ]);
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
  const stairPositions: Array<[number, number]> = [[-31, -26], [31, -26], [-31, 26], [31, 26]];
  const elevatorPositions: Array<[number, number]> = [
    [-39, -8], [-39, -2.7], [-39, 2.7], [-39, 8], [39, -8], [39, -2.7], [39, 2.7], [39, 8]
  ];
  const escalatorPositions: Array<[number, number]> = [[-10, -17], [10, -17], [-10, 17], [10, 17]];
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
    for (const x of [-44, -35, -26, -17, 17, 26, 35, 44]) {
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
    for (const x of [-48, -31, -17, -9, 9, 17, 31, 48]) {
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
    ...kouroshAccessCore(`${id}-core`)
  ], 3.6);
}

function kouroshCinemaFloor(index: number, firstHall: number): FloorPlan {
  const id = `kourosh-cinema-${index}`;
  const hallCenters: Array<[number, number]> = [[-32, -17], [0, -17], [32, -17], [-32, 17], [0, 17], [32, 17]];
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
      `${id}-hall-${hallIndex + 1}-south`,
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
  first.obstacles.push(
    obstacle("kourosh-terrarium", "تراریوم کوروش", "block", 35, -14, 15, 11, 2.2, false),
    presetObstacle("kourosh-terrarium-palm-a", "palm", 32, -14),
    presetObstacle("kourosh-terrarium-palm-b", "palm", 38, -14)
  );

  const leisure = floor("kourosh-leisure-2", "طبقه دوم، ژوپیتر ۴۴۲۸ مترمربع و فودکورت", 2, [
    ...kouroshEnvelope("kourosh-leisure-2", 4.2),
    ...kouroshAtrium("kourosh-leisure-2"),
    partition("kourosh-leisure-2-food", 8, -34, 8, 34, 4.2)
  ], [
    door("kourosh-leisure-2-food-door", "kourosh-leisure-2-food", 0.58, 2),
    windowOpening("kourosh-leisure-2-window-east", "kourosh-leisure-2-envelope-east", 0.5, 4)
  ], [
    ...stripPrototypeCore(prototypeLeisure?.obstacles),
    obstacle("kourosh-jupiter-main", "سرزمین بازی ژوپیتر", "block", -26, 0, 32, 43, 2.2, false),
    ...kouroshAccessCore("kourosh-leisure-2-core")
  ], 4.2);

  const cinemaLobby = floor("kourosh-cinema-lobby-3", "طبقه سوم، گیشه سینما و خانه کودک", 3, [
    ...kouroshEnvelope("kourosh-cinema-lobby-3"),
    ...kouroshAtrium("kourosh-cinema-lobby-3"),
    glassPartition("kourosh-cinema-lobby-3-kids", -42, 12, -12, 12)
  ], [
    door("kourosh-cinema-lobby-3-kids-door", "kourosh-cinema-lobby-3-kids", 0.5, 1.8),
    windowOpening("kourosh-cinema-lobby-3-window-east", "kourosh-cinema-lobby-3-envelope-east", 0.5, 3)
  ], [
    ...presetObstacles("kourosh-cinema-lobby-3-assets", [
      ["checkout-counter", -8, -20], ["checkout-counter", 0, -20], ["checkout-counter", 8, -20],
      ["queue-barrier", -8, -16], ["queue-barrier", 8, -16], ["lobby-sofa", -30, 20],
      ["lobby-sofa", 30, 20], ["display-fridge", 42, -18, 90], ["vending-machine", 42, 18, 90]
    ]),
    obstacle("kourosh-kids-club", "خانه بازی کودک", "block", -28, 22, 25, 18, 1.2, false),
    ...kouroshAccessCore("kourosh-cinema-lobby-3-core")
  ]);

  const cinema4 = kouroshCinemaFloor(4, 1);
  const admin5 = floor("kourosh-admin-5", "طبقه پنجم، اداری، فرهنگی و سالن VIP", 5, [
    ...kouroshEnvelope("kourosh-admin-5"),
    ...kouroshAtrium("kourosh-admin-5"),
    glassPartition("kourosh-admin-5-office", -42, 12, 42, 12),
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
    obstacle("kourosh-vip-hall", "سالن VIP کوروش", "block", 30, 22, 26, 18, 1.1, false),
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
    ...kouroshAccessCore("kourosh-roof-7-core", true)
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

function standardFacilityCore(prefix: string, top = false, halfSpan = 28): PlanObstacle[] {
  return [
    top ? topLanding(`${prefix}-landing-west`, -halfSpan, 0, 90) : presetObstacle(`${prefix}-stairs-west`, "stairs-straight", -halfSpan, 0, 90),
    top ? topLanding(`${prefix}-landing-east`, halfSpan, 0, 90) : presetObstacle(`${prefix}-stairs-east`, "stairs-straight", halfSpan, 0, 90),
    presetObstacle(`${prefix}-elevator-public`, "elevator", -halfSpan + 4, 0, 90),
    presetObstacle(`${prefix}-elevator-service`, "elevator", halfSpan - 4, 0, 90)
  ];
}

function centralCorridorRooms(prefix: string, left: number, right: number, top: number, bottom: number, columns = 6, heightM = 3.6) {
  const walls: PlanWall[] = [
    partition(`${prefix}-corridor-north`, left, -3, right, -3, heightM),
    partition(`${prefix}-corridor-south`, left, 3, right, 3, heightM)
  ];
  const doors: PlanDoor[] = [];
  const step = (right - left) / columns;
  for (let index = 1; index < columns; index += 1) {
    const x = left + step * index;
    walls.push(partition(`${prefix}-north-divider-${index}`, x, top, x, -3, heightM));
    walls.push(partition(`${prefix}-south-divider-${index}`, x, 3, x, bottom, heightM));
  }
  for (let index = 0; index < columns; index += 1) {
    const offset = (index + 0.5) / columns;
    doors.push(door(`${prefix}-north-room-door-${index + 1}`, `${prefix}-corridor-north`, offset, 1.35));
    doors.push(door(`${prefix}-south-room-door-${index + 1}`, `${prefix}-corridor-south`, offset, 1.35));
  }
  return { walls, doors };
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
  const elevators: Array<[number, number]> = [[-44, -10], [-44, 0], [-44, 10], [44, -10], [44, 0], [44, 10]];
  const escalators: Array<[number, number]> = [[-11, -18], [11, -18], [-11, 18], [11, 18]];
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
    ...megaCore(`${id}-core`)
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
    obstacle("mega-play-zone", "شهربازی سرپوشیده مگامال", "block", -28, 2, 62, 72, 1.2, false),
    ...gridPresets("mega-play-assets", ["display-stand", "vending-machine", "waiting-bench"], [-52, -38, -24, -10], [-28, -10, 10, 28]),
    ...Array.from({ length: 10 }, (_, index) => tableChairs(`mega-leisure-table-${index + 1}`, 20 + (index % 5) * 9, 20 + Math.floor(index / 5) * 8, 0, "dining-chair")).flat(),
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
    ...megaCore("mega-cinema-core", true)
  ], 5);
  return stackBuilding([...parking, hyper, retail1, retail2, leisure, cinema], hyper.id);
}

function clinicalFixtures(prefix: string, variant: ObstacleVariant, xs: number[], zs: number[]): PlanObstacle[] {
  return gridPresets(prefix, [variant], xs, zs, 90);
}

function hospitalFloor(id: string, name: string, index: number, specialty: "emergency" | "surgery" | "ward" | "maternity" | "admin", top = false): FloorPlan {
  const rooms = centralCorridorRooms(id, -34, 34, -24, 24, specialty === "ward" || specialty === "maternity" ? 8 : 6, 3.8);
  const common: PlanObstacle[] = [
    ...standardFacilityCore(`${id}-core`, top, 29),
    presetObstacle(`${id}-nurse`, "nurse-station", 0, 0),
    presetObstacle(`${id}-rack`, "equipment-rack", 31, 20)
  ];
  const specialtyAssets: PlanObstacle[] = specialty === "emergency" ? [
    ...clinicalFixtures(`${id}-exam`, "exam-table", [-27, -16, -5, 7, 18, 29], [-14]),
    ...clinicalFixtures(`${id}-stretcher`, "stretcher", [-28, -17, -5.5, 5.5, 17, 28], [14]),
    ...gridPresets(`${id}-waiting`, ["waiting-bench"], [-26, -17, -8, 8, 17, 26], [0]),
    ...gridPresets(`${id}-medical-carts`, ["medical-cart"], [-17, 5.5, 17], [-7, 7])
  ] : specialty === "surgery" ? [
    ...clinicalFixtures(`${id}-surgery-tables`, "exam-table", [-28, -17, -5.5, 5.5, 17, 28], [-14]),
    ...clinicalFixtures(`${id}-icu-beds`, "hospital-bed", [-26, -17, -8, 8, 17, 26], [14]),
    ...gridPresets(`${id}-screens`, ["privacy-screen"], [-22, -11, 11, 22], [10]),
    ...gridPresets(`${id}-carts`, ["medical-cart"], [-28, -17, -5.5, 5.5, 17, 28], [-8, 8])
  ] : specialty === "ward" || specialty === "maternity" ? [
    ...clinicalFixtures(`${id}-beds-north`, "hospital-bed", [-29, -21, -13, -5, 5, 13, 21, 29], [-14]),
    ...clinicalFixtures(`${id}-beds-south`, "hospital-bed", [-29, -21, -13, -5, 5, 13, 21, 29], [14]),
    ...gridPresets(`${id}-screens`, ["privacy-screen"], [-29.75, -21.25, -12.75, -4.25, 4.25, 12.75, 21.25, 29.75], [-10, 10]),
    ...gridPresets(`${id}-carts`, ["medical-cart"], [-28, -14, 14, 28], [-5, 5])
  ] : [
    ...gridPresets(`${id}-desks`, ["office-desk", "office-chair"], [-27, -18, -9, 9, 18, 27], [-14, 14]),
    ...tableChairs(`${id}-meeting-west`, -18, 0),
    ...tableChairs(`${id}-meeting-east`, 18, 0),
    ...gridPresets(`${id}-rehab`, ["waiting-bench", "medical-cart"], [-28, -18, 18, 28], [-8, 8])
  ];
  const floorPlan = floor(id, name, index, [
    ...rectangle(`${id}-shell`, -36, -26, 36, 26, 3.8),
    ...rooms.walls
  ], [
    ...rooms.doors,
    ...(index === 0 ? [door(`${id}-main-door`, `${id}-shell-south`, 0.5, specialty === "emergency" ? 3.2 : 1.8)] : []),
    windowOpening(`${id}-window-north-a`, `${id}-shell-north`, 0.25, 6),
    windowOpening(`${id}-window-north-b`, `${id}-shell-north`, 0.75, 6),
    windowOpening(`${id}-window-south-a`, `${id}-shell-south`, 0.25, 5),
    windowOpening(`${id}-window-south-b`, `${id}-shell-south`, 0.75, 5)
  ], [...common, ...specialtyAssets], 3.8);
  if (specialty === "emergency") {
    floorPlan.obstacles.push(obstacle(`${id}-ambulance`, "آمبولانس اورژانس", "vehicle", 30, 22, 5.7, 2.1, 2.5, true, 90));
  }
  return floorPlan;
}

function generalHospitalPlan(): BuildingPlan {
  const floors = [
    hospitalFloor("hospital-ground", "همکف، اورژانس، تریاژ، تصویربرداری و درمانگاه", 0, "emergency"),
    hospitalFloor("hospital-first", "طبقه اول، اتاق‌های عمل، ریکاوری و ICU", 1, "surgery"),
    hospitalFloor("hospital-second", "طبقه دوم، بخش‌های بستری داخلی و جراحی", 2, "ward"),
    hospitalFloor("hospital-third", "طبقه سوم، زنان، زایمان و اطفال", 3, "maternity"),
    hospitalFloor("hospital-fourth", "طبقه چهارم، مدیریت، آموزش، توان‌بخشی و خدمات", 4, "admin", true)
  ];
  return stackBuilding(floors, "hospital-ground");
}

function secureOfficeFloor(id: string, name: string, index: number, top = false, halfSpan = 24, shellHalfWidth = 30, shellHalfDepth = 22): FloorPlan {
  const rooms = centralCorridorRooms(id, -shellHalfWidth + 3, shellHalfWidth - 3, -shellHalfDepth + 2, shellHalfDepth - 2, 6, 3.6);
  return floor(id, name, index, [...rectangle(`${id}-shell`, -shellHalfWidth, -shellHalfDepth, shellHalfWidth, shellHalfDepth, 3.6), ...rooms.walls], [
    ...rooms.doors,
    ...(index === 0 ? [door(`${id}-entry`, `${id}-shell-south`, 0.5, 2.2)] : []),
    windowOpening(`${id}-window-a`, `${id}-shell-north`, 0.3, 4),
    windowOpening(`${id}-window-b`, `${id}-shell-north`, 0.7, 4)
  ], [
    ...standardFacilityCore(`${id}-core`, top, halfSpan),
    ...gridPresets(`${id}-workstations`, ["office-desk", "office-chair", "filing-cabinet"], [-23, -14, -5, 5, 14, 23], [-13, 13]),
    ...gridPresets(`${id}-lockers`, ["locker-row"], [-23, -8, 8, 23], [-18, 18]),
    ...tableChairs(`${id}-briefing-west`, -15, 0),
    ...tableChairs(`${id}-briefing-east`, 15, 0),
    presetObstacle(`${id}-rack`, "equipment-rack", shellHalfWidth - 2, shellHalfDepth - 4)
  ], 3.6);
}

function policeStationPlan(): BuildingPlan {
  const basement = floor("police-basement", "زیرزمین، پارکینگ سازمانی، بایگانی و نگهداری موقت", -1, [
    ...rectangle("police-basement-shell", -30, -22, 30, 22, 3.6),
    partition("police-basement-secure", 8, -22, 8, 22),
    partition("police-basement-cells", 8, 4, 30, 4),
    partition("police-basement-cell-a", 19, 4, 19, 22)
  ], [
    door("police-basement-gate", "police-basement-shell-south", 0.2, 5),
    door("police-basement-secure-door", "police-basement-secure", 0.5, 1.4),
    door("police-basement-cell-door-a", "police-basement-cells", 0.25, 1.1),
    door("police-basement-cell-door-b", "police-basement-cells", 0.75, 1.1),
    windowOpening("police-basement-vent", "police-basement-shell-east", 0.5, 2.5)
  ], [
    ...gridPresets("police-basement-vehicles", ["sedan", "suv", "van"], [-22, -12, -2], [-14, -5, 5, 14], 90),
    ...gridPresets("police-basement-archive", ["filing-cabinet", "locker-row"], [14, 24], [-14, -6]),
    ...gridPresets("police-basement-cells-assets", ["metal-bunk"], [14, 24], [13], 90),
    ...standardFacilityCore("police-basement-core", false, 24)
  ], 3.6);
  const ground = secureOfficeFloor("police-ground", "همکف، پیشخوان خدمات، گزارش، انتظار و مصاحبه", 0);
  ground.obstacles.push(
    ...gridPresets("police-ground-counter", ["service-counter"], [-15, -5, 5, 15], [-7]),
    ...gridPresets("police-ground-waiting", ["waiting-bench"], [-20, -10, 10, 20], [7])
  );
  const first = secureOfficeFloor("police-first", "طبقه اول، عملیات، فرماندهی، اداری و اتاق جلسات", 1);
  const second = secureOfficeFloor("police-second", "طبقه دوم، آموزش، توجیه، رفاه و مدیریت", 2, true);
  return stackBuilding([basement, ground, first, second], ground.id);
}

function barracksCampusPlan(): BuildingPlan {
  const ground = floor("barracks-ground", "همکف، محوطه پادگان، گیت، ستاد، درمانگاه و خدمات", 0, [
    ...rectangle("barracks-yard", -62, -42, 62, 42, 2.4),
    ...rectangle("barracks-ground-shell", -42, -27, 42, 27, 3.6),
    // Leave four real passages for the two stair and two lift cores. The old
    // continuous spine visibly cut through all four structures in 3D.
    partition("barracks-ground-spine-west", -42, 0, -36, 0),
    partition("barracks-ground-spine-between-west-cores", -34, 0, -32.3, 0),
    partition("barracks-ground-spine-centre", -29.7, 0, 29.7, 0),
    partition("barracks-ground-spine-between-east-cores", 32.3, 0, 34, 0),
    partition("barracks-ground-spine-east", 36, 0, 42, 0),
    partition("barracks-ground-admin", -12, -27, -12, 27),
    partition("barracks-ground-clinic", 18, 0, 18, 27)
  ], [
    door("barracks-main-gate", "barracks-yard-south", 0.5, 7),
    door("barracks-main-entry", "barracks-ground-shell-south", 0.5, 2.4),
    door("barracks-admin-door", "barracks-ground-admin", 0.3, 1.4),
    door("barracks-clinic-door", "barracks-ground-clinic", 0.55, 1.4),
    windowOpening("barracks-ground-window-north", "barracks-ground-shell-north", 0.5, 8)
  ], [
    ...gridPresets("barracks-roads", ["road"], [-45, -20, 5, 30, 50], [34]),
    ...gridPresets("barracks-vehicles", ["sedan", "pickup", "van", "truck"], [-48, -34, -20, 30, 44, 55], [25], 90),
    ...gridPresets("barracks-landscape", ["grass", "deciduous", "conifer", "light-pole"], [-52, -36, 36, 52], [-32, 32]),
    ...presetObstacles("barracks-gate-assets", [["gate-sliding", 0, 41], ["guard-booth", 7, 38], ["parking-barrier", -6, 38], ["camera-pole", -58, 35], ["camera-pole", 58, 35]]),
    ...gridPresets("barracks-admin-assets", ["office-desk", "office-chair", "filing-cabinet"], [-34, -25, -17, -5, 5], [-18, -8, 8, 18]),
    ...gridPresets("barracks-clinic-assets", ["exam-table", "medical-cart", "waiting-bench"], [25, 34], [8, 18]),
    ...standardFacilityCore("barracks-ground-core", false, 35)
  ], 3.6);
  const dormRooms = centralCorridorRooms("barracks-dorm", -40, 40, -25, 25, 8, 3.6);
  const dorm = floor("barracks-first", "طبقه اول، آسایشگاه‌ها، رختکن و فضاهای بهداشتی", 1, [...rectangle("barracks-first-shell", -42, -27, 42, 27, 3.6), ...dormRooms.walls], [
    ...dormRooms.doors,
    windowOpening("barracks-first-window-north", "barracks-first-shell-north", 0.5, 8),
    windowOpening("barracks-first-window-south", "barracks-first-shell-south", 0.5, 8)
  ], [
    ...gridPresets("barracks-bunks-n", ["metal-bunk"], [-36, -27, -18, -9, 9, 18, 27, 36], [-16]),
    ...gridPresets("barracks-bunks-s", ["metal-bunk"], [-36, -27, -18, -9, 9, 18, 27, 36], [16]),
    ...gridPresets("barracks-lockers", ["locker-row"], [-35, -21, -7, 7, 21, 35], [-23, 23]),
    ...standardFacilityCore("barracks-first-core", false, 35)
  ], 3.6);
  const training = secureOfficeFloor("barracks-second", "طبقه دوم، آموزش نظری، فرماندهی و جلسات", 2, false, 35, 42, 27);
  const welfare = floor("barracks-third", "طبقه سوم، غذاخوری، کتابخانه، ورزش و رفاه", 3, [
    ...rectangle("barracks-third-shell", -42, -27, 42, 27, 3.8),
    partition("barracks-third-food", 8, -27, 8, 27),
    partition("barracks-third-library", -42, 8, 8, 8)
  ], [
    door("barracks-third-food-door", "barracks-third-food", 0.5, 1.8),
    windowOpening("barracks-third-window-north", "barracks-third-shell-north", 0.5, 8)
  ], [
    ...Array.from({ length: 12 }, (_, index) => tableChairs(`barracks-dining-${index + 1}`, 17 + (index % 4) * 7, -17 + Math.floor(index / 4) * 9, 0, "dining-chair")).flat(),
    ...gridPresets("barracks-library", ["library-shelf", "student-desk"], [-34, -25, -16, -7], [14, 22]),
    ...gridPresets("barracks-gym", ["gym-bleacher", "locker-row"], [-30, -10], [-15]),
    ...standardFacilityCore("barracks-third-core", true, 35)
  ], 3.8);
  return stackBuilding([ground, dorm, training, welfare], ground.id);
}

function classroomAssets(prefix: string, xOffset: number, zOffset: number): PlanObstacle[] {
  return [
    ...gridPresets(`${prefix}-desks`, ["student-desk"], [-4, 0, 4].map((x) => x + xOffset), [-4, 0, 4].map((z) => z + zOffset)),
    presetObstacle(`${prefix}-board`, "whiteboard", xOffset, zOffset - 6, 0),
    presetObstacle(`${prefix}-teacher`, "office-desk", xOffset + 5, zOffset - 5)
  ];
}

function schoolCampusPlan(): BuildingPlan {
  const classroomFloor = (id: string, name: string, index: number, top = false) => {
    const rooms = centralCorridorRooms(id, -38, 38, -26, 26, 4, 3.7);
    const centers: Array<[number, number]> = [[-28, -15], [-9, -15], [9, -15], [28, -15], [-28, 15], [-9, 15], [9, 15], [28, 15]];
    return floor(id, name, index, [...rectangle(`${id}-shell`, -40, -28, 40, 28, 3.7), ...rooms.walls], [
      ...rooms.doors,
      windowOpening(`${id}-window-north-a`, `${id}-shell-north`, 0.25, 6),
      windowOpening(`${id}-window-north-b`, `${id}-shell-north`, 0.75, 6),
      windowOpening(`${id}-window-south-a`, `${id}-shell-south`, 0.25, 6),
      windowOpening(`${id}-window-south-b`, `${id}-shell-south`, 0.75, 6)
    ], [
      ...centers.flatMap(([x, z], roomIndex) => classroomAssets(`${id}-class-${roomIndex + 1}`, x, z)),
      ...standardFacilityCore(`${id}-core`, top, 34)
    ], 3.7);
  };
  const ground = classroomFloor("school-ground", "همکف، ورودی، مدیریت، کلاس‌های پایه و حیاط", 0);
  ground.walls.unshift(...rectangle("school-yard", -58, -42, 58, 42, 2.2));
  ground.doors.push(door("school-yard-gate", "school-yard-south", 0.5, 5), door("school-main-entry", "school-ground-shell-south", 0.5, 2.4));
  ground.obstacles.push(
    ...gridPresets("school-yard-landscape", ["grass", "deciduous", "light-pole", "waiting-bench"], [-48, -32, 32, 48], [-34, 34]),
    ...presetObstacles("school-yard-security", [["gate-sliding", 0, 41], ["guard-booth", 7, 38], ["camera-pole", -54, 34], ["camera-pole", 54, 34]])
  );
  const first = classroomFloor("school-first", "طبقه اول، کلاس‌ها، اتاق معلمان و مشاوره", 1);
  const second = classroomFloor("school-second", "طبقه دوم، آزمایشگاه‌ها، کارگاه و کتابخانه", 2);
  second.obstacles.push(
    ...gridPresets("school-labs", ["lab-bench"], [-30, -22, -14, 14, 22, 30], [-17, -10]),
    ...gridPresets("school-library", ["library-shelf"], [-30, -22, -14, 14, 22, 30], [12, 19])
  );
  const third = floor("school-third", "طبقه سوم، سالن چندمنظوره، ورزش، هنر و بام آموزشی", 3, [
    ...rectangle("school-third-shell", -40, -28, 40, 28, 4.2),
    partition("school-third-gym", 10, -28, 10, 28, 4.2),
    partition("school-third-art", -40, 8, 10, 8, 4.2)
  ], [
    door("school-third-gym-door", "school-third-gym", 0.5, 2),
    door("school-third-art-door", "school-third-art", 0.5, 1.6),
    windowOpening("school-third-window-north", "school-third-shell-north", 0.5, 8)
  ], [
    ...gridPresets("school-bleachers", ["gym-bleacher"], [20, 30], [-20, 20]),
    ...gridPresets("school-art-benches", ["lab-bench", "student-desk"], [-30, -20, -10, 0], [-15, -7, 16]),
    ...standardFacilityCore("school-third-core", true, 34)
  ], 4.2);
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
function sampleRoomSectionType(id: SamplePlanId, floor: FloorPlan, room: PlanRoom): string {
  const wallIds = room.wallIds ?? [];
  const hasWall = (part: string) => wallIds.some((wallId) => wallId.includes(part));
  const roomObstacles = floor.obstacles.filter((item) => pointInPolygon(item.center, room.polygon));
  const hasVariant = (...variants: ObstacleVariant[]) => roomObstacles.some((item) => item.variant && variants.includes(item.variant));

  // Vertical circulation is never a bedroom, ward, shop or storage room. Keep
  // this invariant ahead of venue-specific furnishing heuristics so a stair/lift
  // cannot accidentally inherit the surrounding private room's programme.
  if (hasVariant("stairs-straight", "elevator") || roomObstacles.some((item) => item.label.includes("پاگرد نهایی"))) {
    return "shared.stairwell";
  }

  switch (id) {
    case "family-villa":
      if (floor.id === "family-villa-ground") {
        if (hasVariant("fridge", "kitchen-counter", "stove", "sink-unit")) return "residential.kitchen";
        if (hasVariant("stairs-straight", "equipment-rack")) return "shared.stairwell";
        if (hasVariant("office-desk", "bookshelf")) return "sample.residential.study";
        return "residential.living";
      }
      return hasVariant("bed-double", "bed-single") ? "residential.bedroom" : "residential.living";

    case "corner-retail-shop":
      if (hasVariant("storage-rack", "crate-stack", "packing-table")) return "shop.backstore";
      if (hasVariant("office-desk", "equipment-rack")) return "sample.shop.office";
      return "shop.salesfloor";

    case "luxury-villa":
      if (floor.id === "villa-basement") {
        if (hasVariant("sedan", "suv", "pickup", "van", "truck")) return "residential.parking";
        return "shared.storeroom";
      }
      if (floor.id === "villa-ground") {
        if (hasWall("villa-estate-")) return "residential.yard";
        if (hasVariant("fridge", "kitchen-counter", "stove", "sink-unit", "kitchen-island")) return "residential.kitchen";
        return "residential.living";
      }
      if (floor.id === "villa-first") {
        return hasVariant("bed-double", "bed-single") ? "residential.bedroom" : "residential.living";
      }
      if (floor.id === "villa-second") {
        return hasWall("villa-second-service") && roomObstacles.length <= 4 ? "shared.storeroom" : "residential.living";
      }
      return hasWall("villa-roof-room-") ? "shared.storeroom" : "residential.roof";

    case "modern-office":
      if (hasVariant("stairs-straight", "elevator") || hasWall("core-v") && hasVariant("equipment-rack")) return "shared.stairwell";
      if (hasVariant("meeting-table")) return "office.meeting";
      if (floor.id === "office-0" && hasVariant("reception-desk", "lobby-sofa")) return "office.lobby";
      return "office.openplan";

    case "retail-gallery":
      if (floor.id === "gallery-mezzanine") return "sample.shop.admin";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack", "packing-table", "equipment-rack")) return "shop.backstore";
      if (hasVariant("checkout-counter")) return "shop.checkout";
      if (hasVariant("display-stand", "clothing-rack", "display-fridge")) return "shop.display";
      return "shop.salesfloor";

    case "neighbourhood-supermarket":
      if (hasVariant("queue-barrier")) return "supermarket.entrance";
      if (hasVariant("equipment-rack", "filing-cabinet")) return "supermarket.cashroom";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack", "packing-table") && !hasVariant("checkout-counter")) {
        return "supermarket.coldstore";
      }
      return "supermarket.aisle";

    case "secure-jewellery-branch":
      if (hasVariant("queue-barrier")) return "jewellery.entrance";
      if (hasVariant("storage-rack", "tool-cabinet")) return "jewellery.vault";
      if (hasVariant("office-desk", "equipment-rack")) return "sample.jewellery.staff";
      return hasVariant("checkout-counter") ? "jewellery.counter" : "jewellery.display";

    case "compact-industrial-workshop":
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack", "loading-platform")) return "industrial.warehouse";
      if (hasVariant("equipment-rack", "tool-cabinet") && !hasVariant("cnc-machine", "conveyor")) return "industrial.electrical";
      if (hasVariant("office-desk", "reception-desk")) return "sample.industrial.admin";
      return "industrial.production";

    case "urban-public-parking":
      if (hasVariant("guard-booth", "office-desk", "equipment-rack")) return "parking.control-room";
      if (hasVariant("stairs-straight", "elevator", "waiting-bench")) return "parking.pedestrian";
      return "parking.bay-aisle";

    case "neighbourhood-restaurant":
      if (hasVariant("fridge", "kitchen-counter", "stove", "sink-unit", "kitchen-island")) return "restaurant.kitchen";
      if (hasVariant("storage-rack", "display-fridge", "crate-stack")) return "restaurant.foodstore";
      return "restaurant.dining";

    case "primary-school":
      if (hasVariant("lab-bench")) return "school.lab";
      if (hasVariant("service-counter", "waiting-bench", "equipment-rack")) return "sample.school.lobby";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "school.classroom";

    case "outpatient-clinic":
      if (hasVariant("storage-rack", "display-fridge")) return "hospital.pharmacy-store";
      if (hasVariant("reception-desk", "service-counter", "queue-barrier")) return "hospital.reception";
      if (hasVariant("stretcher", "nurse-station")) return "hospital.emergency";
      if (roomObstacles.length === 0) return "shared.corridor";
      return "hospital.patient-room";

    case "boutique-hotel":
      if (hasVariant("bed-double", "bed-single")) return "hotel.guest-room";
      if (hasVariant("dining-table", "dining-chair", "service-counter")) return "hotel.restaurant";
      if (hasVariant("filing-cabinet", "equipment-rack", "office-desk")) return "hotel.safe-deposit";
      if (hasVariant("reception-desk", "lobby-sofa", "luggage-cart")) return "hotel.lobby";
      return "hotel.floor-corridor";

    case "neighbourhood-fuel-station":
      return "fuel.shop";

    case "courtyard-apartment":
      if (hasVariant("storage-rack", "crate-stack")) return "apartment.storage";
      if (hasVariant("equipment-rack", "tool-cabinet", "workbench")) return "apartment.plantroom";
      if (hasVariant("sedan", "suv", "van", "parking-barrier")) return "apartment.parking-gate";
      if (hasVariant("rug", "sofa-three", "sofa-single")) return "apartment.amenities";
      return "apartment.lobby";

    case "orchard-farm":
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack", "packing-table")) return "farm.store";
      if (hasVariant("metal-bunk", "fence-mesh")) return "farm.livestock";
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
      if (hasVariant("equipment-rack", "office-desk", "filing-cabinet")) return "mall.control";
      if (hasVariant("reception-desk", "queue-barrier")) return "mall.main-entrance";
      if (hasVariant("escalator", "elevator")) return "mall.escalator";
      if (hasVariant("dining-table", "service-counter", "display-fridge")) return "mall.food-court";
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
      return "railway.ticket-hall";

    case "open-pit-mine":
      return "mine.explosives";

    case "water-treatment-plant":
      if (hasVariant("storage-rack", "tool-cabinet")) return "water-plant.chemical";
      if (hasVariant("cnc-machine", "workbench")) return "water-plant.pump";
      return "water-plant.control";

    case "factory-campus":
      if (hasWall("factory-yard-")) return "industrial.perimeter";
      if (hasVariant("storage-rack", "pallet-stack", "crate-stack")) return "industrial.warehouse";
      if (hasVariant("loading-platform", "packing-table")) return "industrial.dock";
      if (hasVariant("conveyor", "cnc-machine", "workbench", "welding-station")) return "industrial.production";
      return "sample.industrial.admin";

    case "residential-parking":
      if (hasVariant("stairs-straight", "elevator") || roomObstacles.some((item) => item.label.includes("پاگرد نهایی"))) {
        return "shared.stairwell";
      }
      if (floor.id === "residential-parking") {
        if (hasVariant("equipment-rack", "vending-machine")) return "apartment.storage";
        if (hasVariant("reception-desk", "lobby-sofa")) return "apartment.lobby";
        return "parking.bay-aisle";
      }
      if (hasVariant("office-desk", "office-chair") && !hasVariant("bed-double", "bed-single")) return "shared.corridor";
      return "sample.apartment.private-unit";

    case "general-hospital":
      if (floor.id === "hospital-ground") return "hospital.emergency";
      if (floor.id === "hospital-fourth") return "sample.hospital.admin";
      return "hospital.patient-room";

    case "police-station":
      if (floor.id === "police-basement") {
        if (hasVariant("sedan", "suv", "van")) return "shared.staff-parking";
        if (hasVariant("filing-cabinet")) return "office.archive";
        return "sample.office.secure-room";
      }
      if (floor.id === "police-ground") return "office.lobby";
      return hasVariant("meeting-table") ? "office.meeting" : "office.openplan";

    case "barracks-campus":
      if (hasWall("barracks-yard-")) return "industrial.perimeter";
      if (floor.id === "barracks-first") return "sample.industrial.dormitory";
      if (floor.id === "barracks-second") return "sample.industrial.training";
      if (floor.id === "barracks-third") return "sample.industrial.welfare";
      return "sample.industrial.support";

    case "school-campus":
      if (hasWall("school-yard-")) return "school.yard";
      if (floor.id === "school-second" || hasVariant("lab-bench")) return "school.lab";
      if (floor.id === "school-third" && hasVariant("gym-bleacher")) return "sample.school.multipurpose";
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
  "hospital.reception": ["service-counter", "reception-desk", "nurse-station"],
  "hospital.pharmacy-store": ["medical-cart", "storage-rack"],
  "school.yard": ["grass", "waiting-bench", "light-pole"]
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
      const sectionIds = detectedRooms.map((room) => sampleRoomSectionType(id, floor, room));
      const sectionCounts = new Map<string, number>();
      sectionIds.forEach((sectionId) => sectionCounts.set(sectionId, (sectionCounts.get(sectionId) ?? 0) + 1));
      const sectionOrdinals = new Map<string, number>();
      return {
        ...floor,
        rooms: detectedRooms.map((room, index) => {
        const sectionTypeId = sampleRoomSectionType(id, floor, room);
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
