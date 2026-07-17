import * as XLSX from "xlsx";
import { ensureAuthSchema } from "@/src/lib/authStore";
import { query } from "@/src/lib/db";
import { getCurrentSession } from "@/src/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asDate(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date;
}

function lockedUntilDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? asDate(timestamp) : "";
}

export async function GET() {
  const session = await getCurrentSession();
  if (session?.role !== "admin") {
    return Response.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });
  }

  try {
    await ensureAuthSchema();
    const result = await query(`
      SELECT id, username, display_name, role, plan, is_free_account,
             trial_days, signup_at, created_at, last_login_at, locked_until,
             login_count, failed_logins, is_protected
      FROM users
      ORDER BY is_protected DESC, signup_at DESC
    `);

    const rows = result.rows.map((user) => ({
      "شناسه": String(user.id),
      "نام کاربری / موبایل": String(user.username),
      "نام نمایشی": String(user.display_name ?? ""),
      "نقش": user.role === "admin" ? "مدیر" : "کاربر",
      "اشتراک": user.plan === "pro" ? "حرفه‌ای" : "رایگان",
      "حساب رایگان": user.is_free_account ? "بله" : "خیر",
      "مدت تست (روز)": Number(user.trial_days ?? 0),
      "تاریخ ثبت‌نام": asDate(user.signup_at),
      "تاریخ ایجاد": asDate(user.created_at),
      "آخرین ورود": asDate(user.last_login_at),
      "تعداد ورود": Number(user.login_count ?? 1),
      "قفل تا": lockedUntilDate(user.locked_until),
      "ورود ناموفق": Number(user.failed_logins ?? 0),
      "حساب سیستمی": user.is_protected ? "بله" : "خیر"
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { cellDates: true });
    worksheet["!cols"] = [
      { wch: 38 }, { wch: 22 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 17 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
      { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 16 }
    ];
    worksheet["!autofilter"] = { ref: worksheet["!ref"] ?? "A1:N1" };
    (worksheet as XLSX.WorkSheet & { "!views"?: Array<{ rightToLeft: boolean }> })["!views"] = [
      { rightToLeft: true }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "کاربران");
    workbook.Props = {
      Title: "خروجی کاربران",
      Subject: "فهرست کامل کاربران سامانه",
      Author: "Hamyar Doorbin",
      CreatedDate: new Date()
    };

    const output = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", cellDates: true });
    const filename = `users-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Users Excel export failed:", error);
    return Response.json({ ok: false, error: "خطا در ساخت فایل اکسل کاربران." }, { status: 500 });
  }
}
