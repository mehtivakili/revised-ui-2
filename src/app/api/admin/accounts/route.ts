import { NextResponse } from "next/server";
import { deleteUser, listUsers } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";

async function requireAdmin() {
  const session = await getCurrentSession();
  return session?.role === "admin" ? session : null;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });

  return NextResponse.json({ ok: true, users: listUsers() });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  const result = deleteUser(id, session.id);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, users: listUsers() });
}
