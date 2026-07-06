import { redirect } from "next/navigation";
import { AdminPanel } from "@/src/components/AdminPanel";
import { getSmsConfig, listUsers } from "@/src/lib/authStore";
import { getCurrentSession } from "@/src/lib/session";

export default async function AdminPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="app-shell">
      <AdminPanel currentUserId={session.id} initialUsers={listUsers()} initialSmsConfig={getSmsConfig()} />
    </main>
  );
}
