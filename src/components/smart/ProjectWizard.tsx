"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Cable, Check, ChevronLeft, CircleAlert, Info, Layers3, LoaderCircle, MapPinned, Mic, Moon, Plus, RotateCcw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import type { ProjectBrief, ProjectZone, RecommendationPlan, RecommendationResult } from "@/src/domain/catalog/types";

const DEFAULTS_KEY = "hamyar-project-defaults-v2";
const SOLUTION_KEY = "hamyar-preferred-solution-v2";
const formatPrice = (value: number) => `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;

const initialBrief: ProjectBrief = {
  projectType: "shop", cameraCount: 8, outdoorCount: 2, entrances: 2, goal: "mixed", archiveDays: 30, budget: "balanced", preferredBrand: "Tiandy",
  siteAreaM2: 320, floors: 1, maxCableRunM: 90, remoteViewingUsers: 3, lowLightPriority: true, audioRequired: false, localRecordingFallback: true, redundancyRequired: false,
  zones: [
    { id: "entrance", name: "ورودی اصلی", cameraCount: 2, outdoor: false, goal: "face" },
    { id: "sales", name: "سالن و صندوق", cameraCount: 4, outdoor: false, goal: "general" },
    { id: "outside", name: "نمای بیرونی", cameraCount: 2, outdoor: true, goal: "general" }
  ]
};

const projectTypes = [["shop", "فروشگاه"], ["office", "اداری"], ["factory", "کارخانه"], ["parking", "پارکینگ"], ["residential", "مسکونی"]] as const;
const goals = [
  ["general", "نظارت عمومی", "پوشش رفت‌وآمد و رخدادها"], ["face", "تشخیص چهره", "جزئیات کافی در نقاط حساس"],
  ["plate", "پلاک‌خوانی", "ثبت خودرو در مسیر کنترل‌شده"], ["mixed", "ترکیبی", "چند هدف متفاوت در ناحیه‌ها"]
] as const;

const presets: { id: string; title: string; brief: Partial<ProjectBrief>; zones: ProjectZone[] }[] = [
  { id: "retail", title: "فروشگاه کوچک", brief: { projectType: "shop", siteAreaM2: 180, entrances: 1, archiveDays: 21 }, zones: [{ id: "p1", name: "ورودی و صندوق", cameraCount: 3, outdoor: false, goal: "face" }, { id: "p2", name: "سالن فروش", cameraCount: 3, outdoor: false, goal: "general" }] },
  { id: "parking", title: "پارکینگ", brief: { projectType: "parking", siteAreaM2: 1200, entrances: 2, archiveDays: 45, lowLightPriority: true }, zones: [{ id: "p1", name: "رمپ ورود", cameraCount: 2, outdoor: true, goal: "plate" }, { id: "p2", name: "محوطه پارک", cameraCount: 8, outdoor: false, goal: "general" }, { id: "p3", name: "مسیر عابر", cameraCount: 2, outdoor: false, goal: "face" }] },
  { id: "factory", title: "کارخانه", brief: { projectType: "factory", siteAreaM2: 4500, floors: 2, entrances: 4, archiveDays: 60, redundancyRequired: true }, zones: [{ id: "p1", name: "خط تولید", cameraCount: 12, outdoor: false, goal: "general" }, { id: "p2", name: "انبار", cameraCount: 6, outdoor: false, goal: "general" }, { id: "p3", name: "گیت خودرو", cameraCount: 4, outdoor: true, goal: "plate" }] }
];

export function ProjectWizard() {
  const [step, setStep] = useState(1);
  const [brief, setBrief] = useState<ProjectBrief>(initialBrief);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [hasSavedDefaults, setHasSavedDefaults] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHasSavedDefaults(Boolean(window.localStorage.getItem(DEFAULTS_KEY))), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const progress = useMemo(() => `${Math.min(step, 4) * 25}%`, [step]);
  const update = <K extends keyof ProjectBrief>(key: K, value: ProjectBrief[K]) => setBrief((current) => ({ ...current, [key]: value }));

  function syncZones(zones: ProjectZone[]) {
    setBrief((current) => ({
      ...current, zones,
      cameraCount: zones.reduce((sum, zone) => sum + zone.cameraCount, 0),
      outdoorCount: zones.filter((zone) => zone.outdoor).reduce((sum, zone) => sum + zone.cameraCount, 0),
      goal: zones.some((zone) => zone.goal === "plate") && zones.some((zone) => zone.goal === "face") ? "mixed" : zones.some((zone) => zone.goal === "plate") ? "plate" : zones.some((zone) => zone.goal === "face") ? "face" : "general"
    }));
  }

  function saveDefaults() {
    window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify(brief));
    setHasSavedDefaults(true); setSavedMessage("تنظیمات فعلی به‌عنوان پیش‌فرض ذخیره شد.");
  }

  function loadDefaults() {
    const saved = window.localStorage.getItem(DEFAULTS_KEY);
    if (saved) { try { setBrief({ ...initialBrief, ...JSON.parse(saved) }); setSavedMessage("پیش‌فرض ذخیره‌شده بارگذاری شد."); } catch { setSavedMessage("پیش‌فرض ذخیره‌شده قابل خواندن نیست."); } }
  }

  function resetDefaults() {
    window.localStorage.removeItem(DEFAULTS_KEY); setHasSavedDefaults(false); setBrief(initialBrief); setSavedMessage("تنظیمات اولیه بازیابی شد.");
  }

  function applyPreset(preset: (typeof presets)[number]) {
    const zones = preset.zones.map((zone) => ({ ...zone }));
    const cameraCount = zones.reduce((sum, zone) => sum + zone.cameraCount, 0);
    setBrief((current) => ({ ...current, ...preset.brief, zones, cameraCount, outdoorCount: zones.filter((zone) => zone.outdoor).reduce((sum, zone) => sum + zone.cameraCount, 0) }));
  }

  async function generate() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ساخت پیشنهاد انجام نشد.");
      setResult(data); setStep(5);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "خطای ناشناخته"); }
    finally { setLoading(false); }
  }

  if (step === 5 && result) return <RecommendationResults result={result} onReset={() => { setResult(null); setStep(1); }} />;

  const stepTitles = ["شناخت محیط", "تعریف ناحیه‌ها", "نیاز تصویری", "زیرساخت و اولویت"];
  return <section className="wizard-shell advanced-wizard">
    <div className="wizard-progress-head">
      <div><span>مرحله {step} از ۴</span><strong>{stepTitles[step - 1]}</strong></div>
      <div className="wizard-persistence">
        {hasSavedDefaults && <button type="button" onClick={loadDefaults}><Bookmark size={14} />بارگذاری پیش‌فرض</button>}
        <button type="button" onClick={saveDefaults}><Save size={14} />ذخیره پیش‌فرض</button>
        <button type="button" onClick={resetDefaults} aria-label="بازنشانی"><RotateCcw size={14} /></button>
      </div>
    </div>
    <div className="wizard-progress"><span style={{ width: progress }} /></div>
    {savedMessage && <button type="button" className="saved-toast" onClick={() => setSavedMessage("")}><Check size={14} />{savedMessage}</button>}

    {step === 1 && <div className="wizard-stage-layout">
      <WizardVisual image="/assets/wizard-environment.webp" title="نقشه اولیه پوشش" description="ابعاد و نوع محیط روی تعداد دوربین، مقاومت بدنه و پیچیدگی کابل‌کشی اثر دارد." tips={["متراژ تقریبی کافی است", "تعداد طبقات را جدا حساب کنید", "ورودی‌های مهم را فراموش نکنید"]} />
      <div className="wizard-step">
        <div className="wizard-copy align-start"><p className="eyebrow">شروع طراحی</p><h1>پروژه را بهتر بشناسیم</h1><p>می‌توانید از یک سناریوی آماده شروع و جزئیات را بعداً ویرایش کنید.</p></div>
        <div className="preset-row">{presets.map((preset) => <button type="button" key={preset.id} onClick={() => applyPreset(preset)}><Sparkles size={14} />{preset.title}</button>)}</div>
        <div className="choice-grid choice-grid-five">{projectTypes.map(([value, label]) => <button type="button" key={value} className={brief.projectType === value ? "choice-card selected" : "choice-card"} onClick={() => update("projectType", value)}><span>{label}</span>{brief.projectType === value && <Check size={18} />}</button>)}</div>
        <div className="field-grid three-fields">
          <LabeledNumber label="مساحت تقریبی" value={brief.siteAreaM2 || 0} unit="متر مربع" min={20} max={100000} onChange={(value) => update("siteAreaM2", value)} />
          <NumberField label="تعداد طبقات" value={brief.floors || 1} min={1} max={20} onChange={(value) => update("floors", value)} />
          <NumberField label="ورودی‌های مهم" value={brief.entrances} min={0} max={20} onChange={(value) => update("entrances", value)} />
        </div>
      </div>
    </div>}

    {step === 2 && <div className="wizard-stage-layout">
      <WizardVisual image="/assets/wizard-environment.webp" title="پروژه را ناحیه‌بندی کنید" description="هر ناحیه می‌تواند هدف، تعداد دوربین و شرایط محیطی متفاوت داشته باشد." tips={["ورودی را از سالن جدا کنید", "فضای باز را علامت بزنید", "برای گیت خودرو هدف پلاک انتخاب کنید"]} />
      <div className="wizard-step">
        <div className="wizard-copy align-start"><p className="eyebrow">ویرایش کامل پروژه</p><h1>دوربین‌ها کجا نصب می‌شوند؟</h1><p>هر ردیف یک ناحیه مستقل است. جمع دوربین‌ها و فضای بیرونی خودکار محاسبه می‌شود.</p></div>
        <div className="zone-summary"><span><CameraCountIcon />{brief.cameraCount} دوربین</span><span><MapPinned size={16} />{brief.outdoorCount} دوربین بیرونی</span><span><Layers3 size={16} />{brief.zones?.length || 0} ناحیه</span></div>
        <div className="zone-editor">{(brief.zones || []).map((zone, index) => <ZoneRow key={zone.id} zone={zone} onChange={(next) => syncZones((brief.zones || []).map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => syncZones((brief.zones || []).filter((_, itemIndex) => itemIndex !== index))} />)}</div>
        <button type="button" className="add-zone-button" disabled={(brief.zones?.length || 0) >= 8} onClick={() => syncZones([...(brief.zones || []), { id: `zone-${Date.now()}`, name: "ناحیه جدید", cameraCount: 1, outdoor: false, goal: "general" }])}><Plus size={17} />افزودن ناحیه</button>
      </div>
    </div>}

    {step === 3 && <div className="wizard-stage-layout">
      <WizardVisual image="/assets/wizard-analytics.webp" title="کیفیت متناسب با هدف" description="موتور پیشنهاد وضوح، لنز، DORI، دید شب و قابلیت‌های هوشمند را با هدف شما تطبیق می‌دهد." tips={["چهره و پلاک به جزئیات بیشتری نیاز دارند", "دید شب روی لنز و سنسور اثر دارد", "صدا فقط در نقاط مجاز فعال شود"]} />
      <div className="wizard-step">
        <div className="wizard-copy align-start"><p className="eyebrow">کیفیت و تحلیل تصویر</p><h1>چه چیزی باید در تصویر قابل استفاده باشد؟</h1><p>هدف کلی از روی ناحیه‌ها پیشنهاد شده و همچنان قابل تغییر است.</p></div>
        <div className="choice-grid">{goals.map(([value, title, description]) => <button type="button" key={value} className={brief.goal === value ? "choice-card choice-card-detail selected" : "choice-card choice-card-detail"} onClick={() => update("goal", value)}><span><strong>{title}</strong><small>{description}</small></span>{brief.goal === value && <Check size={18} />}</button>)}</div>
        <div className="archive-field"><label><span>مدت نگهداری آرشیو</span><strong>{new Intl.NumberFormat("fa-IR").format(brief.archiveDays)} روز</strong></label><input type="range" min={7} max={180} value={brief.archiveDays} onChange={(event) => update("archiveDays", Number(event.target.value))} /><div><span>۷ روز</span><span>۱۸۰ روز</span></div></div>
        <div className="feature-toggle-grid">
          <FeatureToggle icon={<Moon size={18} />} title="اولویت دید در شب" description="مدل‌های IR قوی‌تر و سنسور بهتر" checked={Boolean(brief.lowLightPriority)} onChange={(value) => update("lowLightPriority", value)} />
          <FeatureToggle icon={<Mic size={18} />} title="میکروفون داخلی" description="فقط مدل‌های دارای ضبط صدا" checked={Boolean(brief.audioRequired)} onChange={(value) => update("audioRequired", value)} />
        </div>
      </div>
    </div>}

    {step === 4 && <div className="wizard-stage-layout">
      <WizardVisual image="/assets/wizard-plans.webp" title="سه راهکار قابل مقایسه" description="قیود فنی ابتدا کنترل می‌شوند و سپس سه ترکیب با سطح هزینه و توسعه متفاوت ساخته می‌شود." tips={["تمام اقلام هر پلن قابل ویرایش‌اند", "پلن منتخب را می‌توانید ذخیره کنید", "قیمت‌ها در این فاز نمایشی‌اند"]} />
      <div className="wizard-step">
        <div className="wizard-copy align-start"><p className="eyebrow">زیرساخت و خرید</p><h1>محدودیت‌های اجرایی را مشخص کنید</h1><p>این اطلاعات روی نوع سوئیچ، NVR، افزونگی و تجهیزات برق اثر می‌گذارد.</p></div>
        <div className="choice-grid choice-grid-three">{([[
          "economy", "اقتصادی", "کمترین هزینه با رعایت الزامات"
        ], ["balanced", "متعادل", "بهترین نسبت هزینه به عملکرد"], ["professional", "حرفه‌ای", "افزونگی، هوشمندی و توسعه"]] as const).map(([value, title, description]) => <button type="button" key={value} className={brief.budget === value ? "choice-card plan-choice selected" : "choice-card plan-choice"} onClick={() => update("budget", value)}><span><strong>{title}</strong><small>{description}</small></span>{brief.budget === value && <Check size={18} />}</button>)}</div>
        <div className="field-grid three-fields">
          <label className="wizard-select"><span>برند ترجیحی</span><select value={brief.preferredBrand || ""} onChange={(event) => update("preferredBrand", event.target.value)}><option value="">بدون ترجیح</option><option value="Tiandy">Tiandy</option><option value="OptiNet">OptiNet</option><option value="Hikvision">Hikvision</option><option value="LevelOne">LevelOne</option></select></label>
          <LabeledNumber label="بلندترین مسیر کابل" value={brief.maxCableRunM || 0} unit="متر" min={10} max={250} onChange={(value) => update("maxCableRunM", value)} />
          <NumberField label="کاربران مشاهده همزمان" value={brief.remoteViewingUsers || 1} min={1} max={100} onChange={(value) => update("remoteViewingUsers", value)} />
        </div>
        <div className="feature-toggle-grid">
          <FeatureToggle icon={<ShieldCheck size={18} />} title="افزونگی ذخیره‌سازی" description="اولویت NVR دارای RAID و ظرفیت رزرو" checked={Boolean(brief.redundancyRequired)} onChange={(value) => update("redundancyRequired", value)} />
          <FeatureToggle icon={<Cable size={18} />} title="ضبط محلی پشتیبان" description="ترجیح دوربین دارای حافظه داخلی" checked={Boolean(brief.localRecordingFallback)} onChange={(value) => update("localRecordingFallback", value)} />
        </div>
        <div className="brief-summary"><ShieldCheck size={22} /><div><strong>آماده تحلیل {brief.zones?.length || 0} ناحیه</strong><p>{brief.cameraCount} دوربین، {brief.archiveDays} روز آرشیو، مسیر کابل تا {brief.maxCableRunM} متر و {brief.outdoorCount} دوربین بیرونی بررسی می‌شود.</p></div></div>
      </div>
    </div>}

    {error && <p className="wizard-error"><CircleAlert size={17} />{error}</p>}
    <div className="wizard-actions"><button className="secondary-action" disabled={step === 1 || loading} onClick={() => setStep((value) => Math.max(1, value - 1))}><ArrowRight size={17} />مرحله قبل</button>{step < 4 ? <button className="primary-action" onClick={() => setStep((value) => value + 1)}>ادامه<ArrowLeft size={17} /></button> : <button className="primary-action" disabled={loading || brief.cameraCount < 2} onClick={generate}>{loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{loading ? "در حال تحلیل..." : "ساخت سه پلن هوشمند"}</button>}</div>
  </section>;
}

function WizardVisual({ image, title, description, tips }: { image: string; title: string; description: string; tips: string[] }) {
  return <aside className="wizard-visual"><div className="wizard-visual-image"><Image src={image} alt="" fill sizes="(max-width: 900px) 100vw, 38vw" priority /></div><div className="wizard-visual-copy"><span><Info size={15} />راهنمای این مرحله</span><h2>{title}</h2><p>{description}</p><ul>{tips.map((tip) => <li key={tip}><Check size={13} />{tip}</li>)}</ul></div></aside>;
}

function ZoneRow({ zone, onChange, onRemove }: { zone: ProjectZone; onChange: (zone: ProjectZone) => void; onRemove: () => void }) {
  return <article className="zone-row"><label><span>نام ناحیه</span><input value={zone.name} onChange={(event) => onChange({ ...zone, name: event.target.value })} /></label><label><span>هدف</span><select value={zone.goal} onChange={(event) => onChange({ ...zone, goal: event.target.value as ProjectZone["goal"] })}><option value="general">نظارت عمومی</option><option value="face">تشخیص چهره</option><option value="plate">پلاک‌خوانی</option></select></label><div className="zone-count"><span>تعداد دوربین</span><div><button type="button" onClick={() => onChange({ ...zone, cameraCount: Math.max(1, zone.cameraCount - 1) })}>−</button><strong>{zone.cameraCount}</strong><button type="button" onClick={() => onChange({ ...zone, cameraCount: Math.min(32, zone.cameraCount + 1) })}>+</button></div></div><label className="zone-outdoor"><input type="checkbox" checked={zone.outdoor} onChange={(event) => onChange({ ...zone, outdoor: event.target.checked })} /><span>فضای باز</span></label><button type="button" className="zone-delete" onClick={onRemove} aria-label={`حذف ${zone.name}`}><Trash2 size={16} /></button></article>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) { return <label className="wizard-number"><span>{label}</span><div><button onClick={() => onChange(Math.max(min, value - 1))} type="button">−</button><strong>{new Intl.NumberFormat("fa-IR").format(value)}</strong><button onClick={() => onChange(Math.min(max, value + 1))} type="button">+</button></div></label>; }
function LabeledNumber({ label, value, unit, min, max, onChange }: { label: string; value: number; unit: string; min: number; max: number; onChange: (value: number) => void }) { return <label className="wizard-labeled-number"><span>{label}</span><div><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} /><small>{unit}</small></div></label>; }
function FeatureToggle({ icon, title, description, checked, onChange }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className={checked ? "feature-toggle active" : "feature-toggle"}><span className="feature-toggle-icon">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
function CameraCountIcon() { return <span className="camera-count-icon">●</span>; }

function RecommendationResults({ result, onReset }: { result: RecommendationResult; onReset: () => void }) {
  const [activePlan, setActivePlan] = useState(result.project.budget);
  const [quantities, setQuantities] = useState<Record<string, Record<string, number>>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(SOLUTION_KEY);
      if (!raw) return;
      try {
        const stored = JSON.parse(raw) as { planId?: string; quantities?: { productId: string; quantity: number }[] };
        const plan = result.plans.find((item) => item.id === stored.planId);
        if (!plan || !stored.quantities) return;
        setActivePlan(plan.id);
        setQuantities({ [plan.id]: Object.fromEntries(stored.quantities.map((item) => [item.productId, item.quantity])) });
        setSaved(true);
      } catch { /* ignore an invalid local draft */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [result.plans]);
  const selected = result.plans.find((plan) => plan.id === activePlan) || result.plans[0];
  const quantityFor = (plan: RecommendationPlan, productId: string, initial: number) => quantities[plan.id]?.[productId] ?? initial;
  const editedTotal = selected?.items.reduce((sum, item) => sum + item.product.price * quantityFor(selected, item.product.id, item.quantity), 0) || 0;
  const setQuantity = (plan: RecommendationPlan, productId: string, value: number) => setQuantities((current) => ({ ...current, [plan.id]: { ...current[plan.id], [productId]: Math.max(0, Math.min(99, value)) } }));
  const saveSolution = () => { if (!selected) return; window.localStorage.setItem(SOLUTION_KEY, JSON.stringify({ project: result.project, planId: selected.id, quantities: selected.items.map((item) => ({ productId: item.product.id, quantity: quantityFor(selected, item.product.id, item.quantity) })), savedAt: new Date().toISOString() })); setSaved(true); };

  return <section className="recommendation-results">
    <div className="results-hero"><div><p className="eyebrow">طراحی اولیه آماده است</p><h1>سه سناریوی قابل ویرایش</h1><p>هر قلم را کم، زیاد یا حذف کنید و ترکیب نهایی را برای دفعات بعد به‌عنوان انتخاب ترجیحی نگه دارید.</p></div><div className="result-actions"><button className="secondary-action" onClick={onReset}>ویرایش نیازها</button><button className="primary-action" onClick={saveSolution}><Save size={16} />{saved ? "پلن پیش‌فرض ذخیره است" : "ذخیره به‌عنوان پیش‌فرض"}</button></div></div>
    <div className="metric-strip"><Metric label="پهنای‌باند کل" value={`${result.metrics.totalBandwidthMbps} Mbps`} /><Metric label="فضای آرشیو" value={`${result.metrics.storageRequiredTb} TB`} /><Metric label="بودجه PoE" value={`${result.metrics.poeRequiredW} W`} /><Metric label="وضوح پیشنهادی" value={`${result.metrics.recommendedResolutionMp} MP`} /></div>
    <div className="plan-tabs">{result.plans.map((plan) => <button key={plan.id} className={selected?.id === plan.id ? "active" : ""} onClick={() => setActivePlan(plan.id)}><span>{plan.title}</span><small>امتیاز {new Intl.NumberFormat("fa-IR").format(plan.score)} از ۱۰۰</small></button>)}</div>
    {selected && <div className="selected-plan"><div className="selected-plan-head"><div><span className="plan-score">{selected.score}% تطابق</span><h2>پلن {selected.title}</h2><p>{selected.subtitle}</p></div><div className="plan-price"><span>برآورد ویرایش‌شده تجهیزات</span><strong>{formatPrice(editedTotal)}</strong><small>{editedTotal !== selected.totalPrice ? `مبلغ اولیه ${formatPrice(selected.totalPrice)}` : "قیمت‌ها نمایشی و غیرقابل استناد هستند"}</small></div></div>
      <div className="solution-items">{selected.items.map((item) => { const qty = quantityFor(selected, item.product.id, item.quantity); const image = item.product.images?.[0]; return <article key={item.product.id} className={qty === 0 ? "solution-item removed" : "solution-item"}>{image ? <div className="solution-product-image"><Image src={image.url} alt={image.alt} fill sizes="64px" /></div> : <div className="product-symbol">{item.product.category.toUpperCase()}</div>}<div className="solution-item-copy"><div><span className="item-quantity">{qty === 0 ? "حذف‌شده" : `${new Intl.NumberFormat("fa-IR").format(qty)} عدد`}</span><h3>{item.product.name}</h3><small>{item.product.sku} · {item.product.stockStatus === "in_stock" ? "موجود" : "موجودی محدود"}</small></div><ul>{item.reasons.map((reason) => <li key={reason}><Check size={14} />{reason}</li>)}</ul></div><div className="item-edit"><strong className="item-price">{formatPrice(item.product.price * qty)}</strong><div><button type="button" onClick={() => setQuantity(selected, item.product.id, qty - 1)}>−</button><span>{qty}</span><button type="button" onClick={() => setQuantity(selected, item.product.id, qty + 1)}>+</button></div>{qty > 0 ? <button type="button" className="remove-item" onClick={() => setQuantity(selected, item.product.id, 0)}><Trash2 size={13} />حذف</button> : <button type="button" className="restore-item" onClick={() => setQuantity(selected, item.product.id, item.quantity)}><RotateCcw size={13} />بازگردانی</button>}</div></article>; })}</div>
      <div className="why-plan"><Sparkles size={20} /><div><strong>چرا این ترکیب؟</strong><p>{selected.highlights.join(" · ")}</p></div></div></div>}
    {result.rejected.length > 0 && <details className="rejected-options"><summary>چرا بعضی گزینه‌ها حذف شدند؟ <ChevronLeft size={16} /></summary><ul>{result.rejected.map((item) => <li key={`${item.productName}-${item.reason}`}><strong>{item.productName}</strong><span>{item.reason}</span></li>)}</ul></details>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong dir="ltr">{value}</strong></div>; }
