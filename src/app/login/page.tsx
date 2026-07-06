import { LoginForm, type LoginMode } from "@/src/components/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const modeValue = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const errorValue = Array.isArray(params.error) ? params.error[0] : params.error;
  const initialMode: LoginMode = modeValue === "password" ? "password" : "otp";

  return <LoginForm initialMode={initialMode} initialError={errorValue} />;
}
