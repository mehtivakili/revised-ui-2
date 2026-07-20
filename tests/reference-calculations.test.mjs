import test from "node:test";
import assert from "node:assert/strict";

import { calculateIpv4Details, calculateIpv4Prefix } from "../src/lib/calculators/ipv4.ts";
import { evaluateUps, estimateUpsRuntimeMinutes } from "../src/lib/calculators/power.ts";
import { calculateRaidUsable } from "../src/lib/calculators/raid.ts";
import { compareLowLightPerformance } from "../src/lib/calculators/sensitivity.ts";
import { calculateSurveillanceStorage, storageFromKbps } from "../src/lib/calculators/storage.ts";
import { dbmToMilliwatts, milliwattsToDbm } from "../src/lib/calculators/wireless.ts";
import { evaluateCameraForZone } from "../src/lib/recommendation/camera-constraints.ts";
import { buildEngineeringMap, calculateInfrastructure, groundFrustumDistances } from "../src/lib/recommendation/engineering-layout.ts";

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test("1 Mbps recorded for 24 hours uses 10.8 decimal GB per day", () => {
  const result = storageFromKbps(1_000, 24, 1);
  closeTo(result.gigabytes, 10.8);
  closeTo(result.terabytes, 0.0108);
});

test("storage grows monotonically with bitrate and archive days", () => {
  const baseline = storageFromKbps(2_000, 24, 15).terabytes;
  assert.ok(storageFromKbps(3_000, 24, 15).terabytes > baseline);
  assert.ok(storageFromKbps(2_000, 24, 30).terabytes > baseline);
});

test("Motion, VBR, audio and explicit overheads are visible in storage", () => {
  const result = calculateSurveillanceStorage({
    totalVideoBitrateKbps: 10_000,
    cameraCount: 4,
    archiveDays: 30,
    recordingMode: "motion",
    motionActivityPercent: 50,
    bitrateMode: "VBR",
    recordAudio: true,
    audioBitrateKbps: 64,
    filesystemOverheadPercent: 5,
    vbrSafetyMarginPercent: 20,
    reservePercent: 10
  });
  closeTo(result.recordingDutyCycle, 0.5);
  closeTo(result.effectiveVideoKbps, 5_000);
  closeTo(result.effectiveAudioKbps, 128);
  closeTo(result.requiredStorageTb, result.baseStorageTb * 1.2 * 1.05 * 1.1);
});

test("reference RAID capacities use the smallest disk", () => {
  assert.equal(calculateRaidUsable([4, 4], "1").usableTb, 4);
  assert.equal(calculateRaidUsable([4, 4, 4, 4], "5").usableTb, 12);
  assert.equal(calculateRaidUsable([4, 4, 4, 4, 4, 4], "6").usableTb, 16);
  assert.equal(calculateRaidUsable([4, 4, 4, 4], "10").usableTb, 8);
  assert.equal(calculateRaidUsable([8, 8, 4], "5").usableTb, 8);
});

test("RAID usable capacity never exceeds installed raw capacity", () => {
  for (const level of ["none", "0", "1", "5", "6", "10"]) {
    const result = calculateRaidUsable([6, 6, 6, 6, 6, 6], level);
    assert.ok(result.usableTb <= result.rawTb);
  }
});

test("IPv4 /31 P2P exposes both addresses without broadcast", () => {
  assert.equal(calculateIpv4Prefix(31, "point-to-point").hosts, 2);
  const details = calculateIpv4Details([192, 0, 2, 10], 31, "point-to-point");
  assert.equal(details.firstHost, "192.0.2.10");
  assert.equal(details.lastHost, "192.0.2.11");
  assert.equal(details.broadcast, null);
});

test("IPv4 /32 host route exposes exactly its own address", () => {
  assert.equal(calculateIpv4Prefix(32, "host-route").hosts, 1);
  const details = calculateIpv4Details([203, 0, 113, 7], 32, "host-route");
  assert.equal(details.firstHost, "203.0.113.7");
  assert.equal(details.lastHost, "203.0.113.7");
  assert.equal(details.broadcast, null);
});

test("mW and dBm reference conversions round-trip", () => {
  assert.equal(milliwattsToDbm(1), 0);
  assert.equal(milliwattsToDbm(100), 20);
  closeTo(dbmToMilliwatts(20), 100);
  assert.equal(milliwattsToDbm(0), null);
});

test("low-light comparison separates aperture and pixel-area effects", () => {
  const result = compareLowLightPerformance(
    { fNumber: 1.4, sensorWidthMm: 4.8, horizontalPixels: 2_400 },
    { fNumber: 2.8, sensorWidthMm: 4.8, horizontalPixels: 2_400 }
  );
  closeTo(result.lensRatio, 4);
  closeTo(result.pixelAreaRatio, 1);
  closeTo(result.combinedRatio, 4);
  closeTo(result.lensStops, 2);
});

