import { auth } from "@/lib/auth";
import { isAdminEmail, ADMIN_ACCESS_DENIED_MESSAGE } from "@/lib/admin";
import AdminTemplatesClient from "./AdminTemplatesClient";

export default async function AdminTemplatesPage() {
  const session = await auth();

  if (!session) {
    return <div className="p-8">Please sign in to access admin panel</div>;
  }

  if (!isAdminEmail(session.user?.email)) {
    return <div className="p-8">{ADMIN_ACCESS_DENIED_MESSAGE}</div>;
  }

  return <AdminTemplatesClient />;
}
