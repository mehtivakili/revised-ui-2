import { redirect } from "next/navigation";
import { getCurrentSession } from "@/src/lib/session";
import { getProject } from "@/src/lib/projects/store";
import { ProjectViewer } from "@/src/components/smart/ProjectViewer";

export default async function ProjectViewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const project = await getProject(session.id, id);
  if (!project) redirect("/planner");

  return (
    <main className="app-shell smart-page">
      <ProjectViewer
        project={{
          id: project.id,
          name: project.name,
          venueTypeId: project.venueTypeId,
          status: project.status,
          summary: project.summary,
          updatedAt: project.updatedAt,
          plan: project.plan
        }}
      />
    </main>
  );
}
