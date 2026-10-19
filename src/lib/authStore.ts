import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { randomInt } from "crypto";
import { pool, query } from "@/src/lib/db";
import { defaultTrialDays } from "@/src/lib/subscription";

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
  loginCount: number;
  trialDays: number;
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
  otps: Map<string, OtpRecord>;
  registrationTokens: Map<string, { username: string; expiresAt: number }>;
  ipHits: Map<string, { count: number; resetAt: number }>;
  smsConfig: SmsConfig;
};

const MAX_EPHEMERAL_AUTH_RECORDS = 10_000;

function resolveSessionSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) {
    if (process.env.NODE_ENV === "production" && configured.length < 32) {
      throw new Error("AUTH_SECRET must contain at least 32 characters in production.");
    }
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return "local-development-secret-change-before-production";
}

const sessionSecret = resolveSessionSecret();
const passwordSecret = process.env.PASSWORD_SECRET || sessionSecret;

/*
 * Seed accounts (admin, user, free) take their passwords from the environment, never from
 * source code. In production an account whose variable is unset is simply not created.
 * In development a missing one gets a random password for this run, printed once to the
 * server console when it is actually used.
 */
type SeedAccount = "admin" | "user" | "free";

const seedPasswordVariables: Record<SeedAccount, string> = {
  admin: "SEED_ADMIN_PASSWORD",
  user: "SEED_USER_PASSWORD",
  free: "SEED_FREE_PASSWORD"
};

const generatedSeedPasswords = new Map<SeedAccount, string>();

function configuredSeedPassword(account: SeedAccount) {
  return process.env[seedPasswordVariables[account]]?.trim() || null;
}

/** This run's development password for a seed account whose variable is unset. */
function generatedSeedPassword(account: SeedAccount) {
  let password = generatedSeedPasswords.get(account);
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generatedSeedPasswords.set(account, password);
    console.warn(`[auth] ${seedPasswordVariables[account]} is not set; development seed account "${account}" uses this password for this run: ${password}`);
  }
  return password;
}

function seedPassword(account: SeedAccount): string | null {
  const configured = configuredSeedPassword(account);
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : generatedSeedPassword(account);
}

/** Seed accounts are a local-development convenience, never a production fallback. */
function developmentSeedAccountsEnabled() {
  return process.env.NODE_ENV === "development" && !process.env.DATABASE_URL?.trim();
}

function developmentSeedUsers(): UserAccount[] {
  const now = new Date().toISOString();
  const expiredTrialSignup = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: "seed-admin", username: "admin", role: "admin", plan: "pro", isFreeAccount: false,
      displayName: "مدیر سیستم", signupAt: now, createdAt: now, failedLogins: 0,
      loginCount: 1, trialDays: defaultTrialDays, protected: true
    },
    {
      id: "seed-user", username: "user", role: "user", plan: "pro", isFreeAccount: false,
      displayName: "کاربر حرفه‌ای", signupAt: now, createdAt: now, failedLogins: 0,
      loginCount: 1, trialDays: defaultTrialDays, protected: true
    },
    {
      id: "seed-free", username: "free", role: "user", plan: "free", isFreeAccount: true,
      displayName: "کاربر تست رایگان", signupAt: expiredTrialSignup, createdAt: expiredTrialSignup,
      failedLogins: 0, loginCount: 1, trialDays: defaultTrialDays, protected: true
    }
  ];
}

function developmentSeedUser(usernameOrId: string) {
  if (!developmentSeedAccountsEnabled()) return undefined;
  return developmentSeedUsers().find((user) => user.username === usernameOrId || user.id === usernameOrId);
}

const globalState = globalThis as typeof globalThis & {
  __hamyarAuthState?: AuthState;
  __hamyarSchemaReady?: Promise<void>;
};

export function hashPassword(value: string) {
  return createHmac("sha256", passwordSecret).update(value).digest("hex");
}

