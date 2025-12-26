'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RotateCcw, Server, AlertCircle } from 'lucide-react';

interface SandboxExpiredErrorProps {
  onReinstall: () => void;
  className?: string;
}

export function SandboxExpiredError({ onReinstall, className }: SandboxExpiredErrorProps) {
  return (
    <Card className={`w-full ${className}`}>
      <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
          <Server className="w-8 h-8 text-red-600" />
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Sandbox Expired
          </h3>
          <p className="text-sm text-gray-600 max-w-sm">
            Your development environment has been automatically shut down after 15 minutes of inactivity. 
            Click below to reinstall it with your latest code.
          </p>
        </div>

        <Button 
          onClick={onReinstall}
          className="flex items-center gap-2"
          size="lg"
        >
          <RotateCcw className="w-4 h-4" />
          Reinstall Sandbox
        </Button>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle className="w-3 h-3" />
          <span>This preserves your code and installs fresh dependencies</span>
        </div>
      </CardContent>
    </Card>
  );
}