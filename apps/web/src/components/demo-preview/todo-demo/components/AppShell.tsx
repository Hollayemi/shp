import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TaskView } from './TaskView';
import { AuthScreen } from './AuthScreen';
import { AnalyticsView } from './AnalyticsView';
import { HomeView } from './HomeView';
import { JournalView } from './JournalView';
import { ReadingListView } from './ReadingListView';
import { Task } from './types'

interface AppShellProps {
  step: 1 | 2 | 3 | 4;
  initialTasks?: Task[];
  requireAuth?: boolean;
  features?: {
    categories?: boolean;
    tags?: boolean;
    priorities?: boolean;
    dueDates?: boolean;
    analytics?: boolean;
  };
}

// Global authentication state - persists across steps
let globalAuthState = false;

export const AppShell: React.FC<AppShellProps> = ({
  step,
  initialTasks = [],
  requireAuth = false,
  features = {}
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !requireAuth || globalAuthState;
  });
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [currentView, setCurrentView] = useState<'home' | 'tasks' | 'journal' | 'reading-list' | 'analytics'>(
    step >= 2 ? 'home' : 'tasks'
  );
  const [currentFilter, setCurrentFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add task handler
  const handleAddTask = (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title: taskData.title || '',
      completed: false,
      createdAt: new Date(),
      ...taskData,
    };

    setTasks(prev => [newTask, ...prev]);
  };

  // Toggle task completion
  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(task =>
      task.id === id ? {
        ...task,
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : undefined
      } : task
    ));
  };

  // Delete task
  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  // Step-aware configuration
  const getStepConfig = () => {
    switch (step) {
      case 1:
        return {
          pageTitle: 'My Tasks',
          pageIcon: '✅',
          pageDescription: 'Keep track of your daily tasks and goals.',
          showDatabase: false,
          showProperties: false,
          showViews: false
        };
      case 2:
        return {
          pageTitle: 'Task Manager',
          pageIcon: '📋',
          pageDescription: 'Organize your tasks with secure access and collaboration.',
          showDatabase: true,
          showProperties: false,
          showViews: false
        };
      case 3:
        return {
          pageTitle: 'Project Dashboard',
          pageIcon: '🎯',
          pageDescription: 'Advanced task organization with categories, priorities, and filtering.',
          showDatabase: true,
          showProperties: true,
          showViews: true
        };
      case 4:
        return {
          pageTitle: 'Productivity Hub',
          pageIcon: '📊',
          pageDescription: 'Complete task management with analytics and insights.',
          showDatabase: true,
          showProperties: true,
          showViews: true
        };
      default:
        return {
          pageTitle: 'My Tasks',
          pageIcon: '✅',
          pageDescription: 'Keep track of your daily tasks and goals.',
          showDatabase: false,
          showProperties: false,
          showViews: false
        };
    }
  };

  const config = getStepConfig();

  // Show authentication screen if required and not authenticated
  if (requireAuth && !isAuthenticated) {
    return (
      <AuthScreen
        onAuthenticated={(user: { name: string; email: string }) => {
          globalAuthState = true;
          setIsAuthenticated(true);
          setCurrentUser(user);
        }}
        step={step}
      />
    );
  }

  // Main Notion-style interface
  return (
    <div className="min-h-screen bg-background flex">
      {/* Notion-style Sidebar */}
      <Sidebar
        step={step}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentView={currentView}
        onViewChange={setCurrentView}
        currentUser={currentUser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSignOut={() => {
          globalAuthState = false;
          setIsAuthenticated(false);
          setCurrentUser(null);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Notion-style Page Header - Only for Task List */}
        {currentView === 'tasks' && (
          <div className="px-6 lg:px-12 py-6 border-b border-border/30">
            <div className="max-w-5xl">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <span>✅</span>
                <span>Task List</span>
                <span className="ml-2 px-2 py-0.5 bg-muted text-xs rounded">📄 Private</span>
              </div>

              {/* Page Icon and Title */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">✅</span>
                <h1 className="text-4xl font-bold text-foreground">
                  Task List
                </h1>
              </div>

              {/* Page Description */}
              <p className="text-muted-foreground text-sm mb-4 max-w-2xl">
                Use this template to track your personal tasks.
              </p>
              <p className="text-muted-foreground text-sm mb-4 max-w-2xl">
                Click <span className="text-red-500 font-medium">+ New</span> to create a new task directly on this board.
              </p>
              <p className="text-muted-foreground text-sm max-w-2xl">
                Click an existing task to add additional context or subtasks.
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 px-6 lg:px-12 py-6">
          <div className="max-w-5xl">
            {currentView === 'home' ? (
              <HomeView step={step} currentUser={currentUser} />
            ) : currentView === 'journal' ? (
              <JournalView step={step} />
            ) : currentView === 'reading-list' ? (
              <ReadingListView step={step} />
            ) : currentView === 'analytics' && step === 4 && features.analytics ? (
              <AnalyticsView tasks={tasks} step={step} />
            ) : (
              <TaskView
                step={step}
                tasks={tasks}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                showDatabase={config.showDatabase}
                showProperties={config.showProperties}
                showViews={config.showViews}
                features={features}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
