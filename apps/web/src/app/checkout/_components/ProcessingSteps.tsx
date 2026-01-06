import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  description: string;
}

interface ProcessingStepsProps {
  steps: ProcessingStep[];
}

export default function ProcessingSteps({ steps }: ProcessingStepsProps) {
  // Calculate progress percentage
  const progress = steps.reduce((acc, step) => {
    if (step.status === 'completed') return acc + 33.33;
    if (step.status === 'loading') return acc + 16.67;
    return acc;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {step.status === 'completed' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {step.status === 'loading' && (
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              )}
              {step.status === 'error' && (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {step.status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{step.label}</p>
              <p className="text-xs text-gray-600">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 