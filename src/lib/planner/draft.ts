import type { BuildingPlan } from "@/src/domain/planner/types";

/**
 * A local safety copy of a design that has not been saved to the account yet.
 *
 * Saved projects are protected by the server autosave, but a new design only reaches the
 * server when the user presses «ذخیره» the first time; until then a closed tab or a refresh
 * would lose it. The draft lives in this browser only (it never touches the server, so it
 * does not count against the per-account project limit), there is one slot, and it is
 * cleared once the design is saved or the user discards it.
 */

export const PLANNER_DRAFT_KEY = "hamyar-planner-draft-v1";

/** Where the user was, so a restored draft opens in the same studio. */
export type DraftStage = "design" | "cameras";

export type PlannerDraft<Brief = unknown> = {
  version: 1;
  /** The design session that wrote it, so saving one design never clears another one's draft. */
  id: string;
  savedAt: string;
  projectName: string;
  brief: Brief;
  plan: BuildingPlan;
  experience: "simple" | "advanced";
  stage: DraftStage;
  /** True when a scanned plan image was too large to keep and was left out. */
  backdropDropped?: boolean;
};

export type DraftSummary = {
  savedAt: string;
  projectName: string;
  venueTypeId?: string;
  floors: number;
  walls: number;
  /** Furniture, columns and other obstacles. */
  elements: number;
  rooms: number;
  cameras: number;
  stage: DraftStage;
  backdropDropped: boolean;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Backdrop images larger than this are left out of the draft; browser storage is small. */
const MAX_INLINE_BACKDROP_CHARS = 1_500_000;

function storage(override?: DraftStorage): DraftStorage | null {
  if (override) return override;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Whether there is anything on the plan worth keeping. */
export function planHasContent(plan: BuildingPlan | null | undefined): boolean {
  return (plan?.floors ?? []).some((floor) =>
    floor.walls.length > 0
    || floor.cameras.length > 0
    || floor.obstacles.length > 0
    || floor.doors.length > 0
    || (floor.rooms?.length ?? 0) > 0
    || Boolean(floor.backdrop)
  );
}

/** Drops inline scanned drawings that would not fit in browser storage. */
function withoutLargeBackdrops(plan: BuildingPlan): { plan: BuildingPlan; dropped: boolean } {
  let dropped = false;
  const floors = plan.floors.map((floor) => {
    const url = floor.backdrop?.imageUrl;
    if (!url || !url.startsWith("data:") || url.length <= MAX_INLINE_BACKDROP_CHARS) return floor;
    dropped = true;
    const { backdrop: _dropped, ...rest } = floor;
    void _dropped;
    return rest;
  });
  return { plan: dropped ? { ...plan, floors } : plan, dropped };
}

export function writePlannerDraft<Brief>(
  draft: Omit<PlannerDraft<Brief>, "version" | "savedAt" | "backdropDropped">,
  override?: DraftStorage
): boolean {
  const store = storage(override);
  if (!store) return false;
  const { plan, dropped } = withoutLargeBackdrops(draft.plan);
  const record: PlannerDraft<Brief> = {
    ...draft,
    plan,
    version: 1,
    savedAt: new Date().toISOString(),
    ...(dropped ? { backdropDropped: true } : {})
  };
  try {
    store.setItem(PLANNER_DRAFT_KEY, JSON.stringify(record));
    return true;
  } catch {
    // Quota exceeded even without the large images: try once more with no images at all.
    try {
      const bare = { ...record, plan: { ...plan, floors: plan.floors.map(({ backdrop: _b, ...floor }) => { void _b; return floor; }) }, backdropDropped: true };
      store.setItem(PLANNER_DRAFT_KEY, JSON.stringify(bare));
      return true;
    } catch {
      return false;
    }
  }
}

export function readPlannerDraft<Brief = unknown>(override?: DraftStorage): PlannerDraft<Brief> | null {
  const store = storage(override);
  if (!store) return null;
  try {
    const raw = store.getItem(PLANNER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannerDraft<Brief>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.plan?.floors) || !planHasContent(parsed.plan)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Clears the draft; with `onlyId`, only if it is that session's draft. */
export function clearPlannerDraft(onlyId?: string, override?: DraftStorage) {
  try {
    const store = storage(override);
    if (!store) return;
    if (onlyId !== undefined && readPlannerDraft(store)?.id !== onlyId) return;
    store.removeItem(PLANNER_DRAFT_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

export function summariseDraft(draft: PlannerDraft): DraftSummary {
  const floors = draft.plan.floors;
  return {
    savedAt: draft.savedAt,
    projectName: draft.projectName,
    venueTypeId: draft.plan.venueTypeId,
    floors: floors.length,
    walls: floors.reduce((sum, floor) => sum + floor.walls.length, 0),
    elements: floors.reduce((sum, floor) => sum + floor.obstacles.length, 0),
    rooms: floors.reduce((sum, floor) => sum + (floor.rooms?.length ?? 0), 0),
    cameras: floors.reduce((sum, floor) => sum + floor.cameras.length, 0),
    stage: draft.stage,
    backdropDropped: Boolean(draft.backdropDropped)
  };
}
