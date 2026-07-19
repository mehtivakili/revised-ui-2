import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { mockProducts } from "../src/lib/catalog/mock-products.ts";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not defined");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
  CREATE TABLE IF NOT EXISTS catalog_brands (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS catalog_products (
    id TEXT PRIMARY KEY,
    woo_id BIGINT UNIQUE,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand_id BIGINT REFERENCES catalog_brands(id),
    category TEXT NOT NULL CHECK (category IN ('camera','recorder','switch','storage','ups')),
    price BIGINT NOT NULL DEFAULT 0,
    stock_status TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    warranty_months INTEGER,
    source_url TEXT,
    source TEXT NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_catalog_products_category_stock ON catalog_products(category, stock_status);
  CREATE INDEX IF NOT EXISTS idx_catalog_products_brand ON catalog_products(brand_id);
  CREATE TABLE IF NOT EXISTS camera_specs (
    product_id TEXT PRIMARY KEY REFERENCES catalog_products(id) ON DELETE CASCADE,
    technology TEXT NOT NULL, camera_type TEXT NOT NULL, resolution_mp NUMERIC(4,1) NOT NULL,
    resolution_width INTEGER, resolution_height INTEGER, sensor_format TEXT,
    focal_min_mm NUMERIC(6,2), focal_max_mm NUMERIC(6,2), horizontal_fov_min NUMERIC(6,2), horizontal_fov_max NUMERIC(6,2),
    max_fps INTEGER, codecs TEXT[] NOT NULL DEFAULT '{}', recommended_bitrate_kbps INTEGER,
    ir_range_m NUMERIC(7,2), dori_detect_m NUMERIC(7,2), dori_observe_m NUMERIC(7,2), dori_recognize_m NUMERIC(7,2), dori_identify_m NUMERIC(7,2),
    microphone BOOLEAN, speaker BOOLEAN, poe BOOLEAN, max_power_w NUMERIC(7,2), ip_rating TEXT, ai_features TEXT[] NOT NULL DEFAULT '{}', local_storage_gb INTEGER
  );
  ALTER TABLE camera_specs ADD COLUMN IF NOT EXISTS local_storage_gb INTEGER;
  CREATE TABLE IF NOT EXISTS recorder_specs (
    product_id TEXT PRIMARY KEY REFERENCES catalog_products(id) ON DELETE CASCADE,
    technology TEXT NOT NULL, channels INTEGER NOT NULL, incoming_bandwidth_mbps INTEGER NOT NULL,
    max_decode_mp NUMERIC(5,1), drive_bays INTEGER NOT NULL, max_drive_capacity_tb NUMERIC(6,1),
    raid_levels TEXT[] NOT NULL DEFAULT '{}', built_in_poe_ports INTEGER NOT NULL DEFAULT 0,
    codecs TEXT[] NOT NULL DEFAULT '{}', max_camera_resolution_mp NUMERIC(5,1)
  );
  CREATE TABLE IF NOT EXISTS switch_specs (
    product_id TEXT PRIMARY KEY REFERENCES catalog_products(id) ON DELETE CASCADE,
    poe_ports INTEGER NOT NULL, total_ports INTEGER NOT NULL, poe_budget_w NUMERIC(8,2) NOT NULL,
    max_power_per_port_w NUMERIC(7,2), uplink_gbps NUMERIC(6,2), extend_range_m INTEGER,
    managed BOOLEAN NOT NULL DEFAULT FALSE, surge_protection BOOLEAN NOT NULL DEFAULT FALSE
  );
  CREATE TABLE IF NOT EXISTS storage_specs (
    product_id TEXT PRIMARY KEY REFERENCES catalog_products(id) ON DELETE CASCADE,
    capacity_tb NUMERIC(6,1) NOT NULL, workload_tb_per_year INTEGER,
    surveillance_optimized BOOLEAN NOT NULL DEFAULT TRUE, warranty_months INTEGER
  );
  CREATE TABLE IF NOT EXISTS ups_specs (
    product_id TEXT PRIMARY KEY REFERENCES catalog_products(id) ON DELETE CASCADE,
    capacity_va INTEGER NOT NULL, output_power_w INTEGER NOT NULL, backup_minutes_at_half_load INTEGER
  );
  CREATE TABLE IF NOT EXISTS catalog_sync_runs (
    id BIGSERIAL PRIMARY KEY, source TEXT NOT NULL, status TEXT NOT NULL,
    products_received INTEGER NOT NULL DEFAULT 0, products_normalized INTEGER NOT NULL DEFAULT 0,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), finished_at TIMESTAMPTZ
  );
`;

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(schema);
    const run = await client.query("INSERT INTO catalog_sync_runs (source, status, products_received) VALUES ($1, 'running', $2) RETURNING id", ["mock-ddcpersia", mockProducts.length]);
    for (const product of mockProducts) {
      const brand = await client.query(
        "INSERT INTO catalog_brands (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        [product.brand, slugify(product.brand)]
      );
      await client.query(`INSERT INTO catalog_products
        (id, woo_id, sku, name, brand_id, category, price, stock_status, stock_quantity, warranty_months, source_url, source, raw_payload, synced_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
        ON CONFLICT (id) DO UPDATE SET woo_id=EXCLUDED.woo_id, sku=EXCLUDED.sku, name=EXCLUDED.name, brand_id=EXCLUDED.brand_id,
          category=EXCLUDED.category, price=EXCLUDED.price, stock_status=EXCLUDED.stock_status, stock_quantity=EXCLUDED.stock_quantity,
          warranty_months=EXCLUDED.warranty_months, source_url=EXCLUDED.source_url, source=EXCLUDED.source, raw_payload=EXCLUDED.raw_payload,
          synced_at=NOW(), updated_at=NOW()`,
        [product.id, product.wooId, product.sku, product.name, brand.rows[0].id, product.category, product.price, product.stockStatus, product.stockQuantity, product.warrantyMonths, product.sourceUrl, product.source, product]
      );
      const s = product.specs;
      if (product.category === "camera") await client.query(`INSERT INTO camera_specs VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        ON CONFLICT (product_id) DO UPDATE SET technology=EXCLUDED.technology,camera_type=EXCLUDED.camera_type,resolution_mp=EXCLUDED.resolution_mp,resolution_width=EXCLUDED.resolution_width,resolution_height=EXCLUDED.resolution_height,sensor_format=EXCLUDED.sensor_format,focal_min_mm=EXCLUDED.focal_min_mm,focal_max_mm=EXCLUDED.focal_max_mm,horizontal_fov_min=EXCLUDED.horizontal_fov_min,horizontal_fov_max=EXCLUDED.horizontal_fov_max,max_fps=EXCLUDED.max_fps,codecs=EXCLUDED.codecs,recommended_bitrate_kbps=EXCLUDED.recommended_bitrate_kbps,ir_range_m=EXCLUDED.ir_range_m,dori_detect_m=EXCLUDED.dori_detect_m,dori_observe_m=EXCLUDED.dori_observe_m,dori_recognize_m=EXCLUDED.dori_recognize_m,dori_identify_m=EXCLUDED.dori_identify_m,microphone=EXCLUDED.microphone,speaker=EXCLUDED.speaker,poe=EXCLUDED.poe,max_power_w=EXCLUDED.max_power_w,ip_rating=EXCLUDED.ip_rating,ai_features=EXCLUDED.ai_features,local_storage_gb=EXCLUDED.local_storage_gb`, [product.id,s.technology,s.cameraType,s.resolutionMp,s.resolutionWidth,s.resolutionHeight,s.sensorFormat,s.focalMinMm,s.focalMaxMm,s.horizontalFovMin,s.horizontalFovMax,s.maxFps,s.codecs,s.recommendedBitrateKbps,s.irRangeM,s.doriDetectM,s.doriObserveM,s.doriRecognizeM,s.doriIdentifyM,s.microphone,s.speaker,s.poe,s.maxPowerW,s.ipRating,s.aiFeatures,s.localStorageGb ?? null]);
      if (product.category === "recorder") await client.query(`INSERT INTO recorder_specs VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (product_id) DO UPDATE SET technology=EXCLUDED.technology,channels=EXCLUDED.channels,incoming_bandwidth_mbps=EXCLUDED.incoming_bandwidth_mbps,max_decode_mp=EXCLUDED.max_decode_mp,drive_bays=EXCLUDED.drive_bays,max_drive_capacity_tb=EXCLUDED.max_drive_capacity_tb,raid_levels=EXCLUDED.raid_levels,built_in_poe_ports=EXCLUDED.built_in_poe_ports,codecs=EXCLUDED.codecs,max_camera_resolution_mp=EXCLUDED.max_camera_resolution_mp`, [product.id,s.technology,s.channels,s.incomingBandwidthMbps,s.maxDecodeMp,s.driveBays,s.maxDriveCapacityTb,s.raidLevels,s.builtInPoePorts,s.codecs,s.maxCameraResolutionMp]);
      if (product.category === "switch") await client.query(`INSERT INTO switch_specs VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (product_id) DO UPDATE SET poe_ports=EXCLUDED.poe_ports,total_ports=EXCLUDED.total_ports,poe_budget_w=EXCLUDED.poe_budget_w,max_power_per_port_w=EXCLUDED.max_power_per_port_w,uplink_gbps=EXCLUDED.uplink_gbps,extend_range_m=EXCLUDED.extend_range_m,managed=EXCLUDED.managed,surge_protection=EXCLUDED.surge_protection`, [product.id,s.poePorts,s.totalPorts,s.poeBudgetW,s.maxPowerPerPortW,s.uplinkGbps,s.extendRangeM,s.managed,s.surgeProtection]);
      if (product.category === "storage") await client.query(`INSERT INTO storage_specs VALUES ($1,$2,$3,$4,$5) ON CONFLICT (product_id) DO UPDATE SET capacity_tb=EXCLUDED.capacity_tb,workload_tb_per_year=EXCLUDED.workload_tb_per_year,surveillance_optimized=EXCLUDED.surveillance_optimized,warranty_months=EXCLUDED.warranty_months`, [product.id,s.capacityTb,s.workloadTbPerYear,s.surveillanceOptimized,s.warrantyMonths]);
      if (product.category === "ups") await client.query(`INSERT INTO ups_specs VALUES ($1,$2,$3,$4) ON CONFLICT (product_id) DO UPDATE SET capacity_va=EXCLUDED.capacity_va,output_power_w=EXCLUDED.output_power_w,backup_minutes_at_half_load=EXCLUDED.backup_minutes_at_half_load`, [product.id,s.capacityVa,s.outputPowerW,s.backupMinutesAtHalfLoad]);
    }
    await client.query("UPDATE catalog_sync_runs SET status='success', products_normalized=$1, finished_at=NOW() WHERE id=$2", [mockProducts.length, run.rows[0].id]);
    await client.query("COMMIT");
    const counts = await client.query("SELECT category, COUNT(*)::int AS count FROM catalog_products WHERE source='mock-ddcpersia' GROUP BY category ORDER BY category");
    console.log(`Seeded ${mockProducts.length} catalog products: ${counts.rows.map((row) => `${row.category}=${row.count}`).join(", ")}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
