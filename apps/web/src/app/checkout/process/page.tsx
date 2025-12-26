import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CancelledState, LoadingAuthState, UnauthenticatedState } from '../_components/CheckoutStates';
import PaymentProcessor from '../_components/PaymentProcessor';

interface ProcessCheckoutPageProps {
  searchParams: Promise<{
    session_id?: string;
    cancelled?: string;
  }>;
}

export default async function ProcessCheckoutPage({ searchParams }: ProcessCheckoutPageProps) {
  const resolvedSearchParams = await searchParams;
  const sessionId = resolvedSearchParams.session_id;
  const cancelled = resolvedSearchParams.cancelled === 'true';

  // Handle cancellation immediately
  if (cancelled) {
    return <CancelledState />;
  }

  // Handle missing session ID
  if (!sessionId) {
    redirect('/projects?error=missing_session');
  }

  // Get authentication status
  const session = await auth();

  // Handle unauthenticated users
  if (!session) {
    return <UnauthenticatedState />;
  }

  // All good - process the payment
  return <PaymentProcessor sessionId={sessionId} />;
} 