import { cookies } from "next/headers";
import { readSession } from "./authStore";

export const sessionCookieName = "hamyar_session";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return readSession(cookieStore.get(sessionCookieName)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  };
}
