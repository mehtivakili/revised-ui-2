import type { CatalogProduct } from "@/src/domain/catalog/types";

const productUrl = (slug: string) => `https://ddcpersia.com/product/${slug}/`;

const baseMockProducts: CatalogProduct[] = [
  {
    id: "cam-c32ks", wooId: 91001, sku: "TC-C32KS-I3-28", name: "دوربین تیاندی TC-C32KS 3MP لنز 2.8", brand: "Tiandy", category: "camera",
    price: 4_850_000, stockStatus: "in_stock", stockQuantity: 24, warrantyMonths: 24,
    sourceUrl: productUrl("دوربین-مداربسته-تیاندی-مدل-tc-c32ks-spec-i3-e-y-c-h-2-8mm-v4-0"), source: "mock-ddcpersia",
    specs: { technology: "IP", cameraType: "turret", resolutionMp: 3, resolutionWidth: 2304, resolutionHeight: 1296, sensorFormat: "1/2.8\"", focalMinMm: 2.8, focalMaxMm: 2.8, horizontalFovMin: 96, horizontalFovMax: 96, maxFps: 25, codecs: ["H.265+", "H.265", "H.264"], recommendedBitrateKbps: 2500, irRangeM: 30, doriDetectM: 62, doriObserveM: 25, doriRecognizeM: 12, doriIdentifyM: 6, microphone: true, speaker: false, poe: true, maxPowerW: 7, ipRating: "IP67", aiFeatures: ["تشخیص انسان", "تشخیص حرکت"] }
  },
  {
    id: "cam-c44ks", wooId: 91002, sku: "TC-C44KS-I5-28", name: "دوربین تیاندی TC-C44KS 4MP Starlight", brand: "Tiandy", category: "camera",
    price: 6_950_000, stockStatus: "in_stock", stockQuantity: 16, warrantyMonths: 24, sourceUrl: productUrl("tc-c44ks"), source: "mock-ddcpersia",
    specs: { technology: "IP", cameraType: "bullet", resolutionMp: 4, resolutionWidth: 2688, resolutionHeight: 1520, sensorFormat: "1/2.7\"", focalMinMm: 2.8, focalMaxMm: 2.8, horizontalFovMin: 104, horizontalFovMax: 104, maxFps: 30, codecs: ["H.265+", "H.265", "H.264"], recommendedBitrateKbps: 3200, irRangeM: 50, doriDetectM: 72, doriObserveM: 29, doriRecognizeM: 14, doriIdentifyM: 7, microphone: true, speaker: false, poe: true, maxPowerW: 8.5, ipRating: "IP67", aiFeatures: ["تشخیص انسان", "تشخیص خودرو", "عبور از خط"] }
  },
  {
    id: "cam-c54ks-var", wooId: 91003, sku: "TC-C54KS-I5-A-E", name: "دوربین تیاندی TC-C54KS 5MP وریفوکال", brand: "Tiandy", category: "camera",
    price: 10_900_000, stockStatus: "low_stock", stockQuantity: 6, warrantyMonths: 24, sourceUrl: productUrl("tc-c54ks-varifocal"), source: "mock-ddcpersia",
    specs: { technology: "IP", cameraType: "bullet", resolutionMp: 5, resolutionWidth: 2880, resolutionHeight: 1620, sensorFormat: "1/2.7\"", focalMinMm: 2.7, focalMaxMm: 13.5, horizontalFovMin: 31, horizontalFovMax: 112, maxFps: 25, codecs: ["H.265+", "H.265", "H.264"], recommendedBitrateKbps: 4000, irRangeM: 80, doriDetectM: 210, doriObserveM: 84, doriRecognizeM: 42, doriIdentifyM: 21, microphone: true, speaker: true, poe: true, maxPowerW: 12, ipRating: "IP67", aiFeatures: ["تشخیص چهره", "تشخیص انسان", "تشخیص خودرو", "حفاظت پیرامونی"] }
  },
  {
    id: "cam-c58sp", wooId: 91004, sku: "TC-C58SP-I8-A-E", name: "دوربین تیاندی TC-C58SP 8MP حرفه‌ای", brand: "Tiandy", category: "camera",
    price: 17_800_000, stockStatus: "in_stock", stockQuantity: 9, warrantyMonths: 30, sourceUrl: productUrl("tc-c58sp-8mp"), source: "mock-ddcpersia",
    specs: { technology: "IP", cameraType: "bullet", resolutionMp: 8, resolutionWidth: 3840, resolutionHeight: 2160, sensorFormat: "1/1.8\"", focalMinMm: 2.7, focalMaxMm: 13.5, horizontalFovMin: 33, horizontalFovMax: 113, maxFps: 30, codecs: ["H.265+", "H.265", "H.264"], recommendedBitrateKbps: 6500, irRangeM: 100, doriDetectM: 260, doriObserveM: 104, doriRecognizeM: 52, doriIdentifyM: 26, microphone: true, speaker: true, poe: true, maxPowerW: 14, ipRating: "IP67", aiFeatures: ["تشخیص چهره", "پلاک‌خوانی", "تشخیص انسان", "تشخیص خودرو"] }
  },
  {
    id: "cam-levelone-fcs5102", wooId: 91005, sku: "FCS-5102", name: "دوربین LevelOne FCS-5102 2MP", brand: "LevelOne", category: "camera",
    price: 3_900_000, stockStatus: "in_stock", stockQuantity: 30, warrantyMonths: 18, sourceUrl: productUrl("fcs-5102"), source: "mock-ddcpersia",
    specs: { technology: "IP", cameraType: "dome", resolutionMp: 2, resolutionWidth: 1920, resolutionHeight: 1080, sensorFormat: "1/2.8\"", focalMinMm: 4, focalMaxMm: 4, horizontalFovMin: 78, horizontalFovMax: 78, maxFps: 30, codecs: ["H.264", "MJPEG"], recommendedBitrateKbps: 2800, irRangeM: 20, doriDetectM: 52, doriObserveM: 21, doriRecognizeM: 10, doriIdentifyM: 5, microphone: false, speaker: false, poe: true, maxPowerW: 6, ipRating: "IP66", aiFeatures: ["تشخیص حرکت"] }
  },
  {
    id: "nvr-r3108", wooId: 92001, sku: "TC-R3108-I-B", name: "NVR تیاندی TC-R3108 هشت کانال", brand: "Tiandy", category: "recorder", price: 12_800_000, stockStatus: "in_stock", stockQuantity: 18, warrantyMonths: 24, sourceUrl: productUrl("دستگاه-nvr-تیاندی-مدلtc-r3108-speci-b"), source: "mock-ddcpersia",
    specs: { technology: "NVR", channels: 8, incomingBandwidthMbps: 80, maxDecodeMp: 8, driveBays: 1, maxDriveCapacityTb: 10, raidLevels: [], builtInPoePorts: 0, codecs: ["H.265+", "H.265", "H.264"], maxCameraResolutionMp: 8 }
  },
  {
    id: "nvr-r3116", wooId: 92002, sku: "TC-R3116-I-B", name: "NVR تیاندی TC-R3116 شانزده کانال", brand: "Tiandy", category: "recorder", price: 21_500_000, stockStatus: "in_stock", stockQuantity: 12, warrantyMonths: 24, sourceUrl: productUrl("tc-r3116"), source: "mock-ddcpersia",
    specs: { technology: "NVR", channels: 16, incomingBandwidthMbps: 160, maxDecodeMp: 8, driveBays: 2, maxDriveCapacityTb: 12, raidLevels: [], builtInPoePorts: 0, codecs: ["H.265+", "H.265", "H.264"], maxCameraResolutionMp: 8 }
  },
  {
    id: "nvr-r3220", wooId: 92003, sku: "TC-R3220-I-B-K", name: "NVR تیاندی TC-R3220 بیست کانال", brand: "Tiandy", category: "recorder", price: 35_900_000, stockStatus: "in_stock", stockQuantity: 8, warrantyMonths: 24, sourceUrl: productUrl("tc-r3220-speci-b-k-v3-1"), source: "mock-ddcpersia",
    specs: { technology: "NVR", channels: 20, incomingBandwidthMbps: 200, maxDecodeMp: 8, driveBays: 2, maxDriveCapacityTb: 16, raidLevels: [], builtInPoePorts: 0, codecs: ["H.265+", "H.265", "H.264"], maxCameraResolutionMp: 8 }
  },
  {
    id: "nvr-r3232", wooId: 92004, sku: "TC-R3232-I-B-K", name: "NVR تیاندی TC-R3232 سی‌ودو کانال RAID", brand: "Tiandy", category: "recorder", price: 58_000_000, stockStatus: "low_stock", stockQuantity: 4, warrantyMonths: 30, sourceUrl: productUrl("دستگاه-nvr-تیاندی-32-کانال-مدل-tc-r3232-spec-i-b-k-v3-1"), source: "mock-ddcpersia",
    specs: { technology: "NVR", channels: 32, incomingBandwidthMbps: 256, maxDecodeMp: 12, driveBays: 4, maxDriveCapacityTb: 18, raidLevels: ["RAID 0", "RAID 1", "RAID 5"], builtInPoePorts: 0, codecs: ["H.265+", "H.265", "H.264"], maxCameraResolutionMp: 12 }
  },
  {
    id: "sw-fep-0812", wooId: 93001, sku: "FEP-0812", name: "سوئیچ PoE لول‌وان 8 پورت FEP-0812", brand: "LevelOne", category: "switch", price: 8_400_000, stockStatus: "in_stock", stockQuantity: 22, warrantyMonths: 18, sourceUrl: productUrl("fep-0812"), source: "mock-ddcpersia",
    specs: { poePorts: 8, totalPorts: 10, poeBudgetW: 120, maxPowerPerPortW: 30, uplinkGbps: 2, extendRangeM: 250, managed: false, surgeProtection: true }
  },
  {
    id: "sw-fep-1612", wooId: 93002, sku: "FEP-1612", name: "سوئیچ PoE لول‌وان 16 پورت FEP-1612", brand: "LevelOne", category: "switch", price: 15_900_000, stockStatus: "in_stock", stockQuantity: 14, warrantyMonths: 18, sourceUrl: productUrl("fep-1612"), source: "mock-ddcpersia",
    specs: { poePorts: 16, totalPorts: 18, poeBudgetW: 240, maxPowerPerPortW: 30, uplinkGbps: 2, extendRangeM: 250, managed: false, surgeProtection: true }
  },
  {
    id: "sw-ges-2452", wooId: 93003, sku: "GES-2452P", name: "سوئیچ مدیریتی PoE لول‌وان 24 پورت", brand: "LevelOne", category: "switch", price: 34_500_000, stockStatus: "low_stock", stockQuantity: 5, warrantyMonths: 24, sourceUrl: productUrl("ges-2452p"), source: "mock-ddcpersia",
    specs: { poePorts: 24, totalPorts: 28, poeBudgetW: 370, maxPowerPerPortW: 30, uplinkGbps: 4, extendRangeM: 250, managed: true, surgeProtection: true }
  },
  ...[4, 6, 10, 12, 16].map((capacity, index): CatalogProduct => ({
    id: `hdd-wd-${capacity}`, wooId: 94001 + index, sku: `WD-PURPLE-${capacity}TB`, name: `هارد نظارتی WD Purple ظرفیت ${capacity}TB`, brand: "Western Digital", category: "storage", price: [7_600_000, 10_200_000, 17_900_000, 22_800_000, 31_500_000][index], stockStatus: index === 4 ? "low_stock" : "in_stock", stockQuantity: [32, 25, 18, 12, 6][index], warrantyMonths: 24, sourceUrl: productUrl(`wd-purple-${capacity}tb`), source: "mock-ddcpersia",
    specs: { capacityTb: capacity, workloadTbPerYear: capacity >= 12 ? 360 : 180, surveillanceOptimized: true, warrantyMonths: 24 }
  })),
  {
    id: "ups-2kva", wooId: 95001, sku: "UPS-2000VA", name: "UPS آنلاین 2000VA مناسب نظارت تصویری", brand: "Persia Power", category: "ups", price: 28_500_000, stockStatus: "in_stock", stockQuantity: 10, warrantyMonths: 18, sourceUrl: productUrl("ups-online-2000va"), source: "mock-ddcpersia",
    specs: { capacityVa: 2000, outputPowerW: 1600, backupMinutesAtHalfLoad: 24 }
  },
  {
    id: "ups-3kva", wooId: 95002, sku: "UPS-3000VA", name: "UPS آنلاین 3000VA حرفه‌ای", brand: "Persia Power", category: "ups", price: 42_000_000, stockStatus: "in_stock", stockQuantity: 7, warrantyMonths: 18, sourceUrl: productUrl("ups-online-3000va"), source: "mock-ddcpersia",
    specs: { capacityVa: 3000, outputPowerW: 2400, backupMinutesAtHalfLoad: 32 }
  }
];

