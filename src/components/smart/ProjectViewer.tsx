"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, Camera, Layers, LoaderCircle, PencilLine, Ruler, ShieldAlert, Square
} from "lucide-react";
import type { BuildingPlan } from "@/src/domain/planner/types";
import {
  findSectionType,
  findVenueType,
  sectionEnvironmentLabels,
  sectionPriorityLabels,
  surveillanceGoalLabels
} from "@/src/domain/planner/venues";
import { housingLabels } from "@/src/lib/planner/camera-templates";
import { roomAreaM2 } from "@/src/lib/planner/rooms";
import { formatFa } from "@/src/lib/chatbot/persian";

/**
 * Read-only presentation of a saved design.
 *
 * Deliberately not the wizard in a disabled state: this is for showing a finished plan to
 * someone, so it leads with the drawing and the tables rather than with editing tools that
 * cannot be used. The designer is mounted in read-only mode, which keeps the same
 * rendering — rooms, labels, coverage — without any way to change the plan by accident.
 */

const FloorPlanDesigner = dynamic(
  () => import("@/src/components/planner/FloorPlanDesigner").then((module) => module.FloorPlanDesigner),
  {
    ssr: false,
    loading: () => (
      <div className="plan-designer-loading">
        <LoaderCircle className="is-spinning" size={26} />
        <span>در حال آماده‌سازی نقشه…</span>
      </div>
    )
  }
);

type ViewerProject = {
  id: string;
  name: string;
  venueTypeId: string | null;
  status: string;
  summary: { areaM2: number; floorCount: number; cameraCount: number; roomCount: number; assignedRoomCount: number };
  updatedAt: string;
  plan: BuildingPlan;
};

export function ProjectViewer({ project }: { project: ViewerProject }) {
  const [plan] = useState<BuildingPlan>(project.plan);
  const venue = findVenueType(project.venueTypeId ?? undefined);
  const custom = plan.customSectionTypes ?? [];

  const rooms = useMemo(
    () => plan.floors.flatMap((floor) =>
      (floor.rooms ?? []).map((room) => ({ floor, room }))
    ),
    [plan]
  );
  const cameras = useMemo(
    () => plan.floors.flatMap((floor) => floor.cameras.map((camera) => ({ floor, camera }))),
    [plan]
  );

  return (
    <div className="project-viewer" dir="rtl">
      <header className="project-viewer-head">
        <div>
          <Link href="/planner" className="project-viewer-back">
            <ArrowRight size={16} aria-hidden="true" /> بازگشت به پروژه‌ها
          </Link>
          <h1>{project.name}</h1>
          <p>
            {venue?.label ?? "بدون کاربری"}
            {" · "}
            آخرین ویرایش {new Date(project.updatedAt).toLocaleDateString("fa-IR")}
          </p>
        </div>
        <div className="project-viewer-actions">
          <Link href="/planner" className="project-viewer-edit">
            <PencilLine size={16} aria-hidden="true" /> ویرایش در طراح
          </Link>
        </div>
      </header>

      <div className="project-viewer-metrics">
        <span><Ruler size={15} aria-hidden="true" /><b>{formatFa(project.summary.areaM2)}</b> متر مربع</span>
        <span><Layers size={15} aria-hidden="true" /><b>{formatFa(project.summary.floorCount)}</b> طبقه</span>
        <span><Square size={15} aria-hidden="true" /><b>{formatFa(project.summary.roomCount)}</b> فضا</span>
        <span><Camera size={15} aria-hidden="true" /><b>{formatFa(project.summary.cameraCount)}</b> دوربین</span>
      </div>

      {project.summary.roomCount > project.summary.assignedRoomCount && (
        <div className="project-viewer-warning">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            {formatFa(project.summary.roomCount - project.summary.assignedRoomCount)} فضا هنوز نوع ندارد.
            برای تکمیل طرح، در حالت ویرایش نوعشان را مشخص کنید.
          </span>
        </div>
      )}

      <section className="project-viewer-map">
        <FloorPlanDesigner plan={plan} mode="cameras" readOnly onPlanChange={() => {}} />
      </section>

      <div className="project-viewer-tables">
        <section>
          <h2>فضاها</h2>
          {rooms.length === 0 ? <p className="project-viewer-empty">فضایی تعریف نشده است.</p> : (
            <table>
              <thead>
                <tr><th>نام</th><th>نوع</th><th>محیط</th><th>اولویت</th><th>مساحت</th><th>طبقه</th></tr>
              </thead>
              <tbody>
                {rooms.map(({ floor, room }) => {
                  const section = findSectionType(room.sectionTypeId, custom as never);
                  return (
                    <tr key={room.id} className={section ? undefined : "is-unassigned"}>
                      <td>{room.name?.trim() || section?.label || "بدون نام"}</td>
                      <td>{section?.label ?? "— تعیین نشده"}</td>
                      <td>{section ? sectionEnvironmentLabels[section.environment] : "—"}</td>
                      <td>{section ? sectionPriorityLabels[section.priority] : "—"}</td>
                      <td>{formatFa(Math.round(roomAreaM2(room.polygon)))} م²</td>
                      <td>{floor.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2>دوربین‌ها</h2>
          {cameras.length === 0 ? <p className="project-viewer-empty">دوربینی جانمایی نشده است.</p> : (
            <table>
              <thead>
                <tr><th>نام</th><th>بدنه</th><th>لنز</th><th>ارتفاع</th><th>هدف</th><th>طبقه</th></tr>
              </thead>
              <tbody>
                {cameras.map(({ floor, camera }) => (
                  <tr key={camera.id}>
                    <td>{camera.name}</td>
                    <td>{camera.housing ? housingLabels[camera.housing] : "—"}</td>
                    <td>{formatFa(camera.optics.focalMm, 1)} mm</td>
                    <td>{formatFa(camera.optics.mountHeightM, 1)} m</td>
                    <td>{surveillanceGoalLabels[camera.goal]}</td>
                    <td>{floor.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
