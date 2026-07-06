"use client";

import { FormEvent, useState } from "react";
import { MessageSquare, Shield, Trash2, UsersRound } from "lucide-react";
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
  initialSmsConfig: SmsConfig;
};

export function AdminPanel({ currentUserId, initialUsers, initialSmsConfig }: AdminPanelProps) {
  const [users, setUsers] = useState(initialUsers);
  const [smsConfig, setSmsConfig] = useState(initialSmsConfig);
  const [apiKey, setApiKey] = useState("");
  const [now] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [savingSms, setSavingSms] = useState(false);

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

    setUsers(data.users);
    setMessage("حساب کاربری حذف شد.");
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

  return (
    <div className="admin-page">
      <section className="calc-header">
        <div>
          <p className="eyebrow">مدیریت</p>
          <h1>پنل مدیریت کاربران و پیامک</h1>
          <p className="lead">این بخش فقط برای نقش مدیر نمایش داده می‌شود و عملیات حساس از سمت API هم دوباره بررسی نقش می‌شود.</p>
        </div>
        <span className="admin-role-badge">
          <Shield size={18} aria-hidden="true" />
          مدیر فعال
        </span>
      </section>

      <section className="admin-grid">
        <article className="panel admin-card admin-users-card">
          <div className="admin-section-title">
            <span className="category-icon">
              <UsersRound size={20} aria-hidden="true" />
            </span>
            <div>
              <h2>حساب‌های ساخته‌شده</h2>
              <p>{users.length} حساب در سیستم</p>
            </div>
          </div>

          <div className="admin-table-wrap">
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

                  return (
                    <tr key={user.id}>
                      <td data-label="نام کاربری">
                        <strong>{user.displayName}</strong>
                        <small>{user.username}</small>
                      </td>
                      <td data-label="نقش">
                        <span className={`role-pill ${user.role}`}>{user.role === "admin" ? "مدیر" : "کاربر"}</span>
                      </td>
                      <td data-label="اشتراک">
                        <span className={`plan-pill ${access.plan}`}>{access.plan === "pro" ? "حرفه‌ای" : "رایگان"}</span>
                        <small>{access.plan === "free" ? (access.restricted ? "تست منقضی" : `${access.trialDaysRemaining} روز باقی‌مانده`) : "دسترسی کامل"}</small>
                      </td>
                      <td data-label="ثبت‌نام">{new Date(access.signupAt).toLocaleDateString("fa-IR")}</td>
                      <td data-label="آخرین ورود">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("fa-IR") : "بدون ورود"}</td>
                      <td data-label="وضعیت">{locked ? "قفل موقت" : user.isProtected ? "حساب پایه" : "فعال"}</td>
                      <td data-label="عملیات">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
