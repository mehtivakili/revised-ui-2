"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Shared pieces of the guided-tour demos: timing, the scripted cursor and click rings, and
 * mock ribbon controls drawn with the app's own icons. Scenes draw in a 400 × 260 view box.
 */

export type Point = { x: number; y: number };
export type Key = { t: number } & Point;
export type Cue = { t: number; text: string };
/** The active tool over time, shown with the same icon it has in the ribbon. */
export type ToolCue = Cue & { icon: LucideIcon };

export const fa = (value: number, digits = 0) =>
  new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
/** Eased progress of the interval [from, to] at time t. */
export const phase = (t: number, from: number, to: number) => ease(clamp01((t - from) / (to - from)));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** The cursor's position on its keyframed path. */
export function along(keys: Key[], t: number): Point {
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
export function cueIndex(cues: Cue[], t: number) {
  let index = 0;
  cues.forEach((cue, at) => { if (cue.t <= t) index = at; });
  return index;
}
export const cueAt = <T extends Cue>(cues: T[], t: number) => cues[cueIndex(cues, t)]!;

/**
 * Seconds since the scene started, from animation frames. Frozen on an informative frame
 * when the viewer prefers reduced motion; a playlist then does not advance by itself.
 */
export function useDemoClock(still: number) {
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [time, setTime] = useState(reduced ? still : 0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setTime((now - start) / 1000);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reduced]);
  return { time, reduced };
}

/* ── Shared drawing pieces ────────────────────────────────────────── */

export function Grid() {
  const lines = [];
  for (let x = 0; x <= 400; x += 20) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={260} strokeWidth={x % 100 === 0 ? 0.9 : 0.5} />);
  for (let y = 0; y <= 260; y += 20) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={400} y2={y} strokeWidth={y % 100 === 0 ? 0.9 : 0.5} />);
  return <g className="tour-demo-grid">{lines}</g>;
}

export function Cursor({ at, pressed }: { at: Point; pressed: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} className="tour-demo-cursor">
      {pressed ? <circle r={7} className="tour-demo-press" /> : null}
      <path d="M0 0 L0 15.5 L4.2 11.6 L7.1 18 L9.8 16.8 L7 10.6 L12.4 10.6 Z" />
    </g>
  );
}

/** Expanding rings where the cursor clicks. */
export function Clicks({ at, times, t }: { at: (time: number) => Point; times: number[]; t: number }) {
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
export function ToolButton({ x, y, icon: Icon, label, state, width = 38 }: {
  x: number; y: number; icon: LucideIcon; label: string; state?: "hover" | "active"; width?: number;
}) {
  return (
    <g className={`tour-demo-tool-button${state ? ` is-${state}` : ""}`}>
      <rect x={x} y={y} width={width} height={38} rx={8} />
      <Icon x={x + width / 2 - 7} y={y + 5} size={14} className="tour-demo-icon" />
      <text x={x + width / 2} y={y + 32} textAnchor="middle">{label}</text>
    </g>
  );
}

/** A row of a ribbon menu: label and note on the right, its icon on the left. */
export function MenuRow({ x, y, width, icon: Icon, label, note, size, hover }: {
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

export function Walls({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} className="tour-demo-wall" />;
}

export function KeyCaps({ keys, at, opacity }: { keys: string[]; at: Point; opacity: number }) {
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

export function rotateAround(point: Point, centre: Point, degrees: number): Point {
  const r = (degrees * Math.PI) / 180;
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return { x: centre.x + dx * Math.cos(r) - dy * Math.sin(r), y: centre.y + dx * Math.sin(r) + dy * Math.cos(r) };
}

export const buttonCentre = (button: Point) => ({ x: button.x + 19, y: button.y + 17 });

/** Fade a scene in and out at its seams. */
export const seamOpacity = (t: number, duration: number) => Math.min(phase(t, 0, 0.3), 1 - phase(t, duration - 0.6, duration));
