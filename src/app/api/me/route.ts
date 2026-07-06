import { NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import { getUserById } from "@/src/lib/authStore";
import { getSubscriptionAccess } from "@/src/lib/subscription";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ ok: true, user: null, access: null });
  }

  const user = getUserById(session.id);
  if (!user) {
    return NextResponse.json({ ok: false, error: "حساب کاربری پیدا نشد." }, { status: 404 });
  }

  const access = getSubscriptionAccess(user);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      signupAt: user.signupAt,
      plan: access.plan,
      isFreeAccount: access.isFreeAccount
    },
    access
  });
}
