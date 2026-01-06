"use client";

import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface PaymentStatus {
  type?: 'subscription' | 'credit_purchase';
  tier?: string;
  credits?: number;
  error?: string;
}

interface CheckoutStateProps {
  paymentStatus?: PaymentStatus;
  retryCount?: number;
  isRetrying?: boolean;
  onRetry?: () => void;
}

export function CancelledState() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
          </div>
          <CardTitle>Payment Cancelled</CardTitle>
          <CardDescription>
            Your payment has been cancelled. You can try again anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => router.back()} 
            className="w-full"
            variant="outline"
          >
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function LoadingAuthState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export function UnauthenticatedState() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <CardTitle>Authentication Required</CardTitle>
          <CardDescription>
            Please sign in to complete your purchase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/auth/signin')} className="w-full">
            Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function SuccessState({ paymentStatus }: CheckoutStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-green-800">Payment Successful!</CardTitle>
          <CardDescription>
            {paymentStatus?.type === 'subscription' 
              ? `Your ${paymentStatus.tier} subscription is now active.`
              : `${paymentStatus?.credits} credits have been added to your account.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Redirecting to your dashboard...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorState({ paymentStatus, retryCount = 0, isRetrying = false, onRetry }: CheckoutStateProps) {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-red-800">Processing Error</CardTitle>
          <CardDescription>
            {paymentStatus?.error || 'An error occurred while processing your payment'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {retryCount < 3 && onRetry && (
            <Button 
              onClick={onRetry} 
              disabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Try Again'
              )}
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => router.push('/projects')}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 