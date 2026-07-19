import type {
  CameraSpecs,
  CatalogProduct,
  ProjectBrief,
  RecommendationPlan,
  RecommendationResult,
  RecorderSpecs,
  StorageSpecs,
  SwitchSpecs
} from "@/src/domain/catalog/types";

const planProfiles = [
  { id: "economy", title: "اقتصادی", subtitle: "حداقل هزینه با رعایت الزامات فنی", qualityBoost: -1, expansion: 1, raid: false, ups: false },
  { id: "balanced", title: "متعادل", subtitle: "بهترین نسبت هزینه، کیفیت و توسعه‌پذیری", qualityBoost: 0, expansion: 1.25, raid: false, ups: true },
  { id: "professional", title: "حرفه‌ای", subtitle: "افزونگی، تحلیل هوشمند و ظرفیت رشد بیشتر", qualityBoost: 2, expansion: 1.6, raid: true, ups: true }
] as const;

const byPrice = (a: CatalogProduct, b: CatalogProduct) => a.price - b.price;

function targetResolution(brief: ProjectBrief) {
  if (brief.goal === "plate") return 8;
  if (brief.goal === "face" || brief.goal === "mixed") return 5;
  return 3;
}

function eligibleCameras(products: CatalogProduct[], brief: ProjectBrief, minimumMp: number) {
  return products
    .filter((product) => product.category === "camera" && product.stockStatus !== "out_of_stock")
    .filter((product) => {
      const specs = product.specs as CameraSpecs;
      if (specs.resolutionMp < minimumMp) return false;
      if (brief.outdoorCount > 0 && !/^IP6[6-9]/.test(specs.ipRating)) return false;
      if (brief.goal === "plate" && !specs.aiFeatures.includes("پلاک‌خوانی")) return false;
      if (brief.goal === "face" && !specs.aiFeatures.includes("تشخیص چهره")) return false;
      if (brief.audioRequired && !specs.microphone) return false;
      if (brief.lowLightPriority && specs.irRangeM < 50 && !specs.aiFeatures.includes("دید رنگی شب")) return false;
      if (brief.localRecordingFallback && !specs.localStorageGb) return false;
      return true;
    })
    .sort((a, b) => {
      const preferredA = brief.preferredBrand && a.brand === brief.preferredBrand ? 0 : 1;
      const preferredB = brief.preferredBrand && b.brand === brief.preferredBrand ? 0 : 1;
      return preferredA - preferredB || byPrice(a, b);
    });
}

function selectRecorder(products: CatalogProduct[], cameraCount: number, bandwidth: number, resolutionMp: number, expansion: number, requireRaid: boolean, requiredStorageTb: number) {
  const requiredChannels = Math.min(80, Math.ceil(cameraCount * expansion));
  return products
    .filter((product) => product.category === "recorder" && product.stockStatus !== "out_of_stock")
    .filter((product) => {
      const specs = product.specs as RecorderSpecs;
      return specs.channels >= requiredChannels && specs.incomingBandwidthMbps >= bandwidth * 1.2 && specs.maxCameraResolutionMp >= resolutionMp && specs.driveBays * specs.maxDriveCapacityTb >= requiredStorageTb && (!requireRaid || specs.raidLevels.length > 0);
    })
    .sort(byPrice)[0];
}

function selectSwitch(products: CatalogProduct[], cameraCount: number, poeWatts: number, professional: boolean, maxCableRunM = 100) {
  const single = products
    .filter((product) => product.category === "switch" && product.stockStatus !== "out_of_stock")
    .filter((product) => {
      const specs = product.specs as SwitchSpecs;
      return specs.poePorts >= cameraCount && specs.poeBudgetW >= poeWatts * 1.2 && (!professional || specs.managed) && (maxCableRunM <= 100 || specs.extendRangeM >= maxCableRunM);
    })
    .sort(byPrice)[0];
  if (single) return { product: single, quantity: 1 };

  const candidate = products
    .filter((product) => product.category === "switch" && product.stockStatus !== "out_of_stock")
    .filter((product) => (!professional || (product.specs as SwitchSpecs).managed) && (maxCableRunM <= 100 || (product.specs as SwitchSpecs).extendRangeM >= maxCableRunM))
    .sort((a, b) => (b.specs as SwitchSpecs).poePorts - (a.specs as SwitchSpecs).poePorts)[0];
  if (!candidate) return undefined;
  const specs = candidate.specs as SwitchSpecs;
  return { product: candidate, quantity: Math.max(Math.ceil(cameraCount / specs.poePorts), Math.ceil((poeWatts * 1.2) / specs.poeBudgetW)) };
}

function selectStorage(products: CatalogProduct[], requiredTb: number, driveBays: number, professional: boolean, maxDriveCapacityTb: number) {
  const effectiveRequired = professional ? requiredTb * 1.35 : requiredTb;
  return products
    .filter((product) => product.category === "storage" && product.stockStatus !== "out_of_stock" && (product.specs as StorageSpecs).capacityTb <= maxDriveCapacityTb)
    .map((product) => ({ product, quantity: Math.ceil(effectiveRequired / (product.specs as StorageSpecs).capacityTb) }))
    .filter(({ quantity }) => quantity <= driveBays)
    .sort((a, b) => a.product.price * a.quantity - b.product.price * b.quantity)[0];
}

