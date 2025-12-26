import { auth } from "@/lib/auth";
import { UserProfile } from "./UserProfile";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export async function AuthWrapper({
  children,
  requireAuth = false,
}: AuthWrapperProps) {
  const session = await auth();

  if (requireAuth && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-600 mb-6">
            You need to sign in to access this page.
          </p>
          <Button asChild>
            <Link href="/auth/signin">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
