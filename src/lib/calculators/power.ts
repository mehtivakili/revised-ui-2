export type UpsRating = {
  capacityVa: number;
  outputPowerW: number;
  backupMinutesAtHalfLoad: number;
};

export function calculateUpsRequirements(loadW: number, powerFactor = 0.85, safetyFactor = 1.25) {
  const cleanLoad = Math.max(0, loadW);
  return {
    loadW: cleanLoad,
    requiredOutputW: cleanLoad * safetyFactor,
    requiredCapacityVa: cleanLoad / Math.max(0.1, powerFactor) * safetyFactor
  };
}

export function estimateUpsRuntimeMinutes(ups: UpsRating, loadW: number) {
  if (loadW <= 0 || ups.outputPowerW <= 0 || ups.backupMinutesAtHalfLoad <= 0) return 0;
  const referenceLoadW = ups.outputPowerW * 0.5;
  return ups.backupMinutesAtHalfLoad * referenceLoadW / loadW;
}

export function evaluateUps(ups: UpsRating, loadW: number, requiredRuntimeMin: number) {
  const requirements = calculateUpsRequirements(loadW);
  const estimatedRuntimeMin = estimateUpsRuntimeMinutes(ups, loadW);
  return {
    ...requirements,
    estimatedRuntimeMin,
    wattCapacityOk: ups.outputPowerW >= requirements.requiredOutputW,
    vaCapacityOk: ups.capacityVa >= requirements.requiredCapacityVa,
    runtimeOk: estimatedRuntimeMin >= requiredRuntimeMin
  };
}

