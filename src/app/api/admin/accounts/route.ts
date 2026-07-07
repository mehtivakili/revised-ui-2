import { NextRequest, NextResponse } from "next/server";
import { query } from "@/src/lib/db";
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
    let whereClauses: string[] = [];
    const queryParams: any[] = [];

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

    let usersQueryText = `
      SELECT id, username, role, plan, is_free_account as "isFreeAccount", 
             display_name as "displayName", signup_at as "signupAt", 
             created_at as "createdAt", last_login_at as "lastLoginAt", 
             failed_logins as "failedLogins", is_protected as "isProtected"
      FROM users
      ${whereString}
      ${orderString}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    let countQueryText = `SELECT COUNT(*) FROM users ${whereString}`;

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
      currentPage: page
    });
  } catch (err: any) {
    console.error("API accounts GET failed:", err);
    return NextResponse.json({ ok: false, error: "خطا در خواندن کاربران از دیتابیس." }, { status: 500 });
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
    const userRes = await query("SELECT is_protected FROM users WHERE id = $1", [id]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "کاربر پیدا نشد." }, { status: 404 });
    }

    if (userRes.rows[0].is_protected) {
      return NextResponse.json({ ok: false, error: "این حساب کاربری سیستمی است و قابل حذف نیست." }, { status: 400 });
    }

    await query("DELETE FROM users WHERE id = $1", [id]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("API accounts DELETE failed:", err);
    return NextResponse.json({ ok: false, error: "خطا در حذف کاربر از دیتابیس." }, { status: 500 });
  }
}
