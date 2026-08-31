import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import {
  AssetTooLargeError,
  deleteProject,
  getProject,
  updateProject
} from "@/src/lib/projects/store";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "برای باز کردن پروژه وارد حساب شوید." }, { status: 401 });
  }
  const { id } = await context.params;
  const project = await getProject(session.id, id);
  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });
  return NextResponse.json({ project });
}

/**
 * Replaces the project.
 *
 * Editing overwrites the same row rather than creating a new one — the behaviour asked
 * for. The store keeps the superseded state in `project_revisions` so the overwrite is
 * recoverable even though it is not exposed in the interface.
 */
export async function PUT(request: NextRequest, context: Context) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "برای ذخیره پروژه وارد حساب شوید." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim() || !body.plan) {
    return NextResponse.json({ error: "نام پروژه و نقشه لازم است." }, { status: 400 });
  }

  try {
    const project = await updateProject(session.id, id, {
      name: body.name.trim(),
      venueTypeId: body.venueTypeId ?? null,
      status: body.status ?? "draft",
      brief: body.brief ?? {},
      plan: body.plan,
      templates: body.templates ?? [],
      quantities: body.quantities ?? {},
      result: body.result,
      thumbnail: body.thumbnail ?? null
    });
    if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof AssetTooLargeError) {
      return NextResponse.json(
        {
          error: `تصویر نقشه طبقه «${error.floorName}» بزرگ‌تر از حد مجاز است.`,
          code: "ASSET_TOO_LARGE"
        },
        { status: 413 }
      );
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "برای حذف پروژه وارد حساب شوید." }, { status: 401 });
  }
  const { id } = await context.params;
  const removed = await deleteProject(session.id, id);
  if (!removed) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
