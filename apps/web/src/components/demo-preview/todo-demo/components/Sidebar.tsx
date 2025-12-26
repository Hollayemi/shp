import React from 'react';
import { 
  Search, 
  Home, 
  FileText, 
  Settings, 
  ChevronDown,
  ChevronRight,
  Plus,
  BarChart3,
  LogOut,
  User,
  ChevronLeft
} from 'lucide-react';

interface SidebarProps {
  step: 1 | 2 | 3 | 4;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentView: 'home' | 'tasks' | 'journal' | 'reading-list' | 'analytics';
  onViewChange: (view: 'home' | 'tasks' | 'journal' | 'reading-list' | 'analytics') => void;
  currentUser?: { name: string; email: string } | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  step,
  collapsed,
  onToggleCollapse,
  currentView,
  onViewChange,
  currentUser,
  searchQuery = '',
  onSearchChange,
  onSignOut
}) => {
  // Step-aware navigation items
  const getNavigationItems = () => {
    const baseItems = [
      {
        id: 'tasks',
        label: 'My Tasks',
        icon: <FileText className="w-4 h-4" />,
        active: currentView === 'tasks',
        onClick: () => onViewChange('tasks')
      }
    ];

    // Add analytics for step 4
    if (step === 4) {
      baseItems.push({
        id: 'analytics',
        label: 'Analytics',
        icon: <BarChart3 className="w-4 h-4" />,
        active: currentView === 'analytics',
        onClick: () => onViewChange('analytics')
      });
    }

    return baseItems;
  };

  const navigationItems = getNavigationItems();

  if (collapsed) {
    return (
      <div className="w-12 bg-card border-r border-border flex flex-col items-center py-4 space-y-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`p-2 rounded-md transition-colors ${
              item.active 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {item.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-green-600 rounded-sm flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {currentUser ? currentUser.name.charAt(0) : 'U'}
              </span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {currentUser ? `${currentUser.name}...` : 'User'}
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-muted rounded-sm transition-colors"
          >
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-muted/30 border-0 rounded-sm text-sm focus:outline-none focus:bg-muted/50 placeholder-muted-foreground text-foreground"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3">
        <div className="space-y-0.5">
          {/* Main Navigation */}
          <div className="space-y-0.5">
            <button 
              onClick={() => onViewChange('home')}
              className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded-sm transition-colors ${
                currentView === 'home' 
                  ? 'text-foreground bg-muted' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>

          {/* Private Section */}
          <div className="mt-4">
            <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
              Private
            </div>
            <div className="space-y-0.5 ml-2">
              <button 
                onClick={() => onViewChange('tasks')}
                className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded-sm transition-colors ${
                  currentView === 'tasks' 
                    ? 'text-foreground bg-muted' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Task List
              </button>
              <button 
                onClick={() => onViewChange('journal')}
                className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded-sm transition-colors ${
                  currentView === 'journal' 
                    ? 'text-foreground bg-muted' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <FileText className="w-4 h-4" />
                Journal
              </button>
              <button 
                onClick={() => onViewChange('reading-list')}
                className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded-sm transition-colors ${
                  currentView === 'reading-list' 
                    ? 'text-red-600 bg-muted' 
                    : 'text-red-600 hover:bg-muted'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
                Reading List
              </button>
              {/* Analytics - Step 4 only */}
              {step === 4 && (
                <button 
                  onClick={() => onViewChange('analytics')}
                  className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded-sm transition-colors ${
                    currentView === 'analytics' 
                      ? 'text-foreground bg-muted' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </button>
              )}
              {/* <button className="w-full flex items-center gap-2 px-2 py-1 text-sm text-red-600 hover:bg-muted rounded-sm transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
                Quick Note
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-border">
        <div className="space-y-0.5">
          <button className="w-full flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-sm transition-colors">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
};
