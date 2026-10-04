"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  BedDouble,
  Blinds,
  BrickWall,
  Bus,
  Building2,
  CarFront,
  ChartNoAxesGantt,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Factory,
  Fence,
  Hotel,
  Hospital,
  Shield,
  GraduationCap,
  CircleParking,
  ShoppingBag,
  Sprout,
  TreePine,
  Warehouse,
  Zap,
  Copy,
  Cuboid,
  Camera as CameraIcon,
  DoorOpen,
  Eye,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Move3d,
  Plus,
  Ruler,
  Server,
  Square,
  Redo2,
  RotateCcw,
  Settings2,
  Sofa,
  Sparkles,
  Target,
  TriangleAlert,
  Trash2,
  Undo2,
  Minus,
  X
} from "lucide-react";
import type { ProjectCameraTemplate } from "@/src/domain/catalog/types";
import {
  createEmptyPlan,
  createFloor,
  defaultPlanDefaults,
  duplicateFloor,
  emptySelection,
  type BuildingPlan,
  type CustomSectionRecord,
  type FloorPlan,
  type PlanBackdrop,
  type PlanDoorVariant,
  type PlanSelection,
  type PlanTool,
  type PlanViewMode,
  type WallDrawMode,
  type Vec2
} from "@/src/domain/planner/types";
import { PlanCanvas } from "@/src/components/planner/PlanCanvas";
import { PlanInspector } from "@/src/components/planner/PlanInspector";
import { drawsSingleWall, fenceWallStyles, isFenceMode } from "@/src/lib/planner/wall-styles";
import { VenuePanel } from "@/src/components/planner/VenuePanel";
import { computeFloorCoverage } from "@/src/lib/planner/coverage";
import { floorAreaM2, largestClosedWallLoop } from "@/src/lib/planner/geometry";
import { reconcileRooms, roomAtPoint, unassignedRooms, type OpenRegion } from "@/src/lib/planner/rooms";
import { constrainCameraMountHeight, syncEquipmentRequirements } from "@/src/lib/planner/placement-rules";
import { findSectionType } from "@/src/domain/planner/venues";
import {
  optimiseCameraPlacement,
  resetCameraPlacements,
  validateSmartPlacementPlan,
  type SmartPlacementReport
} from "@/src/lib/planner/smart-placement";
import { formatFa } from "@/src/lib/chatbot/persian";
import { cameraFromTemplate, createBlankCamera, housingLabels } from "@/src/lib/planner/camera-templates";
import { obstaclePresets, type ObstacleGroup, type ObstaclePreset } from "@/src/lib/planner/obstacle-presets";
import { importDxfWalls, type DxfImportResult } from "@/src/lib/planner/dxf-import";
import {
  copySelection,
  deleteSelection,
  pasteSelection,
  type PlanClipboard
} from "@/src/lib/planner/selection";

/** Sentinel dropped from the palette when the position does not match a defined type. */
const BLANK_CAMERA_ID = "__blank__";

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

type BuildingFloorFilter = "above" | "below" | "all";

const allTools: { id: PlanTool; label: string; icon: typeof MousePointer2; hint: string; modes: DesignerMode[] }[] = [
  { id: "select", label: "انتخاب", icon: MousePointer2, hint: "انتخاب و جابه‌جایی عناصر — دستگیره نارنجی جهت دوربین را می‌چرخاند", modes: ["environment", "cameras"] },
  { id: "wall", label: "دیوار", icon: BrickWall, hint: "گوشه اول و سپس گوشه مقابل را بزنید تا چهار دیوار مستطیلی رسم شود", modes: ["environment"] },
  { id: "door", label: "در", icon: DoorOpen, hint: "روی یک دیوار کلیک کنید تا در به همان نقطه متصل شود", modes: ["environment"] },
  { id: "window", label: "پنجره", icon: Blinds, hint: "روی یک دیوار کلیک کنید تا پنجره اضافه شود — شیشه مانع دید دوربین نیست", modes: ["environment"] },
  { id: "obstacle", label: "مانع", icon: Cuboid, hint: "دو نقطه مقابل هم را بزنید", modes: ["environment"] },
  { id: "room", label: "فضا", icon: Square, hint: "برای محوطه‌های بدون دیوار بسته، مرز فضا را دستی بکشید", modes: ["environment"] },
  { id: "coverage", label: "ناحیه اجباری", icon: Target, hint: "ناحیه‌ای که حتماً باید زیر پوشش باشد", modes: ["environment", "cameras"] },
  { id: "camera", label: "افزودن دوربین", icon: CameraIcon, hint: "روی نقشه کلیک کنید تا دوربین اضافه شود", modes: ["cameras"] },
  { id: "measure", label: "اندازه‌گیری", icon: Ruler, hint: "دو نقطه را بزنید تا فاصله را ببینید", modes: ["environment", "cameras"] }
];

