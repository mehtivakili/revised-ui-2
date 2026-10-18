import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import {
  calculationVersionLimitFor,
  listCalculationVersions,
  saveCalculationVersion
} from "@/src/lib/projects/versions";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "برای مشاهده نسخه‌ها وارد حساب شوید." }, { status: 401 });
  const versions = await listCalculationVersions(session.id);
  return NextResponse.json({ versions, limit: calculationVersionLimitFor(session.role) });
}

/**
 * Saves a calculation version. Each account keeps only its newest versions
 * (`calculationVersionLimitFor`); older ones are trimmed as a new one is saved.
 */
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "برای ذخیره نسخه وارد حساب شوید." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.project || !body?.plan || !Array.isArray(body?.quantities) || !body?.calculation?.engineVersion || !Array.isArray(body?.calculation?.standardVersions)) {
    return NextResponse.json({ error: "داده نسخه محاسبه کامل نیست." }, { status: 400 });
  }
  const limit = calculationVersionLimitFor(session.role);
  const version = await saveCalculationVersion(
    session.id,
    { project: body.project, plan: body.plan, quantities: body.quantities, calculation: body.calculation },
    limit
  );
  return NextResponse.json({ ok: true, version, limit }, { status: 201 });
}
