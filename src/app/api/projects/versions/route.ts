import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/src/lib/db";
import { getCurrentSession } from "@/src/lib/session";

async function ensureTable() {
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
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "برای مشاهده نسخه‌ها وارد حساب شوید." }, { status: 401 });
  await ensureTable();
  const result = await query(
    `SELECT id, version_number, calculation, created_at,
      project->>'projectType' AS project_type, plan->>'title' AS plan_title
     FROM project_calculation_versions WHERE user_id=$1 ORDER BY version_number DESC LIMIT 50`,
    [session.id]
  );
  return NextResponse.json({ versions: result.rows });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "برای ذخیره نسخه وارد حساب شوید." }, { status: 401 });
  const body = await request.json();
  if (!body?.project || !body?.plan || !Array.isArray(body?.quantities) || !body?.calculation?.engineVersion || !Array.isArray(body?.calculation?.standardVersions)) {
    return NextResponse.json({ error: "داده نسخه محاسبه کامل نیست." }, { status: 400 });
  }
  await ensureTable();
  const id = randomUUID();
  const result = await query(
    `INSERT INTO project_calculation_versions (id,user_id,version_number,project,plan,quantities,calculation)
     VALUES ($1,$2,(SELECT COALESCE(MAX(version_number),0)+1 FROM project_calculation_versions WHERE user_id=$2),$3,$4,$5,$6)
     RETURNING id,version_number,created_at`,
    [id, session.id, JSON.stringify(body.project), JSON.stringify(body.plan), JSON.stringify(body.quantities), JSON.stringify(body.calculation)]
  );
  return NextResponse.json({ ok: true, version: result.rows[0] }, { status: 201 });
}
