"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Copy,
  Camera as CameraIcon,
  Eye,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Move3d,
  Plus,
  Ruler,
  Trash2,
  Minus
} from "lucide-react";
import {
  createEmptyPlan,
  createFloor,
  duplicateFloor,
  type BuildingPlan,
  type FloorPlan,
  type PlanSelection,
  type PlanTool,
  type PlanViewMode
} from "@/src/domain/planner/types";
import { PlanCanvas } from "@/src/components/planner/PlanCanvas";
import { PlanInspector } from "@/src/components/planner/PlanInspector";
import { computeFloorCoverage } from "@/src/lib/planner/coverage";
import { floorAreaM2 } from "@/src/lib/planner/geometry";
import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * Site designer.
 *
 * Owns the whole building: floors, the active floor's geometry, the uploaded backdrop
 * and its scale. Emits a summary upward so the wizard can use the drawn area and camera
 * count instead of asking the user to type a floor area.
 */

export type PlanSummary = {
  totalAreaM2: number;
  floorCount: number;
  cameraCount: number;
  coveredPercent: number;
};

/** `mode` decides which tools exist: the environment is drawn first, cameras are placed later. */
export type DesignerMode = "environment" | "cameras";

const allTools: { id: PlanTool; label: string; icon: typeof MousePointer2; hint: string; modes: DesignerMode[] }[] = [
  { id: "select", label: "انتخاب", icon: MousePointer2, hint: "انتخاب و جابه‌جایی عناصر — دستگیره نارنجی جهت دوربین را می‌چرخاند", modes: ["environment", "cameras"] },
  { id: "wall", label: "دیوار", icon: Ruler, hint: "کلیک کنید تا زنجیره دیوار بکشید؛ کلیک راست یا Esc پایان", modes: ["environment"] },
  { id: "obstacle", label: "مانع", icon: Box, hint: "دو نقطه مقابل هم را بزنید", modes: ["environment"] },
  { id: "camera", label: "افزودن دوربین", icon: CameraIcon, hint: "روی نقشه کلیک کنید تا دوربین اضافه شود", modes: ["cameras"] },
  { id: "measure", label: "اندازه‌گیری", icon: Move3d, hint: "دو نقطه را بزنید تا فاصله را ببینید", modes: ["environment", "cameras"] }
];

