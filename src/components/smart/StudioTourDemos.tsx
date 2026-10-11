"use client";

import { useEffect, useId, useState } from "react";
import { Blinds, BrickWall, Camera, CarFront, ChevronDown, DoorOpen, Grid3x3, Minus, MousePointer2, Move3d, PlayCircle, Plus, Search, Square, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { doriLevels } from "@/src/lib/planner/coverage";
import { PlanCanvas } from "@/src/components/planner/PlanCanvas";
import {
  defaultPlanDefaults,
  emptySelection,
  type FloorPlan,
  type PlanViewMode
} from "@/src/domain/planner/types";

/**
 * Short looping animations for the guided tour.
 *
 * Each demo plays a scripted cursor over a mock drawing sheet: it picks a tool, clicks and
 * drags, and the drawing builds up exactly as it would on the real plan, with a caption
 * saying what to do at each moment. Nothing touches the user's plan. Every demo draws in a
 * 400 × 260 view box, so the same scene plays on the canvas or, with no room there, inside
 * the tour card.
 */

export type StudioDemoId = "room" | "drag" | "edit" | "camera" | "three-dimensional";

type Point = { x: number; y: number };
type Key = { t: number } & Point;
type Cue = { t: number; text: string };
/** The active tool over time, shown with the same icon it has in the ribbon. */
type ToolCue = Cue & { icon: LucideIcon };

const fa = (value: number, digits = 0) =>
  new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
/** Eased progress of the interval [from, to] at time t. */
const phase = (t: number, from: number, to: number) => ease(clamp01((t - from) / (to - from)));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** The cursor's position on its keyframed path. */
function along(keys: Key[], t: number): Point {
  if (t <= keys[0]!.t) return keys[0]!;
  for (let index = 1; index < keys.length; index += 1) {
    const from = keys[index - 1]!;
    const to = keys[index]!;
    if (t <= to.t) {
      const p = to.t === from.t ? 1 : phase(t, from.t, to.t);
      return { x: mix(from.x, to.x, p), y: mix(from.y, to.y, p) };
    }
  }
  return keys[keys.length - 1]!;
}

/** The last cue that has started by time t. */
function cueIndex(cues: Cue[], t: number) {
  let index = 0;
  cues.forEach((cue, at) => { if (cue.t <= t) index = at; });
  return index;
}
const cueAt = <T extends Cue>(cues: T[], t: number) => cues[cueIndex(cues, t)]!;

/** Seconds into the loop; frozen on an informative frame for reduced motion. */
function useLoopTime(duration: number, still: number) {
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [time, setTime] = useState(reduced ? still : 0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setTime(((now - start) / 1000) % duration);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, reduced]);
  return time;
}

/* ── Shared drawing pieces ────────────────────────────────────────── */

function Grid() {
  const lines = [];
  for (let x = 0; x <= 400; x += 20) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={260} strokeWidth={x % 100 === 0 ? 0.9 : 0.5} />);
  for (let y = 0; y <= 260; y += 20) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={400} y2={y} strokeWidth={y % 100 === 0 ? 0.9 : 0.5} />);
  return <g className="tour-demo-grid">{lines}</g>;
}

function Cursor({ at, pressed }: { at: Point; pressed: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} className="tour-demo-cursor">
      {pressed ? <circle r={7} className="tour-demo-press" /> : null}
      <path d="M0 0 L0 15.5 L4.2 11.6 L7.1 18 L9.8 16.8 L7 10.6 L12.4 10.6 Z" />
    </g>
  );
}

/** Expanding rings where the cursor clicks. */
function Clicks({ at, times, t }: { at: (time: number) => Point; times: number[]; t: number }) {
  return (
    <>
      {times.filter((time) => t >= time && t < time + 0.5).map((time) => {
        const p = (t - time) / 0.5;
        const point = at(time);
        return <circle key={time} cx={point.x} cy={point.y} r={4 + p * 14} className="tour-demo-ripple" style={{ opacity: 1 - p }} />;
      })}
    </>
  );
}

/** A ribbon tool button: the tool's own icon in a tile with its label underneath. */
function ToolButton({ x, y, icon: Icon, label, state }: { x: number; y: number; icon: LucideIcon; label: string; state?: "hover" | "active" }) {
  return (
    <g className={`tour-demo-tool-button${state ? ` is-${state}` : ""}`}>
      <rect x={x} y={y} width={38} height={38} rx={8} />
      <Icon x={x + 12} y={y + 5} size={14} className="tour-demo-icon" />
      <text x={x + 19} y={y + 32} textAnchor="middle">{label}</text>
    </g>
  );
}

/** A row of a ribbon menu: label and note on the right, its icon on the left. */
function MenuRow({ x, y, width, icon: Icon, label, note, size, hover }: {
  x: number; y: number; width: number; icon: LucideIcon; label: string; note?: string; size?: string; hover?: boolean;
}) {
  return (
    <g className={hover ? "tour-demo-menu-row is-hover" : "tour-demo-menu-row"}>
      <rect x={x} y={y} width={width} height={note ? 26 : 20} rx={5} />
      <text x={x + width - 6} y={y + (note ? 11 : 13.5)} textAnchor="end">{label}</text>
      {note ? <text x={x + width - 6} y={y + 21} textAnchor="end" className="tour-demo-menu-note">{note}</text> : null}
      {/* Dimensions sit apart from the Persian text, as in the app, so the two never reorder. */}
      {size ? <text x={x + 24} y={y + 16} className="tour-demo-menu-size">{size}</text> : null}
      <Icon x={x + 6} y={y + (note ? 6 : 3)} size={14} className="tour-demo-icon" />
    </g>
  );
}

function Walls({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} className="tour-demo-wall" />;
}

function KeyCaps({ keys, at, opacity }: { keys: string[]; at: Point; opacity: number }) {
  const widths = keys.map((key) => Math.max(22, key.length * 7.5 + 12));
  const offsets = widths.map((_, index) => widths.slice(0, index).reduce((sum, width) => sum + width + 5, 0));
  return (
    <g transform={`translate(${at.x} ${at.y})`} style={{ opacity }} className="tour-demo-keys">
      {keys.map((key, index) => (
        <g key={key} transform={`translate(${offsets[index]} 0)`}>
          <rect width={widths[index]} height={22} rx={5} />
          <text x={widths[index]! / 2} y={15} textAnchor="middle">{key}</text>
        </g>
      ))}
    </g>
  );
}

