"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { MousePointer2, Search, Square, Target } from "lucide-react";
import {
  defaultPlanDefaults,
  type FloorPlan,
  type PlanObstacle,
  type PlanSelection,
  type PlanWall
} from "@/src/domain/planner/types";
import { applyObstaclePreset, obstaclePresets } from "@/src/lib/planner/obstacle-presets";
import { fenceWallStyles } from "@/src/lib/planner/wall-styles";
import { createBlankCamera } from "@/src/lib/planner/camera-templates";
import {
  along,
  buttonCentre,
  Clicks,
  Cursor,
  fa,
  phase,
  seamOpacity,
  ToolButton,
  type Cue,
  type Key,
  type Point,
  type ToolCue
} from "@/src/components/smart/StudioTourDemoKit";

/**
 * Tour demos that play on the real plan canvas.
 *
 * Spaces and must-cover areas have to look exactly as they will in the
 * studio, so these scenes hand sample floors to the same PlanCanvas the designer uses and
 * only draw the cursor, the mock ribbon and transient feedback on top. The canvas is read
 * only and takes no pointer input; nothing here touches the user's plan.
 */

export type LiveDemoId = "space" | "zone";

/** The studio's own canvas, loaded with the tour rather than with the page. */
export const TourPlanCanvas = dynamic(() => import("@/src/components/planner/PlanCanvas").then((module) => module.PlanCanvas), { ssr: false });

const noop = () => {};
const noSelection: PlanSelection = [];

/** Plan metres to overlay units, for a top view at the given zoom (the canvas shows 30 m / zoom tall). */
const project = (zoom: number) => {
  const k = (260 * zoom) / 30;
  return {
    k,
    at: (x: number, z: number): Point => ({ x: 200 + x * k, y: 130 + z * k })
  };
};

/* ── Sample geometry ──────────────────────────────────────────────── */

const masonry = (id: string, a: [number, number], b: [number, number]): PlanWall => ({
  id, a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] }, heightM: 3, thicknessM: 0.2, blocksView: true
});
const meshFence = (id: string, a: [number, number], b: [number, number]): PlanWall => {
  const style = fenceWallStyles["fence-mesh"];
  return { id, a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] }, heightM: style.heightM, thicknessM: style.thicknessM, blocksView: style.blocksView, variant: "fence-mesh" };
};
const box = (minX: number, minZ: number, maxX: number, maxZ: number) => [
  { x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }
];
function preset(id: string, presetId: string, x: number, z: number, rotationDeg = 0): PlanObstacle {
  const found = obstaclePresets.find((item) => item.id === presetId)!;
  return applyObstaclePreset(
    { id, label: "", kind: "block", center: { x, z }, widthM: 1, depthM: 1, heightM: 1, rotationDeg, blocksView: true },
    found
  );
}
const baseFloor = (id: string): FloorPlan => ({
  id, name: "نمایش", elevationM: 0, heightM: 3.2, walls: [], doors: [], obstacles: [], cameras: [], rooms: [], coverageRequirements: []
});

/* A house with an open front yard: fenced on three sides with a gate gap, so no space is detected. */
const yardHouse: FloorPlan = {
  ...baseFloor("tour-space"),
  walls: [
    masonry("h-n", [-7, -8], [7, -8]), masonry("h-e", [7, -8], [7, -2]), masonry("h-s", [7, -2], [-7, -2]), masonry("h-w", [-7, -2], [-7, -8]),
    meshFence("f-w", [-7, -2], [-7, 7]), meshFence("f-e", [7, -2], [7, 7]), meshFence("f-sw", [-7, 7], [-2, 7]), meshFence("f-se", [2, 7], [7, 7])
  ],
  doors: [{ id: "h-door", wallId: "h-s", type: "door", offset: 0.5, widthM: 1.2, heightM: 2.1, hinge: "start", openAngleDeg: 90 }],
  obstacles: [preset("yard-car", "sedan", 3.6, 3.2, 90), preset("yard-tree", "deciduous", -4.3, 4.4)],
  rooms: [{ id: "house", polygon: box(-7, -8, 7, -2), sectionTypeId: "residential.entrance", boundarySource: "detected", wallIds: ["h-n", "h-e", "h-s", "h-w"] }]
};
const YARD = box(-7, -2, 7, 7);

