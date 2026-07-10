import { NextResponse } from "next/server";
import { rateLimit, verifyRegistrationOtp } from "@/src/lib/authStore";
import { normalizeIranPhone } from "@/src/lib/validation";

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const phone = normalizeIranPhone(String(body?.phone ?? ""));
    const code = String(body?.code ?? "").trim();

    const limited = rateLimit(`register-otp-verify:${getClientKey(request)}:${body?.phone ?? ""}`, 12, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "تعداد تلاش‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کنید." }, { status: 429 });
    }

    if (!phone.ok) {
      return NextResponse.json({ ok: false, error: "شماره موبایل معتبر نیست." }, { status: 400 });
    }

    if (!/^[0-9]{5,6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "کد تایید باید ۵ یا ۶ رقم باشد." }, { status: 400 });
    }

    const result = await verifyRegistrationOtp(phone.value, code);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
    }

    return NextResponse.json({ ok: true, phone: phone.value, registrationToken: result.token });
  } catch (error) {
    console.error("Register OTP verify failed:", error);
    return NextResponse.json({ ok: false, error: "خطا در تایید کد ثبت‌نام." }, { status: 500 });
  }
}
