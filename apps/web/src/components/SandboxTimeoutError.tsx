'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Clock } from 'lucide-react';

interface SandboxTimeoutErrorProps {
  onRefresh: () => void;
  className?: string;
}

export function SandboxTimeoutError({ onRefresh, className }: SandboxTimeoutErrorProps) {
  return (
    <Card className={`w-full ${className} h-full flex flex-col items-center justify-center`}>
      <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-100">
          <Clock className="w-8 h-8 text-orange-600" />
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Sandbox Timeout
          </h3>
          <p className="text-sm text-gray-600 max-w-sm">
            Your sandbox has timed out due to inactivity. Don&apos;t worry, just hit refresh to restart it with your latest code.
          </p>
        </div>

        <Button 
          onClick={onRefresh}
          className="flex items-center gap-2"
          size="lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Sandbox
        </Button>
      </CardContent>
    </Card>
  );
}