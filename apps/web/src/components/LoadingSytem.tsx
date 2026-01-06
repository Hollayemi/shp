// Enhanced Loading UI System
// src/components/LoadingSystem.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, Code, Zap, Cpu, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export interface LoadingStage {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  estimatedDuration: number; // in milliseconds
  status: 'pending' | 'active' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
}

export interface SandboxLoadingProps {
  isLoading: boolean;
  stage?: string;
  progress?: number;
  message?: string;
  estimatedTime?: number;
  onCancel?: () => void;
}

export interface AgentLoadingProps {
  isGenerating: boolean;
  phases: Array<{
    phase: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    message?: string;
    duration?: number;
  }>;
  currentPhase?: string;
  totalProgress?: number;
}

// Sandbox Loading Component
export const SandboxLoading: React.FC<SandboxLoadingProps> = ({
  isLoading,
  stage = 'initializing',
  progress = 0,
  message,
  estimatedTime = 30000,
  onCancel
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [stages] = useState<LoadingStage[]>([
    {
      id: 'initializing',
      name: 'Initializing',
      description: 'Setting up sandbox environment',
      icon: <Cpu className="w-4 h-4" />,
      estimatedDuration: 5000,
      status: 'pending'
    },
    {
      id: 'creating',
      name: 'Creating Sandbox',
      description: 'Allocating resources and starting container',
      icon: <Zap className="w-4 h-4" />,
      estimatedDuration: 15000,
      status: 'pending'
    },
    {
      id: 'restoring',
      name: 'Restoring Files',
      description: 'Loading your project files',
      icon: <Code className="w-4 h-4" />,
      estimatedDuration: 8000,
      status: 'pending'
    },
    {
      id: 'starting',
      name: 'Starting Server',
      description: 'Launching development server',
      icon: <CheckCircle className="w-4 h-4" />,
      estimatedDuration: 2000,
      status: 'pending'
    }
  ]);

  useEffect(() => {
    if (!isLoading) {
      setTimeElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading]);

  const getCurrentStageIndex = () => {
    return stages.findIndex(s => s.id === stage);
  };

  const getStageStatus = (stageId: string): LoadingStage['status'] => {
    const currentIndex = getCurrentStageIndex();
    const stageIndex = stages.findIndex(s => s.id === stageId);
    
    if (stageIndex < currentIndex) return 'complete';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };

  const calculateProgress = () => {
    if (progress > 0) return progress;
    
    const currentIndex = getCurrentStageIndex();
    const baseProgress = (currentIndex / stages.length) * 100;
    const stageProgress = Math.min((timeElapsed / stages[currentIndex]?.estimatedDuration || 1) * 100, 100);
    const currentStageWeight = 100 / stages.length;
    
    return Math.min(baseProgress + (stageProgress * currentStageWeight / 100), 100);
  };

  if (!isLoading) return null;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <h3 className="text-lg font-semibold">Setting Up Sandbox</h3>
          </div>
          <p className="text-sm text-gray-600">
            {message || stages[getCurrentStageIndex()]?.description || 'Preparing your development environment...'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Progress</span>
            <span>{Math.round(calculateProgress())}%</span>
          </div>
          <Progress value={calculateProgress()} className="h-2" />
        </div>

        <div className="space-y-2">
          {stages.map((stageItem) => {
            const status = getStageStatus(stageItem.id);
            return (
              <div
                key={stageItem.id}
                className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                  status === 'active' ? 'bg-blue-50 border border-blue-200' :
                  status === 'complete' ? 'bg-green-50 border border-green-200' :
                  'bg-gray-50'
                }`}
              >
                <div className={`flex-shrink-0 ${
                  status === 'active' ? 'text-blue-600' :
                  status === 'complete' ? 'text-green-600' :
                  'text-gray-400'
                }`}>
                  {status === 'active' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : status === 'complete' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    stageItem.icon
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    status === 'active' ? 'text-blue-900' :
                    status === 'complete' ? 'text-green-900' :
                    'text-gray-600'
                  }`}>
                    {stageItem.name}
                  </p>
                  <p className={`text-xs ${
                    status === 'active' ? 'text-blue-700' :
                    status === 'complete' ? 'text-green-700' :
                    'text-gray-500'
                  }`}>
                    {stageItem.description}
                  </p>
                </div>
                <Badge variant={
                  status === 'active' ? 'default' :
                  status === 'complete' ? 'secondary' :
                  'outline'
                } className="text-xs">
                  {status === 'active' ? 'Running' :
                   status === 'complete' ? 'Done' :
                   'Pending'}
                </Badge>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Elapsed: {Math.round(timeElapsed / 1000)}s</span>
          </div>
          <div>
            Est. {Math.round((estimatedTime - timeElapsed) / 1000)}s remaining
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
        )}
      </CardContent>
    </Card>
  );
};

// Agent Generation Loading Component
export const AgentLoading: React.FC<AgentLoadingProps> = ({
  isGenerating,
  phases,
  currentPhase,
  totalProgress = 0
}) => {
  const [messages] = useState([
    "Analyzing your request...",
    "Planning the application architecture...",
    "Designing the user interface...",
    "Writing production-ready code...",
    "Optimizing performance...",
    "Adding finishing touches...",
    "Almost ready!"
  ]);

  const [currentMessage, setCurrentMessage] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isGenerating, messages.length]);

  const getPhaseIcon = (phase: string) => {
    switch (phase.toLowerCase()) {
      case 'architecture':
        return <Cpu className="w-4 h-4" />;
      case 'design':
        return <Zap className="w-4 h-4" />;
      case 'implementation':
        return <Code className="w-4 h-4" />;
      case 'review':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Loader2 className="w-4 h-4" />;
    }
  };

  const getPhaseDescription = (phase: string) => {
    const descriptions = {
      architecture: "Planning application structure and components",
      design: "Creating design system and visual specifications",
      implementation: "Building features with production-ready code",
      review: "Reviewing and enhancing the final application"
    };
    return descriptions[phase.toLowerCase() as keyof typeof descriptions] || "Processing...";
  };

  if (!isGenerating) return null;

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="relative">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <div className="absolute inset-0 w-6 h-6 border-2 border-purple-200 rounded-full animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold">AI is Building Your App</h3>
          </div>
          <p className="text-sm text-gray-600 animate-pulse">
            {messages[currentMessage]}
          </p>
        </div>

        {totalProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Overall Progress</span>
              <span>{Math.round(totalProgress)}%</span>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </div>
        )}

        {phases.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Generation Phases</h4>
            <div className="space-y-2">
              {phases.map((phase, index) => (
                <div
                  key={`${phase.phase}-${index}`}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 ${
                    phase.status === 'active' ? 'bg-purple-50 border border-purple-200 scale-105' :
                    phase.status === 'complete' ? 'bg-green-50 border border-green-200' :
                    phase.status === 'error' ? 'bg-red-50 border border-red-200' :
                    'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className={`flex-shrink-0 ${
                    phase.status === 'active' ? 'text-purple-600' :
                    phase.status === 'complete' ? 'text-green-600' :
                    phase.status === 'error' ? 'text-red-600' :
                    'text-gray-400'
                  }`}>
                    {phase.status === 'active' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : phase.status === 'complete' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : phase.status === 'error' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      getPhaseIcon(phase.phase)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium capitalize ${
                      phase.status === 'active' ? 'text-purple-900' :
                      phase.status === 'complete' ? 'text-green-900' :
                      phase.status === 'error' ? 'text-red-900' :
                      'text-gray-600'
                    }`}>
                      {phase.phase}
                    </p>
                    <p className={`text-xs ${
                      phase.status === 'active' ? 'text-purple-700' :
                      phase.status === 'complete' ? 'text-green-700' :
                      phase.status === 'error' ? 'text-red-700' :
                      'text-gray-500'
                    }`}>
                      {phase.message || getPhaseDescription(phase.phase)}
                    </p>
                    {phase.duration && (
                      <p className="text-xs text-gray-400 mt-1">
                        Completed in {Math.round(phase.duration / 1000)}s
                      </p>
                    )}
                  </div>
                  <Badge variant={
                    phase.status === 'active' ? 'default' :
                    phase.status === 'complete' ? 'secondary' :
                    phase.status === 'error' ? 'destructive' :
                    'outline'
                  } className="text-xs">
                    {phase.status === 'active' ? 'Active' :
                     phase.status === 'complete' ? 'Done' :
                     phase.status === 'error' ? 'Error' :
                     'Waiting'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPhase && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Current: {currentPhase}
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              {getPhaseDescription(currentPhase)}
            </p>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-500">
            This usually takes 30-60 seconds
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// Fragment Switching Loading Component
export const FragmentSwitchLoading: React.FC<{
  isLoading: boolean;
  fragmentTitle?: string;
  operation: 'switching' | 'loading' | 'restoring';
}> = ({ isLoading, fragmentTitle, operation }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const getOperationText = () => {
    switch (operation) {
      case 'switching':
        return 'Switching to fragment';
      case 'loading':
        return 'Loading fragment';
      case 'restoring':
        return 'Restoring files';
      default:
        return 'Processing';
    }
  };

  if (!isLoading) return null;

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <div className="relative inline-block">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <div className="absolute inset-0 w-8 h-8 border-2 border-blue-200 rounded-full animate-ping" />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-900">
            {getOperationText()}{dots}
          </p>
          {fragmentTitle && (
            <p className="text-sm text-gray-600 mt-1">
              {fragmentTitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Comprehensive Loading Provider
export const LoadingProvider: React.FC<{
  children: React.ReactNode;
  sandboxLoading?: SandboxLoadingProps;
  agentLoading?: AgentLoadingProps;
  fragmentLoading?: { isLoading: boolean; fragmentTitle?: string; operation: 'switching' | 'loading' | 'restoring' };
}> = ({ children, sandboxLoading, agentLoading, fragmentLoading }) => {
  const hasActiveLoading = 
    sandboxLoading?.isLoading || 
    agentLoading?.isGenerating || 
    fragmentLoading?.isLoading;

  return (
    <div className="relative">
      {children}
      
      {hasActiveLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {sandboxLoading?.isLoading && <SandboxLoading {...sandboxLoading} />}
          {agentLoading?.isGenerating && <AgentLoading {...agentLoading} />}
          {fragmentLoading?.isLoading && <FragmentSwitchLoading {...fragmentLoading} />}
        </div>
      )}
    </div>
  );
};