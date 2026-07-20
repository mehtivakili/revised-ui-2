export type LowLightCamera = {
  fNumber: number;
  sensorWidthMm: number;
  horizontalPixels: number;
};

export function compareLowLightPerformance(first: LowLightCamera, second: LowLightCamera) {
  const values = [...Object.values(first), ...Object.values(second)];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    return {
      valid: false,
      firstPitchUm: 0,
      secondPitchUm: 0,
      lensRatio: 0,
      lensStops: 0,
      pixelAreaRatio: 0,
      combinedRatio: 0,
      combinedStops: 0
    };
  }

  const firstPitchUm = first.sensorWidthMm * 1_000 / first.horizontalPixels;
  const secondPitchUm = second.sensorWidthMm * 1_000 / second.horizontalPixels;
  const lensRatio = (second.fNumber / first.fNumber) ** 2;
  const pixelAreaRatio = (firstPitchUm / secondPitchUm) ** 2;
  const combinedRatio = lensRatio * pixelAreaRatio;

  return {
    valid: true,
    firstPitchUm,
    secondPitchUm,
    lensRatio,
    lensStops: Math.log2(lensRatio),
    pixelAreaRatio,
    combinedRatio,
    combinedStops: Math.log2(combinedRatio)
  };
}
