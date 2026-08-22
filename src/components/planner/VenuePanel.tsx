"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Check, EyeOff, Minus, Search, Split, SquareDashed } from "lucide-react";
import type { CustomSectionRecord, FloorPlan, PlanRoom } from "@/src/domain/planner/types";
import {
  findVenueType,
  minimumAutocompleteLength,
  searchVenueTypes,
  sectionPriorityLabels,
  sectionsForVenue,
  venueTypes,
  type SectionPriority,
  type SectionType,
  type VenueType
} from "@/src/domain/planner/venues";
import { detectRooms, type OpenRegion } from "@/src/lib/planner/rooms";
import { roomCoverageForGoal } from "@/src/lib/planner/coverage";
import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * The left rail of the designer.
 *
 * Three things live here, in the order the user meets them: what kind of project this
 * is, which of that project's expected spaces are still missing, and any boundary the
 * drawing left open that has to be resolved before the space can exist at all.
 */

export type SectionStatus = "missing" | "unassigned" | "placed" | "covered" | "dismissed";

const statusLabels: Record<SectionStatus, string> = {
  missing: "انتخاب نشده",
  unassigned: "مشخص شده — دوربین ندارد",
  placed: "مشخص شده — دوربین دارد",
  covered: "مشخص شده — پوشش کامل",
  dismissed: "در این پروژه ندارم"
};

const specifiedStatuses = new Set<SectionStatus>(["unassigned", "placed", "covered"]);

/**
 * How complete each expected space is.
 *
 * `covered` means at least 95% of the room samples reach the section's required PPM.
 * Merely putting a camera in the room is reported as `placed`, never as complete coverage.
 */
export function sectionStatuses(
  floors: FloorPlan[],
  sections: SectionType[],
  dismissed: string[]
): Map<string, SectionStatus> {
  const statuses = new Map<string, SectionStatus>();
  const rooms = floors.flatMap((floor) => (floor.rooms ?? []).map((room) => ({ floor, room })));
  const requirements = floors.flatMap((floor) =>
    (floor.coverageRequirements ?? []).map((requirement) => ({ floor, requirement }))
  );

  for (const section of sections) {
    if (dismissed.includes(section.id)) {
      statuses.set(section.id, "dismissed");
      continue;
    }
    const matching = rooms.filter((entry) => entry.room.sectionTypeId === section.id);
    const matchingRequirements = requirements.filter((entry) => entry.requirement.sectionTypeId === section.id);
    if (matching.length === 0 && matchingRequirements.length === 0) {
      statuses.set(section.id, "missing");
      continue;
    }
    const audits = matching.map((entry) => roomCoverageForGoal(entry.floor, entry.room, section.goal));
    const fullyCovered = audits.some((audit) => audit.coveredPercent >= 95);
    const hasAnyCoverage = audits.some((audit) => audit.hasCoverage);
    const hasCamera = matching.some((entry) =>
      entry.floor.cameras.some((camera) => pointInRoom(camera.position, entry.room))
    );
    const requirementCovered = matchingRequirements.some((entry) => entry.requirement.satisfied === true);
    const requirementHasCamera = matchingRequirements.some((entry) =>
      entry.floor.cameras.some((camera) => camera.requirementId === entry.requirement.id)
    );
    statuses.set(
      section.id,
      fullyCovered || requirementCovered
        ? "covered"
        : hasAnyCoverage || hasCamera || requirementHasCamera ? "placed" : "unassigned"
    );
  }
  return statuses;
}

