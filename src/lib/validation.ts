import { normalizeDigits } from "./format";

type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function normalizeIranPhone(input: string): ValidationResult {
  const compact = normalizeDigits(input)
    .replace(/\s+/g, "")
    .replace(/[-().]/g, "");

  let phone = compact;

  if (phone.startsWith("+98")) {
    phone = `0${phone.slice(3)}`;
  } else if (phone.startsWith("0098")) {
    phone = `0${phone.slice(4)}`;
  } else if (phone.startsWith("98")) {
    phone = `0${phone.slice(2)}`;
  }

  if (!/^09[0-9]{9}$/.test(phone)) {
    return { ok: false, error: "Invalid mobile number." };
  }

  return { ok: true, value: phone };
}
