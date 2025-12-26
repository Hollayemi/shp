"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ExternalLink, HelpCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ApiKeyField {
  /** Unique key identifier */
  key: string;
  /** Label shown in the input placeholder */
  label: string;
  /** Validation pattern (optional) */
  pattern?: RegExp;
  /** Error message when validation fails */
  errorMessage?: string;
}

export interface ApiKeyInputProps {
  /** Title shown at the top of the card */
  title: string;
  /** Fields to collect (supports multiple keys) */
  fields: ApiKeyField[];
  /** Link to get the API key */
  helpLink?: {
    url: string;
    text: string;
  };
  /** Tooltip text for the help icon */
  helpTooltip?: string;
  /** Called when user submits the keys */
  onSubmit: (keys: Record<string, string>) => Promise<void>;
  /** Whether submission is in progress */
  isLoading?: boolean;
  /** Whether the card is disabled */
  disabled?: boolean;
}

/**
 * Reusable API key input component for collecting sensitive keys
 * Used for Stripe, OpenAI, and other integrations
 */
export function ApiKeyInput({
  title,
  fields,
  helpLink,
  helpTooltip,
  onSubmit,
  isLoading = false,
  disabled = false,
}: ApiKeyInputProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );
  const [showValues, setShowValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, false])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear error when user types
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const toggleVisibility = (key: string) => {
    setShowValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      const value = values[field.key]?.trim();
      if (!value) {
        newErrors[field.key] = `${field.label} is required`;
      } else if (field.pattern && !field.pattern.test(value)) {
        newErrors[field.key] = field.errorMessage || `Invalid ${field.label}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = disabled || isLoading || isSubmitting;
  const allFieldsFilled = fields.every((f) => values[f.key]?.trim());

  return (
    <Card className="border-border/50 bg-card/95 max-w-md border py-0 shadow-lg">
      <CardContent className="space-y-3 px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          {helpTooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="text-muted-foreground h-4 w-4 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-xs">{helpTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Input Fields */}
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showValues[field.key] ? "text" : "password"}
                  placeholder={field.label}
                  value={values[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={isDisabled}
                  className={`pr-10 ${errors[field.key] ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(field.key)}
                  disabled={isDisabled}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors disabled:opacity-50"
                >
                  {showValues[field.key] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fields.length === 1 && (
                <Button
                  onClick={handleSubmit}
                  disabled={isDisabled || !allFieldsFilled}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </Button>
              )}
            </div>
            {errors[field.key] && (
              <p className="text-destructive text-xs">{errors[field.key]}</p>
            )}
          </div>
        ))}

        {/* Submit button for multiple fields */}
        {fields.length > 1 && (
          <Button
            onClick={handleSubmit}
            disabled={isDisabled || !allFieldsFilled}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        )}

        {/* Help Link */}
        {helpLink && (
          <a
            href={helpLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
          >
            {helpLink.text}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Shown after API key submission succeeds
 */
export function ApiKeySuccess({ title }: { title: string }) {
  return (
    <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
          <svg
            className="h-4 w-4 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          {title}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Tool name constant for identifying API key request tool invocations
 */
export const REQUEST_API_KEYS_TOOL_NAME = "requestApiKeys";

/**
 * Pre-configured Stripe key input using Restricted API Key
 * This is more secure than using the full secret key
 */
export const STRIPE_KEY_CONFIG: {
  title: string;
  fields: ApiKeyField[];
  helpLink: { url: string; text: string };
  helpTooltip: string;
} = {
  title: "Enable Stripe Payments",
  fields: [
    {
      key: "secretKey",
      label: "Stripe Restricted Key",
      pattern: /^rk_(test|live)_[a-zA-Z0-9]+$/,
      errorMessage:
        "Invalid Stripe Restricted Key (should start with rk_test_ or rk_live_)",
    },
    // Note: Publishable key NOT needed for redirect flow - only used for Stripe.js/Elements
  ],
  helpLink: {
    // Fallback URL - the backend generates a dynamic URL with the project name
    // This is only used if the backend doesn't provide a helpLink
    url: "https://dashboard.stripe.com/apikeys/create?name=MyApp&permissions%5B%5D=rak_product_write&permissions%5B%5D=rak_product_read&permissions%5B%5D=rak_price_write&permissions%5B%5D=rak_price_read&permissions%5B%5D=rak_plan_write&permissions%5B%5D=rak_plan_read&permissions%5B%5D=rak_payment_link_write&permissions%5B%5D=rak_payment_link_read&permissions%5B%5D=rak_payment_intent_write&permissions%5B%5D=rak_payment_intent_read&permissions%5B%5D=rak_customer_write&permissions%5B%5D=rak_customer_read&permissions%5B%5D=rak_subscription_write&permissions%5B%5D=rak_subscription_read&permissions%5B%5D=rak_invoice_read&permissions%5B%5D=rak_invoice_item_write&permissions%5B%5D=rak_invoice_item_read&permissions%5B%5D=rak_balance_read&permissions%5B%5D=rak_refund_write&permissions%5B%5D=rak_refund_read&permissions%5B%5D=rak_coupon_write&permissions%5B%5D=rak_coupon_read&permissions%5B%5D=rak_checkout_session_write&permissions%5B%5D=rak_checkout_session_read",
    text: "Create Stripe Key (1-click)",
  },
  helpTooltip:
    "Click the link to create a restricted API key with the exact permissions needed. Copy the key that starts with rk_test_ or rk_live_.",
};
