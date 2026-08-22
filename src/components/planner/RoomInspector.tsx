"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Home, Lightbulb, Plus, Search, ShieldAlert, Square, Target, Trash2 } from "lucide-react";
import type { CameraHousing, SurveillanceTask } from "@/src/domain/catalog/types";
import type {
  CoverageRequirement,
  CustomSectionRecord,
  FloorPlan,
  PlanRoom,
  RoomPlacementOverrides
} from "@/src/domain/planner/types";
import {
  cameraFeatureLabels,
  createCustomSectionType,
  findSectionType,
  genericSectionType,
  minimumAutocompleteLength,
  searchSectionTypes,
  sectionEnvironmentLabels,
  sectionPriorityLabels,
  surveillanceGoalLabels,
  type SectionType
} from "@/src/domain/planner/venues";
import { mountKindLabels, recipeFor, roomContext, type MountKind } from "@/src/lib/planner/placement-rules";
import { housingLabels } from "@/src/lib/planner/camera-templates";
import { roomAreaM2 } from "@/src/lib/planner/rooms";
import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * Property panel for a space and for a must-cover area.
 *
 * The section type is the one required field — until it is set the room's outline stays
 * red — and everything the rule engine derives from it is shown here as an editable
 * value rather than a fixed readout. Accepting the suggested turret at 2.8 m is a
 * starting point, not a commitment.
 */

const housingChoices: CameraHousing[] = ["turret", "dome", "bullet", "ptz"];
const mountChoices: MountKind[] = ["corner", "wall-edge", "ceiling", "pole"];
const goalChoices: SurveillanceTask[] = ["monitor", "face-capture", "face-identify", "plate-capture", "anpr"];
const lensChoices = [2.8, 4, 6, 8, 12, 16];

