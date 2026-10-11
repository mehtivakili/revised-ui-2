"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Home, Plus, Search, Square, X } from "lucide-react";
import type { FloorPlan, PlanRoom } from "@/src/domain/planner/types";
import {
  findSectionType,
  genericSectionType,
  minimumAutocompleteLength,
  searchSectionTypes,
  sectionPriorityLabels,
  sectionsForVenue,
  type SectionType
} from "@/src/domain/planner/venues";
import { roomAreaM2 } from "@/src/lib/planner/rooms";
import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * Section type picker that opens where the user clicked a space.
 *
 * Choosing a type is the one step every room needs, so it should not require a trip to
 * the side panel. With an empty search the list is a short summary that leads with what
 * the checklist still needs; typing filters the whole catalogue. The full settings stay
 * in the side panel.
 */

const SUMMARY_LENGTH = 7;
const WIDTH = 304;
const MAX_HEIGHT = 392;

/** Gives a room a section type, keeping a whole-room must-cover area in step with it. */
export function assignRoomSection(floor: FloorPlan, roomId: string, sectionTypeId: string): FloorPlan {
  return {
    ...floor,
    rooms: (floor.rooms ?? []).map((room) => (room.id === roomId ? { ...room, sectionTypeId } : room)),
    coverageRequirements: (floor.coverageRequirements ?? []).map((requirement) =>
      requirement.sourceRoomId === roomId ? { ...requirement, sectionTypeId } : requirement)
  };
}

/* Persian-tolerant contains-match for the first two letters, before ranked search kicks in. */
const normalise = (text: string) => text.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ").trim();

/**
 * One entry per label. Without a project type the pool is every venue's spaces, where the
 * same label recurs; ordering by how many venues share a label puts the everyday spaces
 * (entrance, corridor, parking) ahead of specialist ones.
 */
function distinctByLabel(sections: SectionType[], byFrequency: boolean) {
  const counts = new Map<string, number>();
  for (const section of sections) counts.set(section.label, (counts.get(section.label) ?? 0) + 1);
  const seen = new Set<string>();
  const unique = sections.filter((section) => !seen.has(section.label) && seen.add(section.label));
  return byFrequency ? unique.sort((a, b) => (counts.get(b.label) ?? 0) - (counts.get(a.label) ?? 0)) : unique;
}

type Option =
  | { kind: "section"; section: SectionType }
  | { kind: "generic" }
  | { kind: "create"; label: string };

