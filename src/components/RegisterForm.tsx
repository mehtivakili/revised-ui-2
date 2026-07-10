"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Check, KeyRound, MessageSquareText, Phone, UserRound } from "lucide-react";

type Step = "phone" | "code" | "details";

export function RegisterForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [code, setCode] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accountExists, setAccountExists] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    setAccountExists(false);

    const response = await fetch("/api/auth/register/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone })
    });
    const data = await response.json();
    setPending(false);

    if (!response.ok || !data.ok) {
      setAccountExists(data.code === "account_exists");
      setError(data.error || "ارسال کد انجام نشد.");
      return;
    }

    setVerifiedPhone(data.phone);
    setStep("code");
    setMessage(data.message);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/auth/register/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: verifiedPhone || phone, code })
    });
    const data = await response.json();
    setPending(false);

    if (!response.ok || !data.ok) {
      setError(data.error || "کد تایید نشد.");
      return;
    }

    setVerifiedPhone(data.phone);
    setRegistrationToken(data.registrationToken);
    setDisplayName(data.phone);
    setPassword(data.phone);
    setConfirmPassword(data.phone);
    setStep("details");
    setMessage("شماره تایید شد. اطلاعات حساب را کامل کنید.");
  }

  async function completeRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("تکرار رمز عبور با رمز اصلی یکسان نیست.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/auth/register/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: verifiedPhone,
        registrationToken,
        displayName,
        password
      })
    });
    const data = await response.json();
    setPending(false);

    if (!response.ok || !data.ok) {
      setError(data.error || "ثبت‌نام کامل نشد.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="auth-page">
      <section className="auth-card register-card">
        <p className="eyebrow">ثبت‌نام</p>
        <h1>ساخت حساب کاربری</h1>
        <p className="auth-lead">ابتدا شماره موبایل را تایید کنید، سپس نام و رمز عبور حساب را ثبت کنید.</p>

        <div className="register-steps" aria-label="مراحل ثبت‌نام">
          <span className={step === "phone" ? "active" : ""}>
            <Phone size={15} aria-hidden="true" />
            موبایل
          </span>
          <span className={step === "code" ? "active" : ""}>
            <MessageSquareText size={15} aria-hidden="true" />
            تایید
          </span>
          <span className={step === "details" ? "active" : ""}>
            <UserRound size={15} aria-hidden="true" />
            حساب
          </span>
        </div>

        {step === "phone" ? (
          <form className="form-stack" onSubmit={requestCode}>
            <label htmlFor="register-phone">شماره موبایل</label>
            <input
              id="register-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09123456789"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
            <button type="submit" disabled={pending}>
              <MessageSquareText size={16} aria-hidden="true" />
              {pending ? "در حال ارسال..." : "ارسال کد تایید"}
            </button>
          </form>
        ) : null}

        {step === "code" ? (
          <form className="form-stack" onSubmit={verifyCode}>
            <label htmlFor="register-code">کد تایید</label>
            <input
              id="register-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="کد تایید"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
            <button type="submit" disabled={pending}>
              <Check size={16} aria-hidden="true" />
              {pending ? "در حال بررسی..." : "تایید و ادامه"}
            </button>
          </form>
        ) : null}

        {step === "details" ? (
          <form className="form-stack" onSubmit={completeRegister}>
            <label htmlFor="register-verified-phone">شماره تایید شده</label>
            <input
              id="register-verified-phone"
              name="verifiedPhone"
              dir="ltr"
              value={verifiedPhone}
              readOnly
            />
            <label htmlFor="register-name">نام نمایشی</label>
            <input
              id="register-name"
              name="displayName"
              autoComplete="name"
              placeholder="نام و نام خانوادگی"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <label htmlFor="register-password">رمز عبور</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <label htmlFor="register-confirm-password">تکرار رمز عبور</label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <button type="submit" disabled={pending}>
              <KeyRound size={16} aria-hidden="true" />
              {pending ? "در حال ساخت حساب..." : "ساخت حساب"}
            </button>
          </form>
        ) : null}

        {message ? <p className="form-message success">{message}</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {accountExists ? (
          <p className="auth-switch account-exists-link">
            <Link href="/login">ورود به حساب کاربری</Link>
          </p>
        ) : null}
        <p className="auth-switch">
          حساب دارید؟ <Link href="/login">وارد شوید</Link>
        </p>
      </section>
    </main>
  );
}
