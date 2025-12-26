import React from 'react';
import { Calendar, Clock, FileText, BookOpen, CheckSquare, PlusCircle } from 'lucide-react';

interface HomeViewProps {
  step: 1 | 2 | 3 | 4;
  currentUser?: { name: string; email: string } | null;
}

export const HomeView: React.FC<HomeViewProps> = ({ step, currentUser }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const recentPages = [
    // { id: '1', title: 'New page', icon: '📄', color: 'bg-gray-100', date: '2m ago' },
    { id: '2', title: 'Reading List', icon: '📚', color: 'bg-red-100', date: 'Dec 25, 2024' },
    // { id: '3', title: 'Quick Note', icon: '📝', color: 'bg-red-100', date: '3m ago' },
    { id: '4', title: 'Take Fig on a walk', icon: '🐕', color: 'bg-yellow-100', date: 'Dec 25, 2024' },
    { id: '5', title: 'Task List', icon: '✅', color: 'bg-blue-100', date: '8m ago' },
    { id: '6', title: 'Journal', icon: '📔', color: 'bg-gray-100', date: 'Dec 25, 2024' }
  ];

  const upcomingEvents = [
    {
      id: '1',
      title: 'Connect AI Meeting Notes with your Calendar events',
      description: 'Join calls, transcribe audio, and summarize meetings all in your todo app.',
      action: 'Connect Calendar',
      time: 'Today, Sep 27',
      type: 'integration'
    },
    {
      id: '2',
      title: 'Join and take notes',
      time: 'Sun, Sep 28',
      type: 'meeting'
    },
    {
      id: '3',
      title: 'Project check-in',
      time: '10 AM • Office',
      type: 'meeting'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Greeting Header */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          {getGreeting()}
          {currentUser && step >= 2 && (
            <span className="text-muted-foreground">, {currentUser.name.split(' ')[0]}</span>
          )}
        </h1>
      </div>

      {/* Recently Visited */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          Recently visited
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {recentPages.map((page) => (
            <button
              key={page.id}
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={`w-12 h-12 rounded-lg ${page.color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                <span className="text-xl">{page.icon}</span>
              </div>
              <span className="text-sm font-medium text-foreground text-center mb-1">
                {page.title}
              </span>
              <span className="text-xs text-muted-foreground">{page.date}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming Events - Step 2+ */}
      {step >= 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            Upcoming events
          </div>

          <div className="space-y-4">
            {/* Integration Card */}
            <div className="p-6 bg-card border border-border rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground mb-2">
                    Connect AI Meeting Notes with your Calendar events
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Join calls, transcribe audio, and summarize meetings all in Notion.
                  </p>
                  <button className="text-sm text-primary hover:underline">
                    Connect Calendar
                  </button>
                </div>
              </div>
            </div>

            {/* Event Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">Today</div>
                <div className="text-sm text-muted-foreground">Sep 27</div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                    Join and take notes
                  </div>
                </div>
              </div>

              {step >= 3 && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-foreground">Team standup</div>
                  <div className="text-sm text-muted-foreground">9 AM • Office</div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      Project check-in
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">10 AM • Office</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Home Views - Step 4+ */}
      {step >= 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Home views
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <CheckSquare className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">Task Overview</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Quick view of all your tasks and progress
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <BookOpen className="w-5 h-5 text-red-600" />
                <span className="font-medium text-foreground">Reading Progress</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Track your reading goals and completed items
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-foreground">Journal Entries</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Recent reflections and daily thoughts
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