export function RoomTypeQuickPicker({
  room,
  anchor,
  venueTypeId,
  custom,
  assignedIds,
  onPick,
  onCreate,
  onClose
}: {
  room: PlanRoom;
  /** Where the click landed, in viewport pixels. */
  anchor: { x: number; y: number };
  venueTypeId?: string;
  custom: SectionType[];
  /** Section types already given to a space anywhere in the project. */
  assignedIds: Set<string>;
  onPick: (section: SectionType) => void;
  onCreate: (label: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const current = findSectionType(room.sectionTypeId, custom);
  const trimmed = query.trim();

  const pool = useMemo(
    () => distinctByLabel(sectionsForVenue(venueTypeId, custom).filter((section) => section.id !== genericSectionType.id), !venueTypeId),
    [venueTypeId, custom]
  );
  const matches = useMemo(() => {
    if (!trimmed) {
      // The summary: what the checklist still needs first, already-used types after.
      return [...pool.filter((section) => !assignedIds.has(section.id)), ...pool.filter((section) => assignedIds.has(section.id))];
    }
    if (trimmed.length >= minimumAutocompleteLength) {
      return distinctByLabel(searchSectionTypes(trimmed, venueTypeId, custom).filter((section) => section.id !== genericSectionType.id), false);
    }
    const needle = normalise(trimmed);
    return pool.filter((section) =>
      normalise(section.label).includes(needle) || section.aliases.some((alias) => normalise(alias).includes(needle)));
  }, [assignedIds, custom, pool, trimmed, venueTypeId]);

  const shown = trimmed ? matches.slice(0, 12) : matches.slice(0, SUMMARY_LENGTH);
  const hidden = matches.length - shown.length;
  const canCreate = trimmed.length >= minimumAutocompleteLength && !matches.some((section) => section.label === trimmed);
  const options: Option[] = [
    ...shown.map((section) => ({ kind: "section" as const, section })),
    ...(canCreate ? [{ kind: "create" as const, label: trimmed }] : []),
    { kind: "generic" as const }
  ];
  const activeIndex = Math.min(active, options.length - 1);

  const choose = (option: Option) => {
    if (option.kind === "section") onPick(option.section);
    else if (option.kind === "generic") onPick(genericSectionType);
    else onCreate(option.label);
  };

  useEffect(() => { inputRef.current?.focus(); }, []);

  /* A press anywhere else closes it; a press on another space reopens it there. */
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  useEffect(() => {
    rootRef.current?.querySelector(`[data-option="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Beside the click, on whichever side has room, and never off screen.
  const left = anchor.x + 14 + WIDTH <= window.innerWidth - 8 ? anchor.x + 14 : Math.max(8, anchor.x - 14 - WIDTH);
  const top = Math.min(Math.max(8, anchor.y - 24), window.innerHeight - MAX_HEIGHT - 8);

  return (
    <div
      ref={rootRef}
      className="room-quick-picker"
      role="dialog"
      aria-label="انتخاب نوع فضا"
      dir="rtl"
      style={{ left, top, width: WIDTH, maxHeight: MAX_HEIGHT }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          setActive((activeIndex + step + options.length) % options.length);
        } else if (event.key === "Enter") {
          event.preventDefault();
          const option = options[activeIndex];
          if (option) choose(option);
        }
      }}
    >
      <header className="room-quick-picker-head">
        <span className={current ? "room-quick-picker-icon" : "room-quick-picker-icon is-missing"}><Square size={15} aria-hidden="true" /></span>
        <div>
          <strong>{current ? room.name?.trim() || current.label : "این فضا هنوز نوع ندارد"}</strong>
          <small>{formatFa(Math.round(roomAreaM2(room.polygon) * 10) / 10)} متر مربع · {current ? "تغییر نوع فضا" : "نوع را انتخاب کنید"}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن" title="بستن (Esc)"><X size={15} aria-hidden="true" /></button>
      </header>

      <label className="room-quick-picker-search">
        <Search size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="جست‌وجوی نوع فضا، مثلاً لابی یا انبار"
          aria-label="جست‌وجوی نوع فضا"
          aria-controls="room-quick-picker-list"
          aria-activedescendant={`room-quick-option-${activeIndex}`}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        />
      </label>

      <div className="room-quick-picker-list" id="room-quick-picker-list" role="listbox">
        <small className="room-quick-picker-caption">
          {trimmed ? `${formatFa(matches.length)} نتیجه` : venueTypeId ? "پیشنهادها؛ موارد باقی‌مانده چک‌لیست اول آمده‌اند" : "پرکاربردها؛ برای بقیه بنویسید"}
        </small>
        {options.map((option, index) => {
          const isActive = index === activeIndex;
          const common = {
            id: `room-quick-option-${index}`,
            "data-option": index,
            role: "option" as const,
            "aria-selected": isActive,
            className: isActive ? "is-active" : undefined,
            onMouseEnter: () => setActive(index),
            onClick: () => choose(option)
          };
          if (option.kind === "create") {
            return (
              <button key="create" type="button" {...common} className={`room-quick-picker-extra${isActive ? " is-active" : ""}`}>
                <Plus size={14} aria-hidden="true" />
                <span>ساخت نوع «{option.label}»</span>
              </button>
            );
          }
          if (option.kind === "generic") {
            return (
              <button key="generic" type="button" {...common} className={`room-quick-picker-extra${isActive ? " is-active" : ""}`}>
                <Home size={14} aria-hidden="true" />
                <span>یک اتاق معمولی است</span>
                {room.sectionTypeId === genericSectionType.id ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          }
          const { section } = option;
          const used = assignedIds.has(section.id) && section.id !== room.sectionTypeId;
          return (
            <button key={section.id} type="button" {...common}>
              <span className="room-quick-picker-label">{section.label}</span>
              {used ? <em>استفاده‌شده</em> : null}
              <span className={`plan-room-chip priority-${section.priority}`}>{sectionPriorityLabels[section.priority]}</span>
              {section.id === room.sectionTypeId ? <Check size={14} aria-hidden="true" /> : null}
            </button>
          );
        })}
        {trimmed && !matches.length && !canCreate ? (
          <p className="room-quick-picker-empty">موردی پیدا نشد؛ عبارت دیگری بنویسید.</p>
        ) : null}
        {hidden > 0 ? <p className="room-quick-picker-more">{formatFa(hidden)} نوع دیگر؛ برای پیدا کردن بنویسید</p> : null}
      </div>
      <footer className="room-quick-picker-foot">↑ ↓ و Enter برای انتخاب · تنظیمات کامل در پنل مشخصات</footer>
    </div>
  );
}
