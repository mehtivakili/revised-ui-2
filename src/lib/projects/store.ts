import { randomUUID } from "crypto";
import { query } from "@/src/lib/db";
import type { BuildingPlan } from "@/src/domain/planner/types";
import { floorAreaM2 } from "@/src/lib/planner/geometry";

/**
 * Storage for saved designs.
 *
 * A project is one row plus its uploaded plan images. The images are the reason for the
 * split: they arrive as base64 data URLs embedded in the plan, and a four-storey project
 * with scanned drawings runs to double-digit megabytes. Left inline, listing ten
 * projects would mean reading a hundred megabytes of image data just to print their
 * names — so they are lifted out on save and re-linked on load.
 */

export type ProjectSummary = {
  areaM2: number;
  floorCount: number;
  cameraCount: number;
  roomCount: number;
  assignedRoomCount: number;
};

export type ProjectListRow = {
  id: string;
  name: string;
  venueTypeId: string | null;
  status: string;
  summary: ProjectSummary;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = ProjectListRow & {
  brief: unknown;
  plan: BuildingPlan;
  templates: unknown;
  quantities: unknown;
  result: unknown;
  revision: number;
};

export type ProjectInput = {
  name: string;
  venueTypeId?: string | null;
  status?: string;
  brief: unknown;
  plan: BuildingPlan;
  templates?: unknown;
  quantities?: unknown;
  result?: unknown;
  thumbnail?: string | null;
};

/** Anything larger is refused with a clear message rather than a database error. */
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
/** How many superseded versions to keep. Editing replaces; this is only an undo net. */
const REVISIONS_KEPT = 5;

let ready: Promise<void> | null = null;

export function ensureProjectTables(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      name TEXT NOT NULL,
      venue_type_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      thumbnail TEXT,
      brief JSONB NOT NULL DEFAULT '{}'::jsonb,
      plan JSONB NOT NULL DEFAULT '{}'::jsonb,
      templates JSONB NOT NULL DEFAULT '[]'::jsonb,
      quantities JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(
      "CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects (user_id, updated_at DESC)"
    );
    await query(`CREATE TABLE IF NOT EXISTS project_assets (
      id UUID PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      floor_id TEXT,
      mime TEXT NOT NULL,
      bytes BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(
      "CREATE INDEX IF NOT EXISTS project_assets_project_idx ON project_assets (project_id)"
    );
    await query(`CREATE TABLE IF NOT EXISTS project_revisions (
      id UUID PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(
      "CREATE INDEX IF NOT EXISTS project_revisions_project_idx ON project_revisions (project_id, revision DESC)"
    );
  })();
  return ready;
}

/* ── Summary ───────────────────────────────────────────────────────── */

/**
 * The handful of numbers the gallery shows.
 *
 * Computed once on save and stored beside the project, because deriving them at list
 * time would mean parsing every saved plan in full.
 */
export function summarise(plan: BuildingPlan): ProjectSummary {
  const floors = plan?.floors ?? [];
  const rooms = floors.flatMap((floor) => floor.rooms ?? []);
  return {
    areaM2: Math.round(floors.reduce((sum, floor) => sum + floorAreaM2(floor.walls ?? []), 0)),
    floorCount: floors.length,
    cameraCount: floors.reduce((sum, floor) => sum + (floor.cameras?.length ?? 0), 0),
    roomCount: rooms.length,
    assignedRoomCount: rooms.filter((room) => Boolean(room.sectionTypeId)).length
  };
}

/* ── Image extraction ──────────────────────────────────────────────── */

type PendingAsset = { id: string; floorId: string; mime: string; bytes: Buffer };

const dataUrlPattern = /^data:([^;,]+);base64,(.+)$/s;

/**
 * Pulls inline images out of a plan, returning a plan that references them by id.
 *
 * Only data URLs are touched. A backdrop that already carries an `asset:` reference is
 * an image saved on an earlier pass and is left exactly as it is, so re-saving a project
 * does not duplicate its drawings on every keystroke of the autosave.
 */
export function extractAssets(plan: BuildingPlan): { plan: BuildingPlan; assets: PendingAsset[] } {
  const assets: PendingAsset[] = [];
  const floors = (plan?.floors ?? []).map((floor) => {
    const url = floor.backdrop?.imageUrl;
    if (!url) return floor;
    const match = dataUrlPattern.exec(url);
    if (!match) return floor;

    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > MAX_ASSET_BYTES) {
      throw new AssetTooLargeError(floor.name || floor.id, bytes.byteLength);
    }
    const id = randomUUID();
    assets.push({ id, floorId: floor.id, mime: match[1], bytes });
    return { ...floor, backdrop: { ...floor.backdrop!, imageUrl: `asset:${id}` } };
  });
  return { plan: { ...plan, floors }, assets };
}

