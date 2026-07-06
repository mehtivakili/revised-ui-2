"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalculatorShell, NumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

type PlannerTab = "top" | "side" | "lens";

const tool: DashboardTool = {
  slug: "planner",
  title: "میدان دید",
  subtitle: "میدان دید دوربین",
  description: "محاسبه زاویه دید، عرض صحنه، تراکم پیکسلی و فواصل DORI بر اساس مشخصات حسگر و لنز.",
  status: "ready",
  metric: "FOV / PPM",
  icon: "camera"
};

function angleOfView(sensorDimMm: number, focalMm: number) {
  if (!sensorDimMm || !focalMm) return 0;
  return 2 * Math.atan(sensorDimMm / (2 * focalMm));
}

function widthAtDistance(distanceM: number, fovRad: number) {
  return 2 * distanceM * Math.tan(fovRad / 2);
}

function calculatePlanner(params: { sensorW: number; sensorH: number; focal: number; hPixels: number; rangeM: number }) {
  const hFovRad = angleOfView(params.sensorW, params.focal);
  const vFovRad = angleOfView(params.sensorH, params.focal);
  const width = widthAtDistance(params.rangeM, hFovRad);
  const ppm = params.hPixels && width ? params.hPixels / width : 0;
  const distanceFor = (targetPpm: number) => {
    if (!params.hPixels || !hFovRad) return 0;
    const requiredWidth = params.hPixels / targetPpm;
    return requiredWidth / (2 * Math.tan(hFovRad / 2));
  };

  return {
    hFovRad,
    vFovRad,
    hFov: (hFovRad * 180) / Math.PI,
    vFov: (vFovRad * 180) / Math.PI,
    width,
    ppm,
    detection: distanceFor(25),
    observation: distanceFor(63),
    recognition: distanceFor(125),
    identification: distanceFor(250)
  };
}