function hashSession(value: string) {
  return createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function state() {
  if (!globalState.__hamyarAuthState) {
    globalState.__hamyarAuthState = {
      otps: new Map(),
      registrationTokens: new Map(),
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

  globalState.__hamyarAuthState.otps ??= new Map();
  globalState.__hamyarAuthState.registrationTokens ??= new Map();
  globalState.__hamyarAuthState.ipHits ??= new Map();

  return globalState.__hamyarAuthState;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function toIso(value?: Date | string | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

type DbUserRow = {
  id?: unknown;
  username?: unknown;
  role?: unknown;
  plan?: unknown;
  is_free_account?: boolean | null;
  isFreeAccount?: boolean | null;
  display_name?: unknown;
  displayName?: unknown;
  signup_at?: Date | string | null;
  signupAt?: Date | string | null;
  created_at?: Date | string | null;
  createdAt?: Date | string | null;
  last_login_at?: Date | string | null;
  lastLoginAt?: Date | string | null;
  locked_until?: unknown;
  failed_logins?: unknown;
  failedLogins?: unknown;
  login_count?: unknown;
  loginCount?: unknown;
  trial_days?: unknown;
  trialDays?: unknown;
  is_protected?: unknown;
  isProtected?: unknown;
};

function mapDbUser(row: DbUserRow): UserAccount {
  return {
    id: String(row.id),
    username: String(row.username),
    role: row.role === "admin" ? "admin" : "user",
    plan: row.plan === "pro" ? "pro" : "free",
    isFreeAccount: row.is_free_account ?? row.isFreeAccount ?? row.plan !== "pro",
    displayName: String(row.display_name ?? row.displayName ?? row.username),
    signupAt: toIso(row.signup_at ?? row.signupAt) ?? new Date().toISOString(),
    createdAt: toIso(row.created_at ?? row.createdAt) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at ?? row.lastLoginAt),
    lockedUntil: row.locked_until ? Number(row.locked_until) : undefined,
    failedLogins: Number(row.failed_logins ?? row.failedLogins ?? 0),
    loginCount: Number(row.login_count ?? row.loginCount ?? 1),
    trialDays: Number(row.trial_days ?? row.trialDays ?? defaultTrialDays),
    protected: Boolean(row.is_protected ?? row.isProtected)
  };
}

export async function ensureAuthSchema() {
  if (!globalState.__hamyarSchemaReady) {
    globalState.__hamyarSchemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(50) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          role VARCHAR(20) NOT NULL,
          plan VARCHAR(20) NOT NULL,
          is_free_account BOOLEAN DEFAULT TRUE,
          display_name VARCHAR(100) NOT NULL,
          signup_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP,
          login_count INTEGER NOT NULL DEFAULT 1,
          failed_logins INTEGER DEFAULT 0,
          is_protected BOOLEAN DEFAULT FALSE
        );
      `);
      await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
      await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 7");
      await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until BIGINT");
      await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 1");
      await query(`
        CREATE TABLE IF NOT EXISTS user_login_events (
          id BIGSERIAL PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          logged_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await query("CREATE INDEX IF NOT EXISTS user_login_events_logged_in_at_idx ON user_login_events (logged_in_at DESC)");
      await query(`
        CREATE TABLE IF NOT EXISTS user_presence (
          user_id VARCHAR(50) PRIMARY KEY,
          last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await query("CREATE INDEX IF NOT EXISTS user_presence_last_seen_at_idx ON user_presence (last_seen_at DESC)");
      await query(`
        INSERT INTO user_login_events (user_id, logged_in_at)
        SELECT id, last_login_at
        FROM users AS existing_user
        WHERE last_login_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM user_login_events AS event
            WHERE event.user_id = existing_user.id
          )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await query(
        `INSERT INTO app_settings (key, value)
         VALUES ('default_trial_days', $1)
         ON CONFLICT (key) DO NOTHING`,
        [String(defaultTrialDays)]
      );
      await seedBaseUsers();
      await retirePhoneNumberPasswords();
      // Passwords are never kept readable: the old plain-text preview column goes.
      await query("ALTER TABLE users DROP COLUMN IF EXISTS password_preview");
    })();
  }

  return globalState.__hamyarSchemaReady;
}

/**
 * A password hash nobody can match: for accounts that sign in by SMS and have not chosen
 * a password. Random per account, so it is not even the same value twice.
 */
export function unusablePasswordHash() {
  return hashPassword(`!no-password:${randomBytes(32).toString("hex")}`);
}

/**
 * Accounts used to be given their phone number (their username) as password, and the
 * password login accepted it: anyone who knew a number could sign in as its owner. Those,
 * and accounts with no password at all, get an unusable one; they still sign in by SMS.
 */
async function retirePhoneNumberPasswords() {
  const accounts = await query("SELECT id, username, password_hash FROM users");
  for (const row of accounts.rows) {
    const hash = String(row.password_hash ?? "");
    if (hash && !safeEqual(hash, hashPassword(String(row.username)))) continue;
    await query("UPDATE users SET password_hash = $1, failed_logins = 0 WHERE id = $2", [unusablePasswordHash(), row.id]);
  }
}

async function seedBaseUsers() {
  const now = new Date();
  const expiredTrialSignup = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const seeds = [
    ["seed-admin", "admin", "admin", "pro", false, "مدیر سیستم", now, now, 0, true],
    ["seed-user", "user", "user", "pro", false, "کاربر حرفه‌ای", now, now, 0, true],
    ["seed-free", "free", "user", "free", true, "کاربر تست رایگان", expiredTrialSignup, expiredTrialSignup, 0, true]
  ] as const;

  for (const seed of seeds) {
    const account = seed[1] as SeedAccount;
    // An existing account keeps its password; only a missing one is created.
    const existing = await query("SELECT 1 FROM users WHERE username = $1", [account]);
    if (existing.rowCount) continue;
    const password = seedPassword(account);
    if (!password) {
      console.warn(`[auth] ${seedPasswordVariables[account]} is not set; seed account "${account}" was not created.`);
      continue;
    }
    await query(
      `INSERT INTO users
       (id, username, role, plan, is_free_account, display_name, signup_at, created_at, failed_logins, is_protected, password_hash, trial_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = COALESCE(NULLIF(users.password_hash, ''), EXCLUDED.password_hash),
         trial_days = COALESCE(users.trial_days, EXCLUDED.trial_days)`,
      [...seed, hashPassword(password), defaultTrialDays]
    );
  }
}

export async function getDefaultTrialDays() {
  await ensureAuthSchema();
  const result = await query("SELECT value FROM app_settings WHERE key = 'default_trial_days'");
  return Number(result.rows[0]?.value ?? defaultTrialDays);
}

export async function setDefaultTrialDays(days: number) {
  const safeDays = Math.max(0, Math.min(3650, Math.floor(days)));
  await ensureAuthSchema();
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('default_trial_days', $1, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [String(safeDays)]
  );
  return safeDays;
}

export async function getUser(username: string) {
  const localUser = developmentSeedUser(username);
  if (localUser) return localUser;
  await ensureAuthSchema();
  const result = await query("SELECT * FROM users WHERE username = $1", [username]);
  return result.rows[0] ? mapDbUser(result.rows[0]) : undefined;
}

export async function getUserById(id: string) {
  const localUser = developmentSeedUser(id);
  if (localUser) return localUser;
  await ensureAuthSchema();
  const result = await query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ? mapDbUser(result.rows[0]) : undefined;
}

export async function upsertMobileUser(username: string) {
  await ensureAuthSchema();
  const existing = await getUser(username);
  if (existing) return existing;

  const signupAt = new Date();
  const trialDays = await getDefaultTrialDays();
  const result = await query(
    `INSERT INTO users
     (id, username, role, plan, is_free_account, display_name, signup_at, created_at, failed_logins, is_protected, password_hash, trial_days)
     VALUES ($1, $2, 'user', 'free', true, $3, $4, $4, 0, false, $5, $6)
     RETURNING *`,
    [randomBytes(10).toString("hex"), username, `کاربر ${username}`, signupAt, unusablePasswordHash(), trialDays]
  );
  return mapDbUser(result.rows[0]);
}

export async function verifyPassword(username: string, password: string) {
  if (developmentSeedAccountsEnabled()) {
    const user = developmentSeedUsers().find((candidate) => candidate.username === username);
    const expected = user ? seedPassword(user.username as SeedAccount) : null;
    if (!user || !expected || !safeEqual(expected, password)) {
      return { ok: false as const, error: "نام کاربری یا رمز عبور اشتباه است." };
    }
    return {
      ok: true as const,
      user: { ...user, lastLoginAt: new Date().toISOString(), loginCount: user.loginCount + 1 }
    };
  }

  await ensureAuthSchema();
  const result = await query("SELECT * FROM users WHERE username = $1", [username]);
  const row = result.rows[0];
  if (!row) return { ok: false as const, error: "نام کاربری یا رمز عبور اشتباه است." };

  const user = mapDbUser(row);
  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil > now) {
    return { ok: false as const, error: "به دلیل تلاش‌های ناموفق، حساب موقتا قفل شده است." };
  }

  const expected = String(row.password_hash || "");
  if (!expected || !safeEqual(expected, hashPassword(password))) {
    const failedLogins = user.failedLogins + 1;
    const lockedUntil = failedLogins >= 5 ? now + 15 * 60 * 1000 : null;
    await query(
      "UPDATE users SET failed_logins = $1, locked_until = $2 WHERE id = $3",
      [lockedUntil ? 0 : failedLogins, lockedUntil, user.id]
    );
    return { ok: false as const, error: "نام کاربری یا رمز عبور اشتباه است." };
  }

  const loginAt = new Date();
  const loginCount = await recordSuccessfulLogin(user.id, loginAt, true);
  return {
    ok: true as const,
    user: {
      ...user,
      failedLogins: 0,
      lockedUntil: undefined,
      lastLoginAt: loginAt.toISOString(),
      loginCount
    }
  };
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const authState = state();
  const now = Date.now();
  const current = authState.ipHits.get(key);

  if (!current || current.resetAt < now) {
    if (authState.ipHits.size >= MAX_EPHEMERAL_AUTH_RECORDS) {
      for (const [storedKey, record] of authState.ipHits) {
        if (record.resetAt <= now) authState.ipHits.delete(storedKey);
      }
      while (authState.ipHits.size >= MAX_EPHEMERAL_AUTH_RECORDS) {
        const oldestKey = authState.ipHits.keys().next().value as string | undefined;
        if (!oldestKey) break;
        authState.ipHits.delete(oldestKey);
      }
    }
    authState.ipHits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const };
  }

  current.count += 1;
  if (current.count > limit) {
    return { ok: false as const, retryAfterMs: current.resetAt - now };
  }

  return { ok: true as const };
}

