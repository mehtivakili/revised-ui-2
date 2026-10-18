import assert from "node:assert/strict";
import fs from "node:fs";
import test, { describe } from "node:test";

/**
 * Per-account cap on saved calculation versions. Needs a real PostgreSQL (the behaviour
 * is the SQL itself); skips when none is configured or reachable, like projects-store.
 */

function loadEnv() {
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    /* no .env.local */
  }
}

loadEnv();

let store = null;
let db = null;
let reason = "";

if (!process.env.DATABASE_URL) {
  reason = "DATABASE_URL is not set";
} else {
  try {
    store = await import("@/src/lib/projects/versions");
    db = await import("@/src/lib/db");
    await store.ensureCalculationVersionsTable();
  } catch (error) {
    store = null;
    reason = `database unreachable: ${String(error?.message ?? error).slice(0, 80)}`;
  }
}

const USER = "__test_user_versions__";
const OTHER = "__test_user_versions_other__";
const input = (n) => ({ project: { n }, plan: { title: `پلن ${n}` }, quantities: [], calculation: { engineVersion: "test", standardVersions: [] } });
const numbers = async (user) =>
  (await db.query("SELECT version_number FROM project_calculation_versions WHERE user_id=$1 ORDER BY version_number", [user]))
    .rows.map((row) => Number(row.version_number));
const wipe = async () => db.query("DELETE FROM project_calculation_versions WHERE user_id = ANY($1)", [[USER, OTHER]]);

describe("calculation versions", { skip: store ? false : reason }, () => {
  test("an account keeps only its newest versions; numbers keep counting up", async () => {
    await wipe();
    for (let n = 1; n <= 2; n += 1) await store.saveCalculationVersion(OTHER, input(n), 3);
    let last;
    for (let n = 1; n <= 6; n += 1) last = await store.saveCalculationVersion(USER, input(n), 3);
    assert.deepEqual(await numbers(USER), [4, 5, 6]);
    assert.equal(Number(last.version_number), 6);
    assert.deepEqual(await numbers(OTHER), [1, 2], "another account is untouched");

    const next = await store.saveCalculationVersion(USER, input(7), 3);
    assert.equal(Number(next.version_number), 7, "a pruned history never reuses a number");
    assert.deepEqual(await numbers(USER), [5, 6, 7]);
  });

  test("no limit keeps everything; fewer than the limit deletes nothing", async () => {
    await wipe();
    for (let n = 1; n <= 4; n += 1) await store.saveCalculationVersion(USER, input(n), null);
    assert.deepEqual(await numbers(USER), [1, 2, 3, 4]);
    assert.equal(await store.pruneCalculationVersions(USER, 10), 0);
    assert.equal(await store.pruneCalculationVersions(USER, 2), 2);
    assert.deepEqual(await numbers(USER), [3, 4]);
    await wipe();
  });

  test("the limit comes from the role and the environment", () => {
    assert.equal(store.calculationVersionLimitFor("admin"), null);
    assert.equal(store.calculationVersionLimitFor("user"), store.DEFAULT_CALCULATION_VERSIONS_PER_USER);
  });
});