export class AssetTooLargeError extends Error {
  /* Written out rather than declared as constructor parameter properties: Node's
     type-stripping loader rejects that syntax, and the tests import this directly. */
  floorName: string;
  bytes: number;

  constructor(floorName: string, bytes: number) {
    super(`asset too large on floor ${floorName}`);
    this.name = "AssetTooLargeError";
    this.floorName = floorName;
    this.bytes = bytes;
  }
}

/** Rewrites stored asset references into URLs the browser can fetch. */
export function linkAssets(plan: BuildingPlan, projectId: string): BuildingPlan {
  const floors = (plan?.floors ?? []).map((floor) => {
    const url = floor.backdrop?.imageUrl;
    if (!url?.startsWith("asset:")) return floor;
    const assetId = url.slice("asset:".length);
    return {
      ...floor,
      backdrop: { ...floor.backdrop!, imageUrl: `/api/projects/${projectId}/assets/${assetId}` }
    };
  });
  return { ...plan, floors };
}

/**
 * Turns a loaded plan back into storage form.
 *
 * The browser sends back whatever it was given, so a plan that was never edited comes
 * home with fetch URLs where the asset references were. Without this the reference would
 * be lost and the drawing orphaned on the next save.
 */
export function unlinkAssets(plan: BuildingPlan, projectId: string): BuildingPlan {
  const prefix = `/api/projects/${projectId}/assets/`;
  const floors = (plan?.floors ?? []).map((floor) => {
    const url = floor.backdrop?.imageUrl;
    if (!url?.startsWith(prefix)) return floor;
    return {
      ...floor,
      backdrop: { ...floor.backdrop!, imageUrl: `asset:${url.slice(prefix.length)}` }
    };
  });
  return { ...plan, floors };
}

/* ── Reads ─────────────────────────────────────────────────────────── */

const toListRow = (row: Record<string, unknown>): ProjectListRow => ({
  id: String(row.id),
  name: String(row.name),
  venueTypeId: (row.venue_type_id as string | null) ?? null,
  status: String(row.status),
  summary: (row.summary as ProjectSummary) ?? summarise({ floors: [] } as unknown as BuildingPlan),
  thumbnail: (row.thumbnail as string | null) ?? null,
  createdAt: new Date(row.created_at as string).toISOString(),
  updatedAt: new Date(row.updated_at as string).toISOString()
});

/** Gallery listing. Deliberately never selects `plan` — that is the heavy column. */
export async function listProjects(userId: string): Promise<ProjectListRow[]> {
  await ensureProjectTables();
  const result = await query(
    `SELECT id, name, venue_type_id, status, summary, thumbnail, created_at, updated_at
     FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 200`,
    [userId]
  );
  return result.rows.map(toListRow);
}

export async function getProject(userId: string, id: string): Promise<ProjectRecord | null> {
  await ensureProjectTables();
  const result = await query(
    `SELECT id, name, venue_type_id, status, summary, thumbnail, brief, plan, templates,
            quantities, result, revision, created_at, updated_at
     FROM projects WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...toListRow(row),
    brief: row.brief,
    plan: linkAssets(row.plan as BuildingPlan, String(row.id)),
    templates: row.templates,
    quantities: row.quantities,
    result: row.result,
    revision: Number(row.revision)
  };
}

/* ── Writes ────────────────────────────────────────────────────────── */

async function writeAssets(projectId: string, assets: PendingAsset[]) {
  for (const asset of assets) {
    await query(
      "INSERT INTO project_assets (id, project_id, floor_id, mime, bytes) VALUES ($1,$2,$3,$4,$5)",
      [asset.id, projectId, asset.floorId, asset.mime, asset.bytes]
    );
  }
}

export async function createProject(userId: string, input: ProjectInput): Promise<ProjectRecord> {
  await ensureProjectTables();
  const id = randomUUID();
  const { plan, assets } = extractAssets(input.plan);

  await query(
    `INSERT INTO projects (id, user_id, name, venue_type_id, status, thumbnail,
                           brief, plan, templates, quantities, result, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id, userId, input.name, input.venueTypeId ?? null, input.status ?? "draft",
      input.thumbnail ?? null,
      JSON.stringify(input.brief ?? {}), JSON.stringify(plan),
      JSON.stringify(input.templates ?? []), JSON.stringify(input.quantities ?? {}),
      input.result === undefined ? null : JSON.stringify(input.result),
      JSON.stringify(summarise(input.plan))
    ]
  );
  await writeAssets(id, assets);
  return (await getProject(userId, id))!;
}

/**
 * Replaces a project in place.
 *
 * This is the behaviour that was asked for: editing overwrites rather than branching.
 * The superseded state is copied into `project_revisions` first, so an accidental
 * overwrite of an afternoon's work is recoverable even though the user never sees a
 * version history.
 */