export function RoomInspector({
  floor,
  room,
  venueTypeId,
  customSectionTypes,
  onFloorChange,
  onCustomSectionType,
  onSelect
}: {
  floor: FloorPlan;
  room: PlanRoom;
  venueTypeId?: string;
  customSectionTypes: CustomSectionRecord[];
  onFloorChange: (floor: FloorPlan) => void;
  onCustomSectionType: (section: CustomSectionRecord) => void;
  onSelect: (selection: []) => void;
}) {
  const custom = customSectionTypes as unknown as SectionType[];
  const section = findSectionType(room.sectionTypeId, custom);

  const update = (patch: Partial<PlanRoom>) => {
    const nextRoom = { ...room, ...patch };
    onFloorChange({
      ...floor,
      rooms: (floor.rooms ?? []).map((item) => (item.id === room.id ? nextRoom : item)),
      coverageRequirements: (floor.coverageRequirements ?? []).map((requirement) =>
        requirement.sourceRoomId === room.id
          ? {
            ...requirement,
            polygon: nextRoom.polygon.map((point) => ({ ...point })),
            sectionTypeId: nextRoom.sectionTypeId
          }
          : requirement
      )
    });
  };

  const roomRequirement = (floor.coverageRequirements ?? []).find((item) => item.sourceRoomId === room.id);
  const setWholeRoomRequired = (required: boolean) => {
    const manual = { ...room.manual, mustCover: required || undefined };
    const withoutLinked = (floor.coverageRequirements ?? []).filter((item) => item.sourceRoomId !== room.id);
    const linked: CoverageRequirement | null = required
      ? {
        id: roomRequirement?.id ?? `cover-room-${room.id}`,
        polygon: room.polygon.map((point) => ({ ...point })),
        label: roomRequirement?.label ?? `پوشش کامل ${room.name?.trim() || section?.label || "فضا"}`,
        origin: "user",
        sectionTypeId: room.sectionTypeId,
        sourceRoomId: room.id,
        satisfied: roomRequirement?.satisfied
      }
      : null;
    onFloorChange({
      ...floor,
      rooms: (floor.rooms ?? []).map((item) => item.id === room.id ? { ...item, manual } : item),
      coverageRequirements: linked ? [...withoutLinked, linked] : withoutLinked
    });
  };

  const setOverride = (patch: Partial<RoomPlacementOverrides>) => {
    update({ overrides: { ...room.overrides, ...patch } });
  };

  const areaM2 = roomAreaM2(room.polygon);
  const context = roomContext(room, floor);
  const recipe = section ? recipeFor(section, context) : null;

  /* Overrides win where they are set; everything else keeps tracking the rules. */
  const effective = recipe
    ? {
      housing: room.overrides?.housing ?? recipe.housing,
      mountKind: room.overrides?.mountKind ?? recipe.mountKind,
      mountHeightM: room.overrides?.mountHeightM ?? recipe.mountHeightM,
      focalMm: room.overrides?.focalMm ?? recipe.focalMm,
      goal: room.overrides?.goal ?? recipe.goal,
      cameraCount: room.overrides?.cameraCount ?? recipe.cameraCount
    }
    : null;

  const overridden = (key: keyof RoomPlacementOverrides) => room.overrides?.[key] !== undefined;

  return (
    <aside className="plan-inspector plan-room-inspector">
      <header>
        <Square size={18} aria-hidden="true" />
        <strong>{room.name?.trim() || section?.label || "فضای بدون نوع"}</strong>
        <button
          type="button"
          className="plan-inspector-delete"
          onClick={() => {
            onFloorChange({
              ...floor,
              rooms: (floor.rooms ?? []).filter((item) => item.id !== room.id),
              coverageRequirements: (floor.coverageRequirements ?? []).filter((item) => item.sourceRoomId !== room.id)
            });
            onSelect([]);
          }}
        >
          <Trash2 size={14} aria-hidden="true" /> حذف فضا
        </button>
      </header>

      {!section && (
        <>
          <div className="plan-room-alert">
            <ShieldAlert size={15} aria-hidden="true" />
            <span>تا وقتی نوع این فضا مشخص نشود مرز آن قرمز می‌ماند و طرح ناقص شمرده می‌شود.</span>
          </div>
          {/*
            The way out for a space that fits none of the venue's categories. It assigns
            the neutral type and opens the manual parameters, so the room stops being a
            red blocker and starts carrying the few numbers the rule engine actually
            needs — rather than leaving the user stuck between fourteen wrong labels.
          */}
          <button
            type="button"
            className="plan-room-generic"
            onClick={() => update({
              sectionTypeId: genericSectionType.id,
              ceilingHeightM: room.ceilingHeightM ?? floor.heightM,
              manual: { ...room.manual }
            })}
          >
            <Home size={14} aria-hidden="true" />
            این یک اتاق معمولی است
            <small>نوع عمومی می‌گیرد و پارامترهایش را دستی وارد می‌کنید</small>
          </button>
        </>
      )}

      <SectionTypePicker
        venueTypeId={venueTypeId}
        custom={custom}
        value={room.sectionTypeId}
        onPick={(picked) => update({ sectionTypeId: picked.id })}
        onCreate={(label) => {
          const created = createCustomSectionType(label);
          onCustomSectionType(created as unknown as CustomSectionRecord);
          update({ sectionTypeId: created.id });
        }}
      />

      {section && (
        <div className="plan-room-facts">
          <span className={`plan-room-chip priority-${section.priority}`}>{sectionPriorityLabels[section.priority]}</span>
          <span className="plan-room-chip">{sectionEnvironmentLabels[section.environment]}</span>
          {section.forbidden && <span className="plan-room-chip forbidden">نصب دوربین ممنوع</span>}
        </div>
      )}

      <label className="plan-field">
        <span>نام دلخواه (اختیاری)</span>
        <input
          type="text"
          value={room.name ?? ""}
          placeholder={section?.label ?? "مثلاً اتاق خواب شمالی"}
          onChange={(event) => update({ name: event.target.value || undefined })}
        />
      </label>

      <div className="plan-field-readout">
        <span>مساحت</span>
        <strong>{formatFa(Math.round(areaM2 * 10) / 10)} متر مربع</strong>
      </div>

      <NumberField
        label="ارتفاع سقف"
        unit="متر"
        value={room.ceilingHeightM ?? floor.heightM}
        min={1.8}
        max={20}
        step={0.1}
        onChange={(ceilingHeightM) => update({ ceilingHeightM })}
      />

      <label className="plan-check">
        <input
          type="checkbox"
          checked={Boolean(roomRequirement || room.manual?.mustCover)}
          onChange={(event) => setWholeRoomRequired(event.target.checked)}
        />
        <span>پوشش تمام این فضا الزامی است</span>
      </label>

      <ManualParameters room={room} onChange={(manual) => update({ manual })} />

      {section?.forbidden ? (
        <div className="plan-room-alert forbidden">
          <ShieldAlert size={15} aria-hidden="true" />
          <span>{section.note ?? "برای این فضا دوربینی پیشنهاد نمی‌شود."}</span>
        </div>
      ) : effective && recipe ? (
        <section className="plan-room-recipe">
          <h4><Lightbulb size={15} aria-hidden="true" /> پیکربندی پیشنهادی</h4>
          <p className="plan-room-recipe-note">
            این مقادیر از نوع فضا و ابعاد آن استنتاج شده‌اند. هر کدام را تغییر دهید، همان مقدار ملاک می‌شود.
          </p>

          <SelectField
            label="بدنه دوربین"
            value={effective.housing}
            changed={overridden("housing")}
            options={housingChoices.map((item) => ({ value: item, label: housingLabels[item] }))}
            onChange={(value) => setOverride({ housing: value as CameraHousing })}
          />
          <SelectField
            label="محل نصب"
            value={effective.mountKind}
            changed={overridden("mountKind")}
            options={mountChoices.map((item) => ({ value: item, label: mountKindLabels[item] }))}
            onChange={(value) => setOverride({ mountKind: value as MountKind })}
          />
          <NumberField
            label="ارتفاع نصب"
            unit="متر"
            value={effective.mountHeightM}
            min={1.5}
            max={12}
            step={0.1}
            changed={overridden("mountHeightM")}
            onChange={(mountHeightM) => setOverride({ mountHeightM })}
          />
          <SelectField
            label="لنز"
            value={String(effective.focalMm)}
            changed={overridden("focalMm")}
            /* One decimal, or 2.8 mm — the most common indoor lens — would read as 3. */
            options={lensChoices.map((item) => ({
              value: String(item),
              label: `${formatFa(item, 1)} میلی‌متر`
            }))}
            onChange={(value) => setOverride({ focalMm: Number(value) })}
          />
          <SelectField
            label="هدف کیفی"
            value={effective.goal}
            changed={overridden("goal")}
            options={goalChoices.map((item) => ({ value: item, label: surveillanceGoalLabels[item] }))}
            onChange={(value) => setOverride({ goal: value as SurveillanceTask })}
          />
          <NumberField
            label="تعداد دوربین"
            unit="عدد"
            value={effective.cameraCount}
            min={1}
            max={8}
            step={1}
            changed={overridden("cameraCount")}
            onChange={(cameraCount) => setOverride({ cameraCount: Math.round(cameraCount) })}
          />

          <div className="plan-room-features">
            <span>قابلیت لازم روی دوربین</span>
            <strong>
              {recipe.requiredFeatures.length
                ? recipe.requiredFeatures.map((feature) => cameraFeatureLabels[feature]).join("، ")
                : "هیچ‌کدام — فقط کیفیت تصویر اهمیت دارد"}
            </strong>
          </div>

          <details className="plan-room-reasons">
            <summary>چرا این پیشنهاد؟</summary>
            <ul>
              {recipe.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </details>

          {room.overrides && Object.keys(room.overrides).length > 0 && (
            <button type="button" className="plan-room-reset" onClick={() => update({ overrides: undefined })}>
              بازگشت به مقادیر پیشنهادی
            </button>
          )}
        </section>
      ) : null}
    </aside>
  );
}

/* ── Section type autocomplete ─────────────────────────────────────── */

/**
 * Type-ahead over the venue's spaces.
 *
 * Suggestions appear from the third character, which is where a Persian query stops
 * matching half the list; below that the field says so rather than showing nothing and
 * looking broken. An empty box still shows everything, because opening the panel to
 * browse is as common as typing.
 */
export function SectionTypePicker({
  venueTypeId,
  custom,
  value,
  onPick,
  onCreate
}: {
  venueTypeId?: string;
  custom: SectionType[];
  value?: string;
  onPick: (section: SectionType) => void;
  onCreate: (label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = findSectionType(value, custom);
  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < minimumAutocompleteLength;
  const results = useMemo(
    () => (tooShort ? [] : searchSectionTypes(trimmed, venueTypeId, custom)),
    [trimmed, tooShort, venueTypeId, custom]
  );

  return (
    <div className="plan-autocomplete">
      <label className="plan-field">
        <span>نوع فضا <em className="plan-required">اجباری</em></span>
        <div className="plan-autocomplete-input">
          <Search size={14} aria-hidden="true" />
          <input
            type="text"
            value={open ? query : selected?.label ?? ""}
            placeholder="نام فضا را بنویسید یا از فهرست انتخاب کنید"
            onFocus={() => { setOpen(true); setQuery(""); }}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => {
              // Deferred so a click on an option lands before the list unmounts.
              blurTimer.current = setTimeout(() => setOpen(false), 130);
            }}
          />
        </div>
      </label>

      {open && (
        <div className="plan-autocomplete-list">
          {tooShort && (
            <p className="plan-autocomplete-hint">
              برای جست‌وجو دست‌کم {formatFa(minimumAutocompleteLength)} حرف بنویسید
            </p>
          )}
          {!tooShort && results.length === 0 && (
            <p className="plan-autocomplete-hint">موردی پیدا نشد</p>
          )}
          {results.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.id === value ? "active" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                onPick(section);
                setOpen(false);
                setQuery("");
              }}
            >
              <span className="plan-autocomplete-label">{section.label}</span>
              <span className={`plan-room-chip priority-${section.priority}`}>
                {sectionPriorityLabels[section.priority]}
              </span>
              {section.id === value && <Check size={13} aria-hidden="true" />}
            </button>
          ))}
          {trimmed.length >= minimumAutocompleteLength
            && !results.some((section) => section.label === trimmed) && (
            <button
              type="button"
              className="plan-autocomplete-create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                onCreate(trimmed);
                setOpen(false);
                setQuery("");
              }}
            >
              <Plus size={13} aria-hidden="true" />
              ساخت نوع سفارشی «{trimmed}» و ذخیره برای پروژه‌های بعدی
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Manual parameters ─────────────────────────────────────────────── */

/**
 * The fallback for a space the geometry could not answer for.
 *
 * When a boundary stays open, or the outline is only the enclosing rectangle, the drawn
 * shape is not a reliable measurement. These fields let the user state the real clear
 * dimensions, and the rule engine uses them in place of the outline.
 */
function ManualParameters({
  room,
  onChange
}: {
  room: PlanRoom;
  onChange: (manual: PlanRoom["manual"]) => void;
}) {
  const manual = room.manual ?? {};
  const approximate = room.boundarySource === "enclosing" || room.boundarySource === "inferred";
  const [open, setOpen] = useState(approximate);

  const patch = (next: Partial<NonNullable<PlanRoom["manual"]>>) => onChange({ ...manual, ...next });

  return (
    <details className="plan-room-manual" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        پارامترهای دستی
        {approximate && <em> — مرز این فضا تقریبی است</em>}
      </summary>
      <p className="plan-room-recipe-note">
        اگر مرز رسم‌شده ابعاد واقعی فضا را نشان نمی‌دهد، اندازه‌های آزاد را اینجا وارد کنید؛
        همین اعداد مبنای انتخاب لنز می‌شوند.
      </p>
      <NumberField
        label="عرض آزاد"
        unit="متر"
        value={manual.widthM ?? 0}
        min={0}
        max={200}
        step={0.1}
        onChange={(widthM) => patch({ widthM: widthM > 0 ? widthM : undefined })}
      />
      <NumberField
        label="عمق آزاد"
        unit="متر"
        value={manual.depthM ?? 0}
        min={0}
        max={200}
        step={0.1}
        onChange={(depthM) => patch({ depthM: depthM > 0 ? depthM : undefined })}
      />
      <label className="plan-check">
        <input
          type="checkbox"
          checked={manual.openAbove ?? false}
          onChange={(event) => patch({ openAbove: event.target.checked || undefined })}
        />
        <span>این فضا سقف ندارد (نصب سقفی ممکن نیست)</span>
      </label>
    </details>
  );
}

/* ── Coverage requirement ──────────────────────────────────────────── */

export function CoverageRequirementInspector({
  floor,
  requirement,
  venueTypeId,
  customSectionTypes,
  onFloorChange,
  onCustomSectionType,
  onSelect
}: {
  floor: FloorPlan;
  requirement: CoverageRequirement;
  venueTypeId?: string;
  customSectionTypes: CustomSectionRecord[];
  onFloorChange: (floor: FloorPlan) => void;
  onCustomSectionType: (section: CustomSectionRecord) => void;
  onSelect: (selection: []) => void;
}) {
  const custom = customSectionTypes as unknown as SectionType[];
  const section = findSectionType(requirement.sectionTypeId, custom);
  const update = (patch: Partial<CoverageRequirement>) => {
    onFloorChange({
      ...floor,
      coverageRequirements: (floor.coverageRequirements ?? []).map((item) =>
        item.id === requirement.id ? { ...item, ...patch } : item
      )
    });
  };

  return (
    <aside className="plan-inspector plan-room-inspector">
      <header>
        <Target size={18} aria-hidden="true" />
        <strong>ناحیه پوشش اجباری</strong>
        <button
          type="button"
          className="plan-inspector-delete"
          onClick={() => {
            onFloorChange({
              ...floor,
              rooms: requirement.sourceRoomId
                ? (floor.rooms ?? []).map((room) => room.id === requirement.sourceRoomId
                  ? { ...room, manual: { ...room.manual, mustCover: undefined } }
                  : room)
                : floor.rooms,
              coverageRequirements: (floor.coverageRequirements ?? []).filter((item) => item.id !== requirement.id)
            });
            onSelect([]);
          }}
        >
          <Trash2 size={14} aria-hidden="true" /> حذف ناحیه
        </button>
      </header>

      <p className="plan-room-recipe-note">
        این ناحیه یک قید سخت است: جانمایی خودکار راه‌حلی را که آن را پوشش ندهد رد می‌کند و
        اگر پوشش ممکن نباشد، صریح اعلام می‌شود.
      </p>

      <label className="plan-field">
        <span>عنوان</span>
        <input type="text" value={requirement.label} onChange={(event) => update({ label: event.target.value })} />
      </label>

      {requirement.origin === "user" && (
        <>
          <SectionTypePicker
            venueTypeId={venueTypeId}
            custom={custom}
            value={requirement.sectionTypeId}
            onPick={(picked) => update({ sectionTypeId: picked.id, satisfied: undefined })}
            onCreate={(label) => {
              const created = createCustomSectionType(label);
              onCustomSectionType(created as unknown as CustomSectionRecord);
              update({ sectionTypeId: created.id, satisfied: undefined });
            }}
          />
          <p className="plan-room-recipe-note">
            {section
              ? `این ناحیه در چک‌لیست به‌عنوان «${section.label}» ثبت می‌شود و قواعد همان مورد را می‌گیرد.`
              : "در صورت نیاز این ناحیه را به یکی از موارد چک‌لیست متصل کنید؛ لازم نیست نوع کل اتاق را تغییر دهید."}
          </p>
        </>
      )}

      <div className="plan-field-readout">
        <span>منشأ</span>
        <strong>{requirement.origin === "equipment" ? "خودکار برای رک تجهیزات" : "تعریف‌شده توسط شما"}</strong>
      </div>
      <div className="plan-field-readout">
        <span>مساحت</span>
        <strong>{formatFa(Math.round(roomAreaM2(requirement.polygon) * 10) / 10)} متر مربع</strong>
      </div>

      {requirement.origin === "equipment" && (
        <div className="plan-room-alert">
          <ShieldAlert size={15} aria-hidden="true" />
          <span>ضبط‌کننده باید خودش زیر پوشش باشد؛ این ناحیه با قرار گرفتن رک روی نقشه ساخته شده است.</span>
        </div>
      )}
    </aside>
  );
}

/* ── Small fields ──────────────────────────────────────────────────── */

function NumberField({
  label, unit, value, min, max, step, changed, onChange
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  changed?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`plan-field${changed ? " plan-field-changed" : ""}`}>
      <span>{label}{changed && <em className="plan-overridden">دستی</em>}</span>
      <div className="plan-field-input">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}

function SelectField({
  label, value, options, changed, onChange
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  changed?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`plan-field${changed ? " plan-field-changed" : ""}`}>
      <span>{label}{changed && <em className="plan-overridden">دستی</em>}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
