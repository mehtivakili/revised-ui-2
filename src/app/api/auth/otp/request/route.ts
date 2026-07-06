import { NextResponse } from "next/server";
import { createOtp, getSmsConfig, rateLimit } from "@/src/lib/authStore";
import { normalizeIranPhone } from "@/src/lib/validation";

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
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

  const otp = createOtp(phone.value);
  if (!otp.ok) return NextResponse.json({ ok: false, error: otp.error }, { status: 429 });

  const smsConfig = getSmsConfig();
  return NextResponse.json({
    ok: true,
    phone: phone.value,
    expiresAt: otp.expiresAt,
    demoCode: smsConfig.enabled ? undefined : otp.code,
    message: smsConfig.enabled
      ? "کد یک‌بار مصرف از طریق سرویس پیامکی ارسال شد."
      : "پنل پیامکی هنوز فعال نیست؛ کد آزمایشی برای توسعه برگردانده شد."
  });
}
