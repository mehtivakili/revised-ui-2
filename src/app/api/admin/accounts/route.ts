import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/src/lib/db";
import { ensureAuthSchema, getDefaultTrialDays, hashPassword, setDefaultTrialDays } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";

async function requireAdmin() {
  const session = await getCurrentSession();
  return session?.role === "admin" ? session : null;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
  const search = searchParams.get("search") || "";
  const plan = searchParams.get("plan") || "all";
  const role = searchParams.get("role") || "all";
  const sortBy = searchParams.get("sortBy") || "newest";
  const offset = (page - 1) * limit;

  try {
    await ensureAuthSchema();
    const whereClauses: string[] = [];
    const queryParams: (string | number)[] = [];

    if (search) {
      queryParams.push(`%${search}%`);
      whereClauses.push(`(username LIKE $${queryParams.length} OR display_name LIKE $${queryParams.length})`);
    }

    if (plan !== "all") {
      queryParams.push(plan);
      whereClauses.push(`plan = $${queryParams.length}`);
    }

    if (role !== "all") {
      queryParams.push(role);
      whereClauses.push(`role = $${queryParams.length}`);
    }

    const whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    let orderString = " ORDER BY is_protected DESC";
    if (sortBy === "newest") {
      orderString += ", signup_at DESC";
    } else if (sortBy === "oldest") {
      orderString += ", signup_at ASC";
    } else {
      orderString += ", signup_at DESC";
    }

    const usersQueryText = `
      SELECT id, username, role, plan, is_free_account as "isFreeAccount", 
             display_name as "displayName", signup_at as "signupAt", 
             created_at as "createdAt", last_login_at as "lastLoginAt", 
             failed_logins as "failedLogins", is_protected as "isProtected",
             trial_days as "trialDays", password_preview as "passwordPreview"
      FROM users
      ${whereString}
      ${orderString}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const countQueryText = `SELECT COUNT(*) FROM users ${whereString}`;

    const countParams = [...queryParams];
    queryParams.push(limit, offset);

    const usersResult = await query(usersQueryText, queryParams);
    const countResult = await query(countQueryText, countParams);
    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);

    const users = usersResult.rows.map(row => ({
      ...row,
      signupAt: row.signupAt ? new Date(row.signupAt).toISOString() : undefined,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : undefined
    }));

    return NextResponse.json({
      ok: true,
      users,
      totalUsers,
      totalPages,
      currentPage: page,
      defaultTrialDays: await getDefaultTrialDays()
    });
  } catch (err: unknown) {
    console.error("API accounts GET failed:", err);
    return NextResponse.json({ ok: false, error: "خطا در خواندن کاربران از دیتابیس." }, { status: 500 });
  }
}

function sanitizeRole(value: unknown) {
  return value === "admin" ? "admin" : "user";
}

function sanitizePlan(value: unknown) {
  return value === "pro" ? "pro" : "free";
}

function toSafeInt(value: unknown, fallback: number, min = 0, max = 3650) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

async function signupAtForRemainingDays(trialDays: number, daysLeft: number) {
  const usedDays = Math.max(0, trialDays - daysLeft);
  return new Date(Date.now() - usedDays * 24 * 60 * 60 * 1000);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "create");

  try {
    await ensureAuthSchema();

    if (action === "settings") {
      const defaultTrialDays = await setDefaultTrialDays(toSafeInt(body?.defaultTrialDays, 7));
      let affectedUsers = 0;
      if (body?.applyToExistingFree === true) {
        const result = await query(
          `UPDATE users
           SET trial_days = $1
           WHERE role = 'user' AND plan = 'free'`,
          [defaultTrialDays]
        );
        affectedUsers = result.rowCount ?? 0;
      }
      return NextResponse.json({ ok: true, defaultTrialDays, affectedUsers });
    }

    if (action === "bulk") {
      const target = String(body?.target ?? "free");
      const operation = String(body?.operation ?? "trialDays");
      const targetSql = target === "all"
        ? "role = 'user'"
        : target === "pro"
          ? "role = 'user' AND plan = 'pro'"
          : "role = 'user' AND plan = 'free'";

      let result;
      if (operation === "trialDays") {
        const trialDays = toSafeInt(body?.trialDays, await getDefaultTrialDays());
        result = await query(`UPDATE users SET trial_days = $1 WHERE ${targetSql}`, [trialDays]);
      } else if (operation === "planFree") {
        result = await query(`UPDATE users SET plan = 'free', is_free_account = true WHERE ${targetSql}`);
      } else if (operation === "planPro") {
        result = await query(`UPDATE users SET plan = 'pro', is_free_account = false WHERE ${targetSql}`);
      } else if (operation === "unlock") {
        result = await query(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE ${targetSql}`);
      } else {
        return NextResponse.json({ ok: false, error: "عملیات گروهی نامعتبر است." }, { status: 400 });
      }

      return NextResponse.json({ ok: true, affectedUsers: result.rowCount ?? 0 });
    }

    const username = String(body?.username ?? "").trim();
    const displayName = String(body?.displayName ?? username).trim();
    const role = sanitizeRole(body?.role);
    const plan = sanitizePlan(body?.plan);
    const trialDays = toSafeInt(body?.trialDays, await getDefaultTrialDays());
    const daysLeft = toSafeInt(body?.daysLeft, trialDays);
    const password = String(body?.password ?? username).trim() || username;

    if (!username) {
      return NextResponse.json({ ok: false, error: "نام کاربری یا موبایل الزامی است." }, { status: 400 });
    }

    const signupAt = await signupAtForRemainingDays(trialDays, daysLeft);
    const result = await query(
      `INSERT INTO users
       (id, username, role, plan, is_free_account, display_name, signup_at, created_at, failed_logins, is_protected, password_hash, password_preview, trial_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, 0, false, $8, $9, $10)
       RETURNING id`,
      [
        randomUUID(),
        username,
        role,
        plan,
        plan === "free",
        displayName || username,
        signupAt,
        hashPassword(password),
        password,
        trialDays
      ]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && err.code === "23505") {
      return NextResponse.json({ ok: false, error: "این نام کاربری قبلا ثبت شده است." }, { status: 409 });
    }
    console.error("API accounts POST failed:", err);
    return NextResponse.json({ ok: false, error: "خطا در ایجاد کاربر." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "شناسه کاربر ارسال نشده است." }, { status: 400 });

  try {
    await ensureAuthSchema();
    const current = await query("SELECT * FROM users WHERE id = $1", [id]);
    if (current.rowCount === 0) return NextResponse.json({ ok: false, error: "کاربر پیدا نشد." }, { status: 404 });

    const row = current.rows[0];
    const role = sanitizeRole(body?.role ?? row.role);
    const plan = sanitizePlan(body?.plan ?? row.plan);
    const trialDays = toSafeInt(body?.trialDays, Number(row.trial_days ?? 7));
    const daysLeft = toSafeInt(body?.daysLeft, trialDays);
    const signupAt = await signupAtForRemainingDays(trialDays, daysLeft);
    const displayName = String(body?.displayName ?? row.display_name ?? row.username).trim() || row.username;
    const password = String(body?.password ?? "").trim();

    if (password) {
      await query(
        `UPDATE users
         SET role = $1, plan = $2, is_free_account = $3, display_name = $4,
             trial_days = $5, signup_at = $6, password_hash = $7, password_preview = $8
         WHERE id = $9`,
        [role, plan, plan === "free", displayName, trialDays, signupAt, hashPassword(password), password, id]
      );
    } else {
      await query(
        `UPDATE users
         SET role = $1, plan = $2, is_free_account = $3, display_name = $4,
             trial_days = $5, signup_at = $6
         WHERE id = $7`,
        [role, plan, plan === "free", displayName, trialDays, signupAt, id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("API accounts PATCH failed:", err);
    return NextResponse.json({ ok: false, error: "خطا در ویرایش کاربر." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "دسترسی غیرمجاز است." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");

  if (!id) {
    return NextResponse.json({ ok: false, error: "شناسه کاربری ارسال نشده است." }, { status: 400 });
  }

  if (id === session.id) {
    return NextResponse.json({ ok: false, error: "شما نمی‌توانید حساب کاربری خودتان را حذف کنید." }, { status: 400 });
  }

  try {
    await ensureAuthSchema();
    const userRes = await query("SELECT is_protected FROM users WHERE id = $1", [id]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "کاربر پیدا نشد." }, { status: 404 });
    }

    if (userRes.rows[0].is_protected) {
      return NextResponse.json({ ok: false, error: "این حساب کاربری سیستمی است و قابل حذف نیست." }, { status: 400 });
    }

    await query("DELETE FROM users WHERE id = $1", [id]);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("API accounts DELETE failed:", err);
    return NextResponse.json({ ok: false, error: "خطا در حذف کاربر از دیتابیس." }, { status: 500 });
  }
}
