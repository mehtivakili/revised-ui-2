"use client";

import { useMemo } from "react";
import { Camera } from "lucide-react";
import type { CatalogProduct, ProductCategory, RecommendationPlan, RecommendationResult } from "@/src/domain/catalog/types";
import type { BuildingPlan, FloorPlan } from "@/src/domain/planner/types";
import { FloorCoverageSvg } from "@/src/components/planner/PlanResultMaps";
import { computeFloorCoverage, doriLevels, type FloorCoverage } from "@/src/lib/planner/coverage";
import { housingLabels } from "@/src/lib/planner/camera-templates";
import { TASK_LABELS } from "@/src/lib/recommendation/camera-constraints";

/**
 * The printable technical proposal.
 *
 * A separate A4 document, never a print of the results page. It leads with the technical
 * design, then the maps, then the analysis behind the choices, and ends with the
 * equipment; prices appear only there, quietly, because the proposal sells the design
 * rather than a price list. Mounted only while printing; proposal.css hides everything
 * else on the page.
 */

const faNum = (value: number, digits = 0) =>
  Number.isFinite(value) ? new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(value) : "—";
const price = (value: number) => `${new Intl.NumberFormat("fa-IR").format(Math.round(value))} تومان`;

const categoryLabels: Record<ProductCategory, string> = {
  camera: "دوربین",
  recorder: "ضبط‌کننده (NVR)",
  switch: "سوئیچ شبکه / PoE",
  storage: "هارد ذخیره‌سازی",
  ups: "منبع تغذیه اضطراری (UPS)"
};

const categoryOrder: ProductCategory[] = ["camera", "recorder", "storage", "switch", "ups"];

const projectTypeLabels: Record<string, string> = {
  shop: "تجاری",
  office: "اداری",
  factory: "صنعتی",
  parking: "پارکینگ",
  residential: "مسکونی"
};

const scoreLabels: Record<keyof RecommendationPlan["scoreBreakdown"], string> = {
  technicalFit: "تطابق با قیود فنی",
  capacityHeadroom: "حاشیه ظرفیت",
  imageQuality: "کیفیت تصویر",
  reliability: "قابلیت اطمینان",
  stockAvailability: "موجودی بازار",
  priceFit: "تناسب هزینه",
  preferredBrand: "برند ترجیحی"
};

export type ProposalProps = {
  result: RecommendationResult;
  selected: RecommendationPlan;
  /** Quantity actually quoted for each product (after the user's edits on the results page). */
  quantityFor: (productId: string, initial: number) => number;
  plan?: BuildingPlan;
  projectName?: string;
  venueLabel?: string;
};