const assetImages = (paths: string[], alt: string, source: "ddcpersia" | "ai-generated" = "ddcpersia") =>
  paths.map((path) => ({ url: `/assets/catalog/${path}`, alt, source }));

const cameraGalleries = [
  ["103986-1.png", "103986-2.png", "103986-3.png"],
  ["103981-1.png", "103981-2.png", "103981-3.png"],
  ["103428-1.png", "103428-2.png", "103428-3.png"],
  ["103464-1.png", "103464-2.png", "103464-3.png"],
  ["106046-1.png", "106046-2.png", "106046-3.png"],
  ["55391-1.png", "55391-2.png", "55391-3.png"],
  ["105216-1.png"], ["105209-1.png"], ["105206-1.png"], ["105195-1.png"]
];

const recorderGalleries = [
  ["103551-1.png", "103551-2.png", "103551-3.png"],
  ["103545-1.png", "103545-2.png", "103545-3.png"],
  ["103536-1.png", "103536-2.png", "103536-3.png"],
  ["105142-1.png"], ["105139-1.png"], ["105127-1.png"], ["106052-1.png"]
];

const switchGalleries = [["106346-1.jpg"], ["106292-1.jpg"], ["101326-1.jpg"], ["101324-1.jpg"], ["101316-1.jpg"]];
const upsGalleries = [["98318-1.jpg"], ["98315-1.jpg"]];

