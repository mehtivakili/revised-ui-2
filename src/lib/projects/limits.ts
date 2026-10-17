import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * How many designs one account may keep.
 *
 * Use is free for now, so storage is kept bounded per account: a saved design carries its
 * plan, its revisions and its scanned drawings. Admins are not limited. The server reads
 * `PROJECTS_PER_USER` so the cap can be raised without a release; the browser is told the
 * number with the project list rather than assuming it.
 */
export const DEFAULT_PROJECT_LIMIT = 2;

export const PROJECT_LIMIT_CODE = "PROJECT_LIMIT";

export function projectLimitMessage(limit: number) {
  return `به حداکثر تعداد نقشه‌های قابل تعریف (${formatFa(limit)} نقشه) رسیده‌اید. برای ساخت نقشه جدید، اول یکی از نقشه‌های قبلی را حذف کنید.`;
}
