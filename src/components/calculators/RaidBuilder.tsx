"use client";

import {
  Check,
  Database,
  GripVertical,
  HardDrive,
  Info,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { calculateRaidUsable, type RaidLevel } from "@/src/lib/calculators/raid";
import { formatNumber } from "@/src/components/calculators/CalculatorUi";

type SupportedRaidLevel = Exclude<RaidLevel, "none">;

type Drive = {
  id: string;
  capacity: number;
};

const CAPACITIES = [24, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1];
const CAPACITY_SPRITE_INDEX = new Map(CAPACITIES.map((capacity, index) => [capacity, index]));
const RAID_LEVELS: SupportedRaidLevel[] = ["0", "1", "5", "6", "10"];
const MAX_DRIVES = 12;

const INITIAL_DRIVES: Drive[] = [4, 4, 4, 4].map((capacity, index) => ({
  id: `initial-drive-${index + 1}`,
  capacity
}));

const RAID_DESCRIPTIONS: Record<SupportedRaidLevel, string> = {
  "0": "بیشترین ظرفیت و سرعت، بدون تحمل خرابی",
  "1": "آینه‌سازی کامل برای بیشترین حفاظت",
  "5": "تعادل ظرفیت و حفاظت با تحمل خرابی یک دیسک",
  "6": "حفاظت بیشتر با تحمل خرابی دو دیسک",
  "10": "سرعت RAID 0 همراه با آینه‌سازی RAID 1"
};

function getValidationMessage(level: SupportedRaidLevel, count: number) {
  if (count === 0) return "برای شروع حداقل یک هارد به آرایه اضافه کنید.";
  if (level === "1" && count < 2) return "RAID 1 حداقل به ۲ هارد نیاز دارد.";
  if (level === "5" && count < 3) return "RAID 5 حداقل به ۳ هارد نیاز دارد.";
  if (level === "6" && count < 4) return "RAID 6 حداقل به ۴ هارد نیاز دارد.";
  if (level === "10" && (count < 4 || count % 2 !== 0)) return "RAID 10 حداقل به ۴ هارد و تعداد زوج نیاز دارد.";
  return "";
}

function getFailureTolerance(level: SupportedRaidLevel, count: number) {
  if (level === "0") return "بدون تحمل خرابی";
  if (level === "1") return count > 1 ? `تا ${count - 1} هارد` : "نیازمند ۲ هارد";
  if (level === "5") return "۱ هارد";
  if (level === "6") return "۲ هارد";
  return "حداقل ۱ هارد در هر جفت";
}

function raidNotesForResult(level: SupportedRaidLevel) {
  if (level === "0") return "تمام ظرفیت برای داده استفاده می‌شود؛ این سطح افزونگی ندارد.";
  if (level === "1") return "یک نسخه آینه‌ای از داده روی هاردهای آرایه نگهداری می‌شود.";
  if (level === "5") return "معادل ظرفیت یک هارد برای Parity و حفاظت کنار گذاشته می‌شود.";
  if (level === "6") return "معادل ظرفیت دو هارد برای Parity و حفاظت کنار گذاشته می‌شود.";
  return "هاردها به‌صورت جفت‌های آینه‌ای با عملکرد نواری سازمان‌دهی می‌شوند.";
}

function PurpleDrive({ capacity, compact = false }: { capacity: number; compact?: boolean }) {
  const spriteIndex = CAPACITY_SPRITE_INDEX.get(capacity) ?? CAPACITY_SPRITE_INDEX.get(4) ?? 9;
  const column = spriteIndex % 4;
  const row = Math.floor(spriteIndex / 4);

  return (
    <div
      className={`raid-drive-visual${compact ? " is-compact" : ""}`}
      style={{
        backgroundPosition: `${(column / 3) * 100}% ${(row / 3) * 100}%`
      }}
      aria-hidden="true"
    />
  );
}

export function RaidBuilder() {
  const [drives, setDrives] = useState<Drive[]>(INITIAL_DRIVES);
  const [level, setLevel] = useState<SupportedRaidLevel>("5");
  const [dropActive, setDropActive] = useState(false);
  const [announcement, setAnnouncement] = useState("چهار هارد ۴ ترابایتی در آرایه قرار دارد.");
  const driveSequence = useRef(INITIAL_DRIVES.length + 1);

  const capacities = useMemo(() => drives.map((drive) => drive.capacity), [drives]);
  const result = calculateRaidUsable(capacities, level);
  const validationMessage = getValidationMessage(level, drives.length);
  const rawCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
  const smallestCapacity = capacities.length ? Math.min(...capacities) : 0;
  const effectiveCapacity = smallestCapacity * drives.length;
  const usableCapacity = result.valid ? result.usableTb : 0;
  const protectionCapacity = result.valid ? Math.max(0, effectiveCapacity - usableCapacity) : 0;
  const unusedCapacity = result.valid ? Math.max(0, rawCapacity - effectiveCapacity) : rawCapacity;
  const efficiency = rawCapacity > 0 && result.valid ? (usableCapacity / rawCapacity) * 100 : 0;
  const isMixed = new Set(capacities).size > 1;
  const remainingSlots = Math.max(0, MAX_DRIVES - drives.length);

  const makeDrive = (capacity: number): Drive => ({
    id: `raid-drive-${driveSequence.current++}`,
    capacity
  });

  const addDrive = (capacity: number) => {
    if (drives.length >= MAX_DRIVES) {
      setAnnouncement("ظرفیت این آرایه حداکثر ۱۲ هارد است.");
      return;
    }
    setDrives((current) => [...current, makeDrive(capacity)]);
    setAnnouncement(`هارد ${capacity} ترابایتی به آرایه اضافه شد.`);
  };

  const removeDrive = (id: string, capacity: number) => {
    setDrives((current) => current.filter((drive) => drive.id !== id));
    setAnnouncement(`هارد ${capacity} ترابایتی از آرایه حذف شد.`);
  };

  const resetArray = () => {
    setDrives(INITIAL_DRIVES);
    setLevel("5");
    setAnnouncement("آرایه به چهار هارد ۴ ترابایتی و RAID 5 بازنشانی شد.");
  };

  const clearArray = () => {
    setDrives([]);
    setAnnouncement("همه هاردها از آرایه حذف شدند.");
  };

  const readCapacity = (event: DragEvent) => {
    const value = event.dataTransfer.getData("application/x-raid-capacity");
    return value ? Number(value) : Number.NaN;
  };
  const readSourceIndex = (event: DragEvent) => {
    const value = event.dataTransfer.getData("application/x-raid-index");
    return value ? Number(value) : Number.NaN;
  };

  const dropAtIndex = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);

    const capacity = readCapacity(event);
    if (Number.isFinite(capacity) && capacity > 0) {
      if (drives.length >= MAX_DRIVES) {
        setAnnouncement("ظرفیت این آرایه حداکثر ۱۲ هارد است.");
        return;
      }
      setDrives((current) => {
        const next = [...current];
        next.splice(targetIndex, 0, makeDrive(capacity));
        return next;
      });
      setAnnouncement(`هارد ${capacity} ترابایتی در جایگاه ${targetIndex + 1} قرار گرفت.`);
      return;
    }

    const sourceIndex = readSourceIndex(event);
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= drives.length || sourceIndex === targetIndex) return;
    setDrives((current) => {
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setAnnouncement(`ترتیب هاردها تغییر کرد؛ هارد به جایگاه ${targetIndex + 1} منتقل شد.`);
  };

  const dropAtEnd = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    const capacity = readCapacity(event);
    if (Number.isFinite(capacity) && capacity > 0) {
      addDrive(capacity);
      return;
    }

    const sourceIndex = readSourceIndex(event);
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= drives.length - 1) return;
    setDrives((current) => {
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.push(moved);
      return next;
    });
    setAnnouncement("هارد به انتهای آرایه منتقل شد.");
  };

  return (
    <section className="raid-builder" aria-labelledby="raid-builder-title">
      <header className="raid-builder-intro">
        <div>
          <span className="raid-builder-kicker"><Database size={16} /> طراحی آرایه ذخیره‌سازی</span>
          <h2 id="raid-builder-title">هاردها را انتخاب کنید و آرایه RAID را بسازید</h2>
          <p>هارد را داخل محفظه بکشید یا روی آن بزنید. نتیجه با هر تغییر، همان لحظه محاسبه می‌شود.</p>
        </div>
        <div className="raid-builder-actions">
          <button type="button" onClick={clearArray} disabled={!drives.length}>
            <Trash2 size={17} /> پاک‌کردن
          </button>
          <button type="button" onClick={resetArray}>
            <RotateCcw size={17} /> شروع دوباره
          </button>
        </div>
      </header>

      <div className="raid-builder-flow" aria-hidden="true">
        <span className="is-active"><b>۱</b> انتخاب هارد</span>
        <i />
        <span className={drives.length ? "is-active" : ""}><b>۲</b> ساخت آرایه</span>
        <i />
        <span className={result.valid ? "is-active" : ""}><b>۳</b> بررسی نتیجه</span>
      </div>

      <div className="raid-builder-grid">
        <section className="raid-drive-library" aria-labelledby="raid-drive-library-title">
          <div className="raid-section-heading">
            <div>
              <span className="raid-step-number">۱</span>
              <div>
                <h3 id="raid-drive-library-title">ظرفیت هارد</h3>
                <p>برای افزودن، بکشید یا لمس کنید</p>
              </div>
            </div>
            <span className="raid-drive-count">{drives.length} / {MAX_DRIVES}</span>
          </div>

          <div className="raid-drive-options">
            {CAPACITIES.map((capacity) => (
              <button
                type="button"
                className="raid-drive-option"
                key={capacity}
                draggable={drives.length < MAX_DRIVES}
                disabled={drives.length >= MAX_DRIVES}
                onClick={() => addDrive(capacity)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData("application/x-raid-capacity", String(capacity));
                  setAnnouncement(`هارد ${capacity} ترابایتی برداشته شد؛ آن را داخل محفظه رها کنید.`);
                }}
                aria-label={`افزودن هارد وسترن دیجیتال بنفش ${capacity} ترابایتی`}
              >
                <PurpleDrive capacity={capacity} compact />
                <span><Plus size={15} /> افزودن</span>
              </button>
            ))}
          </div>
        </section>

        <section className="raid-array-panel" aria-labelledby="raid-array-title">
          <div className="raid-section-heading">
            <div>
              <span className="raid-step-number">۲</span>
              <div>
                <h3 id="raid-array-title">محفظه ذخیره‌سازی</h3>
                <p>{remainingSlots ? `${remainingSlots} جایگاه خالی` : "تمام جایگاه‌ها پر است"}</p>
              </div>
            </div>
            <span className="raid-array-status"><span /> آرایه فعال</span>
          </div>

          <div
            className={`raid-array-chassis${dropActive ? " is-drop-active" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/x-raid-capacity") ? "copy" : "move";
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false);
            }}
            onDrop={dropAtEnd}
          >
            <div className="raid-chassis-topline">
              <div><span /><span /><span /></div>
              <strong>HAMYAR STORAGE</strong>
              <small>{MAX_DRIVES}-BAY</small>
            </div>
            <div className="raid-bays" dir="ltr">
              {drives.map((drive, index) => (
                <article
                  className="raid-bay is-filled"
                  key={drive.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("application/x-raid-index", String(index));
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropAtIndex(event, index)}
                  aria-label={`جایگاه ${index + 1}، هارد ${drive.capacity} ترابایتی`}
                >
                  <div className="raid-bay-handle"><GripVertical size={15} /></div>
                  <PurpleDrive capacity={drive.capacity} />
                  <span className="raid-bay-index">{String(index + 1).padStart(2, "0")}</span>
                  <button
                    type="button"
                    className="raid-remove-drive"
                    onClick={() => removeDrive(drive.id, drive.capacity)}
                    aria-label={`حذف هارد ${drive.capacity} ترابایتی از جایگاه ${index + 1}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
              {drives.length < MAX_DRIVES ? (
                <button
                  type="button"
                  className="raid-bay is-empty"
                  onClick={() => addDrive(4)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={dropAtEnd}
                  aria-label="افزودن یک هارد ۴ ترابایتی به جایگاه خالی"
                >
                  <Plus size={24} />
                  <span>رها کنید</span>
                </button>
              ) : null}
            </div>
            {!drives.length ? (
              <div className="raid-empty-message">
                <HardDrive size={28} />
                <strong>محفظه خالی است</strong>
                <span>یک هارد را از فهرست کناری انتخاب کنید.</span>
              </div>
            ) : null}
          </div>
          <p className="raid-drag-hint"><GripVertical size={15} /> هاردهای داخل محفظه را نیز می‌توانید برای تغییر ترتیب جابه‌جا کنید.</p>
        </section>
      </div>

      <section className="raid-configuration" aria-labelledby="raid-level-title">
        <div className="raid-section-heading">
          <div>
            <span className="raid-step-number">۳</span>
            <div>
              <h3 id="raid-level-title">سطح RAID</h3>
              <p>نوع حفاظت و ظرفیت قابل استفاده را انتخاب کنید</p>
            </div>
          </div>
        </div>
        <div className="raid-level-options" role="radiogroup" aria-label="انتخاب سطح RAID">
          {RAID_LEVELS.map((raidLevel) => (
            <button
              type="button"
              role="radio"
              aria-checked={level === raidLevel}
              className={level === raidLevel ? "is-selected" : ""}
              key={raidLevel}
              onClick={() => setLevel(raidLevel)}
            >
              <span>{level === raidLevel ? <Check size={16} /> : null}</span>
              <strong dir="ltr">RAID {raidLevel}</strong>
              <small>{RAID_DESCRIPTIONS[raidLevel]}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="raid-result-panel" aria-labelledby="raid-result-title" aria-live="polite">
        <div className="raid-result-heading">
          <div>
            <span className="raid-step-number">۴</span>
            <div>
              <h3 id="raid-result-title">برآورد ظرفیت آرایه</h3>
              <p>{result.valid ? raidNotesForResult(level) : "آرایه هنوز آماده محاسبه نیست"}</p>
            </div>
          </div>
          <div className={`raid-health-badge${result.valid ? " is-valid" : ""}`}>
            {result.valid ? <ShieldCheck size={17} /> : <Info size={17} />}
            {result.valid ? "پیکربندی معتبر" : "نیازمند اصلاح"}
          </div>
        </div>

        {validationMessage ? <div className="raid-validation-message"><Info size={18} />{validationMessage}</div> : null}
        {isMixed && result.valid ? (
          <div className="raid-mixed-warning"><Info size={17} />به‌دلیل تفاوت ظرفیت هاردها، محاسبه بر مبنای کوچک‌ترین هارد ({smallestCapacity} TB) انجام شده است.</div>
        ) : null}

        <div className="raid-result-metrics">
          <article>
            <span>ظرفیت خام</span>
            <strong dir="ltr">{formatNumber(rawCapacity, 0)} <small>TB</small></strong>
            <em>{drives.length} هارد نصب‌شده</em>
          </article>
          <article className="is-primary">
            <span>ظرفیت قابل استفاده</span>
            <strong dir="ltr">{formatNumber(usableCapacity, 0)} <small>TB</small></strong>
            <em>{formatNumber(efficiency, 0)}٪ بازده ظرفیت خام</em>
          </article>
          <article>
            <span>فضای حفاظت</span>
            <strong dir="ltr">{formatNumber(protectionCapacity, 0)} <small>TB</small></strong>
            <em>{getFailureTolerance(level, drives.length)} تحمل خرابی</em>
          </article>
          <article>
            <span>فضای بلااستفاده</span>
            <strong dir="ltr">{formatNumber(unusedCapacity, 0)} <small>TB</small></strong>
            <em>{isMixed ? "ناشی از اختلاف ظرفیت" : "بدون اتلاف اختلاف ظرفیت"}</em>
          </article>
        </div>

        <div className="raid-capacity-chart">
          <div className="raid-capacity-bar" aria-label="نمودار تفکیک ظرفیت">
            {rawCapacity === 0 || !result.valid ? <span className="is-unconfigured" style={{ width: "100%" }} /> : (
              <>
                <span className="is-usable" style={{ width: `${(usableCapacity / rawCapacity) * 100}%` }} />
                <span className="is-protection" style={{ width: `${(protectionCapacity / rawCapacity) * 100}%` }} />
                <span className="is-unused" style={{ width: `${(unusedCapacity / rawCapacity) * 100}%` }} />
              </>
            )}
          </div>
          <div className="raid-capacity-legend">
            <span><i className="is-usable" /> قابل استفاده <bdi>{formatNumber(usableCapacity, 0)} TB</bdi></span>
            <span><i className="is-protection" /> حفاظت <bdi>{formatNumber(protectionCapacity, 0)} TB</bdi></span>
            <span><i className="is-unused" /> بلااستفاده <bdi>{formatNumber(unusedCapacity, 0)} TB</bdi></span>
          </div>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  );
}
