"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Check,
  X,
  Loader2,
  CreditCard,
  Package,
  DollarSign,
  List,
} from "lucide-react";
import { useState } from "react";

// Stripe icon SVG
const StripeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
  </svg>
);

interface StripeHitlCardProps {
  /** The action being performed */
  action: string;
  /** Description of the operation */
  description?: string;
  /** Details to show (for create product) */
  details?: {
    name?: string;
    description?: string;
    price?: string;
    type?: string;
  };
  /** Original tool arguments to pass back on confirm */
  toolArgs?: Record<string, unknown>;
  /** Called when user approves - receives original tool args */
  onConfirm: (args?: Record<string, unknown>) => void;
  /** Called when user denies */
  onDeny: () => void;
  /** Whether an action is in progress */
  isLoading?: boolean;
}

/**
 * HITL approval card for Stripe operations
 * Follows the same theme as ShipperCloudConfirmation
 */
export function StripeHitlCard({
  action,
  description,
  details,
  toolArgs,
  onConfirm,
  onDeny,
  isLoading = false,
}: StripeHitlCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDenying, setIsDenying] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      // Pass back the original tool args so the AI can execute the operation
      onConfirm(toolArgs);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeny = async () => {
    setIsDenying(true);
    try {
      onDeny();
    } finally {
      setIsDenying(false);
    }
  };

  const isDisabled = isLoading || isConfirming || isDenying;

  // Determine icon based on action
  const getActionIcon = () => {
    if (action.toLowerCase().includes("list")) return List;
    if (action.toLowerCase().includes("create")) return Package;
    return CreditCard;
  };
  const ActionIcon = getActionIcon();

  return (
    <Card className="border-border/50 bg-card/95 max-w-md border py-0 shadow-lg">
      <CardContent className="space-y-2 px-4 pt-3 pb-2">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <StripeIcon className="text-primary h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{action}</h3>
            {description && (
              <p className="text-muted-foreground text-xs">{description}</p>
            )}
          </div>
        </div>

        {/* Details Grid (for create product) */}
        {details && (details.name || details.price) && (
          <div className="grid grid-cols-2 gap-1.5">
            {details.name && (
              <div className="bg-muted/30 flex items-center gap-2 rounded-md p-2">
                <Package className="text-primary h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs leading-tight font-medium">Name</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {details.name}
                  </p>
                </div>
              </div>
            )}
            {details.price && (
              <div className="bg-muted/30 flex items-center gap-2 rounded-md p-2">
                <DollarSign className="text-primary h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs leading-tight font-medium">Price</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {details.price}
                  </p>
                </div>
              </div>
            )}
            {details.description && (
              <div className="bg-muted/30 col-span-2 flex items-center gap-2 rounded-md p-2">
                <CreditCard className="text-primary h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs leading-tight font-medium">
                    Description
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {details.description}
                  </p>
                </div>
              </div>
            )}
            {details.type && (
              <div className="bg-muted/30 col-span-2 flex items-center gap-2 rounded-md p-2">
                <ActionIcon className="text-primary h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs leading-tight font-medium">Type</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {details.type}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <p className="text-muted-foreground text-[11px]">
          This will execute in your Stripe account.
        </p>
      </CardContent>

      <CardFooter className="flex gap-2 px-4 pt-0 pb-3">
        <Button
          onClick={handleConfirm}
          disabled={isDisabled}
          className="flex-1"
        >
          {isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Allow
            </>
          )}
        </Button>
        <Button variant="secondary" onClick={handleDeny} disabled={isDisabled}>
          {isDenying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <X className="mr-2 h-4 w-4" />
              Deny
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Shown while Stripe operation is processing
 */
export function StripeHitlProcessing({ action }: { action: string }) {
  return (
    <Card className="border-primary/20 from-primary/5 to-primary/10 border-2 bg-gradient-to-br">
      <CardContent className="flex items-center gap-4">
        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        </div>
        <div>
          <p className="font-medium">Processing Stripe Operation</p>
          <p className="text-muted-foreground text-sm">{action}...</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Shown after Stripe operation succeeds
 */
export function StripeHitlSuccess({
  action,
  productId,
  priceId,
}: {
  action: string;
  productId?: string;
  priceId?: string;
}) {
  return (
    <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
      <CardContent className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <Check className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <p className="font-medium text-green-700 dark:text-green-400">
            {action} completed
          </p>
          {productId && (
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              Product: {productId}
            </p>
          )}
          {priceId && (
            <p className="text-muted-foreground font-mono text-xs">
              Price: {priceId}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Shown when user denies the Stripe operation
 */
export function StripeHitlDenied() {
  return (
    <Card className="border-muted bg-muted/30 border">
      <CardContent className="flex items-center gap-4 py-4">
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
          <X className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">
            Stripe operation cancelled
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Tool name constants for Stripe HITL tools
 */
export const STRIPE_HITL_TOOL_NAMES = {
  LIST_PRODUCTS: "stripeListProducts",
  LIST_PRICES: "stripeListPrices",
  CREATE_PRODUCT_AND_PRICE: "stripeCreateProductAndPrice",
} as const;

/**
 * Helper to check if a tool name is a Stripe HITL tool
 */
export function isStripeHitlTool(toolName: string): boolean {
  return (
    toolName === STRIPE_HITL_TOOL_NAMES.LIST_PRODUCTS ||
    toolName === STRIPE_HITL_TOOL_NAMES.LIST_PRICES ||
    toolName === STRIPE_HITL_TOOL_NAMES.CREATE_PRODUCT_AND_PRICE
  );
}
