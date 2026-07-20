import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import { getWooCatalogSyncRun, startWooCatalogSync } from "@/src/lib/catalog/woocommerce";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "دسترسی فقط برای مدیر مجاز است." }, { status: 403 });
  const value = request.nextUrl.searchParams.get("runId");
  const run = await getWooCatalogSyncRun(value ? Number(value) : undefined);
  return NextResponse.json({ run });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "دسترسی فقط برای مدیر مجاز است." }, { status: 403 });
  try {
    const dryRun = request.nextUrl.searchParams.get("dryRun") !== "false";
    return NextResponse.json(await startWooCatalogSync(dryRun), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "خطا در Sync ووکامرس." }, { status: 502 });
  }
}
