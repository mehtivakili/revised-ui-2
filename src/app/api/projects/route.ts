import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import {
  AssetTooLargeError,
  createProject,
  listProjects,
  ProjectLimitError,
  projectLimitFor
} from "@/src/lib/projects/store";
import { PROJECT_LIMIT_CODE, projectLimitMessage } from "@/src/lib/projects/limits";

/**
 * The project collection.
 *
 * Every query is scoped by the session's user id rather than anything the caller sends,
 * so there is no request shape that reaches another account's work. Each account may keep
 * a limited number of designs (`projectLimitFor`); the list reports the limit so the page
 * can show how much room is left.
 */

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "برای دیدن پروژه‌ها وارد حساب شوید." }, { status: 401 });
  }
  const projects = await listProjects(session.id);
  return NextResponse.json({ projects, limit: projectLimitFor(session.role) });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "برای ذخیره پروژه وارد حساب شوید." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim() || !body.plan) {
    return NextResponse.json({ error: "نام پروژه و نقشه لازم است." }, { status: 400 });
  }

  try {
    const project = await createProject(session.id, {
      name: body.name.trim(),
      venueTypeId: body.venueTypeId ?? null,
      status: body.status ?? "draft",
      brief: body.brief ?? {},
      plan: body.plan,
      templates: body.templates ?? [],
      quantities: body.quantities ?? {},
      result: body.result,
      thumbnail: body.thumbnail ?? null
    }, projectLimitFor(session.role));
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectLimitError) {
      return NextResponse.json(
        { error: projectLimitMessage(error.limit), code: PROJECT_LIMIT_CODE, limit: error.limit },
        { status: 409 }
      );
    }
    if (error instanceof AssetTooLargeError) {
      return NextResponse.json(
        {
          error: `تصویر نقشه طبقه «${error.floorName}» بزرگ‌تر از حد مجاز است. آن را فشرده کنید و دوباره تلاش کنید.`,
          code: "ASSET_TOO_LARGE"
        },
        { status: 413 }
      );
    }
    throw error;
  }
}
