"use client";

import { FormEvent, useState } from "react";
import { MessageSquare, Shield, Trash2, UsersRound, Settings, ChevronDown, ChevronUp } from "lucide-react";
import type { UserPlan, UserRole } from "@/src/lib/authStore";
import { getSubscriptionAccess } from "@/src/lib/subscription";

type AdminUser = {
  id: string;
  username: string;
  role: UserRole;
  plan: UserPlan;
  isFreeAccount: boolean;
  displayName: string;
  signupAt: string;
  createdAt: string;
  lastLoginAt?: string;
  lockedUntil?: number;
  failedLogins: number;
  isProtected: boolean;
};

type SmsConfig = {
  providerName: string;
  apiUrl: string;
  senderNumber: string;
  templateId: string;
  timeoutSeconds: number;
  enabled: boolean;
  updatedAt?: string;
  apiKeySet: boolean;
};

type AdminPanelProps = {
  currentUserId: string;
  initialUsers: AdminUser[];
  initialTotalUsers: number;
  initialTotalPages: number;
  initialSmsConfig: SmsConfig;
};

export function AdminPanel({ 
  currentUserId, 
  initialUsers, 
  initialTotalUsers,
  initialTotalPages,
  initialSmsConfig 
}: AdminPanelProps) {
  const [users, setUsers] = useState(initialUsers);
  const [totalUsers, setTotalUsers] = useState(initialTotalUsers);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [smsConfig, setSmsConfig] = useState(initialSmsConfig);
  const [apiKey, setApiKey] = useState("");
  const [now] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [savingSms, setSavingSms] = useState(false);

  const fetchPage = async (
    page: number,
    search = searchQuery,
    plan = planFilter,
    role = roleFilter,
    sort = sortBy
  ) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "50",
        search,
        plan,
        role,
        sortBy: sort
      });
      const response = await fetch(`/api/admin/accounts?${queryParams.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || "خطا در بارگذاری کاربران.");
        return;
      }
      setUsers(data.users);
      setTotalUsers(data.totalUsers);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
    } catch (err: any) {
      setError("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (updates: { plan?: string; role?: string; sortBy?: string }) => {
    const nextPlan = updates.plan !== undefined ? updates.plan : planFilter;
    const nextRole = updates.role !== undefined ? updates.role : roleFilter;
    const nextSort = updates.sortBy !== undefined ? updates.sortBy : sortBy;
    fetchPage(1, searchQuery, nextPlan, nextRole, nextSort);
  };

  async function deleteAccount(id: string) {
    setPendingUserId(id);
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/accounts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await response.json();
    setPendingUserId("");

    if (!response.ok || !data.ok) {
      setError(data.error || "حذف حساب انجام نشد.");
      return;
    }

    setMessage("حساب کاربری حذف شد.");
    fetchPage(currentPage);
  }

  async function saveSmsConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSms(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/sms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...smsConfig, apiKey })
    });
    const data = await response.json();
    setSavingSms(false);

    if (!response.ok || !data.ok) {
      setError(data.error || "ذخیره تنظیمات پیامک انجام نشد.");
      return;
    }

    setSmsConfig(data.config);
    setApiKey("");
    setMessage("تنظیمات پیامک ذخیره شد.");
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="admin-page">
      <section className="calc-header admin-header-compact">
        <div>
          <p className="eyebrow">مدیریت</p>
          <h1 style={{ marginBottom: 0 }}>پنل مدیریت کاربران و پیامک</h1>
        </div>
      </section>

      <section className="admin-grid">
        <article className="panel admin-card admin-users-card">
          <div className="admin-section-title">
            <span className="category-icon">
              <UsersRound size={20} aria-hidden="true" />
            </span>
            <div style={{ flex: 1 }}>
              <h2>حساب‌های ساخته‌شده</h2>
              <p>{totalUsers} حساب در سیستم</p>
            </div>
            
            <form 
              onSubmit={(e) => { e.preventDefault(); fetchPage(1); }}
              className="admin-search-form"
            >
              <input 
                type="text" 
                placeholder="جستجوی نام یا موبایل..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit">جستجو</button>
            </form>
          </div>

          <div className="admin-filter-bar">
            <label>
              <span>اشتراک:</span>
              <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); handleFilterChange({ plan: e.target.value }); }}>
                <option value="all">همه اشتراک‌ها</option>
                <option value="pro">حرفه‌ای (Pro)</option>
                <option value="free">رایگان (Free)</option>
              </select>
            </label>

            <label>
              <span>نقش:</span>
              <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); handleFilterChange({ role: e.target.value }); }}>
                <option value="all">همه نقش‌ها</option>
                <option value="admin">مدیر (Admin)</option>
                <option value="user">کاربر (User)</option>
              </select>
            </label>

            <label>
              <span>ترتیب ثبت‌نام:</span>
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); handleFilterChange({ sortBy: e.target.value }); }}>
                <option value="newest">جدیدترین به قدیمی‌ترین</option>
                <option value="oldest">قدیمی‌ترین به جدیدترین</option>
              </select>
            </label>
          </div>

          <div className="admin-table-wrap scrollable-admin-table">
            {loading ? (
              <div className="table-loader">در حال بارگذاری...</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>نام کاربری</th>
                    <th>نقش</th>
                    <th>اشتراک</th>
                    <th>ثبت‌نام</th>
                    <th>آخرین ورود</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const locked = Boolean(user.lockedUntil && user.lockedUntil > now);
                    const canDelete = user.id !== currentUserId && !user.isProtected;
                    const access = getSubscriptionAccess(user, now);

                    const isExpanded = expandedUserId === user.id;

                    return (
                      <tr key={user.id} className={`user-row ${isExpanded ? "expanded" : ""}`}>
                        {/* Mobile view only: Name, Number, Plan, and Toggle Button */}
                        <td className="col-user-main">
                          <div className="user-main-info">
                            <div className="user-identity">
                              <strong>{user.displayName}</strong>
                              <small>{user.username}</small>
                            </div>
                            <div className="user-meta-badges">
                              <span className={`plan-pill ${access.plan}`}>{access.plan === "pro" ? "حرفه‌ای" : "رایگان"}</span>
                            </div>
                            <button
                              type="button"
                              className="user-expand-btn"
                              onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </td>

                        {/* Desktop view only cells */}
                        <td data-label="نام کاربری" className="col-desktop-only">
                          <strong>{user.displayName}</strong>
                          <small>{user.username}</small>
                        </td>
                        <td data-label="نقش" className="col-desktop-only">
                          <span className={`role-pill ${user.role}`}>{user.role === "admin" ? "مدیر" : "کاربر"}</span>
                        </td>
                        <td data-label="اشتراک" className="col-desktop-only">
                          <span className={`plan-pill ${access.plan}`}>{access.plan === "pro" ? "حرفه‌ای" : "رایگان"}</span>
                          <small>{access.plan === "free" ? (access.restricted ? "تست منقضی" : `${access.trialDaysRemaining} روز باقی‌مانده`) : "دسترسی کامل"}</small>
                        </td>
                        <td data-label="ثبت‌نام" className="col-desktop-only">{new Date(access.signupAt).toLocaleDateString("fa-IR")}</td>
                        <td data-label="آخرین ورود" className="col-desktop-only">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("fa-IR") : "بدون ورود"}</td>
                        <td data-label="وضعیت" className="col-desktop-only">{locked ? "قفل موقت" : user.isProtected ? "حساب پایه" : "فعال"}</td>
                        <td data-label="عملیات" className="col-desktop-only">
                          <button
                            type="button"
                            className="danger-action compact"
                            disabled={!canDelete || pendingUserId === user.id}
                            onClick={() => deleteAccount(user.id)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            حذف
                          </button>
                        </td>

                        {/* Collapsible Mobile Details */}
                        {isExpanded ? (
                          <td className="user-mobile-details">
                            <div className="mobile-details-row">
                              <span><strong>نقش:</strong> {user.role === "admin" ? "مدیر" : "کاربر"}</span>
                              <span><strong>ثبت‌نام:</strong> {new Date(access.signupAt).toLocaleDateString("fa-IR")}</span>
                              <span><strong>وضعیت:</strong> {locked ? "قفل" : "فعال"}</span>
                            </div>
                            <div className="mobile-details-row-actions">
                              <button
                                type="button"
                                className="danger-action compact"
                                disabled={!canDelete || pendingUserId === user.id}
                                onClick={() => deleteAccount(user.id)}
                              >
                                <Trash2 size={13} aria-hidden="true" />
                                حذف حساب
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 ? (
            <div className="admin-pagination">
              <button 
                type="button" 
                className="pagination-btn arrow" 
                disabled={currentPage === 1 || loading}
                onClick={() => fetchPage(currentPage - 1)}
              >
                &laquo; قبلی
              </button>

              {getPageNumbers().map((p, idx) => {
                if (p === "...") {
                  return <span key={`dots-${idx}`} className="pagination-dots">...</span>;
                }
                return (
                  <button
                    key={`page-${p}`}
                    type="button"
                    className={`pagination-btn page-num ${currentPage === p ? "active" : ""}`}
                    disabled={loading}
                    onClick={() => fetchPage(Number(p))}
                  >
                    {p}
                  </button>
                );
              })}

              <button 
                type="button" 
                className="pagination-btn arrow" 
                disabled={currentPage === totalPages || loading}
                onClick={() => fetchPage(currentPage + 1)}
              >
                بعدی &raquo;
              </button>
            </div>
          ) : null}
        </article>

        <article className="panel admin-card admin-sms-card">
          <div className="admin-section-title">
            <span className="category-icon">
              <MessageSquare size={20} aria-hidden="true" />
            </span>
            <div>
              <h2>تنظیمات پنل پیامکی OTP</h2>
              <p>برای اتصال به سرویس واقعی پیامک</p>
            </div>
          </div>

          <form className="admin-form-grid" onSubmit={saveSmsConfig}>
            <label>
              <span>نام سرویس‌دهنده</span>
              <input value={smsConfig.providerName} onChange={(event) => setSmsConfig({ ...smsConfig, providerName: event.target.value })} />
            </label>
            <label>
              <span>آدرس API</span>
              <input dir="ltr" value={smsConfig.apiUrl} onChange={(event) => setSmsConfig({ ...smsConfig, apiUrl: event.target.value })} />
            </label>
            <label>
              <span>شماره فرستنده</span>
              <input value={smsConfig.senderNumber} onChange={(event) => setSmsConfig({ ...smsConfig, senderNumber: event.target.value })} />
            </label>
            <label>
              <span>شناسه قالب پیامک</span>
              <input value={smsConfig.templateId} onChange={(event) => setSmsConfig({ ...smsConfig, templateId: event.target.value })} />
            </label>
            <label>
              <span>کلید API</span>
              <input
                dir="ltr"
                type="password"
                placeholder={smsConfig.apiKeySet ? "کلید قبلی ذخیره شده است" : "API key"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <label>
              <span>Timeout درخواست</span>
              <input
                type="number"
                min={3}
                max={30}
                value={smsConfig.timeoutSeconds}
                onChange={(event) => setSmsConfig({ ...smsConfig, timeoutSeconds: Number(event.target.value) })}
              />
            </label>
            <label className="admin-switch">
              <input
                type="checkbox"
                checked={smsConfig.enabled}
                onChange={(event) => setSmsConfig({ ...smsConfig, enabled: event.target.checked })}
              />
              <span>ارسال پیامک واقعی فعال باشد</span>
            </label>
            <button className="secondary-action" type="submit" disabled={savingSms}>
              {savingSms ? "در حال ذخیره..." : "ذخیره تنظیمات"}
            </button>
          </form>
        </article>
      </section>

      {message ? <p className="form-message success">{message}</p> : null}
      {error ? <p className="form-message error">{error}</p> : null}
    </div>
  );
}