function rotateAround(point: Point, centre: Point, degrees: number): Point {
  const r = (degrees * Math.PI) / 180;
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return { x: centre.x + dx * Math.cos(r) - dy * Math.sin(r), y: centre.y + dx * Math.sin(r) + dy * Math.cos(r) };
}

/* ── Demo 1: a room with walls, a door, a window and a section type ─ */

const ROOM_A = { x: 80, y: 66 };
const ROOM_B = { x: 300, y: 200 };
const DOOR = { x: 190, y: 200 };
const WINDOW = { x: 150, y: 66 };
const INSIDE = { x: 236, y: 136 };
const PX_PER_M = 20;
/* The mini ribbon, in the real order from the right: select, wall, door, window. */
const SELECT_BUTTON = { x: 354, y: 4 };
const WALL_BUTTON = { x: 312, y: 4 };
const DOOR_BUTTON = { x: 270, y: 4 };
const WINDOW_BUTTON = { x: 228, y: 4 };
const ROOM_BUTTON = { x: 186, y: 4 };
const COVERAGE_BUTTON = { x: 144, y: 4 };
const buttonCentre = (button: Point) => ({ x: button.x + 19, y: button.y + 17 });
const RECT_ROW = { x: 300, y: 82 };
const PICKER = { x: 244, y: 96 };
const PICKER_ROW = { x: 320, y: 158 };
const ZONE_A = { x: 98, y: 88 };
const ZONE_B = { x: 172, y: 134 };
const REQUIRED_A = { x: 204, y: 146 };
const REQUIRED_B = { x: 282, y: 186 };
const TYPED = "کنترل";

const roomKeys: Key[] = [
  { t: 0, x: 200, y: 150 }, { t: 0.7, ...buttonCentre(WALL_BUTTON) }, { t: 1.2, ...RECT_ROW }, { t: 1.4, ...RECT_ROW },
  { t: 2, ...ROOM_A }, { t: 2.25, ...ROOM_A }, { t: 4.1, ...ROOM_B }, { t: 4.5, ...ROOM_B },
  { t: 5.2, ...buttonCentre(DOOR_BUTTON) }, { t: 5.4, ...buttonCentre(DOOR_BUTTON) }, { t: 6.1, ...DOOR }, { t: 6.9, ...DOOR },
  { t: 7.6, ...buttonCentre(WINDOW_BUTTON) }, { t: 7.8, ...buttonCentre(WINDOW_BUTTON) }, { t: 8.4, ...WINDOW }, { t: 8.9, ...WINDOW },
  { t: 9.6, ...buttonCentre(SELECT_BUTTON) }, { t: 9.8, ...buttonCentre(SELECT_BUTTON) }, { t: 10.4, ...INSIDE }, { t: 11.7, ...INSIDE },
  { t: 12, ...PICKER_ROW }, { t: 12.6, ...PICKER_ROW },
  { t: 13.3, ...buttonCentre(ROOM_BUTTON) }, { t: 13.7, ...buttonCentre(ROOM_BUTTON) },
  { t: 14.1, ...ZONE_A }, { t: 14.35, ...ZONE_A }, { t: 15.35, ...ZONE_B }, { t: 15.6, ...ZONE_B },
  { t: 16, ...buttonCentre(COVERAGE_BUTTON) }, { t: 16.35, ...buttonCentre(COVERAGE_BUTTON) },
  { t: 16.75, ...REQUIRED_A }, { t: 17, ...REQUIRED_A }, { t: 18.05, ...REQUIRED_B }, { t: 18.3, ...REQUIRED_B },
  { t: 19.1, x: 370, y: 236 }
];
const roomClicks = [1.3, 2.1, 4.2, 5.3, 6.2, 7.7, 8.5, 9.7, 10.5, 12.1, 13.6, 14.2, 15.5, 16.25, 16.9, 18.2];
const roomCues: Cue[] = [
  { t: 0, text: "روی ابزار «دیوار» بروید و «رسم مستطیل» را انتخاب کنید" },
  { t: 2, text: "روی گوشه اول فضا کلیک کنید" },
  { t: 2.3, text: "نشانگر را تا گوشه مقابل ببرید؛ ابعاد همان لحظه نمایش داده می‌شود" },
  { t: 4.2, text: "کلیک دوم: چهار دیوار با هم ساخته شد" },
  { t: 5, text: "ابزار «در» را بزنید و روی دیوار کلیک کنید" },
  { t: 7.4, text: "ابزار «پنجره» را بزنید و روی دیوار کلیک کنید" },
  { t: 9.4, text: "مرز قرمز یعنی فضا نوع ندارد؛ با «انتخاب» رویش کلیک کنید" },
  { t: 10.6, text: "همان‌جا نوع فضا را جست‌وجو و انتخاب کنید" },
  { t: 12.3, text: "فضا آماده است و در چک‌لیست تیک می‌خورد" },
  { t: 13.3, text: "برای بخش‌های بدون دیوار بسته، ابزار «فضا» را انتخاب کنید" },
  { t: 14.1, text: "دو گوشه محدوده را بزنید؛ ابعاد هنگام رسم کنار آن دیده می‌شود" },
  { t: 16, text: "برای نقطه‌ای که حتماً باید دیده شود، «ناحیه اجباری» را بزنید" },
  { t: 16.75, text: "محدوده ضروری را با دو کلیک رسم کنید؛ جانمایی هوشمند آن را پوشش می‌دهد" },
  { t: 18.25, text: "محدوده آبی یک فضا و محدوده سبز الزام قطعی پوشش است" }
];
const roomTools: ToolCue[] = [
  { t: 0, text: "انتخاب", icon: MousePointer2 },
  { t: 1.3, text: "دیوار › رسم مستطیل", icon: BrickWall },
  { t: 5.3, text: "در › معمولی تک‌لنگه", icon: DoorOpen },
  { t: 7.7, text: "پنجره", icon: Blinds },
  { t: 9.7, text: "انتخاب", icon: MousePointer2 },
  { t: 13.6, text: "فضا", icon: Square },
  { t: 16.25, text: "ناحیه اجباری", icon: Target }
];

