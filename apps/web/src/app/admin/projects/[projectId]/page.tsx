import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import AdminProjectDetailClient from "./AdminProjectDetailClient";

export const metadata = {
  title: "Project Details - Admin",
  description: "View detailed project information, messages, and advisor chats",
};

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/");
  }

  const resolvedParams = await params;

  return <AdminProjectDetailClient projectId={resolvedParams.projectId} />;
}
