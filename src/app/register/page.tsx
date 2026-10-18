import { RegisterForm } from "@/src/components/RegisterForm";
import type { Metadata } from "next";
import { pageMetadata } from "@/src/lib/seo";

export const metadata: Metadata = pageMetadata("/register", "ثبت‌نام", "ساخت حساب رایگان همیار دوربین برای ذخیره نقشه‌ها و پروژه‌ها.");

export default function RegisterPage() {
  return <RegisterForm />;
}
