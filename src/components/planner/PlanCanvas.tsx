"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type * as THREE_NS from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  defaultCameraOptics,
  defaultWallHeightM,
  defaultWallThicknessM,
  type FloorPlan,
  type PlanSelection,
  type PlanTool,
  type PlanViewMode,
  type Vec2
} from "@/src/domain/planner/types";
import { computeCameraCoverage, type CameraCoverage } from "@/src/lib/planner/coverage";
import { collectOccluders, distance, snapPoint } from "@/src/lib/planner/geometry";
import {
  buildCameraMarker,
  buildCoverageMesh,
  buildObstacleMesh,
  buildPreviewLine,
  buildPreviewRect,
  buildWallMesh,
  buildYawHandle,
  buildBackdrop,
  collectDimensionLabels,
  disposeGroup
} from "@/src/lib/planner/scene-builders";

type ThreeModule = typeof THREE_NS;

type Bundle = {
  THREE: ThreeModule;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  topCamera: THREE_NS.OrthographicCamera;
  orbitCamera: THREE_NS.PerspectiveCamera;
  topControls: OrbitControls;
  orbitControls: OrbitControls;
  groups: Record<"content" | "coverage" | "cameras" | "backdrop" | "preview", THREE_NS.Group>;
  raycaster: THREE_NS.Raycaster;
  groundPlane: THREE_NS.Plane;
  frame: number;
};

export type PlanCanvasProps = {
  floor: FloorPlan;
  tool: PlanTool;
  viewMode: PlanViewMode;
  selection: PlanSelection;
  snapM: number;
  showCoverage: boolean;
  readOnly?: boolean;
  onSelect: (selection: PlanSelection) => void;
  onFloorChange: (floor: FloorPlan) => void;
  onHint: (hint: string | null) => void;
};

type DragState =
  | { kind: "move-camera"; id: string }
  | { kind: "move-obstacle"; id: string }
  | { kind: "yaw"; id: string }
  | null;

const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

