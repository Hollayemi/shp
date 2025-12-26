"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Check,
  X,
  Loader2,
  ArrowRightLeft,
  Database,
  Key,
  Trash2,
} from "lucide-react";
import { useState } from "react";

interface MigrationHitlCardProps {
  /** The platform being migrated from */
  platform: "LOVABLE" | "BASE44";
  /** Called when user approves migration */
  onApprove: () => void;
  /** Called when user skips migration */
  onSkip: () => void;
  /** Whether an action is in progress */
  isLoading?: boolean;
}

const platformInfo = {
  LOVABLE: {
    name: "Lovable",
    migrations: [
      { icon: Key, label: "Replace Supabase Auth with Better Auth" },
      { icon: ArrowRightLeft, label: "Convert Edge Functions to Convex" },
      { icon: Database, label: "Migrate Supabase tables to Convex" },
      { icon: Trash2, label: "Remove Supabase dependencies" },
    ],
  },
  BASE44: {
    name: "Base44",
    migrations: [
      { icon: Database, label: "Convert entities to Convex tables" },
      { icon: Key, label: "Replace Base44 Auth with Better Auth" },
      { icon: ArrowRightLeft, label: "Migrate SDK integrations" },
      { icon: Trash2, label: "Remove @base44/sdk" },
    ],
  },
};

/**
 * HITL approval card for backend migration
 * Follows the same theme as StripeHitlCard
 */
export function MigrationHitlCard({
  platform,
  onApprove,
  onSkip,
  isLoading = false,
}: MigrationHitlCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const info = platformInfo[platform];

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      onApprove();
    } finally {
      setIsApproving(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      onSkip();
    } finally {
      setIsSkipping(false);
    }
  };

  const isDisabled = isLoading || isApproving || isSkipping;

  return (
    <Card className="border-border/50 bg-card/95 max-w-md border py-0 shadow-lg">
      <CardContent className="space-y-3 px-4 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <ArrowRightLeft className="text-primary h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Migrate Backend</h3>
            <p className="text-muted-foreground text-xs">
              Imported from {info.name}
            </p>
          </div>
        </div>

        {/* Short description (no technical details) */}
        <p className="text-muted-foreground text-sm">
          We’ll migrate your backend to Shipper.
        </p>
      </CardContent>

      <CardFooter className="flex gap-2 px-4 pt-0 pb-3">
        <Button
          onClick={handleApprove}
          disabled={isDisabled}
          className="flex-1"
        >
          {isApproving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Allow
            </>
          )}
        </Button>
        <Button variant="secondary" onClick={handleSkip} disabled={isDisabled}>
          {isSkipping ? (
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