/* A shop floor: shelving, and the till that has to be seen. */
const shopFloor: FloorPlan = {
  ...baseFloor("tour-zone"),
  walls: [masonry("s-n", [-9, -5], [9, -5]), masonry("s-e", [9, -5], [9, 5]), masonry("s-s", [9, 5], [-9, 5]), masonry("s-w", [-9, 5], [-9, -5])],
  doors: [{ id: "s-door", wallId: "s-s", type: "door", variant: "double-glass", offset: 0.62, widthM: 1.8, heightM: 2.2, hinge: "start", openAngleDeg: 90 }],
  obstacles: [
    preset("shelf-1", "shelving-unit", -5.5, -2.6), preset("shelf-2", "shelving-unit", -2.5, -2.6),
    preset("shelf-3", "shelving-unit", -5.5, 0), preset("shelf-4", "shelving-unit", -2.5, 0),
    preset("shelf-5", "shelving-unit", -5.5, 2.6), preset("shelf-6", "shelving-unit", -2.5, 2.6),
    preset("till", "checkout-counter", 5.3, 2.4)
  ],
  rooms: [{ id: "shop", polygon: box(-9, -5, 9, 5), sectionTypeId: "shop.salesfloor", boundarySource: "detected", wallIds: ["s-n", "s-e", "s-s", "s-w"] }]
};
const TILL_ZONE = { minX: 3.6, minZ: 1.2, maxX: 7, maxZ: 4 };
const shopCamera = { ...createBlankCamera({ x: 8.6, z: -4.6 }, 1, 2.8), id: "tour-camera", yawDeg: 112 };

/* ── Demo: a space for an open area ───────────────────────────────── */

const SPACE_ZOOM = 1.5;
const spaceView = project(SPACE_ZOOM);
const SPACE_A = spaceView.at(-7, -2);
const SPACE_B = spaceView.at(7, 7);
const SPACE_BUTTON = { x: 312, y: 4 };
const SELECT_BUTTON = { x: 354, y: 4 };
const SPACE_PICKER = { x: 128, y: 150 };
const SPACE_ROW = { x: 230, y: 214 };
const spaceKeys: Key[] = [
  { t: 0, x: 300, y: 150 }, { t: 0.7, ...buttonCentre(SPACE_BUTTON) }, { t: 0.9, ...buttonCentre(SPACE_BUTTON) },
  { t: 1.6, ...SPACE_A }, { t: 1.85, ...SPACE_A }, { t: 3.6, ...SPACE_B }, { t: 4.6, ...SPACE_B },
  { t: 5.3, ...SPACE_ROW }, { t: 5.6, ...SPACE_ROW }, { t: 6.4, x: 330, y: 120 }
];
const spaceCues: Cue[] = [
  { t: 0, text: "محوطه دیوار بسته ندارد، پس فضا خودکار تشخیص داده نمی‌شود؛ ابزار «فضا» را بزنید" },
  { t: 1.7, text: "روی یک گوشه محوطه کلیک کنید" },
  { t: 1.9, text: "تا گوشه مقابل بکشید و کلیک کنید" },
  { t: 3.75, text: "فضا ساخته شد؛ مرز قرمز یعنی هنوز نوع ندارد" },
  { t: 4.1, text: "نوعش را همان‌جا جست‌وجو و انتخاب کنید" },
  { t: 5.6, text: "محوطه حالا در چک‌لیست و جانمایی هوشمند حساب می‌شود" }
];
const spaceTools: ToolCue[] = [{ t: 0, text: "انتخاب", icon: MousePointer2 }, { t: 0.8, text: "فضا", icon: Square }];

/* ── Demo: a must-cover area ──────────────────────────────────────── */

const ZONE_ZOOM = 1.6;
const zoneView = project(ZONE_ZOOM);
const ZONE_A = zoneView.at(TILL_ZONE.minX, TILL_ZONE.minZ);
const ZONE_B = zoneView.at(TILL_ZONE.maxX, TILL_ZONE.maxZ);
const ZONE_BUTTON = { x: 304, y: 4 };
const zoneKeys: Key[] = [
  { t: 0, x: 250, y: 150 }, { t: 0.7, ...buttonCentre(ZONE_BUTTON) }, { t: 0.9, ...buttonCentre(ZONE_BUTTON) },
  { t: 1.6, ...ZONE_A }, { t: 1.85, ...ZONE_A }, { t: 3.5, ...ZONE_B }, { t: 4.3, ...ZONE_B }, { t: 5.2, x: 330, y: 70 }
];
const zoneCues: Cue[] = [
  { t: 0, text: "برای جایی که حتماً باید دیده شود، مثل صندوق، ابزار «ناحیه اجباری» را بزنید" },
  { t: 1.7, text: "دو گوشه مقابل محدوده را بزنید" },
  { t: 3.65, text: "ناحیه «پوشش اجباری» ساخته شد" },
  { t: 4.6, text: "جانمایی هوشمند راه‌حلی را که این ناحیه را نپوشاند رد می‌کند" },
  { t: 5.9, text: "و دوربینی پیشنهاد می‌شود که آن را با کیفیت لازم ببیند" }
];
const zoneTools: ToolCue[] = [{ t: 0, text: "انتخاب", icon: MousePointer2 }, { t: 0.8, text: "ناحیه اجباری", icon: Target }];

