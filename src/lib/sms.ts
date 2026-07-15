type SmsResult =
  | { ok: true; providerResponse: unknown; recId: string }
  | { ok: false; error: string };

const SHARED_SMS_BASE_URL = "https://console.melipayamak.com/api/send/shared";

function parseResponse(text: string): unknown {
  if (!text) return undefined;
  try {
    // Melipayamak returns recId as an integer larger than Number.MAX_SAFE_INTEGER.
    // Quote it before parsing so its exact digits are not rounded by JavaScript.
    const safeJson = text.replace(/("recId"\s*:\s*)(\d+)/, '$1"$2"');
    return JSON.parse(safeJson);
  } catch {
    return text.trim();
  }
}

/** Sends the locally generated OTP as the first variable ({0}) of the configured template. */
export async function sendMelipayamakSharedOtp(to: string, otpCode: string): Promise<SmsResult> {
  const apiKey = process.env.MELIPAYAMAK_SHARED_API_KEY?.trim();
  const configuredUrl = process.env.MELIPAYAMAK_SHARED_URL?.trim();
  const bodyIdText = process.env.MELIPAYAMAK_SHARED_BODY_ID?.trim() || "495367";

  if ((!configuredUrl && !apiKey) || !/^\d+$/.test(bodyIdText)) {
    return { ok: false, error: "تنظیمات وب‌سرویس خط خدماتی ملی‌پیامک کامل نیست." };
  }

  if (!/^\d{4,20}$/.test(otpCode)) {
    return { ok: false, error: "کد تایید تولیدشده معتبر نیست." };
  }

  const url = configuredUrl || `${SHARED_SMS_BASE_URL}/${encodeURIComponent(apiKey!)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        bodyId: Number(bodyIdText),
        to,
        args: [otpCode]
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    const payload = parseResponse(await response.text());
    if (!response.ok) {
      console.error("Melipayamak shared SMS HTTP error", response.status, payload);
      return { ok: false, error: "ارتباط با وب‌سرویس ملی‌پیامک ناموفق بود." };
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      console.error("Invalid Melipayamak shared SMS response", payload);
      return { ok: false, error: "پاسخ وب‌سرویس ملی‌پیامک معتبر نیست." };
    }

    const result = payload as Record<string, unknown>;
    const recId = String(result.recId ?? "").trim();
    const status = String(result.status ?? "").trim();

    if (/^\d+$/.test(recId) && BigInt(recId) > 0n) {
      return { ok: true, providerResponse: payload, recId };
    }

    console.error("Melipayamak shared SMS provider error", payload);
    return { ok: false, error: status || "ملی‌پیامک ارسال کد تایید را انجام نداد." };
  } catch (error) {
    console.error("Melipayamak shared SMS request error", error);
    return { ok: false, error: "ارتباط با وب‌سرویس ملی‌پیامک برقرار نشد." };
  } finally {
    clearTimeout(timeout);
  }
}