const cameraModels = [
  { id: "cam-tiandy-c34xn", wooId: 103986, brand: "Tiandy", model: "TC-C34XN 2ENA-28", resolution: 4, type: "turret", lens: 2.8, ir: 40, price: 7_450_000, gallery: 0, ai: ["تشخیص انسان", "تشخیص خودرو", "عبور از خط"], audio: true },
  { id: "cam-tiandy-c34qn", wooId: 103981, brand: "Tiandy", model: "TC-C34QN 2ENA-28 Wi-Fi", resolution: 4, type: "bullet", lens: 2.8, ir: 30, price: 6_980_000, gallery: 1, ai: ["تشخیص انسان", "تشخیص حرکت"], audio: true },
  { id: "cam-tiandy-c320n", wooId: 103428, brand: "Tiandy", model: "TC-C320N 1ANB-28", resolution: 2, type: "dome", lens: 2.8, ir: 30, price: 4_250_000, gallery: 2, ai: ["تشخیص حرکت"], audio: false },
  { id: "cam-tiandy-c38ks", wooId: 103464, brand: "Tiandy", model: "TC-C38KS 3ERA-28", resolution: 8, type: "turret", lens: 2.8, ir: 50, price: 15_900_000, gallery: 3, ai: ["تشخیص چهره", "تشخیص انسان", "تشخیص خودرو"], audio: true },
  { id: "cam-tiandy-c35us", wooId: 103476, brand: "Tiandy", model: "TC-C35US 3LHA-27135", resolution: 5, type: "bullet", lens: 13.5, ir: 80, price: 12_750_000, gallery: 0, ai: ["تشخیص چهره", "حفاظت پیرامونی"], audio: true },
  { id: "cam-tiandy-c38ws", wooId: 103467, brand: "Tiandy", model: "TC-C38WS 3LRA-28", resolution: 8, type: "bullet", lens: 2.8, ir: 80, price: 18_400_000, gallery: 1, ai: ["تشخیص چهره", "پلاک‌خوانی", "تشخیص خودرو"], audio: true },
  { id: "cam-hik-1063", wooId: 106046, brand: "Hikvision", model: "DS-2CD1063G2-LIU", resolution: 6, type: "bullet", lens: 2.8, ir: 30, price: 11_200_000, gallery: 4, ai: ["تشخیص انسان", "تشخیص خودرو"], audio: true },
  { id: "cam-hik-1023", wooId: 55391, brand: "Hikvision", model: "DS-2CD1023G2-LIU", resolution: 2, type: "bullet", lens: 2.8, ir: 30, price: 5_650_000, gallery: 5, ai: ["تشخیص انسان"], audio: true },
  { id: "cam-hik-2047", wooId: 91021, brand: "Hikvision", model: "DS-2CD2047G2 ColorVu", resolution: 4, type: "bullet", lens: 4, ir: 40, price: 13_800_000, gallery: 4, ai: ["تشخیص چهره", "تشخیص انسان", "دید رنگی شب"], audio: true },
  { id: "cam-hik-2686", wooId: 91022, brand: "Hikvision", model: "DS-2CD2686G2-IZS", resolution: 8, type: "bullet", lens: 12, ir: 60, price: 24_900_000, gallery: 5, ai: ["تشخیص چهره", "پلاک‌خوانی", "تشخیص خودرو"], audio: true },
  { id: "cam-opti-b15", wooId: 105216, brand: "OptiNet", model: "ON-IPC-B15F2W-PIR5W-AI", resolution: 5, type: "bullet", lens: 2.8, ir: 50, price: 8_950_000, gallery: 6, ai: ["تشخیص انسان", "نور سفید هوشمند"], audio: true },
  { id: "cam-opti-b35", wooId: 105209, brand: "OptiNet", model: "ON-IPC-B35VFW-PIR8W-AI", resolution: 5, type: "bullet", lens: 12, ir: 80, price: 13_400_000, gallery: 7, ai: ["تشخیص چهره", "تشخیص خودرو", "حفاظت پیرامونی"], audio: true },
  { id: "cam-opti-d25", wooId: 105206, brand: "OptiNet", model: "ON-IPC-D25F2W-PIR3W-AI", resolution: 5, type: "dome", lens: 2.8, ir: 30, price: 7_900_000, gallery: 8, ai: ["تشخیص انسان", "تشخیص حرکت"], audio: true },
  { id: "cam-opti-t26", wooId: 105195, brand: "OptiNet", model: "ON-IPC-T26F2-PIR3", resolution: 6, type: "turret", lens: 2.8, ir: 30, price: 9_600_000, gallery: 9, ai: ["تشخیص انسان", "تشخیص خودرو"], audio: false },
  { id: "cam-opti-pt22", wooId: 105180, brand: "OptiNet", model: "ON-IPC-PT2223X-PIR15-AI", resolution: 2, type: "ptz", lens: 92, ir: 150, price: 39_500_000, gallery: 6, ai: ["تعقیب هوشمند", "تشخیص انسان", "تشخیص خودرو"], audio: true },
  { id: "cam-opti-pt25", wooId: 105174, brand: "OptiNet", model: "ON-IPC-PT2523X-PIR15-AI-I/O", resolution: 5, type: "ptz", lens: 115, ir: 150, price: 58_000_000, gallery: 7, ai: ["تعقیب هوشمند", "تشخیص چهره", "پلاک‌خوانی"], audio: true }
] as const;