export function FloorPlanDesigner({
  plan: controlledPlan,
  mode = "environment",
  onPlanChange,
  onSummaryChange
}: {
  plan?: BuildingPlan;
  mode?: DesignerMode;
  onPlanChange?: (plan: BuildingPlan) => void;
  onSummaryChange?: (summary: PlanSummary) => void;
}) {
  const [internalPlan, setInternalPlan] = useState<BuildingPlan>(() => controlledPlan ?? createEmptyPlan());
  const plan = controlledPlan ?? internalPlan;
  const tools = useMemo(() => allTools.filter((item) => item.modes.includes(mode)), [mode]);

  const [requestedTool, setTool] = useState<PlanTool>("select");
  /* Derived, not stored: switching mode retires tools like "دیوار", and falling back
     here avoids an effect that would setState during render. */
  const tool: PlanTool = tools.some((item) => item.id === requestedTool)
    ? requestedTool
    : mode === "cameras" ? "camera" : "select";
  const [viewMode, setViewMode] = useState<PlanViewMode>("top");
  const [selection, setSelection] = useState<PlanSelection>(null);
  const [showCoverage, setShowCoverage] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<{ pixels: number; metres: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeFloor = plan.floors.find((floor) => floor.id === plan.activeFloorId) ?? plan.floors[0];

  const commit = useCallback((next: BuildingPlan) => {
    if (onPlanChange) onPlanChange(next);
    else setInternalPlan(next);

    if (onSummaryChange) {
      const totalAreaM2 = next.floors.reduce((sum, floor) => sum + floorAreaM2(floor.walls), 0);
      const cameraCount = next.floors.reduce((sum, floor) => sum + floor.cameras.length, 0);
      const active = next.floors.find((floor) => floor.id === next.activeFloorId) ?? next.floors[0];
      const coverage = active ? computeFloorCoverage(active, 1.5) : null;
      onSummaryChange({
        totalAreaM2,
        floorCount: next.floors.length,
        cameraCount,
        coveredPercent: coverage?.coveredPercent ?? 0
      });
    }
  }, [onPlanChange, onSummaryChange]);

  const updateFloor = useCallback((floor: FloorPlan) => {
    commit({ ...plan, floors: plan.floors.map((item) => (item.id === floor.id ? floor : item)) });
  }, [commit, plan]);

  const coverage = useMemo(() => (activeFloor ? computeFloorCoverage(activeFloor, 1.5) : null), [activeFloor]);
  const areaM2 = useMemo(() => (activeFloor ? floorAreaM2(activeFloor.walls) : 0), [activeFloor]);

  const addFloor = (copyPrevious: boolean) => {
    const index = plan.floors.length;
    const name = `طبقه ${index + 1}`;
    const source = plan.floors[plan.floors.length - 1];
    const floor = copyPrevious && source ? duplicateFloor(source, name, index) : createFloor(name, index);
    commit({ ...plan, floors: [...plan.floors, floor], activeFloorId: floor.id });
    setSelection(null);
  };

  const removeFloor = (id: string) => {
    if (plan.floors.length <= 1) return;
    const remaining = plan.floors.filter((floor) => floor.id !== id);
    commit({ ...plan, floors: remaining, activeFloorId: remaining[0].id });
    setSelection(null);
  };

  /** Reads the drawing at native size so the calibration maths stays in image pixels. */
  const handleBackdropUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const image = new Image();
      image.onload = () => {
        if (!activeFloor) return;
        // One metre per pixel until calibrated: a placeholder scale, flagged as such so
        // no dimension or DORI figure is derived from an uncalibrated drawing.
        const metresPerPixel = 20 / image.width;
        updateFloor({
          ...activeFloor,
          backdrop: {
            imageUrl: url,
            widthPx: image.width,
            heightPx: image.height,
            originM: { x: 0, z: 0 },
            metresPerPixel,
            opacity: 0.75,
            calibrated: false
          }
        });
      };
      image.src = url;
    };
    reader.readAsDataURL(file);
  };

  const applyCalibration = () => {
    if (!activeFloor?.backdrop || !calibration || calibration.pixels <= 0 || calibration.metres <= 0) return;
    updateFloor({
      ...activeFloor,
      backdrop: {
        ...activeFloor.backdrop,
        metresPerPixel: calibration.metres / calibration.pixels,
        calibrated: true
      }
    });
  };

  if (!activeFloor) return null;
  const activeTool = tools.find((item) => item.id === tool);

  return (
    <section className="plan-designer">
      <div className="plan-floor-rail">
        <div className="plan-floor-tabs">
          <Layers size={16} aria-hidden="true" />
          {plan.floors.map((floor) => (
            <button
              key={floor.id}
              type="button"
              className={floor.id === plan.activeFloorId ? "active" : ""}
              onClick={() => { commit({ ...plan, activeFloorId: floor.id }); setSelection(null); }}
            >
              {floor.name}
              <small>{formatFa(floor.cameras.length)} دوربین</small>
            </button>
          ))}
        </div>
        {mode === "environment" ? (
          <div className="plan-floor-actions">
            <button type="button" onClick={() => addFloor(false)}><Plus size={15} aria-hidden="true" />طبقه جدید</button>
            <button type="button" onClick={() => addFloor(true)} disabled={!plan.floors.length}>
              <Copy size={15} aria-hidden="true" />تکرار نقشه قبلی
            </button>
            <button type="button" onClick={() => removeFloor(plan.activeFloorId)} disabled={plan.floors.length <= 1}>
              <Trash2 size={15} aria-hidden="true" />حذف طبقه
            </button>
          </div>
        ) : null}
      </div>

      <div className="plan-toolbar">
        <div className="plan-tool-group">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={tool === item.id ? "active" : ""}
                onClick={() => { setTool(item.id); setHint(item.hint); }}
                title={item.hint}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="plan-tool-group">
          <button type="button" className={viewMode === "top" ? "active" : ""} onClick={() => setViewMode("top")}>
            <Grid3x3 size={16} aria-hidden="true" /><span>نمای نقشه</span>
          </button>
          <button type="button" className={viewMode === "orbit" ? "active" : ""} onClick={() => setViewMode("orbit")}>
            <Move3d size={16} aria-hidden="true" /><span>نمای سه‌بعدی</span>
          </button>
          <button type="button" className={showCoverage ? "active" : ""} onClick={() => setShowCoverage((value) => !value)}>
            <Eye size={16} aria-hidden="true" /><span>پوشش DORI</span>
          </button>
        </div>

        <div className="plan-tool-group">
          <label className="plan-snap-field">
            <span>اسنپ</span>
            <select value={plan.snapM} onChange={(event) => commit({ ...plan, snapM: Number(event.target.value) })}>
              <option value={0}>آزاد</option>
              <option value={0.1}>۱۰ سانتی‌متر</option>
              <option value={0.25}>۲۵ سانتی‌متر</option>
              <option value={0.5}>۵۰ سانتی‌متر</option>
              <option value={1}>۱ متر</option>
            </select>
          </label>
          {mode === "environment" ? (
            <button type="button" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={16} aria-hidden="true" /><span>بارگذاری نقشه</span>
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleBackdropUpload(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {activeFloor.backdrop ? (
        <div className={activeFloor.backdrop.calibrated ? "plan-calibration is-ready" : "plan-calibration"}>
          <div className="plan-calibration-head">
            <strong>{activeFloor.backdrop.calibrated ? "مقیاس نقشه تعریف شد" : "مقیاس نقشه هنوز تعریف نشده"}</strong>
            <small>
              {activeFloor.backdrop.calibrated
                ? `هر پیکسل ${(activeFloor.backdrop.metresPerPixel * 100).toFixed(2)} سانتی‌متر — ابعاد و DORI روی این نقشه معتبرند`
                : "یک فاصله معلوم روی نقشه را وارد کنید تا ابعاد واقعی شود"}
            </small>
          </div>
          <div className="plan-calibration-fields">
            <label>
              <span>طول روی تصویر</span>
              <input
                type="number"
                min={1}
                placeholder="پیکسل"
                value={calibration?.pixels ?? ""}
                onChange={(event) => setCalibration((current) => ({ pixels: Number(event.target.value), metres: current?.metres ?? 0 }))}
              />
            </label>
            <label>
              <span>همان فاصله در واقعیت</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                placeholder="متر"
                value={calibration?.metres ?? ""}
                onChange={(event) => setCalibration((current) => ({ pixels: current?.pixels ?? 0, metres: Number(event.target.value) }))}
              />
            </label>
            <button type="button" onClick={applyCalibration} disabled={!calibration?.pixels || !calibration?.metres}>
              اعمال مقیاس
            </button>
            <label className="plan-opacity-field">
              <span>شفافیت</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={activeFloor.backdrop.opacity}
                onChange={(event) => updateFloor({ ...activeFloor, backdrop: { ...activeFloor.backdrop!, opacity: Number(event.target.value) } })}
              />
            </label>
            <button type="button" className="plan-remove-backdrop" onClick={() => updateFloor({ ...activeFloor, backdrop: undefined })}>
              <Minus size={14} aria-hidden="true" />حذف تصویر
            </button>
          </div>
        </div>
      ) : null}

      <div className="plan-workspace">
        <PlanCanvas
          floor={activeFloor}
          tool={tool}
          viewMode={viewMode}
          selection={selection}
          snapM={plan.snapM}
          showCoverage={showCoverage}
          onSelect={setSelection}
          onFloorChange={updateFloor}
          onHint={setHint}
        />
        <PlanInspector floor={activeFloor} selection={selection} onFloorChange={updateFloor} onSelect={setSelection} />
      </div>

      <div className="plan-statusbar">
        <span className="plan-hint">{hint ?? activeTool?.hint}</span>
        <div className="plan-metrics">
          <span><strong>{formatFa(areaM2, 1)}</strong> متر مربع</span>
          <span><strong>{formatFa(activeFloor.walls.length)}</strong> دیوار</span>
          <span><strong>{formatFa(activeFloor.obstacles.length)}</strong> مانع</span>
          <span><strong>{formatFa(activeFloor.cameras.length)}</strong> دوربین</span>
          {coverage ? <span><strong>{formatFa(coverage.coveredPercent, 0)}٪</strong> پوشش</span> : null}
          {coverage ? <span><strong>{formatFa(coverage.identifyPercent, 0)}٪</strong> سطح شناسایی</span> : null}
        </div>
      </div>
    </section>
  );
}
