import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CloudCreditsSuccessProcessor } from "./_components/CloudCreditsSuccessProcessor";

interface CloudCreditsSuccessPageProps {
  searchParams: Promise<{
    session_id?: string;
  }>;
}

export default async function CloudCreditsSuccessPage({
  searchParams,
}: CloudCreditsSuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const sessionId = resolvedSearchParams.session_id;

  // Handle missing session ID
  if (!sessionId) {
    redirect("/projects?error=missing_session");
  }

  // Get authentication status
  const session = await auth();

  // Handle unauthenticated users
  if (!session) {
    redirect("/auth/signin?callbackUrl=/checkout/cloud-credits/success");
  }

  // All good - process the payment
  return <CloudCreditsSuccessProcessor sessionId={sessionId} />;
}
