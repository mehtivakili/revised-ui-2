type SmsResult =
  | { ok: true; providerResponse?: unknown; otpCode?: string }
  | { ok: false; error: string };

const DEFAULT_MELIPAYAMAK_OTP_URL = "https://console.melipayamak.com/api/send/otp";

function providerError(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const status = record.status ?? record.success;

  if (status === false || status === "error" || status === "failed" || status === 0) {
    return String(record.message ?? record.error ?? "ارسال پیامک توسط سرویس‌دهنده انجام نشد.");
  }

  if (typeof status === "string" && status.trim()) {
    const normalized = status.trim().toLowerCase();
    if (!["ok", "success", "sent", "ارسال موفق", "ارسال شد"].includes(normalized)) {
      return status.trim();
    }
  }

  return undefined;
}

function findOtpCode(payload: unknown): string | undefined {
  // If Melipayamak returns its generated code, the local verifier can use it.
  // Managed OTP APIs often return only delivery status; in that case their
  // verification endpoint must be configured separately.
  if (!payload || typeof payload !== "object") return undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const code = findOtpCode(item);
      if (code) return code;
    }
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["code", "otp", "otpCode", "verificationCode"]) {
    const value = record[key];
    if (typeof value === "string" && /^[0-9]{4,20}$/.test(value)) return value;
    if (typeof value === "number" && Number.isSafeInteger(value) && /^[0-9]{4,20}$/.test(String(value))) return String(value);
  }

  for (const value of Object.values(record)) {
    const code = findOtpCode(value);
    if (code) return code;
  }

  return undefined;
}

/**
 * Sends an OTP using Melipayamak's server-side OTP endpoint.
 * The token is read only on the server and is never returned to the client.
 */
export async function sendMelipayamakOtp(to: string): Promise<SmsResult> {
  // Support both the explicit Melipayamak names and the legacy SMS names
  // already used by this project. This is useful when PM2 loads an existing
  // server environment instead of the local .env.local file.
  const configuredUrl =
    process.env.MELIPAYAMAK_OTP_URL?.trim() ||
    (process.env.SMS_PROVIDER?.toLowerCase().includes("meli") || !process.env.SMS_PROVIDER
      ? process.env.SMS_API_URL?.trim()
      : undefined);
  const apiKey =
    process.env.MELIPAYAMAK_API_KEY?.trim() ||
    (process.env.SMS_PROVIDER?.toLowerCase().includes("meli") || !process.env.SMS_PROVIDER
      ? process.env.SMS_API_KEY?.trim()
      : undefined);

  if (!configuredUrl && !apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("MELIPAYAMAK_OTP_URL/MELIPAYAMAK_API_KEY is not configured; OTP is available only through local test mode.");
      return { ok: true };
    }
    return { ok: false, error: "سرویس ارسال پیامک تنظیم نشده است." };
  }

  const url = configuredUrl || `${DEFAULT_MELIPAYAMAK_OTP_URL}/${encodeURIComponent(apiKey!)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ to }),
      signal: controller.signal,
      cache: "no-store"
    });

    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      // Some gateway responses are plain text; the HTTP status still determines success.
    }

    if (!response.ok) {
      console.error("Melipayamak OTP request failed", response.status, payload);
      if (
        response.status === 400 &&
        typeof payload === "object" &&
        payload !== null &&
        "status" in payload &&
        String((payload as { status?: unknown }).status).includes("تنظیم")
      ) {
        return {
          ok: false,
          error: "سرویس OTP ملی‌پیامک هنوز توسط مدیر تنظیم و تأیید نشده است. ابتدا سرویس OTP را در پنل ملی‌پیامک فعال و تأیید کنید."
        };
      }
      return { ok: false, error: "ارسال کد تایید انجام نشد. لطفا دوباره تلاش کنید." };
    }

    const otpCode = findOtpCode(payload);
    const error = providerError(payload);
    // Melipayamak's successful response includes a `code`; some accounts also
    // populate `status` with a descriptive success message. The code is the
    // authoritative success signal according to their OTP API contract.
    if (error && !otpCode) {
      console.error("Melipayamak OTP provider error", payload);
      return { ok: false, error };
    }

    if (!otpCode) {
      return { ok: false, error: "پاسخ سرویس پیامک معتبر نیست و کد تایید دریافت نشد." };
    }

    return { ok: true, providerResponse: payload, otpCode };
  } catch (error) {
    console.error("Melipayamak OTP request error", error);
    return { ok: false, error: "ارتباط با سرویس پیامک برقرار نشد. لطفا دوباره تلاش کنید." };
  } finally {
    clearTimeout(timeout);
  }
}
