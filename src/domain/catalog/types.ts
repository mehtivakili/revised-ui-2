export type ProductCategory = "camera" | "recorder" | "switch" | "storage" | "ups";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type CameraSpecs = {
  technology: "IP" | "TVI" | "CVI" | "AHD";
  cameraType: "bullet" | "dome" | "turret" | "ptz";
  resolutionMp: number;
  resolutionWidth: number;
  resolutionHeight: number;
  sensorFormat: string;
  focalMinMm: number;
  focalMaxMm: number;
  horizontalFovMin: number;
  horizontalFovMax: number;
  maxFps: number;
  codecs: string[];
  recommendedBitrateKbps: number;
  irRangeM: number;
  doriDetectM: number;
  doriObserveM: number;
  doriRecognizeM: number;
  doriIdentifyM: number;
  microphone: boolean;
  speaker: boolean;
  poe: boolean;
  maxPowerW: number;
  ipRating: string;
  aiFeatures: string[];
  localStorageGb?: number;
};

export type RecorderSpecs = {
  technology: "NVR" | "DVR";
  channels: number;
  incomingBandwidthMbps: number;
  maxDecodeMp: number;
  driveBays: number;
  maxDriveCapacityTb: number;
  raidLevels: string[];
  builtInPoePorts: number;
  codecs: string[];
  maxCameraResolutionMp: number;
};

export type SwitchSpecs = {
  poePorts: number;
  totalPorts: number;
  poeBudgetW: number;
  maxPowerPerPortW: number;
  uplinkGbps: number;
  extendRangeM: number;
  managed: boolean;
  surgeProtection: boolean;
};

export type StorageSpecs = {
  capacityTb: number;
  workloadTbPerYear: number;
  surveillanceOptimized: boolean;
  warrantyMonths: number;
};

export type UpsSpecs = {
  capacityVa: number;
  outputPowerW: number;
  backupMinutesAtHalfLoad: number;
};

export type CatalogProduct = {
  id: string;
  wooId: number;
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  stockStatus: StockStatus;
  stockQuantity: number;
  warrantyMonths: number;
  sourceUrl: string;
  source: "mock-ddcpersia" | "woocommerce";
  images?: {
    url: string;
    alt: string;
    source: "ddcpersia" | "ai-generated";
  }[];
  specs: CameraSpecs | RecorderSpecs | SwitchSpecs | StorageSpecs | UpsSpecs;
};

export type ProjectZone = {
  id: string;
  name: string;
  cameraCount: number;
  outdoor: boolean;
  goal: "general" | "face" | "plate";
};

export type ProjectBrief = {
  projectType: "shop" | "office" | "factory" | "parking" | "residential";
  cameraCount: number;
  outdoorCount: number;
  entrances: number;
  goal: "general" | "face" | "plate" | "mixed";
  archiveDays: number;
  budget: "economy" | "balanced" | "professional";
  preferredBrand?: string;
  siteAreaM2?: number;
  floors?: number;
  maxCableRunM?: number;
  remoteViewingUsers?: number;
  lowLightPriority?: boolean;
  audioRequired?: boolean;
  localRecordingFallback?: boolean;
  redundancyRequired?: boolean;
  zones?: ProjectZone[];
};

export type RecommendationItem = {
  product: CatalogProduct;
  quantity: number;
  reasons: string[];
};

export type RecommendationPlan = {
  id: "economy" | "balanced" | "professional";
  title: string;
  subtitle: string;
  score: number;
  totalPrice: number;
  items: RecommendationItem[];
  highlights: string[];
};

export type RecommendationResult = {
  project: ProjectBrief;
  metrics: {
    totalBandwidthMbps: number;
    storageRequiredTb: number;
    poeRequiredW: number;
    recommendedResolutionMp: number;
  };
  plans: RecommendationPlan[];
  rejected: { productName: string; reason: string }[];
  generatedAt: string;
  dataMode: "database-mock" | "mock-fallback";
};
