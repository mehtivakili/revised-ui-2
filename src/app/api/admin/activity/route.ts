import { NextResponse } from "next/server";
import { ensureAuthSchema } from "@/src/lib/authStore";
import { query } from "@/src/lib/db";
import { getCurrentSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });
  }

  try {
    await ensureAuthSchema();
    const [summaryResult, dailyResult] = await Promise.all([
      query(`
      SELECT
        (SELECT COUNT(*) FROM user_presence WHERE last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes') AS "onlineNow",
        COUNT(*) FILTER (WHERE logged_in_at >= date_trunc('day', CURRENT_TIMESTAMP)) AS "loginsToday",
        COUNT(*) FILTER (WHERE logged_in_at >= date_trunc('week', CURRENT_TIMESTAMP)) AS "loginsThisWeek",
        COUNT(*) FILTER (WHERE logged_in_at >= date_trunc('month', CURRENT_TIMESTAMP)) AS "loginsThisMonth"
      FROM user_login_events
      `),
      query(`
        SELECT day::date AS day, COUNT(event.id)::int AS logins
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS calendar(day)
        LEFT JOIN user_login_events AS event
          ON event.logged_in_at >= calendar.day
         AND event.logged_in_at < calendar.day + INTERVAL '1 day'
        GROUP BY day
        ORDER BY day ASC
      `)
    ]);
    const stats = summaryResult.rows[0] ?? {};

    return NextResponse.json({
      ok: true,
      stats: {
        onlineNow: Number(stats.onlineNow ?? 0),
        loginsToday: Number(stats.loginsToday ?? 0),
        loginsThisWeek: Number(stats.loginsThisWeek ?? 0),
        loginsThisMonth: Number(stats.loginsThisMonth ?? 0)
      },
      dailyLogins: dailyResult.rows.map((row) => ({
        day: new Date(row.day).toISOString(),
        logins: Number(row.logins ?? 0)
      }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin activity metrics failed:", error);
    return NextResponse.json({ ok: false, error: "دریافت آمار فعالیت کاربران انجام نشد." }, { status: 500 });
  }
}
