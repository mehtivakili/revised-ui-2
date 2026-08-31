import type { BuildingPlan } from "@/src/domain/planner/types";

/** Browser-side access to the project API. Thin on purpose: no caching, no state. */

export type ProjectSummary = {
  areaM2: number;
  floorCount: number;
  cameraCount: number;
  roomCount: number;
  assignedRoomCount: number;
};

export type ProjectListItem = {
  id: string;
  name: string;
  venueTypeId: string | null;
  status: string;
  summary: ProjectSummary;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectListItem & {
  brief: Record<string, unknown>;
  plan: BuildingPlan;
  templates: unknown[];
  quantities: Record<string, unknown>;
  result: unknown;
  revision: number;
};

export type ProjectPayload = {
  name: string;
  venueTypeId?: string | null;
  status?: string;
  brief: unknown;
  plan: BuildingPlan;
  templates?: unknown;
  quantities?: unknown;
  result?: unknown;
  thumbnail?: string | null;
};

export class ProjectRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ProjectRequestError";
    this.status = status;
    this.code = code;
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProjectRequestError(
      (payload as { error?: string }).error ?? "ارتباط با سرور برقرار نشد.",
      response.status,
      (payload as { code?: string }).code
    );
  }
  return payload as T;
}

export async function fetchProjects(signal?: AbortSignal): Promise<ProjectListItem[]> {
  const response = await fetch("/api/projects", { signal, cache: "no-store" });
  // A signed-out visitor is a normal state on this page, not a failure worth surfacing.
  if (response.status === 401) return [];
  const { projects } = await unwrap<{ projects: ProjectListItem[] }>(response);
  return projects;
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  const { project } = await unwrap<{ project: ProjectDetail }>(
    await fetch(`/api/projects/${id}`, { cache: "no-store" })
  );
  return project;
}

export async function createProject(payload: ProjectPayload): Promise<ProjectDetail> {
  const { project } = await unwrap<{ project: ProjectDetail }>(
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );
  return project;
}

export async function saveProject(id: string, payload: ProjectPayload): Promise<ProjectDetail> {
  const { project } = await unwrap<{ project: ProjectDetail }>(
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );
  return project;
}

export async function removeProject(id: string): Promise<void> {
  await unwrap(await fetch(`/api/projects/${id}`, { method: "DELETE" }));
}

export async function duplicateProject(id: string): Promise<ProjectDetail> {
  const { project } = await unwrap<{ project: ProjectDetail }>(
    await fetch(`/api/projects/${id}/duplicate`, { method: "POST" })
  );
  return project;
}
