export const DECIMAL_KILOBIT = 1_000;
export const DECIMAL_GIGABYTE = 1_000_000_000;
export const DECIMAL_TERABYTE = 1_000_000_000_000;

export function kbpsToMbps(kbps: number) {
  return Math.max(0, kbps) / 1_000;
}

export function storageBytesFromKbps(kbps: number, hoursPerDay: number, days: number) {
  return (Math.max(0, kbps) * DECIMAL_KILOBIT / 8)
    * 3_600
    * Math.max(0, hoursPerDay)
    * Math.max(0, days);
}

export function storageFromKbps(kbps: number, hoursPerDay: number, days: number) {
  const bytes = storageBytesFromKbps(kbps, hoursPerDay, days);
  return {
    bytes,
    gigabytes: bytes / DECIMAL_GIGABYTE,
    terabytes: bytes / DECIMAL_TERABYTE
  };
}

export function decimalDiskBytes(size: number, unit: "GB" | "TB") {
  return Math.max(0, size) * (unit === "TB" ? DECIMAL_TERABYTE : DECIMAL_GIGABYTE);
}

export type SurveillanceStorageInput = {
  totalVideoBitrateKbps: number;
  cameraCount: number;
  archiveDays: number;
  recordingMode: "continuous" | "motion";
  motionActivityPercent: number;
  bitrateMode: "CBR" | "VBR";
  recordAudio: boolean;
  audioBitrateKbps: number;
  filesystemOverheadPercent: number;
  vbrSafetyMarginPercent: number;
  reservePercent: number;
};

export function calculateSurveillanceStorage(input: SurveillanceStorageInput) {
  const recordingDutyCycle = input.recordingMode === "continuous"
    ? 1
    : Math.max(0.01, Math.min(1, input.motionActivityPercent / 100));
  const effectiveVideoKbps = Math.max(0, input.totalVideoBitrateKbps) * recordingDutyCycle;
  const effectiveAudioKbps = input.recordAudio
    ? Math.max(0, input.audioBitrateKbps) * Math.max(0, input.cameraCount) * recordingDutyCycle
    : 0;
  const baseStorageTb = storageFromKbps(effectiveVideoKbps + effectiveAudioKbps, 24, input.archiveDays).terabytes;
  const vbrFactor = input.bitrateMode === "VBR" ? 1 + Math.max(0, input.vbrSafetyMarginPercent) / 100 : 1;
  const filesystemFactor = 1 + Math.max(0, input.filesystemOverheadPercent) / 100;
  const reserveFactor = 1 + Math.max(0, input.reservePercent) / 100;
  const requiredStorageTb = baseStorageTb * vbrFactor * filesystemFactor * reserveFactor;

  return {
    recordingDutyCycle,
    effectiveVideoKbps,
    effectiveAudioKbps,
    baseStorageTb,
    requiredStorageTb,
    vbrFactor,
    filesystemFactor,
    reserveFactor
  };
}
