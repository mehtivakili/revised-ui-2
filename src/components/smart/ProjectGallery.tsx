"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera, Copy, Eye, LayoutGrid, Layers, LoaderCircle, PencilLine,
  RefreshCw, Ruler, Search, Trash2
} from "lucide-react";
import {
  duplicateProject,
  fetchProjects,
  removeProject,
  type ProjectListItem
} from "@/src/lib/projects/client";
import {
  findVenueType,
  sectionEnvironmentLabels,
  sectionPriorityLabels,
  sectionsForVenue,
  surveillanceGoalLabels,
  type SectionPriority,
  type VenueTypeId
} from "@/src/domain/planner/venues";
import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * Saved work, shown before the venue picker.
 *
 * A returning user almost always wants to carry on with something rather than start
 * over, so this sits above the "what are you designing?" grid. It hides itself entirely
 * when there is nothing saved, which keeps the first-run experience unchanged.
 */
export function ProjectGallery({
  onOpen,
  onView,
  reloadToken
}: {
  onOpen: (project: ProjectListItem) => void;
  onView: (project: ProjectListItem) => void;
  reloadToken?: number;
}) {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setProjects(await fetchProjects(signal));
      setError("");
    } catch (cause) {
      if ((cause as Error)?.name === "AbortError") return;
      setError("فهرست پروژه‌ها بارگذاری نشد.");
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // The state update happens after the await, so this never re-renders synchronously
    // from the effect body.
    (async () => {
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [load, reloadToken]);

  const visible = useMemo(() => {
    if (!projects) return [];
    const needle = query.trim().toLocaleLowerCase("fa");
    if (!needle) return projects;
    return projects.filter((project) => {
      const venue = findVenueType(project.venueTypeId ?? undefined)?.label ?? "";
      return `${project.name} ${venue}`.toLocaleLowerCase("fa").includes(needle);
    });
  }, [projects, query]);

  const act = async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await run();
      await load();
    } catch {
      setError("عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  };

  // Nothing saved yet: the section stays out of the way rather than showing an empty box.
  if (projects !== null && projects.length === 0 && !error) return null;

  return (
    <section className="project-gallery">
      <header className="project-gallery-head">
        <div>
          <h2><LayoutGrid size={17} aria-hidden="true" /> پروژه‌های من</h2>
          <small>
            {projects === null
              ? "در حال بارگذاری…"
              : `${formatFa(projects.length)} پروژه ذخیره‌شده — برای ادامه کار یکی را باز کنید`}
          </small>
        </div>
        <div className="project-gallery-tools">
          <label className="project-gallery-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو در پروژه‌ها"
            />
          </label>
          <button type="button" onClick={() => void load()} aria-label="تازه‌سازی فهرست">
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      {error && <p className="project-gallery-error">{error}</p>}

      {projects === null ? (
        <div className="project-gallery-loading"><LoaderCircle className="is-spinning" size={20} /></div>
      ) : (
        <div className="project-gallery-scroller">
          {visible.length === 0 && <p className="project-gallery-empty">پروژه‌ای با این نام پیدا نشد.</p>}
          {visible.map((project) => {
            const venue = findVenueType(project.venueTypeId ?? undefined);
            const busy = busyId === project.id;
            return (
              <article key={project.id} className={busy ? "project-card is-busy" : "project-card"}>
                <div className="project-card-thumb">
                  {project.thumbnail
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={project.thumbnail} alt="" />
                    : <span><Layers size={22} aria-hidden="true" /></span>}
                </div>
                <div className="project-card-body">
                  <strong title={project.name}>{project.name}</strong>
                  <small>{venue?.label ?? "بدون کاربری"}</small>
                  <div className="project-card-stats">
                    <span><Camera size={12} aria-hidden="true" />{formatFa(project.summary?.cameraCount ?? 0)}</span>
                    <span><Ruler size={12} aria-hidden="true" />{formatFa(project.summary?.areaM2 ?? 0)} م²</span>
                    <span><Layers size={12} aria-hidden="true" />{formatFa(project.summary?.floorCount ?? 0)} طبقه</span>
                  </div>
                  <time dateTime={project.updatedAt}>
                    آخرین ویرایش: {new Date(project.updatedAt).toLocaleDateString("fa-IR")}
                  </time>
                </div>
                <div className="project-card-actions">
                  <button type="button" onClick={() => onView(project)}><Eye size={13} aria-hidden="true" />مشاهده</button>
                  <button type="button" className="is-primary" onClick={() => onOpen(project)}>
                    <PencilLine size={13} aria-hidden="true" />ویرایش
                  </button>
                  <button
                    type="button"
                    aria-label="کپی پروژه"
                    disabled={busy}
                    onClick={() => void act(project.id, () => duplicateProject(project.id))}
                  >
                    <Copy size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    aria-label="حذف پروژه"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`«${project.name}» حذف شود؟ این کار قابل بازگشت نیست.`)) return;
                      void act(project.id, () => removeProject(project.id));
                    }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * What a venue is made of.
 *
 * Shown only once a venue is picked or hovered — nothing is expanded by default, so the
 * grid stays scannable. Seeing the spaces up front tells the user what the designer will
 * ask them to define, which is the same checklist they meet later in the left rail.
 */
export function VenueComposition({ venueId }: { venueId: VenueTypeId }) {
  const venue = findVenueType(venueId);
  const sections = useMemo(
    () => sectionsForVenue(venueId).filter((section) => section.id !== "generic.room"),
    [venueId]
  );

  const groups: { priority: SectionPriority; items: typeof sections }[] = useMemo(
    () => (["critical", "important", "optional"] as SectionPriority[])
      .map((priority) => ({ priority, items: sections.filter((s) => s.priority === priority) }))
      .filter((group) => group.items.length > 0),
    [sections]
  );

  if (!venue) return null;

  return (
    <div className="venue-composition" role="region" aria-label={`بخش‌های ${venue.label}`}>
      <header>
        <strong>{venue.label} از چه بخش‌هایی تشکیل شده؟</strong>
        <small>{formatFa(sections.length)} فضای پیشنهادی — همه اختیاری‌اند و در طراحی قابل تغییرند</small>
      </header>
      <div className="venue-composition-groups">
        {groups.map((group) => (
          <div key={group.priority} className={`venue-composition-group priority-${group.priority}`}>
            <h5>{sectionPriorityLabels[group.priority]}</h5>
            <ul>
              {group.items.map((section) => (
                <li key={section.id} className={section.forbidden ? "is-forbidden" : undefined}>
                  <span className="venue-composition-name">{section.label}</span>
                  <span className="venue-composition-meta">
                    {sectionEnvironmentLabels[section.environment]}
                    {" · "}
                    {section.forbidden ? "نصب دوربین ممنوع" : surveillanceGoalLabels[section.goal]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