export const liveDemos: Record<LiveDemoId, { title: string; duration: number; still: number; cues: Cue[]; tools: ToolCue[] }> = {
  space: { title: "فضای باز", duration: 9.5, still: 7, cues: spaceCues, tools: spaceTools },
  zone: { title: "ناحیه اجباری", duration: 10, still: 7.5, cues: zoneCues, tools: zoneTools }
};

/* ── Rendering ────────────────────────────────────────────────────── */

/** A read-only top view of a sample floor, framed at a fixed zoom so the overlay lines up. */
function Canvas({ floor, selection = noSelection, showCoverage = false, zoom }: {
  floor: FloorPlan;
  selection?: PlanSelection;
  showCoverage?: boolean;
  zoom: number;
}) {
  return (
    <TourPlanCanvas
      floor={floor}
      tool="select"
      wallDrawMode="rectangle"
      doorVariant="single-solid"
      viewMode="top"
      selection={selection}
      snapM={0.5}
      defaults={defaultPlanDefaults}
      showCoverage={showCoverage}
      showRoomNames
      showRoomTypes
      palette="studio"
      readOnly
      presentation={{ topZoom: zoom }}
      onSelect={noop}
      onFloorChange={noop}
      onHint={noop}
    />
  );
}

/** The dashed rectangle and live size shown while a region is being dragged out. */
function Draft({ from, to, k, tone }: { from: Point; to: Point; k: number; tone: "room" | "zone" }) {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  return (
    <>
      <rect x={x} y={y} width={w} height={h} className={`tour-demo-draft is-${tone}`} />
      {w > 12 ? (
        <g transform={`translate(${to.x + 8} ${to.y + 14})`} className="tour-demo-dim">
          <rect x={-2} y={-11} width={70} height={16} rx={4} />
          <text x={33} y={1} textAnchor="middle">{fa(w / k, 1)} × {fa(h / k, 1)} م</text>
        </g>
      ) : null}
    </>
  );
}

