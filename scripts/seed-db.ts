import fs from "fs";
import path from "path";
import { Pool } from "pg";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      process.env[key] = val;
    }
  }
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not defined");
  process.exit(1);
}

const firstNames = [
  "علي", "محمد", "حسن", "حسين", "رضا", "عليرضا", "امير", "سعيد", "امين", "حميد",
  "وحيد", "مهدي", "جواد", "آرش", "بابك", "سينا", "نيما", "پيمان", "نويد", "اميد",
  "اميرحسين", "محمدرضا", "عرفان", "شايان", "پارسا", "كيان", "اميررضا", "پويا", "فربد", "سامان"
];

const lastNames = [
  "رضايي", "كريمي", "احمدي", "حسيني", "علوي", "هاشمي", "محمدي", "اميري", "سعيدي", "حميدي",
  "نظري", "اكبري", "زارع", "موسوي", "پناهي", "باقري", "قاسمي", "صالحي", "رحماني", "مرادي",
  "خسروي", "سليماني", "فلاح", "صادقي", "دهقان", "نوري", "جعفري", "طاهري", "رحیمی", "غلامی"
];

const prefixes = [
  "0912", "0913", "0919", "0921", "0922", "0935", "0936", "0937", "0991", "0995", "0901", "0903"
];

function getRandomPhone() {
  const pref = prefixes[Math.floor(Math.random() * prefixes.length)];
  const body = Math.floor(1000000 + Math.random() * 9000000);
  return pref + body;
}

function getRandomName() {
  const f = firstNames[Math.floor(Math.random() * firstNames.length)];
  const l = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${f} ${l}`;
}

function getRandomDate() {
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const randTime = oneYearAgo + Math.random() * (now - oneYearAgo);
  return new Date(randTime);
}

async function main() {
  if (!dbUrl) {
    console.error("DATABASE_URL is not defined");
    process.exit(1);
  }
  const baseUrl = dbUrl.substring(0, dbUrl.lastIndexOf("/"));
  const defaultDbUrl = `${baseUrl}/postgres`;
  const dbName = dbUrl.substring(dbUrl.lastIndexOf("/") + 1);

  // 1. Setup default pool to create database if not exists
  const setupPool = new Pool({ connectionString: defaultDbUrl });
  const setupClient = await setupPool.connect();
  try {
    console.log(`Checking if database "${dbName}" exists...`);
    const res = await setupClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      await setupClient.query(`CREATE DATABASE ${dbName};`);
      console.log(`Database "${dbName}" created successfully!`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err: any) {
    console.error("Database setup failed: ", err.message);
  } finally {
    setupClient.release();
    await setupPool.end();
  }

  // 2. Connect to actual database
  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();
  try {
    console.log("Creating table users...");
    await client.query(`
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
        failed_logins INTEGER DEFAULT 0,
        is_protected BOOLEAN DEFAULT FALSE
      );
    `);

    console.log("Emptying table users...");
    await client.query("TRUNCATE TABLE users;");

    console.log("Generating 2500 users...");
    await client.query("BEGIN;");

    const adminUsernames = new Set<string>();
    adminUsernames.add("admin");
    await client.query(
      `INSERT INTO users (id, username, role, plan, is_free_account, display_name, signup_at, created_at, failed_logins, is_protected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      ["seed-admin", "admin", "admin", "pro", false, "مدیر سیستم", new Date(), new Date(), 0, true]
    );

    // 9 more admins
    for (let i = 1; i <= 9; i++) {
      let ph = getRandomPhone();
      while (adminUsernames.has(ph)) {
        ph = getRandomPhone();
      }
      adminUsernames.add(ph);
      const name = getRandomName();
      const date = getRandomDate();
      await client.query(
        `INSERT INTO users (id, username, role, plan, is_free_account, display_name, signup_at, created_at, failed_logins, is_protected)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [`admin-${i}`, ph, "admin", "pro", false, name, date, date, 0, false]
      );
    }

    const standardUsernames = new Set<string>();
    standardUsernames.add("user");
    standardUsernames.add("free");

    // seed-user
    await client.query(
      `INSERT INTO users (id, username, role, plan, is_free_account, display_name, signup_at, created_at, failed_logins, is_protected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      ["seed-user", "user", "user", "pro", false, "کاربر آزمایشی", new Date(), new Date(), 0, true]
    );

    // seed-free
    const expiredTrialSignup = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO users (id, username, role, plan, is_free_account, display_name, signup_at, created_at, failed_logins, is_protected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      ["seed-free", "free", "user", "free", true, "کاربر تست رایگان", expiredTrialSignup, expiredTrialSignup, 0, true]
    );

    const totalProNeeded = 497;
    const totalFreeNeeded = 1991;

    let proCount = 0;
    let freeCount = 0;

    for (let i = 0; i < 2488; i++) {
      let ph = getRandomPhone();
      while (adminUsernames.has(ph) || standardUsernames.has(ph)) {
        ph = getRandomPhone();
      }
      standardUsernames.add(ph);

      let plan: "pro" | "free" = "free";
      if (proCount < totalProNeeded && (freeCount >= totalFreeNeeded || Math.random() < 0.2)) {
        plan = "pro";
        proCount++;
      } else {
        freeCount++;
      }

      const name = getRandomName();
      const date = getRandomDate();
      const lastLogin = Math.random() > 0.3 ? getRandomDate() : null;

      await client.query(
        `INSERT INTO users (id, username, role, plan, is_free_account, display_name, signup_at, created_at, last_login_at, failed_logins, is_protected)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [`user-${i}`, ph, "user", plan, plan === "free", name, date, date, lastLogin, 0, false]
      );
    }

    await client.query("COMMIT;");
    console.log("Successfully seeded 2500 users!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Seeding failed: ", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
