import React, { useState } from 'react';
import { Plus, Calendar, Filter, SortAsc } from 'lucide-react';

interface JournalEntry {
  id: string;
  title: string;
  type: 'Daily' | 'Personal';
  date: Date;
  content?: string;
}

interface JournalViewProps {
  step: 1 | 2 | 3 | 4;
}

export const JournalView: React.FC<JournalViewProps> = ({ step }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([
    {
      id: '1',
      title: 'Daily reflection',
      type: 'Daily',
      date: new Date('2021-12-25'),
      content: 'Today was a productive day...'
    }
  ]);

  const [activeView, setActiveView] = useState<'All Entries' | 'Daily Entries' | 'Personal Entries'>('All Entries');
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryType, setNewEntryType] = useState<'Daily' | 'Personal'>('Daily');
  const [newEntryContent, setNewEntryContent] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort entries based on active view
  const filteredAndSortedEntries = entries
    .filter(entry => {
      if (activeView === 'All Entries') return true;
      if (activeView === 'Daily Entries') return entry.type === 'Daily';
      if (activeView === 'Personal Entries') return entry.type === 'Personal';
      return true;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default: // date
          aValue = a.date.getTime();
          bValue = b.date.getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleCreateEntry = () => {
    if (!newEntryTitle.trim()) return;
    
    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      title: newEntryTitle,
      type: newEntryType,
      date: new Date(),
      content: newEntryContent || undefined
    };
    
    setEntries(prev => [newEntry, ...prev]);
    setNewEntryTitle('');
    setNewEntryContent('');
    setShowNewEntryForm(false);
  };

  const handleNewEntry = () => {
    setShowNewEntryForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">📔</span>
        <h1 className="text-4xl font-bold text-foreground">Journal</h1>
      </div>

      {/* Description */}
      <div className="space-y-3 mb-8">
        <p className="text-muted-foreground text-sm">
          Document your life - daily happenings, special occasions, and reflections on your goals.
        </p>
        <p className="text-muted-foreground text-sm">
          Categorize entries with tags and automatically capture the date.
        </p>
        
        {step >= 2 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              📝 Click <span className="font-medium text-red-500">All Entries</span> to filter entries by a specific category such as <span className="font-medium">daily</span> or <span className="font-medium">personal</span>.
            </p>
          </div>
        )}
      </div>

      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* View Tabs */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {(['All Entries', 'Daily Entries', 'Personal Entries'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeView === view
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          {step >= 3 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                {showFilterMenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-10 p-3">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">Filter by type</h4>
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            setActiveView('All Entries');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                            activeView === 'All Entries' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          All Entries
                        </button>
                        <button
                          onClick={() => {
                            setActiveView('Daily Entries');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                            activeView === 'Daily Entries' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          Daily Entries
                        </button>
                        <button
                          onClick={() => {
                            setActiveView('Personal Entries');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                            activeView === 'Personal Entries' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          Personal Entries
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                >
                  <SortAsc className="w-4 h-4" />
                  Sort
                </button>
                {showSortMenu && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-10 p-2">
                    <div className="space-y-1">
                      {[
                        { field: 'date', label: 'Date' },
                        { field: 'title', label: 'Title' },
                        { field: 'type', label: 'Type' }
                      ].map((option) => (
                        <button
                          key={option.field}
                          onClick={() => {
                            if (sortBy === option.field) {
                              setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                            } else {
                              setSortBy(option.field as 'date' | 'title' | 'type');
                              setSortOrder('desc');
                            }
                            setShowSortMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                            sortBy === option.field ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          {option.label} {sortBy === option.field && (sortOrder === 'desc' ? '↓' : '↑')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={handleNewEntry}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* New Entry Form */}
      {showNewEntryForm && (
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="text-lg font-medium text-foreground mb-4">Create New Journal Entry</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Title</label>
              <input
                type="text"
                value={newEntryTitle}
                onChange={(e) => setNewEntryTitle(e.target.value)}
                placeholder="Enter entry title..."
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Type</label>
              <select
                value={newEntryType}
                onChange={(e) => setNewEntryType(e.target.value as 'Daily' | 'Personal')}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Daily">Daily</option>
                <option value="Personal">Personal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Content (optional)</label>
              <textarea
                value={newEntryContent}
                onChange={(e) => setNewEntryContent(e.target.value)}
                placeholder="Write your thoughts..."
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateEntry}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                Create Entry
              </button>
              <button
                onClick={() => {
                  setShowNewEntryForm(false);
                  setNewEntryTitle('');
                  setNewEntryContent('');
                }}
                className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journal Entries */}
      <div className="space-y-4">
        {filteredAndSortedEntries.map((entry) => (
          <div key={entry.id} className="group border border-border rounded-lg p-4 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-foreground">{entry.title}</h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    entry.type === 'Daily' 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-purple-100 text-purple-700 border border-purple-200'
                  }`}>
                    {entry.type}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {entry.date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {entry.content && (
                  <p className="text-muted-foreground text-sm">{entry.content}</p>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 hover:bg-muted rounded-md transition-colors">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add New Entry */}
        <button 
          onClick={handleNewEntry}
          className="w-full flex items-center gap-3 p-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          New page
        </button>
      </div>
    </div>
  );
};
