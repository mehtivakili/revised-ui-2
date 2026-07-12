"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalculatorShell, NumberInput, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

/* ─── tool metadata ─── */
const tool: DashboardTool = {
  slug: "lens-3d",
  title: "میدان دید",
  subtitle: "شبیه‌ساز سه‌بعدی دوربین",
  description: "شبیه‌سازی سه‌بعدی میدان دید دوربین با نمایش نواحی DORI، تراکم پیکسلی و زاویه دید.",
  status: "ready",
  metric: "3D / DORI",
  icon: "camera"
};

/* ─── Sensor presets ─── */
const sensorPresets = [
  { label: '1/4"', w: 3.6, h: 2.7 },
  { label: '1/3"', w: 4.8, h: 3.6 },
  { label: '1/2.7"', w: 5.37, h: 4.04 },
  { label: '1/2"', w: 6.4, h: 4.8 },
  { label: '1/1.8"', w: 7.18, h: 5.32 },
  { label: '2/3"', w: 8.8, h: 6.6 },
  { label: '1"', w: 12.8, h: 9.6 }
];

/* ─── Resolution presets ─── */
const resolutionPresets = [
  { label: "12MP (4000×3000)", w: 4000, h: 3000 },
  { label: "4K (3840×2160)", w: 3840, h: 2160 },
  { label: "6MP (3072×2048)", w: 3072, h: 2048 },
  { label: "5MP (2592×1944)", w: 2592, h: 1944 },
  { label: "4MP (2688×1520)", w: 2688, h: 1520 },
  { label: "4MP (2560×1440)", w: 2560, h: 1440 },
  { label: "3MP (2048×1536)", w: 2048, h: 1536 },
  { label: "1080p (1920×1080)", w: 1920, h: 1080 },
  { label: "720p (1280×720)", w: 1280, h: 720 },
  { label: "D1 (720×576)", w: 720, h: 576 }
];

/* ─── DORI zones (IEC 62676-4:2014) ─── */
const doriZones = [
  { id: "monitoring", label: "پایش", ppm: 12, color: "#3b82f6" },
  { id: "detection", label: "تشخیص", ppm: 25, color: "#06b6d4" },
  { id: "observation", label: "مشاهده", ppm: 62, color: "#22c55e" },
  { id: "recognition", label: "بازشناسی", ppm: 125, color: "#eab308" },
  { id: "identification", label: "شناسایی", ppm: 250, color: "#ef4444" }
];

/* ─── Calculation engine ─── */
interface CalcResult {
  hFovRad: number;
  vFovRad: number;
  hFovDeg: number;
  vFovDeg: number;
  sceneWidth: number;
  sceneHeight: number;
  slantRange: number;
  ppm: number;
  tiltDeg: number;
  doriDistances: { id: string; label: string; distance: number; color: string; ppm: number }[];
}

function calculate(params: {
  sensorW: number; sensorH: number;
  focal: number;
  resW: number;
  distance: number;
  camHeight: number;
  targetHeight: number;
}): CalcResult {
  const { sensorW, sensorH, focal, resW, distance, camHeight, targetHeight } = params;

  const hFovRad = 2 * Math.atan(sensorW / (2 * focal));
  const vFovRad = 2 * Math.atan(sensorH / (2 * focal));
  const hDiff = camHeight - targetHeight;
  const slantRange = Math.sqrt(distance * distance + hDiff * hDiff);
  const sceneWidth = slantRange * sensorW / focal;
  const sceneHeight = slantRange * sensorH / focal;
  const ppm = resW / sceneWidth;
  const tiltRad = Math.atan2(hDiff, distance);
  const tiltDeg = (tiltRad * 180) / Math.PI;

  const doriDistances = doriZones.map((zone) => {
    const d = (resW * focal) / (zone.ppm * sensorW);
    return { id: zone.id, label: zone.label, distance: d, color: zone.color, ppm: zone.ppm };
  });

  return { hFovRad, vFovRad, hFovDeg: (hFovRad * 180) / Math.PI, vFovDeg: (vFovRad * 180) / Math.PI, sceneWidth, sceneHeight, slantRange, ppm, tiltDeg, doriDistances };
}

