"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Camera, CircleAlert, Copy, Eye, LayoutGrid, Layers, LoaderCircle, PencilLine,
  RefreshCw, Ruler, Save, Search, Trash2, X
} from "lucide-react";
import {
  duplicateProject,
  fetchProjects,
  removeProject,
  type ProjectList,
  type ProjectListItem
} from "@/src/lib/projects/client";
import { projectLimitMessage } from "@/src/lib/projects/limits";
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
 * over, so this sits above the "what are you designing?" grid. Each account keeps a
 * limited number of designs, so the header shows how many are used; a signed-in user with
 * nothing saved sees a one-line strip saying so, and a signed-out visitor sees nothing.
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
  const [list, setList] = useState<ProjectList | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const projects = list?.projects ?? null;
  const limit = list?.limit ?? null;
  const full = limit !== null && (projects?.length ?? 0) >= limit;

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setList(await fetchProjects(signal));
      setError("");
    } catch (cause) {
      if ((cause as Error)?.name === "AbortError") return;
      setError("فهرست پروژه‌ها بارگذاری نشد.");
      setList({ projects: [], limit: null, signedIn: true });
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
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  };

  if (list && !list.signedIn) return null;

  // Nothing saved yet: one line saying where saved designs will appear and how many fit.
  if (projects !== null && projects.length === 0 && !error) {
    return (
      <section className="project-gallery is-empty">
        <LayoutGrid size={16} aria-hidden="true" />
        <span>
          <strong>پروژه‌های من</strong>
          {limit !== null
            ? ` — هنوز نقشه‌ای ذخیره نکرده‌اید. تا ${formatFa(limit)} نقشه می‌توانید تعریف و ذخیره کنید و همین‌جا ببینید.`
            : " — هنوز نقشه‌ای ذخیره نکرده‌اید. نقشه‌هایی که ذخیره کنید همین‌جا نمایش داده می‌شوند."}
        </span>
      </section>
    );
  }

  return (
    <section className="project-gallery">
      <header className="project-gallery-head">
        <div>
          <h2>
            <LayoutGrid size={17} aria-hidden="true" /> پروژه‌های من
            {limit !== null && projects !== null && (
              <span className={full ? "project-gallery-quota is-full" : "project-gallery-quota"}>
                {formatFa(projects.length)} از {formatFa(limit)}
              </span>
            )}
          </h2>
          <small>
            {projects === null
              ? "در حال بارگذاری…"
              : limit !== null
                ? `${formatFa(projects.length)} از ${formatFa(limit)} نقشه قابل تعریف استفاده شده — برای ادامه کار یکی را باز کنید`
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
      {full && limit !== null && (
        <p className="project-gallery-limit" role="status">
          <CircleAlert size={15} aria-hidden="true" />
          {projectLimitMessage(limit)}
        </p>
      )}

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
                    title={full ? "به حداکثر تعداد نقشه‌ها رسیده‌اید" : "کپی پروژه"}
                    disabled={busy || full}
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
 * Shown when saving a new design is refused because the account already holds its limit.
 *
 * The design being worked on is still only in the page, so instead of sending the user away
 * to make room, the saved designs are listed here with a delete button each. Once one is
 * gone the current design can be saved straight from the dialog.
 */
export function ProjectLimitDialog({
  limit,
  onClose,
  onSave
}: {
  limit: number;
  onClose: () => void;
  onSave: () => void;
}) {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setProjects((await fetchProjects()).projects);
    } catch {
      setError("فهرست نقشه‌ها بارگذاری نشد.");
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const remove = async (project: ProjectListItem) => {
    if (!window.confirm(`«${project.name}» حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    setBusyId(project.id);
    setError("");
    try {
      await removeProject(project.id);
      await load();
    } catch {
      setError("حذف انجام نشد.");
    } finally {
      setBusyId(null);
    }
  };

  const hasRoom = projects !== null && projects.length < limit;

  return (
    <div className="design-mode-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-limit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-limit-title"
        dir="rtl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="design-mode-close" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        <header>
          <span className={hasRoom ? "project-limit-icon is-ok" : "project-limit-icon"}>
            <CircleAlert size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="project-limit-title">
              {hasRoom ? "جا باز شد" : `به حداکثر ${formatFa(limit)} نقشه رسیده‌اید`}
            </h2>
            <p>
              {hasRoom
                ? "حالا می‌توانید نقشه فعلی را ذخیره کنید."
                : `هر حساب در حال حاضر می‌تواند حداکثر ${formatFa(limit)} نقشه تعریف کند. برای ذخیره این نقشه، یکی از نقشه‌های قبلی را حذف کنید. نقشه فعلی تا وقتی این صفحه باز است از بین نمی‌رود.`}
            </p>
          </div>
        </header>

        {projects === null ? (
          <div className="project-gallery-loading"><LoaderCircle className="is-spinning" size={20} /></div>
        ) : (
          <ul className="project-limit-list">
            {projects.map((project) => {
              const venue = findVenueType(project.venueTypeId ?? undefined);
              return (
                <li key={project.id} className={busyId === project.id ? "is-busy" : undefined}>
                  <span className="project-limit-thumb">
                    {project.thumbnail
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={project.thumbnail} alt="" />
                      : <Layers size={18} aria-hidden="true" />}
                  </span>
                  <span className="project-limit-name">
                    <strong title={project.name}>{project.name}</strong>
                    <small>
                      {venue?.label ?? "بدون کاربری"} · آخرین ویرایش {new Date(project.updatedAt).toLocaleDateString("fa-IR")}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="project-limit-delete"
                    disabled={busyId !== null}
                    onClick={() => void remove(project)}
                  >
                    <Trash2 size={14} aria-hidden="true" />حذف
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="project-gallery-error">{error}</p>}

        <footer>
          <button type="button" onClick={onClose}>فعلاً نه</button>
          <button type="button" className="is-primary" disabled={!hasRoom} onClick={onSave}>
            <Save size={15} aria-hidden="true" />ذخیره نقشه فعلی
          </button>
        </footer>
      </section>
    </div>
  );
}

/**
 * What a venue is made of.
 *
 * Shown only once a venue is picked or hovered — nothing is expanded by default, so the
 * grid stays scannable. Seeing the spaces up front tells the user what the designer will
 * ask them to define, which is the same checklist they meet later in the left rail.
 */
export function VenueComposition({ venueId, headerAction }: { venueId: VenueTypeId; headerAction?: ReactNode }) {
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
        <div>
          <strong>{venue.label} از چه بخش‌هایی تشکیل شده؟</strong>
          <small>{formatFa(sections.length)} فضای پیشنهادی — همه اختیاری‌اند و در طراحی قابل تغییرند</small>
        </div>
        {headerAction}
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
