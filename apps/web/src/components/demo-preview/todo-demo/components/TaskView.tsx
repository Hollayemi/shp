import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { Task } from './types';
import { BoardView } from './BoardView';

interface TaskViewProps {
  step: 1 | 2 | 3 | 4;
  tasks: Task[];
  onAddTask: (task: Partial<Task>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  showDatabase: boolean;
  showProperties: boolean;
  showViews: boolean;
  features: {
    categories?: boolean;
    tags?: boolean;
    priorities?: boolean;
    dueDates?: boolean;
    analytics?: boolean;
  };
  searchQuery?: string;
}

export const TaskView: React.FC<TaskViewProps> = ({
  step,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  showDatabase,
  showProperties,
  showViews,
  features,
  searchQuery = ''
}) => {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    category?: string;
    priority?: string;
    status?: string;
  }>({});
  const [sortBy, setSortBy] = useState<{
    field: 'createdAt' | 'priority' | 'dueDate' | 'title';
    direction: 'asc' | 'desc';
  }>({ field: 'createdAt', direction: 'desc' });

  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.category?.toLowerCase().includes(query) ||
        task.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        task.description?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (activeFilters.category) {
      filtered = filtered.filter(task => task.category === activeFilters.category);
    }
    if (activeFilters.priority) {
      filtered = filtered.filter(task => task.priority === activeFilters.priority);
    }
    if (activeFilters.status) {
      if (activeFilters.status === 'completed') {
        filtered = filtered.filter(task => task.completed);
      } else if (activeFilters.status === 'todo') {
        filtered = filtered.filter(task => !task.completed && !task.status);
      } else if (activeFilters.status === 'doing') {
        filtered = filtered.filter(task => task.status === 'doing');
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy.field) {
        case 'priority':
          const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case 'dueDate':
          aValue = a.dueDate?.getTime() || 0;
          bValue = b.dueDate?.getTime() || 0;
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
      }

      if (sortBy.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [tasks, activeFilters, sortBy, searchQuery]);

  const clearFilters = () => {
    setActiveFilters({});
  };

  const hasActiveFilters = Object.values(activeFilters).some(filter => filter);

  return (
    <div className="space-y-6">
      {/* Board View Toggle - Notion Style */}
      <div className="flex items-center gap-3">
        {/* <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          Board View
        </button> */}
        
        {/* View controls - Step 3+ */}
        {step >= 3 && showViews && (
          <div className="flex items-center gap-2 ml-auto">
            {/* Filter Button */}
            <div className="relative" ref={filterMenuRef}>
              <button 
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  hasActiveFilters 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                </svg>
                Filter
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {/* Filter Menu */}
              {showFilterMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Category</label>
                      <select 
                        value={activeFilters.category || ''} 
                        onChange={(e) => setActiveFilters({...activeFilters, category: e.target.value || undefined})}
                        className="w-full mt-1 px-2 py-1 text-sm bg-background border border-border rounded"
                      >
                        <option value="">All</option>
                        <option value="Work">Work</option>
                        <option value="Personal">Personal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Priority</label>
                      <select 
                        value={activeFilters.priority || ''} 
                        onChange={(e) => setActiveFilters({...activeFilters, priority: e.target.value || undefined})}
                        className="w-full mt-1 px-2 py-1 text-sm bg-background border border-border rounded"
                      >
                        <option value="">All</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <select 
                        value={activeFilters.status || ''} 
                        onChange={(e) => setActiveFilters({...activeFilters, status: e.target.value || undefined})}
                        className="w-full mt-1 px-2 py-1 text-sm bg-background border border-border rounded"
                      >
                        <option value="">All</option>
                        <option value="todo">To Do</option>
                        <option value="doing">Doing</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    {hasActiveFilters && (
                      <button 
                        onClick={clearFilters}
                        className="w-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sort Button */}
            <div className="relative" ref={sortMenuRef}>
              <button 
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-muted-foreground rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 5v4" />
                </svg>
                Sort
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {/* Sort Menu */}
              {showSortMenu && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    {[
                      { field: 'createdAt', label: 'Created' },
                      { field: 'title', label: 'Title' },
                      { field: 'priority', label: 'Priority' },
                      { field: 'dueDate', label: 'Due Date' }
                    ].map((option) => (
                      <button
                        key={option.field}
                        onClick={() => {
                          setSortBy({
                            field: option.field as any,
                            direction: sortBy.field === option.field && sortBy.direction === 'desc' ? 'asc' : 'desc'
                          });
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-muted transition-colors ${
                          sortBy.field === option.field ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {option.label} {sortBy.field === option.field && (sortBy.direction === 'desc' ? '↓' : '↑')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              New
            </button>
          </div>
        )}
      </div>

      {/* Search Results & Active Filters Display */}
      {(searchQuery.trim() || hasActiveFilters) && (
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
          {searchQuery.trim() && (
            <>
              <span className="text-sm font-medium text-foreground">
                Search results for {searchQuery}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                {filteredAndSortedTasks.length} {filteredAndSortedTasks.length === 1 ? 'task' : 'tasks'} found
              </span>
            </>
          )}
          {hasActiveFilters && (
            <>
              {searchQuery.trim() && <span className="text-muted-foreground">•</span>}
              <span className="text-sm font-medium text-foreground">Active filters:</span>
              {activeFilters.category && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Category: {activeFilters.category}
                </span>
              )}
              {activeFilters.priority && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                  Priority: {activeFilters.priority}
                </span>
              )}
              {activeFilters.status && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  Status: {activeFilters.status}
                </span>
              )}
            </>
          )}
          <button 
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Notion Board View */}
      <BoardView
        step={step}
        tasks={filteredAndSortedTasks}
        onAddTask={onAddTask}
        onToggleTask={onToggleTask}
        onDeleteTask={onDeleteTask}
        features={features}
      />
    </div>
  );
};
