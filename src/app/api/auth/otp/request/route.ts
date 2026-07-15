import { NextResponse } from "next/server";
import { createOtp, discardOtp, getUser, rateLimit } from "@/src/lib/authStore";
import { sendMelipayamakSharedOtp } from "@/src/lib/sms";
import { normalizeIranPhone } from "@/src/lib/validation";

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await request.json().catch(() => null)
      : Object.fromEntries((await request.formData()).entries());
    const phone = normalizeIranPhone(String(data?.phone ?? ""));

    const limited = rateLimit(`otp-request:${getClientKey(request)}`, 8, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "درخواست کد بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }, { status: 429 });
    }

    if (!phone.ok) {
      return NextResponse.json({ ok: false, error: "شماره موبایل معتبر نیست." }, { status: 400 });
    }

    const existingUser = await getUser(phone.value);
    if (!existingUser) {
      return NextResponse.json({ ok: false, error: "این شماره هنوز ثبت‌نام نکرده است. ابتدا حساب بسازید." }, { status: 404 });
    }

    const otp = await createOtp(phone.value, { ensureUser: false });
    if (!otp.ok) return NextResponse.json({ ok: false, error: otp.error }, { status: 429 });

    const sms = await sendMelipayamakSharedOtp(phone.value, otp.code);
    if (!sms.ok) {
      discardOtp(phone.value);
      return NextResponse.json({ ok: false, error: sms.error }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      phone: phone.value,
      expiresAt: otp.expiresAt,
      message: "کد تایید ارسال شد."
    });
  } catch (error) {
    console.error("OTP request failed:", error);
    return NextResponse.json({ ok: false, error: "خطا در ارسال کد تایید." }, { status: 500 });
  }
}
