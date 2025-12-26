"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Cloud,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProcessingSteps, {
  type ProcessingStep,
} from "@/app/checkout/_components/ProcessingSteps";

interface PaymentStatus {
  isValid: boolean;
  isProcessed: boolean;
  paymentIntent?: { id: string };
  session?: {
    id: string;
    amount_total: number | null;
    currency: string | null;
    payment_status: string;
    created: number;
  };
  type?: "subscription" | "credit_purchase" | "cloud_credit_purchase";
  amount?: number | null;
  credits?: number;
  returnUrl?: string;
  error?: string;
}

interface CloudCreditsSuccessProcessorProps {
  sessionId: string;
}

export function CloudCreditsSuccessProcessor({
  sessionId,
}: CloudCreditsSuccessProcessorProps) {
  const router = useRouter();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    isValid: false,
    isProcessed: false,
  });

  const [steps, setSteps] = useState<ProcessingStep[]>([
    {
      id: "verify",
      label: "Verifying Payment",
      status: "loading",
      description: "Confirming payment with Stripe...",
    },
    {
      id: "process",
      label: "Adding Cloud Credits",
      status: "pending",
      description: "Updating your balance...",
    },
    {
      id: "complete",
      label: "Finalizing",
      status: "pending",
      description: "All done!",
    },
  ]);

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Update step status
  const updateStep = (
    stepId: string,
    status: ProcessingStep["status"],
    description?: string
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? { ...step, status, ...(description && { description }) }
          : step
      )
    );
  };

  // Check if webhooks have processed the payment
  const checkProcessingStatus = useCallback(
    async (payment: PaymentStatus) => {
      const maxRetries = 20; // 20 * 3 seconds = 1 minute max wait
      let attempts = 0;

      const checkStatus = async (): Promise<void> => {
        attempts++;

        try {
          const response = await fetch("/api/checkout/status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
              paymentIntentId:
                payment.paymentIntent && "id" in payment.paymentIntent
                  ? payment.paymentIntent.id
                  : undefined,
            }),
          });

          const result = await response.json();

          if (result.processed && result.type === "cloud_credit_purchase") {
            updateStep("process", "completed", "Cloud credits added!");
            updateStep("complete", "loading", "Preparing your dashboard...");

            // Small delay for final step
            setTimeout(() => {
              updateStep("complete", "completed", "All done!");
              setPaymentStatus((prev) => ({ ...prev, isProcessed: true }));

              // Redirect after completion - use returnUrl if available
              setTimeout(() => {
                const redirectUrl = payment.returnUrl || "/?cloud-credits-purchased=true";
                // Add query param to indicate success
                const url = new URL(redirectUrl, window.location.origin);
                url.searchParams.set("cloud-credits-purchased", "true");
                router.push(url.pathname + url.search);
              }, 2000);
            }, 1000);
          } else if (attempts < maxRetries) {
            // Continue waiting
            updateStep(
              "process",
              "loading",
              `Adding Cloud credits... (${attempts}/${maxRetries})`
            );
            setTimeout(checkStatus, 3000); // Check every 3 seconds
          } else {
            // Max retries reached
            updateStep(
              "process",
              "error",
              "Processing timeout - please contact support"
            );
            setPaymentStatus((prev) => ({
              ...prev,
              error: "Processing timeout",
            }));
          }
        } catch {
          if (attempts < maxRetries) {
            setTimeout(checkStatus, 3000);
          } else {
            updateStep(
              "process",
              "error",
              "Processing failed - please contact support"
            );
            setPaymentStatus((prev) => ({
              ...prev,
              error: "Processing failed",
            }));
          }
        }
      };

      await checkStatus();
    },
    [router, sessionId]
  );

  // Verify payment with Stripe
  const verifyPayment = useCallback(async () => {
    try {
      updateStep("verify", "loading", "Verifying payment with Stripe...");

      const response = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json();

      if (result.success) {
        setPaymentStatus(result.data);
        updateStep("verify", "completed", "Payment verified successfully");

        // Start processing step
        updateStep("process", "loading", "Adding Cloud credits...");

        // Check if webhooks have processed
        await checkProcessingStatus(result.data);
      } else {
        updateStep(
          "verify",
          "error",
          result.error || "Payment verification failed"
        );
        setPaymentStatus({
          isValid: false,
          isProcessed: false,
          error: result.error,
        });
      }
    } catch {
      updateStep("verify", "error", "Network error during verification");
      setPaymentStatus({
        isValid: false,
        isProcessed: false,
        error: "Network error",
      });
    }
  }, [sessionId, checkProcessingStatus]);

  // Retry the entire process
  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    // Reset steps
    setSteps([
      {
        id: "verify",
        label: "Verifying Payment",
        status: "loading",
        description: "Confirming payment with Stripe...",
      },
      {
        id: "process",
        label: "Adding Cloud Credits",
        status: "pending",
        description: "Updating your balance...",
      },
      {
        id: "complete",
        label: "Finalizing",
        status: "pending",
        description: "All done!",
      },
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

  // Processing complete - Success state
  if (paymentStatus.isValid && paymentStatus.isProcessed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-800">Cloud Credits Added!</CardTitle>
            <CardDescription>
              {paymentStatus.credits?.toLocaleString()} Cloud credits ($
              {((paymentStatus.credits || 0) / 100).toFixed(2)}) have been added
              to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
              <Cloud className="w-4 h-4" />
              <span className="text-sm">
                Use Cloud credits for databases, AI, and storage in your
                deployed apps.
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (paymentStatus.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-red-800">Processing Error</CardTitle>
            <CardDescription>
              {paymentStatus.error ||
                "An error occurred while processing your Cloud credits purchase"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {retryCount < 3 && (
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Try Again"
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push("/projects")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
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
          <CardTitle>Processing Your Cloud Credits</CardTitle>
          <CardDescription>
            Please wait while we confirm your payment and add credits to your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProcessingSteps steps={steps} />

          {/* Warning about waiting */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-6">
            <p className="text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Please don&apos;t close this page. Processing may take up to 1
              minute.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