function RoomScene({ t }: { t: number }) {
  const cursor = along(roomKeys, t);
  const dragging = t >= 2.25 && t < 4.2;
  const zoneDragging = t >= 14.35 && t < 15.5;
  const requiredDragging = t >= 17 && t < 18.2;
  const zoneVisible = t >= 14.2;
  const requiredVisible = t >= 16.9;
  const walls = t >= 4.2;
  const corner = dragging ? cursor : ROOM_B;
  const zoneCorner = t < 14.35 ? ZONE_A : zoneDragging ? cursor : ZONE_B;
  const requiredCorner = t < 17 ? REQUIRED_A : requiredDragging ? cursor : REQUIRED_B;
  const w = corner.x - ROOM_A.x;
  const h = corner.y - ROOM_A.y;
  const doorOpen = phase(t, 6.25, 6.9);
  const windowIn = phase(t, 8.55, 8.9);
  const wallMenu = t >= 0.75 && t < 1.4 ? phase(t, 0.75, 0.95) : 0;
  const picker = t >= 10.6 && t < 12.2 ? phase(t, 10.6, 10.8) : 0;
  const typedLength = Math.round(clamp01((t - 10.9) / 0.8) * TYPED.length);
  const typed = phase(t, 12.15, 12.6);
  const leafAngle = (-doorOpen * Math.PI) / 2;
  const hinge = { x: DOOR.x - 9, y: DOOR.y };
  const leafEnd = { x: hinge.x + 18 * Math.cos(leafAngle), y: hinge.y + 18 * Math.sin(leafAngle) };
  const activeTool = cueAt(roomTools, t).icon;
  const buttonState = (icon: LucideIcon, button: Point) => {
    const centre = buttonCentre(button);
    if (Math.hypot(cursor.x - centre.x, cursor.y - centre.y) < 16) return "hover" as const;
    return activeTool === icon ? "active" as const : undefined;
  };
  return (
    <>
      <ToolButton {...SELECT_BUTTON} icon={MousePointer2} label="انتخاب" state={buttonState(MousePointer2, SELECT_BUTTON)} />
      <ToolButton {...WALL_BUTTON} icon={BrickWall} label="دیوار" state={buttonState(BrickWall, WALL_BUTTON)} />
      <ToolButton {...DOOR_BUTTON} icon={DoorOpen} label="در" state={buttonState(DoorOpen, DOOR_BUTTON)} />
      <ToolButton {...WINDOW_BUTTON} icon={Blinds} label="پنجره" state={buttonState(Blinds, WINDOW_BUTTON)} />
      <ToolButton {...ROOM_BUTTON} icon={Square} label="فضا" state={buttonState(Square, ROOM_BUTTON)} />
      <ToolButton {...COVERAGE_BUTTON} icon={Target} label="اجباری" state={buttonState(Target, COVERAGE_BUTTON)} />

      {walls ? (
        <rect
          x={ROOM_A.x + 4} y={ROOM_A.y + 4} width={ROOM_B.x - ROOM_A.x - 8} height={ROOM_B.y - ROOM_A.y - 8}
          className={typed > 0 ? "tour-demo-room is-typed" : "tour-demo-room"}
          style={typed > 0 ? { opacity: 0.35 + typed * 0.65 } : undefined}
        />
      ) : null}
      {walls && typed === 0 ? <text x={176} y={136} textAnchor="middle" className="tour-demo-label is-warning">بدون نوع</text> : null}
      {typed > 0 ? <text x={176} y={136} textAnchor="middle" className="tour-demo-label is-room" style={{ opacity: typed }}>اتاق کنترل ✓</text> : null}
      {walls ? (
        <text x={176} y={153} textAnchor="middle" className="tour-demo-sublabel">
          {fa(((ROOM_B.x - ROOM_A.x) / PX_PER_M) * ((ROOM_B.y - ROOM_A.y) / PX_PER_M), 1)} متر مربع
        </text>
      ) : null}
      {dragging ? <rect x={ROOM_A.x} y={ROOM_A.y} width={Math.max(0, w)} height={Math.max(0, h)} className="tour-demo-draft" /> : null}
      {walls ? <Walls x={ROOM_A.x} y={ROOM_A.y} w={ROOM_B.x - ROOM_A.x} h={ROOM_B.y - ROOM_A.y} /> : null}
      {dragging && w > 10 ? (
        <g transform={`translate(${corner.x + 10} ${corner.y + 16})`} className="tour-demo-dim">
          <rect x={-2} y={-11} width={86} height={16} rx={4} />
          <text x={41} y={1} textAnchor="middle">{fa(w / PX_PER_M, 1)} × {fa(h / PX_PER_M, 1)} متر</text>
        </g>
      ) : null}
      {doorOpen > 0 ? (
        <g className="tour-demo-door">
          <line x1={DOOR.x - 9} y1={DOOR.y} x2={DOOR.x + 9} y2={DOOR.y} className="tour-demo-gap" />
          <path d={`M${hinge.x + 18} ${hinge.y} A18 18 0 0 0 ${leafEnd.x} ${leafEnd.y}`} className="tour-demo-swing" />
          <line x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} className="tour-demo-leaf" />
        </g>
      ) : null}
      {windowIn > 0 ? (
        <g style={{ opacity: windowIn }}>
          <line x1={WINDOW.x - 20} y1={WINDOW.y} x2={WINDOW.x + 20} y2={WINDOW.y} className="tour-demo-gap" />
          <line x1={WINDOW.x - 20} y1={WINDOW.y} x2={WINDOW.x + 20} y2={WINDOW.y} className="tour-demo-window" />
        </g>
      ) : null}

      {zoneVisible ? (
        <g>
          <rect
            x={ZONE_A.x}
            y={ZONE_A.y}
            width={Math.max(0, zoneCorner.x - ZONE_A.x)}
            height={Math.max(0, zoneCorner.y - ZONE_A.y)}
            className={zoneDragging ? "tour-demo-zone is-draft" : "tour-demo-zone"}
          />
          {!zoneDragging ? <text x={(ZONE_A.x + ZONE_B.x) / 2} y={(ZONE_A.y + ZONE_B.y) / 2 + 3} textAnchor="middle" className="tour-demo-zone-label">فضا</text> : null}
          {zoneDragging && zoneCorner.x - ZONE_A.x > 10 ? (
            <g transform={`translate(${zoneCorner.x + 7} ${zoneCorner.y + 14})`} className="tour-demo-dim">
              <rect x={-2} y={-11} width={78} height={16} rx={4} />
              <text x={37} y={1} textAnchor="middle">{fa((zoneCorner.x - ZONE_A.x) / PX_PER_M, 1)} × {fa((zoneCorner.y - ZONE_A.y) / PX_PER_M, 1)} متر</text>
            </g>
          ) : null}
        </g>
      ) : null}

      {requiredVisible ? (
        <g>
          <rect
            x={REQUIRED_A.x}
            y={REQUIRED_A.y}
            width={Math.max(0, requiredCorner.x - REQUIRED_A.x)}
            height={Math.max(0, requiredCorner.y - REQUIRED_A.y)}
            className={requiredDragging ? "tour-demo-required is-draft" : "tour-demo-required"}
          />
          {!requiredDragging ? <text x={(REQUIRED_A.x + REQUIRED_B.x) / 2} y={(REQUIRED_A.y + REQUIRED_B.y) / 2 + 3} textAnchor="middle" className="tour-demo-required-label">پوشش ضروری</text> : null}
          {requiredDragging && requiredCorner.x - REQUIRED_A.x > 10 ? (
            <g transform={`translate(${requiredCorner.x + 7} ${requiredCorner.y + 14})`} className="tour-demo-dim">
              <rect x={-2} y={-11} width={78} height={16} rx={4} />
              <text x={37} y={1} textAnchor="middle">{fa((requiredCorner.x - REQUIRED_A.x) / PX_PER_M, 1)} × {fa((requiredCorner.y - REQUIRED_A.y) / PX_PER_M, 1)} متر</text>
            </g>
          ) : null}
        </g>
      ) : null}

      {wallMenu > 0 ? (
        <g className="tour-demo-menu" style={{ opacity: wallMenu }}>
          <rect x={236} y={46} width={114} height={52} rx={8} />
          <MenuRow x={240} y={50} width={106} icon={Minus} label="دیوار خطی" />
          <MenuRow x={240} y={72} width={106} icon={Square} label="رسم مستطیل" hover={t >= 1.15} />
        </g>
      ) : null}

      {picker > 0 ? (
        <g className="tour-demo-menu tour-demo-picker" style={{ opacity: picker }}>
          <rect x={PICKER.x} y={PICKER.y} width={148} height={100} rx={9} />
          <text x={PICKER.x + 140} y={PICKER.y + 15} textAnchor="end" className="tour-demo-picker-title">این فضا هنوز نوع ندارد</text>
          <rect x={PICKER.x + 6} y={PICKER.y + 22} width={136} height={20} rx={6} className="tour-demo-search" />
          <Search x={PICKER.x + 10} y={PICKER.y + 26} size={12} className="tour-demo-icon is-muted" />
          <text x={PICKER.x + 136} y={PICKER.y + 36} textAnchor="end">{TYPED.slice(0, typedLength)}{t < 11.8 ? "|" : ""}</text>
          {typedLength > 0 ? (
            <>
              <rect x={PICKER.x + 4} y={PICKER.y + 50} width={140} height={22} rx={6} className={t >= 11.9 ? "is-hover" : "tour-demo-option"} />
              <text x={PICKER.x + 136} y={PICKER.y + 65} textAnchor="end">اتاق کنترل</text>
              <text x={PICKER.x + 10} y={PICKER.y + 65} className="tour-demo-chip-critical">حیاتی</text>
              <text x={PICKER.x + 136} y={PICKER.y + 89} textAnchor="end">اتاق کنترل تردد</text>
              <text x={PICKER.x + 10} y={PICKER.y + 89} className="tour-demo-chip-important">مهم</text>
            </>
          ) : (
            <text x={PICKER.x + 136} y={PICKER.y + 65} textAnchor="end" className="tour-demo-menu-note">پیشنهادها و جست‌وجو</text>
          )}
        </g>
      ) : null}
      <Clicks at={(time) => along(roomKeys, time)} times={roomClicks} t={t} />
      <Cursor at={cursor} pressed={dragging || zoneDragging || requiredDragging} />
    </>
  );
}