function SpaceScene({ t }: { t: number }) {
  const stage = t >= 5.65 ? 2 : t >= 3.75 ? 1 : 0;
  const floor = useMemo(() => (stage === 0 ? yardHouse : {
    ...yardHouse,
    rooms: [...(yardHouse.rooms ?? []), {
      id: "yard", polygon: YARD, boundarySource: "drawn" as const, impliedEdgeIndices: [0, 1, 2, 3],
      sectionTypeId: stage === 2 ? "residential.yard" : undefined
    }]
  }), [stage]);
  const selection = useMemo<PlanSelection>(() => (stage === 1 ? [{ kind: "room", id: "yard" }] : noSelection), [stage]);
  const cursor = along(spaceKeys, t);
  const dragging = t >= 1.85 && t < 3.75;
  const picker = t >= 3.9 && t < 5.7 ? phase(t, 3.9, 4.1) : 0;
  const typed = "حیاط".slice(0, Math.round(Math.min(1, Math.max(0, (t - 4.2) / 0.6)) * 4));
  return (
    <>
      <Canvas floor={floor} selection={selection} zoom={SPACE_ZOOM} />
      <svg viewBox="0 0 400 260" className="tour-demo-live-overlay">
        <ToolButton {...SELECT_BUTTON} icon={MousePointer2} label="انتخاب" state={t < 0.8 ? "active" : undefined} />
        <ToolButton {...SPACE_BUTTON} icon={Square} label="فضا" state={t >= 0.6 && t < 0.8 ? "hover" : t >= 0.8 ? "active" : undefined} />
        {dragging ? <Draft from={SPACE_A} to={cursor} k={spaceView.k} tone="room" /> : null}
        {picker > 0 ? (
          <g className="tour-demo-menu tour-demo-picker" style={{ opacity: picker }}>
            <rect x={SPACE_PICKER.x} y={SPACE_PICKER.y} width={150} height={100} rx={9} />
            <text x={SPACE_PICKER.x + 142} y={SPACE_PICKER.y + 15} textAnchor="end" className="tour-demo-picker-title">این فضا هنوز نوع ندارد</text>
            <rect x={SPACE_PICKER.x + 6} y={SPACE_PICKER.y + 22} width={138} height={20} rx={6} className="tour-demo-search" />
            <Search x={SPACE_PICKER.x + 10} y={SPACE_PICKER.y + 26} size={12} className="tour-demo-icon is-muted" />
            <text x={SPACE_PICKER.x + 138} y={SPACE_PICKER.y + 36} textAnchor="end">{typed}{t < 5 ? "|" : ""}</text>
            {typed ? (
              <>
                <rect x={SPACE_PICKER.x + 4} y={SPACE_PICKER.y + 50} width={142} height={22} rx={6} className={t >= 5.2 ? "is-hover" : "tour-demo-option"} />
                <text x={SPACE_PICKER.x + 138} y={SPACE_PICKER.y + 65} textAnchor="end">حیاط و محوطه</text>
                <text x={SPACE_PICKER.x + 10} y={SPACE_PICKER.y + 65} className="tour-demo-chip-important">مهم</text>
                <text x={SPACE_PICKER.x + 138} y={SPACE_PICKER.y + 89} textAnchor="end">حیاط و زمین بازی</text>
                <text x={SPACE_PICKER.x + 10} y={SPACE_PICKER.y + 89} className="tour-demo-chip-important">مهم</text>
              </>
            ) : (
              <text x={SPACE_PICKER.x + 138} y={SPACE_PICKER.y + 65} textAnchor="end" className="tour-demo-menu-note">پیشنهادها و جست‌وجو</text>
            )}
          </g>
        ) : null}
        <Clicks at={(time) => along(spaceKeys, time)} times={[0.8, 1.75, 3.7, 5.5]} t={t} />
        <Cursor at={cursor} pressed={dragging} />
      </svg>
    </>
  );
}

function ZoneScene({ t }: { t: number }) {
  const stage = t >= 5.85 ? 2 : t >= 3.65 ? 1 : 0;
  const floor = useMemo(() => (stage === 0 ? shopFloor : {
    ...shopFloor,
    coverageRequirements: [{
      id: "till-zone",
      polygon: box(TILL_ZONE.minX, TILL_ZONE.minZ, TILL_ZONE.maxX, TILL_ZONE.maxZ),
      label: "ناحیه اجباری ۱",
      origin: "user" as const,
      satisfied: stage === 2 ? true : undefined
    }],
    cameras: stage === 2 ? [shopCamera] : []
  }), [stage]);
  const selection = useMemo<PlanSelection>(() => (stage === 1 ? [{ kind: "requirement", id: "till-zone" }] : noSelection), [stage]);
  const cursor = along(zoneKeys, t);
  const dragging = t >= 1.85 && t < 3.65;
  return (
    <>
      <Canvas floor={floor} selection={selection} showCoverage={stage === 2} zoom={ZONE_ZOOM} />
      <svg viewBox="0 0 400 260" className="tour-demo-live-overlay">
        <ToolButton {...SELECT_BUTTON} icon={MousePointer2} label="انتخاب" state={t < 0.8 ? "active" : undefined} />
        <ToolButton {...ZONE_BUTTON} width={46} icon={Target} label="ناحیه اجباری" state={t >= 0.6 && t < 0.8 ? "hover" : t >= 0.8 ? "active" : undefined} />
        {dragging ? <Draft from={ZONE_A} to={cursor} k={zoneView.k} tone="zone" /> : null}
        <Clicks at={(time) => along(zoneKeys, time)} times={[0.8, 1.75, 3.6]} t={t} />
        <Cursor at={cursor} pressed={dragging} />
      </svg>
    </>
  );
}

/**
 * The stage keeps the overlay's 400 × 260 proportions whatever box it is given, so a plan
 * metre lands on the same overlay point in the card and on the canvas.
 */
export function LiveDemoScene({ id, t }: { id: LiveDemoId; t: number }) {
  return (
    <div className="tour-demo-live-frame" style={{ opacity: Math.max(0.35, seamOpacity(t, liveDemos[id].duration)) }}>
      <div className="tour-demo-live-stage is-locked">
        {id === "space" ? <SpaceScene t={t} /> : <ZoneScene t={t} />}
      </div>
    </div>
  );
}