const generatedCameras: CatalogProduct[] = cameraModels.map((item, index) => {
  const width = item.resolution >= 8 ? 3840 : item.resolution >= 5 ? 2880 : item.resolution >= 4 ? 2688 : 1920;
  const height = item.resolution >= 8 ? 2160 : item.resolution >= 5 ? 1620 : item.resolution >= 4 ? 1520 : 1080;
  const variable = item.lens > 4;
  return {
    id: item.id, wooId: item.wooId, sku: item.model.replaceAll(" ", "-"), name: `دوربین ${item.brand} مدل ${item.model}`,
    brand: item.brand, category: "camera", price: item.price, stockStatus: index % 7 === 6 ? "low_stock" : index % 11 === 10 ? "out_of_stock" : "in_stock",
    stockQuantity: index % 7 === 6 ? 3 : 8 + ((index * 7) % 26), warrantyMonths: item.brand === "Tiandy" ? 24 : 18,
    sourceUrl: productUrl(item.id.replace("cam-", "")), source: "mock-ddcpersia",
    images: assetImages(cameraGalleries[item.gallery], `تصاویر ${item.model}`),
    specs: { technology: "IP", cameraType: item.type, resolutionMp: item.resolution, resolutionWidth: width, resolutionHeight: height, sensorFormat: item.resolution >= 8 ? "1/1.8\"" : "1/2.8\"", focalMinMm: variable ? 2.7 : item.lens, focalMaxMm: item.lens, horizontalFovMin: variable ? 28 : Math.max(24, 118 - item.lens * 8), horizontalFovMax: variable ? 112 : Math.max(24, 118 - item.lens * 8), maxFps: item.resolution >= 8 ? 25 : 30, codecs: ["H.265+", "H.265", "H.264"], recommendedBitrateKbps: item.resolution * 850, irRangeM: item.ir, doriDetectM: variable ? 220 : item.resolution * 18, doriObserveM: variable ? 88 : item.resolution * 7, doriRecognizeM: variable ? 44 : item.resolution * 3.5, doriIdentifyM: variable ? 22 : item.resolution * 1.8, microphone: item.audio, speaker: item.type === "ptz", poe: true, maxPowerW: item.type === "ptz" ? 24 : variable ? 13 : 8, ipRating: "IP67", aiFeatures: [...item.ai], localStorageGb: item.audio ? 512 : 128 }
  };
});