/* ── Demo 2: drag a ready-made element onto the plan and rotate it ── */

const CAR = { x: 170, y: 176 };
const CAR_BUTTON = { x: 338, y: 4 };
const CAR_CHIP = buttonCentre(CAR_BUTTON);
const ROW = { x: 290, y: 78 };
const CAR_HANDLE_OFFSET = 30;
const dragKeys: Key[] = [
  { t: 0, x: 200, y: 160 }, { t: 0.9, ...CAR_CHIP }, { t: 1.5, ...CAR_CHIP }, { t: 1.9, ...ROW }, { t: 2.05, ...ROW },
  { t: 3.8, ...CAR }, { t: 4.4, ...CAR }, { t: 5.1, x: CAR.x, y: CAR.y - CAR_HANDLE_OFFSET }, { t: 5.3, x: CAR.x, y: CAR.y - CAR_HANDLE_OFFSET },
  // 5.3–6.8: the cursor rides the handle as the car turns.
  { t: 7.3, x: 300, y: 120 }, { t: 7.9, ...CAR_CHIP }, { t: 8.6, ...CAR_CHIP }
];
const dragCues: Cue[] = [
  { t: 0, text: "نشانگر را روی دسته «خودرو» نگه دارید تا انواع با ابعاد واقعی باز شود" },
  { t: 1.9, text: "مورد را بگیرید و روی نقشه بکشید" },
  { t: 3.9, text: "رها کنید؛ با ابعاد واقعی روی نقشه می‌نشیند" },
  { t: 5.1, text: "با دستگیره نارنجی بچرخانید" },
  { t: 7, text: "یا فقط روی دسته کلیک کنید تا آخرین مورد همان‌جا اضافه شود" }
];
const dragTools: ToolCue[] = [{ t: 0, text: "عناصر آماده › خودرو", icon: CarFront }];

