import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import { duplicateProject, ProjectLimitError, projectLimitFor } from "@/src/lib/projects/store";
import { PROJECT_LIMIT_CODE, projectLimitMessage } from "@/src/lib/projects/limits";

type Context = { params: Promise<{ id: string }> };

/** Copies a project so a similar site can be started without risking the original. */
export async function POST(_request: NextRequest, context: Context) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "برای کپی پروژه وارد حساب شوید." }, { status: 401 });
  }
  const { id } = await context.params;
  let project;
  try {
    project = await duplicateProject(session.id, id, projectLimitFor(session.role));
  } catch (error) {
    if (error instanceof ProjectLimitError) {
      return NextResponse.json(
        { error: projectLimitMessage(error.limit), code: PROJECT_LIMIT_CODE, limit: error.limit },
        { status: 409 }
      );
    }
    throw error;
  }
  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });
  return NextResponse.json({ project }, { status: 201 });
}