function drawTopView(canvas: HTMLCanvasElement | null, hFovRad: number, rangeM: number) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#d9e2e8";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 25) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 25) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const origin = { x: 80, y: height - 80 };
  const radius = Math.min(width - origin.x - 24, height - 24);
  const half = hFovRad / 2;
  const leftAngle = -half;
  const rightAngle = half;

  context.fillStyle = "#172026";
  context.beginPath();
  context.arc(origin.x, origin.y, 7, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(15, 143, 97, 0.12)";
  context.strokeStyle = "#0f8f61";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(origin.x + radius * Math.cos(leftAngle), origin.y + radius * Math.sin(leftAngle));
  context.arc(origin.x, origin.y, radius, leftAngle, rightAngle);
  context.lineTo(origin.x, origin.y);
  context.fill();
  context.stroke();

  const rangePx = Math.min(radius, (rangeM / 30) * radius);
  context.setLineDash([6, 6]);
  context.strokeStyle = "#61707c";
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(origin.x + rangePx, origin.y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#172026";
  context.font = "13px Vazirmatn, Tahoma, sans-serif";
  context.fillText(`${((hFovRad * 180) / Math.PI).toFixed(1)}°`, origin.x + 12, origin.y + 20);
}

function drawSideView(canvas: HTMLCanvasElement | null, vFovRad: number, mountH: number, tiltDeg: number, rangeM: number) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#d9e2e8";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 25) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 25) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const groundY = height - 80;
  const origin = { x: 80, y: groundY - mountH * 10 };
  const radius = Math.min(width - origin.x - 24, height - 24);
  const direction = (-tiltDeg * Math.PI) / 180;
  const half = vFovRad / 2;
  const topRay = direction - half;
  const bottomRay = direction + half;

  context.fillStyle = "#172026";
  context.beginPath();
  context.arc(origin.x, origin.y, 7, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(15, 118, 110, 0.12)";
  context.strokeStyle = "#0f766e";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(origin.x + radius * Math.cos(topRay), origin.y + radius * Math.sin(topRay));
  context.arc(origin.x, origin.y, radius, topRay, bottomRay);
  context.lineTo(origin.x, origin.y);
  context.fill();
  context.stroke();

  context.strokeStyle = "#61707c";
  context.beginPath();
  context.moveTo(0, groundY);
  context.lineTo(width, groundY);
  context.stroke();

  const rangePx = Math.min(radius, (rangeM / 30) * radius);
  context.setLineDash([6, 6]);
  context.beginPath();
  context.moveTo(origin.x + rangePx, groundY - 40);
  context.lineTo(origin.x + rangePx, groundY + 40);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#172026";
  context.font = "13px Vazirmatn, Tahoma, sans-serif";
  context.fillText(`${tiltDeg.toFixed(0)}°`, origin.x + 12, origin.y + 20);
}

export default function PlannerPage() {
  const [sensorW, setSensorW] = useState(5.6);
  const [sensorH, setSensorH] = useState(3.1);
  const [focal, setFocal] = useState(4);
  const [pixels, setPixels] = useState(1920);
  const [mountH, setMountH] = useState(3);
  const [tilt, setTilt] = useState(15);
  const [range, setRange] = useState(10);
  const [activeTab, setActiveTab] = useState<PlannerTab>("top");
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const sideCanvasRef = useRef<HTMLCanvasElement>(null);
  const result = useMemo(() => calculatePlanner({ sensorW, sensorH, focal, hPixels: pixels, rangeM: range }), [sensorW, sensorH, focal, pixels, range]);

  useEffect(() => {
    drawTopView(topCanvasRef.current, result.hFovRad, range);
    drawSideView(sideCanvasRef.current, result.vFovRad, mountH, tilt, range);
  }, [result.hFovRad, result.vFovRad, range, mountH, tilt, activeTab]);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="عرض حسگر" value={sensorW} onChange={setSensorW} min={0.1} step={0.01} unit="mm" />
        <NumberInput label="ارتفاع حسگر" value={sensorH} onChange={setSensorH} min={0.1} step={0.01} unit="mm" />
        <NumberInput label="فاصله کانونی" value={focal} onChange={setFocal} min={0.5} step={0.1} unit="mm" />
        <NumberInput label="رزولوشن افقی" value={pixels} onChange={setPixels} min={100} step={1} unit="px" />
        <NumberInput label="ارتفاع نصب" value={mountH} onChange={setMountH} min={0} step={0.1} unit="m" />
        <NumberInput label="زاویه نصب" value={tilt} onChange={setTilt} min={-30} max={89} step={1} unit="درجه" />
      </div>

      <section className="planner-range-panel">
        <label htmlFor="planner-range">فاصله مورد نظر</label>
        <input id="planner-range" type="range" min={1} max={30} step={1} value={range} onChange={(event) => setRange(Number(event.target.value))} />
        <output>{range} m</output>
      </section>

      <nav className="planner-tabs" aria-label="نمای میدان دید">
        {[
          { id: "top", label: "بالا" },
          { id: "side", label: "پهلو" },
          { id: "lens", label: "لنز" }
        ].map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id as PlannerTab)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "top" ? (
        <section className="planner-panel">
          <canvas ref={topCanvasRef} width={900} height={500} />
          <ResultGrid results={[
            { label: "زاویه دید افقی", value: formatNumber(result.hFov, 1), unit: "درجه" },
            { label: `عرض صحنه در ${range} m`, value: formatNumber(result.width, 2), unit: "m" },
            { label: "تراکم پیکسل", value: formatNumber(result.ppm), unit: "px/m" }
          ]} />
        </section>
      ) : null}

      {activeTab === "side" ? (
        <section className="planner-panel">
          <canvas ref={sideCanvasRef} width={900} height={500} />
          <ResultGrid results={[
            { label: "زاویه دید عمودی", value: formatNumber(result.vFov, 1), unit: "درجه" },
            { label: "ارتفاع نصب", value: formatNumber(mountH, 1), unit: "m" },
            { label: "زاویه نصب", value: formatNumber(tilt), unit: "درجه" }
          ]} />
        </section>
      ) : null}

      {activeTab === "lens" ? (
        <section className="planner-panel">
          <ResultGrid results={[
            { label: "زاویه دید افقی", value: formatNumber(result.hFov, 1), unit: "درجه" },
            { label: "زاویه دید عمودی", value: formatNumber(result.vFov, 1), unit: "درجه" },
            { label: `عرض صحنه در ${range} m`, value: formatNumber(result.width, 2), unit: "m" },
            { label: "فاصله تشخیص", value: formatNumber(result.detection, 1), unit: "m" },
            { label: "فاصله مشاهده", value: formatNumber(result.observation, 1), unit: "m" },
            { label: "فاصله شناسایی", value: formatNumber(result.recognition, 1), unit: "m" },
            { label: "فاصله تشخیص هویت", value: formatNumber(result.identification, 1), unit: "m" }
          ]} />
          <div className="planner-note">
            <h3>استاندارد تراکم پیکسل (IEC/EN 62676-4)</h3>
            <ul>
              <li>تشخیص ≈ 25 پیکسل/متر</li>
              <li>مشاهده ≈ 63 پیکسل/متر</li>
              <li>شناسایی ≈ 125 پیکسل/متر</li>
              <li>تشخیص هویت ≈ 250 پیکسل/متر</li>
            </ul>
          </div>
        </section>
      ) : null}
    </CalculatorShell>
  );
}
