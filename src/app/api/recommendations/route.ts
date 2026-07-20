import { NextRequest, NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/src/lib/catalog/repository";
import { recommendProducts } from "@/src/lib/recommendation/engine";
import { parseProjectBrief } from "@/src/lib/recommendation/validation";
import { getBitrateCalibrationFactors, saveBitrateCalibrationSamples } from "@/src/lib/calibration/bitrate";

export async function POST(request: NextRequest) {
  try {
    const brief = parseProjectBrief(await request.json());
    const snapshot = await getCatalogSnapshot();
    const calibration = await getBitrateCalibrationFactors();
    const result = recommendProducts(snapshot.products, brief, calibration);
    result.dataMode = snapshot.dataMode;
    await saveBitrateCalibrationSamples(brief, result);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "خطا در ساخت پیشنهاد." }, { status: 400 });
  }
}