function Car({ at, angle, scale = 1 }: { at: Point; angle: number; scale?: number }) {
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${angle}) scale(${scale})`} className="tour-demo-car">
      <rect x={-40} y={-16} width={80} height={32} rx={9} />
      <rect x={6} y={-12} width={14} height={24} rx={3} className="tour-demo-glass" />
      <rect x={-28} y={-12} width={10} height={24} rx={3} className="tour-demo-glass" />
    </g>
  );
}

/** The ribbon category button, with the chevron that marks its menu. */
function CategoryButton({ hover }: { hover: boolean }) {
  return (
    <g>
      <ToolButton {...CAR_BUTTON} icon={CarFront} label="خودرو" state={hover ? "hover" : undefined} />
      <ChevronDown x={CAR_BUTTON.x + 2} y={CAR_BUTTON.y + 25} size={8} className="tour-demo-icon is-muted" />
    </g>
  );
}

function DragScene({ t }: { t: number }) {
  const rotating = t >= 5.3 && t < 6.8;
  const angle = -35 * phase(t, 5.3, 6.8);
  const handle = rotateAround({ x: CAR.x, y: CAR.y - CAR_HANDLE_OFFSET }, CAR, angle);
  const cursor = rotating || (t >= 6.8 && t < 6.85) ? handle : along(dragKeys, t);
  // The menu opens on hover and closes once the item is being dragged out of it.
  const menu = t >= 0.95 && t < 2.6 ? phase(t, 0.95, 1.2) * (1 - phase(t, 2.3, 2.6)) : 0;
  const carrying = t >= 2.05 && t < 3.9;
  const placed = t >= 3.9;
  const selected = t >= 3.9 && t < 7;
  const second = phase(t, 8.65, 8.95);
  return (
    <>
      <rect x={40} y={96} width={330} height={150} rx={4} className="tour-demo-lot" />
      <text x={362} y={238} textAnchor="end" className="tour-demo-sublabel">محوطه پارکینگ</text>
      <CategoryButton hover={(t >= 0.8 && t < 2.3) || t >= 7.8} />
      {menu > 0 ? (
        <g className="tour-demo-menu" style={{ opacity: menu }}>
          <rect x={176} y={46} width={204} height={116} rx={9} />
          {/* The menu's title row, as in the app: the category icon and how to add. */}
          <CarFront x={358} y={52} size={14} className="tour-demo-icon is-brand" />
          <text x={352} y={60} textAnchor="end" className="tour-demo-picker-title">افزودن خودرو</text>
          <text x={352} y={70} textAnchor="end" className="tour-demo-menu-note">کلیک کنید یا روی نقشه بکشید</text>
          <MenuRow x={180} y={76} width={196} icon={Plus} label="خودروی سواری" note="سدان شهری" size="4.5 × 1.8 × 1.45 m" hover={t >= 1.8} />
          <MenuRow x={180} y={104} width={196} icon={Plus} label="شاسی‌بلند" note="خودروی SUV" size="4.8 × 1.95 × 1.8 m" />
          <MenuRow x={180} y={132} width={196} icon={Plus} label="وانت" note="کابین و فضای بار" size="5.3 × 1.9 × 1.75 m" />
        </g>
      ) : null}
      {placed ? <Car at={CAR} angle={angle} /> : null}
      {selected ? (
        <g transform={`translate(${CAR.x} ${CAR.y}) rotate(${angle})`}>
          <rect x={-45} y={-21} width={90} height={42} rx={11} className="tour-demo-selection" />
          <line x1={0} y1={-21} x2={0} y2={-CAR_HANDLE_OFFSET} className="tour-demo-handle-stem" />
          <circle cx={0} cy={-CAR_HANDLE_OFFSET} r={5} className="tour-demo-handle" />
        </g>
      ) : null}
      {second > 0 ? <Car at={{ x: 290, y: 206 }} angle={0} scale={0.6 + second * 0.4} /> : null}
      {carrying ? (
        // The same drag label the app shows under the pointer.
        <g transform={`translate(${along(dragKeys, t).x - 12} ${along(dragKeys, t).y - 12})`} className="tour-demo-drag-ghost">
          <rect width={84} height={18} rx={9} />
          <text x={42} y={12.5} textAnchor="middle">خودروی سواری</text>
        </g>
      ) : null}
      <Clicks at={(time) => along(dragKeys, time)} times={[2.05, 8.6]} t={t} />
      <Cursor at={cursor} pressed={carrying || rotating} />
    </>
  );
}

/* ── Demo 3: select, move, rotate, copy, delete and zoom ─────────── */

const BOX_START = { x: 130, y: 112 };
const BOX_MOVED = { x: 205, y: 150 };
const BOX_COPY = { x: 290, y: 100 };
const BOX_HANDLE_OFFSET = 26;
const editKeys: Key[] = [
  { t: 0, x: 260, y: 30 }, { t: 0.9, ...BOX_START }, { t: 1.2, ...BOX_START }, { t: 2.5, ...BOX_MOVED }, { t: 2.8, ...BOX_MOVED },
  { t: 3.3, x: BOX_MOVED.x, y: BOX_MOVED.y - BOX_HANDLE_OFFSET }, { t: 3.4, x: BOX_MOVED.x, y: BOX_MOVED.y - BOX_HANDLE_OFFSET },
  // 3.4–4.6: riding the handle.
  { t: 5.4, ...BOX_COPY }, { t: 9.6, ...BOX_COPY }
];
const editCues: Cue[] = [
  { t: 0, text: "با ابزار «انتخاب» روی عنصر کلیک کنید" },
  { t: 1.1, text: "بدنه را بکشید تا جابه‌جا شود" },
  { t: 2.7, text: "دستگیره نارنجی را بکشید تا بچرخد" },
  { t: 4.9, text: "Ctrl+C و سپس Ctrl+V: یک نسخه در محل نشانگر" },
  { t: 7, text: "Delete: حذف عنصر انتخاب‌شده" },
  { t: 8.1, text: "چرخ ماوس: زوم · کلیک راست و کشیدن: جابه‌جایی نقشه" }
];
const editTools: ToolCue[] = [{ t: 0, text: "انتخاب", icon: MousePointer2 }];

function Shelf({ at, angle, selected, opacity = 1, scale = 1 }: { at: Point; angle: number; selected: boolean; opacity?: number; scale?: number }) {
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${angle}) scale(${scale})`} style={{ opacity }}>
      <rect x={-32} y={-12} width={64} height={24} rx={3} className="tour-demo-shelf" />
      <text x={0} y={4} textAnchor="middle" className="tour-demo-sublabel">قفسه</text>
      {selected ? (
        <>
          <rect x={-37} y={-17} width={74} height={34} rx={5} className="tour-demo-selection" />
          <line x1={0} y1={-17} x2={0} y2={-BOX_HANDLE_OFFSET} className="tour-demo-handle-stem" />
          <circle cx={0} cy={-BOX_HANDLE_OFFSET} r={5} className="tour-demo-handle" />
        </>
      ) : null}
    </g>
  );
}

