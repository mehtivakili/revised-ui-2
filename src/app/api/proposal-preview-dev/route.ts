// TEMPORARY dev-only fixture for checking the printed proposal. Delete after use.
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

const file = path.join(os.tmpdir(), "hamyar-proposal-fixture.json");

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({}, { status: 404 });
  fs.writeFileSync(file, await request.text());
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({}, { status: 404 });
  return new NextResponse(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "null", { headers: { "content-type": "application/json" } });
}
