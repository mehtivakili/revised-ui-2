import type { PlanWall, PlanWallVariant, WallDrawMode } from "@/src/domain/planner/types";

/**
 * Site boundary types offered by the wall tool.
 *
 * They match the fence presets in the object library, so a boundary drawn with the wall
 * tool and one assembled from fence objects look and behave the same: the mesh fence is
 * see-through, the boundary wall hides what is behind it.
 */
export const fenceWallStyles: Record<PlanWallVariant, {
  label: string;
  description: string;
  heightM: number;
  thicknessM: number;
  blocksView: boolean;
}> = {
  "fence-mesh": {
    label: "حصار توری",
    description: "مرز محوطه با پایه؛ دید دوربین از آن عبور می‌کند",
    heightM: 2,
    thicknessM: 0.1,
    blocksView: false
  },
  "fence-wall": {
    label: "دیوار محوطه",
    description: "دیوار بلوکی دور سایت؛ مانع دید دوربین",
    heightM: 2.2,
    thicknessM: 0.25,
    blocksView: true
  }
};

/** Every draw mode except the rectangle places one wall between two points. */
export function drawsSingleWall(mode: WallDrawMode): boolean {
  return mode !== "rectangle";
}

export function isFenceMode(mode: WallDrawMode): mode is PlanWallVariant {
  return mode === "fence-mesh" || mode === "fence-wall";
}

/** What a wall is, for labels: building wall, glazing or one of the boundary types. */
export function wallTypeLabel(wall: PlanWall): string {
  if (wall.variant) return fenceWallStyles[wall.variant].label;
  return wall.blocksView ? "دیوار ساختمان" : "جدار شیشه‌ای";
}
