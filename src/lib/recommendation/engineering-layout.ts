import type { EngineeringCameraPlacement, EngineeringHeatmapCell, EngineeringMap, InfrastructureEstimate, ProjectBrief, ProjectZone } from "@/src/domain/catalog/types";

export type EngineeringCameraInput = {
  zone: ProjectZone;
  productId: string;
  productName: string;
  resolutionWidth: number;
  horizontalFovDeg: number;
  verticalFovDeg: number;
  actualPpm: number;
};

const radians = (value: number) => value * Math.PI / 180;
const degrees = (value: number) => value * 180 / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function polarPoint(xM: number, yM: number, distanceM: number, yawDeg: number) {
  return { xM: xM + Math.cos(radians(yawDeg)) * distanceM, yM: yM + Math.sin(radians(yawDeg)) * distanceM };
}

function angularDifference(first: number, second: number) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

export function groundFrustumDistances(mountingHeightM: number, targetPlaneHeightM: number, tiltDeg: number, verticalFovDeg: number, maximumRangeM: number) {
  const height = Math.max(0.1, mountingHeightM - targetPlaneHeightM);
  const nearAngle = radians(tiltDeg + verticalFovDeg / 2);
  const farAngleDeg = tiltDeg - verticalFovDeg / 2;
  const nearGroundM = clamp(height / Math.max(0.01, Math.tan(nearAngle)), 0, maximumRangeM);
  const farGroundM = farAngleDeg > 0.5 ? clamp(height / Math.tan(radians(farAngleDeg)), nearGroundM, maximumRangeM) : maximumRangeM;
  return { nearGroundM, farGroundM };
}

function coveragePolygon(xM: number, yM: number, yawDeg: number, horizontalFovDeg: number, nearM: number, farM: number) {
  return [
    polarPoint(xM, yM, nearM, yawDeg - horizontalFovDeg / 2),
    polarPoint(xM, yM, nearM, yawDeg + horizontalFovDeg / 2),
    polarPoint(xM, yM, farM, yawDeg + horizontalFovDeg / 2),
    polarPoint(xM, yM, farM, yawDeg - horizontalFovDeg / 2)
  ];
}

function mapSize(siteAreaM2 = 400) {
  const safeArea = clamp(siteAreaM2, 20, 100_000);
  const widthM = Math.sqrt(safeArea * 1.45);
  return { widthM, heightM: safeArea / widthM };
}

