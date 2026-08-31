import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import { duplicateProject } from "@/src/lib/projects/store";

type Context = { params: Promise<{ id: string }> };

/** Copies a project so a similar site can be started without risking the original. */
export async function POST(_request: NextRequest, context: Context) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "برای کپی پروژه وارد حساب شوید." }, { status: 401 });
  }
  const { id } = await context.params;
  const project = await duplicateProject(session.id, id);
  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });
  return NextResponse.json({ project }, { status: 201 });
}