const recorderModels = [
  ["nvr-tiandy-r3880", 103551, "Tiandy", "TC-R3880 4HB", 80, 384, 8, 18, 0],
  ["nvr-tiandy-r3440", 103545, "Tiandy", "TC-R3440 4HB", 40, 320, 4, 18, 1],
  ["nvr-tiandy-r3240", 103536, "Tiandy", "TC-R3240 4HB", 24, 256, 4, 18, 2],
  ["nvr-tiandy-r3232v4", 103532, "Tiandy", "TC-R3232 4HA", 32, 256, 4, 16, 0],
  ["nvr-opti-n2880", 105142, "OptiNet", "ON-NVR-N2880", 80, 512, 8, 20, 3],
  ["nvr-opti-n2220", 105139, "OptiNet", "ON-NVR-N2220 AI", 32, 256, 4, 18, 4],
  ["nvr-opti-n1110", 105127, "OptiNet", "ON-NVR-N1110-P8", 10, 100, 1, 12, 5],
  ["nvr-opti-n1616", 92018, "OptiNet", "ON-NVR-N1616-P16", 16, 160, 2, 12, 3],
  ["nvr-hik-7616", 106052, "Hikvision", "DS-7616NXI-K2", 16, 160, 2, 12, 6],
  ["nvr-hik-7732", 92020, "Hikvision", "DS-7732NXI-K4", 32, 256, 4, 16, 6],
  ["nvr-hik-7608", 92021, "Hikvision", "DS-7608NXI-K1", 8, 80, 1, 10, 6]
] as const;