function EditScene({ t }: { t: number }) {
  const moving = t >= 1.2 && t < 2.5;
  const rotating = t >= 3.4 && t < 4.6;
  const angle = 40 * phase(t, 3.4, 4.6);
  const boxAt = t < 1.2 ? BOX_START : moving ? along(editKeys, t) : BOX_MOVED;
  const handle = rotateAround({ x: BOX_MOVED.x, y: BOX_MOVED.y - BOX_HANDLE_OFFSET }, BOX_MOVED, angle);
  const cursor = rotating ? handle : along(editKeys, t);
  const copy = phase(t, 6.05, 6.35) * (1 - phase(t, 7.35, 7.7));
  const zoom = 1 + 0.12 * Math.sin(Math.PI * clamp01((t - 8.3) / 1.4));
  return (
    <g transform={`translate(200 130) scale(${zoom}) translate(-200 -130)`}>
      <Walls x={60} y={50} w={280} h={170} />
      <Shelf at={boxAt} angle={angle} selected={t >= 1 && t < 6.05} />
      {copy > 0 ? <Shelf at={BOX_COPY} angle={angle} selected scale={0.7 + 0.3 * copy} opacity={copy} /> : null}
      <KeyCaps keys={["Ctrl", "C"]} at={{ x: 76, y: 62 }} opacity={phase(t, 5, 5.2) * (1 - phase(t, 5.75, 5.9))} />
      <KeyCaps keys={["Ctrl", "V"]} at={{ x: 76, y: 62 }} opacity={phase(t, 5.9, 6.05) * (1 - phase(t, 6.7, 6.9))} />
      <KeyCaps keys={["Delete"]} at={{ x: 76, y: 62 }} opacity={phase(t, 7, 7.2) * (1 - phase(t, 7.9, 8.1))} />
      {t >= 8.2 && t < 9.8 ? (
        <g transform="translate(76 62)" className="tour-demo-keys">
          <rect width={58} height={22} rx={5} />
          <text x={29} y={15} textAnchor="middle">چرخ ماوس</text>
        </g>
      ) : null}
      <Clicks at={(time) => along(editKeys, time)} times={[1]} t={t} />
      <Cursor at={cursor} pressed={moving || rotating} />
    </g>
  );
}

/* ── Demo 4: drop a camera, see its DORI coverage and aim it ──────── */

const CAMERA = { x: 66, y: 88 };
const PALETTE = { x: 128, y: 28 };
const CAMERA_HANDLE = 30;
const cameraKeys: Key[] = [
  { t: 0, x: 220, y: 150 }, { t: 0.9, ...PALETTE }, { t: 1.05, ...PALETTE }, { t: 2.6, ...CAMERA }, { t: 3.3, ...CAMERA },
  { t: 4.4, x: CAMERA.x + CAMERA_HANDLE * Math.cos(Math.PI / 5), y: CAMERA.y + CAMERA_HANDLE * Math.sin(Math.PI / 5) },
  // 4.6–6.1: riding the handle.
  { t: 6.2, x: 230, y: 40 }, { t: 9.6, x: 230, y: 40 }
];
const cameraCues: Cue[] = [
  { t: 0, text: "نوع دستگاه را از «دستگاه‌های تعریف‌شده» بگیرید" },
  { t: 1.05, text: "روی نقشه بکشید و رها کنید" },
  { t: 2.7, text: "پوشش DORI با احتساب دیوارها و موانع رنگی نمایش داده می‌شود" },
  { t: 3.9, text: "دستگیره نارنجی را بکشید تا جهت دید بچرخد" },
  { t: 6.3, text: "یا کلیدهای [ و ] را بزنید: هر بار ۵ درجه" },
  { t: 7.6, text: "هر رنگ، سطح جزئیات تصویر در آن نقطه است" }
];
const cameraTools: ToolCue[] = [{ t: 0, text: "دستگاه‌های تعریف‌شده › دام سقفی", icon: Camera }];

/** An annular sector between two radii, angles in degrees clockwise from +x. */
function sector(c: Point, r0: number, r1: number, a0: number, a1: number) {
  const point = (r: number, a: number) => `${c.x + r * Math.cos((a * Math.PI) / 180)} ${c.y + r * Math.sin((a * Math.PI) / 180)}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${point(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${point(r1, a1)} L${point(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${point(r0, a0)} Z`;
}

