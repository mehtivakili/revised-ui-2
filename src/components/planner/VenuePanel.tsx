"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Check, CircleDot, EyeOff, Minus, Search, Split, SquareDashed } from "lucide-react";
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
  missing: "تعریف نشده",
  unassigned: "فضا هست، دوربین ندارد",
  placed: "دوربین دارد",
  covered: "پوشش کامل",
  dismissed: "در این پروژه ندارم"
};

/**
 * How complete each expected space is.
 *
 * `covered` needs both a room of that type and a camera standing inside it, which is why
 * this walks the cameras rather than trusting a count: a camera list that says four says
 * nothing about whether the till is one of them.
 */
export function sectionStatuses(
  floors: FloorPlan[],
  sections: SectionType[],
  dismissed: string[]
): Map<string, SectionStatus> {
  const statuses = new Map<string, SectionStatus>();
  const rooms = floors.flatMap((floor) => (floor.rooms ?? []).map((room) => ({ floor, room })));

  for (const section of sections) {
    if (dismissed.includes(section.id)) {
      statuses.set(section.id, "dismissed");
      continue;
    }
    const matching = rooms.filter((entry) => entry.room.sectionTypeId === section.id);
    if (matching.length === 0) {
      statuses.set(section.id, "missing");
      continue;
    }
    const hasCamera = matching.some((entry) =>
      entry.floor.cameras.some((camera) => pointInRoom(camera.position, entry.room))
    );
    statuses.set(section.id, hasCamera ? "covered" : "unassigned");
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
  onFocusSection
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
      (region) => !region.wallIds.every((wallId) => assignedWallIds.has(wallId))
    );
  }, [floor]);

  const completion = useMemo(() => {
    const graded = sections.filter((section) => statuses.get(section.id) !== "dismissed");
    if (graded.length === 0) return 0;
    const done = graded.filter((section) => statuses.get(section.id) === "covered").length;
    return Math.round((done / graded.length) * 100);
  }, [sections, statuses]);

  return (
    <div className="plan-venue-panel">
      <section className="plan-venue-card">
        <h3><Building2 size={15} aria-hidden="true" /> کاربری پروژه</h3>
        <VenuePicker value={venueTypeId} onPick={(picked) => onVenueChange(picked.id)} />
        {venue && <p className="plan-venue-blurb">{venue.blurb}</p>}
      </section>

      {openRegions.length > 0 && (
        <section className="plan-venue-card plan-open-regions">
          <h3><Split size={15} aria-hidden="true" /> مرزهای باز</h3>
          <p className="plan-venue-note">
            این دیوارها فضای بسته‌ای نمی‌سازند. یکی از دو گزینه را انتخاب کنید تا فضا ساخته شود.
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
                    بستن ضلع باقی‌مانده
                    <small>{formatFa(Math.round(region.inferred.areaM2))} م²</small>
                  </button>
                )}
                <button type="button" onClick={() => onResolveOpenRegion(region, "enclosing")}>
                  <CircleDot size={13} aria-hidden="true" />
                  محدوده بزرگ‌تر
                  <small>{formatFa(Math.round(region.enclosing.areaM2))} م²</small>
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {venueTypeId && (
        <section className="plan-venue-card plan-priority-card">
          <h3>
            <Check size={15} aria-hidden="true" /> اولویت‌های این کاربری
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
                  return (
                    <div key={section.id} className={`plan-priority-item status-${status}`}>
                      <button type="button" className="plan-priority-label" onClick={() => onFocusSection(section.id)}>
                        <span className="plan-priority-mark" aria-hidden="true">
                          {status === "covered" ? <Check size={12} /> : status === "dismissed" ? <Minus size={12} /> : null}
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
                      <span className="plan-priority-status">{statusLabels[status]}</span>
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