const generatedRecorders: CatalogProduct[] = recorderModels.map(([id, wooId, brand, model, channels, bandwidth, bays, maxTb, gallery], index) => ({
  id, wooId, sku: model.replaceAll(" ", "-"), name: `دستگاه NVR ${brand} مدل ${model}`, brand, category: "recorder", price: 9_800_000 + channels * 1_080_000 + bays * 1_500_000,
  stockStatus: index % 5 === 4 ? "low_stock" : "in_stock", stockQuantity: 4 + ((index * 3) % 15), warrantyMonths: brand === "Tiandy" ? 24 : 18, sourceUrl: productUrl(id.replace("nvr-", "")), source: "mock-ddcpersia",
  images: assetImages(recorderGalleries[gallery], `تصاویر ${model}`),
  specs: { technology: "NVR", channels, incomingBandwidthMbps: bandwidth, maxDecodeMp: 12, driveBays: bays, maxDriveCapacityTb: maxTb, raidLevels: bays >= 4 ? ["RAID 0", "RAID 1", "RAID 5"] : [], builtInPoePorts: channels <= 16 ? channels : 0, codecs: ["H.265+", "H.265", "H.264"], maxCameraResolutionMp: 12 }
}));

const switchModels = [
  ["sw-opti-gep411", 106285, "GEP411GSC-W55", 4, 55, 1], ["sw-opti-gep820", 101324, "GEP820GC-W120C", 8, 120, 3],
  ["sw-opti-fgp821", 101316, "FGP821GSC-W120C", 8, 120, 4], ["sw-opti-gep1621", 106292, "GEP1621GSC-W240", 16, 240, 1],
  ["sw-opti-fep2422", 106346, "FEP2422GS-W360", 24, 360, 0], ["sw-opti-gep2422", 101326, "GEP2422GSC-W360", 24, 360, 2],
  ["sw-opti-gep810", 93014, "GEP810GSC-W150", 8, 150, 3], ["sw-opti-gep1620", 93015, "GEP1620GSC-W300", 16, 300, 1],
  ["sw-opti-fep4822", 93016, "FEP4822GS-W600", 48, 600, 0]
] as const;