export function PlanCanvas(props: PlanCanvasProps) {
  const { floor, tool, viewMode, selection, showCoverage, readOnly, onSelect, onFloorChange, onHint } = props;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const labelHostRef = useRef<HTMLDivElement | null>(null);
  const bundleRef = useRef<Bundle | null>(null);
  const draftRef = useRef<{ kind: "wall" | "obstacle" | "measure"; start: Vec2 } | null>(null);
  const dragRef = useRef<DragState>(null);

  const latest = useRef(props);
  useEffect(() => { latest.current = props; });

  const coverages = useMemo<CameraCoverage[]>(() => {
    if (!showCoverage) return [];
    const occluders = collectOccluders(floor.walls, floor.obstacles);
    return floor.cameras.map((camera) => computeCameraCoverage(camera, occluders, 64));
  }, [floor, showCoverage]);

  /* ── Scene lifecycle (mount once) ────────────────────────────────── */
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      const [THREE, controlsModule] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js")
      ]);
      if (disposed || !hostRef.current) return;

      const width = host.clientWidth || 800;
      const height = host.clientHeight || 520;
      const aspect = width / height;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xf2f8fb, 1);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();

      const frustum = 30;
      const topCamera = new THREE.OrthographicCamera(
        (-frustum * aspect) / 2, (frustum * aspect) / 2, frustum / 2, -frustum / 2, 0.1, 1000
      );
      topCamera.position.set(0, 100, 0);
      topCamera.up.set(0, 0, -1);
      topCamera.lookAt(0, 0, 0);

      const orbitCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
      orbitCamera.position.set(20, 18, 20);
      orbitCamera.lookAt(0, 0, 0);

      /*
       * One controls instance per camera.
       *
       * The previous version swapped `controls.object` at runtime, which leaves the
       * internal spherical state describing the *old* camera — that was the jumpy,
       * glitchy rotation. Two instances with only one enabled keeps each camera's
       * state coherent.
       */
      const topControls = new controlsModule.OrbitControls(topCamera, renderer.domElement);
      topControls.enableRotate = false;
      topControls.screenSpacePanning = true;
      topControls.enableDamping = false;

      const orbitControls = new controlsModule.OrbitControls(orbitCamera, renderer.domElement);
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.08;
      orbitControls.maxPolarAngle = Math.PI / 2.05;
      orbitControls.enabled = false;

      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const sun = new THREE.DirectionalLight(0xffffff, 0.7);
      sun.position.set(14, 30, 10);
      scene.add(sun);

      const grid = new THREE.GridHelper(200, 200, 0x9dc4d8, 0xd7e8f0);
      (grid.material as THREE_NS.Material).transparent = true;
      (grid.material as THREE_NS.Material).opacity = 0.6;
      scene.add(grid);

      const groups = {
        content: new THREE.Group(),
        coverage: new THREE.Group(),
        cameras: new THREE.Group(),
        backdrop: new THREE.Group(),
        preview: new THREE.Group()
      };
      Object.values(groups).forEach((group) => scene.add(group));

      const bundle: Bundle = {
        THREE, renderer, scene, topCamera, orbitCamera, topControls, orbitControls, groups,
        raycaster: new THREE.Raycaster(),
        groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        frame: 0
      };
      bundleRef.current = bundle;

      const activeCamera = () => (latest.current.viewMode === "top" ? topCamera : orbitCamera);

      const renderLoop = () => {
        bundle.frame = requestAnimationFrame(renderLoop);
        if (latest.current.viewMode === "top") topControls.update();
        else orbitControls.update();
        renderer.render(scene, activeCamera());
        updateLabelPositions(bundle, activeCamera(), labelHostRef.current);
      };
      renderLoop();

      const resize = () => {
        const node = hostRef.current;
        if (!node) return;
        const w = node.clientWidth || 800;
        const h = node.clientHeight || 520;
        const ratio = w / h;
        renderer.setSize(w, h);
        topCamera.left = (-frustum * ratio) / 2;
        topCamera.right = (frustum * ratio) / 2;
        topCamera.updateProjectionMatrix();
        orbitCamera.aspect = ratio;
        orbitCamera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);

      syncScene(bundle, latest.current, coverages);
      renderLabels(labelHostRef.current, collectDimensionLabels(latest.current.floor));
    })();

    return () => {
      disposed = true;
      const bundle = bundleRef.current;
      if (!bundle) return;
      cancelAnimationFrame(bundle.frame);
      Object.values(bundle.groups).forEach(disposeGroup);
      bundle.topControls.dispose();
      bundle.orbitControls.dispose();
      bundle.renderer.dispose();
      bundle.renderer.domElement.remove();
      bundleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Rebuild scene content only when the data actually changes ───── */
  useEffect(() => {
    const bundle = bundleRef.current;
    if (!bundle) return;
    syncScene(bundle, { floor, selection } as PlanCanvasProps, coverages);
    renderLabels(labelHostRef.current, collectDimensionLabels(floor));
  }, [floor, selection, coverages]);

  /* ── View mode & tool wiring ─────────────────────────────────────── */
  useEffect(() => {
    const bundle = bundleRef.current;
    if (!bundle) return;
    const { THREE, topControls, orbitControls, topCamera, orbitCamera } = bundle;

    if (viewMode === "top") {
      // Carry the orbit target across so the plan does not jump on the way back.
      topControls.target.set(orbitControls.target.x, 0, orbitControls.target.z);
      topCamera.position.set(orbitControls.target.x, 100, orbitControls.target.z);
      topControls.enabled = true;
      orbitControls.enabled = false;
    } else {
      orbitControls.target.set(topControls.target.x, 0, topControls.target.z);
      const radius = 24;
      orbitCamera.position.set(topControls.target.x + radius * 0.7, 20, topControls.target.z + radius * 0.7);
      orbitControls.enabled = true;
      topControls.enabled = false;
    }

    // While a drawing tool is active the left button belongs to the tool, not the camera.
    const drawing = tool !== "select";
    topControls.mouseButtons = {
      LEFT: drawing ? null : THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    orbitControls.mouseButtons = {
      LEFT: drawing ? null : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
  }, [viewMode, tool]);

  /* ── Pointer helpers ─────────────────────────────────────────────── */
  const ndcFor = useCallback((clientX: number, clientY: number) => {
    const bundle = bundleRef.current!;
    const rect = bundle.renderer.domElement.getBoundingClientRect();
    return new bundle.THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  }, []);

  const planPointAt = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const bundle = bundleRef.current;
    if (!bundle) return null;
    bundle.raycaster.setFromCamera(
      ndcFor(clientX, clientY),
      latest.current.viewMode === "top" ? bundle.topCamera : bundle.orbitCamera
    );
    const hit = new bundle.THREE.Vector3();
    return bundle.raycaster.ray.intersectPlane(bundle.groundPlane, hit) ? { x: hit.x, z: hit.z } : null;
  }, [ndcFor]);

  const pickAt = useCallback((clientX: number, clientY: number): { kind: string; id: string } | null => {
    const bundle = bundleRef.current;
    if (!bundle) return null;
    bundle.raycaster.setFromCamera(
      ndcFor(clientX, clientY),
      latest.current.viewMode === "top" ? bundle.topCamera : bundle.orbitCamera
    );
    // Cameras and their yaw handles are tested first so a handle always wins over a wall.
    const targets = [...bundle.groups.cameras.children, ...bundle.groups.content.children];
    for (const hit of bundle.raycaster.intersectObjects(targets, true)) {
      const data = hit.object.userData as { kind?: string; id?: string };
      if (data.kind && data.id) return { kind: data.kind, id: data.id };
    }
    return null;
  }, [ndcFor]);

  const setControlsEnabled = useCallback((enabled: boolean) => {
    const bundle = bundleRef.current;
    if (!bundle) return;
    if (latest.current.viewMode === "top") bundle.topControls.enabled = enabled;
    else bundle.orbitControls.enabled = enabled;
  }, []);

  /* ── Interaction ─────────────────────────────────────────────────── */
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const current = latest.current;
    if (current.readOnly) return;

    const point = planPointAt(event.clientX, event.clientY);
    if (!point) return;
    const snapped = snapPoint(point, current.snapM);

    if (current.tool === "select") {
      const picked = pickAt(event.clientX, event.clientY);

      if (picked?.kind === "camera-yaw") {
        dragRef.current = { kind: "yaw", id: picked.id };
        // Suspending the controls is what stops the view panning under a drag.
        setControlsEnabled(false);
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        onHint("بکشید تا جهت دوربین تغییر کند");
        return;
      }

      onSelect(picked && picked.kind !== "camera-yaw" ? { kind: picked.kind, id: picked.id } as PlanSelection : null);

      if (picked?.kind === "camera" || picked?.kind === "obstacle") {
        dragRef.current = { kind: picked.kind === "camera" ? "move-camera" : "move-obstacle", id: picked.id };
        setControlsEnabled(false);
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      }
      return;
    }

    if (current.tool === "camera") {
      const camera = {
        id: nextId("cam"),
        name: `دوربین ${current.floor.cameras.length + 1}`,
        position: snapped,
        yawDeg: 0,
        goal: "monitor" as const,
        optics: { ...defaultCameraOptics }
      };
      onFloorChange({ ...current.floor, cameras: [...current.floor.cameras, camera] });
      onSelect({ kind: "camera", id: camera.id });
      return;
    }

    const draft = draftRef.current;
    if (!draft) {
      draftRef.current = { kind: current.tool as "wall" | "obstacle" | "measure", start: snapped };
      onHint(current.tool === "wall" ? "نقطه پایان دیوار را بزنید — کلیک راست یا Esc برای پایان" : "نقطه مقابل را بزنید");
      return;
    }

    if (draft.kind === "wall") {
      if (distance(draft.start, snapped) >= 0.1) {
        onFloorChange({
          ...current.floor,
          walls: [...current.floor.walls, {
            id: nextId("wall"), a: draft.start, b: snapped,
            heightM: defaultWallHeightM, thicknessM: defaultWallThicknessM, blocksView: true
          }]
        });
        draftRef.current = { kind: "wall", start: snapped };
      }
      return;
    }

    if (draft.kind === "obstacle") {
      const widthM = Math.abs(snapped.x - draft.start.x);
      const depthM = Math.abs(snapped.z - draft.start.z);
      if (widthM >= 0.2 && depthM >= 0.2) {
        const obstacle = {
          id: nextId("obs"), label: `مانع ${current.floor.obstacles.length + 1}`, kind: "block" as const,
          center: { x: (draft.start.x + snapped.x) / 2, z: (draft.start.z + snapped.z) / 2 },
          widthM, depthM, heightM: 1.2, rotationDeg: 0, blocksView: true
        };
        onFloorChange({ ...current.floor, obstacles: [...current.floor.obstacles, obstacle] });
        onSelect({ kind: "obstacle", id: obstacle.id });
      }
      draftRef.current = null;
      onHint(null);
      return;
    }

    onHint(`فاصله اندازه‌گیری‌شده: ${distance(draft.start, snapped).toFixed(2)} متر`);
    draftRef.current = null;
  }, [onFloorChange, onHint, onSelect, pickAt, planPointAt, setControlsEnabled]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bundle = bundleRef.current;
    const current = latest.current;
    if (!bundle || current.readOnly) return;

    const point = planPointAt(event.clientX, event.clientY);
    if (!point) return;

    const drag = dragRef.current;
    if (drag) {
      if (drag.kind === "yaw") {
        const camera = current.floor.cameras.find((item) => item.id === drag.id);
        if (!camera) return;
        // Point the camera wherever the pointer is, in whole degrees.
        const yawDeg = Math.round((Math.atan2(point.z - camera.position.z, point.x - camera.position.x) * 180) / Math.PI);
        onFloorChange({
          ...current.floor,
          cameras: current.floor.cameras.map((item) => item.id === drag.id ? { ...item, yawDeg: (yawDeg + 360) % 360 } : item)
        });
        onHint(`جهت دوربین: ${((yawDeg + 360) % 360).toFixed(0)}°`);
        return;
      }

      const snapped = snapPoint(point, current.snapM);
      if (drag.kind === "move-camera") {
        onFloorChange({
          ...current.floor,
          cameras: current.floor.cameras.map((item) => item.id === drag.id ? { ...item, position: snapped } : item)
        });
      } else {
        onFloorChange({
          ...current.floor,
          obstacles: current.floor.obstacles.map((item) => item.id === drag.id ? { ...item, center: snapped } : item)
        });
      }
      return;
    }

    const draft = draftRef.current;
    disposeGroup(bundle.groups.preview);
    if (!draft) return;

    const snapped = snapPoint(point, current.snapM);
    if (draft.kind === "obstacle") {
      bundle.groups.preview.add(buildPreviewRect(bundle.THREE, draft.start, snapped));
      onHint(`${Math.abs(snapped.x - draft.start.x).toFixed(2)} × ${Math.abs(snapped.z - draft.start.z).toFixed(2)} متر`);
    } else {
      const line = buildPreviewLine(bundle.THREE, draft.start, snapped);
      (line as THREE_NS.Line).computeLineDistances();
      bundle.groups.preview.add(line);
      onHint(`${distance(draft.start, snapped).toFixed(2)} متر`);
    }
  }, [onFloorChange, onHint, planPointAt]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setControlsEnabled(true);
  }, [setControlsEnabled]);

  const cancelDraft = useCallback(() => {
    draftRef.current = null;
    const bundle = bundleRef.current;
    if (bundle) disposeGroup(bundle.groups.preview);
    onHint(null);
  }, [onHint]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelDraft();
      // Nudging yaw from the keyboard is far more precise than any drag.
      const current = latest.current;
      if (current.selection?.kind !== "camera" || current.readOnly) return;
      if (event.key !== "[" && event.key !== "]") return;
      const delta = event.key === "]" ? 5 : -5;
      onFloorChange({
        ...current.floor,
        cameras: current.floor.cameras.map((item) =>
          item.id === current.selection!.id ? { ...item, yawDeg: (item.yawDeg + delta + 360) % 360 } : item)
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelDraft, onFloorChange]);

  return (
    <div className="plan-canvas-wrap">
      <div
        ref={hostRef}
        className={`plan-canvas tool-${readOnly ? "readonly" : tool}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onContextMenu={(event) => { if (draftRef.current) { event.preventDefault(); cancelDraft(); } }}
      />
      <div ref={labelHostRef} className="plan-dimension-layer" aria-hidden="true" />
    </div>
  );
}

/* ── Scene sync ────────────────────────────────────────────────────── */

function syncScene(bundle: Bundle, props: Pick<PlanCanvasProps, "floor" | "selection">, coverages: CameraCoverage[]) {
  const { THREE, groups } = bundle;
  const { floor, selection } = props;

  disposeGroup(groups.content);
  disposeGroup(groups.cameras);
  disposeGroup(groups.coverage);
  disposeGroup(groups.backdrop);

  const backdrop = buildBackdrop(THREE, floor);
  if (backdrop) groups.backdrop.add(backdrop);

  for (const wall of floor.walls) {
    groups.content.add(buildWallMesh(THREE, wall, selection?.kind === "wall" && selection.id === wall.id));
  }
  for (const obstacle of floor.obstacles) {
    groups.content.add(buildObstacleMesh(THREE, obstacle, selection?.kind === "obstacle" && selection.id === obstacle.id));
  }
  for (const camera of floor.cameras) {
    const isSelected = selection?.kind === "camera" && selection.id === camera.id;
    groups.cameras.add(buildCameraMarker(THREE, camera.id, camera.position, camera.optics.mountHeightM, camera.yawDeg, isSelected));
    if (isSelected) groups.cameras.add(buildYawHandle(THREE, camera.id, camera.position, camera.optics.mountHeightM, camera.yawDeg));
  }
  for (const coverage of coverages) {
    groups.coverage.add(buildCoverageMesh(THREE, coverage));
  }
}

function renderLabels(host: HTMLDivElement | null, labels: ReturnType<typeof collectDimensionLabels>) {
  if (!host) return;
  host.replaceChildren();
  for (const label of labels) {
    const node = document.createElement("span");
    node.className = "plan-dimension";
    node.textContent = label.text;
    node.dataset.worldX = String(label.world.x);
    node.dataset.worldY = String(label.world.y);
    node.dataset.worldZ = String(label.world.z);
    host.appendChild(node);
  }
}

function updateLabelPositions(bundle: Bundle, camera: THREE_NS.Camera, host: HTMLDivElement | null) {
  if (!host || !host.children.length) return;
  const { THREE, renderer } = bundle;
  const size = renderer.getSize(new THREE.Vector2());
  const vector = new THREE.Vector3();

  for (const child of Array.from(host.children) as HTMLElement[]) {
    vector.set(Number(child.dataset.worldX), Number(child.dataset.worldY), Number(child.dataset.worldZ));
    vector.project(camera);
    const behind = vector.z > 1;
    child.style.display = behind ? "none" : "block";
    if (behind) continue;
    child.style.transform = `translate(-50%, -50%) translate(${((vector.x + 1) / 2) * size.x}px, ${((-vector.y + 1) / 2) * size.y}px)`;
  }
}
