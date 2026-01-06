"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Users } from "lucide-react";

interface TeamSelectorProps {
  selectedTeamId?: string;
  onTeamSelect?: (teamId: string) => void;
  showCreateButton?: boolean;
}

export function TeamSelector({ 
  selectedTeamId, 
  onTeamSelect, 
  showCreateButton = true 
}: TeamSelectorProps) {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span>Personal Team</span>
        <Badge variant="secondary" className="text-xs">Personal</Badge>
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
} 