export async function createOtp(username: string, options: { ensureUser?: boolean } = {}) {
  const authState = state();
  const now = Date.now();
  const existing = authState.otps.get(username);
  const shouldEnsureUser = options.ensureUser ?? true;

  if (authState.otps.size >= MAX_EPHEMERAL_AUTH_RECORDS) {
    for (const [storedUsername, record] of authState.otps) {
      if (record.expiresAt <= now) authState.otps.delete(storedUsername);
    }
    while (authState.otps.size >= MAX_EPHEMERAL_AUTH_RECORDS) {
      const oldestUsername = authState.otps.keys().next().value as string | undefined;
      if (!oldestUsername) break;
      authState.otps.delete(oldestUsername);
    }
  }

  if (existing && existing.nextRequestAt > now) {
    return {
      ok: false as const,
      error: "برای ارسال دوباره کد کمی صبر کنید.",
      retryAfterMs: existing.nextRequestAt - now
    };
  }

  const code = String(randomInt(100000, 1_000_000));
  authState.otps.set(username, {
    codeHash: hashPassword(code),
    expiresAt: now + 2 * 60 * 1000,
    attempts: 0,
    requestCount: (existing?.requestCount ?? 0) + 1,
    nextRequestAt: now + 60 * 1000
  });

  if (shouldEnsureUser) {
    await upsertMobileUser(username);
  }
  return { ok: true as const, code, expiresAt: now + 2 * 60 * 1000 };
}