export async function updateProject(
  userId: string,
  id: string,
  input: ProjectInput
): Promise<ProjectRecord | null> {
  await ensureProjectTables();
  const existing = await query(
    `SELECT revision, name, venue_type_id, status, brief, plan, templates, quantities, result
     FROM projects WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const previous = existing.rows[0];
  if (!previous) return null;

  await query(
    "INSERT INTO project_revisions (id, project_id, revision, snapshot) VALUES ($1,$2,$3,$4)",
    [randomUUID(), id, Number(previous.revision), JSON.stringify(previous)]
  );
  await query(
    `DELETE FROM project_revisions WHERE project_id = $1 AND revision <= $2`,
    [id, Number(previous.revision) - REVISIONS_KEPT]
  );

  // Fetch URLs handed to the browser are turned back into references before extraction,
  // so an untouched drawing keeps pointing at the row already in project_assets.
  const { plan, assets } = extractAssets(unlinkAssets(input.plan, id));

  await query(
    `UPDATE projects SET name=$3, venue_type_id=$4, status=$5, thumbnail=COALESCE($6, thumbnail),
       brief=$7, plan=$8, templates=$9, quantities=$10, result=$11, summary=$12,
       revision=revision+1, updated_at=NOW()
     WHERE id=$1 AND user_id=$2`,
    [
      id, userId, input.name, input.venueTypeId ?? null, input.status ?? "draft",
      input.thumbnail ?? null,
      JSON.stringify(input.brief ?? {}), JSON.stringify(plan),
      JSON.stringify(input.templates ?? []), JSON.stringify(input.quantities ?? {}),
      input.result === undefined ? null : JSON.stringify(input.result),
      JSON.stringify(summarise(input.plan))
    ]
  );
  await writeAssets(id, assets);
  return getProject(userId, id);
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  await ensureProjectTables();
  const result = await query("DELETE FROM projects WHERE id = $1 AND user_id = $2", [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

/** Copies a project, including its drawings, so the original is never put at risk. */
export async function duplicateProject(userId: string, id: string): Promise<ProjectRecord | null> {
  await ensureProjectTables();
  const source = await query(
    `SELECT name, venue_type_id, status, thumbnail, brief, plan, templates, quantities, result, summary
     FROM projects WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = source.rows[0];
  if (!row) return null;

  const copyId = randomUUID();
  await query(
    `INSERT INTO projects (id, user_id, name, venue_type_id, status, thumbnail,
                           brief, plan, templates, quantities, result, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      copyId, userId, `${row.name} — رونوشت`, row.venue_type_id, "draft", row.thumbnail,
      JSON.stringify(row.brief), JSON.stringify(row.plan), JSON.stringify(row.templates),
      JSON.stringify(row.quantities),
      row.result === null ? null : JSON.stringify(row.result),
      JSON.stringify(row.summary)
    ]
  );
  /*
   * Assets are copied rather than shared: deleting the original must not blank the copy.
   * Ids are generated here rather than with gen_random_uuid() so this does not depend on
   * pgcrypto being available on whichever Postgres the deployment happens to run.
   */
  const sourceAssets = await query(
    "SELECT id, floor_id, mime, bytes FROM project_assets WHERE project_id = $1",
    [id]
  );
  const remap = new Map<string, string>();
  for (const asset of sourceAssets.rows) {
    const newId = randomUUID();
    remap.set(String(asset.id), newId);
    await query(
      "INSERT INTO project_assets (id, project_id, floor_id, mime, bytes) VALUES ($1,$2,$3,$4,$5)",
      [newId, copyId, asset.floor_id, asset.mime, asset.bytes]
    );
  }
  // The copied plan still points at the originals, so its references are rewritten.
  if (remap.size > 0) {
    const copied = row.plan as BuildingPlan;
    const floors = (copied?.floors ?? []).map((floor) => {
      const url = floor.backdrop?.imageUrl;
      if (!url?.startsWith("asset:")) return floor;
      const mapped = remap.get(url.slice("asset:".length));
      if (!mapped) return floor;
      return { ...floor, backdrop: { ...floor.backdrop!, imageUrl: `asset:${mapped}` } };
    });
    await query("UPDATE projects SET plan = $2 WHERE id = $1", [
      copyId,
      JSON.stringify({ ...copied, floors })
    ]);
  }
  return getProject(userId, copyId);
}

export async function readAsset(
  userId: string,
  projectId: string,
  assetId: string
): Promise<{ mime: string; bytes: Buffer } | null> {
  await ensureProjectTables();
  const result = await query(
    `SELECT a.mime, a.bytes FROM project_assets a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1 AND a.project_id = $2 AND p.user_id = $3`,
    [assetId, projectId, userId]
  );
  const row = result.rows[0];
  return row ? { mime: String(row.mime), bytes: row.bytes as Buffer } : null;
}
