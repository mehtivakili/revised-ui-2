import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { recommendProducts } from '../src/lib/recommendation/engine';
import { evaluateCameraForZone } from '../src/lib/recommendation/camera-constraints';
import type { CatalogProduct, ProjectBrief, CameraSpecs } from '../src/domain/catalog/types';

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env: Record<string, string> = {};
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
  const client = await pool.connect();
  try {
    console.log("Fetching live catalog from database...");
    const res = await client.query("SELECT raw_payload FROM catalog_products WHERE source = 'woocommerce'");
    const products: CatalogProduct[] = res.rows.map(row => row.raw_payload);
    console.log(`Loaded ${products.length} products from database.`);

    // Check counts
    const cats = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log("Product categories distribution:", cats);

    const brief: ProjectBrief = {
      projectType: "office",
      cameraCount: 4,
      outdoorCount: 2,
      entrances: 1,
      goal: "mixed",
      archiveDays: 30,
      budget: "balanced",
      lowLightPriority: true,
      audioRequired: true,
      localRecordingFallback: true, // This was the strict constraint that caused issues!
      recordingMode: "continuous",
      motionActivityPercent: 30,
      bitrateMode: "VBR",
      recordAudio: true,
      audioBitrateKbps: 64,
      filesystemOverheadPercent: 5,
      vbrSafetyMarginPercent: 10,
      reservePercent: 10,
      zones: [
        {
          id: "zone-1",
          name: "دفتر اصلی ورودی",
          cameraCount: 2,
          outdoor: true,
          goal: "face-capture",
          targetDistanceM: 8,
          sceneWidthM: 4,
          mountingHeightM: 3.5,
          targetHeightM: 1.7,
          cameraTiltDeg: 13
        },
        {
          id: "zone-2",
          name: "حیاط بیرونی",
          cameraCount: 2,
          outdoor: true,
          goal: "plate-capture",
          targetDistanceM: 12,
          sceneWidthM: 6,
          mountingHeightM: 4,
          targetHeightM: 1.5,
          cameraTiltDeg: 12
        }
      ]
    };

    console.log("Running recommendation engine...");
    const result = recommendProducts(products, brief);
    console.log(`Result plans generated: ${result.plans.length}`);

    if (result.plans.length === 0) {
      console.error("FAIL: No plans were generated!");
      console.log("\n--- Debugging Zone 2 Rejections ---");
      // Pick one camera and see why it failed for zone-2
      const firstCamera = products.find(p => p.category === 'camera');
      if (firstCamera) {
        console.log(`Evaluating camera: ${firstCamera.name}`);
        const evalRes = evaluateCameraForZone(firstCamera.specs as CameraSpecs, brief.zones![1], brief);
        console.log(`Zone 2 Evaluation details:`, evalRes);
      }
      console.log("\nFirst 10 Rejected options info:", result.rejected.slice(0, 10));
    } else {
      console.log("SUCCESS: Plans generated successfully!");
      result.plans.forEach(plan => {
        console.log(`\nPlan: ${plan.title} (Score: ${plan.score}, Total Price: ${new Intl.NumberFormat("fa-IR").format(plan.totalPrice)} Tomans)`);
        console.log("Plan Highlights:", plan.highlights);
        console.log("Recommended Products:");
        plan.items.forEach(item => {
          console.log(`  - ${item.product.name} (Qty: ${item.quantity}, Category: ${item.product.category}, Price: ${new Intl.NumberFormat("fa-IR").format(item.product.price)} Tomans)`);
          if (item.product.dataQuality?.status === 'estimated') {
            console.log(`    ⚠️ Estimated spec warnings:`, item.product.dataQuality.warnings);
          }
        });
      });
    }

  } catch (err) {
    console.error("Error during recommendation test:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