function CameraScene({ t, clipId }: { t: number; clipId: string }) {
  const dragging = t >= 1.05 && t < 2.65;
  const placed = t >= 2.65;
  const grow = phase(t, 2.7, 3.5);
  const aimed = 36 + 24 * phase(t, 4.6, 6.1);
  const nudge = t >= 6.5 && t < 7.4 ? (t < 6.95 ? -5 : 0) : 0;
  const yaw = aimed + nudge;
  const handle = { x: CAMERA.x + CAMERA_HANDLE * Math.cos((yaw * Math.PI) / 180), y: CAMERA.y + CAMERA_HANDLE * Math.sin((yaw * Math.PI) / 180) };
  const rotating = t >= 4.6 && t < 6.1;
  const cursor = rotating ? handle : along(cameraKeys, t);
  const at = dragging ? cursor : CAMERA;
  // Disjoint rings: identification nearest the camera, detection farthest out.
  const radii = [0, 62, 118, 182, 260].map((r) => r * grow);
  const bands = doriLevels;
  const legend = phase(t, 7.6, 7.9);
  return (
    <>
      <defs>
        <clipPath id={clipId}><rect x={40} y={62} width={330} height={180} /></clipPath>
      </defs>
      {/* A card from «دستگاه‌های تعریف‌شده», as in the app: camera icon, name, specs, placed count. */}
      <g className={t >= 0.7 && t < 1.1 ? "tour-demo-palette-card is-hover" : "tour-demo-palette-card"}>
        <rect x={12} y={8} width={136} height={40} rx={8} />
        <Camera x={122} y={14} size={15} className="tour-demo-icon is-brand" />
        <text x={116} y={24} textAnchor="end" className="tour-demo-picker-title">دام سقفی</text>
        <text x={116} y={38} textAnchor="end" className="tour-demo-menu-note">4MP · 2.8mm · دام</text>
        <text x={20} y={33} className={placed ? "tour-demo-count is-placed" : "tour-demo-count"}>{fa(placed ? 1 : 0)} / {fa(2)}</text>
      </g>
      {placed && grow > 0 ? (
        <g clipPath={`url(#${clipId})`} style={{ opacity: 0.55 }}>
          {bands.map((band, index) => (
            <path key={band.key} d={sector(CAMERA, radii[3 - index]!, radii[4 - index]!, yaw - 45, yaw + 45)} fill={band.color} />
          ))}
        </g>
      ) : null}
      <Walls x={40} y={62} w={330} h={180} />
      <rect x={230} y={150} width={36} height={36} rx={3} className="tour-demo-shelf" />
      {placed || dragging ? (
        <g transform={`translate(${at.x} ${at.y}) rotate(${placed ? yaw : 30})`} style={{ opacity: dragging ? 0.75 : 1 }}>
          <circle r={8} className="tour-demo-camera-body" />
          <rect x={4} y={-3} width={9} height={6} rx={2} className="tour-demo-camera-lens" />
        </g>
      ) : null}
      {placed && t >= 3.8 && t < 7.5 ? (
        <>
          <line x1={CAMERA.x} y1={CAMERA.y} x2={handle.x} y2={handle.y} className="tour-demo-handle-stem" />
          <circle cx={handle.x} cy={handle.y} r={5} className="tour-demo-handle" />
        </>
      ) : null}
      <KeyCaps keys={["[", "]"]} at={{ x: 300, y: 70 }} opacity={phase(t, 6.3, 6.5) * (1 - phase(t, 7.3, 7.5))} />
      {legend > 0 ? (
        <g style={{ opacity: legend }} className="tour-demo-legend">
          <rect x={250} y={196} width={114} height={40} rx={7} />
          {[...doriLevels].reverse().map((level, index) => (
            <g key={level.key} transform={`translate(${352 - (index % 2) * 54} ${210 + Math.floor(index / 2) * 16})`}>
              <rect x={-2} y={-7} width={8} height={8} rx={2} fill={level.color} />
              <text x={-6} y={0} textAnchor="end">{level.label}</text>
            </g>
          ))}
        </g>
      ) : null}
      <Clicks at={(time) => along(cameraKeys, time)} times={[1.05]} t={t} />
      <Cursor at={cursor} pressed={dragging || rotating} />
    </>
  );
}

/* ── Demo 5: switch the completed example to the app's real 3D renderer ── */

const threeDimensionalCues: Cue[] = [
  { t: 0, text: "این همان پلان آماده آموزش است؛ ابتدا آن را از بالا می‌بینید" },
  { t: 1.4, text: "روی «نمای سه‌بعدی» بزنید" },
  { t: 2.5, text: "همان دیوارها، در، پنجره و تجهیزات حالا با حجم واقعی دیده می‌شوند" },
  { t: 5.2, text: "نما را بکشید تا دور طرح بچرخد و چیدمان را از هر زاویه بررسی کنید" },
  { t: 8.1, text: "محدوده آبی فضا و محدوده سبز پوشش ضروری در نمای سه‌بعدی هم حفظ می‌شوند" }
];

const threeDimensionalTools: ToolCue[] = [
  { t: 0, text: "نمای نقشه", icon: Grid3x3 },
  { t: 2.25, text: "نمای سه‌بعدی", icon: Move3d }
];

/**
 * The geometry intentionally mirrors the room built in the first tutorial animation.
 * Rendering it through PlanCanvas keeps every wall, opening and ready-made object visually
 * identical to the user's actual designer instead of maintaining a second mock 3D style.
 */
const THREE_DIMENSIONAL_FLOOR: FloorPlan = {
  id: "tour-control-room",
  name: "طبقه همکف",
  elevationM: 0,
  heightM: 3.2,
  walls: [
    { id: "tour-wall-north", a: { x: -5.5, z: -3.4 }, b: { x: 5.5, z: -3.4 }, heightM: 3, thicknessM: 0.2, blocksView: true },
    { id: "tour-wall-east", a: { x: 5.5, z: -3.4 }, b: { x: 5.5, z: 3.4 }, heightM: 3, thicknessM: 0.2, blocksView: true },
    { id: "tour-wall-south", a: { x: 5.5, z: 3.4 }, b: { x: -5.5, z: 3.4 }, heightM: 3, thicknessM: 0.2, blocksView: true },
    { id: "tour-wall-west", a: { x: -5.5, z: 3.4 }, b: { x: -5.5, z: -3.4 }, heightM: 3, thicknessM: 0.2, blocksView: true }
  ],
  doors: [
    {
      id: "tour-door",
      wallId: "tour-wall-south",
      type: "door",
      variant: "single-solid",
      offset: 0.5,
      widthM: 1.4,
      heightM: 2.2,
      hinge: "start",
      swingDirection: "inward",
      openAngleDeg: 82,
      blocksView: true
    },
    {
      id: "tour-window",
      wallId: "tour-wall-north",
      type: "window",
      offset: 0.32,
      widthM: 2.2,
      heightM: 1.2,
      sillHeightM: 0.9,
      hinge: "start",
      openAngleDeg: 0,
      blocksView: true
    }
  ],
  obstacles: [
    {
      id: "tour-console",
      label: "کنسول مانیتورینگ",
      kind: "equipment",
      variant: "monitoring-console",
      center: { x: 1.5, z: -0.35 },
      widthM: 2.2,
      depthM: 0.85,
      heightM: 1.55,
      rotationDeg: 90,
      blocksView: true
    },
    {
      id: "tour-chair",
      label: "صندلی اپراتور",
      kind: "seating",
      variant: "office-chair",
      center: { x: 0.35, z: -0.35 },
      widthM: 0.6,
      depthM: 0.6,
      heightM: 1.1,
      rotationDeg: 90,
      blocksView: false
    },
    {
      id: "tour-cabinet",
      label: "کمد بایگانی",
      kind: "furniture",
      variant: "filing-cabinet",
      center: { x: 4.65, z: -2.75 },
      widthM: 0.9,
      depthM: 0.5,
      heightM: 1.6,
      rotationDeg: 0,
      blocksView: true
    }
  ],
  cameras: [],
  rooms: [{
    id: "tour-room",
    name: "اتاق کنترل",
    sectionTypeId: "control-room.operator",
    boundarySource: "detected",
    wallIds: ["tour-wall-north", "tour-wall-east", "tour-wall-south", "tour-wall-west"],
    polygon: [
      { x: -5.4, z: -3.3 },
      { x: 5.4, z: -3.3 },
      { x: 5.4, z: 3.3 },
      { x: -5.4, z: 3.3 }
    ]
  }],
  coverageRequirements: [{
    id: "tour-required-zone",
    label: "ورودی اصلی",
    origin: "user",
    satisfied: false,
    polygon: [
      { x: -1.25, z: 1.55 },
      { x: 1.25, z: 1.55 },
      { x: 1.25, z: 3.05 },
      { x: -1.25, z: 3.05 }
    ]
  }]
};