export function buildEngineeringMap(brief: ProjectBrief, inputs: EngineeringCameraInput[], gridColumns = 24, gridRows = 16): EngineeringMap {
  const { widthM, heightM } = mapSize(brief.siteAreaM2);
  const zones = brief.zones || [];
  const placements: EngineeringCameraPlacement[] = [];
  const zoneHeight = heightM / Math.max(1, zones.length);

  for (const [zoneIndex, input] of inputs.entries()) {
    const zoneTop = zoneIndex * zoneHeight;
    const zoneCenterY = zoneTop + zoneHeight / 2;
    const count = Math.max(1, input.zone.cameraCount);
    for (let cameraIndex = 0; cameraIndex < count; cameraIndex += 1) {
      const fromLeft = cameraIndex % 2 === 0;
      const row = Math.floor(cameraIndex / 2);
      const xM = fromLeft ? widthM * 0.04 : widthM * 0.96;
      const yM = clamp(zoneTop + zoneHeight * ((row + 1) / (Math.ceil(count / 2) + 1)), zoneTop + 0.2, zoneTop + zoneHeight - 0.2);
      const targetX = widthM / 2;
      const targetY = zoneCenterY;
      const yawDeg = degrees(Math.atan2(targetY - yM, targetX - xM));
      const maximumRangeM = Math.min(Math.hypot(widthM, heightM), Math.max(input.zone.targetDistanceM * 1.8, input.zone.targetDistanceM + 5));
      const ground = groundFrustumDistances(input.zone.mountingHeightM, 0, input.zone.cameraTiltDeg, input.verticalFovDeg, maximumRangeM);
      const targetCenter = polarPoint(xM, yM, input.zone.targetDistanceM, yawDeg);
      const halfScene = input.zone.sceneWidthM / 2;
      const left = polarPoint(targetCenter.xM, targetCenter.yM, halfScene, yawDeg - 90);
      const right = polarPoint(targetCenter.xM, targetCenter.yM, halfScene, yawDeg + 90);
      placements.push({
        id: `${input.zone.id}-${cameraIndex + 1}`, zoneId: input.zone.id, zoneName: input.zone.name,
        productId: input.productId, productName: input.productName, xM, yM,
        mountingHeightM: input.zone.mountingHeightM, yawDeg, tiltDeg: input.zone.cameraTiltDeg,
        horizontalFovDeg: input.horizontalFovDeg, verticalFovDeg: input.verticalFovDeg,
        nearGroundM: ground.nearGroundM, farGroundM: ground.farGroundM,
        coveragePolygon: coveragePolygon(xM, yM, yawDeg, input.horizontalFovDeg, ground.nearGroundM, ground.farGroundM),
        targetPlane: { center: targetCenter, left, right, ppm: input.actualPpm }
      });
    }
  }

  const heatmap: EngineeringHeatmapCell[] = [];
  for (let row = 0; row < gridRows; row += 1) {
    for (let column = 0; column < gridColumns; column += 1) {
      const xM = (column + 0.5) * widthM / gridColumns;
      const yM = (row + 0.5) * heightM / gridRows;
      let ppm = 0;
      let cameraCount = 0;
      for (const placement of placements) {
        const dx = xM - placement.xM;
        const dy = yM - placement.yM;
        const groundDistance = Math.hypot(dx, dy);
        const angle = degrees(Math.atan2(dy, dx));
        if (groundDistance < placement.nearGroundM || groundDistance > placement.farGroundM || angularDifference(angle, placement.yawDeg) > placement.horizontalFovDeg / 2) continue;
        cameraCount += 1;
        const slantDistance = Math.hypot(groundDistance, placement.mountingHeightM);
        const sceneWidth = 2 * slantDistance * Math.tan(radians(placement.horizontalFovDeg) / 2);
        const input = inputs.find((item) => item.productId === placement.productId && item.zone.id === placement.zoneId);
        if (input) ppm = Math.max(ppm, input.resolutionWidth / Math.max(0.1, sceneWidth));
      }
      heatmap.push({ xM, yM, ppm, cameraCount, blind: cameraCount === 0 });
    }
  }
  const blindCells = heatmap.filter((cell) => cell.blind).length;
  return { widthM, heightM, gridColumns, gridRows, placements, heatmap, blindSpotPercent: heatmap.length ? blindCells / heatmap.length * 100 : 100 };
}

export function calculateInfrastructure(brief: ProjectBrief, map: EngineeringMap, switchQuantity: number, upsLoadW: number, upsRequiredW: number): InfrastructureEstimate {
  const floors = Math.max(1, brief.floors || 1);
  const rackCount = floors;
  const rackX = map.widthM / 2;
  const rackY = map.heightM / 2;
  let copperCableM = 0;
  let longRuns = 0;
  for (const placement of map.placements) {
    const routeM = Math.hypot(placement.xM - rackX, placement.yM - rackY) + placement.mountingHeightM + 5;
    if (routeM > 90) longRuns += 1;
    copperCableM += Math.min(routeM, 90) * 1.15;
  }
  const fiberBackboneM = floors > 1 || longRuns > 0 ? ((floors - 1) * 25 + longRuns * 15) * 1.15 : 0;
  const patchPanelCount = Math.max(1, Math.ceil(map.placements.length / 24));
  const usedRackU = 2 + switchQuantity + patchPanelCount + 2 + Math.ceil(floors / 2);
  const requiredRackU = Math.ceil(usedRackU * 1.3);
  const recommendedRackU = [9, 12, 18, 22, 27, 32, 42].find((size) => size >= requiredRackU) || 42;
  return {
    copperCableM: Math.ceil(copperCableM), fiberBackboneM: Math.ceil(fiberBackboneM), rackCount,
    recommendedRackU, patchPanelCount, sfpModuleCount: fiberBackboneM > 0 ? Math.max(2, (floors - 1 + longRuns) * 2) : 0,
    floorDistributors: floors, upsLoadW: Math.round(upsLoadW * 10) / 10, upsRequiredW: Math.round(upsRequiredW * 10) / 10
  };
}