/* ─── Three.js dynamic import & scene builder ─── */
type ThreeModule = typeof import("three");
type OrbitControlsModule = typeof import("three/examples/jsm/controls/OrbitControls.js");

export interface Lens3DHandles {
  setViewMode: (mode: "top" | "side" | "3d") => void;
}

function buildScene(
  THREE: ThreeModule,
  OrbitControlsMod: OrbitControlsModule,
  container: HTMLDivElement,
  params: {
    sensorW: number; sensorH: number; focal: number; resW: number;
    distance: number; camHeight: number; targetHeight: number;
  },
  handlesRef: React.MutableRefObject<Lens3DHandles | null>
) {
  const result = calculate(params);
  const width = container.clientWidth;
  const height = container.clientHeight;

  /* renderer */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xd8eaf3, 1);
  container.appendChild(renderer.domElement);

  /* scene */
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd8eaf3, 90, 220);

  /* camera */
  const cam = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);

  /* orbit controls */
  const controls = new OrbitControlsMod.OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2; // Don't go below ground
  controls.minDistance = 2;
  controls.maxDistance = 150;

  // Set initial 3D view
  const set3DView = () => {
    cam.position.set(-params.distance * 0.6, params.camHeight * 2.5, params.distance * 1.2);
    controls.target.set(params.distance, params.targetHeight / 2, 0);
  };
  set3DView();

  // Expose camera controls to React
  handlesRef.current = {
    setViewMode: (mode) => {
      if (mode === "top") {
        cam.position.set(params.distance / 2, Math.max(20, params.distance * 1.5), 0);
        controls.target.set(params.distance, params.targetHeight / 2, 0);
      } else if (mode === "side") {
        cam.position.set(params.distance / 2, params.targetHeight, Math.max(15, params.distance));
        controls.target.set(params.distance, params.targetHeight / 2, 0);
      } else {
        set3DView();
      }
      controls.update();
    }
  };

  /* ── ground grid ── */
  const gridSize = Math.max(100, params.distance * 4);
  const gridDivisions = Math.round(gridSize / 2);
  const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x79a8bf, 0xb7d1df);
  scene.add(grid);

  /* ambient + directional lights */
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  /* ── camera box (mount point) ── */
  const camBoxGeo = new THREE.BoxGeometry(0.4, 0.3, 0.5);
  const camBoxMat = new THREE.MeshStandardMaterial({ color: 0x5f7f95, metalness: 0.35, roughness: 0.42 });
  const camBox = new THREE.Mesh(camBoxGeo, camBoxMat);
  camBox.position.set(0, params.camHeight, 0);
  scene.add(camBox);

  /* camera pole */
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, params.camHeight, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x6d8798 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, params.camHeight / 2, 0);
  scene.add(pole);

  /* ── lens indicator line from camera ── */
  const lineMat = new THREE.LineBasicMaterial({ color: 0x4f7f98 });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, params.camHeight, 0),
    new THREE.Vector3(params.distance * 0.15, params.camHeight - (params.camHeight - params.targetHeight) * 0.15, 0)
  ]);
  scene.add(new THREE.Line(lineGeo, lineMat));

  /* ── build DORI frustum segments ── */
  const halfH = result.hFovRad / 2;

  // sort DORI distances from furthest to closest
  const sortedDori = [...result.doriDistances].sort((a, b) => b.distance - a.distance);

  let prevDist = 0;
  for (const zone of sortedDori.reverse()) {
    const nearDist = prevDist;
    const farDist = Math.min(zone.distance, gridSize / 2);
    if (farDist <= nearDist) { prevDist = farDist; continue; }

    const nearHalfW = nearDist * Math.tan(halfH);
    const farHalfW = farDist * Math.tan(halfH);

    const vertices = new Float32Array([
      nearDist, 0, -nearHalfW,
      nearDist, 0, nearHalfW,
      farDist, 0, farHalfW,
      farDist, 0, -farHalfW
    ]);
    const indices = [0, 1, 2, 0, 2, 3];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const color = new THREE.Color(zone.color);
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.02; // avoid z-fighting
    scene.add(mesh);

    const borderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(farDist, 0.03, -farHalfW),
      new THREE.Vector3(farDist, 0.03, farHalfW)
    ]);
    const borderMat = new THREE.LineBasicMaterial({ color: zone.color, linewidth: 2 });
    scene.add(new THREE.Line(borderGeo, borderMat));

    prevDist = farDist;
  }

  /* ── frustum outline ── */
  const maxDist = Math.min(sortedDori[sortedDori.length - 1]?.distance ?? params.distance, gridSize / 2);
  const farHW = maxDist * Math.tan(halfH);
  const outlinePoints = [
    new THREE.Vector3(0, params.camHeight, 0),
    new THREE.Vector3(maxDist, 0.03, -farHW),
    new THREE.Vector3(maxDist, 0.03, farHW),
    new THREE.Vector3(0, params.camHeight, 0)
  ];
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
  const outlineMat = new THREE.LineBasicMaterial({ color: 0x1686a6, transparent: true, opacity: 0.72 });
  scene.add(new THREE.Line(outlineGeo, outlineMat));

  const sideGeo1 = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, params.camHeight, 0),
    new THREE.Vector3(maxDist, 0.03, -farHW)
  ]);
  const sideGeo2 = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, params.camHeight, 0),
    new THREE.Vector3(maxDist, 0.03, farHW)
  ]);
  scene.add(new THREE.Line(sideGeo1, outlineMat.clone()));
  scene.add(new THREE.Line(sideGeo2, outlineMat.clone()));

  const dashGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, params.camHeight, 0),
    new THREE.Vector3(maxDist, 0.03, 0)
  ]);
  const dashMat = new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.5, gapSize: 0.3 });
  const dashLine = new THREE.Line(dashGeo, dashMat);
  dashLine.computeLineDistances();
  scene.add(dashLine);

  const createCutoutTexture = (image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isWhiteMatte = max > 226 && max - min < 36;

      if (isWhiteMatte) {
        data[i + 3] = 0;
        continue;
      }

      for (let channel = 0; channel < 3; channel++) {
        const contrasted = (data[i + channel] - 128) * 1.28 + 128;
        data[i + channel] = Math.max(0, Math.min(255, contrasted * 0.92));
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const cutoutTexture = new THREE.CanvasTexture(canvas);
    cutoutTexture.minFilter = THREE.LinearFilter;
    cutoutTexture.magFilter = THREE.LinearFilter;
    cutoutTexture.needsUpdate = true;
    return cutoutTexture;
  };

  /* ── human figure (Sprite) at target distance ── */
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load('/images/man-plate.png?v=2', (texture) => {
    // Preserve aspect ratio
    const aspect = texture.image.width / texture.image.height;
    const cutoutTexture = createCutoutTexture(texture.image as HTMLImageElement) ?? texture;
    const spriteMaterial = new THREE.SpriteMaterial({
      map: cutoutTexture,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.renderOrder = 20;
    
    // Scale sprite to target height
    sprite.scale.set(params.targetHeight * aspect * 1.18, params.targetHeight * 1.18, 1);
    
    // Position at target distance, resting on ground
    sprite.position.set(params.distance, params.targetHeight / 2, 0);
    scene.add(sprite);
  });

  /* ── distance markers on ground ── */
  const createTextSprite = (text: string, position: InstanceType<ThreeModule["Vector3"]>, textColor = "#94a3b8") => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 128;
    canvas.height = 64;
    ctx.fillStyle = textColor;
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(position);
    sprite.scale.set(2.5, 1.25, 1);
    scene.add(sprite);
  };

  const step = params.distance > 50 ? 10 : 5;
  for (let d = step; d <= maxDist; d += step) {
    createTextSprite(`${d}m`, new THREE.Vector3(d, 0.1, -2));
  }

  for (const zone of result.doriDistances) {
    if (zone.distance > 0 && zone.distance < gridSize / 2) {
      const halfW = zone.distance * Math.tan(halfH);
      createTextSprite(zone.label, new THREE.Vector3(zone.distance, 0.5, halfW + 1.5), zone.color);
    }
  }

  /* ── animation loop ── */
  let frameId = 0;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, cam);
  };
  animate();

  /* ── resize handler ── */
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", onResize);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };
}