const generatedSwitches: CatalogProduct[] = switchModels.map(([id, wooId, model, ports, budget, gallery], index) => ({
  id, wooId, sku: model, name: `سوئیچ PoE اپتینت مدل ${model}`, brand: "OptiNet", category: "switch", price: 4_800_000 + ports * 880_000 + budget * 12_000,
  stockStatus: index === 8 ? "low_stock" : "in_stock", stockQuantity: 5 + ((index * 5) % 20), warrantyMonths: 18, sourceUrl: productUrl(id.replace("sw-opti-", "")), source: "mock-ddcpersia",
  images: assetImages(switchGalleries[gallery], `تصویر سوئیچ ${model}`),
  specs: { poePorts: ports, totalPorts: ports + (ports >= 16 ? 4 : 2), poeBudgetW: budget, maxPowerPerPortW: 30, uplinkGbps: ports >= 24 ? 4 : 2, extendRangeM: 250, managed: ports >= 16 || index % 3 === 0, surgeProtection: true }
}));

const generatedStorage: CatalogProduct[] = [2, 8, 14, 18, 20, 22].map((capacity, index) => ({
  id: `hdd-surveillance-${capacity}`, wooId: 94100 + index, sku: `SURV-${capacity}TB-${index % 2 ? "SKY" : "PUR"}`,
  name: `هارد نظارتی ${index % 2 ? "Seagate SkyHawk" : "WD Purple Pro"} ظرفیت ${capacity}TB`, brand: index % 2 ? "Seagate" : "Western Digital", category: "storage",
  price: 4_600_000 + capacity * 1_720_000, stockStatus: capacity >= 20 ? "low_stock" : "in_stock", stockQuantity: Math.max(3, 24 - capacity), warrantyMonths: capacity >= 14 ? 36 : 24,
  sourceUrl: productUrl(`surveillance-drive-${capacity}tb`), source: "mock-ddcpersia", images: assetImages(["ai-surveillance-drive.webp"], `تصویر مفهومی هارد ${capacity} ترابایت`, "ai-generated"),
  specs: { capacityTb: capacity, workloadTbPerYear: capacity >= 14 ? 550 : 180, surveillanceOptimized: true, warrantyMonths: capacity >= 14 ? 36 : 24 }
}));

const generatedUps: CatalogProduct[] = [
  ["ups-hik-1000", 98318, "Hikvision", "DS-UPS1000", 1000, 800, 18, 0],
  ["ups-hik-2000", 98315, "Hikvision", "DS-UPS2000", 2000, 1600, 26, 1],
  ["ups-hik-1500", 95103, "Hikvision", "DS-UPS1500", 1500, 1200, 22, 0],
  ["ups-persia-650", 95104, "Persia Power", "Line 650VA", 650, 390, 12, 1]
].map(([id, wooId, brand, model, capacityVa, outputPowerW, backupMinutesAtHalfLoad, gallery], index): CatalogProduct => ({
  id: String(id), wooId: Number(wooId), sku: String(model).replaceAll(" ", "-"), name: `UPS ${brand} مدل ${model}`, brand: String(brand), category: "ups", price: 9_000_000 + Number(capacityVa) * 14_000,
  stockStatus: index === 2 ? "low_stock" : "in_stock", stockQuantity: 5 + index * 3, warrantyMonths: 18, sourceUrl: productUrl(String(id)), source: "mock-ddcpersia",
  images: assetImages(upsGalleries[Number(gallery)], `تصویر UPS ${model}`), specs: { capacityVa: Number(capacityVa), outputPowerW: Number(outputPowerW), backupMinutesAtHalfLoad: Number(backupMinutesAtHalfLoad) }
}));

const fallbackGalleries: Record<CatalogProduct["category"], string[][]> = {
  camera: cameraGalleries, recorder: recorderGalleries, switch: switchGalleries,
  storage: [["ai-surveillance-drive.webp"]], ups: upsGalleries
};

const enrichedBaseProducts = baseMockProducts.map((product, index): CatalogProduct => ({
  ...product,
  images: product.images ?? assetImages(
    fallbackGalleries[product.category][index % fallbackGalleries[product.category].length],
    `تصاویر ${product.name}`,
    product.category === "storage" ? "ai-generated" : "ddcpersia"
  )
}));

export const mockProducts: CatalogProduct[] = [
  ...enrichedBaseProducts,
  ...generatedCameras,
  ...generatedRecorders,
  ...generatedSwitches,
  ...generatedStorage,
  ...generatedUps
];

export const mockCatalogUpdatedAt = "2026-07-19T00:00:00.000Z";
