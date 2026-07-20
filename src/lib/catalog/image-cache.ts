import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { pool } from "@/src/lib/db";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const BATCH_SIZE = 200;
let workerRunning = false;
let resumeTimer: NodeJS.Timeout | undefined;

function allowedImageHosts() {
  const storeHost = process.env.WOOCOMMERCE_URL ? new URL(process.env.WOOCOMMERCE_URL).hostname : "";
  const storeVariants = storeHost ? [storeHost, storeHost.startsWith("www.") ? storeHost.slice(4) : `www.${storeHost}`] : [];
  return new Set([...storeVariants, ...(process.env.WOOCOMMERCE_IMAGE_HOSTS || "").split(",").map((item) => item.trim()).filter(Boolean)]);
}

function extensionFor(contentType: string, sourceUrl: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("svg")) return "svg";
  const sourceExtension = path.extname(new URL(sourceUrl).pathname).slice(1).toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(sourceExtension) ? sourceExtension : "jpg";
}

async function claimImageJob() {
  const result = await pool.query(`UPDATE catalog_image_jobs SET status='downloading',attempts=attempts+1,updated_at=NOW()
    WHERE id=(SELECT id FROM catalog_image_jobs
      WHERE status IN ('queued','failed') AND attempts < 4 AND next_attempt_at <= NOW()
      ORDER BY CASE status WHEN 'queued' THEN 0 ELSE 1 END,created_at
      FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,woo_id,position,source_url`);
  return result.rows[0] as { id: number; woo_id: number; position: number; source_url: string } | undefined;
}

async function cacheImage(job: { id: number; woo_id: number; position: number; source_url: string }) {
  const source = new URL(job.source_url);
  if (source.protocol !== "https:" || !allowedImageHosts().has(source.hostname)) throw new Error(`میزبان تصویر مجاز نیست: ${source.hostname}`);
  const response = await fetch(source, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`نوع فایل تصویر نیست: ${contentType || "unknown"}`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_IMAGE_BYTES) throw new Error("حجم تصویر بیشتر از حد مجاز است.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("حجم تصویر بیشتر از حد مجاز است.");
  const extension = extensionFor(contentType, job.source_url);
  const hash = createHash("sha256").update(job.source_url).digest("hex").slice(0, 12);
  const filename = `${job.woo_id}-${job.position}-${hash}.${extension}`;
  const directory = process.env.CATALOG_IMAGE_DIR || path.join(process.cwd(), "public", "catalog-cache");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);
  await pool.query("UPDATE catalog_image_jobs SET status='completed',local_filename=$1,public_path=$2,content_type=$3,byte_size=$4,last_error=NULL,completed_at=NOW(),updated_at=NOW() WHERE id=$5",
    [filename, `/catalog-cache/${filename}`, contentType, bytes.byteLength, job.id]);
}

async function runWorker() {
  await pool.query("UPDATE catalog_image_jobs SET status='queued',next_attempt_at=NOW(),updated_at=NOW() WHERE status='downloading' AND updated_at < NOW() - INTERVAL '10 minutes'");
  let processed = 0;
  for (; processed < BATCH_SIZE; processed += 1) {
    const job = await claimImageJob();
    if (!job) break;
    try {
      await cacheImage(job);
    } catch (error) {
      await pool.query("UPDATE catalog_image_jobs SET status='failed',last_error=$1,next_attempt_at=NOW() + (INTERVAL '1 minute' * LEAST(attempts * attempts,30)),updated_at=NOW() WHERE id=$2",
        [error instanceof Error ? error.message.slice(0, 500) : "خطای نامشخص دریافت تصویر", job.id]);
    }
  }
  return processed;
}

export function startCatalogImageWorker() {
  if (workerRunning) return;
  if (resumeTimer) clearTimeout(resumeTimer);
  workerRunning = true;
  void runWorker().then((processed) => {
    workerRunning = false;
    if (processed === BATCH_SIZE) {
      resumeTimer = setTimeout(startCatalogImageWorker, 1_000);
      resumeTimer.unref?.();
    }
  }).catch(() => { workerRunning = false; });
}