/* ─── main page component ─── */
export default function Lens3DPage() {
  const [sensorIdx, setSensorIdx] = useState(1); // 1/3" default
  const [focal, setFocal] = useState(4);
  const [resIdx, setResIdx] = useState(7); // 1080p default
  const [distance, setDistance] = useState(15);
  const [camHeight, setCamHeight] = useState(4);
  const [targetHeight, setTargetHeight] = useState(1.8);
  const [viewMode, setViewMode] = useState<"top" | "side" | "3d">("3d");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<Lens3DHandles | null>(null);

  const sensor = sensorPresets[sensorIdx];
  const res = resolutionPresets[resIdx];

  const params = useMemo(() => ({
    sensorW: sensor.w, sensorH: sensor.h,
    focal, resW: res.w,
    distance, camHeight, targetHeight
  }), [sensor.w, sensor.h, focal, res.w, distance, camHeight, targetHeight]);

  const result = useMemo(() => calculate(params), [params]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    const initScene = async () => {
      if (!containerRef.current) return;
      const [THREE, OrbitControlsMod] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js")
      ]);

      if (!active || !containerRef.current) return;
      cleanup = buildScene(THREE, OrbitControlsMod, containerRef.current, params, handlesRef);
      // Re-apply the current view mode on rebuild
      handlesRef.current?.setViewMode(viewMode);
    };

    initScene();

    return () => {
      active = false;
      handlesRef.current = null;
      if (cleanup) {
        cleanup();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Handle view mode changes without rebuilding the whole scene
  useEffect(() => {
    handlesRef.current?.setViewMode(viewMode);
  }, [viewMode]);

  /* ── Simulated Pixelation Setup ── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Pre-load the target image on mount
  useEffect(() => {
    const img = new Image();
    img.src = "/images/man-plate.png?v=2";
    img.onload = () => {
      simImageRef.current = img;
      setImageLoaded(true);
    };
  }, []);

  const displayWidth = 170;
  const aspect = 1.08;
  const displayHeight = displayWidth / aspect;

  const currentDoriZone = useMemo(() => {
    const ppm = result.ppm;
    if (ppm >= 250) return doriZones[4]; // identification
    if (ppm >= 125) return doriZones[3]; // recognition
    if (ppm >= 62) return doriZones[2];  // observation
    if (ppm >= 25) return doriZones[1];  // detection
    return doriZones[0];                 // monitoring
  }, [result.ppm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = simImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Define the physical width of the crop visible in the HUD box in meters
    const W_visible = 0.65;
    
    // Calculate canvas internal resolution (matches PPM * visible width)
    const canvasW = Math.max(1, Math.round(result.ppm * W_visible));
    const canvasH = Math.max(1, Math.round(canvasW / aspect));

    canvas.width = canvasW;
    canvas.height = canvasH;

    // Clear canvas
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Compute source crop from the 1024x1024 image
    // The full image physical height is targetHeight * 1.18.
    // The image is square, so its physical width is also targetHeight * 1.18.
    const W_img_physical = targetHeight * 1.18;
    const cropFraction = W_visible / W_img_physical;

    const sw = img.width * cropFraction;
    const sh = sw / aspect;

    const sx = (img.width - sw) * 0.5;
    const sy = (img.height - sh) * 0.12; // Adjusted vertically to center on upper body/face/plate

    // Disable image smoothing to get pixelated downsampling
    ctx.imageSmoothingEnabled = false;

    // Draw cropped portion onto canvas
    ctx.drawImage(
      img,
      Math.max(0, sx),
      Math.max(0, sy),
      Math.min(img.width, sw),
      Math.min(img.height, sh),
      0,
      0,
      canvasW,
      canvasH
    );
  }, [imageLoaded, result.ppm, targetHeight, aspect]);

  return (
    <CalculatorShell tool={tool}>
      <div className="lens3d-layout">
        {/* ── parameter panel ── */}
        <aside className="lens3d-panel">
          <h3>تنظیمات دوربین</h3>
          <SelectInput
            label="فرمت سنسور"
            value={sensorIdx}
            onChange={(v) => setSensorIdx(Number(v))}
            options={sensorPresets.map((s, i) => ({ label: `${s.label} (${s.w}×${s.h} mm)`, value: i }))}
          />
          <NumberInput label="فاصله کانونی" value={focal} onChange={setFocal} min={1} max={300} step={0.5} unit="mm" />
          <SelectInput
            label="رزولوشن"
            value={resIdx}
            onChange={(v) => setResIdx(Number(v))}
            options={resolutionPresets.map((r, i) => ({ label: r.label, value: i }))}
          />

          <h3>میدان دید</h3>
          <NumberInput label="فاصله دوربین" value={distance} onChange={setDistance} min={1} max={200} step={1} unit="m" />
          <NumberInput label="ارتفاع نصب" value={camHeight} onChange={setCamHeight} min={0.5} max={30} step={0.5} unit="m" />
          <NumberInput label="ارتفاع هدف" value={targetHeight} onChange={setTargetHeight} min={0.5} max={3} step={0.1} unit="m" />

          <div className="lens3d-info-row">
            <span>زاویه شیب</span>
            <strong>{formatNumber(result.tiltDeg, 1)}°</strong>
          </div>
        </aside>

        <div className="lens3d-stage">
          {/* ── 3D viewport ── */}
          <div className="lens3d-viewport" ref={containerRef}>
            {/* View Presets Overlays */}
            <div className="lens3d-controls">
              <button className={viewMode === "3d" ? "active" : ""} onClick={() => setViewMode("3d")}>3D</button>
              <button className={viewMode === "top" ? "active" : ""} onClick={() => setViewMode("top")}>بالا (Top)</button>
              <button className={viewMode === "side" ? "active" : ""} onClick={() => setViewMode("side")}>کنار (Side)</button>
            </div>
          </div>

          {/* Simulated Camera View Overlay */}
          <div className="lens3d-camera-sim">
            <div className="lens3d-camera-sim-header">
              کیفیت شبیه‌سازی (PPM {formatNumber(result.ppm, 0)})
            </div>
            <div className="lens3d-camera-sim-view" style={{ width: displayWidth, height: displayHeight }}>
              {imageLoaded ? (
                <canvas 
                  ref={canvasRef} 
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    imageRendering: 'pixelated'
                  }}
                />
              ) : (
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>بارگذاری...</div>
              )}

              {/* Camera HUD Overlays */}
              <div className="lens3d-hud-overlay">
                {/* Crosshair in the middle */}
                <div className="lens3d-hud-crosshair"></div>
                
                {/* Top bar (REC indicator and CAM name) */}
                <div className="lens3d-hud-top">
                  <span className="lens3d-hud-rec">
                    <span className="lens3d-hud-dot"></span>
                    REC
                  </span>
                  <span className="lens3d-hud-cam">CAM_01</span>
                </div>

                {/* Bottom bar (Current PPM and DORI Mode) */}
                <div className="lens3d-hud-bottom">
                  <span>{formatNumber(result.ppm, 0)} PPM</span>
                  <span className="lens3d-hud-zone" style={{ color: currentDoriZone.color }}>
                    {currentDoriZone.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── results bar ── */}
      <div className="lens3d-results">
        <div className="lens3d-result-item">
          <span>زاویه افقی</span>
          <strong>{formatNumber(result.hFovDeg, 1)}°</strong>
        </div>
        <div className="lens3d-result-item">
          <span>زاویه عمودی</span>
          <strong>{formatNumber(result.vFovDeg, 1)}°</strong>
        </div>
        <div className="lens3d-result-item">
          <span>عرض صحنه</span>
          <strong>{formatNumber(result.sceneWidth, 1)} m</strong>
        </div>
        <div className="lens3d-result-item lens3d-result-highlight">
          <span>تراکم پیکسل</span>
          <strong>{formatNumber(result.ppm, 0)} PPM</strong>
        </div>
      </div>

      {/* ── DORI legend & distances ── */}
      <div className="lens3d-dori-section">
        <h3>نواحی DORI <small>(IEC 62676-4)</small></h3>
        <div className="lens3d-dori-grid">
          {result.doriDistances.map((zone) => (
            <div className="lens3d-dori-card" key={zone.id}>
              <span className="lens3d-dori-swatch" style={{ background: zone.color }} />
              <div>
                <strong>{zone.label}</strong>
                <span className="lens3d-dori-ppm">{zone.ppm} PPM</span>
              </div>
              <span className="lens3d-dori-dist">{formatNumber(zone.distance, 1)} m</span>
            </div>
          ))}
        </div>
      </div>
    </CalculatorShell>
  );
}
