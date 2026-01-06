import React from 'react';
import { DemoComponents as TodoDemoComponents } from './todo-demo';
import { DemoComponents as SpotifyDemoComponents } from './spotify-demo'
import { DemoComponents as AirbnbDemoComponents } from './airbnb-demo'
import { DemoComponents as VacationDemoComponents } from './vacation-demo'

// Responsive Browser Container Component for isolated demo components
interface ContainerProps {
  children: React.ReactNode;
}

const Container: React.FC<ContainerProps> = ({
  children,
}) => {

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-gray-950 overflow-hidden @container"
      style={{ minHeight: '400px' }}
    >
      <div
        className="origin-center transition-transform duration-300 ease-out shadow-2xl relative w-full h-full max-h-full max-w-full"
      >
        <div
          className="w-full h-full overflow-y-scroll relative"
        >
          <div
            className="relative"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

interface DemoPreviewProps {
  demoStep: number;
  currentFragmentIndex?: number;
  type?: string;
}

export const DemoPreview: React.FC<DemoPreviewProps> = ({ demoStep, type = 'SPOTIFY_CLONE' }) => {
  // Show nothing until user starts the demo (step 0 = initial state)
  if (demoStep === 0) {
    return (
      <div className="h-full w-full bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">🚀</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Demo Preview</h3>
          <p className="text-sm">Click &quot;any of the buttons&quot; to start building</p>
        </div>
      </div>
    );
  }

  const DemoComponents = type === "SPOTIFY_CLONE" ? SpotifyDemoComponents : type === "AIRBNB_CLONE" ? AirbnbDemoComponents : type === "VACATION_APP" ? VacationDemoComponents : TodoDemoComponents

  // Get the component for the current demo step, default to step 1 if invalid
  const Component = DemoComponents[demoStep as keyof typeof DemoComponents] || DemoComponents[1];

  return (
    <div className="h-full w-full @container">
      <Container
      >
        <Component />
      </Container>
    </div>
  );
};