export function EngineeringProposal({ result, selected, quantityFor, plan, projectName, venueLabel }: ProposalProps) {
  const brief = result.project;
  const issuedAt = useMemo(() => new Date(), []);
  const reference = `HD-${result.calculation.inputFingerprint.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase()}`;
  const title = projectName?.trim() || "پروژه نظارت تصویری";

  const lines = selected.items
    .map((item) => ({ product: item.product, quantity: quantityFor(item.product.id, item.quantity), reasons: item.reasons }))
    .filter((line) => line.quantity > 0)
    .sort((a, b) => categoryOrder.indexOf(a.product.category) - categoryOrder.indexOf(b.product.category));
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  const placedCameras = plan?.floors.reduce((sum, floor) => sum + floor.cameras.length, 0) ?? 0;
  const cameraCount = placedCameras || brief.cameraCount;
  // Once cameras are on the plan, the plan is the source of truth, not the first estimate.
  const outdoorCount = placedCameras
    ? (plan?.floors ?? []).reduce((sum, floor) => sum + floor.cameras.filter((camera) => camera.outdoor).length, 0)
    : brief.outdoorCount;
  const floorCount = plan?.floors.length || brief.floors || 1;
  const sheets = useMemo(
    () => (plan?.floors ?? [])
      .filter((floor) => floor.cameras.length > 0)
      .map((floor) => ({ floor, coverage: computeFloorCoverage(floor, 1.5) })),
    [plan]
  );
  const cameraProducts = lines.filter((line) => line.product.category === "camera").map((line) => line.product);
  const m = selected.metrics;
  const infra = selected.infrastructure;
  const hasMaps = sheets.length > 0;
  const n = (index: number) => faNum(hasMaps ? index : index - (index > 2 ? 1 : 0));

  return (
    <article className="proposal" dir="rtl" lang="fa">
      {/* ── Cover ─────────────────────────────────────────────────── */}
      <header className="proposal-cover">
        <div className="proposal-brand">
          <span className="proposal-logo"><Camera size={22} aria-hidden="true" /></span>
          <div>
            <strong>همیار دوربین</strong>
            <small>طراحی و محاسبه سیستم‌های نظارت تصویری</small>
          </div>
        </div>
        <p className="proposal-kicker">پروپوزال فنی طراحی سیستم نظارت تصویری</p>
        <h1>{title}</h1>
        <p className="proposal-subtitle">{venueLabel ?? projectTypeLabels[brief.projectType] ?? ""}</p>
        <dl className="proposal-cover-meta">
          <div><dt>شماره پروپوزال</dt><dd dir="ltr">{reference}</dd></div>
          <div><dt>تاریخ تهیه</dt><dd>{issuedAt.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })}</dd></div>
          <div><dt>دامنه طرح</dt><dd>{faNum(cameraCount)} دوربین · {faNum(floorCount)} طبقه</dd></div>
          <div><dt>راهکار پیشنهادی</dt><dd>پلن {selected.title}</dd></div>
        </dl>
        <div className="proposal-client">
          <span>کارفرما:</span><i />
          <span>نشانی پروژه:</span><i />
        </div>
      </header>

      {/* ── 1. Technical design ─────────────────────────────────── */}
      <section className="proposal-section">
        <h2><b>{n(1)}</b>مشخصات فنی طرح</h2>
        <p className="proposal-lead">
          طرح حاضر پوشش تصویری «{title}» را با {faNum(cameraCount)} دوربین
          {hasMaps
            ? sheets.length === floorCount
              ? ` در ${faNum(floorCount)} طبقه`
              : ` (جانمایی‌شده در ${faNum(sheets.length)} طبقه از ${faNum(floorCount)} طبقه)`
            : ""} تأمین می‌کند.
          وضوح بیشینه دوربین‌ها {faNum(m.recommendedResolutionMp)} مگاپیکسل، تراکم پیکسلی متوسط {faNum(m.averagePpm)} PPM،
          آرشیو {faNum(brief.archiveDays)} روزه با ضبط {brief.recordingMode === "motion" ? "مبتنی بر حرکت" : "پیوسته"} و
          فضای ذخیره نهایی {faNum(m.storageRequiredTb, 1)} ترابایت در نظر گرفته شده است.
        </p>
        <dl className="proposal-facts">
          <Fact label="تعداد دوربین" value={`${faNum(cameraCount)} دستگاه`} />
          <Fact label="دوربین فضای باز" value={`${faNum(outdoorCount)} دستگاه`} />
          <Fact label="طبقات ساختمان" value={faNum(floorCount)} />
          <Fact label="مساحت تقریبی" value={brief.siteAreaM2 ? `${faNum(brief.siteAreaM2)} متر مربع` : "—"} />
          <Fact label="مدت آرشیو" value={`${faNum(brief.archiveDays)} روز`} />
          <Fact label="کاربران همزمان راه دور" value={faNum(brief.remoteViewingUsers ?? 1)} />
          <Fact label="ضبط صدا" value={brief.recordAudio ? "دارد" : "ندارد"} />
          <Fact label="پشتیبان برق (UPS)" value={brief.upsRuntimeMinutes ? `${faNum(brief.upsRuntimeMinutes)} دقیقه` : "—"} />
        </dl>
        <div className="proposal-two-col proposal-gap">
          <table className="proposal-table proposal-kv">
            <caption>تصویر و ذخیره‌سازی</caption>
            <tbody>
              <KV label="تراکم پیکسلی متوسط / حداقل" value={`${faNum(m.averagePpm)} / ${faNum(m.minimumPpm)} PPM`} />
              <KV label="وضوح بیشینه دوربین‌ها" value={`${faNum(m.recommendedResolutionMp)} مگاپیکسل`} />
              <KV label="فضای ذخیره پایه / نهایی" value={`${faNum(m.storageBaseTb, 1)} / ${faNum(m.storageRequiredTb, 1)} ترابایت`} />
              <KV label="فضای قابل استفاده / خام" value={`${faNum(m.storageUsableTb, 1)} / ${faNum(m.storageRawTb, 1)} ترابایت`} />
              <KV label="آرایش دیسک" value={m.raidLevel === "none" ? "بدون RAID" : m.raidLevel} />
              <KV label="ضریب کارکرد ضبط" value={`${faNum(m.recordingDutyCycle * 100)}٪`} />
            </tbody>
          </table>
          <table className="proposal-table proposal-kv">
            <caption>شبکه و برق</caption>
            <tbody>
              <KV label="پهنای باند ورودی / راه دور" value={`${faNum(m.bandwidthMbps, 1)} / ${faNum(m.outgoingBandwidthMbps, 1)} Mbps`} />
              <KV label="ظرفیت رمزگشایی لازم" value={`${faNum(m.decodeDemandMp)} مگاپیکسل`} />
              <KV label="بار / ظرفیت PoE" value={`${faNum(m.poeLoadW)} / ${faNum(m.poeBudgetW)} وات`} />
              <KV label="بار / ظرفیت UPS" value={`${faNum(m.upsLoadW)} / ${faNum(m.upsRequiredW)} وات`} />
              <KV label="زمان پشتیبانی برق" value={m.estimatedRuntimeMin ? `${faNum(m.estimatedRuntimeMin, 1)} دقیقه` : "—"} />
              <KV label="نقاط توزیع شبکه" value={faNum(m.switchLocations)} />
            </tbody>
          </table>
        </div>
        <table className="proposal-table proposal-kv proposal-gap">
          <caption>زیرساخت برآوردی</caption>
          <tbody>
            <KV label="کابل مسی (با ذخیره)" value={`${faNum(infra.copperCableM)} متر`} />
            <KV label="فیبر نوری Backbone" value={`${faNum(infra.fiberBackboneM)} متر`} />
            <KV label="رک" value={`${faNum(infra.rackCount)} عدد ${faNum(infra.recommendedRackU)} یونیت`} />
            <KV label="پچ پنل / ماژول SFP" value={`${faNum(infra.patchPanelCount)} / ${faNum(infra.sfpModuleCount)}`} />
          </tbody>
        </table>
      </section>

      {/* ── 2. Maps and camera schedule ─────────────────────────── */}
      {hasMaps ? (
        <section className="proposal-section proposal-maps">
          <h2><b>{n(2)}</b>نقشه جانمایی و جدول دوربین‌ها</h2>
          <p className="proposal-note">
            رنگ‌ها سطح جزئیات تصویر در هر نقطه بر اساس استاندارد EN 62676-4 هستند و با احتساب دیوارها و موانع ترسیم‌شده محاسبه شده‌اند.
          </p>
          <ul className="proposal-legend">
            {doriLevels.map((level) => (
              <li key={level.key}><i style={{ background: level.color }} />{level.label}: <span dir="ltr">{level.ppm}+ PPM</span></li>
            ))}
          </ul>
          {sheets.map(({ floor, coverage }) => (
            <FloorSheet key={floor.id} floor={floor} coverage={coverage} cameraProducts={cameraProducts} />
          ))}
        </section>
      ) : null}

      {/* ── 3. Analysis ─────────────────────────────────────────── */}
      <section className="proposal-section proposal-analysis">
        <h2><b>{n(3)}</b>تحلیل طرح</h2>
        {hasMaps ? (
          <table className="proposal-table">
            <caption>پوشش هر طبقه</caption>
            <thead>
              <tr><th>طبقه</th><th>مساحت</th><th>دوربین</th><th>پوشش کل</th><th>سطح شناسایی</th></tr>
            </thead>
            <tbody>
              {sheets.map(({ floor, coverage }) => (
                <tr key={floor.id}>
                  <td>{floor.name}</td>
                  <td>{faNum(coverage.areaM2, 1)} متر مربع</td>
                  <td>{faNum(floor.cameras.length)}</td>
                  <td><Meter value={coverage.coveredPercent} /></td>
                  <td><Meter value={coverage.identifyPercent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="proposal-two-col proposal-gap">
          <table className="proposal-table proposal-kv">
            <caption>ارزیابی راهکار (از ۱۰۰)</caption>
            <tbody>
              <KV label="امتیاز کل" value={faNum(selected.score)} />
              {Object.entries(selected.scoreBreakdown).map(([key, value]) => (
                <KV key={key} label={scoreLabels[key as keyof RecommendationPlan["scoreBreakdown"]]} value={faNum(value)} />
              ))}
            </tbody>
          </table>
          {selected.highlights.length ? (
            <div className="proposal-callout">
              <strong>چرا این راهکار؟</strong>
              <ul>{selected.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : <div />}
        </div>

        <div className="proposal-two-col proposal-gap">
          <div>
            <h3>موارد بررسی‌شده</h3>
            <ul className="proposal-checks">{selected.constraints.checked.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h3>نیازمند بررسی در بازدید محل</h3>
            {selected.constraints.pending.length
              ? <ul className="proposal-pending">{selected.constraints.pending.map((item) => <li key={item}>{item}</li>)}</ul>
              : <p className="proposal-note">مورد باز ثبت نشده است.</p>}
          </div>
        </div>
        <p className="proposal-note">
          استانداردهای مبنا: {result.calculation.standardVersions.join("، ")}.
          محاسبات با موتور نسخه {result.calculation.engineVersion} و ورودی نسخه {result.calculation.inputVersion} انجام شده است
          (شناسه محاسبه <span dir="ltr">{result.calculation.inputFingerprint}</span>).
          جانمایی نهایی، مسیر کابل و نقطه نصب هر دوربین باید در بازدید محل تأیید شود.
        </p>
      </section>

      {/* ── 4. Equipment ────────────────────────────────────────── */}
      <section className="proposal-section proposal-equipment">
        <h2><b>{n(4)}</b>تجهیزات پیشنهادی</h2>
        <table className="proposal-table proposal-bom">
          <thead>
            <tr><th>ردیف</th><th>شرح تجهیز</th><th>گروه</th><th>برند / کد</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.product.id}>
                <td>{faNum(index + 1)}</td>
                <td>
                  <span className="proposal-item-name">{line.product.name}</span>
                  {line.reasons[0] ? <small className="proposal-item-reason">{line.reasons[0]}</small> : null}
                </td>
                <td>{categoryLabels[line.product.category]}</td>
                <td dir="ltr">{[line.product.brand, line.product.sku].filter(Boolean).join(" · ")}</td>
                <td className="proposal-qty">{faNum(line.quantity)}</td>
                <td className="proposal-price">{price(line.product.price)}</td>
                <td className="proposal-price">{price(line.product.price * line.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={6}>جمع برآورد تجهیزات</td><td className="proposal-price">{price(total)}</td></tr>
          </tfoot>
        </table>
        <p className="proposal-note">
          قیمت‌ها برآوردی و بر اساس فهرست قیمت روز هستند؛ هزینه نصب، کابل‌کشی، لوازم جانبی و مالیات لحاظ نشده و اعتبار آن‌ها منوط به استعلام نهایی است.
        </p>
      </section>

      {/* ── Signatures ──────────────────────────────────────────── */}
      <footer className="proposal-sign">
        <div><span>تهیه‌کننده</span><i /><small>نام، امضا و تاریخ</small></div>
        <div><span>تأیید کارفرما</span><i /><small>نام، امضا و تاریخ</small></div>
      </footer>
      <p className="proposal-colophon">این سند با همیار دوربین تهیه شده است · hamyardoorbin.ir</p>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function KV({ label, value }: { label: string; value: string }) {
  return <tr><th scope="row">{label}</th><td>{value}</td></tr>;
}

/** A percentage with a small bar, for the coverage table. */
function Meter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="proposal-meter">
      <span className="proposal-meter-track"><span style={{ width: `${clamped}%` }} /></span>
      {faNum(clamped)}٪
    </span>
  );
}

/** One floor: its map with coverage, then the cameras on it as a table. */
function FloorSheet({ floor, coverage, cameraProducts }: { floor: FloorPlan; coverage: FloorCoverage; cameraProducts: CatalogProduct[] }) {
  return (
    <div className="proposal-floor">
      <h3>
        {floor.name}
        <small>
          {faNum(coverage.areaM2, 1)} متر مربع · {faNum(floor.cameras.length)} دوربین ·
          پوشش {faNum(coverage.coveredPercent)}٪ · سطح شناسایی {faNum(coverage.identifyPercent)}٪
        </small>
      </h3>
      <div className="proposal-map"><FloorCoverageSvg floor={floor} coverage={coverage} /></div>
      <table className="proposal-table proposal-schedule">
        <thead>
          <tr><th>#</th><th>نام</th><th>بدنه</th><th>هدف</th><th>رزولوشن / لنز</th><th>ارتفاع</th><th>زاویه دید</th><th>شناسایی تا</th><th>مدل پیشنهادی</th></tr>
        </thead>
        <tbody>
          {floor.cameras.map((camera, index) => {
            const item = coverage.cameras.find((entry) => entry.cameraId === camera.id);
            // Models are quoted as counts, so placements cycle through the quoted camera models.
            const product = cameraProducts.length ? cameraProducts[index % cameraProducts.length] : undefined;
            return (
              <tr key={camera.id}>
                <td>{faNum(index + 1)}</td>
                <td>{camera.name}</td>
                <td>{camera.housing ? housingLabels[camera.housing] : "—"}</td>
                <td>{TASK_LABELS[camera.goal] ?? "—"}</td>
                <td>{faNum(camera.optics.megapixel)}MP · {faNum(camera.optics.focalMm, 1)}mm</td>
                <td>{faNum(camera.optics.mountHeightM, 1)} m</td>
                <td>{faNum(item?.fovDeg ?? 0)}°</td>
                <td>{item ? `${faNum(item.doriDistances.identify, 1)} m` : "—"}</td>
                <td className="proposal-item-name">{product?.name ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
