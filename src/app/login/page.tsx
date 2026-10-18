import { LoginForm, type LoginMode } from "@/src/components/LoginForm";
import { safeAuthRedirect } from "@/src/lib/authRedirect";
import type { Metadata } from "next";
import { pageMetadata } from "@/src/lib/seo";

type LoginPageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    error?: string | string[];
    next?: string | string[];
  }>;
};

export const metadata: Metadata = pageMetadata("/login", "ورود به حساب", "ورود به حساب همیار دوربین با پیامک یا رمز عبور.", { index: false });

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const modeValue = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const errorValue = Array.isArray(params.error) ? params.error[0] : params.error;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const initialMode: LoginMode = modeValue === "password" ? "password" : "otp";

  return <LoginForm initialMode={initialMode} initialError={errorValue} redirectTo={safeAuthRedirect(nextValue)} />;
}
