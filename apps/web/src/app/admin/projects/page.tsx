import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import AdminProjectsDashboardClient from "./AdminProjectsDashboardClient";

export const metadata = {
  title: "Projects Dashboard - Admin",
  description:
    "View and manage all projects, messages, and advisor interactions",
};

export default async function AdminProjectsPage() {
  const session = await auth();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/");
  }

  return <AdminProjectsDashboardClient />;
}
