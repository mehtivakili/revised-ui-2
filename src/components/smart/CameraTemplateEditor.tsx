"use client";

import { MapPin, Copy, Plus, Trash2 } from "lucide-react";
import type { ProjectCameraTemplate, SurveillanceTask } from "@/src/domain/catalog/types";
import type { CameraHousing } from "@/src/domain/catalog/types";
import { createTemplate, estimateBitrateKbps, housingLabels } from "@/src/lib/planner/camera-templates";
import { TASK_LABELS } from "@/src/lib/recommendation/camera-constraints";
import { sensorOptions } from "@/src/lib/chatbot/slots";
import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * Camera types, edited from the placement studio.
 *
 * A type is a reusable starting point: it is dragged onto the plan as many times as the
 * site needs, and each drop becomes an independent camera. There is deliberately no
 * quantity here — how many cameras a project has is simply how many are on the plan.
 */

const megapixelOptions = [2, 3, 4, 5, 6, 8, 12];
const taskEntries = Object.entries(TASK_LABELS) as [SurveillanceTask, string][];

export function CameraTemplateEditor({
  templates,
  onChange,
  placedCounts
}: {
  templates: ProjectCameraTemplate[];
  onChange: (templates: ProjectCameraTemplate[]) => void;
  /** How many cameras of each type are already on the plan. */
  placedCounts?: Map<string, number>;
}) {
  const update = (id: string, patch: Partial<ProjectCameraTemplate>) =>
    onChange(templates.map((template) => {
      if (template.id !== id) return template;
      const next = { ...template, ...patch };
      // Resolution drives the suggested bitrate, so keep them in step unless the user
      // has already overridden the bitrate on the detail step.
      if (patch.megapixel !== undefined && patch.megapixel !== template.megapixel) {
        next.stream = {
          ...next.stream,
          bitrateKbps: estimateBitrateKbps(next.megapixel, next.stream.codec, next.stream.fps, next.stream.quality)
        };
      }
      return next;
    }));

  return (
    <section className="camera-template-editor">
      <div className="camera-template-list">
        {templates.map((template) => (
          <article key={template.id} className="camera-template-card">
            <div className="camera-template-head">
              <label className="camera-template-name">
                <span>نام نوع دوربین</span>
                <input value={template.label} onChange={(event) => update(template.id, { label: event.target.value })} />
              </label>
              {placedCounts ? (
                <span className={(placedCounts.get(template.id) ?? 0) > 0 ? "camera-template-placed is-used" : "camera-template-placed"}>
                  <MapPin size={13} aria-hidden="true" />
                  {(placedCounts.get(template.id) ?? 0) > 0 ? `${formatFa(placedCounts.get(template.id) ?? 0)} روی نقشه` : "هنوز استفاده نشده"}
                </span>
              ) : null}
              <div className="camera-template-head-actions">
                <button
                  type="button"
                  onClick={() => onChange([...templates, createTemplate({ ...template, id: undefined, label: `${template.label} (کپی)` })])}
                  title="ساخت یک نوع مشابه"
                  aria-label={`کپی ${template.label}`}
                >
                  <Copy size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="camera-template-delete"
                  disabled={templates.length <= 1}
                  onClick={() => onChange(templates.filter((item) => item.id !== template.id))}
                  aria-label={`حذف ${template.label}`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="camera-template-housing">
              {(Object.keys(housingLabels) as CameraHousing[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={template.housing === value ? "active" : ""}
                  onClick={() => update(template.id, { housing: value })}
                >
                  {housingLabels[value]}
                </button>
              ))}
            </div>

            <div className="camera-template-grid">
              <label>
                <span>هدف نظارتی</span>
                <select value={template.goal} onChange={(event) => update(template.id, { goal: event.target.value as SurveillanceTask })}>
                  {taskEntries.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>رزولوشن</span>
                <select value={template.megapixel} onChange={(event) => update(template.id, { megapixel: Number(event.target.value) })}>
                  {megapixelOptions.map((value) => <option key={value} value={value}>{value} مگاپیکسل</option>)}
                </select>
              </label>
              <label>
                <span>سنسور</span>
                <select value={template.sensorWidthMm} onChange={(event) => update(template.id, { sensorWidthMm: Number(event.target.value) })}>
                  {Object.entries(sensorOptions).map(([label, width]) => <option key={label} value={width}>{label} اینچ</option>)}
                </select>
              </label>
              <TemplateNumber label="لنز" unit="mm" value={template.focalMm} min={1} max={80} step={0.5} onChange={(focalMm) => update(template.id, { focalMm })} />
              <TemplateNumber label="ارتفاع نصب" unit="m" value={template.mountingHeightM} min={1} max={15} step={0.1} onChange={(mountingHeightM) => update(template.id, { mountingHeightM })} />
              <TemplateNumber label="برد مؤثر" unit="m" value={template.maxRangeM} min={2} max={120} step={1} onChange={(maxRangeM) => update(template.id, { maxRangeM })} />
              <TemplateNumber label="برد دید در شب" unit="m" value={template.irRangeM} min={0} max={200} step={5} onChange={(irRangeM) => update(template.id, { irRangeM })} />
              <TemplateNumber label="زاویه Tilt" unit="°" value={template.cameraTiltDeg} min={0} max={80} step={1} onChange={(cameraTiltDeg) => update(template.id, { cameraTiltDeg })} />
            </div>

            <div className="camera-template-flags">
              <label>
                <input
                  type="checkbox"
                  checked={template.outdoor}
                  onChange={(event) => update(template.id, { outdoor: event.target.checked, weatherproof: event.target.checked || template.weatherproof })}
                />
                <span>فضای باز</span>
              </label>
              <label>
                <input type="checkbox" checked={template.weatherproof} onChange={(event) => update(template.id, { weatherproof: event.target.checked })} />
                <span>بدنه مقاوم</span>
              </label>
              <label>
                <input type="checkbox" checked={template.microphone} onChange={(event) => update(template.id, { microphone: event.target.checked })} />
                <span>میکروفون</span>
              </label>
              <label>
                <input type="checkbox" checked={template.colorNightVision} onChange={(event) => update(template.id, { colorNightVision: event.target.checked })} />
                <span>شب رنگی</span>
              </label>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="add-zone-button"
        disabled={templates.length >= 12}
        onClick={() => onChange([...templates, createTemplate({ label: `دوربین ${formatFa(templates.length + 1)}`, quantity: 1 })])}
      >
        <Plus size={17} aria-hidden="true" />افزودن نوع دوربین
      </button>
    </section>
  );
}

function TemplateNumber({
  label, unit, value, min, max, step, onChange
}: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="camera-template-number">
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}
