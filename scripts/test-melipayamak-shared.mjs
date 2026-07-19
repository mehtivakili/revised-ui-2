import https from "node:https";
import { randomInt } from "node:crypto";

const apiKey = process.env.MELIPAYAMAK_SHARED_API_KEY?.trim();
const bodyId = Number(process.env.MELIPAYAMAK_SHARED_BODY_ID || "495367");
const to = process.argv[2] || "09906400588";
const otpCode = String(randomInt(100000, 1_000_000));

if (!apiKey) {
  console.error("MELIPAYAMAK_SHARED_API_KEY is missing.");
  process.exit(1);
}

if (!Number.isSafeInteger(bodyId) || bodyId <= 0) {
  console.error("MELIPAYAMAK_SHARED_BODY_ID is invalid.");
  process.exit(1);
}

if (!/^09\d{9}$/.test(to)) {
  console.error("Recipient must be an 11-digit Iranian mobile number starting with 09.");
  process.exit(1);
}

const data = JSON.stringify({
  bodyId,
  to,
  args: [otpCode]
});

console.log(JSON.stringify({ to, bodyId, otpCode }));

const request = https.request(
  {
    hostname: "console.melipayamak.com",
    port: 443,
    path: `/api/send/shared/${encodeURIComponent(apiKey)}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    },
    timeout: 60_000
  },
  (response) => {
    response.setEncoding("utf8");
    let responseBody = "";

    response.on("data", (chunk) => {
      responseBody += chunk;
    });

    response.on("end", () => {
      console.log(JSON.stringify({ httpStatus: response.statusCode, responseBody }));

      try {
        const payload = JSON.parse(responseBody);
        const recId = responseBody.match(/"recId"\s*:\s*"?(\d+)"?/)?.[1] ?? "";
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300 && /^\d+$/.test(recId) && BigInt(recId) > 0n) {
          console.log(JSON.stringify({ ok: true, recId, status: payload?.status ?? "" }));
          return;
        }
        console.error(JSON.stringify({ ok: false, status: payload?.status ?? "Invalid provider response" }));
        process.exitCode = 1;
      } catch {
        console.error(JSON.stringify({ ok: false, status: "Provider response was not valid JSON" }));
        process.exitCode = 1;
      }
    });
  }
);

request.on("timeout", () => {
  request.destroy(new Error("Request timed out after 60 seconds"));
});

request.on("error", (error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});

request.write(data);
request.end();