export function FloorPlanDesigner({
  plan: controlledPlan,
  mode = "environment",
  variant = "default",
  readOnly = false,
  cameraTemplates = [],
  onPlanChange,
  onSummaryChange
}: {
  plan?: BuildingPlan;
  mode?: DesignerMode;
  variant?: "default" | "focus";
  /**
   * Presentation mode: the canvas still renders everything and pans and zooms freely,
   * but no tool can alter the plan. Used by the saved-project viewer, where showing a
   * finished design must not risk changing it.
   */
  readOnly?: boolean;
  cameraTemplates?: ProjectCameraTemplate[];
  onPlanChange?: (plan: BuildingPlan) => void;
  onSummaryChange?: (summary: PlanSummary) => void;
}) {
  const [internalPlan, setInternalPlan] = useState<BuildingPlan>(() => controlledPlan ?? createEmptyPlan());
  const plan = controlledPlan ?? internalPlan;
  const tools = useMemo(
    () => allTools.filter((item) => item.modes.includes(mode) && !(mode === "cameras" && item.id === "camera")),
    [mode]
  );

  const [requestedTool, setTool] = useState<PlanTool>("select");
  const [wallDrawMode, setWallDrawMode] = useState<WallDrawMode>("rectangle");
  const [doorVariant, setDoorVariant] = useState<PlanDoorVariant>("single-solid");
  /* Derived, not stored: switching mode retires tools like "دیوار", and falling back
     here avoids an effect that would setState during render. */
  const tool: PlanTool = tools.some((item) => item.id === requestedTool)
    ? requestedTool
    : "select";
  const [viewMode, setViewMode] = useState<PlanViewMode>("top");
  const [previewFocusFloorId, setPreviewFocusFloorId] = useState<string | null>(null);
  const [buildingFloorFilter, setBuildingFloorFilter] = useState<BuildingFloorFilter>("above");
  const [selection, setSelection] = useState<PlanSelection>(emptySelection);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showAdvancedElements, setShowAdvancedElements] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [pendingBackdrop, setPendingBackdrop] = useState<PlanBackdrop | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [smartPlacementReport, setSmartPlacementReport] = useState<SmartPlacementReport | null>(null);
  const [isOptimisingPlacement, setIsOptimisingPlacement] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pastRef = useRef<BuildingPlan[]>([]);
  const futureRef = useRef<BuildingPlan[]>([]);
  const clipboardRef = useRef<PlanClipboard | null>(null);
  const pointerPlanPositionRef = useRef<Vec2 | null>(null);
  const [historyState, setHistoryState] = useState({ past: 0, future: 0 });

  useEffect(() => {
    if (!showResetDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowResetDialog(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showResetDialog]);

  const storedActiveFloor = plan.floors.find((floor) => floor.id === plan.activeFloorId) ?? plan.floors[0];
  const activeFloor = useMemo(() => {
    if (!storedActiveFloor) return storedActiveFloor;
    const reconciled = reconcileRooms(storedActiveFloor);
    // Old projects may carry the result of an earlier, stricter detector. Surface newly
    // recoverable rooms immediately; the next ordinary edit persists this repaired set.
    return reconciled.length !== (storedActiveFloor.rooms ?? []).length
      ? { ...storedActiveFloor, rooms: reconciled }
      : storedActiveFloor;
  }, [storedActiveFloor]);
  const activeFloorIndex = plan.floors.findIndex((floor) => floor.id === activeFloor?.id);
  /** Spaces still waiting for a section type — the red outlines. */
  const pendingRooms = useMemo(() => plan.floors.flatMap((floor) =>
    unassignedRooms(floor).map((room) => ({ floor, room }))
  ), [plan.floors]);
  const pendingRoomCount = pendingRooms.length;
  const smartPlacementErrors = useMemo(() => validateSmartPlacementPlan(plan), [plan]);
  const referenceFloor = activeFloorIndex > 0 ? plan.floors[activeFloorIndex - 1] : null;
  const designDefaults = { ...defaultPlanDefaults, ...plan.defaults };
  const buildingPreviewFloors = useMemo(() => {
    if (buildingFloorFilter === "all") return plan.floors;
    if (buildingFloorFilter === "below") return plan.floors.filter((item) => item.elevationM < 0);
    return plan.floors.filter((item) => item.elevationM >= 0);
  }, [buildingFloorFilter, plan.floors]);
  /** How many cameras of each device type are already sited, for the palette counters. */
  const placedByTemplate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const floor of plan.floors) {
      for (const camera of floor.cameras) {
        const key = camera.templateId;
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [plan.floors]);
  const placedCameraCount = useMemo(
    () => plan.floors.reduce((sum, floor) => sum + floor.cameras.length, 0),
    [plan.floors]
  );

  const publishPlan = useCallback((next: BuildingPlan) => {
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

  const commit = useCallback((next: BuildingPlan) => {
    if (next === plan) return;
    pastRef.current = [...pastRef.current.slice(-99), plan];
    futureRef.current = [];
    setHistoryState({ past: pastRef.current.length, future: 0 });
    publishPlan(next);
  }, [plan, publishPlan]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current = [...futureRef.current.slice(-99), plan];
    setHistoryState({ past: pastRef.current.length, future: futureRef.current.length });
    setSelection(emptySelection);
    publishPlan(previous);
  }, [plan, publishPlan]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current = [...pastRef.current.slice(-99), plan];
    setHistoryState({ past: pastRef.current.length, future: futureRef.current.length });
    setSelection(emptySelection);
    publishPlan(next);
  }, [plan, publishPlan]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === "z") {
        event.preventDefault();
        undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [redo, undo]);

  /**
   * Commits a floor, keeping its derived collections in step.
   *
   * Rooms are a reading of the walls, so any wall edit re-runs detection; the assigned
   * section types survive because reconciliation matches the new outlines onto the old
   * rooms. Equipment coverage follows the obstacles for the same reason. Both are skipped
   * when their source did not change, so drawing a room by hand does not immediately
   * trigger a detection pass that would discard it.
   */
  const updateFloor = useCallback((floor: FloorPlan, openChoices?: Record<string, "inferred" | "enclosing">) => {
    const current = plan.floors.find((item) => item.id === floor.id);
    let next = floor;
    if ((!current || current.walls !== floor.walls || openChoices) && (!next.roomDetectionDeferred || openChoices)) {
      next = { ...next, rooms: reconcileRooms(next, { openChoices }) };
    }
    if (next.coverageRequirements?.some((requirement) => requirement.sourceRoomId)) {
      const roomsById = new Map((next.rooms ?? []).map((room) => [room.id, room]));
      next = {
        ...next,
        coverageRequirements: next.coverageRequirements
          .filter((requirement) => !requirement.sourceRoomId || roomsById.has(requirement.sourceRoomId))
          .map((requirement) => {
            const room = requirement.sourceRoomId ? roomsById.get(requirement.sourceRoomId) : null;
            return room
              ? {
                ...requirement,
                polygon: room.polygon.map((point) => ({ ...point })),
                sectionTypeId: room.sectionTypeId
              }
              : requirement;
          })
      };
    }
    if (!current || current.obstacles !== floor.obstacles) {
      next = { ...next, coverageRequirements: syncEquipmentRequirements(next) };
    }
    commit({ ...plan, floors: plan.floors.map((item) => (item.id === next.id ? next : item)) });
  }, [commit, plan]);

  useEffect(() => {
    const handleEditShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "c") {
        const copied = copySelection(activeFloor, selection);
        if (!copied) return;
        event.preventDefault();
        clipboardRef.current = copied;
        setHint("آیتم انتخاب‌شده کپی شد — برای چسباندن Ctrl+V را بزنید");
        return;
      }
      if (modifier && key === "x") {
        const copied = copySelection(activeFloor, selection);
        if (!copied) return;
        event.preventDefault();
        clipboardRef.current = copied;
        updateFloor(deleteSelection(activeFloor, selection));
        setSelection(emptySelection);
        setHint("آیتم انتخاب‌شده بریده شد");
        return;
      }
      if (modifier && key === "v") {
        if (!clipboardRef.current) return;
        event.preventDefault();
        const pointer = pointerPlanPositionRef.current;
        const delta = pointer
          ? {
              x: pointer.x - clipboardRef.current.anchor.x,
              z: pointer.z - clipboardRef.current.anchor.z
            }
          : { x: Math.max(0.25, plan.snapM), z: Math.max(0.25, plan.snapM) };
        const pasted = pasteSelection(activeFloor, clipboardRef.current, delta, pointer ?? undefined);
        updateFloor(pasted.floor);
        setSelection(pasted.selection);
        setHint("یک نسخه جدید چسبانده شد");
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selection.length) {
        event.preventDefault();
        updateFloor(deleteSelection(activeFloor, selection));
        setSelection(emptySelection);
        setHint("آیتم انتخاب‌شده حذف شد");
      }
    };
    window.addEventListener("keydown", handleEditShortcut);
    return () => window.removeEventListener("keydown", handleEditShortcut);
  }, [activeFloor, plan.snapM, selection, updateFloor]);

  const resolveOpenRegion = useCallback((region: OpenRegion, choice: "inferred" | "enclosing") => {
    updateFloor(activeFloor, { [region.id]: choice });
    setHint(choice === "inferred"
      ? "ضلع باقی‌مانده به‌صورت فرضی بسته شد — این ضلع نقطه‌چین رسم می‌شود"
      : "محدوده بزرگ‌تر به‌عنوان یک فضا در نظر گرفته شد");
  }, [activeFloor, updateFloor]);

  const setVenueType = useCallback((venueTypeId: string) => {
    commit({ ...plan, venueTypeId });
  }, [commit, plan]);

  const dismissSection = useCallback((sectionId: string, dismissed: boolean) => {
    const current = plan.dismissedSectionIds ?? [];
    commit({
      ...plan,
      dismissedSectionIds: dismissed
        ? [...current.filter((item) => item !== sectionId), sectionId]
        : current.filter((item) => item !== sectionId)
    });
  }, [commit, plan]);

  const addCustomSectionType = useCallback((section: CustomSectionRecord) => {
    commit({ ...plan, customSectionTypes: [...(plan.customSectionTypes ?? []), section] });
  }, [commit, plan]);

  /** Jumps to the first space of a checklist entry, or says there is none yet. */
  const focusSection = useCallback((sectionId: string) => {
    for (const floor of plan.floors) {
      const room = (floor.rooms ?? []).find((item) => item.sectionTypeId === sectionId);
      const requirement = (floor.coverageRequirements ?? []).find((item) => item.sectionTypeId === sectionId);
      if (!room && !requirement) continue;
      if (floor.id !== plan.activeFloorId) publishPlan({ ...plan, activeFloorId: floor.id });
      setSelection([room
        ? { kind: "room", id: room.id }
        : { kind: "requirement", id: requirement!.id }]);
      return;
    }
    setHint("هنوز فضایی از این نوع تعریف نشده است — یک فضا بکشید و نوعش را همین مورد بگذارید");
  }, [plan, publishPlan]);

  /**
   * Adds a preset, either at an explicit drop point or staggered near the plan centre
   * when it came from a click.
   */
  const addPresetObstacle = useCallback((preset: ObstaclePreset, at?: Vec2) => {
    const planPoints = activeFloor.walls.flatMap((wall) => [wall.a, wall.b]);
    const center = planPoints.length > 0
      ? {
          x: (Math.min(...planPoints.map((point) => point.x)) + Math.max(...planPoints.map((point) => point.x))) / 2,
          z: (Math.min(...planPoints.map((point) => point.z)) + Math.max(...planPoints.map((point) => point.z))) / 2
        }
      : { x: 0, z: 0 };
    const stagger = (activeFloor.obstacles.length % 5) * 0.5;
    const obstacle = {
      id: `obs-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
      label: preset.label,
      kind: preset.kind,
      variant: preset.id,
      center: at ?? { x: center.x + stagger, z: center.z + stagger },
      widthM: preset.widthM,
      depthM: preset.depthM,
      heightM: preset.heightM,
      rotationDeg: 0,
      // Preset authors decide whether an element is a sight barrier; forcing `true` here
      // would have made every lawn and coffee table carve a blind spot.
      blocksView: preset.blocksView ?? true
    };
    updateFloor({ ...activeFloor, obstacles: [...activeFloor.obstacles, obstacle] });
    setTool("select");
    setSelection([{ kind: "obstacle", id: obstacle.id }]);
    setViewMode("top");
    setHint(at
      ? `${preset.label} اضافه شد؛ با دستگیره نارنجی می‌توانید بچرخانیدش.`
      : `${preset.label} به مرکز نقشه اضافه شد؛ آن را به محل دلخواه بکشید.`);
  }, [activeFloor, updateFloor]);

  const dropPresetObstacle = useCallback((presetId: string, position: Vec2) => {
    const preset = obstaclePresets.find((item) => item.id === presetId);
    if (!preset) return;
    addPresetObstacle(preset, position);
  }, [addPresetObstacle]);

  /**
   * Device types are reusable: the same type can be dropped as many times as the site
   * needs, and each drop becomes an independent camera that can then be retuned in place.
   */
  const placeTemplateCamera = useCallback((templateId: string, position: Vec2) => {
    const totalPlaced = plan.floors.reduce((sum, floor) => sum + floor.cameras.length, 0);
    const room = roomAtPoint(activeFloor, position);
    const section = findSectionType(room?.sectionTypeId, (plan.customSectionTypes ?? []) as never);
    if (section?.forbidden) {
      setHint(`در فضای «${room?.name || section.label}» نصب دوربین ممنوع است.`);
      return;
    }

    if (templateId === BLANK_CAMERA_ID) {
      const camera = createBlankCamera(position, totalPlaced + 1, designDefaults.cameraMountHeightM);
      camera.optics.mountHeightM = constrainCameraMountHeight(activeFloor, position, camera.optics.mountHeightM, camera.mountKind);
      updateFloor({ ...activeFloor, cameras: [...activeFloor.cameras, camera] });
      setSelection([{ kind: "camera", id: camera.id }]);
      setHint("دوربین بدون نوع اضافه شد؛ مشخصات آن را از پنل سمت راست تنظیم کنید");
      return;
    }

    const template = cameraTemplates.find((item) => item.id === templateId);
    if (!template) {
      setHint("این نوع دستگاه دیگر در فهرست وجود ندارد");
      return;
    }
    const ordinal = (placedByTemplate.get(template.id) ?? 0) + 1;
    const camera = cameraFromTemplate(template, position, ordinal);
    camera.optics.mountHeightM = constrainCameraMountHeight(activeFloor, position, camera.optics.mountHeightM, camera.mountKind);
    updateFloor({ ...activeFloor, cameras: [...activeFloor.cameras, camera] });
    setSelection([{ kind: "camera", id: camera.id }]);
    setHint(`${camera.name} روی نقشه قرار گرفت؛ مشخصاتش از پنل سمت راست قابل تغییر است`);
  }, [activeFloor, cameraTemplates, designDefaults.cameraMountHeightM, placedByTemplate, plan.customSectionTypes, plan.floors, updateFloor]);

  const runSmartPlacement = () => {
    if (isOptimisingPlacement) return;
    if (smartPlacementErrors.length > 0) {
      setSmartPlacementReport(null);
      const firstPending = pendingRooms[0];
      if (firstPending) {
        if (plan.activeFloorId !== firstPending.floor.id) {
          publishPlan({ ...plan, activeFloorId: firstPending.floor.id });
        }
        setViewMode("top");
        setTool("select");
        setSelection([{ kind: "room", id: firstPending.room.id }]);
        setHint(`جانمایی شروع نشد؛ فضای بدون نوع در «${firstPending.floor.name}» انتخاب شد. نوع آن را از پنل مشخصات تعیین کنید.`);
      } else {
        setHint(`جانمایی خودکار شروع نشد: ${smartPlacementErrors[0]}`);
      }
      return;
    }
    setIsOptimisingPlacement(true);
    setSmartPlacementReport(null);
    setHint("در حال تحلیل هندسه طبقات، ورودی‌ها، موانع، PPM و نقاط کور...");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          const result = optimiseCameraPlacement(plan, [], { enforceSemanticValidation: true });
          if (result.report.accepted && result.report.placed > 0) {
            commit(result.plan);
            setViewMode("top");
            setTool("select");
            setSelection(emptySelection);
            setShowCoverage(true);
            setHint(
              `${formatFa(result.report.placed)} دوربین جانمایی شد؛ پوشش برآوردی از `
              + `${formatFa(result.report.coverageBeforePercent, 0)}٪ به `
              + `${formatFa(result.report.coverageAfterPercent, 0)}٪ رسید.`
            );
          } else {
            setHint(result.report.warnings[0] || "همه دوربین‌های تعریف‌شده قبلاً جانمایی شده‌اند.");
          }
          setSmartPlacementReport(result.report);
        } catch (cause) {
          console.error("[smart-placement] optimisation failed", cause);
          setHint("جانمایی خودکار با خطای داخلی متوقف شد؛ نقشه تغییری نکرد و می‌توانید دوباره تلاش کنید.");
        } finally {
          setIsOptimisingPlacement(false);
        }
      }, 20);
    });
  };

  const resetPlacement = () => {
    if (isOptimisingPlacement || placedCameraCount === 0) return;
    commit(resetCameraPlacements(plan));
    setSmartPlacementReport(null);
    setSelection(emptySelection);
    setTool("select");
    setViewMode("top");
    setShowCoverage(true);
    setHint(`${formatFa(placedCameraCount)} دوربین از جانمایی همه طبقات حذف شد؛ اکنون می‌توانید انتخاب و جانمایی را از ابتدا انجام دهید. Ctrl+Z برای بازگردانی.`);
  };

  const coverage = useMemo(
    () => (mode === "cameras" && activeFloor ? computeFloorCoverage(activeFloor, 1.5) : null),
    [activeFloor, mode]
  );
  const areaM2 = useMemo(() => (activeFloor ? floorAreaM2(activeFloor.walls) : 0), [activeFloor]);
  const hasClosedPerimeter = useMemo(
    () => Boolean(activeFloor && largestClosedWallLoop(activeFloor.walls)),
    [activeFloor]
  );

  const addFloor = (copyPrevious: boolean) => {
    const index = plan.floors.length;
    const name = `طبقه ${index + 1}`;
    const source = plan.floors[plan.floors.length - 1];
    const floor = copyPrevious && source ? duplicateFloor(source, name, index) : createFloor(name, index);
    floor.elevationM = source ? source.elevationM + source.heightM : 0;
    commit({ ...plan, floors: [...plan.floors, floor], activeFloorId: floor.id });
    setSelection(emptySelection);
    setPreviewFocusFloorId(null);
    setViewMode("top");
    setTool("select");
    setHint(source ? `خط قرمز محدوده «${source.name}» را نشان می‌دهد؛ طراحی طبقه جدید را داخل آن انجام دهید.` : null);
  };

  const removeFloor = (id: string) => {
    if (plan.floors.length <= 1) return;
    let nextElevationM = 0;
    const remaining = plan.floors.filter((floor) => floor.id !== id).map((floor) => {
      const normalized = { ...floor, elevationM: nextElevationM };
      nextElevationM += floor.heightM;
      return normalized;
    });
    commit({ ...plan, floors: remaining, activeFloorId: remaining[0].id });
    setSelection(emptySelection);
    setPreviewFocusFloorId(viewMode === "building" ? remaining[0].id : null);
  };

  /** Reads the drawing at native size, then hands it to the pointer-based placement flow. */
  const handleBackdropUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const image = new Image();
      image.onload = () => {
        const metresPerPixel = 20 / image.width;
        setPendingBackdrop({
          imageUrl: url,
          widthPx: image.width,
          heightPx: image.height,
          originM: { x: 0, z: 0 },
          metresPerPixel,
          opacity: 0.72,
          calibrated: true
        });
        setViewMode("top");
        setTool("select");
        setSelection(emptySelection);
        setHint("تصویر به ماوس متصل است؛ آن را حرکت دهید و برای جای‌گذاری روی نقشه کلیک کنید");
      };
      image.src = url;
    };
    reader.readAsDataURL(file);
  };

  /** Imports editable CAD linework; DWG is converted server-side before using the DXF parser. */
  const handlePlanUpload = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".dxf") && !lowerName.endsWith(".dwg")) {
      handleBackdropUpload(file);
      return;
    }
    try {
      let imported: DxfImportResult;
      if (lowerName.endsWith(".dwg")) {
        setHint("در حال خواندن و تبدیل فایل DWG…");
        const form = new FormData();
        form.append("file", file);
        form.append("heightM", String(plan.defaults.wallHeightM));
        form.append("thicknessM", String(plan.defaults.wallThicknessM));
        const response = await fetch("/api/planner/dwg-to-dxf?format=walls", { method: "POST", body: form });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(payload?.error ?? "تبدیل فایل DWG انجام نشد");
        }
        imported = await response.json() as DxfImportResult;
      } else {
        imported = importDxfWalls(await file.text(), {
          heightM: plan.defaults.wallHeightM,
          thicknessM: plan.defaults.wallThicknessM
        });
      }
      // Re-importing a CAD file is an update, not an additive drawing action. Keeping
      // the previous generated walls made a cleaned import look unchanged (and made
      // every retry denser). Preserve manually drawn walls, but replace prior CAD
      // geometry and remove openings that were attached to those old generated walls.
      const previousCadWallIds = new Set(
        activeFloor.walls.filter((wall) => wall.id.startsWith("dxf-wall-")).map((wall) => wall.id)
      );
      const nextFloor = {
        ...activeFloor,
        walls: [
          ...activeFloor.walls.filter((wall) => !previousCadWallIds.has(wall.id)),
          ...imported.walls
        ],
        doors: activeFloor.doors.filter((opening) => !previousCadWallIds.has(opening.wallId)),
        // Dense CAD drawings can contain thousands of wall segments. Running planar
        // room detection synchronously here blocks React before the imported plan is
        // ever committed or rendered. Manual room areas remain available afterward.
        roomDetectionDeferred: imported.discardedSegments > 0 || imported.walls.length >= 400 ? true : activeFloor.roomDetectionDeferred
      };
      if (imported.discardedSegments > 0 || imported.walls.length >= 400) {
        commit({ ...plan, floors: plan.floors.map((floor) => (floor.id === nextFloor.id ? nextFloor : floor)) });
      } else {
        updateFloor(nextFloor);
      }
      setPendingBackdrop(null);
      setViewMode("top");
      setTool("select");
      setSelection(emptySelection);
      setHint(
        `${formatFa(imported.walls.length)} دیوار از ${lowerName.endsWith(".dwg") ? "DWG" : "DXF"} وارد شد · واحد: ${imported.unitLabel} · `
        + `${formatFa(imported.layerCount)} لایه خوانده شد`
        + (imported.detectedPlanGroups > 1 ? ` · از ${formatFa(imported.detectedPlanGroups)} پلان جدا، بزرگ‌ترین پلان وارد شد` : "")
        + (imported.discardedSegments > 0 ? ` · ${formatFa(imported.discardedSegments)} خط تکراری/اضافی حذف شد` : "")
        + (previousCadWallIds.size > 0 ? ` · ${formatFa(previousCadWallIds.size)} دیوار CAD قبلی جایگزین شد` : "")
        + (imported.scaleCorrection > 1 ? ` · مقیاس غیرواقعی فایل ${formatFa(imported.scaleCorrection)} برابر اصلاح شد` : "")
        + (imported.discardedSegments > 0 || imported.walls.length >= 400 ? " · تشخیص خودکار فضاها برای جلوگیری از توقف صفحه به تعویق افتاد" : "")
      );
    } catch (cause) {
      setHint(cause instanceof Error ? cause.message : "خواندن فایل CAD انجام نشد");
    }
  };

  const resetPlan = () => {
    const emptyPlan = createEmptyPlan();
    commit({
      ...emptyPlan,
      // Resetting the drawing is not the same as starting a different project. Keep
      // the programme that drives the checklist and all project-level preferences.
      venueTypeId: plan.venueTypeId,
      customSectionTypes: plan.customSectionTypes?.map((section) => ({ ...section })),
      dismissedSectionIds: plan.dismissedSectionIds ? [...plan.dismissedSectionIds] : undefined,
      gridSizeM: plan.gridSizeM,
      snapM: plan.snapM,
      defaults: { ...plan.defaults }
    });
    setShowResetDialog(false);
    setPendingBackdrop(null);
    setSelection(emptySelection);
    setTool("select");
    setViewMode("top");
    setPreviewFocusFloorId(null);
    setSmartPlacementReport(null);
    setShowCoverage(true);
    setHint("محتوای نقشه پاک شد؛ نوع پروژه و چک‌لیست آن حفظ شده‌اند");
  };

  const backdropControls = pendingBackdrop ?? activeFloor?.backdrop ?? null;

  const updateBackdropAppearance = (patch: Partial<Pick<PlanBackdrop, "metresPerPixel" | "opacity">>) => {
    if (pendingBackdrop) {
      setPendingBackdrop({ ...pendingBackdrop, ...patch });
    } else if (activeFloor?.backdrop) {
      updateFloor({ ...activeFloor, backdrop: { ...activeFloor.backdrop, ...patch } });
    }
  };

  const placePendingBackdrop = (center: Vec2) => {
    if (!pendingBackdrop || !activeFloor) return;
    const widthM = pendingBackdrop.widthPx * pendingBackdrop.metresPerPixel;
    const heightM = pendingBackdrop.heightPx * pendingBackdrop.metresPerPixel;
    updateFloor({
      ...activeFloor,
      backdrop: {
        ...pendingBackdrop,
        originM: { x: center.x - widthM / 2, z: center.z - heightM / 2 },
        calibrated: true
      }
    });
    setPendingBackdrop(null);
    setHint("تصویر روی نقشه قرار گرفت؛ اندازه و شفافیت از پنل سمت راست قابل تنظیم است");
  };

  const startBackdropReposition = () => {
    if (!activeFloor?.backdrop) return;
    setPendingBackdrop({ ...activeFloor.backdrop });
    setViewMode("top");
    setTool("select");
    setSelection(emptySelection);
    setHint("تصویر به ماوس متصل است؛ برای ثبت محل جدید روی نقشه کلیک کنید");
  };

  if (!activeFloor) return null;
  const activeTool = tools.find((item) => item.id === tool);

  return (
    <section className={`plan-designer plan-designer-${mode} plan-designer-${variant}${readOnly ? " plan-designer-readonly" : ""}`}>
      {variant !== "focus" ? <header className="plan-designer-head">
        <span className="plan-designer-head-icon"><Building2 size={20} aria-hidden="true" /></span>
        <div>
          <strong>{mode === "environment" ? "استودیوی طراحی محیط" : "استودیوی جانمایی دوربین"}</strong>
          <small>
            {mode === "environment"
              ? "طبقات، فضاها و تجهیزات را بسازید؛ ابزارها بر اساس کاربرد دسته‌بندی شده‌اند."
              : "دوربین‌ها را روی نقشه قرار دهید، با کشیدن بدنه جابه‌جا و فقط با دستگیره نارنجی بچرخانید."}
          </small>
        </div>
        <div className="plan-designer-head-tips" aria-label="راهنمای تعامل">
          <span><MousePointer2 size={13} aria-hidden="true" />کشیدن بدنه: جابه‌جایی</span>
          <span><RotateCcw size={13} aria-hidden="true" />دستگیره نارنجی: چرخش</span>
        </div>
      </header> : null}
      <div className="plan-floor-rail">
        <div className="plan-floor-switcher">
          <span className="plan-floor-switcher-icon"><Layers size={16} aria-hidden="true" /></span>
          <div>
            <label htmlFor="plan-active-floor">طبقه فعال</label>
            <select
              id="plan-active-floor"
              value={plan.activeFloorId}
              onChange={(event) => {
                const floorId = event.target.value;
                publishPlan({ ...plan, activeFloorId: floorId });
                if (viewMode === "building") setPreviewFocusFloorId(floorId);
                setSelection(emptySelection);
              }}
            >
              {plan.floors.map((floor) => (
                <option key={floor.id} value={floor.id}>{floor.name} · {formatFa(floor.cameras.length)} دوربین</option>
              ))}
            </select>
          </div>
          <span className="plan-floor-position">{formatFa(activeFloorIndex + 1)} از {formatFa(plan.floors.length)}</span>
          <div className="plan-floor-stepper" aria-label="جابه‌جایی بین طبقات">
            <button
              type="button"
              disabled={activeFloorIndex <= 0}
              onClick={() => {
                const floorId = plan.floors[activeFloorIndex - 1]?.id;
                if (floorId) publishPlan({ ...plan, activeFloorId: floorId });
                if (floorId && viewMode === "building") setPreviewFocusFloorId(floorId);
                setSelection(emptySelection);
              }}
              aria-label="طبقه قبلی"
              title="طبقه قبلی"
            ><ChevronRight size={15} aria-hidden="true" /></button>
            <button
              type="button"
              disabled={activeFloorIndex >= plan.floors.length - 1}
              onClick={() => {
                const floorId = plan.floors[activeFloorIndex + 1]?.id;
                if (floorId) publishPlan({ ...plan, activeFloorId: floorId });
                if (floorId && viewMode === "building") setPreviewFocusFloorId(floorId);
                setSelection(emptySelection);
              }}
              aria-label="طبقه بعدی"
              title="طبقه بعدی"
            ><ChevronLeft size={15} aria-hidden="true" /></button>
          </div>
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
            <button type="button" className="plan-reset-all" onClick={() => setShowResetDialog(true)}>
              <RotateCcw size={15} aria-hidden="true" />ریست کل نقشه
            </button>
          </div>
        ) : null}
      </div>

      {readOnly ? null : <div className="plan-toolbar plan-ribbon">
        <section className="plan-ribbon-section plan-ribbon-drawing" aria-label="ترسیم و جانمایی">
          <div className="plan-tool-group">
            {tools.map((item) => {
              const Icon = item.icon;
              if (item.id === "wall") {
                return (
                  <WallToolMenu
                    key={item.id}
                    active={tool === "wall"}
                    mode={wallDrawMode}
                    onSelect={(nextMode) => {
                      setWallDrawMode(nextMode);
                      setTool("wall");
                      setSelection(emptySelection);
                      setHint(isFenceMode(nextMode)
                        ? `دو سر ${fenceWallStyles[nextMode].label} را انتخاب کنید؛ برای گیت، روی آن در بگذارید`
                        : drawsSingleWall(nextMode)
                          ? "گوشه اول و دوم را انتخاب کنید تا یک دیوار خطی رسم شود"
                          : "گوشه اول و مقابل را انتخاب کنید تا چهار دیوار مستطیلی رسم شود");
                    }}
                  />
                );
              }
              if (item.id === "door") {
                return (
                  <DoorToolMenu
                    key={item.id}
                    active={tool === "door"}
                    variant={doorVariant}
                    onSelect={(nextVariant) => {
                      setDoorVariant(nextVariant);
                      setTool("door");
                      setSelection(emptySelection);
                      setHint(`در ${doorVariantLabel(nextVariant)} فعال شد؛ روی دیوار کلیک کنید`);
                    }}
                  />
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`plan-tool-button is-${item.id}${tool === item.id ? " active" : ""}`}
                  onClick={() => { setTool(item.id); setSelection(emptySelection); setHint(item.hint); }}
                  title={item.hint}
                >
                  <span className="plan-tool-icon"><Icon size={17} aria-hidden="true" /></span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <span className="plan-ribbon-label">ترسیم و جانمایی</span>
        </section>

        {mode === "environment" ? (
          <section className="plan-ribbon-section plan-ribbon-essentials" aria-label="عناصر آماده پرکاربرد">
            <div className="plan-tool-group">
              <ObstacleToolMenu group="vehicle" label="خودرو" icon={CarFront} onPick={addPresetObstacle} />
              <ObstacleToolMenu group="structure" label="سازه" icon={ChartNoAxesGantt} onPick={addPresetObstacle} />
              <ObstacleToolMenu group="server-room" label="اتاق سرور" icon={Server} onPick={addPresetObstacle} />
              <button
                type="button"
                className="plan-tool-button is-column"
                title="افزودن ستون سازه‌ای؛ پس از جانمایی، ابعاد و ارتفاع آن قابل ویرایش است"
                onClick={() => {
                  const preset = obstaclePresets.find((item) => item.id === "structural-column");
                  if (preset) addPresetObstacle(preset);
                }}
              >
                <span className="plan-tool-icon"><Cuboid size={17} aria-hidden="true" /></span>
                <span>ستون</span>
              </button>
              <ObstacleToolMenu group="tree" label="درخت" icon={TreePine} onPick={addPresetObstacle} />
            </div>
            <span className="plan-ribbon-label">عناصر آماده</span>
          </section>
        ) : null}

        <section className="plan-ribbon-section plan-ribbon-view" aria-label="نمایش">
          <div className="plan-tool-group">
          <button type="button" className={`plan-view-tool is-map${viewMode === "top" ? " active" : ""}`} onClick={() => setViewMode("top")}>
            <span className="plan-tool-icon"><Grid3x3 size={17} aria-hidden="true" /></span><span>نمای نقشه</span>
          </button>
          <button
            type="button"
            className={`plan-view-tool is-orbit${viewMode === "orbit" ? " active" : ""}`}
            onClick={() => setViewMode("orbit")}
            title="در نمای سه‌بعدی، اسکرول ماوس را نگه دارید و بکشید تا نما بچرخد"
          >
            <span className="plan-tool-icon"><Move3d size={17} aria-hidden="true" /></span><span>نمای سه‌بعدی</span>
          </button>
          <button
            type="button"
            className={`plan-view-tool is-building${viewMode === "building" ? " active" : ""}`}
            onClick={() => {
              setViewMode("building");
              setBuildingFloorFilter("above");
              setPreviewFocusFloorId(null);
              setTool("select");
              setSelection(emptySelection);
              setHint("پیش‌نمایش کلی ساختمان؛ یک طبقه را از پنل کناری انتخاب کنید");
            }}
            title="چیدمان همه طبقات روی یکدیگر"
          >
            <span className="plan-tool-icon"><Building2 size={17} aria-hidden="true" /></span><span>ساختمان</span>
          </button>
          </div>
          <span className="plan-ribbon-label">نمایش</span>
        </section>

        <section className="plan-ribbon-section plan-ribbon-settings" aria-label="تنظیم نقشه">
          <div className="plan-tool-group">
            <label className="plan-snap-field">
              <span>مقیاس طراحی</span>
              <select value={plan.snapM} onChange={(event) => commit({ ...plan, snapM: Number(event.target.value) })}>
                <option value={0}>آزاد</option>
                <option value={0.1}>۱۰ سانتی‌متر</option>
                <option value={0.25}>۲۵ سانتی‌متر</option>
                <option value={0.5}>۵۰ سانتی‌متر</option>
                <option value={1}>۱ متر</option>
              </select>
            </label>
            {mode === "environment" ? (
              <button type="button" className="plan-settings-tool is-upload" onClick={() => fileRef.current?.click()}>
                <span className="plan-tool-icon"><ImageIcon size={17} aria-hidden="true" /></span><span>نقشه / CAD</span>
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,.dxf,.dwg,application/dxf,application/x-dxf,application/acad,application/x-acad,application/autocad_dwg,image/x-dwg"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handlePlanUpload(file);
                event.target.value = "";
              }}
            />
          </div>
          <span className="plan-ribbon-label">تنظیم نقشه</span>
        </section>

        <div className="plan-ribbon-quick plan-history-tools" dir="ltr" aria-label="دسترسی سریع">
          <div className="plan-history-actions">
            <button
              type="button"
              disabled={historyState.past === 0}
              onClick={undo}
              title="واگرد (Ctrl+Z)"
              aria-label="واگرد"
            >
              <Undo2 size={16} aria-hidden="true" /><span>Undo</span>
            </button>
            <button
              type="button"
              disabled={historyState.future === 0}
              onClick={redo}
              title="از نو (Ctrl+Y)"
              aria-label="از نو"
            >
              <Redo2 size={16} aria-hidden="true" /><span>Redo</span>
            </button>
          </div>
          {mode === "environment" ? (
            <button
              type="button"
              dir="rtl"
              className={showAdvancedElements ? "plan-advanced-switch is-active" : "plan-advanced-switch"}
              onClick={() => setShowAdvancedElements((value) => !value)}
              aria-pressed={showAdvancedElements}
              title="نمایش یا پنهان‌سازی دسته‌های تخصصی المان‌ها"
            >
              <span className="plan-advanced-switch-copy">
                <Sparkles size={15} aria-hidden="true" /><span>پیشرفته</span>
              </span>
              <span className="plan-advanced-switch-track" aria-hidden="true"><i /></span>
            </button>
          ) : null}
        </div>
      </div>}

      {mode === "environment" && showAdvancedElements ? (
        <section className="plan-element-strip is-advanced" aria-label="المان‌های پیشرفته">
          <div className="plan-element-strip-label">
            <strong>المان‌های پیشرفته</strong>
            <small>{formatFa(obstaclePresets.filter((item) => !["vehicle", "structure", "tree"].includes(item.group)).length)} المان</small>
          </div>
          <div className="plan-element-strip-grid">
            <ObstacleToolMenu group="living" label="پذیرایی" icon={Sofa} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="bedroom" label="خواب" icon={BedDouble} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="kitchen" label="آشپزخانه" icon={CookingPot} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="office" label="اداری" icon={Armchair} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="retail" label="فروشگاه" icon={ShoppingBag} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="hospitality" label="هتل" icon={Hotel} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="medical" label="درمانی" icon={Hospital} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="public-safety" label="انتظامی" icon={Shield} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="education" label="آموزشی" icon={GraduationCap} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="industrial" label="کارگاه" icon={Factory} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="warehouse" label="انبار" icon={Warehouse} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="utility" label="تأسیسات" icon={Zap} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="transport" label="حمل‌ونقل" icon={Bus} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="parking" label="پارکینگ" icon={CircleParking} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="landscape" label="محوطه" icon={Sprout} onPick={addPresetObstacle} />
            <ObstacleToolMenu group="site" label="تجهیزات" icon={Fence} onPick={addPresetObstacle} />
          </div>
        </section>
      ) : null}

      {variant !== "focus" ? <div className="plan-defaults-section">
        <button
          type="button"
          className={showDefaults ? "plan-defaults-toggle active" : "plan-defaults-toggle"}
          onClick={() => setShowDefaults((value) => !value)}
          aria-expanded={showDefaults}
        >
          <Settings2 size={16} aria-hidden="true" />
          <span>تنظیمات پیش‌فرض طراحی</span>
        </button>
        {showDefaults ? (
          <div className="plan-defaults-panel">
            <div>
              <strong>پیش‌فرض آیتم‌های جدید</strong>
              <small>آیتم‌های موجود تغییر نمی‌کنند و هرکدام از پنل مشخصات قابل ویرایش‌اند.</small>
            </div>
            <DefaultNumberField
              label="ارتفاع دیوار"
              value={designDefaults.wallHeightM}
              min={0.3}
              max={12}
              step={0.1}
              onChange={(wallHeightM) => commit({ ...plan, defaults: { ...designDefaults, wallHeightM } })}
            />
            <DefaultNumberField
              label="ضخامت دیوار"
              value={designDefaults.wallThicknessM}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(wallThicknessM) => commit({ ...plan, defaults: { ...designDefaults, wallThicknessM } })}
            />
            <DefaultNumberField
              label="ارتفاع مانع"
              value={designDefaults.obstacleHeightM}
              min={0.1}
              max={12}
              step={0.1}
              onChange={(obstacleHeightM) => commit({ ...plan, defaults: { ...designDefaults, obstacleHeightM } })}
            />
            <DefaultNumberField
              label="ارتفاع نصب دوربین"
              value={designDefaults.cameraMountHeightM}
              min={1}
              max={15}
              step={0.1}
              onChange={(cameraMountHeightM) => commit({ ...plan, defaults: { ...designDefaults, cameraMountHeightM } })}
            />
          </div>
        ) : null}
      </div> : null}

      <div className={mode === "cameras" ? "plan-workspace plan-workspace-cameras" : "plan-workspace plan-workspace-venue"}>
        {mode === "environment" && viewMode !== "building" ? (
          <div className="plan-venue-rail">
            <VenuePanel
              floor={activeFloor}
              floors={plan.floors}
              venueTypeId={plan.venueTypeId}
              customSectionTypes={plan.customSectionTypes ?? []}
              dismissedSectionIds={plan.dismissedSectionIds ?? []}
              onVenueChange={setVenueType}
              onDismissSection={dismissSection}
              onResolveOpenRegion={resolveOpenRegion}
              onFocusSection={focusSection}
              compact={variant === "focus"}
            />
          </div>
        ) : null}
        {mode === "cameras" ? (
          <div className="plan-camera-library">
            <section className="smart-placement-panel">
              <div className="smart-placement-heading">
                <span className="smart-placement-icon"><Sparkles size={17} aria-hidden="true" /></span>
                <div>
                  <strong>بهینه‌ساز جانمایی هوشمند</strong>
                  <small>تحلیل دیوار، ورودی، مانع، PPM، هم‌پوشانی و نقاط کور</small>
                </div>
                <em>قرارگیری پیشنهادی</em>
              </div>
              <div className="smart-placement-actions">
                <button
                  type="button"
                  className="smart-placement-action"
                  onClick={runSmartPlacement}
                  disabled={isOptimisingPlacement}
                  title={smartPlacementErrors.length > 0 ? `نیازمند اصلاح نقشه: ${smartPlacementErrors[0]}` : undefined}
                >
                  <Sparkles className={isOptimisingPlacement ? "is-spinning" : undefined} size={16} aria-hidden="true" />
                  {isOptimisingPlacement ? "در حال تحلیل عمیق نقشه..." : "تحلیل و ساخت چیدمان پیشنهادی"}
                </button>
                <button
                  type="button"
                  className="smart-placement-reset"
                  onClick={resetPlacement}
                  disabled={isOptimisingPlacement || placedCameraCount === 0}
                  title="فقط دوربین‌های همه طبقات پاک می‌شوند و با Ctrl+Z قابل بازگردانی است"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  ریست جانمایی دوربین‌ها
                  {placedCameraCount > 0 ? <small>{formatFa(placedCameraCount)}</small> : null}
                </button>
              </div>
              {smartPlacementErrors.length > 0 ? (
                <small className="plan-room-alert">{smartPlacementErrors[0]}</small>
              ) : null}
              <p>دوربین‌های موجود ثابت می‌مانند؛ فقط موارد جانمایی‌نشده با یک عملیات قابل Undo اضافه می‌شوند.</p>
              {smartPlacementReport ? (
                <div className="smart-placement-result" role="status">
                  <div className="smart-placement-metrics">
                    <span><strong>{formatFa(smartPlacementReport.placed)}</strong> دوربین جدید</span>
                    <span><strong>{formatFa(smartPlacementReport.coverageBeforePercent, 0)}٪</strong> پوشش قبل</span>
                    <span className="is-improved"><strong>{formatFa(smartPlacementReport.coverageAfterPercent, 0)}٪</strong> پوشش پیشنهادی</span>
                  </div>
                  {smartPlacementReport.floorReports.some((floor) => floor.placed > 0) ? (
                    <div className="smart-placement-floors">
                      {smartPlacementReport.floorReports.filter((floor) => floor.placed > 0).map((floor) => (
                        <span key={floor.floorId}>
                          <b>{floor.floorName}</b>
                          {formatFa(floor.placed)} دوربین · {formatFa(floor.coverageAfterPercent, 0)}٪
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {smartPlacementReport.warnings.map((warning) => <small key={warning}>{warning}</small>)}
                </div>
              ) : null}
            </section>
            <CameraPalette templates={cameraTemplates} placedByTemplate={placedByTemplate} />
          </div>
        ) : null}
        <PlanCanvas
          key={viewMode === "building" ? "building-preview" : activeFloor.id}
          floor={activeFloor}
          tool={tool}
          wallDrawMode={wallDrawMode}
          doorVariant={doorVariant}
          viewMode={viewMode}
          selection={selection}
          snapM={plan.snapM}
          defaults={designDefaults}
          readOnly={readOnly || viewMode === "building"}
          buildingFloors={viewMode === "building" ? buildingPreviewFloors : undefined}
          focusedFloorId={viewMode === "building" ? previewFocusFloorId : null}
          referenceFloor={viewMode !== "building" && mode === "environment" ? referenceFloor : null}
          pendingBackdrop={pendingBackdrop}
          showCoverage={mode === "cameras" && showCoverage}
          palette={variant === "focus" ? "studio" : "classic"}
          customSectionTypes={plan.customSectionTypes}
          onSelect={setSelection}
          onFloorChange={updateFloor}
          onHint={setHint}
          onPointerPlanPosition={(position) => { pointerPlanPositionRef.current = position; }}
          onDropCamera={mode === "cameras" ? placeTemplateCamera : undefined}
          onDropPreset={mode === "environment" ? dropPresetObstacle : undefined}
          onPlaceBackdrop={placePendingBackdrop}
          onCancelBackdropPlacement={() => {
            setPendingBackdrop(null);
            setHint(activeFloor.backdrop ? "جابه‌جایی تصویر لغو شد" : "ورود تصویر لغو شد");
          }}
          onCancelInteraction={() => {
            setSelection(emptySelection);
            setTool("select");
            setHint(null);
          }}
        />
        <div className="plan-workspace-sidebar">
          {viewMode === "building" ? (
            <BuildingPreviewPanel
              floors={buildingPreviewFloors}
              floorFilter={buildingFloorFilter}
              focusedFloorId={previewFocusFloorId}
              onFilterChange={(filter) => {
                setBuildingFloorFilter(filter);
                setPreviewFocusFloorId(null);
              }}
              onFocus={(floorId) => {
                setPreviewFocusFloorId(floorId);
                if (floorId) publishPlan({ ...plan, activeFloorId: floorId });
              }}
            />
          ) : null}
          {viewMode !== "building" && referenceFloor ? (
            <div className="plan-floor-reference-note">
              <Layers size={16} aria-hidden="true" />
              <div><strong>محدوده طبقه زیرین</strong><span>خط قرمز، مرز «{referenceFloor.name}» است؛ بهتر است دیوارهای این طبقه داخل آن بمانند.</span></div>
            </div>
          ) : null}
          {viewMode !== "building" && backdropControls ? (
            <BackdropControls
              backdrop={backdropControls}
              isPlacing={Boolean(pendingBackdrop)}
              onWidthChange={(widthM) => updateBackdropAppearance({ metresPerPixel: widthM / backdropControls.widthPx })}
              onOpacityChange={(opacity) => updateBackdropAppearance({ opacity })}
              onReposition={startBackdropReposition}
              onCancel={() => {
                setPendingBackdrop(null);
                setHint(activeFloor.backdrop ? "جابه‌جایی تصویر لغو شد" : "ورود تصویر لغو شد");
              }}
              onRemove={() => {
                setPendingBackdrop(null);
                updateFloor({ ...activeFloor, backdrop: undefined });
                setHint("تصویر پس‌زمینه حذف شد");
              }}
            />
          ) : null}
          {viewMode !== "building" ? <PlanInspector
            floor={activeFloor}
            selection={selection}
            activeTool={tool}
            wallDrawMode={wallDrawMode}
            doorVariant={doorVariant}
            onDoorVariantChange={setDoorVariant}
            defaults={designDefaults}
            venueTypeId={plan.venueTypeId}
            customSectionTypes={plan.customSectionTypes ?? []}
            onDefaultsChange={(patch) => commit({ ...plan, defaults: { ...designDefaults, ...patch } })}
            onFloorChange={updateFloor}
            onCustomSectionType={addCustomSectionType}
            onSelect={setSelection}
          /> : null}
        </div>
      </div>

      {pendingRoomCount > 0 ? (
        <div className="plan-closure-warning plan-room-warning" role="status">
          <TriangleAlert size={17} aria-hidden="true" />
          <div>
            <strong>{formatFa(pendingRoomCount)} فضا در کل پروژه هنوز نوع ندارد</strong>
            <span>
              طبقات درگیر: {Array.from(new Set(pendingRooms.map(({ floor }) => floor.name))).join("، ")}. مرز این فضاها قرمز است؛ روی هرکدام کلیک کنید و نوعش را از پنل سمت راست انتخاب کنید.
            </span>
          </div>
        </div>
      ) : null}

      {activeFloor.walls.length > 0 && !hasClosedPerimeter ? (
        <div className="plan-closure-warning" role="status">
          <TriangleAlert size={17} aria-hidden="true" />
          <div>
            <strong>مساحت هنوز قابل محاسبه نیست</strong>
            <span>دیوارها باید یک محیط کاملاً بسته بسازند؛ انتهای آخرین دیوار را به نقطه شروع متصل کنید.</span>
          </div>
        </div>
      ) : null}

      <div className="plan-statusbar">
        <span className="plan-hint">{hint ?? activeTool?.hint}</span>
        {mode === "cameras" ? (
          <button
            type="button"
            className={showCoverage ? "plan-coverage-toggle active" : "plan-coverage-toggle"}
            onClick={() => setShowCoverage((value) => !value)}
            aria-pressed={showCoverage}
          >
            <span className="plan-toggle-track" aria-hidden="true"><i /></span>
            <Eye size={14} aria-hidden="true" />
            پوشش DORI
          </button>
        ) : null}
        <div className="plan-metrics">
          <span className="plan-grid-readout" title="خطوط پررنگ شبکه هر ۵ متر تکرار می‌شوند">
            <Grid3x3 size={13} aria-hidden="true" />
            شبکه {formatFa(plan.gridSizeM)} متر · مقیاس طراحی {plan.snapM > 0 ? `${formatFa(plan.snapM)} متر` : "آزاد"}
          </span>
          <span>
            <strong>{hasClosedPerimeter ? formatFa(areaM2, 1) : "—"}</strong>
            {hasClosedPerimeter ? " متر مربع" : " مساحت نامعتبر"}
          </span>
          <span><strong>{formatFa(activeFloor.walls.length)}</strong> دیوار</span>
          <span><strong>{formatFa((activeFloor.doors ?? []).length)}</strong> در</span>
          <span><strong>{formatFa(activeFloor.obstacles.length)}</strong> مانع</span>
          <span><strong>{formatFa(activeFloor.cameras.length)}</strong> دوربین</span>
          {coverage ? <span title={coverage.hasPtzPatrol ? "شامل محدوده بالقوه گشت PTZ؛ همه جهت‌ها هم‌زمان دیده نمی‌شوند" : undefined}><strong>{formatFa(coverage.coveredPercent, 0)}٪</strong> {coverage.hasPtzPatrol ? "پوشش بالقوه" : "پوشش"}</span> : null}
          {coverage ? <span><strong>{formatFa(coverage.identifyPercent, 0)}٪</strong> سطح شناسایی</span> : null}
        </div>
      </div>

      {showResetDialog ? (
        <div
          className="plan-reset-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setShowResetDialog(false)}
        >
          <section
            className="plan-reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-reset-dialog-title"
            aria-describedby="plan-reset-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="plan-reset-dialog-close"
              onClick={() => setShowResetDialog(false)}
              aria-label="بستن"
            >
              <X size={17} aria-hidden="true" />
            </button>
            <div className="plan-reset-dialog-icon"><RotateCcw size={24} aria-hidden="true" /></div>
            <div className="plan-reset-dialog-copy">
              <h2 id="plan-reset-dialog-title">ریست محتوای نقشه؟</h2>
              <p id="plan-reset-dialog-description">
                تمام طبقات، دیوارها، درها، پنجره‌ها، تجهیزات، دوربین‌ها و تصویر زمینه پاک می‌شوند.
              </p>
              <span><Shield size={14} aria-hidden="true" />نوع پروژه و چک‌لیست انتخاب‌شده حفظ خواهند شد.</span>
            </div>
            <div className="plan-reset-dialog-actions">
              <button type="button" className="is-cancel" onClick={() => setShowResetDialog(false)}>انصراف</button>
              <button type="button" className="is-confirm" onClick={resetPlan}>
                <RotateCcw size={15} aria-hidden="true" />ریست نقشه
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

const doorToolVariants: {
  id: PlanDoorVariant;
  label: string;
  description: string;
  width: string;
  glass: boolean;
}[] = [
  { id: "single-solid", label: "در معمولی تک‌لنگه", description: "یک لنگه با لولای قابل‌تنظیم", width: "0.9 m", glass: false },
  { id: "double-solid", label: "در معمولی دولنگه", description: "دو لنگه با بازشدن از مرکز", width: "1.8 m", glass: false },
  { id: "single-glass", label: "در شیشه‌ای تک‌لنگه", description: "یک لنگه شفاف با قاب فلزی", width: "0.9 m", glass: true },
  { id: "double-glass", label: "در شیشه‌ای دولنگه", description: "دو لنگه شفاف، بازشو از وسط", width: "1.8 m", glass: true }
];

const doorVariantLabel = (variant: PlanDoorVariant) =>
  doorToolVariants.find((item) => item.id === variant)?.label ?? "معمولی تک‌لنگه";

/** Hover/focus menu that makes the available door constructions visible at the tool itself. */
function DoorToolMenu({
  active,
  variant,
  onSelect
}: {
  active: boolean;
  variant: PlanDoorVariant;
  onSelect: (variant: PlanDoorVariant) => void;
}) {
  return (
    <div className="plan-object-tool-menu plan-door-tool-menu">
      <button
        type="button"
        className={active ? "plan-object-tool-trigger plan-tool-button is-door active" : "plan-object-tool-trigger plan-tool-button is-door"}
        onClick={() => onSelect(variant)}
        aria-haspopup="menu"
        title="برای دیدن انواع در، نشانگر را روی این ابزار نگه دارید"
      >
        <span className="plan-tool-icon"><DoorOpen className="plan-object-tool-main-icon" size={17} aria-hidden="true" /></span>
        <span>در</span>
        <ChevronDown className="plan-object-tool-chevron" size={11} aria-hidden="true" />
      </button>
      <div className="plan-object-tool-popover plan-door-mode-popover" role="menu" aria-label="انتخاب نوع در">
        <div className="plan-object-tool-popover-title">
          <DoorOpen size={17} aria-hidden="true" />
          <div><strong>انواع در</strong><small>نوع موردنظر را انتخاب و سپس روی دیوار کلیک کنید</small></div>
        </div>
        {doorToolVariants.map((item) => {
          const Icon = item.glass ? Blinds : DoorOpen;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={variant === item.id}
              className={variant === item.id ? "active" : ""}
              onClick={() => onSelect(item.id)}
            >
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <em>{item.width}</em>
              <Icon size={17} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WallToolMenu({
  active,
  mode,
  onSelect
}: {
  active: boolean;
  mode: WallDrawMode;
  onSelect: (mode: WallDrawMode) => void;
}) {
  return (
    <div className="plan-object-tool-menu plan-wall-tool-menu">
      <button
        type="button"
        className={active ? "plan-object-tool-trigger plan-tool-button is-wall active" : "plan-object-tool-trigger plan-tool-button is-wall"}
        onClick={() => onSelect(mode)}
        aria-haspopup="menu"
        title="انتخاب روش رسم دیوار"
      >
        <span className="plan-tool-icon"><BrickWall className="plan-object-tool-main-icon" size={17} aria-hidden="true" /></span>
        <span>دیوار</span>
        <ChevronDown className="plan-object-tool-chevron" size={11} aria-hidden="true" />
      </button>
      <div className="plan-object-tool-popover plan-wall-mode-popover" role="menu" aria-label="روش رسم دیوار">
        <div className="plan-object-tool-popover-title">
          <BrickWall size={17} aria-hidden="true" />
          <div><strong>روش رسم دیوار</strong><small>حالت موردنظر را انتخاب کنید</small></div>
        </div>
        <button type="button" className={mode === "line" ? "active" : ""} role="menuitem" onClick={() => onSelect("line")}>
          <span><strong>دیوار خطی</strong><small>رسم یک دیوار بین دو نقطه</small></span>
          <Minus size={18} aria-hidden="true" />
        </button>
        <button type="button" className={mode === "rectangle" ? "active" : ""} role="menuitem" onClick={() => onSelect("rectangle")}>
          <span><strong>رسم مستطیل</strong><small>رسم هم‌زمان چهار دیوار با تعیین دو گوشه</small></span>
          <Square size={17} aria-hidden="true" />
        </button>
        <button type="button" className={mode === "glass" ? "active" : ""} role="menuitem" onClick={() => onSelect("glass")}>
          <span><strong>جدار شیشه‌ای</strong><small>مرز شفاف؛ دید دوربین از آن عبور می‌کند</small></span>
          <Blinds size={17} aria-hidden="true" />
        </button>
        <button type="button" className={mode === "fence-mesh" ? "active" : ""} role="menuitem" onClick={() => onSelect("fence-mesh")}>
          <span><strong>{fenceWallStyles["fence-mesh"].label}</strong><small>{fenceWallStyles["fence-mesh"].description}</small></span>
          <Fence size={17} aria-hidden="true" />
        </button>
        <button type="button" className={mode === "fence-wall" ? "active" : ""} role="menuitem" onClick={() => onSelect("fence-wall")}>
          <span><strong>{fenceWallStyles["fence-wall"].label}</strong><small>{fenceWallStyles["fence-wall"].description}</small></span>
          <BrickWall size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Preset picker for one category.
 *
 * Each category gets its own trigger so a room's contents are one click away rather than
 * buried in a section of a combined list. Rows are direct children of the popover, which
 * is what the row grid styling targets.
 */
function ObstacleToolMenu({
  group,
  label,
  icon: Icon,
  onPick
}: {
  group: ObstacleGroup;
  label: string;
  icon: typeof CarFront;
  onPick: (preset: ObstaclePreset) => void;
}) {
  const presets = obstaclePresets.filter((preset) => preset.group === group);
  const [preferredPresetId, setPreferredPresetId] = useState(() => presets[0]?.id ?? "");
  if (!presets.length) return null;
  const preferredPreset = presets.find((preset) => preset.id === preferredPresetId) ?? presets[0];
  const pickPreset = (preset: ObstaclePreset) => {
    setPreferredPresetId(preset.id);
    onPick(preset);
  };

  return (
    <div className={`plan-object-tool-menu is-${group}`}>
      <button
        type="button"
        className="plan-object-tool-trigger plan-preset-tool"
        aria-haspopup="menu"
        title={`افزودن ${preferredPreset.label} — برای دیدن انواع، نشانگر را روی ابزار نگه دارید`}
        onClick={() => pickPreset(preferredPreset)}
      >
        <span className="plan-tool-icon"><Icon className="plan-object-tool-main-icon" size={17} aria-hidden="true" /></span>
        <span>{label}</span>
        <ChevronDown className="plan-object-tool-chevron" size={11} aria-hidden="true" />
      </button>
      <div className="plan-object-tool-popover" role="menu" aria-label={`عناصر ${label}`}>
        <div className="plan-object-tool-popover-title">
          <Icon size={17} aria-hidden="true" />
          <div><strong>افزودن {label}</strong><small>کلیک کنید یا روی نقشه بکشید</small></div>
        </div>
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="menuitem"
            draggable
            onDragStart={(event) => startPresetDrag(event, preset)}
            onDragEnd={() => document.querySelector(".preset-drag-ghost")?.remove()}
            onClick={() => pickPreset(preset)}
          >
            <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
            <em>{preset.widthM} × {preset.depthM} × {preset.heightM} m</em>
            <Plus size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Drag payload for dropping a preset straight onto the plan. */
function startPresetDrag(event: React.DragEvent, preset: ObstaclePreset) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/x-hamyar-preset", preset.id);
  event.dataTransfer.setData("text/plain", preset.label);
  document.querySelector(".preset-drag-ghost")?.remove();
  const ghost = document.createElement("div");
  ghost.className = "preset-drag-ghost";
  ghost.textContent = preset.label;
  ghost.setAttribute("aria-hidden", "true");
  document.body.append(ghost);
  event.dataTransfer.setDragImage(ghost, 12, 12);
}

function BuildingPreviewPanel({
  floors,
  floorFilter,
  focusedFloorId,
  onFilterChange,
  onFocus
}: {
  floors: FloorPlan[];
  floorFilter: BuildingFloorFilter;
  focusedFloorId: string | null;
  onFilterChange: (filter: BuildingFloorFilter) => void;
  onFocus: (floorId: string | null) => void;
}) {
  return (
    <aside className="building-preview-panel">
      <header>
        <span><Building2 size={19} aria-hidden="true" /></span>
        <div><strong>طبقات ساختمان</strong><small>طبقه انتخابی واضح و سایر طبقات شفاف نمایش داده می‌شوند.</small></div>
      </header>
      <div className="building-preview-filters" role="group" aria-label="محدوده نمایش طبقات">
        <button type="button" className={floorFilter === "above" ? "active" : ""} onClick={() => onFilterChange("above")}>روی زمین</button>
        <button type="button" className={floorFilter === "below" ? "active" : ""} onClick={() => onFilterChange("below")}>زیرزمین</button>
        <button type="button" className={floorFilter === "all" ? "active" : ""} onClick={() => onFilterChange("all")}>همه</button>
      </div>
      <button
        type="button"
        className={focusedFloorId === null ? "building-preview-all active" : "building-preview-all"}
        onClick={() => onFocus(null)}
      >
        <Layers size={15} aria-hidden="true" />نمایش هم‌زمان طبقات این گروه
      </button>
      <div className="building-preview-floor-list">
        {[...floors].reverse().map((floor, reverseIndex) => {
          const floorNumber = floors.length - reverseIndex;
          const focused = floor.id === focusedFloorId;
          return (
            <button key={floor.id} type="button" className={focused ? "active" : ""} onClick={() => onFocus(floor.id)}>
              <span className="building-floor-index">{formatFa(floorNumber)}</span>
              <span><strong>{floor.name}</strong><small>تراز {formatFa(floor.elevationM, 1)} متر · ارتفاع {formatFa(floor.heightM, 1)} متر</small></span>
              <Eye size={15} aria-hidden="true" />
            </button>
          );
        })}
        {floors.length === 0 ? <div className="building-preview-empty">طبقه‌ای در این گروه وجود ندارد.</div> : null}
      </div>
      <p>انتخاب طبقه، مختصات افقی آن را تغییر نمی‌دهد؛ بنابراین هنگام بازگشت به نمای نقشه دقیقاً در محل قبلی باقی می‌ماند.</p>
    </aside>
  );
}

function startCameraDrag(event: React.DragEvent, payloadId: string, housing: string) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/x-hamyar-camera", payloadId);
  event.dataTransfer.setData("text/plain", payloadId);
  document.querySelector(".camera-drag-ghost")?.remove();
  const ghost = document.createElement("div");
  ghost.className = `camera-drag-ghost is-${housing}`;
  ghost.setAttribute("aria-hidden", "true");
  const coverage = document.createElement("span");
  coverage.className = "camera-drag-ghost-coverage";
  const body = document.createElement("span");
  body.className = "camera-drag-ghost-body";
  const lens = document.createElement("span");
  lens.className = "camera-drag-ghost-lens";
  const bracket = document.createElement("span");
  bracket.className = "camera-drag-ghost-bracket";
  body.append(lens);
  ghost.append(coverage, bracket, body);
  document.body.append(ghost);
  event.dataTransfer.setDragImage(ghost, 24, 32);
}

/**
 * Palette of device types.
 *
 * Each entry is a reusable type rather than a single reserved camera, so the counter
 * shows progress against the planned quantity instead of locking after one use.
 */
function CameraPalette({
  templates,
  placedByTemplate
}: {
  templates: ProjectCameraTemplate[];
  placedByTemplate: Map<string, number>;
}) {
  return (
    <aside className="camera-inventory" aria-label="دستگاه‌های تعریف‌شده">
      <header>
        <CameraIcon size={18} aria-hidden="true" />
        <div><strong>دستگاه‌های تعریف‌شده</strong><small>نوع دستگاه را بکشید و روی نقشه رها کنید</small></div>
      </header>

      {templates.length > 0 ? (
        <div className="camera-inventory-list">
          {templates.map((template) => {
            const placed = placedByTemplate.get(template.id) ?? 0;
            const complete = placed >= template.quantity;
            return (
              <button
                key={template.id}
                type="button"
                className={complete ? "camera-inventory-card is-complete" : "camera-inventory-card"}
                draggable
                onDragStart={(event) => startCameraDrag(event, template.id, template.housing)}
                onDragEnd={() => document.querySelector(".camera-drag-ghost")?.remove()}
                title="برای جانمایی روی نقشه بکشید — این نوع دستگاه محدودیت تعداد ندارد"
              >
                <CameraIcon size={17} aria-hidden="true" />
                <span>
                  <strong>{template.label}</strong>
                  <small>{template.megapixel}MP · {template.focalMm}mm · {housingLabels[template.housing]}</small>
                </span>
                <em className={complete ? "camera-inventory-count is-complete" : "camera-inventory-count"}>
                  {formatFa(placed)} / {formatFa(template.quantity)}
                </em>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="camera-inventory-empty">در مرحله «دستگاه‌های پیش‌فرض» حداقل یک نوع دستگاه تعریف کنید.</p>
      )}

      <button
        type="button"
        className="camera-inventory-card is-blank"
        draggable
        onDragStart={(event) => startCameraDrag(event, BLANK_CAMERA_ID, "turret")}
        onDragEnd={() => document.querySelector(".camera-drag-ghost")?.remove()}
        title="دوربینی خارج از انواع تعریف‌شده اضافه کنید"
      >
        <Plus size={17} aria-hidden="true" />
        <span><strong>دوربین سفارشی</strong><small>بدون نوع از پیش تعریف‌شده</small></span>
      </button>
    </aside>
  );
}

function DefaultNumberField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="plan-default-number">
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
          }}
        />
        <small>متر</small>
      </div>
    </label>
  );
}

function BackdropControls({
  backdrop,
  isPlacing,
  onWidthChange,
  onOpacityChange,
  onReposition,
  onCancel,
  onRemove
}: {
  backdrop: PlanBackdrop;
  isPlacing: boolean;
  onWidthChange: (widthM: number) => void;
  onOpacityChange: (opacity: number) => void;
  onReposition: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const widthM = backdrop.widthPx * backdrop.metresPerPixel;
  return (
    <aside className={isPlacing ? "plan-backdrop-controls is-placing" : "plan-backdrop-controls"}>
      <header>
        <ImageIcon size={17} aria-hidden="true" />
        <div>
          <strong>{isPlacing ? "جای‌گذاری تصویر" : "تصویر زمینه نقشه"}</strong>
          <small>{isPlacing ? "تصویر را با ماوس حرکت دهید و روی محل دلخواه کلیک کنید" : "اندازه و شفافیت تصویر را تنظیم کنید"}</small>
        </div>
        <button type="button" className="plan-remove-backdrop" onClick={onRemove} title="حذف تصویر" aria-label="حذف تصویر">
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </header>
      <label>
        <span><b>عرض تصویر</b><output>{formatFa(widthM, 1)} متر</output></span>
        <input type="range" min={2} max={200} step={0.5} value={widthM} onChange={(event) => onWidthChange(Number(event.target.value))} />
      </label>
      <label>
        <span><b>شفافیت</b><output>{formatFa(backdrop.opacity * 100, 0)}٪</output></span>
        <input type="range" min={0.15} max={1} step={0.05} value={backdrop.opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} />
      </label>
      <div className="plan-backdrop-actions">
        {isPlacing ? (
          <button type="button" onClick={onCancel}>لغو جای‌گذاری</button>
        ) : (
          <button type="button" onClick={onReposition}><Move3d size={14} aria-hidden="true" />جابه‌جایی تصویر</button>
        )}
      </div>
    </aside>
  );
}
