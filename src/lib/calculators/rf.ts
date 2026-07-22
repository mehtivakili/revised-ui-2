/** Shared RF maths for the wireless, fresnel and ACK tools and the assistant. */

export const speedOfLightKmPerSecond = 299_792.458;

export function freeSpacePathLossDb(distanceKm: number, frequencyMHz: number) {
  return frequencyMHz > 0 && distanceKm > 0
    ? 32.44 + 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMHz)
    : 0;
}

export type LinkBudgetInput = {
  txPower: number;
  txGain: number;
  txLoss: number;
  rxGain: number;
  rxLoss: number;
  frequencyMHz: number;
  distanceKm: number;
};

export function calculateLinkBudget(input: LinkBudgetInput) {
  const fspl = freeSpacePathLossDb(input.distanceKm, input.frequencyMHz);
  const rxPower = input.txPower + input.txGain - input.txLoss + input.rxGain - input.rxLoss - fspl;
  return { fspl, rxPower };
}

/** Radius of the first Fresnel zone at the midpoint of the link, in metres. */
export function fresnelRadiusM(distanceKm: number, frequencyGHz: number) {
  return distanceKm > 0 && frequencyGHz > 0 ? 17.32 * Math.sqrt(distanceKm / (4 * frequencyGHz)) : 0;
}

/**
 * Round-trip propagation time used to size the ACK timeout, in microseconds.
 * Both the path and the speed of light are in kilometres, so the ratio is seconds.
 */
export function ackRoundTripMicroseconds(distanceKm: number) {
  return distanceKm > 0 ? ((2 * distanceKm) / speedOfLightKmPerSecond) * 1e6 : 0;
}
