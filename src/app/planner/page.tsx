import { redirect } from "next/navigation";
import { ProjectWizard } from "@/src/components/smart/ProjectWizard";
import { getCurrentSession } from "@/src/lib/session";

export default async function PlannerPage() {
  if (!(await getCurrentSession())) redirect("/login");
  return <main className="app-shell smart-page"><ProjectWizard /></main>;
}
