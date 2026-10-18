import { randomUUID } from "crypto";
import { query } from "@/src/lib/db";

/**
 * Saved calculation versions (the report page's «ذخیره پلن و نسخه محاسبه»).
 *
 * Each save stores the full brief, plan and calculation, so the table is the heaviest
 * per-user growth on the server. While the service is free, each account keeps only its
 * newest versions; older ones are removed as new ones arrive. Version numbers keep
 * counting up, so a pruned history never reuses a number.
 */

export const DEFAULT_CALCULATION_VERSIONS_PER_USER = 10;

/** How many versions this account keeps, or null for no limit. */
export function calculationVersionLimitFor(role: string | undefined): number | null {
  if (role === "admin") return null;
  const configured = Number(process.env.CALCULATION_VERSIONS_PER_USER);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_CALCULATION_VERSIONS_PER_USER;
}

let ready: Promise<void> | null = null;

export function ensureCalculationVersionsTable(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS project_calculation_versions (
      id UUID PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      version_number INTEGER NOT NULL,
      project JSONB NOT NULL,
      plan JSONB NOT NULL,
      quantities JSONB NOT NULL,
      calculation JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, version_number)
    )`);
    await query("CREATE INDEX IF NOT EXISTS project_calculation_versions_user_created_idx ON project_calculation_versions (user_id, created_at DESC)");
  })();
  return ready;
}

export type CalculationVersionInput = {
  project: unknown;
  plan: unknown;
  quantities: unknown;
  calculation: unknown;
};

export type SavedCalculationVersion = { id: string; version_number: number; created_at: string };

export async function listCalculationVersions(userId: string) {
  await ensureCalculationVersionsTable();
  const result = await query(
    `SELECT id, version_number, calculation, created_at,
      project->>'projectType' AS project_type, plan->>'title' AS plan_title
     FROM project_calculation_versions WHERE user_id=$1 ORDER BY version_number DESC LIMIT 50`,
    [userId]
  );
  return result.rows;
}

/** Stores a version, then trims the account back to its newest `limit` versions. */
export async function saveCalculationVersion(
  userId: string,
  input: CalculationVersionInput,
  limit: number | null
): Promise<SavedCalculationVersion> {
  await ensureCalculationVersionsTable();
  // $2 is used twice; without the cast Postgres deduces two different types for it and
  // refuses the statement ("inconsistent types deduced for parameter $2").
  const result = await query(
    `INSERT INTO project_calculation_versions (id,user_id,version_number,project,plan,quantities,calculation)
     VALUES ($1,$2::varchar,(SELECT COALESCE(MAX(version_number),0)+1 FROM project_calculation_versions WHERE user_id=$2::varchar),$3,$4,$5,$6)
     RETURNING id,version_number,created_at`,
    [
      randomUUID(), userId,
      JSON.stringify(input.project), JSON.stringify(input.plan),
      JSON.stringify(input.quantities), JSON.stringify(input.calculation)
    ]
  );
  if (limit !== null) await pruneCalculationVersions(userId, limit);
  return result.rows[0] as SavedCalculationVersion;
}

/** Deletes all but the newest `keep` versions of one account. Returns how many went. */
export async function pruneCalculationVersions(userId: string, keep: number): Promise<number> {
  await ensureCalculationVersionsTable();
  const result = await query(
    `DELETE FROM project_calculation_versions
     WHERE user_id = $1 AND version_number <= (
       SELECT version_number FROM project_calculation_versions
       WHERE user_id = $1 ORDER BY version_number DESC OFFSET $2 LIMIT 1
     )`,
    [userId, Math.max(0, Math.floor(keep))]
  );
  return result.rowCount ?? 0;
}
