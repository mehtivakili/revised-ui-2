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

const storageProducts = [
  { id: 'storage-wd-purple-1tb', wooId: 990001, sku: 'WD10PURZ', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple ظرفیت 1 ترابایت', brand: 'Western Digital', price: 3200000, specs: { capacityTb: 1, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 5.0 } },
  { id: 'storage-wd-purple-2tb', wooId: 990002, sku: 'WD20PURZ', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple ظرفیت 2 ترابایت', brand: 'Western Digital', price: 4100000, specs: { capacityTb: 2, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 5.2 } },
  { id: 'storage-wd-purple-4tb', wooId: 990003, sku: 'WD40PURZ', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple ظرفیت 4 ترابایت', brand: 'Western Digital', price: 5800000, specs: { capacityTb: 4, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 5.5 } },
  { id: 'storage-wd-purple-6tb', wooId: 990004, sku: 'WD60PURZ', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple ظرفیت 6 ترابایت', brand: 'Western Digital', price: 8700000, specs: { capacityTb: 6, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 6.2 } },
  { id: 'storage-wd-purple-8tb', wooId: 990005, sku: 'WD82PURZ', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple ظرفیت 8 ترابایت', brand: 'Western Digital', price: 12900000, specs: { capacityTb: 8, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 6.8 } },
  { id: 'storage-wd-purple-10tb', wooId: 990006, sku: 'WD101PURP', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple Pro ظرفیت 10 ترابایت', brand: 'Western Digital', price: 16800000, specs: { capacityTb: 10, workloadTbPerYear: 360, surveillanceOptimized: true, warrantyMonths: 36, activePowerW: 7.2 } },
  { id: 'storage-wd-purple-12tb', wooId: 990007, sku: 'WD121PURP', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple Pro ظرفیت 12 ترابایت', brand: 'Western Digital', price: 19900000, specs: { capacityTb: 12, workloadTbPerYear: 360, surveillanceOptimized: true, warrantyMonths: 36, activePowerW: 7.5 } },
  { id: 'storage-wd-purple-14tb', wooId: 990008, sku: 'WD141PURP', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple Pro ظرفیت 14 ترابایت', brand: 'Western Digital', price: 23500000, specs: { capacityTb: 14, workloadTbPerYear: 360, surveillanceOptimized: true, warrantyMonths: 36, activePowerW: 8.0 } },
  { id: 'storage-wd-purple-18tb', wooId: 990009, sku: 'WD181PURP', name: 'هارد دیسک اینترنال وسترن دیجیتال مدل Purple Pro ظرفیت 18 ترابایت', brand: 'Western Digital', price: 34500000, specs: { capacityTb: 18, workloadTbPerYear: 550, surveillanceOptimized: true, warrantyMonths: 36, activePowerW: 9.0 } },
  { id: 'storage-seagate-skyhawk-2tb', wooId: 990010, sku: 'ST2000VX015', name: 'هارد دیسک اینترنال سیگیت مدل SkyHawk ظرفیت 2 ترابایت', brand: 'Seagate', price: 3950000, specs: { capacityTb: 2, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 5.0 } },
  { id: 'storage-seagate-skyhawk-4tb', wooId: 990011, sku: 'ST4000VX016', name: 'هارد دیسک اینترنال سیگیت مدل SkyHawk ظرفیت 4 ترابایت', brand: 'Seagate', price: 5600000, specs: { capacityTb: 4, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 5.6 } },
  { id: 'storage-seagate-skyhawk-6tb', wooId: 990012, sku: 'ST6000VX001', name: 'هارد دیسک اینترنال سیگیت مدل SkyHawk ظرفیت 6 ترابایت', brand: 'Seagate', price: 8400000, specs: { capacityTb: 6, workloadTbPerYear: 180, surveillanceOptimized: true, warrantyMonths: 24, activePowerW: 6.0 } },
  { id: 'storage-seagate-skyhawk-8tb', wooId: 990013, sku: 'ST8000VE000', name: 'هارد دیسک اینترنال سیگیت مدل SkyHawk AI ظرفیت 8 ترابایت', brand: 'Seagate', price: 12400000, specs: { capacityTb: 8, workloadTbPerYear: 360, surveillanceOptimized: true, warrantyMonths: 36, activePowerW: 7.0 } },
  { id: 'storage-seagate-skyhawk-10tb', wooId: 990014, sku: 'ST10000VE001', name: 'هارد دیسک اینترنال سیگیت مدل SkyHawk AI ظرفیت 10 ترابایت', brand: 'Seagate', price: 16200000, specs: { capacityTb: 10, workloadTbPerYear: 360, surveillanceOptimized: true, warrantyMonths: 36, activePowerW: 7.5 } },
  { id: 'storage-seagate-skyhawk-16tb', wooId: 990015, sku: 'ST16000VE002', name: 'هارد دیسک اینترنال سیگیت مدل SkyHawk AI ظرفیت 16 ترابایت', brand: 'Seagate', price: 28900000, specs: { capacityTb: 16, workloadTbPerYear: 550, surveillanceOptimized: true, warrantyMonths: 36, activePowerW: 8.5 } }
];

const upsProducts = [
  { id: 'ups-faratel-600va', wooId: 990101, sku: 'FR-600', name: 'یو پی اس فاراتل مدل double conversion ظرفیت 600 ولت آمپر', brand: 'Faratel', price: 3800000, specs: { capacityVa: 600, outputPowerW: 420, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-faratel-1kva', wooId: 990102, sku: 'FR-1000', name: 'یو پی اس فاراتل مدل Line-Interactive ظرفیت 1000 ولت آمپر', brand: 'Faratel', price: 6200000, specs: { capacityVa: 1000, outputPowerW: 700, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-faratel-1.5kva', wooId: 990103, sku: 'FR-1500', name: 'یو پی اس فاراتل مدل Line-Interactive ظرفیت 1500 ولت آمپر', brand: 'Faratel', price: 8900000, specs: { capacityVa: 1500, outputPowerW: 1050, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-faratel-2kva', wooId: 990104, sku: 'FR-2000', name: 'یو پی اس فاراتل مدل Online Double Conversion ظرفیت 2000 ولت آمپر', brand: 'Faratel', price: 13500000, specs: { capacityVa: 2000, outputPowerW: 1600, backupMinutesAtHalfLoad: 20 } },
  { id: 'ups-faratel-3kva', wooId: 990105, sku: 'FR-3000', name: 'یو پی اس فاراتل مدل Online Double Conversion ظرفیت 3000 ولت آمپر', brand: 'Faratel', price: 19500000, specs: { capacityVa: 3000, outputPowerW: 2400, backupMinutesAtHalfLoad: 20 } },
  { id: 'ups-fara-1kva', wooId: 990106, sku: 'FA-1000', name: 'یو پی اس فارا مدل Line-Interactive ظرفیت 1000 ولت آمپر', brand: 'Fara', price: 4800000, specs: { capacityVa: 1000, outputPowerW: 700, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-fara-2kva', wooId: 990107, sku: 'FA-2000', name: 'یو پی اس فارا مدل Online ظرفیت 2000 ولت آمپر', brand: 'Fara', price: 10800000, specs: { capacityVa: 2000, outputPowerW: 1600, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-fara-3kva', wooId: 990108, sku: 'FA-3000', name: 'یو پی اس فارا مدل Online ظرفیت 3000 ولت آمپر', brand: 'Fara', price: 16500000, specs: { capacityVa: 3000, outputPowerW: 2400, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-fara-6kva', wooId: 990109, sku: 'FA-6000', name: 'یو پی اس فارا مدل Online ظرفیت 6000 ولت آمپر', brand: 'Fara', price: 32000000, specs: { capacityVa: 6000, outputPowerW: 4800, backupMinutesAtHalfLoad: 25 } },
  { id: 'ups-fara-10kva', wooId: 990110, sku: 'FA-10000', name: 'یو پی اس فارا مدل Online ظرفیت 10000 ولت آمپر', brand: 'Fara', price: 58000000, specs: { capacityVa: 10000, outputPowerW: 8000, backupMinutesAtHalfLoad: 25 } },
  { id: 'ups-optinet-1kva', wooId: 990111, sku: 'OP-1000', name: 'یو پی اس اپتینت مدل Line-Interactive ظرفیت 1000 ولت آمپر', brand: 'Optinet', price: 5100000, specs: { capacityVa: 1000, outputPowerW: 700, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-optinet-2kva', wooId: 990112, sku: 'OP-2000', name: 'یو پی اس اپتینت مدل Online ظرفیت 2000 ولت آمپر', brand: 'Optinet', price: 11200000, specs: { capacityVa: 2000, outputPowerW: 1600, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-optinet-3kva', wooId: 990113, sku: 'OP-3000', name: 'یو پی اس اپتینت مدل Online ظرفیت 3000 ولت آمپر', brand: 'Optinet', price: 17900000, specs: { capacityVa: 3000, outputPowerW: 2400, backupMinutesAtHalfLoad: 15 } },
  { id: 'ups-optinet-5kva', wooId: 990114, sku: 'OP-5000', name: 'یو پی اس اپتینت مدل Online ظرفیت 5000 ولت آمپر', brand: 'Optinet', price: 27500000, specs: { capacityVa: 5000, outputPowerW: 4000, backupMinutesAtHalfLoad: 20 } },
  { id: 'ups-optinet-10kva', wooId: 990115, sku: 'OP-10000', name: 'یو پی اس اپتینت مدل Online ظرفیت 10000 ولت آمپر', brand: 'Optinet', price: 62000000, specs: { capacityVa: 10000, outputPowerW: 8000, backupMinutesAtHalfLoad: 20 } }
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const brands = ['Western Digital', 'Seagate', 'Faratel', 'Fara', 'Optinet'];
    const brandMap = new Map();
    for (const brand of brands) {
      const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let res = await client.query("SELECT id FROM catalog_brands WHERE slug = $1 OR name = $2", [slug, brand]);
      if (res.rows.length > 0) {
        brandMap.set(brand, Number(res.rows[0].id));
      } else {
        res = await client.query(
          "INSERT INTO catalog_brands (name, slug) VALUES ($1, $2) RETURNING id",
          [brand, slug]
        );
        brandMap.set(brand, Number(res.rows[0].id));
      }
    }

    const allWooIds = [...storageProducts.map(p => p.wooId), ...upsProducts.map(p => p.wooId)];
    await client.query("DELETE FROM catalog_products WHERE woo_id = ANY($1::bigint[])", [allWooIds]);

    console.log("Inserting storage products...");
    for (const product of storageProducts) {
      const brandId = brandMap.get(product.brand);
      const payload = {
        id: product.id,
        wooId: product.wooId,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: 'storage',
        price: product.price,
        stockStatus: 'in_stock',
        stockQuantity: 10,
        warrantyMonths: product.specs.warrantyMonths,
        sourceUrl: 'https://ddcpersia.com',
        source: 'woocommerce',
        specs: product.specs,
        dataQuality: { status: 'verified', warnings: [] }
      };

      await client.query(
        `INSERT INTO catalog_products (id, woo_id, sku, name, brand_id, category, price, stock_status, stock_quantity, warranty_months, source_url, source, raw_payload, synced_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
        [product.id, product.wooId, product.sku, product.name, brandId, 'storage', product.price, 'in_stock', 10, product.specs.warrantyMonths, 'https://ddcpersia.com', 'woocommerce', JSON.stringify(payload)]
      );

      await client.query(
        `INSERT INTO storage_specs (product_id, capacity_tb, workload_tb_per_year, surveillance_optimized, warranty_months, active_power_w) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [product.id, product.specs.capacityTb, product.specs.workloadTbPerYear, product.specs.surveillanceOptimized, product.specs.warrantyMonths, product.specs.activePowerW]
      );
    }

    console.log("Inserting UPS products...");
    for (const product of upsProducts) {
      const brandId = brandMap.get(product.brand);
      const payload = {
        id: product.id,
        wooId: product.wooId,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: 'ups',
        price: product.price,
        stockStatus: 'in_stock',
        stockQuantity: 10,
        warrantyMonths: 12,
        sourceUrl: 'https://ddcpersia.com',
        source: 'woocommerce',
        specs: product.specs,
        dataQuality: { status: 'verified', warnings: [] }
      };

      await client.query(
        `INSERT INTO catalog_products (id, woo_id, sku, name, brand_id, category, price, stock_status, stock_quantity, warranty_months, source_url, source, raw_payload, synced_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
        [product.id, product.wooId, product.sku, product.name, brandId, 'ups', product.price, 'in_stock', 10, 12, 'https://ddcpersia.com', 'woocommerce', JSON.stringify(payload)]
      );

      await client.query(
        `INSERT INTO ups_specs (product_id, capacity_va, output_power_w, backup_minutes_at_half_load) 
         VALUES ($1, $2, $3, $4)`,
        [product.id, product.specs.capacityVa, product.specs.outputPowerW, product.specs.backupMinutesAtHalfLoad]
      );
    }

    await client.query("COMMIT");
    console.log("Successfully seeded 15 Storage drives and 15 UPS models!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error during seeding:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
