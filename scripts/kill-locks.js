const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").replace(/\r/g, "").trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

async function main() {
  try {
    console.log("Terminating locked backend processes...");
    const { rows } = await pool.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = 'hamyardoorbin' AND pid <> pg_backend_pid()
    `);
    console.log(`Successfully terminated ${rows.length} backend processes.`);

    console.log("Failing all queued/running sync runs in catalog_sync_runs...");
    const { rowCount } = await pool.query(`
      UPDATE catalog_sync_runs 
      SET status='failed', stage='failed', error='Cancelled/Restarted', finished_at=NOW(), updated_at=NOW() 
      WHERE status IN ('queued', 'running')
    `);
    console.log(`Successfully updated ${rowCount} sync runs to failed.`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