const threeDimensionalCursorKeys: Key[] = [
  { t: 0, x: 198, y: 140 },
  { t: 1.35, x: 286, y: 28 },
  { t: 2.25, x: 286, y: 28 },
  { t: 2.6, x: 286, y: 28 },
  { t: 4.1, x: 200, y: 132 },
  { t: 5.1, x: 200, y: 132 },
  { t: 6.8, x: 245, y: 158 },
  { t: 7.15, x: 245, y: 158 },
  { t: 10.2, x: 360, y: 224 }
];

function ThreeDimensionalScene({ t }: { t: number }) {
  const viewMode: PlanViewMode = t >= 2.25 ? "orbit" : "top";
  const cursor = along(threeDimensionalCursorKeys, t);
  const rotating = t >= 5.1 && t < 6.8;
  return (
    <div className="tour-demo-live-stage" aria-hidden="true">
      <PlanCanvas
        floor={THREE_DIMENSIONAL_FLOOR}
        tool="select"
        wallDrawMode="line"
        doorVariant="single-solid"
        viewMode={viewMode}
        selection={emptySelection}
        snapM={0.5}
        defaults={defaultPlanDefaults}
        showCoverage={false}
        showRoomNames
        showRoomTypes
        palette="studio"
        readOnly
        presentation={{ topZoom: 1.18, orbitScale: 0.62, autoRotate: viewMode === "orbit" }}
        onSelect={() => undefined}
        onFloorChange={() => undefined}
        onHint={() => undefined}
      />
      <div className="tour-demo-view-switch" dir="rtl">
        <span className={viewMode === "top" ? "is-active" : undefined}><Grid3x3 size={13} />نمای نقشه</span>
        <span className={viewMode === "orbit" ? "is-active" : undefined}><Move3d size={13} />نمای سه‌بعدی</span>
      </div>
      <svg viewBox="0 0 400 260" className="tour-demo-live-overlay">
        <Clicks at={(time) => along(threeDimensionalCursorKeys, time)} times={[2.25]} t={t} />
        <Cursor at={cursor} pressed={rotating} />
      </svg>
      {viewMode === "orbit" ? (
        <span className="tour-demo-3d-note"><Move3d size={13} />برای چرخاندن، روی نما بکشید</span>
      ) : null}
    </div>
  );
}

/* ── Player ───────────────────────────────────────────────────────── */

const demos: Record<StudioDemoId, { duration: number; still: number; cues: Cue[]; tools: ToolCue[] }> = {
  room: { duration: 20, still: 18.7, cues: roomCues, tools: roomTools },
  drag: { duration: 10, still: 6.9, cues: dragCues, tools: dragTools },
  edit: { duration: 10.6, still: 4.8, cues: editCues, tools: editTools },
  camera: { duration: 10, still: 7.9, cues: cameraCues, tools: cameraTools },
  "three-dimensional": { duration: 11, still: 8.6, cues: threeDimensionalCues, tools: threeDimensionalTools }
};

/** Fade the scene in and out at the loop seam. */
const loopOpacity = (t: number, duration: number) => Math.min(phase(t, 0, 0.3), 1 - phase(t, duration - 0.6, duration));

export function StudioTourDemo({ demo, compact = false }: { demo: StudioDemoId; compact?: boolean }) {
  const spec = demos[demo];
  const t = useLoopTime(spec.duration, spec.still);
  const clipId = useId().replace(/:/g, "");
  const cue = cueIndex(spec.cues, t);
  const tool = cueAt(spec.tools, t);
  const ToolIcon = tool.icon;
  return (
    <figure className={compact ? "tour-demo is-compact" : "tour-demo"} aria-label={`نمایش آموزشی: ${spec.cues.map((item) => item.text).join("؛ ")}`}>
      <header className="tour-demo-head">
        <span className="tour-demo-tool"><ToolIcon size={13} aria-hidden="true" />{tool.text}</span>
        <span className="tour-demo-badge"><PlayCircle size={13} aria-hidden="true" />نمایش آموزشی؛ نقشه شما تغییر نمی‌کند</span>
      </header>
      {demo === "three-dimensional" ? (
        <div className="tour-demo-live-wrap" style={{ opacity: loopOpacity(t, spec.duration) }}>
          <ThreeDimensionalScene t={t} />
        </div>
      ) : (
        <svg viewBox="0 0 400 260" className="tour-demo-stage" aria-hidden="true">
          <Grid />
          <g style={{ opacity: loopOpacity(t, spec.duration) }}>
            {demo === "room" ? <RoomScene t={t} /> : null}
            {demo === "drag" ? <DragScene t={t} /> : null}
            {demo === "edit" ? <EditScene t={t} /> : null}
            {demo === "camera" ? <CameraScene t={t} clipId={`tour-clip-${clipId}`} /> : null}
          </g>
        </svg>
      )}
      <figcaption className="tour-demo-caption" aria-hidden="true">
        <span className="tour-demo-step">{fa(cue + 1)}</span>
        <span key={cue}>{spec.cues[cue]!.text}</span>
        <span className="tour-demo-dots">
          {spec.cues.map((item, index) => <i key={item.t} className={index === cue ? "is-active" : index < cue ? "is-done" : undefined} />)}
        </span>
      </figcaption>
    </figure>
  );
}
