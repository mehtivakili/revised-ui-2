import { NextResponse } from "next/server";
import { createOtp, discardOtp, getUser, rateLimit, replaceOtpCode } from "@/src/lib/authStore";
import { sendMelipayamakOtp } from "@/src/lib/sms";
import { normalizeIranPhone } from "@/src/lib/validation";

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const phone = normalizeIranPhone(String(body?.phone ?? ""));

    if (!phone.ok || phone.value.length !== 11) {
      return NextResponse.json({ ok: false, error: "شماره موبایل باید ۱۱ رقم و با 09 شروع شود." }, { status: 400 });
    }

    const existingUser = await getUser(phone.value);
    if (existingUser) {
      return NextResponse.json(
        {
          ok: false,
          code: "account_exists",
          error: "شما قبلا با این شماره حساب ساخته‌اید. برای ادامه باید وارد شوید."
        },
        { status: 409 }
      );
    }

    const limited = rateLimit(`register-otp-request:${getClientKey(request)}`, 8, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "درخواست کد بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }, { status: 429 });
    }

    const otp = await createOtp(phone.value, { ensureUser: false });
    if (!otp.ok) return NextResponse.json({ ok: false, error: otp.error }, { status: 429 });

    const sms = await sendMelipayamakOtp(phone.value);
    if (!sms.ok) {
      discardOtp(phone.value);
      return NextResponse.json({ ok: false, error: sms.error }, { status: 502 });
    }
    if (sms.otpCode) replaceOtpCode(phone.value, sms.otpCode);

    return NextResponse.json({
      ok: true,
      phone: phone.value,
      expiresAt: otp.expiresAt,
      message: "کد تایید ارسال شد."
    });
  } catch (error) {
    console.error("Register OTP request failed:", error);
    return NextResponse.json({ ok: false, error: "خطا در ارسال کد ثبت‌نام." }, { status: 500 });
  }
}
