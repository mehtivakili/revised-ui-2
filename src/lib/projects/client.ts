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
  /** With code PROJECT_LIMIT: how many designs the account may keep. */
  limit?: number;

  constructor(message: string, status: number, code?: string, limit?: number) {
    super(message);
    this.name = "ProjectRequestError";
    this.status = status;
    this.code = code;
    this.limit = limit;
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProjectRequestError(
      (payload as { error?: string }).error ?? "ارتباط با سرور برقرار نشد.",
      response.status,
      (payload as { code?: string }).code,
      (payload as { limit?: number }).limit
    );
  }
  return payload as T;
}

export type ProjectList = {
  projects: ProjectListItem[];
  /** How many designs this account may keep; null when it is not limited. */
  limit: number | null;
  signedIn: boolean;
};

export async function fetchProjects(signal?: AbortSignal): Promise<ProjectList> {
  const response = await fetch("/api/projects", { signal, cache: "no-store" });
  // A signed-out visitor is a normal state on this page, not a failure worth surfacing.
  if (response.status === 401) return { projects: [], limit: null, signedIn: false };
  const { projects, limit } = await unwrap<{ projects: ProjectListItem[]; limit?: number | null }>(response);
  return { projects, limit: limit ?? null, signedIn: true };
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