function planScore(plan: RecommendationPlan, brief: ProjectBrief) {
  const stockScore = plan.items.every((item) => item.product.stockStatus === "in_stock") ? 20 : 13;
  const warrantyScore = Math.min(10, Math.round(plan.items.reduce((sum, item) => sum + item.product.warrantyMonths, 0) / plan.items.length / 3));
  const technicalScore = 35;
  const expansionScore = plan.id === "professional" ? 5 : plan.id === "balanced" ? 4 : 2;
  const energyScore = 8;
  const brandScore = brief.preferredBrand && plan.items.some((item) => item.product.brand === brief.preferredBrand) ? 5 : 3;
  const priceScore = plan.id === brief.budget ? 15 : plan.id === "balanced" ? 12 : 9;
  return Math.min(98, technicalScore + stockScore + warrantyScore + expansionScore + energyScore + brandScore + priceScore);
}

export function recommendProducts(products: CatalogProduct[], brief: ProjectBrief): RecommendationResult {
  const zoneGoals = brief.zones?.map((zone) => zone.goal) || [];
  const effectiveGoal = brief.goal === "mixed" ? zoneGoals.includes("plate") ? "plate" : zoneGoals.includes("face") ? "face" : "general" : brief.goal;
  const effectiveBrief = { ...brief, goal: effectiveGoal } as ProjectBrief;
  const baselineMp = targetResolution(effectiveBrief);
  const rejected: RecommendationResult["rejected"] = [];
  const plans: RecommendationPlan[] = [];
  const projectZones = brief.zones?.length ? brief.zones : [{ id: "project", name: "کل پروژه", cameraCount: brief.cameraCount, outdoor: brief.outdoorCount > 0, goal: effectiveGoal as "general" | "face" | "plate" }];

  for (const profile of planProfiles) {
    const cameraSelections: { zone: (typeof projectZones)[number]; product: CatalogProduct; specs: CameraSpecs }[] = [];
    for (const zone of projectZones) {
      const zoneBrief = { ...effectiveBrief, goal: zone.goal, cameraCount: zone.cameraCount, outdoorCount: zone.outdoor ? zone.cameraCount : 0 } as ProjectBrief;
      const zoneBaseline = targetResolution(zoneBrief);
      const wantedMp = Math.max(2, zoneBaseline + profile.qualityBoost);
      let camera = eligibleCameras(products, zoneBrief, wantedMp)[0];
      if (!camera) camera = eligibleCameras(products, zoneBrief, profile.id === "economy" ? Math.max(2, zoneBaseline - 2) : zoneBaseline)[0];
      if (!camera) {
        rejected.push({ productName: `دوربین ناحیه ${zone.name}`, reason: "مدلی با هدف تصویری، دید شب، صدا یا شرایط محیطی این ناحیه پیدا نشد." });
        cameraSelections.length = 0;
        break;
      }
      cameraSelections.push({ zone, product: camera, specs: camera.specs as CameraSpecs });
    }
    if (!cameraSelections.length) continue;

    const totalBandwidthMbps = cameraSelections.reduce((sum, item) => sum + item.specs.recommendedBitrateKbps * item.zone.cameraCount, 0) / 1000;
    const storageRequiredTb = totalBandwidthMbps * brief.archiveDays * 0.0108;
    const poeRequiredW = cameraSelections.reduce((sum, item) => sum + item.specs.maxPowerW * item.zone.cameraCount, 0);
    const maxResolutionMp = Math.max(...cameraSelections.map((item) => item.specs.resolutionMp));
    const recorder = selectRecorder(products, brief.cameraCount, totalBandwidthMbps, maxResolutionMp, profile.expansion, profile.raid || Boolean(brief.redundancyRequired), storageRequiredTb * (profile.id === "professional" ? 1.35 : 1));
    if (!recorder) {
      rejected.push({ productName: `ضبط‌کننده برای پلن ${profile.title}`, reason: "کانال، پهنای‌باند یا ظرفیت RAID کافی در کاتالوگ موجود نیست." });
      continue;
    }

    const recorderSpecs = recorder.specs as RecorderSpecs;
    const storage = selectStorage(products, storageRequiredTb, recorderSpecs.driveBays, profile.id === "professional", recorderSpecs.maxDriveCapacityTb);
    if (!storage) {
      rejected.push({ productName: recorder.name, reason: "تعداد Bay یا ظرفیت هارد پشتیبانی‌شده برای آرشیو محاسبه‌شده کافی نیست." });
      continue;
    }

    const networkSwitch = selectSwitch(products, brief.cameraCount, poeRequiredW, profile.id === "professional", brief.maxCableRunM);
    if (!networkSwitch) {
      rejected.push({ productName: `سوئیچ برای پلن ${profile.title}`, reason: "تعداد پورت یا بودجه PoE کمتر از نیاز پروژه است." });
      continue;
    }

    const ups = profile.ups ? products.filter((product) => product.category === "ups" && product.stockStatus !== "out_of_stock").sort(byPrice)[profile.id === "professional" ? 1 : 0] : undefined;
    const cameraItemMap = new Map<string, { product: CatalogProduct; quantity: number; reasons: string[] }>();
    for (const selection of cameraSelections) {
      const existing = cameraItemMap.get(selection.product.id);
      const goalLabel = selection.zone.goal === "plate" ? "پلاک‌خوانی" : selection.zone.goal === "face" ? "تشخیص چهره" : "نظارت عمومی";
      const reason = `${selection.zone.name}: ${selection.zone.cameraCount} دوربین برای ${goalLabel}`;
      if (existing) {
        existing.quantity += selection.zone.cameraCount;
        existing.reasons.push(reason);
      } else {
        cameraItemMap.set(selection.product.id, {
          product: selection.product,
          quantity: selection.zone.cameraCount,
          reasons: [reason, `${selection.specs.resolutionMp}MP، ${selection.specs.ipRating} و ${selection.specs.codecs[0]}`, ...selection.specs.aiFeatures.slice(0, 1)]
        });
      }
    }
    const items = [
      ...cameraItemMap.values(),
      { product: recorder, quantity: 1, reasons: [`${recorderSpecs.channels} کانال برای ${brief.cameraCount} دوربین`, `پهنای‌باند ورودی ${recorderSpecs.incomingBandwidthMbps}Mbps`, `${recorderSpecs.driveBays} جایگاه هارد`] },
      { product: storage.product, quantity: storage.quantity, reasons: [`تأمین حداقل ${storageRequiredTb.toFixed(1)} ترابایت آرشیو`, "طراحی‌شده برای ضبط نظارتی ۲۴/۷"] },
      { product: networkSwitch.product, quantity: networkSwitch.quantity, reasons: [`تأمین ${brief.cameraCount} پورت PoE`, `بودجه توان با ضریب اطمینان ۲۰٪`, (networkSwitch.product.specs as SwitchSpecs).managed ? "قابلیت مدیریت و VLAN" : "راه‌اندازی ساده و اقتصادی"] },
      ...(ups ? [{ product: ups, quantity: 1, reasons: ["حفاظت از ضبط و شبکه در قطع برق", "کاهش ریسک خرابی آرشیو"] }] : [])
    ];
    const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const plan: RecommendationPlan = {
      id: profile.id,
      title: profile.title,
      subtitle: profile.subtitle,
      score: 0,
      totalPrice,
      items,
      highlights: [
        `${cameraItemMap.size} مدل دوربین برای ${projectZones.length} ناحیه`,
        `${totalBandwidthMbps.toFixed(1)}Mbps پهنای‌باند محاسبه‌شده`,
        `${storage.quantity} هارد برای ${brief.archiveDays} روز آرشیو`,
        profile.id === "professional" ? "آماده توسعه و افزونگی" : "بدون قطعه اضافه غیرضروری"
      ]
    };
    plan.score = planScore(plan, brief);
    plans.push(plan);
  }

  const selectedCameraItems = plans[0]?.items.filter((item) => item.product.category === "camera") || [];
  const totalBandwidthMbps = selectedCameraItems.length
    ? selectedCameraItems.reduce((sum, item) => sum + (item.product.specs as CameraSpecs).recommendedBitrateKbps * item.quantity, 0) / 1000
    : (3200 * brief.cameraCount) / 1000;
  const poeRequiredW = selectedCameraItems.length
    ? selectedCameraItems.reduce((sum, item) => sum + (item.product.specs as CameraSpecs).maxPowerW * item.quantity, 0)
    : 8 * brief.cameraCount;
  const recommendedResolutionMp = selectedCameraItems.length
    ? Math.max(...selectedCameraItems.map((item) => (item.product.specs as CameraSpecs).resolutionMp))
    : baselineMp;

  for (const product of products.filter((item) => item.category === "recorder")) {
    const specs = product.specs as RecorderSpecs;
    if (specs.channels < brief.cameraCount) rejected.push({ productName: product.name, reason: `فقط ${specs.channels} کانال دارد و پروژه به ${brief.cameraCount} کانال نیاز دارد.` });
    else if (specs.incomingBandwidthMbps < totalBandwidthMbps * 1.2) rejected.push({ productName: product.name, reason: "پهنای‌باند ورودی از نیاز پروژه با ضریب اطمینان کمتر است." });
  }

  return {
    project: brief,
    metrics: {
      totalBandwidthMbps: Number(totalBandwidthMbps.toFixed(1)),
      storageRequiredTb: Number((totalBandwidthMbps * brief.archiveDays * 0.0108).toFixed(1)),
      poeRequiredW: Number(poeRequiredW.toFixed(1)),
      recommendedResolutionMp
    },
    plans,
    rejected: rejected.slice(0, 4),
    generatedAt: new Date().toISOString(),
    dataMode: "mock-fallback"
  };
}
