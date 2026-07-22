/** Shared optics maths for the lens, view-angle and DORI tools and the assistant. */

export function focalLengthMm(sceneWidthM: number, distanceM: number, sensorWidthMm: number) {
  return sceneWidthM > 0 ? (distanceM * sensorWidthMm) / sceneWidthM : 0;
}

export function horizontalFovDeg(focalMm: number, sensorWidthMm: number) {
  return focalMm > 0 ? (2 * Math.atan(sensorWidthMm / (2 * focalMm)) * 180) / Math.PI : 0;
}

/** Horizontal extent of the scene captured at a given distance. */
export function sceneWidthAtDistanceM(distanceM: number, fovDeg: number) {
  const fovRad = (fovDeg * Math.PI) / 180;
  return 2 * Math.max(0, distanceM) * Math.tan(fovRad / 2);
}

export function pixelsPerMeter(widthPx: number, sceneWidthM: number) {
  return sceneWidthM > 0 ? widthPx / sceneWidthM : 0;
}

/** Distance at which a horizontal resolution reaches the given pixel density. */
export function distanceForPixelDensity(widthPx: number, fovDeg: number, ppm: number) {
  const fovRad = (fovDeg * Math.PI) / 180;
  const denominator = 2 * Math.tan(fovRad / 2);
  return denominator > 0 && ppm > 0 ? widthPx / (ppm * denominator) : 0;
}

/** EN 62676-4 DORI distances. Observation uses the 62 px/m value already shipped in the tool. */
export function doriDistances(widthPx: number, fovDeg: number) {
  return {
    detection: distanceForPixelDensity(widthPx, fovDeg, 25),
    observation: distanceForPixelDensity(widthPx, fovDeg, 62),
    recognition: distanceForPixelDensity(widthPx, fovDeg, 125),
    identification: distanceForPixelDensity(widthPx, fovDeg, 250)
  };
}

/** Common horizontal pixel counts keyed by nominal megapixel rating. */
export function horizontalPixelsForMegapixel(megapixel: number) {
  const table: [number, number][] = [
    [1, 1280],
    [2, 1920],
    [3, 2048],
    [4, 2560],
    [5, 2592],
    [6, 3072],
    [8, 3840],
    [12, 4000]
  ];
  let closest = table[0];
  for (const entry of table) {
    if (Math.abs(entry[0] - megapixel) < Math.abs(closest[0] - megapixel)) closest = entry;
  }
  return closest[1];
}
