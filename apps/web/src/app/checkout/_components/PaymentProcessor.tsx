"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import ProcessingSteps, { ProcessingStep } from './ProcessingSteps';
import { SuccessState, ErrorState } from './CheckoutStates';

interface PaymentStatus {
  isValid: boolean;
  isProcessed: boolean;
  paymentIntent?: any;
  session?: any;
  type?: 'subscription' | 'credit_purchase';
  amount?: number;
  credits?: number;
  tier?: string;
  error?: string;
}

interface PaymentProcessorProps {
  sessionId: string;
}

export default function PaymentProcessor({ sessionId }: PaymentProcessorProps) {
  const router = useRouter();
  const trpc = useTRPC();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    isValid: false,
    isProcessed: false
  });

  const [steps, setSteps] = useState<ProcessingStep[]>([
    {
      id: 'verify',
      label: 'Verifying Payment',
      status: 'loading',
      description: 'Confirming payment with Stripe...'
    },
    {
      id: 'process',
      label: 'Processing Transaction',
      status: 'pending',
      description: 'Updating your account...'
    },
    {
      id: 'complete',
      label: 'Finalizing',
      status: 'pending',
      description: 'Preparing your dashboard...'
    }
  ]);

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Update step status
  const updateStep = useCallback((stepId: string, status: ProcessingStep['status'], description?: string) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId
        ? { ...step, status, ...(description && { description }) }
        : step
    ));
  }, []);

  // Check if webhooks have processed the payment
  const checkProcessingStatus = useCallback(async (payment: PaymentStatus) => {
    const maxRetries = 20; // 20 * 3 seconds = 1 minute max wait
    let attempts = 0;

    const checkStatus = async (): Promise<void> => {
      attempts++;

      try {
        const response = await fetch('/api/checkout/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            paymentIntentId: payment.paymentIntent?.id
          }),
        });

        const result = await response.json();

        if (result.processed) {
          updateStep('process', 'completed', 'Account updated successfully');
          updateStep('complete', 'loading', 'Preparing your dashboard...');

          // Small delay for final step
          setTimeout(() => {
            updateStep('complete', 'completed', 'All done!');
            setPaymentStatus(prev => ({ ...prev, isProcessed: true }));

            // Redirect after completion
            setTimeout(() => {
              if (payment.type === 'subscription') {
                router.push('/?subscription-success=true');
              } else {
                router.push('/?credits-purchased=true');
              }
            }, 2000);
          }, 1000);

        } else if (attempts < maxRetries) {
          // Continue waiting
          updateStep('process', 'loading',
            `Syncing with your account... (${attempts}/${maxRetries})`
          );
          setTimeout(checkStatus, 3000); // Check every 3 seconds
        } else {
          // Max retries reached
          updateStep('process', 'error', 'Processing timeout - please contact support');
          setPaymentStatus(prev => ({
            ...prev,
            error: 'Processing timeout'
          }));
        }
      } catch (error: any) {
        if (attempts < maxRetries) {
          setTimeout(checkStatus, 3000);
        } else {
          updateStep('process', 'error', 'Processing failed - please contact support');
          setPaymentStatus(prev => ({
            ...prev,
            error: 'Processing failed'
          }));
        }
      }
    };

    await checkStatus();
  }, [sessionId, router, updateStep]);

  // For now, use direct API calls until we can debug tRPC properly
  const verifyPayment = useCallback(async () => {
    try {
      updateStep('verify', 'loading', 'Verifying payment with Stripe...');

      const response = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json();

      if (result.success) {
        setPaymentStatus(result.data);
        updateStep('verify', 'completed', 'Payment verified successfully');

        // Start processing step
        updateStep('process', 'loading', 'Syncing with your account...');

        // Check if webhooks have processed
        await checkProcessingStatus(result.data);
      } else {
        updateStep('verify', 'error', result.error || 'Payment verification failed');
        setPaymentStatus({
          isValid: false,
          isProcessed: false,
          error: result.error
        });
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      updateStep('verify', 'error', 'Network error during verification');
      setPaymentStatus({
        isValid: false,
        isProcessed: false,
        error: 'Network error'
      });
    }
  }, [sessionId, updateStep, checkProcessingStatus]);

  // Retry the entire process
  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    // Reset steps
    setSteps([
      {
        id: 'verify',
        label: 'Verifying Payment',
        status: 'loading',
        description: 'Confirming payment with Stripe...'
      },
      {
        id: 'process',
        label: 'Processing Transaction',
        status: 'pending',
        description: 'Updating your account...'
      },
      {
        id: 'complete',
        label: 'Finalizing',
        status: 'pending',
        description: 'Preparing your dashboard...'
      }
    ]);

    setPaymentStatus({ isValid: false, isProcessed: false });

    // Wait a moment then restart
    setTimeout(() => {
      setIsRetrying(false);
      verifyPayment();
    }, 1000);
  };

  // Start verification when component mounts
  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    }
  }, [sessionId, verifyPayment]);

  // Processing complete
  if (paymentStatus.isValid && paymentStatus.isProcessed) {
    return <SuccessState paymentStatus={paymentStatus} />;
  }

  // Error state
  if (paymentStatus.error) {
    return (
      <ErrorState
        paymentStatus={paymentStatus}
        retryCount={retryCount}
        isRetrying={isRetrying}
        onRetry={handleRetry}
      />
    );
  }

  // Processing state
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>Processing Your Payment</CardTitle>
          <CardDescription>
            Please wait while we confirm your payment and update your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProcessingSteps steps={steps} />

          {/* Warning about waiting */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-6">
            <p className="text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Please don&apos;t close this page. Processing may take up to 1 minute.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 