test("camera selection uses scene PPM and mounting geometry", () => {
  const camera = {
    technology: "IP", cameraType: "bullet", resolutionMp: 4, resolutionWidth: 2688, resolutionHeight: 1520,
    sensorFormat: "1/2.8\"", focalMinMm: 2.8, focalMaxMm: 12, horizontalFovMin: 25, horizontalFovMax: 100,
    maxFps: 25, codecs: ["H.265"], recommendedBitrateKbps: 3_000, irRangeM: 50,
    doriDetectM: 0, doriObserveM: 0, doriRecognizeM: 0, doriIdentifyM: 0,
    microphone: false, speaker: false, poe: true, maxPowerW: 8, ipRating: "IP67", aiFeatures: []
  };
  const zone = {
    id: "z1", name: "صحنه", cameraCount: 1, outdoor: false, goal: "monitor",
    targetDistanceM: 10, sceneWidthM: 10, mountingHeightM: 3, targetHeightM: 1.5, cameraTiltDeg: 9, minimumPpm: 200
  };
  const accepted = evaluateCameraForZone(camera, zone, { audioRequired: false, lowLightPriority: false, localRecordingFallback: false });
  assert.equal(accepted.accepted, true);
  assert.ok(accepted.actualPpm >= 200);
  const wider = evaluateCameraForZone(camera, { ...zone, sceneWidthM: 16 }, { audioRequired: false, lowLightPriority: false, localRecordingFallback: false });
  assert.ok(wider.actualPpm < accepted.actualPpm);
  const wrongTilt = evaluateCameraForZone(camera, { ...zone, cameraTiltDeg: 70 }, { audioRequired: false, lowLightPriority: false, localRecordingFallback: false });
  assert.equal(wrongTilt.accepted, false);
});

test("UPS checks watts, VA, safety margin and runtime at actual load", () => {
  const ups = { capacityVa: 1_000, outputPowerW: 800, backupMinutesAtHalfLoad: 20 };
  const evaluation = evaluateUps(ups, 400, 20);
  assert.equal(evaluation.wattCapacityOk, true);
  assert.equal(evaluation.vaCapacityOk, true);
  assert.equal(evaluation.runtimeOk, true);
  closeTo(evaluation.requiredOutputW, 500);
  closeTo(evaluation.estimatedRuntimeMin, 20);
  assert.ok(estimateUpsRuntimeMinutes(ups, 600) < estimateUpsRuntimeMinutes(ups, 300));
});

test("ground frustum intersects the near and far ground limits", () => {
  const pitched = groundFrustumDistances(3, 0, 35, 40, 50);
  assert.ok(pitched.nearGroundM >= 0);
  assert.ok(pitched.farGroundM > pitched.nearGroundM);
  const horizonVisible = groundFrustumDistances(3, 0, 10, 40, 50);
  assert.equal(horizonVisible.farGroundM, 50);
});

test("engineering map creates multi-camera placements, PPM heatmap and blind spots", () => {
  const zone = {
    id: "parking", name: "پارکینگ", cameraCount: 3, outdoor: false, goal: "monitor",
    targetDistanceM: 12, sceneWidthM: 10, mountingHeightM: 3, targetHeightM: 1.5,
    cameraTiltDeg: 25, minimumPpm: 125
  };
  const brief = {
    projectType: "parking", cameraCount: 3, outdoorCount: 0, entrances: 1, goal: "monitor",
    archiveDays: 30, budget: "balanced", siteAreaM2: 600, floors: 2,
    recordingMode: "continuous", motionActivityPercent: 100, bitrateMode: "CBR", recordAudio: false,
    audioBitrateKbps: 0, filesystemOverheadPercent: 5, vbrSafetyMarginPercent: 0, reservePercent: 10,
    zones: [zone]
  };
  const map = buildEngineeringMap(brief, [{
    zone, productId: "camera-1", productName: "Reference camera", resolutionWidth: 2688,
    horizontalFovDeg: 90, verticalFovDeg: 50, actualPpm: 268.8
  }], 12, 8);
  assert.equal(map.placements.length, 3);
  assert.equal(map.heatmap.length, 96);
  assert.ok(map.placements.every((placement) => placement.coveragePolygon.length === 4 && placement.targetPlane.ppm > 0));
  assert.ok(map.blindSpotPercent >= 0 && map.blindSpotPercent <= 100);
  assert.ok(map.heatmap.some((cell) => cell.cameraCount > 0));

  const infrastructure = calculateInfrastructure(brief, map, 2, 180, 225);
  assert.ok(infrastructure.copperCableM > 0);
  assert.ok(infrastructure.fiberBackboneM > 0);
  assert.equal(infrastructure.rackCount, 2);
  assert.ok(infrastructure.recommendedRackU >= infrastructure.patchPanelCount + 2);
  assert.equal(infrastructure.upsRequiredW, 225);
});
