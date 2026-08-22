/**
 * PM2 process definition for the production server.
 *
 * Runs `next start`, so a production build must exist first — `npm run build` writes it
 * to `.next`. The dev server keeps its own output under `.next/dev`, so building while
 * dev is running no longer clobbers it, but the two still cannot share port 3000.
 *
 * Environment: Next.js loads `.env.local` itself at startup, so the OLLAMA_* keys and
 * DATABASE_URL are picked up without being repeated here. Only values PM2 itself needs
 * to set before Node boots belong in `env`.
 */
module.exports = {
  apps: [
    {
      name: "hamyar-doorbin",
      cwd: __dirname,
      // Invoking Next's bin directly rather than through npm keeps PM2 supervising the
      // server process itself; with `npm start` it would watch a shell that forks away,
      // and restarts would leave the real server orphaned.
      script: "./node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      interpreter: "node",

      // Fork, not cluster: one Next.js server per box. Cluster mode would fork several
      // instances competing for the same port and duplicating the in-process caches.
      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      watch: false,

      /*
       * Headroom for the heavier routes.
       *
       * The old 1G ceiling was below what a normal request pattern reaches — the planner
       * pulls in three.js and the assistant holds knowledge indexes in memory — so the
       * process was liable to be recycled mid-request under ordinary load rather than
       * only when genuinely leaking.
       */
      max_memory_restart: "1500M",

      // Back off rather than hammering: if the build is missing or a port is taken,
      // an unthrottled restart loop fills the log with the same error hundreds of times.
      min_uptime: "20s",
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 8000,

      time: true,
      merge_logs: true,
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",

      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
