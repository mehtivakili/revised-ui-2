import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type UserRole = "admin" | "user";
export type UserPlan = "free" | "pro";

export type UserAccount = {
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
  protected?: boolean;
};

type OtpRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  requestCount: number;
  nextRequestAt: number;
};

type SmsConfig = {
  providerName: string;
  apiUrl: string;
  senderNumber: string;
  apiKey: string;
  templateId: string;
  timeoutSeconds: number;
  enabled: boolean;
  updatedAt?: string;
};

type AuthState = {
  users: UserAccount[];
  passwords: Map<string, string>;
  otps: Map<string, OtpRecord>;
  ipHits: Map<string, { count: number; resetAt: number }>;
  smsConfig: SmsConfig;
};

const sessionSecret = process.env.AUTH_SECRET || "local-development-secret-change-before-production";
const passwordSecret = process.env.PASSWORD_SECRET || sessionSecret;

const globalState = globalThis as typeof globalThis & { __hamyarAuthState?: AuthState };

function hash(value: string, secret = passwordSecret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function createInitialState(): AuthState {
  const now = new Date().toISOString();
  const expiredTrialSignup = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const passwords = new Map<string, string>();
  passwords.set("admin", hash("1234"));
  passwords.set("user", hash("1234"));
  passwords.set("free", hash("1234"));

  return {
    users: [
      {
        id: "seed-admin",
        username: "admin",
        role: "admin",
        plan: "pro",
        isFreeAccount: false,
        displayName: "مدیر سیستم",
        signupAt: now,
        createdAt: now,
        failedLogins: 0,
        protected: true
      },
      {
        id: "seed-user",
        username: "user",
        role: "user",
        plan: "pro",
        isFreeAccount: false,
        displayName: "کاربر آزمایشی",
        signupAt: now,
        createdAt: now,
        failedLogins: 0,
        protected: true
      },
      {
        id: "seed-free",
        username: "free",
        role: "user",
        plan: "free",
        isFreeAccount: true,
        displayName: "کاربر تست رایگان",
        signupAt: expiredTrialSignup,
        createdAt: expiredTrialSignup,
        failedLogins: 0,
        protected: true
      }
    ],
    passwords,
    otps: new Map(),
    ipHits: new Map(),
    smsConfig: {
      providerName: "",
      apiUrl: "",
      senderNumber: "",
      apiKey: "",
      templateId: "",
      timeoutSeconds: 8,
      enabled: false
    }
  };
}

function state() {
  if (!globalState.__hamyarAuthState) {
    globalState.__hamyarAuthState = createInitialState();
  }

  const authState = globalState.__hamyarAuthState;
  const now = new Date().toISOString();
  authState.passwords.set("admin", authState.passwords.get("admin") ?? hash("1234"));
  authState.passwords.set("user", authState.passwords.get("user") ?? hash("1234"));
  authState.passwords.set("free", authState.passwords.get("free") ?? hash("1234"));

  if (!authState.users.some((user) => user.username === "free")) {
    const expiredTrialSignup = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    authState.users.push({
      id: "seed-free",
      username: "free",
      role: "user",
      plan: "free",
      isFreeAccount: true,
      displayName: "کاربر تست رایگان",
      signupAt: expiredTrialSignup,
      createdAt: expiredTrialSignup,
      failedLogins: 0,
      protected: true
    });
  }

  authState.users.forEach((user) => {
    const persistedSignupAt = user.signupAt ?? user.createdAt ?? now;
    user.signupAt = persistedSignupAt;
    user.createdAt = user.createdAt ?? persistedSignupAt;
    user.plan = user.plan ?? (user.username === "admin" || user.username === "user" ? "pro" : "free");
    user.isFreeAccount = user.plan === "free";
  });

  return authState;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function listUsers() {
  return state().users.map(({ protected: isProtected, failedLogins, lockedUntil, ...user }) => ({
    ...user,
    isProtected: Boolean(isProtected),
    failedLogins,
    lockedUntil
  }));
}

export function getUser(username: string) {
  return state().users.find((user) => user.username === username);
}

export function getUserById(id: string) {
  return state().users.find((user) => user.id === id);
}

export function upsertMobileUser(username: string) {
  const existing = getUser(username);
  if (existing) return existing;
  const signupAt = new Date().toISOString();

  const user: UserAccount = {
    id: randomBytes(10).toString("hex"),
    username,
    role: "user",
    plan: "free",
    isFreeAccount: true,
    displayName: `کاربر ${username}`,
    signupAt,
    createdAt: signupAt,
    failedLogins: 0
  };

  state().users.push(user);
  return user;
}

export function deleteUser(id: string, actorId: string) {
  const authState = state();
  const target = authState.users.find((user) => user.id === id);
  if (!target) return { ok: false as const, error: "حساب کاربری پیدا نشد." };
  if (target.id === actorId) return { ok: false as const, error: "مدیر نمی‌تواند حساب خودش را حذف کند." };
  if (target.protected) return { ok: false as const, error: "حساب‌های پایه قابل حذف نیستند." };

  authState.users = authState.users.filter((user) => user.id !== id);
  return { ok: true as const };
}

export function verifyPassword(username: string, password: string) {
  const user = getUser(username);
  if (!user) return { ok: false as const, error: "نام کاربری یا رمز عبور اشتباه است." };

  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil > now) {
    return { ok: false as const, error: "به دلیل تلاش‌های ناموفق، حساب موقتاً قفل شده است." };
  }

  const expected = state().passwords.get(username);
  if (!expected || !safeEqual(expected, hash(password))) {
    user.failedLogins += 1;
    if (user.failedLogins >= 5) {
      user.lockedUntil = now + 15 * 60 * 1000;
      user.failedLogins = 0;
    }
    return { ok: false as const, error: "نام کاربری یا رمز عبور اشتباه است." };
  }

  user.failedLogins = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date().toISOString();
  return { ok: true as const, user };
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const authState = state();
  const now = Date.now();
  const current = authState.ipHits.get(key);

  if (!current || current.resetAt < now) {
    authState.ipHits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const };
  }

  current.count += 1;
  if (current.count > limit) {
    return { ok: false as const, retryAfterMs: current.resetAt - now };
  }

  return { ok: true as const };
}

