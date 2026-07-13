import { NextResponse } from "next/server";
import { rateLimit, signSession, verifyOtp } from "@/src/lib/authStore";
import { sessionCookieName, sessionCookieOptions } from "@/src/lib/session";
import { normalizeIranPhone } from "@/src/lib/validation";

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizeIranPhone(String(body?.phone ?? ""));
  const code = String(body?.code ?? "").trim();

  const limited = rateLimit(`otp-verify:${getClientKey(request)}:${body?.phone ?? ""}`, 12, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "تعداد تلاش‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کنید." }, { status: 429 });
  }

  if (!phone.ok) {
    return NextResponse.json({ ok: false, error: "شماره موبایل معتبر نیست." }, { status: 400 });
  }

  if (!/^[0-9]{4,20}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "کد باید بین ۴ تا ۲۰ رقم باشد." }, { status: 400 });
  }

  const result = await verifyOtp(phone.value, code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role: result.user.role });
  response.cookies.set(sessionCookieName, signSession(result.user), sessionCookieOptions());
  return response;
}
