import { NextResponse } from "next/server";
import { recordUserActivity } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";

export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 401 });
  }

  try {
    await recordUserActivity(session.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("User activity update failed:", error);
    return NextResponse.json({ ok: false, error: "ثبت فعالیت کاربر انجام نشد." }, { status: 500 });
  }
}
