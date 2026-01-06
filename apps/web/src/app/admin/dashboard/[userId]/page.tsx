import { auth } from "@/lib/auth";
import { isAdminEmail, ADMIN_ACCESS_DENIED_MESSAGE } from "@/lib/admin";
import UserDetailClient from "./UserDetailClient";

export default async function UserDetailPage({
  params
}: {
  params: Promise<{ userId: string }>
}) {
  const resolvedParams = await params;
  const session = await auth();

  // Server-side admin access check
  if (!session) {
    return <div className="p-8">Please sign in to access admin dashboard</div>;
  }

  // Use environment-based admin access control (server-side)
  if (!isAdminEmail(session.user?.email)) {
    return <div className="p-8">{ADMIN_ACCESS_DENIED_MESSAGE}</div>;
  }

  if (!resolvedParams.userId) {
    return <div className="p-8">❌ Invalid user ID</div>;
  }

  return <UserDetailClient userId={resolvedParams.userId} />;
}