import type { CameraSpecs, ProjectBrief, RecommendationResult, SurveillanceTask } from "@/src/domain/catalog/types";
import { query } from "@/src/lib/db";

export type BitrateCalibrationFactors = Partial<Record<SurveillanceTask, number>>;

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS bitrate_calibration_samples (
    id BIGSERIAL PRIMARY KEY,
    product_id TEXT,
    zone_task TEXT NOT NULL,
    expected_kbps NUMERIC(12,2) NOT NULL,
    observed_kbps NUMERIC(12,2) NOT NULL,
    calculation_version TEXT NOT NULL,
    input_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

export async function getBitrateCalibrationFactors(): Promise<BitrateCalibrationFactors> {
  try {
    await ensureTable();
    const result = await query(`SELECT zone_task, COUNT(*)::int AS samples,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY observed_kbps / NULLIF(expected_kbps,0)) AS factor
      FROM bitrate_calibration_samples GROUP BY zone_task HAVING COUNT(*) >= 2`);
    return Object.fromEntries(result.rows.map((row) => [row.zone_task, Math.max(.5, Math.min(2.5, Number(row.factor))) ])) as BitrateCalibrationFactors;
  } catch { return {}; }
}

export async function saveBitrateCalibrationSamples(brief: ProjectBrief, result: RecommendationResult) {
  const plan = result.plans[0];
  const measuredZones = (brief.zones || []).filter((zone) => zone.measuredBitrateKbps && zone.measuredBitrateKbps > 0);
  if (!plan || !measuredZones.length) return;
  try {
    await ensureTable();
    for (const zone of measuredZones) {
      const placement = plan.engineeringMap.placements.find((item) => item.zoneId === zone.id);
      const product = plan.items.find((item) => item.product.id === placement?.productId)?.product;
      if (!placement || !product || product.category !== "camera") continue;
      const expectedKbps = (product.specs as CameraSpecs).recommendedBitrateKbps;
      await query(`INSERT INTO bitrate_calibration_samples (product_id,zone_task,expected_kbps,observed_kbps,calculation_version,input_fingerprint)
        VALUES ($1,$2,$3,$4,$5,$6)`, [product.id, zone.goal, expectedKbps, zone.measuredBitrateKbps, result.calculation.engineVersion, result.calculation.inputFingerprint]);
    }
  } catch { /* Calibration must never block a recommendation. */ }
}