export function createOtp(username: string) {
  const authState = state();
  const now = Date.now();
  const existing = authState.otps.get(username);

  if (existing && existing.nextRequestAt > now) {
    return {
      ok: false as const,
      error: "برای ارسال دوباره کد کمی صبر کنید.",
      retryAfterMs: existing.nextRequestAt - now
    };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  authState.otps.set(username, {
    codeHash: hash(code),
    expiresAt: now + 2 * 60 * 1000,
    attempts: 0,
    requestCount: (existing?.requestCount ?? 0) + 1,
    nextRequestAt: now + 60 * 1000
  });

  upsertMobileUser(username);
  return { ok: true as const, code, expiresAt: now + 2 * 60 * 1000 };
}

export function verifyOtp(username: string, code: string) {
  const authState = state();
  const record = authState.otps.get(username);
  const now = Date.now();

  if (!record) return { ok: false as const, error: "کد فعالی برای این شماره وجود ندارد." };
  if (record.expiresAt < now) {
    authState.otps.delete(username);
    return { ok: false as const, error: "کد منقضی شده است." };
  }
  if (record.attempts >= 5) {
    authState.otps.delete(username);
    return { ok: false as const, error: "تعداد تلاش‌ها بیش از حد مجاز است." };
  }

  record.attempts += 1;
  if (!safeEqual(record.codeHash, hash(code))) {
    return { ok: false as const, error: "کد وارد شده درست نیست." };
  }

  authState.otps.delete(username);
  const user = upsertMobileUser(username);
  user.lastLoginAt = new Date().toISOString();
  return { ok: true as const, user };
}

export function signSession(user: Pick<UserAccount, "id" | "username" | "role">) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })
  ).toString("base64url");
  const signature = hash(payload, sessionSecret);
  return `${payload}.${signature}`;
}

export function readSession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(hash(payload, sessionSecret), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id: string;
      username: string;
      role: UserRole;
      exp: number;
    };

    if (session.exp < Date.now()) return null;
    const user = getUserById(session.id);
    if (!user || user.username !== session.username || user.role !== session.role) return null;
    return session;
  } catch {
    return null;
  }
}

export function getSmsConfig() {
  const { apiKey, ...visible } = state().smsConfig;
  return {
    ...visible,
    apiKeySet: Boolean(apiKey)
  };
}

export function updateSmsConfig(config: Partial<SmsConfig>) {
  const current = state().smsConfig;
  state().smsConfig = {
    ...current,
    providerName: config.providerName ?? current.providerName,
    apiUrl: config.apiUrl ?? current.apiUrl,
    senderNumber: config.senderNumber ?? current.senderNumber,
    apiKey: config.apiKey || current.apiKey,
    templateId: config.templateId ?? current.templateId,
    timeoutSeconds: Number(config.timeoutSeconds || current.timeoutSeconds),
    enabled: Boolean(config.enabled),
    updatedAt: new Date().toISOString()
  };

  return getSmsConfig();
}