export function discardOtp(username: string) {
  state().otps.delete(username);
}

export function replaceOtpCode(username: string, code: string) {
  const record = state().otps.get(username);
  if (!record || !/^[0-9]{4,20}$/.test(code)) return false;
  record.codeHash = hashPassword(code);
  return true;
}

function createRegistrationToken(username: string) {
  const authState = state();
  const now = Date.now();
  for (const [storedToken, record] of authState.registrationTokens) {
    if (record.expiresAt <= now) authState.registrationTokens.delete(storedToken);
  }
  while (authState.registrationTokens.size >= MAX_EPHEMERAL_AUTH_RECORDS) {
    const oldestToken = authState.registrationTokens.keys().next().value as string | undefined;
    if (!oldestToken) break;
    authState.registrationTokens.delete(oldestToken);
  }
  const token = randomBytes(24).toString("base64url");
  authState.registrationTokens.set(token, {
    username,
    expiresAt: now + 10 * 60 * 1000
  });
  return token;
}

function consumeRegistrationToken(token: string, username: string) {
  const authState = state();
  const record = authState.registrationTokens.get(token);
  if (!record || record.username !== username || record.expiresAt < Date.now()) {
    if (record) authState.registrationTokens.delete(token);
    return false;
  }
  authState.registrationTokens.delete(token);
  return true;
}

