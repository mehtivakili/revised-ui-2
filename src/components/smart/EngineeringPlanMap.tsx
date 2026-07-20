"use client";

import type { EngineeringMap } from "@/src/domain/catalog/types";

const mapColor = (ppm: number, blind: boolean) => {
  if (blind) return "rgba(71,85,105,.28)";
  if (ppm >= 250) return "rgba(22,163,74,.38)";
  if (ppm >= 125) return "rgba(234,179,8,.34)";
  if (ppm >= 62.5) return "rgba(249,115,22,.3)";
  return "rgba(239,68,68,.28)";
};

export function EngineeringPlanMap({ map }: { map: EngineeringMap }) {
  const sx = (value: number) => value / map.widthM * 1_000;
  const sy = (value: number) => value / map.heightM * 600;
  const cellWidth = 1_000 / map.gridColumns;
  const cellHeight = 600 / map.gridRows;

  return <section className="engineering-map-card">
    <div className="engineering-map-head"><div><span>نقشه پیشنهادی نصب</span><strong>{map.placements.length} دوربین · {map.blindSpotPercent.toFixed(1)}٪ نقاط کور اولیه</strong></div><div className="heatmap-legend"><span className="blind">نقطه کور</span><span className="low">کمتر از 62 PPM</span><span className="medium">125+ PPM</span><span className="high">250+ PPM</span></div></div>
    <div className="engineering-map-canvas">
      <svg viewBox="0 0 1000 600" role="img" aria-label="نقشه چند دوربینه، Heatmap تراکم پیکسلی و نقاط کور">
        <rect width="1000" height="600" rx="18" fill="#f6fafc" />
        {map.heatmap.map((cell, index) => <rect key={index} x={sx(cell.xM) - cellWidth / 2} y={sy(cell.yM) - cellHeight / 2} width={cellWidth + .5} height={cellHeight + .5} fill={mapColor(cell.ppm, cell.blind)} />)}
        {map.placements.map((camera) => <g key={camera.id}>
          <polygon points={camera.coveragePolygon.map((point) => `${sx(point.xM)},${sy(point.yM)}`).join(" ")} fill="rgba(14,116,144,.08)" stroke="rgba(14,116,144,.48)" strokeWidth="2" />
          <line x1={sx(camera.targetPlane.left.xM)} y1={sy(camera.targetPlane.left.yM)} x2={sx(camera.targetPlane.right.xM)} y2={sy(camera.targetPlane.right.yM)} stroke="#7c3aed" strokeWidth="4" strokeDasharray="8 5" />
          <circle cx={sx(camera.xM)} cy={sy(camera.yM)} r="10" fill="#075985" stroke="#fff" strokeWidth="4" />
          <text x={sx(camera.xM) + 14} y={sy(camera.yM) - 10} fontSize="16" fill="#15394c">{camera.zoneName}</text>
        </g>)}
      </svg>
    </div>
    <p>محدوده‌های آبی حاصل برخورد Frustum با صفحه زمین‌اند؛ خط بنفش صفحه هدف هر دوربین است. موقعیت‌ها به‌صورت خودکار پیشنهاد شده‌اند و برای نقشه اجرایی باید با پلان واقعی و موانع تطبیق داده شوند.</p>
  </section>;
}
