import { NextResponse } from "next/server";
import { getSmsConfig, updateSmsConfig } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";

async function requireAdmin() {
  const session = await getCurrentSession();
  return session?.role === "admin";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, config: getSmsConfig() });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const config = updateSmsConfig({
    providerName: String(body?.providerName ?? ""),
    apiUrl: String(body?.apiUrl ?? ""),
    senderNumber: String(body?.senderNumber ?? ""),
    apiKey: String(body?.apiKey ?? ""),
    templateId: String(body?.templateId ?? ""),
    timeoutSeconds: Number(body?.timeoutSeconds ?? 8),
    enabled: Boolean(body?.enabled)
  });

  return NextResponse.json({ ok: true, config });
}