export async function verifyOtpCode(username: string, code: string, options: { allowTestCode?: boolean; keepRecord?: boolean } = {}) {
  if (process.env.NODE_ENV !== "production" && options.allowTestCode && code === "98765") {
    return { ok: true as const };
  }

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
  if (!safeEqual(record.codeHash, hashPassword(code))) {
    return { ok: false as const, error: "کد وارد شده درست نیست." };
  }

  if (!options.keepRecord) {
    authState.otps.delete(username);
  }
  return { ok: true as const };
}

export async function verifyRegistrationOtp(username: string, code: string) {
  const result = await verifyOtpCode(username, code, { allowTestCode: true });
  if (!result.ok) return result;
  return { ok: true as const, token: createRegistrationToken(username) };
}

export async function completeRegistration(username: string, token: string, displayName: string, password: string) {
  const finalPassword = password.trim();
  if (!finalPassword) {
    return { ok: false as const, error: "لطفاً فیلدهای ضروری را تکمیل کنید." };
  }

  if (!consumeRegistrationToken(token, username)) {
    return { ok: false as const, error: "جلسه ثبت‌نام منقضی شده است. دوباره کد تایید را وارد کنید." };
  }

  const user = await upsertMobileUser(username);
  const finalDisplayName = displayName.trim() || `کاربر ${username}`;
  const loginAt = new Date();
  await query(
    `UPDATE users
     SET display_name = $1, password_hash = $2
     WHERE id = $3`,
    [finalDisplayName, hashPassword(finalPassword), user.id]
  );
  const loginCount = await recordSuccessfulLogin(user.id, loginAt, false);
  return {
    ok: true as const,
    user: {
      ...user,
      displayName: finalDisplayName,
      lastLoginAt: loginAt.toISOString(),
      loginCount
    }
  };
}

export async function verifyOtp(username: string, code: string) {
  const result = await verifyOtpCode(username, code);
  if (!result.ok) return result;

  const user = await getUser(username);
  if (!user) return { ok: false as const, error: "ابتدا ثبت‌نام کنید و حساب کاربری بسازید." };

  const loginAt = new Date();
  const loginCount = await recordSuccessfulLogin(user.id, loginAt, true);
  return {
    ok: true as const,
    user: {
      ...user,
      lastLoginAt: loginAt.toISOString(),
      loginCount
    }
  };
}

async function recordSuccessfulLogin(userId: string, loginAt: Date, incrementLoginCount: boolean) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updateResult = await client.query(
      `UPDATE users
       SET failed_logins = 0,
           locked_until = NULL,
           last_login_at = $1,
           login_count = login_count + $2
       WHERE id = $3
       RETURNING login_count`,
      [loginAt, incrementLoginCount ? 1 : 0, userId]
    );
    await client.query(
      "INSERT INTO user_login_events (user_id, logged_in_at) VALUES ($1, $2)",
      [userId, loginAt]
    );
    await client.query(
      `INSERT INTO user_presence (user_id, last_seen_at)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
      [userId, loginAt]
    );
    await client.query("COMMIT");
    return Number(updateResult.rows[0]?.login_count ?? 1);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordUserActivity(userId: string) {
  if (developmentSeedAccountsEnabled() && developmentSeedUser(userId)) return;
  await ensureAuthSchema();
  await query(
    `INSERT INTO user_presence (user_id, last_seen_at)
     VALUES ($1, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
    [userId]
  );
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
  const signature = hashSession(payload);
  return `${payload}.${signature}`;
}

export async function readSession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(hashSession(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id: string;
      username: string;
      role: UserRole;
      exp: number;
    };

    if (session.exp < Date.now()) return null;
    const user = await getUserById(session.id);
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

