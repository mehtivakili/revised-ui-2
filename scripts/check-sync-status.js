const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

async function main() {
  try {
    const { rows: activities } = await pool.query(`
      SELECT pid, state, query, wait_event_type, wait_event, query_start
      FROM pg_stat_activity
      WHERE datname = 'hamyardoorbin'
    `);
    
    console.log("All pg processes:");
    activities.forEach(act => {
      console.log(`\nPID: ${act.pid}`);
      console.log(`State: ${act.state}`);
      console.log(`Wait Event Type: ${act.wait_event_type}`);
      console.log(`Wait Event: ${act.wait_event}`);
      console.log(`Query Start: ${act.query_start}`);
      console.log(`Query: ${act.query}`);
    });
    
    const { rows: locks } = await pool.query(`
      SELECT blocked_locks.pid     AS blocked_pid,
             blocked_activity.query AS blocked_statement,
             blocking_locks.pid    AS blocking_pid,
             blocking_activity.query AS blocking_statement
      FROM  pg_catalog.pg_locks         blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks         blocking_locks 
          ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
    `);
    
    console.log("\nLock Conflicts:");
    if (locks.length === 0) {
      console.log("  No lock conflicts.");
    } else {
      locks.forEach(lock => {
        console.log(`  Blocked PID: ${lock.blocked_pid} running "${lock.blocked_statement}"`);
        console.log(`  Blocking PID: ${lock.blocking_pid} running "${lock.blocking_statement}"`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