function pointInRoom(point: { x: number; z: number }, room: PlanRoom): boolean {
  let inside = false;
  const polygon = room.polygon;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.z > point.z !== b.z > point.z;
    if (straddles && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function VenuePanel({
  floor,
  floors,
  venueTypeId,
  customSectionTypes,
  dismissedSectionIds,
  onVenueChange,
  onDismissSection,
  onResolveOpenRegion,
  onFocusSection,
  compact = false
}: {
  floor: FloorPlan;
  floors: FloorPlan[];
  venueTypeId?: string;
  customSectionTypes: CustomSectionRecord[];
  dismissedSectionIds: string[];
  onVenueChange: (venueTypeId: string) => void;
  onDismissSection: (sectionId: string, dismissed: boolean) => void;
  onResolveOpenRegion: (region: OpenRegion, choice: "inferred" | "enclosing") => void;
  onFocusSection: (sectionId: string) => void;
  compact?: boolean;
}) {
  const custom = customSectionTypes as unknown as SectionType[];
  const venue = findVenueType(venueTypeId);
  const sections = useMemo(
    () => (venueTypeId ? sectionsForVenue(venueTypeId, custom).filter((item) => item.id !== "generic.room") : []),
    [venueTypeId, custom]
  );
  const statuses = useMemo(
    () => sectionStatuses(floors, sections, dismissedSectionIds),
    [floors, sections, dismissedSectionIds]
  );

  const openRegions = useMemo(() => {
    const assignedWallIds = new Set((floor.rooms ?? []).flatMap((room) => room.wallIds ?? []));
    return detectRooms(floor).openRegions.filter(
      (region) => region.isRectangleGap
        && Boolean(region.inferred)
        && !region.wallIds.every((wallId) => assignedWallIds.has(wallId))
    );
  }, [floor]);

  const completion = useMemo(() => {
    const graded = sections.filter((section) => statuses.get(section.id) !== "dismissed");
    if (graded.length === 0) return 0;
    // This is a space-definition checklist, not a camera-coverage score. As soon as a
    // room receives this section type, the item is complete; coverage remains visible
    // in the secondary status text.
    const done = graded.filter((section) => specifiedStatuses.has(statuses.get(section.id) ?? "missing")).length;
    return Math.round((done / graded.length) * 100);
  }, [sections, statuses]);

  return (
    <div className={compact ? "plan-venue-panel is-compact" : "plan-venue-panel"}>
      {!compact ? <section className="plan-venue-card">
        <h3><Building2 size={15} aria-hidden="true" /> کاربری پروژه</h3>
        <VenuePicker value={venueTypeId} onPick={(picked) => onVenueChange(picked.id)} />
        {venue && <p className="plan-venue-blurb">{venue.blurb}</p>}
      </section> : null}

      {openRegions.length > 0 && (
        <section className="plan-venue-card plan-open-regions">
          <h3><Split size={15} aria-hidden="true" /> پیشنهاد تکمیل فضا</h3>
          <p className="plan-venue-note">
            سه ضلع یک فضای مستطیلی دیده شده است. اگر قصد ساخت اتاق داشتید، ضلع چهارم را اضافه کنید؛ در غیر این صورت نیازی به اقدامی نیست.
          </p>
          {openRegions.map((region) => (
            <div key={region.id} className="plan-open-region">
              <span className="plan-open-region-title">
                {formatFa(region.wallIds.length)} دیوار متصل
                {region.isRectangleGap && <em> — سه ضلع یک مستطیل</em>}
              </span>
              <div className="plan-open-region-actions">
                {region.inferred && (
                  <button type="button" onClick={() => onResolveOpenRegion(region, "inferred")}>
                    <SquareDashed size={13} aria-hidden="true" />
                    افزودن ضلع چهارم
                    <small>{formatFa(Math.round(region.inferred.areaM2))} م²</small>
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {venueTypeId && (
        <section className="plan-venue-card plan-priority-card">
          <h3>
            <Check size={15} aria-hidden="true" /> {compact ? "چک‌لیست فضاهای پروژه" : "اولویت‌های این کاربری"}
            <span className="plan-priority-progress">{formatFa(completion)}٪</span>
          </h3>
          {(["critical", "important", "optional"] as SectionPriority[]).map((priority) => {
            const group = sections.filter((section) => section.priority === priority);
            if (group.length === 0) return null;
            return (
              <div key={priority} className="plan-priority-group">
                <h4 className={`priority-${priority}`}>{sectionPriorityLabels[priority]}</h4>
                {group.map((section) => {
                  const status = statuses.get(section.id) ?? "missing";
                  const isSpecified = specifiedStatuses.has(status);
                  const isRequiredMissing = status === "missing" && priority !== "optional";
                  const visibleStatus = isRequiredMissing ? "هنوز مشخص نشده" : statusLabels[status];
                  return (
                    <div
                      key={section.id}
                      className={`plan-priority-item status-${status}${isRequiredMissing ? " is-required-missing" : ""}`}
                    >
                      <button type="button" className="plan-priority-label" onClick={() => onFocusSection(section.id)}>
                        <span className="plan-priority-mark" aria-hidden="true">
                          {isSpecified ? <Check size={12} /> : status === "dismissed" ? <Minus size={12} /> : null}
                        </span>
                        <span>{section.label}</span>
                      </button>
                      <button
                        type="button"
                        className="plan-priority-dismiss"
                        title={status === "dismissed" ? "برگرداندن به فهرست" : "در این پروژه وجود ندارد"}
                        onClick={() => onDismissSection(section.id, status !== "dismissed")}
                      >
                        <EyeOff size={12} aria-hidden="true" />
                      </button>
                      <span className="plan-priority-status">{visibleStatus}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/* ── Venue autocomplete ────────────────────────────────────────────── */

/**
 * Venue type-ahead.
 *
 * The list stays closed until the third character. With one or two Persian letters the
 * match set is most of the catalogue, and a list that long is slower to read than the
 * fourteen buttons it is trying to replace — so below the threshold the field says how
 * many characters it wants and shows the full list to browse instead.
 */
function VenuePicker({ value, onPick }: { value?: string; onPick: (venue: VenueType) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = findVenueType(value);
  const trimmed = query.trim();
  const searching = trimmed.length >= minimumAutocompleteLength;
  const results = useMemo(
    () => (searching ? searchVenueTypes(trimmed) : venueTypes),
    [trimmed, searching]
  );

  return (
    <div className="plan-autocomplete">
      <div className="plan-autocomplete-input">
        <Search size={14} aria-hidden="true" />
        <input
          type="text"
          value={open ? query : selected?.label ?? ""}
          placeholder="مثلاً مغازه، پارکینگ، باغ…"
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 130); }}
        />
      </div>

      {open && (
        <div className="plan-autocomplete-list">
          {trimmed.length > 0 && !searching && (
            <p className="plan-autocomplete-hint">
              برای جست‌وجو دست‌کم {formatFa(minimumAutocompleteLength)} حرف بنویسید
            </p>
          )}
          {results.length === 0 && <p className="plan-autocomplete-hint">کاربری‌ای با این نام پیدا نشد</p>}
          {results.map((venue) => (
            <button
              key={venue.id}
              type="button"
              className={venue.id === value ? "active" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                onPick(venue);
                setOpen(false);
                setQuery("");
              }}
            >
              <span className="plan-autocomplete-label">{venue.label}</span>
              {venue.id === value && <Check size={13} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
